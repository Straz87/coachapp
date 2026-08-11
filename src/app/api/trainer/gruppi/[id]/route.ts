import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";

// Impostazioni pubbliche di un gruppo: pubblico/privato, prezzo mensile
// (0 o vuoto = gratuito) e giorni di prova. Se il prezzo cambia e ci sono
// già membri iscritti con carta salvata su Stripe, aggiorniamo in
// automatico i loro abbonamenti alla nuova cifra: il trainer non deve
// ricontattare nessuno a mano.

async function requireTrainerContext() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  if (!profile || profile.role !== "trainer") return null;
  return { supabase, profile };
}

// PATCH /api/trainer/gruppi/[id]
// Body: { public, price, trialDays, couponId }
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const ctx = await requireTrainerContext();
  if (!ctx) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }
  const { supabase, profile } = ctx;

  const { data: group } = await supabase
    .from("workout_groups")
    .select("*")
    .eq("id", params.id)
    .eq("trainer_id", profile.id)
    .maybeSingle();

  if (!group) {
    return NextResponse.json({ error: "Gruppo non trovato" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const newPrice =
    body?.price === "" || body?.price === null || body?.price === undefined ? 0 : Number(body.price);
  const trialDays = body?.trialDays ? Number(body.trialDays) : 0;
  const couponId = body?.couponId || null;
  const isPublic = !!body?.public;

  const priceChanged = Number(group.price ?? 0) !== newPrice;

  const { error } = await supabase
    .from("workout_groups")
    .update({
      public: isPublic,
      price: newPrice,
      trial_days: trialDays,
      coupon_id: couponId,
    })
    .eq("id", params.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let updatedSubscriptions = 0;
  let failedSubscriptions = 0;

  if (priceChanged) {
    const { data: members } = await supabase
      .from("group_members")
      .select("client_id, clients:client_id(id, stripe_subscription_id)")
      .eq("group_id", params.id);

    const stripe = getStripe();

    for (const m of members || []) {
      const client = (m as any).clients;
      if (!client?.stripe_subscription_id) continue;
      try {
        const sub = await stripe.subscriptions.retrieve(client.stripe_subscription_id);
        const item = sub.items.data[0];
        if (!item) continue;

        await stripe.subscriptions.update(client.stripe_subscription_id, {
          items: [
            {
              id: item.id,
              price_data: {
                currency: "eur",
                unit_amount: Math.round(newPrice * 100),
                recurring: { interval: "month" },
                product: item.price.product as string,
              },
            },
          ],
          proration_behavior: "none",
        });

        await supabase.from("clients").update({ price: newPrice }).eq("id", client.id);
        updatedSubscriptions++;
      } catch (e) {
        failedSubscriptions++;
      }
    }
  }

  return NextResponse.json({ ok: true, updatedSubscriptions, failedSubscriptions });
}

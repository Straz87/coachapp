import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";
import { sendEmail } from "@/lib/email";
import { sendPushToProfile } from "@/lib/push";

// Impostazioni pubbliche di un gruppo: pubblico/privato, prezzo mensile
// (0 o vuoto = gratuito) e giorni di prova.
//
// Se il prezzo SCENDE, aggiorniamo subito gli abbonamenti Stripe dei
// membri già iscritti: non c'è nessun rischio per loro, pagano meno.
//
// Se il prezzo SALE, NON addebitiamo più in automatico (rischio dispute
// e non conforme alle regole PSD2/SCA sulle carte europee): creiamo
// invece una richiesta di conferma per ogni membro con carta salvata,
// con 3 giorni di tempo per accettare o rifiutare. Un cron job
// (/api/cron/prezzo-scadenza) rimuove chi non risponde in tempo.
const CONFERMA_GIORNI = 3;

const PRICE_CHANGE_EMAIL_SUBJECT = "Il prezzo del tuo gruppo sta cambiando";

function priceChangeEmailHtml({
  clientName,
  groupName,
  oldPrice,
  newPrice,
  confirmUrl,
}: {
  clientName: string;
  groupName: string;
  oldPrice: number;
  newPrice: number;
  confirmUrl: string;
}) {
  return `
    <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto;">
      <p>Ciao ${clientName.split(" ")[0]},</p>
      <p>
        il tuo trainer ha aggiornato il prezzo del gruppo <strong>${groupName}</strong>
        da ${oldPrice}€/mese a <strong>${newPrice}€/mese</strong>.
      </p>
      <p>
        Non ti verrà addebitato nulla senza la tua conferma. Hai
        <strong>${CONFERMA_GIORNI} giorni</strong> di tempo per accettare il nuovo prezzo
        o rifiutare: se rifiuti (o non rispondi in tempo), verrai semplicemente
        rimosso dal gruppo, senza alcun addebito.
      </p>
      <p style="margin: 24px 0;">
        <a href="${confirmUrl}" style="background:#d9f99d;color:#111;padding:12px 20px;border-radius:999px;text-decoration:none;font-weight:600;">
          Vedi e conferma
        </a>
      </p>
      <p style="color:#888; font-size: 13px;">Hybridmethod</p>
    </div>
  `;
}

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
// Body: { public, price, trialDays, couponId, description, showInVetrina }
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
  const showInVetrina = !!body?.showInVetrina;
  const description =
    typeof body?.description === "string" ? body.description.trim() || null : (group.description ?? null);

  const oldPrice = Number(group.price ?? 0);
  const priceIncreased = newPrice > oldPrice;
  const priceDecreased = newPrice < oldPrice;

  const { error } = await supabase
    .from("workout_groups")
    .update({
      public: isPublic,
      show_in_vetrina: showInVetrina,
      price: newPrice,
      trial_days: trialDays,
      coupon_id: couponId,
      description,
    })
    .eq("id", params.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let updatedSubscriptions = 0;
  let failedSubscriptions = 0;
  let pendingConfirmations = 0;

  if (priceDecreased) {
    // Il prezzo scende: nessun rischio per il cliente, aggiorniamo subito.
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
  } else if (priceIncreased) {
    // Il prezzo sale: chiediamo conferma a chi ha già la carta salvata,
    // invece di addebitare in automatico. Usiamo il client admin (service
    // role) per leggere/scrivere su workout_group_price_changes: quella
    // tabella ha di proposito solo policy di SELECT per trainer/cliente,
    // nessuna policy di INSERT/UPDATE, perché le uniche scritture devono
    // passare da qui o dalla route di accetta/rifiuta del cliente.
    const admin = createAdminClient();

    const { data: members } = await admin
      .from("group_members")
      .select("client_id, clients:client_id(id, stripe_subscription_id, profile_id, profiles:profile_id(full_name, email))")
      .eq("group_id", params.id);

    const origin = new URL(request.url).origin;
    const expiresAt = new Date(Date.now() + CONFERMA_GIORNI * 24 * 60 * 60 * 1000).toISOString();

    for (const m of members || []) {
      const client = (m as any).clients;
      if (!client?.stripe_subscription_id) continue;

      // Se c'era già una richiesta in sospeso per questo cliente su questo
      // gruppo, la sostituiamo con quella nuova (il trainer potrebbe aver
      // cambiato idea sul prezzo prima che il cliente rispondesse).
      await admin
        .from("workout_group_price_changes")
        .update({ status: "expired", responded_at: new Date().toISOString() })
        .eq("group_id", params.id)
        .eq("client_id", client.id)
        .eq("status", "pending");

      const { data: change, error: changeError } = await admin
        .from("workout_group_price_changes")
        .insert({
          group_id: params.id,
          client_id: client.id,
          trainer_id: profile.id,
          old_price: oldPrice,
          new_price: newPrice,
          status: "pending",
          expires_at: expiresAt,
        })
        .select()
        .single();

      if (changeError || !change) {
        console.error("Errore creazione richiesta conferma prezzo:", changeError);
        continue;
      }

      pendingConfirmations++;

      const clientEmail = client.profiles?.email;
      const clientName = client.profiles?.full_name || "cliente";
      if (change && clientEmail) {
        await sendEmail({
          to: clientEmail,
          subject: PRICE_CHANGE_EMAIL_SUBJECT,
          html: priceChangeEmailHtml({
            clientName,
            groupName: group.name,
            oldPrice,
            newPrice,
            confirmUrl: `${origin}/cliente/prezzo/${change.id}`,
          }),
        });
      }

      if (change && client.profile_id) {
        await sendPushToProfile(client.profile_id, {
          title: "Nuovo prezzo del gruppo",
          body: `${group.name}: nuovo prezzo ${newPrice}€/mese. Hai ${CONFERMA_GIORNI} giorni per accettare o rifiutare.`,
          url: `/cliente/prezzo/${change.id}`,
        });
      }
    }
  }

  return NextResponse.json({ ok: true, updatedSubscriptions, failedSubscriptions, pendingConfirmations });
}

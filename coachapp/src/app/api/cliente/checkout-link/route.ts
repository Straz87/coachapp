import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";

// POST /api/cliente/checkout-link
// Il cliente autenticato genera un link di pagamento per SE STESSO.
// Se il suo piano e' "Pagamento unico N mesi" il link e' un pagamento singolo
// del totale (prezzo mensile x N); altrimenti e' l'abbonamento mensile.
export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  if (!profile || profile.role !== "client") {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const { data: client } = await supabase
    .from("clients")
    .select("id, trainer_id, price, billing_note, stripe_customer_id, profiles:profile_id(full_name, email)")
    .eq("profile_id", profile.id)
    .maybeSingle();

  if (!client) {
    return NextResponse.json({ error: "Cliente non trovato" }, { status: 404 });
  }

  const price = client.price;
  if (!price || Number(price) <= 0) {
    return NextResponse.json(
      { error: "Il tuo trainer non ha ancora impostato un prezzo. Contattalo per riattivare l'abbonamento." },
      { status: 400 }
    );
  }

  const stripe = getStripe();
  const origin = new URL(request.url).origin;
  const clientName = (client as any).profiles?.full_name || "Cliente";
  const clientEmail = (client as any).profiles?.email;
  const oneShot = String(client.billing_note || "").match(/Pagamento unico (\d+) mesi/);

  try {
    if (oneShot) {
      const months = Number(oneShot[1]);
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        customer: client.stripe_customer_id || undefined,
        customer_email: client.stripe_customer_id ? undefined : clientEmail || undefined,
        ...(client.stripe_customer_id ? {} : { customer_creation: "always" as const }),
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "eur",
              unit_amount: Math.round(Number(price) * months * 100),
              product_data: { name: `Coaching ${months} mesi - ${clientName}` },
            },
          },
        ],
        metadata: { client_id: client.id, trainer_id: client.trainer_id, months: String(months), kind: "unico" },
        success_url: `${origin}/cliente?pagamento=ok`,
        cancel_url: `${origin}/cliente?pagamento=annullato`,
      });
      return NextResponse.json({ url: session.url });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: client.stripe_customer_id || undefined,
      customer_email: client.stripe_customer_id ? undefined : clientEmail || undefined,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "eur",
            unit_amount: Math.round(Number(price) * 100),
            recurring: { interval: "month" },
            product_data: { name: `Coaching mensile - ${clientName}` },
          },
        },
      ],
      metadata: { client_id: client.id, trainer_id: client.trainer_id },
      subscription_data: {
        metadata: { client_id: client.id, trainer_id: client.trainer_id },
      },
      success_url: `${origin}/cliente?pagamento=ok`,
      cancel_url: `${origin}/cliente?pagamento=annullato`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    console.error("Errore creazione checkout Stripe (cliente):", err);
    return NextResponse.json({ error: "Errore Stripe: " + (err?.message || "sconosciuto") }, { status: 500 });
  }
}

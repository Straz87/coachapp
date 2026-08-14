import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";

// POST /api/cliente/checkout-link
// Nessun body: il cliente autenticato genera un link di pagamento per SE
// STESSO (non per un cliente a scelta, a differenza della route equivalente
// del trainer). Serve per il pulsante "Paga ora e riattiva" che compare
// nella schermata di blocco quando l'abbonamento è scaduto o sospeso, così
// il cliente può pagare direttamente dal telefono senza dover aspettare che
// il trainer gli generi e gli mandi un link a mano.
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
    .select("id, trainer_id, price, stripe_customer_id, profiles:profile_id(full_name, email)")
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

  try {
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
            product_data: {
              name: `Coaching mensile - ${clientName}`,
            },
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

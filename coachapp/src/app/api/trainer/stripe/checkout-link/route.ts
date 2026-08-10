import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";

// POST /api/trainer/stripe/checkout-link
// Body: { clientId: string }
// Genera un link di pagamento Stripe Checkout (abbonamento mensile
// ricorrente) per il cliente indicato, usando il prezzo che il trainer
// ha impostato in "clients.price". Il trainer autenticato deve essere
// il proprietario del cliente (RLS + controllo esplicito qui sotto).
export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  if (!profile || profile.role !== "trainer") {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const clientId = body?.clientId;
  const overridePrice = body?.price ? Number(body.price) : null;
  if (!clientId) {
    return NextResponse.json({ error: "clientId mancante" }, { status: 400 });
  }

  const { data: client } = await supabase
    .from("clients")
    .select("*, profiles:profile_id(full_name, email)")
    .eq("id", clientId)
    .eq("trainer_id", profile.id)
    .single();

  if (!client) {
    return NextResponse.json({ error: "Cliente non trovato" }, { status: 404 });
  }

  // Se il trainer ha appena cambiato il prezzo nel form ma non ha ancora
  // salvato, usiamo quello (e lo salviamo) così il link riflette sempre
  // quanto mostrato a schermo, non un valore vecchio rimasto sul DB.
  const price = overridePrice ?? client.price;

  if (!price || price <= 0) {
    return NextResponse.json(
      { error: "Imposta prima un prezzo mensile per questo cliente" },
      { status: 400 }
    );
  }

  if (overridePrice && overridePrice !== client.price) {
    await supabase.from("clients").update({ price: overridePrice }).eq("id", clientId);
  }

  const stripe = getStripe();
  const origin = new URL(request.url).origin;
  const clientName = client.profiles?.full_name || "Cliente";

  try {
    // Riusa il customer Stripe se già esiste (rinnovi/nuovi link successivi),
    // altrimenti lascia che sia Checkout a crearlo dall'email del cliente.
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: client.stripe_customer_id || undefined,
      customer_email: client.stripe_customer_id ? undefined : client.profiles?.email || undefined,
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
      metadata: { client_id: client.id, trainer_id: profile.id },
      subscription_data: {
        metadata: { client_id: client.id, trainer_id: profile.id },
      },
      success_url: `${origin}/trainer/clienti/${client.id}?pagamento=ok`,
      cancel_url: `${origin}/trainer/clienti/${client.id}?pagamento=annullato`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    console.error("Errore creazione checkout Stripe:", err);
    return NextResponse.json({ error: "Errore Stripe: " + (err?.message || "sconosciuto") }, { status: 500 });
  }
}

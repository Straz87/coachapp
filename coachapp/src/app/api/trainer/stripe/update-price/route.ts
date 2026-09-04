import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";
import { sendPushToProfile } from "@/lib/push";

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
// POST /api/trainer/stripe/update-price
// Body: { clientId: string, price: number }
//
// Aggiorna il prezzo dell'abbonamento Stripe GIA' ATTIVO di un cliente.
// A differenza di "Genera link di pagamento" (che crea un abbonamento
// nuovo da zero facendo ripetere il checkout al cliente), questa route
// modifica quello esistente: il cliente non deve fare nulla, non gli
// viene richiesta di nuovo la carta, e il nuovo importo si applica dal
// rinnovo successivo (proration_behavior: "none" = nessun addebito di
// conguaglio oggi).
//
// Vale allo stesso modo per clienti individuali, membri di un gruppo o
// iscritti a un programma: sono tutti righe della tabella "clients",
// quindi non serve nessuna logica diversa per caso.
export async function POST(request: Request) {
  const ctx = await requireTrainerContext();
  if (!ctx) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }
  const { supabase, profile } = ctx;

  const body = await request.json().catch(() => null);
  const clientId = body?.clientId;
  const newPrice = body?.price ? Number(body.price) : null;

  if (!clientId) {
    return NextResponse.json({ error: "clientId mancante" }, { status: 400 });
  }
  if (!newPrice || newPrice <= 0) {
    return NextResponse.json({ error: "Prezzo non valido" }, { status: 400 });
  }

  const { data: client } = await supabase
    .from("clients")
    .select("id, stripe_subscription_id, profile_id")
    .eq("id", clientId)
    .eq("trainer_id", profile.id)
    .maybeSingle();

  if (!client) {
    return NextResponse.json({ error: "Cliente non trovato" }, { status: 404 });
  }
  if (!client.stripe_subscription_id) {
    return NextResponse.json(
      { error: "Questo cliente non ha ancora un abbonamento Stripe attivo" },
      { status: 400 }
    );
  }

  const stripe = getStripe();

  try {
    const subscription = await stripe.subscriptions.retrieve(client.stripe_subscription_id);
    const item = subscription.items.data[0];
    if (!item) {
      return NextResponse.json({ error: "Abbonamento Stripe senza righe" }, { status: 500 });
    }

    // Riusa lo stesso prodotto Stripe gia' associato, cambia solo
    // l'importo mensile.
    const currentProduct =
      typeof item.price.product === "string" ? item.price.product : item.price.product.id;

    await stripe.subscriptions.update(client.stripe_subscription_id, {
      items: [
        {
          id: item.id,
          price_data: {
            currency: item.price.currency || "eur",
            unit_amount: Math.round(newPrice * 100),
            recurring: { interval: "month" },
            product: currentProduct,
          },
        },
      ],
      proration_behavior: "none",
    });

    await supabase.from("clients").update({ price: newPrice }).eq("id", clientId);

        // Avvisa il cliente via notifica push (se l'ha attivata) che il
        // prezzo del suo abbonamento e' cambiato, cosi' non se lo ritrova
        // come sorpresa al rinnovo successivo.
        if (client.profile_id) {
                await sendPushToProfile(client.profile_id, {
                          title: "Prezzo abbonamento aggiornato",
                          body: "Il tuo trainer ha aggiornato il prezzo del tuo abbonamento a " + newPrice + "€/mese, in vigore dal prossimo rinnovo.",
                });
        }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("Errore aggiornamento prezzo Stripe:", err);
    return NextResponse.json(
      { error: "Errore Stripe: " + (err?.message || "sconosciuto") },
      { status: 500 }
    );
  }
}

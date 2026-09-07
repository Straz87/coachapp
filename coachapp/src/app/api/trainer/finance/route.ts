import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";

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

// GET /api/trainer/finance
// Vista d'insieme "Finanza": clienti con prezzo/stato e gli ultimi pagamenti
// Stripe di TUTTI i clienti in un unico posto, invece di doverli guardare
// uno per uno dentro ogni scheda cliente. Le azioni vere e proprie (aggiorna
// prezzo, rimborso) restano sulle route gia' esistenti
// (/api/trainer/stripe/update-price e /api/trainer/clients/[id]/payments)
// cosi la logica di sicurezza/verifica non e' duplicata.
export async function GET() {
  const ctx = await requireTrainerContext();
  if (!ctx) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }
  const { supabase, profile } = ctx;

  const { data: clientsData } = await supabase
    .from("clients")
    .select(
      "id, status, price, stripe_customer_id, stripe_subscription_id, profiles:profile_id(full_name)"
    )
    .eq("trainer_id", profile.id)
    .order("created_at", { ascending: false });

  const rows = (clientsData || []) as any[];

  const clients = rows.map((c) => ({
    id: c.id,
    name: c.profiles?.full_name || "Cliente",
    status: c.status,
    price: c.price,
    hasStripeCustomer: !!c.stripe_customer_id,
    hasStripeSubscription: !!c.stripe_subscription_id,
  }));

  // Mappa customer Stripe -> cliente, per abbinare i pagamenti.
  const customerToClient = new Map<string, { id: string; name: string }>();
  for (const c of rows) {
    if (c.stripe_customer_id) {
      customerToClient.set(c.stripe_customer_id, {
        id: c.id,
        name: c.profiles?.full_name || "Cliente",
      });
    }
  }

  let payments: any[] = [];
  if (customerToClient.size > 0) {
    const stripe = getStripe();
    try {
      const charges = await stripe.charges.list({ limit: 100 });
      payments = charges.data
        .filter((ch) => typeof ch.customer === "string" && customerToClient.has(ch.customer as string))
        .map((ch) => {
          const client = customerToClient.get(ch.customer as string)!;
          return {
            id: ch.id,
            clientId: client.id,
            clientName: client.name,
            amount: ch.amount / 100,
            currency: ch.currency,
            created: ch.created * 1000,
            paid: ch.paid,
            refunded: ch.refunded,
            amountRefunded: ch.amount_refunded / 100,
            description: ch.description,
          };
        });
    } catch (err: any) {
      console.error("Errore lista pagamenti Stripe (finanza):", err);
    }
  }

  return NextResponse.json({ clients, payments });
}

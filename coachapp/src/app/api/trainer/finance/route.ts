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
// Vista d'insieme "Finanza": clienti con prezzo/stato/totale pagato e tutti i
// pagamenti Stripe dei clienti in un unico posto. Le azioni vere e proprie
// (aggiorna prezzo, rimborso) restano sulle route gia' esistenti
// (/api/trainer/stripe/update-price e /api/trainer/clients/[id]/payments)
// cosi la logica di sicurezza/verifica non e' duplicata.
//
// I pagamenti vengono letti a pagine da Stripe (fino a MAX_CHARGES) cosi il
// "totale pagato" di ogni cliente comprende tutto lo storico, non solo gli
// ultimi 100 addebiti.
const MAX_CHARGES = 1000;
const PLACEHOLDER_DOMAIN = "@invito.hybridmethod.app";

export async function GET() {
  const ctx = await requireTrainerContext();
  if (!ctx) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }
  const { supabase, profile } = ctx;

  const { data: clientsData } = await supabase
    .from("clients")
    .select(
      "id, status, price, stripe_customer_id, stripe_subscription_id, profiles:profile_id(full_name, email)"
    )
    .eq("trainer_id", profile.id)
    .order("created_at", { ascending: false });

  const rows = (clientsData || []) as any[];

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
  let stripeError = false;
  if (customerToClient.size > 0) {
    const stripe = getStripe();
    try {
      let startingAfter: string | undefined = undefined;
      let fetched = 0;
      while (fetched < MAX_CHARGES) {
        const page: any = await stripe.charges.list({ limit: 100, ...(startingAfter ? { starting_after: startingAfter } : {}) });
        for (const ch of page.data) {
          if (typeof ch.customer === "string" && customerToClient.has(ch.customer)) {
            const client = customerToClient.get(ch.customer)!;
            payments.push({
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
            });
          }
        }
        fetched += page.data.length;
        if (!page.has_more || page.data.length === 0) break;
        startingAfter = page.data[page.data.length - 1].id;
      }
    } catch (err: any) {
      stripeError = true;
      console.error("Errore lista pagamenti Stripe (finanza):", err);
    }
  }

  // Totali per cliente: incassato netto (pagato meno rimborsi), numero di
  // pagamenti riusciti, tentativi falliti e date utili.
  const stats = new Map<
    string,
    { totalPaid: number; paidCount: number; failedCount: number; lastPaidAt: number | null; lastFailedAt: number | null }
  >();
  for (const p of payments) {
    const s = stats.get(p.clientId) || {
      totalPaid: 0,
      paidCount: 0,
      failedCount: 0,
      lastPaidAt: null,
      lastFailedAt: null,
    };
    if (p.paid) {
      s.totalPaid += p.amount - (p.amountRefunded || 0);
      s.paidCount += 1;
      if (!s.lastPaidAt || p.created > s.lastPaidAt) s.lastPaidAt = p.created;
    } else {
      s.failedCount += 1;
      if (!s.lastFailedAt || p.created > s.lastFailedAt) s.lastFailedAt = p.created;
    }
    stats.set(p.clientId, s);
  }

  const clients = rows.map((c) => {
    const s = stats.get(c.id);
    const email: string = c.profiles?.email || "";
    return {
      id: c.id,
      name: c.profiles?.full_name || "Cliente",
      status: c.status,
      price: c.price,
      hasStripeCustomer: !!c.stripe_customer_id,
      hasStripeSubscription: !!c.stripe_subscription_id,
      pending: email.endsWith(PLACEHOLDER_DOMAIN),
      totalPaid: s ? Math.round(s.totalPaid * 100) / 100 : 0,
      paidCount: s?.paidCount || 0,
      failedCount: s?.failedCount || 0,
      lastPaidAt: s?.lastPaidAt || null,
      lastFailedAt: s?.lastFailedAt || null,
    };
  });

  payments.sort((a, b) => b.created - a.created);

  return NextResponse.json({ clients, payments, stripeError });
}

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

// GET /api/trainer/clients/[id]/payments
// Elenca gli ultimi pagamenti Stripe del cliente, cosi il trainer puo vederli
// (e rimborsarli) direttamente dall'app senza aprire la dashboard Stripe.
export async function GET(_request: Request, { params }: { params: { id: string } }) {
    const ctx = await requireTrainerContext();
    if (!ctx) {
          return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
    }
    const { supabase, profile } = ctx;

  const { data: client } = await supabase
      .from("clients")
      .select("id, stripe_customer_id")
      .eq("id", params.id)
      .eq("trainer_id", profile.id)
      .maybeSingle();

  if (!client) {
        return NextResponse.json({ error: "Cliente non trovato" }, { status: 404 });
  }

  if (!client.stripe_customer_id) {
        return NextResponse.json({ payments: [] });
  }

  const stripe = getStripe();
    try {
          const charges = await stripe.charges.list({ customer: client.stripe_customer_id, limit: 10 });
          const payments = charges.data.map((c) => ({
                  id: c.id,
                  amount: c.amount / 100,
                  currency: c.currency,
                  created: c.created * 1000,
                  paid: c.paid,
                  refunded: c.refunded,
                  amountRefunded: c.amount_refunded / 100,
                  description: c.description,
          }));
          return NextResponse.json({ payments });
    } catch (err: any) {
          console.error("Errore lista pagamenti Stripe:", err);
          return NextResponse.json({ error: "Errore Stripe: " + (err?.message || "sconosciuto") }, { status: 500 });
    }
}

// POST /api/trainer/clients/[id]/payments
// Body: { chargeId }
// Rimborsa un pagamento specifico. Verifica che l'addebito appartenga davvero
// al cliente indicato, cosi un trainer non puo rimborsare charge di altri
// account passando un id a caso.
export async function POST(request: Request, { params }: { params: { id: string } }) {
    const ctx = await requireTrainerContext();
    if (!ctx) {
          return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
    }
    const { supabase, profile } = ctx;

  const { data: client } = await supabase
      .from("clients")
      .select("id, stripe_customer_id")
      .eq("id", params.id)
      .eq("trainer_id", profile.id)
      .maybeSingle();

  if (!client || !client.stripe_customer_id) {
        return NextResponse.json({ error: "Cliente non trovato" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
    const chargeId = body?.chargeId;
    if (!chargeId) {
          return NextResponse.json({ error: "chargeId mancante" }, { status: 400 });
    }

  const stripe = getStripe();
    try {
          const charge = await stripe.charges.retrieve(chargeId);
          if (charge.customer !== client.stripe_customer_id) {
                  return NextResponse.json({ error: "Questo pagamento non appartiene a questo cliente" }, { status: 403 });
          }
          await stripe.refunds.create({ charge: chargeId });
          return NextResponse.json({ ok: true });
    } catch (err: any) {
          console.error("Errore rimborso Stripe:", err);
          return NextResponse.json({ error: "Errore Stripe: " + (err?.message || "sconosciuto") }, { status: 500 });
    }
}

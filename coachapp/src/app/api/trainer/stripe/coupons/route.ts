import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";

// Coupon Stripe riutilizzabili: il trainer li crea quando vuole (sconto %,
// durata, numero massimo di utilizzi, scadenza opzionale) e poi li applica
// dal form di generazione link di un cliente. Nessuna promozione fissa nel
// codice: tutto è gestito qui, on demand.

async function requireTrainerProfile() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  if (!profile || profile.role !== "trainer") return null;
  return profile;
}

// GET /api/trainer/stripe/coupons — elenca i coupon esistenti sull'account Stripe
export async function GET() {
  const profile = await requireTrainerProfile();
  if (!profile) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const stripe = getStripe();
  try {
    const coupons = await stripe.coupons.list({ limit: 100 });
    const list = coupons.data
      .map((c) => ({
        id: c.id,
        name: c.name || c.id,
        percentOff: c.percent_off,
        duration: c.duration,
        durationInMonths: c.duration_in_months,
        maxRedemptions: c.max_redemptions,
        timesRedeemed: c.times_redeemed,
        redeemBy: c.redeem_by ? c.redeem_by * 1000 : null,
        valid: c.valid,
        created: c.created * 1000,
      }))
      .sort((a, b) => b.created - a.created);
    return NextResponse.json({ coupons: list });
  } catch (err: any) {
    console.error("Errore lista coupon Stripe:", err);
    return NextResponse.json({ error: "Errore Stripe: " + (err?.message || "sconosciuto") }, { status: 500 });
  }
}

// POST /api/trainer/stripe/coupons
// Body: { name, percentOff, duration: "once"|"repeating"|"forever", durationInMonths?, maxRedemptions?, redeemBy? (YYYY-MM-DD) }
export async function POST(request: Request) {
  const profile = await requireTrainerProfile();
  if (!profile) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const name = (body?.name || "").trim();
  const percentOff = Number(body?.percentOff);
  const duration = body?.duration;
  const durationInMonths = body?.durationInMonths ? Number(body.durationInMonths) : undefined;
  const maxRedemptions = body?.maxRedemptions ? Number(body.maxRedemptions) : undefined;
  const redeemBy = body?.redeemBy ? Math.floor(new Date(body.redeemBy).getTime() / 1000) : undefined;

  if (!name) {
    return NextResponse.json({ error: "Dai un nome al coupon" }, { status: 400 });
  }
  if (!percentOff || percentOff <= 0 || percentOff > 100) {
    return NextResponse.json({ error: "Percentuale di sconto non valida" }, { status: 400 });
  }
  if (!["once", "repeating", "forever"].includes(duration)) {
    return NextResponse.json({ error: "Durata dello sconto non valida" }, { status: 400 });
  }
  if (duration === "repeating" && (!durationInMonths || durationInMonths <= 0)) {
    return NextResponse.json({ error: "Indica per quanti mesi vale lo sconto" }, { status: 400 });
  }
  if (redeemBy && redeemBy * 1000 < Date.now()) {
    return NextResponse.json({ error: "La data di scadenza è nel passato" }, { status: 400 });
  }

  const stripe = getStripe();
  try {
    const coupon = await stripe.coupons.create({
      name,
      percent_off: percentOff,
      duration,
      ...(duration === "repeating" ? { duration_in_months: durationInMonths } : {}),
      ...(maxRedemptions ? { max_redemptions: maxRedemptions } : {}),
      ...(redeemBy ? { redeem_by: redeemBy } : {}),
    });
    return NextResponse.json({ coupon });
  } catch (err: any) {
    console.error("Errore creazione coupon Stripe:", err);
    return NextResponse.json({ error: "Errore Stripe: " + (err?.message || "sconosciuto") }, { status: 500 });
  }
}

// DELETE /api/trainer/stripe/coupons?id=xxxx — disattiva un coupon (non
// tocca gli abbonamenti che lo usano già, impedisce solo nuovi utilizzi)
export async function DELETE(request: Request) {
  const profile = await requireTrainerProfile();
  if (!profile) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id mancante" }, { status: 400 });
  }

  const stripe = getStripe();
  try {
    await stripe.coupons.del(id);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("Errore eliminazione coupon Stripe:", err);
    return NextResponse.json({ error: "Errore Stripe: " + (err?.message || "sconosciuto") }, { status: 500 });
  }
}

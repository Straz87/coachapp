import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";

// Coupon Stripe riutilizzabili: il trainer li crea quando vuole (sconto %,
// durata, numero massimo di utilizzi, scadenza opzionale). Ogni coupon ha
// anche un codice promozionale collegato (stesso testo del nome, es.
// PRIMI5): il trainer può applicarlo lui a mano da un link cliente, oppure
// darlo a chi si iscrive da solo dal link pubblico, che lo digita nella
// pagina di pagamento Stripe (allow_promotion_codes nel checkout).

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

// Un codice promozionale Stripe accetta solo lettere, numeri, underscore e
// trattini. Partiamo dal nome che il trainer ha scelto (es. "Primi 5") e lo
// trasformiamo in qualcosa che il cliente può digitare (es. "PRIMI5").
function codeFromName(name: string) {
  const cleaned = name
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, "")
    .slice(0, 40);
  return cleaned || `PROMO${Date.now().toString().slice(-6)}`;
}

// GET /api/trainer/stripe/coupons — elenca i coupon esistenti sull'account
// Stripe, con il relativo codice promozionale da comunicare al cliente.
export async function GET() {
  const profile = await requireTrainerProfile();
  if (!profile) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const stripe = getStripe();
  try {
    const [coupons, promoCodes] = await Promise.all([
      stripe.coupons.list({ limit: 100 }),
      stripe.promotionCodes.list({ limit: 100 }),
    ]);

    const codeByCoupon = new Map<string, string>();
    for (const pc of promoCodes.data) {
      const couponId = typeof pc.coupon === "string" ? pc.coupon : pc.coupon?.id;
      if (couponId && pc.active && !codeByCoupon.has(couponId)) {
        codeByCoupon.set(couponId, pc.code);
      }
    }

    const list = coupons.data
      .map((c) => ({
        id: c.id,
        name: c.name || c.id,
        code: codeByCoupon.get(c.id) || null,
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

    // Crea anche il codice che il cliente digiterà da solo in fase di
    // pagamento. Se il codice è già in uso (nome duplicato) ci riproviamo
    // aggiungendo un suffisso, così il coupon non resta senza codice.
    let code = codeFromName(name);
    let promotionCode;
    try {
      promotionCode = await stripe.promotionCodes.create({
        coupon: coupon.id,
        code,
        ...(maxRedemptions ? { max_redemptions: maxRedemptions } : {}),
        ...(redeemBy ? { expires_at: redeemBy } : {}),
      });
    } catch {
      code = `${code}${coupon.id.slice(-4).toUpperCase()}`;
      promotionCode = await stripe.promotionCodes.create({
        coupon: coupon.id,
        code,
        ...(maxRedemptions ? { max_redemptions: maxRedemptions } : {}),
        ...(redeemBy ? { expires_at: redeemBy } : {}),
      });
    }

    return NextResponse.json({ coupon: { ...coupon, code: promotionCode.code } });
  } catch (err: any) {
    console.error("Errore creazione coupon Stripe:", err);
    return NextResponse.json({ error: "Errore Stripe: " + (err?.message || "sconosciuto") }, { status: 500 });
  }
}

// DELETE /api/trainer/stripe/coupons?id=xxxx — disattiva il codice
// promozionale collegato e cancella il coupon (non tocca gli abbonamenti
// che lo usano già, impedisce solo nuovi utilizzi).
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
    const promoCodes = await stripe.promotionCodes.list({ coupon: id, limit: 100 });
    await Promise.all(
      promoCodes.data
        .filter((pc) => pc.active)
        .map((pc) => stripe.promotionCodes.update(pc.id, { active: false }))
    );
    await stripe.coupons.del(id);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("Errore eliminazione coupon Stripe:", err);
    return NextResponse.json({ error: "Errore Stripe: " + (err?.message || "sconosciuto") }, { status: 500 });
  }
}

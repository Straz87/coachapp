import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Impostazioni del link pubblico fisso di un trainer (prezzo, prova
// gratuita, sconto, attivo/disattivo). Il link stesso vive in
// /iscriviti/[trainerId] e legge questa stessa riga con il client admin.

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

// GET /api/trainer/public-link
export async function GET() {
  const ctx = await requireTrainerContext();
  if (!ctx) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }
  const { supabase, profile } = ctx;

  const { data, error } = await supabase
    .from("public_signup_links")
    .select("*")
    .eq("trainer_id", profile.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ link: data, trainerId: profile.id });
}

// POST /api/trainer/public-link
// Body: { price, trialDays, couponId, active, groupId, title, description, show_in_vetrina }
export async function POST(request: Request) {
  const ctx = await requireTrainerContext();
  if (!ctx) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }
  const { supabase, profile } = ctx;

  const body = await request.json().catch(() => null);
  const price = body?.price ? Number(body.price) : null;
  const trialDays = body?.trialDays ? Number(body.trialDays) : 0;
  const couponId = body?.couponId || null;
  const groupId = body?.groupId || null;
  const active = !!body?.active;
  const title = typeof body?.title === "string" ? body.title.trim() || null : null;
  const description = typeof body?.description === "string" ? body.description.trim() || null : null;
  const showInVetrina = !!body?.show_in_vetrina;

  if (active && (!price || price <= 0)) {
    return NextResponse.json({ error: "Imposta un prezzo prima di attivare il link" }, { status: 400 });
  }

  const { error } = await supabase.from("public_signup_links").upsert({
    trainer_id: profile.id,
    price,
    trial_days: trialDays,
    coupon_id: couponId,
    group_id: groupId,
    active,
    title,
    description,
    show_in_vetrina: showInVetrina,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

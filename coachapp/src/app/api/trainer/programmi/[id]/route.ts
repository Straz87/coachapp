import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Impostazioni pubbliche di un programma: pubblico/privato e prezzo
// mensile (0 o vuoto = gratuito) e giorni di prova, oltre alla durata
// (length_days) del programma stesso.
//
// A differenza della route equivalente dei Gruppi, qui NON sincronizziamo
// automaticamente il prezzo sugli abbonamenti Stripe degli iscritti già
// presenti: è una v1, pensata per programmi nuovi senza ancora iscritti
// paganti. Se in futuro serve, si può aggiungere la stessa logica di
// conferma prezzo usata per i Gruppi.
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

// PATCH /api/trainer/programmi/[id]
// Body: { public, price, trialDays, couponId, lengthDays, description, showInVetrina }
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const ctx = await requireTrainerContext();
  if (!ctx) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }
  const { supabase, profile } = ctx;

  const { data: program } = await supabase
    .from("programs")
    .select("id")
    .eq("id", params.id)
    .eq("trainer_id", profile.id)
    .maybeSingle();

  if (!program) {
    return NextResponse.json({ error: "Programma non trovato" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const price =
    body?.price === "" || body?.price === null || body?.price === undefined ? 0 : Number(body.price);
  const trialDays = body?.trialDays ? Number(body.trialDays) : 0;
  const couponId = body?.couponId || null;
  const isPublic = !!body?.public;

  const update: Record<string, unknown> = {
    public: isPublic,
    show_in_vetrina: !!body?.showInVetrina,
    price,
    trial_days: trialDays,
    coupon_id: couponId,
  };

  // lengthDays è opzionale: viene inviato solo quando l'allenatore modifica
  // la durata del programma dal pannello di gestione.
  if (body?.lengthDays !== undefined && body?.lengthDays !== null && body?.lengthDays !== "") {
    const lengthDays = Math.max(1, Number(body.lengthDays) || 1);
    update.length_days = lengthDays;
  }

  // description e' opzionale: la mini bio mostrata nella pagina
  // vetrina pubblica del trainer.
  if (body?.description !== undefined) {
    const description = typeof body.description === "string" ? body.description.trim() || null : null;
    update.description = description;
  }

  const { error } = await supabase
    .from("programs")
    .update(update)
    .eq("id", params.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

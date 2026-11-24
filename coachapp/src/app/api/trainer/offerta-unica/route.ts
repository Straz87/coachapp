import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// POST /api/trainer/offerta-unica  { kind: "gruppo" | "programma", id, total, months }
// Imposta (o toglie, con total vuoto/0) l'offerta "pagamento unico" di un
// gruppo o di un programma: totale in euro e numero di mesi coperti.
export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("id, role").eq("id", user.id).single();
  if (!profile || profile.role !== "trainer") {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const table = body?.kind === "programma" ? "programs" : body?.kind === "gruppo" ? "workout_groups" : null;
  const id = body?.id;
  if (!table || !id) return NextResponse.json({ error: "Richiesta non valida" }, { status: 400 });

  const total = Number(body?.total) || 0;
  const months = Math.round(Number(body?.months) || 0);
  const on = total > 0 && months > 0;

  const { data: row } = await supabase.from(table).select("id").eq("id", id).eq("trainer_id", profile.id).maybeSingle();
  if (!row) return NextResponse.json({ error: "Non trovato" }, { status: 404 });

  const admin = createAdminClient();
  const { error } = await admin
    .from(table)
    .update({ one_shot_total: on ? total : null, one_shot_months: on ? months : null })
    .eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}

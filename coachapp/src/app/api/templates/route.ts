import { NextResponse } from "next/server";
import { requireTrainer } from "@/lib/auth";

// GET /api/templates
// Elenco dei template di allenamento salvati dal trainer, usato dal
// selettore "Carica da template" nell'editor scheda.
export async function GET() {
  const { supabase, profile } = await requireTrainer();

  const { data, error } = await supabase
    .from("workout_templates")
    .select("id, name, activity_type, blocks, created_at")
    .eq("trainer_id", profile.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ templates: data });
}

// POST /api/templates
// Salva la scheda che si sta modificando come template riutilizzabile.
export async function POST(request: Request) {
  const { supabase, profile } = await requireTrainer();

  const body = await request.json().catch(() => null);
  const name = (body?.name || "").trim();
  const blocks = Array.isArray(body?.blocks) ? body.blocks : [];
  const activityType = body?.activityType || null;

  if (!name) {
    return NextResponse.json({ error: "Dai un nome al template." }, { status: 400 });
  }
  if (blocks.length === 0) {
    return NextResponse.json(
      { error: "La scheda è vuota, non c'è niente da salvare." },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("workout_templates")
    .insert({ trainer_id: profile.id, name, activity_type: activityType, blocks })
    .select("id, name")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ template: data });
}

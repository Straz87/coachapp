import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// POST /api/cliente/programmi/[id]/completa
// Il cliente segna come fatto il giorno corrente del programma a cui è
// iscritto: il programma avanza al giorno successivo SOLO a questo
// punto (non in automatico col calendario), così ognuno va al proprio
// ritmo reale, indipendentemente da quando si è iscritto.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  if (!profile || profile.role !== "client") {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const { data: client } = await supabase.from("clients").select("id").eq("profile_id", user.id).single();

  if (!client) {
    return NextResponse.json({ error: "Cliente non trovato" }, { status: 404 });
  }

  const { data: program } = await supabase
    .from("programs")
    .select("id, length_days")
    .eq("id", params.id)
    .maybeSingle();

  if (!program) {
    return NextResponse.json({ error: "Programma non trovato" }, { status: 404 });
  }

  const { data: membership } = await supabase
    .from("program_members")
    .select("*")
    .eq("program_id", params.id)
    .eq("client_id", client.id)
    .maybeSingle();

  if (!membership) {
    return NextResponse.json({ error: "Non sei iscritto a questo programma" }, { status: 404 });
  }

  if (membership.completed || membership.current_day > program.length_days) {
    return NextResponse.json({ error: "Programma già completato" }, { status: 400 });
  }

  await supabase.from("program_progress").upsert(
    {
      program_member_id: membership.id,
      day_number: membership.current_day,
      completed_at: new Date().toISOString(),
    },
    { onConflict: "program_member_id,day_number" }
  );

  const nextDay = membership.current_day + 1;
  const isDone = nextDay > program.length_days;

  const { error } = await supabase
    .from("program_members")
    .update({ current_day: nextDay, completed: isDone })
    .eq("id", membership.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, currentDay: nextDay, completed: isDone });
}

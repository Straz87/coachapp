import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// POST /api/cliente/induction
// Body: { skip: true } oppure { goal, experience, daysPerWeek, limitations, notes }
//
// Salva le risposte al popup di benvenuto del cliente, o segna solo che
// e' stato visto se il cliente sceglie "Piu tardi". Stesso pattern della
// route massimali/onboarded: identifica il cliente dall'utente
// autenticato e usa il client admin per scrivere sulla tabella clients.
export async function POST(request: Request) {
    const supabase = createClient();
    const {
          data: { user },
    } = await supabase.auth.getUser();

  if (!user) {
        return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (!profile || profile.role !== "client") {
          return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
    }

  const { data: client } = await supabase
      .from("clients")
      .select("id")
      .eq("profile_id", user.id)
      .maybeSingle();

  if (!client) {
        return NextResponse.json({ error: "Cliente non trovato" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
    const admin = createAdminClient();

  if (body?.skip) {
        await admin.from("clients").update({ induction_onboarded: true }).eq("id", client.id);
        return NextResponse.json({ ok: true });
  }

  const update: Record<string, any> = { induction_onboarded: true };
    if (typeof body?.goal === "string" && body.goal) update.induction_goal = body.goal;
    if (typeof body?.experience === "string" && body.experience) update.induction_experience = body.experience;
    if (body?.daysPerWeek) update.induction_days_per_week = Number(body.daysPerWeek);
    if (typeof body?.limitations === "string") update.induction_limitations = body.limitations;
    if (typeof body?.notes === "string") update.induction_notes = body.notes;

  await admin.from("clients").update(update).eq("id", client.id);

  return NextResponse.json({ ok: true });
}

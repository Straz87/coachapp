import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushToProfile } from "@/lib/push";

// POST /api/notifications/workout-completed
// Body: { clientProfileId: string, workoutTitle?: string }
//
// Chiamata da AllenamentoGiorno.tsx quando un cliente segna un
// allenamento (individuale o di gruppo) come completato. Risolve il
// trainer_id a partire dal profile_id del cliente e gli invia una
// notifica push sul telefono, oltre alla notifica "a campanella"
// in-app che parte gia' di suo dal trigger SQL su workout_assignments /
// group_workout_scores.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const clientProfileId = body?.clientProfileId;
  const workoutTitle = typeof body?.workoutTitle === "string" ? body.workoutTitle : undefined;

  if (!clientProfileId) {
    return NextResponse.json({ error: "clientProfileId mancante" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: client } = await admin
    .from("clients")
    .select("id, trainer_id")
    .eq("profile_id", clientProfileId)
    .maybeSingle();

  if (!client?.trainer_id) {
    return NextResponse.json({ ok: false });
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("full_name")
    .eq("id", clientProfileId)
    .maybeSingle();

  const clientName = profile?.full_name || "Un cliente";

  await sendPushToProfile(client.trainer_id, {
    title: "Allenamento completato",
    body: workoutTitle
      ? `${clientName} ha completato: ${workoutTitle}`
      : `${clientName} ha completato l'allenamento di oggi`,
    url: `/trainer/clienti/${client.id}`,
  });

  return NextResponse.json({ ok: true });
}

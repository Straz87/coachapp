import Link from "next/link";
import { requireClientRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { Block, ClientScores } from "@/lib/workoutTypes";
import { buildLeaderboard, Leaderboard, ProfilesRef } from "@/components/Leaderboard";

type Row = {
  id: string;
  client_id: string;
  blocks: Block[];
  client_scores: ClientScores;
  clients: {
    profile_id: string;
    profiles: ProfilesRef;
  } | null;
};

type GroupRow = {
  client_id: string;
  client_scores: ClientScores;
  clients: {
    profile_id: string;
    profiles: ProfilesRef;
  } | null;
};

export default async function TabellonePage({
  params,
  searchParams,
}: {
  params: { date: string };
  searchParams: { g?: string };
}) {
  const { supabase, profile } = await requireClientRole();

  const { data: client } = await supabase
    .from("clients")
    .select("id, trainer_id")
    .eq("profile_id", profile.id)
    .single();

  if (!client) {
    return <p className="text-gray-400">Il tuo trainer non ti ha ancora collegato ad un profilo.</p>;
  }

  // Tabellone di un allenamento di GRUPPO: la classifica include solo chi
  // ha effettivamente registrato un punteggio per quel group_workout, il
  // che equivale ai membri del gruppo grazie alle policy RLS.
  if (searchParams.g) {
    const { data: groupWorkout } = await supabase
      .from("group_workouts")
      .select("title, blocks")
      .eq("id", searchParams.g)
      .maybeSingle();

    if (!groupWorkout) {
      return (
        <div className="-m-4 md:-m-8 min-h-screen bg-gray-50 text-gray-900 p-4">
          <Link href={`/cliente/allenamento/${params.date}`} className="text-gray-500 text-sm">
            ← Torna alla scheda
          </Link>
          <p className="text-gray-500 mt-4">Allenamento non trovato.</p>
        </div>
      );
    }

    const { data: scoreRows } = await supabase
      .from("group_workout_scores")
      .select("client_id, client_scores, clients(profile_id, profiles(full_name))")
      .eq("group_workout_id", searchParams.g);

    const groups = buildLeaderboard(
      ((scoreRows as unknown as GroupRow[]) || []).map((r) => ({
        blocks: (groupWorkout.blocks as Block[]) || [],
        clients: r.clients,
        client_scores: r.client_scores,
      })),
      profile.id
    );

    return (
      <Leaderboard
        title="Tabellone"
        subtitle={groupWorkout.title}
        backHref={`/cliente/allenamento/${params.date}`}
        groups={groups}
      />
    );
  }

  // Tabellone di un allenamento INDIVIDUALE: confronta i clienti dello
  // stesso trainer che hanno, nello STESSO giorno, una scheda con lo
  // stesso titolo (prima non filtravamo per data: un titolo ricorrente
  // come "WOD" mischiava punteggi di giorni diversi in un'unica classifica).
  const { data: myAssignment } = await supabase
    .from("workout_assignments")
    .select("title")
    .eq("client_id", client.id)
    .eq("date", params.date)
    .maybeSingle();

  if (!myAssignment) {
    return (
      <div className="-m-4 md:-m-8 min-h-screen bg-gray-50 text-gray-900 p-4">
        <Link href={`/cliente/allenamento/${params.date}`} className="text-gray-500 text-sm">
          ← Torna alla scheda
        </Link>
        <p className="text-gray-500 mt-4">Nessuna scheda trovata per questo giorno.</p>
      </div>
    );
  }

  const admin = createAdminClient();
  const { data: rows } = await admin
    .from("workout_assignments")
    .select("id, client_id, blocks, client_scores, clients(profile_id, profiles(full_name))")
    .eq("trainer_id", client.trainer_id)
    .eq("date", params.date)
    .ilike("title", myAssignment.title.trim());

  const groups = buildLeaderboard(
    ((rows as unknown as Row[]) || []).map((r) => ({
      blocks: r.blocks || [],
      clients: r.clients,
      client_scores: r.client_scores,
    })),
    profile.id
  );

  return (
    <Leaderboard
      title="Tabellone"
      subtitle={myAssignment.title}
      backHref={`/cliente/allenamento/${params.date}`}
      groups={groups}
    />
  );
}

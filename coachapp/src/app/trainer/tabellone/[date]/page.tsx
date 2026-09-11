import Link from "next/link";
import { requireTrainer } from "@/lib/auth";
import { Block, ClientScores } from "@/lib/workoutTypes";
import { buildLeaderboard, Leaderboard, ProfilesRef } from "@/components/Leaderboard";

// Versione lato TRAINER dello stesso tabellone visto dal cliente
// (/cliente/tabellone/[date]): permette al trainer di controllare la
// classifica di una sessione senza dover accedere impersonando un cliente.
// - allenamento di GRUPPO: passare ?g=<group_workout_id>
// - allenamento INDIVIDUALE: passare ?cliente=<client_id>

type Row = {
  blocks: Block[];
  client_scores: ClientScores;
  clients: {
    profile_id: string;
    profiles: ProfilesRef;
  } | null;
};

export default async function TrainerTabellonePage({
  params,
  searchParams,
}: {
  params: { date: string };
  searchParams: { cliente?: string; g?: string };
}) {
  const { supabase, profile } = await requireTrainer();

  // Allenamento di GRUPPO.
  if (searchParams.g) {
    const { data: groupWorkout } = await supabase
      .from("group_workouts")
      .select("title, blocks")
      .eq("id", searchParams.g)
      .eq("trainer_id", profile.id)
      .maybeSingle();

    if (!groupWorkout) {
      return (
        <div className="max-w-xl mx-auto p-4 space-y-2">
          <Link href="/trainer/calendario" className="text-gray-500 text-sm">
            ← Torna al calendario
          </Link>
          <p className="text-gray-500">Allenamento non trovato.</p>
        </div>
      );
    }

    const { data: scoreRows } = await supabase
      .from("group_workout_scores")
      .select("client_id, client_scores, clients(profile_id, profiles(full_name))")
      .eq("group_workout_id", searchParams.g);

    const groups = buildLeaderboard(
      ((scoreRows as unknown as Row[]) || []).map((r) => ({
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
        backHref="/trainer/calendario"
        backLabel="Torna al calendario"
        groups={groups}
      />
    );
  }

  // Allenamento INDIVIDUALE: confronta, nello stesso giorno, i clienti del
  // trainer che hanno una scheda con lo stesso titolo di quella del cliente
  // indicato. Nessun bisogno di createAdminClient qui: il trainer legge
  // solo righe di workout_assignments di cui e' gia' proprietario (RLS
  // trainer_id = auth.uid()).
  if (!searchParams.cliente) {
    return (
      <div className="max-w-xl mx-auto p-4">
        <p className="text-gray-500">Seleziona un cliente dal calendario per vedere il tabellone.</p>
      </div>
    );
  }

  const { data: myAssignment } = await supabase
    .from("workout_assignments")
    .select("title")
    .eq("client_id", searchParams.cliente)
    .eq("trainer_id", profile.id)
    .eq("date", params.date)
    .maybeSingle();

  if (!myAssignment) {
    return (
      <div className="max-w-xl mx-auto p-4 space-y-2">
        <Link href={`/trainer/calendario?cliente=${searchParams.cliente}`} className="text-gray-500 text-sm">
          ← Torna al calendario
        </Link>
        <p className="text-gray-500">Nessuna scheda trovata per questo giorno.</p>
      </div>
    );
  }

  const { data: rows } = await supabase
    .from("workout_assignments")
    .select("blocks, client_scores, clients(profile_id, profiles(full_name))")
    .eq("trainer_id", profile.id)
    .eq("date", params.date)
    .ilike("title", myAssignment.title.trim());

  const groups = buildLeaderboard(((rows as unknown as Row[]) || []), profile.id);

  return (
    <Leaderboard
      title="Tabellone"
      subtitle={myAssignment.title}
      backHref={`/trainer/calendario?cliente=${searchParams.cliente}`}
      backLabel="Torna al calendario"
      groups={groups}
    />
  );
}

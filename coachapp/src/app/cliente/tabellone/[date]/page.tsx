import Link from "next/link";
import { requireClientRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { Block, ClientScores, scoreLabel } from "@/lib/workoutTypes";

type ProfilesRef = { full_name: string } | { full_name: string }[] | null;

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

type Entry = { name: string; value: string; rx: boolean; isSelf: boolean; sortKey: number | null };

function parseValue(raw: string): number | null {
  const match = raw.match(/(\d+)[:.](\d+)|(\d+(\.\d+)?)/);
  if (!match) return null;
  if (match[1] !== undefined && match[2] !== undefined) {
    // formato mm:ss -> secondi totali (per For Time, tempo più basso = meglio)
    return Number(match[1]) * 60 + Number(match[2]);
  }
  return match[3] !== undefined ? Number(match[3]) : null;
}

function firstName(clients: { profile_id: string; profiles: ProfilesRef } | null) {
  if (!clients) return "Atleta";
  const p = Array.isArray(clients.profiles) ? clients.profiles[0] : clients.profiles;
  return p?.full_name || "Atleta";
}

function buildLeaderboard(
  rows: {
    blocks: Block[];
    clients: { profile_id: string; profiles: ProfilesRef } | null;
    client_scores: ClientScores;
  }[],
  selfProfileId: string
) {
  const groups: Record<string, Entry[]> = {};

  rows.forEach((row) => {
    const name = firstName(row.clients);
    const isSelf = row.clients?.profile_id === selfProfileId;
    row.blocks.forEach((b, i) => {
      if (!b.score) return;
      const entry = row.client_scores?.[String(i)];
      if (!entry) return;
      const key = `${b.type} · ${scoreLabel(b.score.type)}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push({
        name,
        value: entry.value,
        rx: entry.rx,
        isSelf,
        sortKey: parseValue(entry.value),
      });
      (groups[key] as (Entry & { _scoreType?: string })[])[groups[key].length - 1]._scoreType =
        b.score.type;
    });
  });

  Object.values(groups).forEach((entries) => {
    const scoreType = (entries[0] as Entry & { _scoreType?: string })._scoreType;
    entries.sort((a, b) => {
      if (a.sortKey === null) return 1;
      if (b.sortKey === null) return -1;
      return scoreType === "for_time" ? a.sortKey - b.sortKey : b.sortKey - a.sortKey;
    });
  });

  return groups;
}

function Leaderboard({ title, subtitle, backHref, groups }: { title: string; subtitle: string; backHref: string; groups: Record<string, Entry[]> }) {
  const groupKeys = Object.keys(groups);

  return (
    <div className="-m-4 md:-m-8 min-h-screen bg-gray-50 text-gray-900 pb-16">
      <div className="p-4 space-y-5 max-w-xl mx-auto">
        <Link href={backHref} className="text-gray-500 text-sm inline-block">
          ← Torna alla scheda
        </Link>

        <div>
          <h1 className="text-2xl font-bold">{title}</h1>
          <p className="text-gray-500 text-sm">{subtitle}</p>
        </div>

        {groupKeys.length === 0 ? (
          <p className="text-gray-500">
            Nessun punteggio inserito ancora per questo allenamento. Sii il primo!
          </p>
        ) : (
          groupKeys.map((key) => (
            <div key={key} className="card">
              <p className="text-xs uppercase tracking-wide text-gray-400 mb-3">{key}</p>
              <div className="space-y-2">
                {groups[key].map((e, idx) => (
                  <div
                    key={idx}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2 ${
                      e.isSelf ? "bg-brand/20" : "bg-gray-50"
                    }`}
                  >
                    <span className="w-6 text-center text-gray-400 font-semibold">{idx + 1}</span>
                    <span className="flex-1 font-medium">{e.name}</span>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                      {e.rx ? "RX" : "SC"}
                    </span>
                    <span className="font-semibold">{e.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

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
  // stesso trainer che hanno una scheda con lo stesso titolo.
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

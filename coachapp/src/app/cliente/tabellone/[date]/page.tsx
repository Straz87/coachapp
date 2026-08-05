import Link from "next/link";
import { requireClientRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { Block, ClientScores, scoreLabel } from "@/lib/workoutTypes";

type Row = {
  id: string;
  client_id: string;
  blocks: Block[];
  client_scores: ClientScores;
  clients: {
    profile_id: string;
    profiles: { full_name: string } | { full_name: string }[] | null;
  } | null;
};

function parseValue(raw: string): number | null {
  const match = raw.match(/(\d+)[:.](\d+)|(\d+(\.\d+)?)/);
  if (!match) return null;
  if (match[1] !== undefined && match[2] !== undefined) {
    // formato mm:ss -> secondi totali (per For Time, tempo più basso = meglio)
    return Number(match[1]) * 60 + Number(match[2]);
  }
  return match[3] !== undefined ? Number(match[3]) : null;
}

function firstName(clients: Row["clients"]) {
  if (!clients) return "Atleta";
  const p = Array.isArray(clients.profiles) ? clients.profiles[0] : clients.profiles;
  return p?.full_name || "Atleta";
}

export default async function TabellonePage({
  params,
}: {
  params: { date: string };
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

  const { data: myAssignment } = await supabase
    .from("workout_assignments")
    .select("title")
    .eq("client_id", client.id)
    .eq("date", params.date)
    .maybeSingle();

  if (!myAssignment) {
    return (
      <div className="-m-8 min-h-screen bg-[#0c1210] text-white p-4">
        <Link href={`/cliente/allenamento/${params.date}`} className="text-gray-400 text-sm">
          ← Torna alla scheda
        </Link>
        <p className="text-gray-400 mt-4">Nessuna scheda trovata per questo giorno.</p>
      </div>
    );
  }

  const admin = createAdminClient();
  const { data: rows } = await admin
    .from("workout_assignments")
    .select("id, client_id, blocks, client_scores, clients(profile_id, profiles(full_name))")
    .eq("trainer_id", client.trainer_id)
    .ilike("title", myAssignment.title.trim());

  type Entry = { name: string; value: string; rx: boolean; isSelf: boolean; sortKey: number | null };
  const groups: Record<string, Entry[]> = {};

  ((rows as unknown as Row[]) || []).forEach((row) => {
    const name = firstName(row.clients);
    const isSelf = row.clients?.profile_id === profile.id;
    (row.blocks || []).forEach((b, i) => {
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
        // per_time gestito nell'ordinamento sotto tramite b.score.type
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

  const groupKeys = Object.keys(groups);

  return (
    <div className="-m-8 min-h-screen bg-[#0c1210] text-white pb-16">
      <div className="p-4 space-y-5 max-w-xl mx-auto">
        <Link href={`/cliente/allenamento/${params.date}`} className="text-gray-400 text-sm inline-block">
          ← Torna alla scheda
        </Link>

        <div>
          <h1 className="text-2xl font-bold">Tabellone</h1>
          <p className="text-gray-400 text-sm">{myAssignment.title}</p>
        </div>

        {groupKeys.length === 0 ? (
          <p className="text-gray-400">
            Nessun punteggio inserito ancora per questo allenamento. Sii il primo!
          </p>
        ) : (
          groupKeys.map((key) => (
            <div key={key} className="bg-white/5 rounded-2xl p-4">
              <p className="text-xs uppercase tracking-wide text-gray-500 mb-3">{key}</p>
              <div className="space-y-2">
                {groups[key].map((e, idx) => (
                  <div
                    key={idx}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2 ${
                      e.isSelf ? "bg-lime-400/20" : "bg-white/5"
                    }`}
                  >
                    <span className="w-6 text-center text-gray-400 font-semibold">{idx + 1}</span>
                    <span className="flex-1 font-medium">{e.name}</span>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-white/10">
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

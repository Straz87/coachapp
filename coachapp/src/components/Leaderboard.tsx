import Link from "next/link";
import { Block, ClientScores, scoreLabel, normalizeEntry, parseAmrapValue } from "@/lib/workoutTypes";

// Tabellone/scoreboard condiviso tra la vista cliente
// (/cliente/tabellone/[date]) e quella trainer (/trainer/tabellone/[date]):
// stessa logica di calcolo/ordinamento, la pagina che lo usa decide solo
// da dove recuperare le righe e chi e' il "self" da evidenziare.

export type ProfilesRef = { full_name: string } | { full_name: string }[] | null;

export type LeaderboardRow = {
  blocks: Block[];
  clients: { profile_id: string; profiles: ProfilesRef } | null;
  client_scores: ClientScores;
};

export type Entry = { name: string; value: string; rx: boolean; isSelf: boolean; sortKey: number | null };

function parseValue(raw: string): number | null {
  const match = raw.match(/(\d+)[:.](\d+)|(\d+(\.\d+)?)/);
  if (!match) return null;
  if (match[1] !== undefined && match[2] !== undefined) {
    // formato mm:ss -> secondi totali (per For Time, tempo piu' basso = meglio)
    return Number(match[1]) * 60 + Number(match[2]);
  }
  return match[3] !== undefined ? Number(match[3]) : null;
}

export function firstName(clients: { profile_id: string; profiles: ProfilesRef } | null) {
  if (!clients) return "Atleta";
  const p = Array.isArray(clients.profiles) ? clients.profiles[0] : clients.profiles;
  return p?.full_name || "Atleta";
}

// Per l'AMRAP il punteggio giusto da ordinare non e' il primo numero della
// stringa ma "giri" come criterio principale e "reps supplementari" come
// spareggio (es. "10 giri & 35 reps" batte "10 giri & 20 reps").
function parseValueForType(raw: string, scoreType: string): number | null {
  if (scoreType === "amrap") {
    const { giri, reps } = parseAmrapValue(raw);
    return giri * 100000 + reps;
  }
  return parseValue(raw);
}

// Combina le eventuali serie multiple di un punteggio in un unico valore da
// mostrare/ordinare nel tabellone, secondo l'aggregazione scelta dal trainer.
function aggregateForBoard(
  raw: unknown,
  aggregation: string | undefined,
  scoreType: string
): { display: string; rx: boolean; sortKey: number | null } | null {
  const entry = normalizeEntry(raw);
  if (!entry) return null;
  const values = entry.values.filter((v) => v.trim() !== "");
  if (values.length === 0) return null;

  if (values.length === 1) {
    return { display: values[0], rx: entry.rx, sortKey: parseValueForType(values[0], scoreType) };
  }

  const nums = values.map((v) => parseValueForType(v, scoreType));
  const validNums = nums.filter((n): n is number => n !== null);
  if ((aggregation === "totale" || aggregation === "media") && validNums.length === values.length) {
    const sum = validNums.reduce((a, b) => a + b, 0);
    const result = aggregation === "totale" ? sum : sum / validNums.length;
    const rounded = Math.round(result * 100) / 100;
    return {
      display: aggregation === "totale" ? `${rounded} (tot.)` : `${rounded} (media)`,
      rx: entry.rx,
      sortKey: result,
    };
  }
  return { display: values.join(" · "), rx: entry.rx, sortKey: validNums[0] ?? null };
}

export function buildLeaderboard(rows: LeaderboardRow[], selfProfileId: string) {
  const groups: Record<string, Entry[]> = {};

  rows.forEach((row) => {
    const name = firstName(row.clients);
    const isSelf = row.clients?.profile_id === selfProfileId;
    row.blocks.forEach((b, i) => {
      if (!b.score) return;
      const raw = row.client_scores?.[String(i)];
      if (!raw) return;
      const agg = aggregateForBoard(raw, b.score.aggregation, b.score.type);
      if (!agg) return;
      const key = `${b.type} · ${scoreLabel(b.score.type)}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push({
        name,
        value: agg.display,
        rx: agg.rx,
        isSelf,
        sortKey: agg.sortKey,
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

export function Leaderboard({
  title,
  subtitle,
  backHref,
  backLabel,
  groups,
}: {
  title: string;
  subtitle: string;
  backHref: string;
  backLabel?: string;
  groups: Record<string, Entry[]>;
}) {
  const groupKeys = Object.keys(groups);

  return (
    <div className="-m-4 md:-m-8 min-h-screen bg-gray-50 text-gray-900 pb-16">
      <div className="p-4 space-y-5 max-w-xl mx-auto">
        <Link href={backHref} className="text-gray-500 text-sm inline-block">
          ← {backLabel || "Torna alla scheda"}
        </Link>

        <div>
          <h1 className="text-2xl font-bold">{title}</h1>
          <p className="text-gray-500 text-sm">{subtitle}</p>
        </div>

        {groupKeys.length === 0 ? (
          <p className="text-gray-500">
            Nessun punteggio inserito ancora per questo allenamento.
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

"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Block,
  ClientScores,
  getBlockScores,
  htmlToLines,
  readClientScoreEntry,
} from "@/lib/workoutTypes";

type Row = {
  date: string;
  completed: boolean | null;
  blocks: Block[];
  client_scores: ClientScores | null;
  fatigue?: number | null;
};

type Session = { date: string; kg: number; volume: number };

// Nome dell'esercizio: quello indicato nel blocco, altrimenti la prima riga
// della descrizione ("Back Squat", "Panca piana (bilanciere)"...).
function exerciseNameOf(b: Block): string | null {
  const explicit = b.exerciseName?.trim();
  if (explicit) return explicit;
  const first = htmlToLines(b.description)[0]?.trim();
  if (!first || first.length > 40) return null;
  return first;
}

// Ripetizioni per serie lette dalla descrizione ("4x10" -> 10).
function repsPerSet(b: Block): number {
  const text = htmlToLines(b.description).join(" ");
  const m = text.match(/(\d+)\s*[x×]\s*(\d+)/i);
  return m ? parseInt(m[2], 10) : 1;
}

function mondayOf(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  return d.toISOString().slice(0, 10);
}

function shortDate(dateStr: string): string {
  const [, m, d] = dateStr.split("-");
  return `${parseInt(d, 10)}/${parseInt(m, 10)}`;
}

function LineChart({ points }: { points: { label: string; value: number }[] }) {
  const w = 280;
  const h = 120;
  if (points.length === 0) return null;
  const vals = points.map((p) => p.value);
  const mn = Math.min(...vals) - 3;
  const mx = Math.max(...vals) + 3;
  const xy = points.map((p, i) => [
    points.length === 1 ? w / 2 : 16 + (i * (w - 32)) / (points.length - 1),
    h - 24 - ((p.value - mn) / (mx - mn || 1)) * (h - 44),
  ]);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" role="img" aria-label="Carico nel tempo">
      <polyline points={xy.map((p) => p.join(",")).join(" ")} fill="none" stroke="#8fb512" strokeWidth="2.5" />
      {xy.map((p, i) => (
        <g key={i}>
          <circle cx={p[0]} cy={p[1]} r="4" fill="#8fb512" />
          <text x={p[0]} y={p[1] - 9} textAnchor="middle" fontSize="10" fill="#14161c">
            {points[i].value}
          </text>
          <text x={p[0]} y={h - 6} textAnchor="middle" fontSize="9" fill="#7a7d75">
            {points[i].label}
          </text>
        </g>
      ))}
    </svg>
  );
}

function Bars({ items }: { items: { label: string; value: number; display: string }[] }) {
  const mx = Math.max(...items.map((i) => i.value), 1);
  return (
    <div className="flex items-end gap-1.5 h-32">
      {items.map((it, i) => (
        <div key={i} className="flex-1 text-center">
          <div className="text-[9px] text-gray-600">{it.display}</div>
          <div
            className={`rounded-t-md ${i === items.length - 1 ? "bg-brand" : "bg-brand/50"}`}
            style={{ height: `${Math.max(4, (it.value / mx) * 88)}px` }}
          />
          <div className="text-[9px] text-gray-400 mt-1">{it.label}</div>
        </div>
      ))}
    </div>
  );
}

export default function ProgressTracking({ clientId, coach }: { clientId: string; coach?: boolean }) {
  const supabase = createClient();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [tab, setTab] = useState<"carico" | "volume" | "costanza">("carico");
  const [exercise, setExercise] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("workout_assignments")
        .select("date, completed, blocks, client_scores, fatigue")
        .eq("client_id", clientId)
        .order("date", { ascending: true });
      setRows((data as Row[]) || []);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  const { byExercise, weekly, adherence } = useMemo(() => {
    const byEx: Record<string, Session[]> = {};
    const vol: Record<string, number> = {};
    const adh: Record<string, { done: number; total: number }> = {};
    const today = new Date().toISOString().slice(0, 10);
    (rows || []).forEach((r) => {
      const wk = mondayOf(r.date);
      if (r.date <= today) {
        adh[wk] = adh[wk] || { done: 0, total: 0 };
        adh[wk].total += 1;
        if (r.completed) adh[wk].done += 1;
      }
      (r.blocks || []).forEach((b, bi) => {
        const scores = getBlockScores(b);
        scores.forEach((s, si) => {
          if (s.type !== "peso") return;
          const entry = readClientScoreEntry(r.client_scores || {}, bi, si);
          const nums = (entry?.values || [])
            .map((v) => parseFloat(String(v).replace(",", ".")))
            .filter((n) => !isNaN(n) && n > 0);
          if (nums.length === 0) return;
          const reps = repsPerSet(b);
          const volume = nums.reduce((sum, n) => sum + n * reps, 0);
          vol[wk] = (vol[wk] || 0) + volume;
          const name = exerciseNameOf(b);
          if (!name) return;
          byEx[name] = byEx[name] || [];
          byEx[name].push({ date: r.date, kg: Math.max(...nums), volume });
        });
      });
    });
    const weekKeys = Object.keys(vol).sort().slice(-8);
    const adhKeys = Object.keys(adh).sort().slice(-8);
    return {
      byExercise: byEx,
      weekly: weekKeys.map((k) => ({ week: k, volume: vol[k] })),
      adherence: adhKeys.map((k) => ({ week: k, ...adh[k] })),
    };
  }, [rows]);

  if (rows === null) return <p className="text-gray-400 text-sm">Caricamento…</p>;

  const fatigues = (rows || [])
    .filter((r) => r.fatigue != null)
    .slice(-8)
    .map((r) => ({ date: r.date, value: r.fatigue as number }));
  const fatigueAvg = fatigues.length ? fatigues.reduce((s, f) => s + f.value, 0) / fatigues.length : 0;

  const names = Object.keys(byExercise).sort((a, b) => byExercise[b].length - byExercise[a].length);
  const current = exercise && byExercise[exercise] ? exercise : names[0] || null;
  const sessions = current ? byExercise[current].slice(-8) : [];
  const first = sessions[0]?.kg;
  const last = sessions[sessions.length - 1]?.kg;
  const record = sessions.length ? Math.max(...sessions.map((s) => s.kg)) : 0;

  const tabs: { id: "carico" | "volume" | "costanza"; label: string }[] = [
    { id: "carico", label: "Carico" },
    { id: "volume", label: "Volume" },
    { id: "costanza", label: "Costanza" },
  ];

  return (
    <div className="space-y-3">
      <div className="flex gap-1 bg-gray-100 rounded-full p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`flex-1 py-1.5 rounded-full text-sm ${
              tab === t.id ? "bg-white font-semibold shadow-sm" : "text-gray-500"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "carico" && (
        <>
          {names.length === 0 ? (
            <div className="card text-sm text-gray-500">
              {coach
                ? "Il cliente non ha ancora segnato pesi: i grafici compaiono appena li inserisce nelle schede."
                : "Qui vedrai l'andamento dei tuoi carichi. Segna il peso nelle tue schede e i grafici compaiono da soli."}
            </div>
          ) : (
            <>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {names.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setExercise(n)}
                    className={`shrink-0 px-3 py-1.5 rounded-full text-xs border ${
                      n === current ? "bg-brand border-brand font-semibold" : "bg-white border-gray-200 text-gray-600"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <div className="card">
                <div className="flex justify-between items-baseline mb-1">
                  <span className="text-xs text-gray-500">Carico di lavoro (kg)</span>
                  {first && last && sessions.length > 1 && (
                    <span className="text-xs font-semibold text-green-700">
                      {last >= first ? "+" : ""}
                      {Math.round((last / first - 1) * 100)}% da inizio
                    </span>
                  )}
                </div>
                <LineChart points={sessions.map((s) => ({ label: shortDate(s.date), value: s.kg }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="card">
                  <p className="text-xs text-gray-500">Record</p>
                  <p className="text-xl font-semibold mt-1">{record} kg</p>
                </div>
                <div className="card">
                  <p className="text-xs text-gray-500">Ultima volta</p>
                  <p className="text-xl font-semibold mt-1">{last} kg</p>
                  <p className="text-[11px] text-gray-400">{sessions.length ? shortDate(sessions[sessions.length - 1].date) : ""}</p>
                </div>
              </div>
              <div className="card">
                <p className="text-xs text-gray-500 mb-1">Storico sedute</p>
                {sessions
                  .slice()
                  .reverse()
                  .map((s, i) => (
                    <div key={i} className="flex justify-between py-1.5 border-t border-gray-100 text-sm">
                      <span>{shortDate(s.date)}</span>
                      <span className="font-semibold">{s.kg} kg</span>
                    </div>
                  ))}
              </div>
            </>
          )}
        </>
      )}

      {tab === "volume" && (
        <>
          {weekly.length === 0 ? (
            <div className="card text-sm text-gray-500">Nessun carico segnato ancora.</div>
          ) : (
            <div className="card">
              <p className="text-xs text-gray-500 mb-2">Volume per settimana (tonnellate)</p>
              <Bars
                items={weekly.map((w) => ({
                  label: shortDate(w.week),
                  value: w.volume,
                  display: (w.volume / 1000).toFixed(1),
                }))}
              />
              {weekly.length > 1 && (
                <p className="text-xs mt-3">
                  Ultima settimana{" "}
                  <span className="font-semibold">{(weekly[weekly.length - 1].volume / 1000).toFixed(1)} t</span>
                  {weekly[weekly.length - 2].volume > 0 && (
                    <>
                      , {weekly[weekly.length - 1].volume >= weekly[weekly.length - 2].volume ? "+" : ""}
                      {Math.round((weekly[weekly.length - 1].volume / weekly[weekly.length - 2].volume - 1) * 100)}%
                      sulla precedente
                    </>
                  )}
                </p>
              )}
            </div>
          )}
          <div className="card text-xs text-gray-500 leading-relaxed">
            Il volume è serie × ripetizioni × kg degli esercizi con il peso segnato. Le ripetizioni sono
            quelle scritte dal coach nella scheda.
          </div>
        </>
      )}

      {tab === "costanza" && (
        <div className="card">
          <p className="text-xs text-gray-500 mb-2">Sedute completate, ultime settimane</p>
          {adherence.length === 0 ? (
            <p className="text-sm text-gray-500">Ancora nessuna seduta.</p>
          ) : (
            <div className="flex gap-1.5">
              {adherence.map((a) => (
                <div key={a.week} className="flex-1 text-center">
                  <div
                    className={`h-12 rounded-lg flex items-end justify-center pb-1 text-[11px] ${
                      a.done >= a.total ? "bg-brand" : "bg-brand/40"
                    }`}
                  >
                    {a.done}/{a.total}
                  </div>
                  <div className="text-[9px] text-gray-400 mt-1">{shortDate(a.week)}</div>
                </div>
              ))}
            </div>
          )}
          {fatigues.length > 0 && (
            <div className="mt-4 pt-3 border-t border-gray-100">
              <p className="text-xs text-gray-500 mb-2">
                Fatica percepita (1-10) · media {fatigueAvg.toFixed(1)}
              </p>
              <div className="flex gap-1.5">
                {fatigues.map((f) => (
                  <div key={f.date} className="flex-1 text-center">
                    <div
                      className={`h-9 rounded-lg flex items-center justify-center text-sm font-semibold ${
                        f.value >= 8 ? "bg-red-100 text-red-700" : f.value >= 5 ? "bg-amber-100 text-amber-800" : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {f.value}
                    </div>
                    <div className="text-[9px] text-gray-400 mt-1">{shortDate(f.date)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

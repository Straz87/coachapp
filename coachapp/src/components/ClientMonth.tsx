"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { addDays, startOfWeek, toISODate } from "@/lib/dates";
import {
  Block,
  ClientScores,
  displayScoreValue,
  getBlockScores,
  htmlToLines,
  readClientScoreEntry,
} from "@/lib/workoutTypes";

type Row = {
  date: string;
  title: string;
  completed: boolean | null;
  fatigue: number | null;
  blocks: Block[];
  client_scores: ClientScores | null;
};

const MONTHS = [
  "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
  "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre",
];
const WEEKDAYS = ["L", "M", "M", "G", "V", "S", "D"];

// Calendario del mese di un cliente: a colpo d'occhio chi si e' allenato
// (verde, col voto di fatica), cosa e' previsto e cosa e' stato saltato. Un
// tocco su un giorno mostra il riepilogo; l'editor si apre solo da li'.
export default function ClientMonth({ clientId }: { clientId: string }) {
  const supabase = createClient();
  const todayIso = toISODate(new Date());
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [rows, setRows] = useState<Record<string, Row>>({});
  const [selected, setSelected] = useState<string>(todayIso);

  const cells = useMemo(() => {
    const start = startOfWeek(month);
    const out: { iso: string; day: number; inMonth: boolean }[] = [];
    for (let i = 0; i < 42; i++) {
      const d = addDays(start, i);
      const inMonth = d.getMonth() === month.getMonth();
      if (i >= 35 && !inMonth) break;
      out.push({ iso: toISODate(d), day: d.getDate(), inMonth });
    }
    return out;
  }, [month]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("workout_assignments")
        .select("date, title, completed, fatigue, blocks, client_scores")
        .eq("client_id", clientId)
        .gte("date", cells[0].iso)
        .lte("date", cells[cells.length - 1].iso);
      const map: Record<string, Row> = {};
      ((data as Row[]) || []).forEach((r) => (map[r.date] = r));
      setRows(map);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, month]);

  const monthRows = cells.filter((c) => c.inMonth).map((c) => rows[c.iso]).filter(Boolean);
  const pastRows = monthRows.filter((r) => r.date <= todayIso);
  const done = pastRows.filter((r) => r.completed).length;
  const pct = pastRows.length ? Math.round((done / pastRows.length) * 100) : 0;
  const fats = monthRows.filter((r) => r.fatigue).map((r) => r.fatigue as number);
  const fatAvg = fats.length ? (fats.reduce((a, b) => a + b, 0) / fats.length).toFixed(1) : "–";

  const sel = rows[selected];
  const selDate = new Date(`${selected}T00:00:00`);
  const selLabel = selDate.toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="space-y-3">
      <div className="card grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-xl font-bold">
            {done}/{pastRows.length}
          </p>
          <p className="text-[11px] text-gray-500">fatti nel mese</p>
        </div>
        <div>
          <p className="text-xl font-bold">{pct}%</p>
          <p className="text-[11px] text-gray-500">costanza</p>
        </div>
        <div>
          <p className="text-xl font-bold">{fatAvg}</p>
          <p className="text-[11px] text-gray-500">fatica media</p>
        </div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-3 font-semibold">
          <button
            type="button"
            className="px-3 text-gray-400"
            onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
          >
            ‹
          </button>
          <span>
            {MONTHS[month.getMonth()]} {month.getFullYear()}
          </span>
          <button
            type="button"
            className="px-3 text-gray-400"
            onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
          >
            ›
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1.5 text-center">
          {WEEKDAYS.map((w, i) => (
            <div key={i} className="text-[10px] text-gray-400">
              {w}
            </div>
          ))}
          {cells.map((c) => {
            const r = rows[c.iso];
            const missed = r && !r.completed && c.iso < todayIso;
            let tone = "bg-gray-50 text-gray-300";
            if (c.inMonth) tone = "bg-gray-50 text-gray-400";
            if (r?.completed) tone = "bg-brand text-gray-900 font-semibold";
            else if (missed) tone = "bg-red-100 text-red-700 font-semibold";
            else if (r) tone = "border-2 border-gray-300 bg-white text-gray-600 font-semibold";
            return (
              <button
                key={c.iso}
                type="button"
                onClick={() => setSelected(c.iso)}
                className={`h-11 rounded-xl text-xs flex flex-col items-center justify-center ${tone} ${
                  c.inMonth ? "" : "opacity-40"
                } ${selected === c.iso ? "ring-2 ring-offset-2 ring-gray-900" : ""}`}
              >
                {c.day}
                {r?.completed && r.fatigue ? <span className="text-[9px] leading-none mt-0.5">{r.fatigue}</span> : null}
              </button>
            );
          })}
        </div>

        <div className="flex gap-3 flex-wrap mt-3 text-[11px] text-gray-500">
          <span className="flex items-center gap-1">
            <i className="inline-block w-2.5 h-2.5 rounded-full bg-brand" /> Fatto (numero = fatica)
          </span>
          <span className="flex items-center gap-1">
            <i className="inline-block w-2.5 h-2.5 rounded-full border-2 border-gray-300" /> Previsto
          </span>
          <span className="flex items-center gap-1">
            <i className="inline-block w-2.5 h-2.5 rounded-full bg-red-100" /> Saltato
          </span>
        </div>
      </div>

      <div className="card">
        <h3 className="font-bold first-letter:uppercase">{selLabel}</h3>
        {sel ? (
          <>
            <p className="text-sm text-gray-600 mb-2">
              {sel.title}
              {" · "}
              <span className="font-medium">
                {sel.completed
                  ? `completato${sel.fatigue ? ` · fatica ${sel.fatigue}/10` : ""}`
                  : sel.date < todayIso
                  ? "saltato"
                  : "previsto"}
              </span>
            </p>
            <div>
              {(sel.blocks || []).map((b, bi) => {
                const scores = getBlockScores(b);
                const lines = htmlToLines(b.description);
                const first = lines[0] || b.type;
                const results = scores
                  .map((score, si) => {
                    const entry = readClientScoreEntry(sel.client_scores || {}, bi, si);
                    if (!entry) return null;
                    const vals = entry.values.filter((v) => v.trim() !== "");
                    if (vals.length === 0) return null;
                    const unit = score.type === "peso" ? " kg" : "";
                    return vals.length > 1
                      ? vals.map((v) => `${v}${unit}`).join(" · ")
                      : displayScoreValue(entry, score.aggregation, score.type);
                  })
                  .filter(Boolean);
                return (
                  <div key={bi} className="border-t border-gray-100 py-2 text-sm flex justify-between gap-3">
                    <span className="min-w-0">
                      <span className="block truncate">{first}</span>
                      <span className="block text-xs text-gray-400">{b.type}</span>
                    </span>
                    <span className="text-gray-500 text-right text-xs shrink-0 max-w-[55%]">
                      {results.length ? results.join(" · ") : ""}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="flex gap-2 mt-3">
              <Link
                href={`/trainer/calendario?cliente=${clientId}&data=${selected}&modifica=1`}
                className="btn-secondary flex-1 text-center"
              >
                ✏️ Modifica la sessione
              </Link>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-gray-500 mb-3">Nessun allenamento in questo giorno.</p>
            <Link
              href={`/trainer/calendario?cliente=${clientId}&data=${selected}&modifica=1`}
              className="btn-secondary block text-center"
            >
              + Aggiungi allenamento
            </Link>
          </>
        )}
        <Link
          href={`/trainer/calendario?cliente=${clientId}&data=${selected}`}
          className="block text-center text-xs text-gray-500 underline mt-3"
        >
          Vedi tutta la settimana
        </Link>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { addDays, getWeekDays, startOfWeek, toISODate } from "@/lib/dates";

type Row = { client_id: string; date: string; completed: boolean | null; fatigue: number | null };

// Vista "Squadra": una riga per ogni ragazzo, sette pallini per la settimana.
// Verde (col voto di fatica) = fatto, bordo grigio = previsto, rosso = saltato.
export default function TeamWeek({ clients }: { clients: { id: string; name: string }[] }) {
  const supabase = createClient();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [rows, setRows] = useState<Row[] | null>(null);
  const todayIso = toISODate(new Date());
  const days = getWeekDays(weekStart);
  const ids = clients.map((c) => c.id);

  useEffect(() => {
    if (ids.length === 0) {
      setRows([]);
      return;
    }
    setRows(null);
    (async () => {
      const { data } = await supabase
        .from("workout_assignments")
        .select("client_id, date, completed, fatigue")
        .in("client_id", ids)
        .gte("date", days[0].iso)
        .lte("date", days[6].iso);
      setRows((data as Row[]) || []);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart, ids.join(",")]);

  const list = useMemo(() => {
    const byClient = new Map<string, Map<string, Row>>();
    (rows || []).forEach((r) => {
      if (!byClient.has(r.client_id)) byClient.set(r.client_id, new Map());
      byClient.get(r.client_id)!.set(r.date, r);
    });
    return clients
      .map((c) => {
        const m = byClient.get(c.id) || new Map<string, Row>();
        let missed = 0;
        let done = 0;
        let planned = 0;
        let hardDays = 0;
        m.forEach((r) => {
          planned++;
          if (r.completed) {
            done++;
            if ((r.fatigue || 0) >= 8) hardDays++;
          } else if (r.date < todayIso) missed++;
        });
        return { ...c, map: m, missed, done, planned, hardDays };
      })
      .sort((a, b) => b.missed + b.hardDays - (a.missed + a.hardDays) || a.name.localeCompare(b.name));
  }, [rows, clients, todayIso]);

  if (clients.length === 0) return null;

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Squadra</p>
        <div className="flex items-center gap-1 text-sm">
          <button type="button" className="px-2 text-gray-400" onClick={() => setWeekStart(addDays(weekStart, -7))}>
            ‹
          </button>
          <button
            type="button"
            className="text-xs text-gray-600"
            onClick={() => setWeekStart(startOfWeek(new Date()))}
          >
            {days[0].dayNumber}/{days[0].month} – {days[6].dayNumber}/{days[6].month}
          </button>
          <button type="button" className="px-2 text-gray-400" onClick={() => setWeekStart(addDays(weekStart, 7))}>
            ›
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white overflow-hidden">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-4 pt-3 pb-1">
          <span />
          <div className="grid grid-cols-7 gap-1.5 w-[210px] sm:w-[252px] text-center">
            {days.map((d) => (
              <span key={d.iso} className="text-[10px] text-gray-400">
                {d.label.slice(0, 1).toUpperCase()}
              </span>
            ))}
          </div>
        </div>

        {rows === null ? (
          <p className="px-4 py-6 text-sm text-gray-400">Caricamento…</p>
        ) : (
          list.map((c) => (
            <div
              key={c.id}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-4 py-2.5 border-t border-gray-100"
            >
              <Link href={`/trainer/clienti/${c.id}`} className="min-w-0">
                <span className="block truncate font-medium text-sm">{c.name}</span>
                <span className="block truncate text-[11px] text-gray-400">
                  {c.planned === 0 ? "Nessun allenamento" : `${c.done}/${c.planned} fatti`}
                  {c.missed > 0 ? ` · ${c.missed} saltat${c.missed === 1 ? "o" : "i"}` : ""}
                </span>
              </Link>
              <div className="grid grid-cols-7 gap-1.5 w-[210px] sm:w-[252px]">
                {days.map((d) => {
                  const r = c.map.get(d.iso);
                  const missed = r && !r.completed && d.iso < todayIso;
                  let tone = "bg-gray-50 text-transparent";
                  let text = "";
                  if (r?.completed) {
                    tone = "bg-brand text-gray-900 font-semibold";
                    text = r.fatigue ? String(r.fatigue) : "✓";
                  } else if (missed) {
                    tone = "bg-red-100 text-red-700 font-semibold";
                    text = "–";
                  } else if (r) {
                    tone = "border-2 border-gray-300 bg-white text-transparent";
                  }
                  return (
                    <Link
                      key={d.iso}
                      href={`/trainer/calendario?cliente=${c.id}&data=${d.iso}`}
                      className={`h-7 rounded-full flex items-center justify-center text-[11px] ${tone} ${
                        d.iso === todayIso ? "ring-2 ring-offset-1 ring-gray-900" : ""
                      }`}
                    >
                      {text}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
      <p className="text-[11px] text-gray-400 mt-2 px-1">
        Verde = fatto (numero = fatica) · bordo = previsto · rosso = saltato. In alto chi ha bisogno di attenzione.
      </p>
    </div>
  );
}

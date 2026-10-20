"use client";

import { ReactNode, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { getWeekDays, startOfWeek, toISODate } from "@/lib/dates";
import { Block } from "@/lib/workoutTypes";

type Row = {
  id: string;
  date: string;
  title: string;
  blocks: Block[];
  completed: boolean;
  isGroup?: boolean;
};

export default function OggiCard({ clientId, programs }: { clientId: string; programs?: ReactNode }) {
  const supabase = createClient();
  const [rows, setRows] = useState<Record<string, Row>>({});
  const [loading, setLoading] = useState(true);

  const days = getWeekDays(startOfWeek(new Date()));
  const todayIso = toISODate(new Date());

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("workout_assignments")
        .select("id, date, title, blocks, completed")
        .eq("client_id", clientId)
        .gte("date", days[0].iso)
        .lte("date", days[6].iso);

      const map: Record<string, Row> = {};
      (data || []).forEach((a: Row) => (map[a.date] = a));

      // Giorni senza scheda individuale: controlla gli allenamenti di gruppo.
      const missing = days.map((d) => d.iso).filter((iso) => !map[iso]);
      if (missing.length > 0) {
        const { data: memberships } = await supabase
          .from("group_members")
          .select("group_id")
          .eq("client_id", clientId);
        const groupIds = (memberships || []).map((m: { group_id: string }) => m.group_id);
        if (groupIds.length > 0) {
          const { data: gw } = await supabase
            .from("group_workouts")
            .select("id, date, title, blocks")
            .in("group_id", groupIds)
            .in("date", missing);
          (gw || []).forEach((w: { id: string; date: string; title: string; blocks: Block[] }) => {
            if (!map[w.date]) {
              map[w.date] = { id: w.id, date: w.date, title: w.title, blocks: w.blocks, completed: false, isGroup: true };
            }
          });
        }
      }
      setRows(map);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  if (loading) {
    return <div className="card mb-4 h-40 animate-pulse bg-gray-50" />;
  }

  const today = rows[todayIso];
  const next = days.find((d) => d.iso > todayIso && rows[d.iso]);
  const planned = days.filter((d) => rows[d.iso]).length;
  const done = days.filter((d) => rows[d.iso]?.completed).length;
  const todayLabel = days.find((d) => d.iso === todayIso);

  return (
    <div className="mb-4 space-y-3">
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold">Questa settimana</p>
          <p className="text-xs text-gray-500">
            {done}/{planned} completati
          </p>
        </div>
        <div className="flex justify-between">
          {days.map((d) => {
            const r = rows[d.iso];
            const isToday = d.iso === todayIso;
            return (
              <Link
                key={d.iso}
                href={`/cliente/allenamento/${d.iso}`}
                className="flex flex-col items-center gap-1"
              >
                <span className="text-[11px] text-gray-400">{d.label.slice(0, 1).toUpperCase()}</span>
                <span
                  className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold ${
                    r?.completed
                      ? "bg-brand text-gray-900"
                      : r
                      ? "border-2 border-gray-300 text-gray-600"
                      : "bg-gray-100 text-gray-300"
                  } ${isToday ? "ring-2 ring-offset-2 ring-gray-900" : ""}`}
                >
                  {r?.completed ? "✓" : d.dayNumber}
                </span>
              </Link>
            );
          })}
        </div>
      </div>

      <Link href="/cliente/dieta" className="card flex items-center justify-between">
        <span className="flex items-center gap-3 text-sm font-medium">
          <span className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-lg">🥗</span>
          Piano alimentare di oggi
        </span>
        <span className="text-gray-400">→</span>
      </Link>

      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 pt-3 px-0.5">
        Allenamenti di oggi{todayLabel ? ` · ${todayLabel.label} ${todayLabel.dayNumber}/${todayLabel.month}` : ""}
      </p>

      {programs}

      {today ? (
        <Link href={`/cliente/allenamento/${todayIso}`} className="card flex items-center gap-3">
          <span className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-lg">
            {today.completed ? "✅" : "📋"}
          </span>
          <span className="min-w-0">
            <span className="block font-bold truncate">{today.title}</span>
            <span className="block text-xs text-gray-500 truncate">
              {today.completed
                ? "Completato · tocca per rivedere"
                : (today.blocks || []).slice(0, 3).map((b) => b.type).join(" · ") || "Scheda individuale"}
            </span>
          </span>
          <span className="ml-auto text-gray-400">›</span>
        </Link>
      ) : (
        <div className="card text-sm text-gray-500">
          {next
            ? `Nessuna scheda individuale oggi. Prossima: ${next.label} ${next.dayNumber}/${next.month} · ${rows[next.iso].title}`
            : "Nessuna scheda individuale oggi."}
        </div>
      )}
    </div>
  );
}

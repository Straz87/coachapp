"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { addDays, getWeekDays, startOfWeek, toISODate } from "@/lib/dates";
import { Block } from "@/lib/workoutTypes";

type Assignment = {
  id: string;
  date: string;
  title: string;
  blocks: Block[];
  completed: boolean;
  isGroup?: boolean;
};

export default function ClientWeekView({ clientId }: { clientId: string }) {
  const supabase = createClient();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [assignments, setAssignments] = useState<Record<string, Assignment>>({});
  const [loading, setLoading] = useState(true);

  const days = getWeekDays(weekStart);
  const todayIso = toISODate(new Date());

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("workout_assignments")
      .select("*")
      .eq("client_id", clientId)
      .gte("date", days[0].iso)
      .lte("date", days[6].iso);

    const map: Record<string, Assignment> = {};
    (data || []).forEach((a: Assignment) => (map[a.date] = a));

    // Per i giorni senza scheda individuale, controlla se il cliente segue
    // un gruppo con un allenamento condiviso per quel giorno.
    const missingDays = days.map((d) => d.iso).filter((iso) => !map[iso]);
    if (missingDays.length > 0) {
      const { data: memberships } = await supabase
        .from("group_members")
        .select("group_id")
        .eq("client_id", clientId);
      const groupIds = (memberships || []).map((m) => m.group_id);

      if (groupIds.length > 0) {
        const { data: groupWorkouts } = await supabase
          .from("group_workouts")
          .select("id, date, title, blocks")
          .in("group_id", groupIds)
          .in("date", missingDays);

        (groupWorkouts || []).forEach((w: { id: string; date: string; title: string; blocks: Block[] }) => {
          if (!map[w.date]) {
            map[w.date] = {
              id: w.id,
              date: w.date,
              title: w.title,
              blocks: w.blocks,
              completed: false,
              isGroup: true,
            };
          }
        });
      }
    }

    setAssignments(map);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, weekStart]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <button className="btn-secondary" onClick={() => setWeekStart(addDays(weekStart, -7))}>
          ← Prec.
        </button>
        <span className="font-medium">
          {days[0].dayNumber}/{days[0].month} – {days[6].dayNumber}/{days[6].month}
        </span>
        <button className="btn-secondary" onClick={() => setWeekStart(addDays(weekStart, 7))}>
          Succ. →
        </button>
      </div>

      {loading ? (
        <p className="text-gray-400 text-sm">Caricamento…</p>
      ) : (
        <div className="space-y-4">
          {days.map((day) => {
            const a = assignments[day.iso];
            const isToday = day.iso=== todayIso;
            return (
              <Link
                key={day.iso}
                href={`/cliente/allenamento/${day.iso}`}
                className={`card block ${isToday ? "ring-2 ring-brand" : ""}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold">
                    {day.label} {day.dayNumber}/{day.month} {isToday && <span className="text-brand-dark">· Oggi</span>}
                  </p>
                  {a?.completed && <span className="text-green-600 text-sm">✓ Completato</span>}
                </div>

                {a ? (
                  <div>
                    <p className="font-semibold mb-1 flex items-center gap-2">
                      {a.title}
                      {a.isGroup && (
                        <span className="text-[10px] font-normal uppercase tracking-wide bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">
                          Gruppo
                        </span>
                      )}
                    </p>
                    <ul className="text-xs text-gray-500 space-y-0.5">
                      {a.blocks.slice(0, 3).map((b, i) => (
                        <li key={i}>• {b.type}</li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="text-gray-300 text-sm">Giorno di riposo / nessuna scheda assegnata.</p>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

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
            const isToday = day.iso === todayIso;
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
                    <p className="font-semibold mb-1">{a.title}</p>
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

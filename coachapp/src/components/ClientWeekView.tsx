"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { addDays, getWeekDays, startOfWeek, toISODate } from "@/lib/dates";

type Assignment = {
  id: string;
  date: string;
  title: string;
  blocks: { section: string; lines: string[] }[];
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

  async function toggleComplete(a: Assignment) {
    await supabase
      .from("workout_assignments")
      .update({ completed: !a.completed, completed_at: !a.completed ? new Date().toISOString() : null })
      .eq("id", a.id);
    load();
  }

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
              <div key={day.iso} className={`card ${isToday ? "ring-2 ring-brand" : ""}`}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold">
                    {day.label} {day.dayNumber}/{day.month} {isToday && <span className="text-brand-dark">· Oggi</span>}
                  </p>
                  {a && (
                    <button
                      onClick={() => toggleComplete(a)}
                      className={a.completed ? "text-green-600 text-sm" : "text-gray-400 text-sm hover:text-gray-700"}
                    >
                      {a.completed ? "✓ Completato" : "Segna come fatto"}
                    </button>
                  )}
                </div>

                {a ? (
                  <div>
                    <p className="font-semibold mb-2">{a.title}</p>
                    {a.blocks.map((b, i) => (
                      <div key={i} className="mb-2">
                        <p className="text-sm font-medium text-gray-700">{b.section}</p>
                        <ul className="text-sm text-gray-600 ml-3 list-disc">
                          {b.lines.map((line, j) => (
                            <li key={j}>{line}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-300 text-sm">Giorno di riposo / nessuna scheda assegnata.</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

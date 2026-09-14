"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { addDays, getWeekDays, startOfWeek, toISODate } from "@/lib/dates";

// Striscia orizzontale dei 7 giorni della settimana (stile Hustle Up),
// mostrata sopra la scheda del giorno cosi' il cliente vede sempre dove si
// trova nella settimana e puo' saltare a un altro giorno con un tocco,
// senza dover tornare al calendario. Un puntino sotto il numero indica se
// quel giorno ha un allenamento assegnato (individuale o di gruppo).
export default function DayStrip({ clientId, date }: { clientId: string; date: string }) {
  const supabase = createClient();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(`${date}T00:00:00`)));
  const [hasWorkout, setHasWorkout] = useState<Record<string, boolean>>({});

  const days = getWeekDays(weekStart);
  const todayIso = toISODate(new Date());

  useEffect(() => {
    let isMounted = true;
    async function load() {
      const { data: individual } = await supabase
        .from("workout_assignments")
        .select("date")
        .eq("client_id", clientId)
        .gte("date", days[0].iso)
        .lte("date", days[6].iso);

      const map: Record<string, boolean> = {};
      (individual || []).forEach((r: { date: string }) => {
        map[r.date] = true;
      });

      const missingDays = days.map((d) => d.iso).filter((iso) => !map[iso]);
      if (missingDays.length > 0) {
        const { data: memberships } = await supabase
          .from("group_members")
          .select("group_id")
          .eq("client_id", clientId);
        const groupIds = (memberships || []).map((m: { group_id: string }) => m.group_id);

        if (groupIds.length > 0) {
          const { data: groupWorkouts } = await supabase
            .from("group_workouts")
            .select("date")
            .in("group_id", groupIds)
            .in("date", missingDays);
          (groupWorkouts || []).forEach((w: { date: string }) => {
            map[w.date] = true;
          });
        }
      }

      if (isMounted) setHasWorkout(map);
    }
    load();
    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, days[0].iso]);

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => setWeekStart((w) => addDays(w, -7))}
        className="shrink-0 w-7 h-11 flex items-center justify-center text-gray-300 hover:text-gray-600"
        aria-label="Settimana precedente"
      >
        ‹
      </button>

      <div className="flex-1 flex gap-1.5 overflow-x-auto no-scrollbar">
        {days.map((d) => {
          const active = d.iso === date;
          const isToday = d.iso === todayIso;
          return (
            <Link
              key={d.iso}
              href={`/cliente/allenamento/${d.iso}`}
              className={`shrink-0 flex flex-col items-center justify-center rounded-2xl px-3 py-1.5 min-w-[46px] transition-colors ${
                active
                  ? "bg-gray-900 text-white"
                  : isToday
                  ? "bg-brand/20 text-gray-900"
                  : "bg-gray-100 text-gray-500"
              }`}
            >
              <span className="text-[10px] uppercase tracking-wide opacity-70">{d.label}</span>
              <span className="text-sm font-semibold leading-tight">{d.dayNumber}</span>
              <span
                className={`w-1.5 h-1.5 rounded-full mt-0.5 ${
                  hasWorkout[d.iso] ? (active ? "bg-white" : "bg-brand-dark") : "bg-transparent"
                }`}
              />
            </Link>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => setWeekStart((w) => addDays(w, 7))}
        className="shrink-0 w-7 h-11 flex items-center justify-center text-gray-300 hover:text-gray-600"
        aria-label="Settimana successiva"
      >
        ›
      </button>
    </div>
  );
}

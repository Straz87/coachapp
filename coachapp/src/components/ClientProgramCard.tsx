"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { htmlToLines } from "@/lib/workoutTypes";
import { latestByExercise } from "@/lib/benchmarks";

type ProgramInfo = {
  membershipId: string;
  programId: string;
  programName: string;
  lengthDays: number;
  currentDay: number;
  completed: boolean;
  dayTitle: string | null;
  dayBlocks: { type: string; description: string }[];
};

type Max = { exercise_name: string; value_kg: number };

// Se la riga contiene "90%" e il cliente ha salvato il massimale di
// quell'esercizio (il nome compare nella riga), restituisce i kg (a 0,5).
function kgForLine(line: string, maxes: Max[]): number | null {
  const m = line.match(/(\d+(?:[.,]\d+)?)\s*%/);
  if (!m) return null;
  const pct = Number(m[1].replace(",", "."));
  const lower = line.toLowerCase();
  const max = maxes.find((x) => lower.includes(x.exercise_name.toLowerCase()));
  if (!max) return null;
  return Math.round(((max.value_kg * pct) / 100) * 2) / 2;
}

// Card sulla home del cliente per i programmi a durata fissa a cui è
// iscritto: mostra il giorno IN CUI SI TROVA LUI (non quello del
// calendario) a blocchi apribili, e permette di segnarlo come fatto per
// avanzare al successivo.
export default function ClientProgramCard({ clientId }: { clientId: string }) {
  const supabase = createClient();
  const [programs, setPrograms] = useState<ProgramInfo[] | null>(null);
  const [maxes, setMaxes] = useState<Max[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      const { data: memberships } = await supabase
        .from("program_members")
        .select("id, program_id, current_day, completed, programs:program_id(name, length_days)")
        .eq("client_id", clientId);

      const active = (memberships || []).filter((m: any) => !m.completed);

      const results: ProgramInfo[] = [];
      for (const m of active as any[]) {
        const { data: day } = await supabase
          .from("program_days")
          .select("title, blocks")
          .eq("program_id", m.program_id)
          .eq("day_number", m.current_day)
          .maybeSingle();

        results.push({
          membershipId: m.id,
          programId: m.program_id,
          programName: m.programs?.name || "Programma",
          lengthDays: m.programs?.length_days || 0,
          currentDay: m.current_day,
          completed: m.completed,
          dayTitle: day?.title || null,
          dayBlocks: day?.blocks || [],
        });
      }
      if (isMounted) setPrograms(results);

      const { data: mx } = await supabase
        .from("client_maxes")
        .select("exercise_name, value_kg, recorded_at")
        .eq("client_id", clientId)
        .not("value_kg", "is", null);
      if (isMounted) setMaxes(latestByExercise(mx || []) as Max[]);
    }

    load();
    return () => {
      isMounted = false;
    };
  }, [clientId]);

  async function markDone(programId: string) {
    setBusyId(programId);
    try {
      const res = await fetch(`/api/cliente/programmi/${programId}/completa`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setPrograms((prev) =>
          (prev || [])
            .map((p) =>
              p.programId === programId ? { ...p, currentDay: data.currentDay, completed: data.completed } : p
            )
            .filter((p) => !p.completed)
        );
      }
    } finally {
      setBusyId(null);
    }
  }

  if (!programs || programs.length === 0) return null;

  return (
    <div className="mb-6">
      {programs.map((p) => (
        <details key={p.membershipId} className="card !p-0 mb-3 group/prog">
          <summary className="list-none flex items-center gap-3 px-4 py-4 cursor-pointer [&::-webkit-details-marker]:hidden">
            <span className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-lg">🏋️</span>
            <span className="min-w-0">
              <span className="block font-bold truncate">{p.programName}</span>
              <span className="block text-xs text-gray-500">
                Giorno {p.currentDay} di {p.lengthDays}
                {p.dayTitle ? ` · ${p.dayTitle}` : ""}
              </span>
            </span>
            <span className="ml-auto text-gray-400 transition-transform group-open/prog:rotate-90">›</span>
          </summary>
          <div className="px-3 pb-3">
          {p.dayTitle ? (
            <>
              {p.dayBlocks.map((b, i) => {
                const lines = htmlToLines(b.description);
                return (
                  <details key={i} className="rounded-2xl bg-gray-50 mb-2 group">
                    <summary className="list-none flex items-center gap-2.5 px-4 py-3.5 font-semibold cursor-pointer [&::-webkit-details-marker]:hidden">
                      <span className="w-6 h-6 rounded-full bg-brand text-xs flex items-center justify-center">
                        {i + 1}
                      </span>
                      <span>{b.type}</span>
                      <span className="ml-auto text-xs font-normal text-gray-400">
                        {lines.length} {lines.length === 1 ? "riga" : "righe"}
                      </span>
                      <span className="text-gray-400 transition-transform group-open:rotate-90">›</span>
                    </summary>
                    <div className="pl-[52px] pr-4 pb-3 text-sm text-gray-700">
                      {lines.map((line, li) => {
                        const kg = kgForLine(line, maxes);
                        return (
                          <div key={li} className="border-t border-gray-100 py-1.5">
                            {line}
                            {kg !== null && <span className="font-semibold text-gray-900"> → {kg} kg</span>}
                          </div>
                        );
                      })}
                    </div>
                  </details>
                );
              })}
              <button
                onClick={() => markDone(p.programId)}
                disabled={busyId === p.programId}
                className="btn-primary w-full text-sm mt-1"
              >
                {busyId === p.programId ? "Attendi…" : "✓ Segna come fatto"}
              </button>
            </>
          ) : (
            <p className="text-gray-400 text-sm px-1 pb-1">Il tuo coach non ha ancora pubblicato questo giorno.</p>
          )}
          </div>
        </details>
      ))}
    </div>
  );
}

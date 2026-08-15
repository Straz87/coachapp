"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { htmlToLines } from "@/lib/workoutTypes";

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

// Card sulla home del cliente per i programmi a durata fissa a cui è
// iscritto: mostra il giorno IN CUI SI TROVA LUI (non quello del
// calendario) e permette di segnarlo come fatto per avanzare al
// successivo.
export default function ClientProgramCard({ clientId }: { clientId: string }) {
  const supabase = createClient();
  const [programs, setPrograms] = useState<ProgramInfo[] | null>(null);
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
    <div className="space-y-4 mb-6">
      {programs.map((p) => (
        <div key={p.membershipId} className="card">
          <div className="flex items-center justify-between mb-2">
            <p className="font-semibold">{p.programName}</p>
            <span className="text-xs text-gray-400">
              Giorno {p.currentDay} di {p.lengthDays}
            </span>
          </div>
          {p.dayTitle ? (
            <>
              <p className="text-sm font-medium mb-2">{p.dayTitle}</p>
              <div className="space-y-2 mb-3">
                {p.dayBlocks.map((b, i) => (
                  <div key={i}>
                    <p className="text-xs font-medium text-gray-700">{b.type}</p>
                    {htmlToLines(b.description).map((line, li) => (
                      <p key={li} className="text-xs text-gray-500">
                        {line}
                      </p>
                    ))}
                  </div>
                ))}
              </div>
              <button
                onClick={() => markDone(p.programId)}
                disabled={busyId === p.programId}
                className="btn-primary w-full text-sm"
              >
                {busyId === p.programId ? "Attendi…" : "✓ Segna come fatto"}
              </button>
            </>
          ) : (
            <p className="text-gray-400 text-sm">Il tuo coach non ha ancora pubblicato questo giorno.</p>
          )}
        </div>
      ))}
    </div>
  );
}

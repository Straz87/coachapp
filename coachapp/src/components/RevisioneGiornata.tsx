"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { addDays, toISODate } from "@/lib/dates";
import {
  Block,
  ClientScores,
  TIMER_LABELS,
  scoreLabel,
  normalizeEntry,
  displayScoreValue,
  getTimerSets,
  totalTimerSeconds,
  formatClock,
} from "@/lib/workoutTypes";

// Vista di sola lettura per il trainer: mostra cosa il cliente ha
// effettivamente svolto in una giornata specifica (blocchi, punteggi
// inseriti, RPE, note) senza permettere di modificare la scheda. Serve
// per rivedere l'allenamento e prendere le informazioni necessarie a
// periodizzare, senza il rischio di finire per sbaglio nell'editor.
type Source =
  | { kind: "individual"; assignmentId: string }
  | { kind: "group"; groupWorkoutId: string; groupId: string };

type ViewModel = {
  source: Source;
  title: string;
  blocks: Block[];
  completed: boolean;
  completedAt: string | null;
  likedBy: string[];
  clientScores: ClientScores;
};

export default function RevisioneGiornata({
  clientId,
  clientName,
  date,
  dateLabel,
  groupId,
}: {
  clientId: string;
  clientName: string;
  date: string;
  dateLabel: string;
  groupId?: string | null;
}) {
  const supabase = createClient();
  const [vm, setVm] = useState<ViewModel | null>(null);
  const [prevScores, setPrevScores] = useState<ClientScores | null>(null);
  const [loading, setLoading] = useState(true);
  const [openBlocks, setOpenBlocks] = useState<Record<number, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);

    // 1) Un allenamento individuale ha sempre la precedenza (stessa
    // logica della vista cliente): se esiste, è quello che ha svolto.
    const { data: assignment } = await supabase
      .from("workout_assignments")
      .select("*")
      .eq("client_id", clientId)
      .eq("date", date)
      .maybeSingle();

    if (assignment) {
      setVm({
        source: { kind: "individual", assignmentId: assignment.id },
        title: assignment.title,
        blocks: assignment.blocks || [],
        completed: assignment.completed,
        completedAt: assignment.completed_at || null,
        likedBy: assignment.liked_by || [],
        clientScores: assignment.client_scores || {},
      });

      const prevDate = toISODate(addDays(new Date(`${date}T00:00:00`), -7));
      const { data: prevData } = await supabase
        .from("workout_assignments")
        .select("client_scores")
        .eq("client_id", clientId)
        .eq("date", prevDate)
        .maybeSingle();
      setPrevScores((prevData?.client_scores as ClientScores | null) || null);

      setLoading(false);
      return;
    }

    // 2) Nessun allenamento individuale: cerca l'allenamento di gruppo
    // per questo giorno (se la notifica indicava un gruppo specifico,
    // usa direttamente quello; altrimenti guarda tutti i gruppi del
    // cliente, come nella vista cliente).
    const groupIds = groupId
      ? [groupId]
      : ((
          await supabase.from("group_members").select("group_id").eq("client_id", clientId)
        ).data || []
        ).map((m) => m.group_id);

    if (groupIds.length > 0) {
      const { data: groupWorkout } = await supabase
        .from("group_workouts")
        .select("*")
        .in("group_id", groupIds)
        .eq("date", date)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (groupWorkout) {
        const { data: scoreRow } = await supabase
          .from("group_workout_scores")
          .select("*")
          .eq("group_workout_id", groupWorkout.id)
          .eq("client_id", clientId)
          .maybeSingle();

        setVm({
          source: {
            kind: "group",
            groupWorkoutId: groupWorkout.id,
            groupId: groupWorkout.group_id,
          },
          title: groupWorkout.title,
          blocks: groupWorkout.blocks || [],
          completed: scoreRow?.completed || false,
          completedAt: scoreRow?.completed_at || null,
          likedBy: groupWorkout.liked_by || [],
          clientScores: scoreRow?.client_scores || {},
        });

        const prevDate = toISODate(addDays(new Date(`${date}T00:00:00`), -7));
        const { data: prevGroupWorkout } = await supabase
          .from("group_workouts")
          .select("id")
          .eq("group_id", groupWorkout.group_id)
          .eq("date", prevDate)
          .maybeSingle();

        if (prevGroupWorkout) {
          const { data: prevScoreRow } = await supabase
            .from("group_workout_scores")
            .select("client_scores")
            .eq("group_workout_id", prevGroupWorkout.id)
            .eq("client_id", clientId)
            .maybeSingle();
          setPrevScores((prevScoreRow?.client_scores as ClientScores | null) || null);
        } else {
          setPrevScores(null);
        }

        setLoading(false);
        return;
      }
    }

    // 3) Nessuna scheda individuale né di gruppo per questo giorno.
    setVm(null);
    setPrevScores(null);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, date, groupId]);

  useEffect(() => {
    load();
  }, [load]);

  function isBlockOpen(index: number) {
    return openBlocks[index] ?? true;
  }

  function toggleBlock(index: number) {
    setOpenBlocks((prev) => ({ ...prev, [index]: !isBlockOpen(index) }));
  }

  if (loading) {
    return <p className="text-gray-400">Caricamento…</p>;
  }

  if (!vm) {
    return (
      <div className="card text-gray-500">
        <p className="text-lg font-semibold text-gray-900 mb-1">{dateLabel}</p>
        Nessuna scheda trovata per questo giorno.
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs text-gray-400 mb-1">{dateLabel}</p>
          <h1 className="text-2xl font-bold text-gray-900">{vm.title}</h1>
          <p className="text-sm text-gray-500 mt-1">{clientName}</p>
        </div>
        <span
          className="text-sm font-semibold px-3 py-1.5 rounded-full"
          style={
            vm.completed
              ? { background: "#dcfce7", color: "#15803d" }
              : { background: "#f3f4f6", color: "#4b5563" }
          }
        >
          {vm.completed ? "✓ Completato" : "Non ancora completato"}
        </span>
      </div>

      {vm.likedBy.length > 0 && (
        <p className="text-xs text-gray-400">
          ❤️ {vm.likedBy.length} reazion{vm.likedBy.length === 1 ? "e" : "i"}
        </p>
      )}

      <div className="space-y-3">
        {vm.blocks.map((b, i) => {
          const scoreEntry = normalizeEntry(vm.clientScores?.[String(i)]);
          const prevEntry = normalizeEntry(prevScores?.[String(i)]);
          const open = isBlockOpen(i);
          return (
            <div key={i} className="card">
              <button
                onClick={() => toggleBlock(i)}
                className="w-full flex items-center justify-between text-left"
              >
                <span className="flex items-center gap-2 flex-wrap">
                  <span className="inline-block bg-gray-100 text-gray-700 text-sm px-3 py-1 rounded-full">
                    {b.type}
                  </span>
                  {b.exerciseName && (
                    <span className="text-sm font-semibold text-gray-700">{b.exerciseName}</span>
                  )}
                  {scoreEntry && (
                    <span className="text-xs font-bold px-2 py-1 rounded-full bg-brand/30 text-brand-dark">
                      {scoreEntry.rx ? "RX" : "SC"} {displayScoreValue(scoreEntry, b.score?.aggregation)}
                    </span>
                  )}
                </span>
                <span className={`text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}>▾</span>
              </button>

              {open && (
                <div className="mt-3 space-y-3">
                  {b.timer && (
                    <p className="text-sm text-gray-500">
                      ⏱ {TIMER_LABELS[b.timer.type]} · {formatClock(totalTimerSeconds(getTimerSets(b.timer)))}
                    </p>
                  )}

                  {b.description && (
                    <div
                      className="text-sm text-gray-600 [&_a]:text-brand-dark [&_a]:underline [&_ul]:list-disc [&_ul]:ml-5 [&_ol]:list-decimal [&_ol]:ml-5 [&_h1]:text-base [&_h1]:font-bold [&_h2]:text-sm [&_h2]:font-semibold"
                      dangerouslySetInnerHTML={{ __html: b.description }}
                    />
                  )}

                  {b.rpe !== null && (
                    <span className="inline-block text-xs bg-gray-100 text-gray-700 rounded-full px-2 py-1">
                      RPE {b.rpe}
                    </span>
                  )}

                  {b.score && (
                    <div className="pt-2 border-t border-gray-100 space-y-2">
                      <div className="flex items-center justify-between text-sm text-gray-500">
                        <span>Punteggio</span>
                        <span>{scoreLabel(b.score.type)}</span>
                      </div>

                      {prevEntry && (
                        <div className="flex items-center gap-2 bg-brand/10 border border-brand/30 rounded-xl px-3 py-2">
                          <span className="text-brand-dark">🕐</span>
                          <span className="text-sm text-gray-700">
                            Settimana scorsa:{" "}
                            <span className="font-semibold">
                              {displayScoreValue(prevEntry, b.score?.aggregation)} {prevEntry.rx ? "RX" : "SC"}
                            </span>
                          </span>
                        </div>
                      )}

                      {scoreEntry ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold px-2 py-1 rounded-full bg-gray-100 text-gray-700">
                            {scoreEntry.rx ? "RX" : "SC"}
                          </span>
                          <span className="font-semibold">
                            {displayScoreValue(scoreEntry, b.score?.aggregation)}
                          </span>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-400">Nessun punteggio inserito.</p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <Link
        href={
          vm.source.kind === "group"
            ? `/trainer/calendario?gruppo=${vm.source.groupId}&data=${date}`
            : `/trainer/calendario?cliente=${clientId}&data=${date}`
        }
        className="btn-secondary inline-block text-sm"
      >
        Modificare la scheda
      </Link>
    </div>
  );
}

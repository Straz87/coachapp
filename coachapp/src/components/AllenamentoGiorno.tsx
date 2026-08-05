"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  Block,
  ClientScores,
  TIMER_LABELS,
  scoreLabel,
} from "@/lib/workoutTypes";
import WorkoutTimer from "@/components/WorkoutTimer";

type Assignment = {
  id: string;
  date: string;
  title: string;
  blocks: Block[];
  completed: boolean;
  client_scores: ClientScores;
  liked_by: string[];
};

export default function AllenamentoGiorno({
  clientId,
  profileId,
  trainerName,
  date,
  dateLabel,
}: {
  clientId: string;
  profileId: string;
  trainerName: string;
  date: string;
  dateLabel: string;
}) {
  const supabase = createClient();
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [loading, setLoading] = useState(true);
  const [openTimers, setOpenTimers] = useState<Record<number, boolean>>({});
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [draftValue, setDraftValue] = useState("");
  const [draftRx, setDraftRx] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("workout_assignments")
      .select("*")
      .eq("client_id", clientId)
      .eq("date", date)
      .maybeSingle();
    setAssignment(data as Assignment | null);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, date]);

  useEffect(() => {
    load();
  }, [load]);

  function toggleTimer(index: number) {
    setOpenTimers((prev) => ({ ...prev, [index]: !prev[index] }));
  }

  async function toggleLike() {
    if (!assignment) return;
    const already = assignment.liked_by?.includes(profileId);
    const nextLiked = already
      ? assignment.liked_by.filter((id) => id !== profileId)
      : [...(assignment.liked_by || []), profileId];
    setAssignment({ ...assignment, liked_by: nextLiked });
    await supabase
      .from("workout_assignments")
      .update({ liked_by: nextLiked })
      .eq("id", assignment.id);
  }

  async function toggleCompleted() {
    if (!assignment) return;
    const nextCompleted = !assignment.completed;
    setAssignment({ ...assignment, completed: nextCompleted });
    await supabase
      .from("workout_assignments")
      .update({
        completed: nextCompleted,
        completed_at: nextCompleted ? new Date().toISOString() : null,
      })
      .eq("id", assignment.id);
  }

  function startEditScore(index: number) {
    const existing = assignment?.client_scores?.[String(index)];
    setDraftValue(existing?.value || "");
    setDraftRx(existing?.rx ?? true);
    setEditingIndex(index);
  }

  async function saveScore(index: number) {
    if (!assignment || draftValue.trim() === "") return;
    setSaving(true);
    const nextScores: ClientScores = {
      ...assignment.client_scores,
      [String(index)]: { value: draftValue.trim(), rx: draftRx },
    };
    setAssignment({ ...assignment, client_scores: nextScores });
    await supabase
      .from("workout_assignments")
      .update({ client_scores: nextScores })
      .eq("id", assignment.id);
    setSaving(false);
    setEditingIndex(null);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0c1210] text-gray-400 flex items-center justify-center">
        Caricamento…
      </div>
    );
  }

  const liked = !!assignment?.liked_by?.includes(profileId);
  const likeCount = assignment?.liked_by?.length || 0;

  return (
    <div className="min-h-screen bg-[#0c1210] text-white pb-28">
      <div className="p-4 space-y-4 max-w-xl mx-auto">
        <Link href="/cliente" className="text-gray-400 text-sm inline-block">
          ← Torna al calendario
        </Link>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 bg-white/10 text-gray-200 text-xs px-2.5 py-1 rounded-full">
            🌐 {trainerName}
          </span>
        </div>

        {!assignment ? (
          <div className="bg-white/5 rounded-2xl p-6 text-gray-400">
            <p className="text-lg font-semibold text-white mb-1">{dateLabel}</p>
            Giorno di riposo / nessuna scheda assegnata.
          </div>
        ) : (
          <>
            <div>
              <h1 className="text-3xl font-bold">{assignment.title}</h1>
              <p className="text-gray-400 text-sm mt-1">{dateLabel}</p>
            </div>

            <button
              onClick={toggleLike}
              className="w-full text-left rounded-2xl px-5 py-4 text-white font-medium flex items-center justify-between"
              style={{
                background: "linear-gradient(90deg, #3b82f6, #d946ef)",
              }}
            >
              <span>
                {likeCount > 0
                  ? `${liked ? "❤️ Ti piace" : "🤍"} · ${likeCount} reazion${likeCount === 1 ? "e" : "i"}`
                  : "Siate i primi a reagire!"}
              </span>
              <span className="flex items-center gap-2">
                <span className="w-9 h-9 rounded-full bg-black/30 flex items-center justify-center">
                  {liked ? "❤️" : "🤍"}
                </span>
                <Link
                  href="/cliente/chat"
                  onClick={(e) => e.stopPropagation()}
                  className="w-9 h-9 rounded-full bg-black/30 flex items-center justify-center"
                >
                  💬
                </Link>
              </span>
            </button>

            <Link
              href={`/cliente/tabellone/${date}`}
              className="block rounded-2xl px-5 py-4 font-semibold flex items-center justify-between"
              style={{
                background: "linear-gradient(90deg, #84cc16, #a3e635)",
                color: "#0c1210",
              }}
            >
              <span>
                Tabellone
                <span className="block text-sm font-normal opacity-80">
                  Controllare la classifica e confrontarsi con altri atleti
                </span>
              </span>
              <span className="w-9 h-9 rounded-full bg-black/20 flex items-center justify-center text-white">
                →
              </span>
            </Link>

            <p className="text-xs uppercase tracking-wide text-gray-500 pt-2">
              ({assignment.blocks.length}) blocchi
            </p>

            <div className="space-y-4">
              {assignment.blocks.map((b, i) => {
                const scoreEntry = assignment.client_scores?.[String(i)];
                const isEditing = editingIndex === i;
                return (
                  <div key={i} className="bg-white/5 rounded-2xl p-4 space-y-3">
                    <span className="inline-block bg-white/10 text-sm px-3 py-1 rounded-full">
                      {b.type}
                    </span>

                    <div className="flex items-center justify-between text-sm text-gray-400">
                      {b.timer ? (
                        <span>
                          ⏱ {TIMER_LABELS[b.timer.type]} · {b.timer.minutes}:
                          {String(b.timer.seconds).padStart(2, "0")}
                        </span>
                      ) : (
                        <span>⏱ Nessun cronometro</span>
                      )}
                      {b.timer && (
                        <button
                          onClick={() => toggleTimer(i)}
                          className="text-xs font-semibold px-3 py-1.5 rounded-full"
                          style={{ background: "#d4f547", color: "#0c1210" }}
                        >
                          {openTimers[i] ? "Nascondi" : "▶ Inizia"}
                        </button>
                      )}
                    </div>

                    {b.timer && openTimers[i] && (
                      <div className="text-gray-900">
                        <WorkoutTimer timer={b.timer} autoStart />
                      </div>
                    )}

                    <div
                      className="text-sm text-gray-200 [&_a]:text-lime-400 [&_a]:underline [&_ul]:list-disc [&_ul]:ml-5 [&_ol]:list-decimal [&_ol]:ml-5 [&_h1]:text-base [&_h1]:font-bold [&_h2]:text-sm [&_h2]:font-semibold"
                      dangerouslySetInnerHTML={{ __html: b.description }}
                    />

                    {b.rpe !== null && (
                      <span className="inline-block text-xs bg-white/10 rounded-full px-2 py-1">
                        RPE {b.rpe}
                      </span>
                    )}

                    {b.score && (
                      <div className="pt-2 border-t border-white/10">
                        <div className="flex items-center justify-between text-sm text-gray-400 mb-2">
                          <span>Punteggio</span>
                          <span>{scoreLabel(b.score.type)}</span>
                        </div>

                        {isEditing ? (
                          <div className="space-y-2">
                            <input
                              className="w-full bg-white/10 rounded-xl px-3 py-2 text-white placeholder-gray-500 focus:outline-none"
                              placeholder="es. 100 kg, 5 giri + 12 rep…"
                              value={draftValue}
                              onChange={(e) => setDraftValue(e.target.value)}
                            />
                            <div className="flex items-center gap-3 text-sm">
                              <label className="flex items-center gap-1">
                                <input
                                  type="radio"
                                  checked={draftRx}
                                  onChange={() => setDraftRx(true)}
                                />
                                RX
                              </label>
                              <label className="flex items-center gap-1">
                                <input
                                  type="radio"
                                  checked={!draftRx}
                                  onChange={() => setDraftRx(false)}
                                />
                                Scalato
                              </label>
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => saveScore(i)}
                                disabled={saving}
                                className="text-sm font-semibold px-4 py-2 rounded-full"
                                style={{ background: "#d4f547", color: "#0c1210" }}
                              >
                                Salva
                              </button>
                              <button
                                onClick={() => setEditingIndex(null)}
                                className="text-sm px-4 py-2 rounded-full bg-white/10"
                              >
                                Annulla
                              </button>
                            </div>
                          </div>
                        ) : scoreEntry ? (
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold px-2 py-1 rounded-full bg-white/10">
                              {scoreEntry.rx ? "RX" : "SC"}
                            </span>
                            <span className="font-semibold flex-1">{scoreEntry.value}</span>
                            <button
                              onClick={() => startEditScore(i)}
                              className="text-sm px-4 py-2 rounded-full bg-white/10"
                            >
                              Modificare il mio punteggio
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => startEditScore(i)}
                            className="w-full text-sm font-semibold px-4 py-3 rounded-full flex items-center justify-center gap-2"
                            style={{ background: "#d4f547", color: "#0c1210" }}
                          >
                            🏆 Inserire il mio punteggio
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {assignment && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-[#0c1210] via-[#0c1210] to-transparent">
          <button
            onClick={toggleCompleted}
            className="max-w-xl mx-auto w-full flex items-center justify-center gap-2 font-semibold rounded-full px-5 py-3.5"
            style={
              assignment.completed
                ? { background: "rgba(255,255,255,0.1)", color: "white" }
                : { background: "#d4f547", color: "#0c1210" }
            }
          >
            {assignment.completed ? "✓ Sessione completata" : "Convalida della sessione"}
          </button>
        </div>
      )}
    </div>
  );
}

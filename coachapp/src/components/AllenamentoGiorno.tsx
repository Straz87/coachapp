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
  const [prevScores, setPrevScores] = useState<ClientScores | null>(null);
  const [loading, setLoading] = useState(true);
  const [openBlocks, setOpenBlocks] = useState<Record<number, boolean>>({});
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

    // Punteggi della stessa scheda della settimana scorsa (solo come riferimento,
    // non tocca in alcun modo l'eventuale massimale dell'esercizio).
    const prevDate = toISODate(addDays(new Date(`${date}T00:00:00`), -7));
    const { data: prevData } = await supabase
      .from("workout_assignments")
      .select("client_scores")
      .eq("client_id", clientId)
      .eq("date", prevDate)
      .maybeSingle();
    setPrevScores((prevData?.client_scores as ClientScores | null) || null);

    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, date]);

  useEffect(() => {
    load();
  }, [load]);

  function isBlockOpen(index: number) {
    return openBlocks[index] ?? index === 0;
  }

  function toggleBlock(index: number) {
    setOpenBlocks((prev) => ({ ...prev, [index]: !isBlockOpen(index) }));
  }

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
    setOpenBlocks((prev) => ({ ...prev, [index]: true }));
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
      <div className="min-h-screen bg-gray-50 text-gray-400 flex items-center justify-center">
        Caricamento…
      </div>
    );
  }

  const liked = !!assignment?.liked_by?.includes(profileId);
  const likeCount = assignment?.liked_by?.length || 0;

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 pb-28">
      <div className="p-4 space-y-4 max-w-xl mx-auto">
        <Link href="/cliente" className="text-gray-500 text-sm inline-block">
          ← Torna al calendario
        </Link>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-600 text-xs px-2.5 py-1 rounded-full">
            🌐 {trainerName}
          </span>
        </div>

        {!assignment ? (
          <div className="card text-gray-500">
            <p className="text-lg font-semibold text-gray-900 mb-1">{dateLabel}</p>
            Giorno di riposo / nessuna scheda assegnata.
          </div>
        ) : (
          <>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{assignment.title}</h1>
              <p className="text-gray-500 text-sm mt-1">{dateLabel}</p>
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
                <span className="w-9 h-9 rounded-full bg-black/20 flex items-center justify-center">
                  {liked ? "❤️" : "🤍"}
                </span>
                <Link
                  href="/cliente/chat"
                  onClick={(e) => e.stopPropagation()}
                  className="w-9 h-9 rounded-full bg-black/20 flex items-center justify-center"
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
              <span className="w-9 h-9 rounded-full bg-black/10 flex items-center justify-center text-white">
                →
              </span>
            </Link>

            <p className="text-xs uppercase tracking-wide text-gray-400 pt-2">
              ({assignment.blocks.length}) blocchi · tocca per aprire
            </p>

            <div className="space-y-3">
              {assignment.blocks.map((b, i) => {
                const scoreEntry = assignment.client_scores?.[String(i)];
                const isEditing = editingIndex === i;
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
                            {scoreEntry.rx ? "RX" : "SC"} {scoreEntry.value}
                          </span>
                        )}
                      </span>
                      <span
                        className={`text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
                      >
                        ▾
                      </span>
                    </button>

                    {open && (
                      <div className="mt-3 space-y-3">
                        <div className="flex items-center justify-between text-sm text-gray-500">
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

                        {b.timer && openTimers[i] && <WorkoutTimer timer={b.timer} autoStart />}

                        <div
                          className="text-sm text-gray-600 [&_a]:text-brand-dark [&_a]:underline [&_ul]:list-disc [&_ul]:ml-5 [&_ol]:list-decimal [&_ol]:ml-5 [&_h1]:text-base [&_h1]:font-bold [&_h2]:text-sm [&_h2]:font-semibold"
                          dangerouslySetInnerHTML={{ __html: b.description }}
                        />

                        {b.rpe !== null && (
                          <span className="inline-block text-xs bg-gray-100 text-gray-700 rounded-full px-2 py-1">
                            RPE {b.rpe}
                          </span>
                        )}

                        {b.score && (
                          <div className="pt-2 border-t border-gray-100">
                            <div className="flex items-center justify-between text-sm text-gray-500 mb-2">
                              <span>Punteggio</span>
                              <span>{scoreLabel(b.score.type)}</span>
                            </div>

                            {prevScores?.[String(i)] && (
                              <div className="flex items-center gap-2 bg-brand/10 border border-brand/30 rounded-xl px-3 py-2 mb-2">
                                <span className="text-brand-dark">🕐</span>
                                <span className="text-sm text-gray-700">
                                  Settimana scorsa:{" "}
                                  <span className="font-semibold">
                                    {prevScores[String(i)].value} {prevScores[String(i)].rx ? "RX" : "SC"}
                                  </span>
                                </span>
                              </div>
                            )}

                            {isEditing ? (
                              <div className="space-y-2">
                                <input
                                  className="input"
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
                                    className="btn-primary text-sm"
                                  >
                                    Salva
                                  </button>
                                  <button
                                    onClick={() => setEditingIndex(null)}
                                    className="btn-secondary text-sm"
                                  >
                                    Annulla
                                  </button>
                                </div>
                              </div>
                            ) : scoreEntry ? (
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold px-2 py-1 rounded-full bg-gray-100 text-gray-700">
                                  {scoreEntry.rx ? "RX" : "SC"}
                                </span>
                                <span className="font-semibold flex-1">{scoreEntry.value}</span>
                                <button
                                  onClick={() => startEditScore(i)}
                                  className="btn-secondary text-sm"
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
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {assignment && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-gray-50 via-gray-50 to-transparent">
          <button
            onClick={toggleCompleted}
            className="max-w-xl mx-auto w-full flex items-center justify-center gap-2 font-semibold rounded-full px-5 py-3.5"
            style={
              assignment.completed
                ? { background: "#e5e7eb", color: "#374151" }
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

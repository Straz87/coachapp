"use client";

import { createElement as h, useCallback, useEffect, useState } from "react";
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
  formatAmrapValue,
  parseAmrapValue,
  getTimerSets,
  totalTimerSeconds,
  formatClock,
    htmlToLines,
} from "@/lib/workoutTypes";
import WorkoutTimer from "@/components/WorkoutTimer";
import { latestByExercise } from "@/lib/benchmarks";

// Rappresenta la scheda del giorno indipendentemente dal fatto che sia
// un allenamento individuale (workout_assignments) o un allenamento di
// gruppo/programma condiviso (group_workouts + group_workout_scores).
// Un allenamento individuale ha SEMPRE la precedenza su quello di gruppo.
type Source =
  | { kind: "individual"; assignmentId: string }
  | { kind: "group"; groupWorkoutId: string; groupId: string };

type ViewModel = {
  source: Source;
  title: string;
  blocks: Block[];
  completed: boolean;
  likedBy: string[];
  clientScores: ClientScores;
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
  const [vm, setVm] = useState<ViewModel | null>(null);
  const [prevScores, setPrevScores] = useState<ClientScores | null>(null);
  const [loading, setLoading] = useState(true);
  const [openBlocks, setOpenBlocks] = useState<Record<number, boolean>>({});
  const [openTimers, setOpenTimers] = useState<Record<number, boolean>>({});
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [draftValues, setDraftValues] = useState<string[]>([""]);
  const [draftRx, setDraftRx] = useState(true);
  const [saving, setSaving] = useState(false);
    const [maxes, setMaxes] = useState<{ exercise_name: string; value_kg: number; recorded_at: string }[]>([]);

  const load = useCallback(async () => {
    setLoading(true);

    // 1) Un allenamento individuale ha sempre la precedenza.
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

    // 2) Nessun allenamento individuale: controlla se il cliente segue un
    // gruppo con un allenamento condiviso per questo giorno.
    const { data: memberships } = await supabase
      .from("group_members")
      .select("group_id")
      .eq("client_id", clientId);

    const groupIds = (memberships || []).map((m) => m.group_id);

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

    // 3) Nessun allenamento individuale né di gruppo per oggi.
    setVm(null);
    setPrevScores(null);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, date]);

  useEffect(() => {
    load();
  }, [load]);

    useEffect(() => {
          async function loadMaxes() {
                  const { data } = await supabase
                    .from("client_maxes")
                    .select("exercise_name, value_kg, recorded_at")
                    .eq("client_id", clientId)
                    .not("value_kg", "is", null);
                  setMaxes(latestByExercise(data || []));
          }
          loadMaxes();
    }, [clientId]);

    function computeMaxLines(description: string) {
          if (maxes.length === 0) return [];
          const lines = htmlToLines(description);
          const results: { exerciseName: string; pct: number; kg: number }[] = [];
          for (const line of lines) {
                  const pctMatch = line.match(/(\d+(?:[.,]\d+)?)\s*%/);
                  if (!pctMatch) continue;
                  const pct = Number(pctMatch[1].replace(",", "."));
                  const lower = line.toLowerCase();
                  const max = maxes.find((m) => lower.includes(m.exercise_name.toLowerCase()));
                  if (!max) continue;
                  const raw = (max.value_kg * pct) / 100;
                  const kg = Math.round(raw * 2) / 2;
                  results.push({ exerciseName: max.exercise_name, pct, kg });
          }
          return results;
    }
  

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
    if (!vm) return;
    const already = vm.likedBy.includes(profileId);
    const nextLiked = already
      ? vm.likedBy.filter((id) => id !== profileId)
      : [...vm.likedBy, profileId];
    setVm({ ...vm, likedBy: nextLiked });

    if (vm.source.kind === "individual") {
      await supabase
        .from("workout_assignments")
        .update({ liked_by: nextLiked })
        .eq("id", vm.source.assignmentId);
    } else {
      await supabase
        .from("group_workouts")
        .update({ liked_by: nextLiked })
        .eq("id", vm.source.groupWorkoutId);
    }
  }

  async function toggleCompleted() {
    if (!vm) return;
    const nextCompleted = !vm.completed;
    setVm({ ...vm, completed: nextCompleted });

    if (vm.source.kind === "individual") {
      await supabase
        .from("workout_assignments")
        .update({
          completed: nextCompleted,
          completed_at: nextCompleted ? new Date().toISOString() : null,
        })
        .eq("id", vm.source.assignmentId);
    } else {
      await supabase.from("group_workout_scores").upsert(
        {
          group_workout_id: vm.source.groupWorkoutId,
          client_id: clientId,
          completed: nextCompleted,
          completed_at: nextCompleted ? new Date().toISOString() : null,
          client_scores: vm.clientScores,
        },
        { onConflict: "group_workout_id,client_id" }
      );
    }
  }

  function startEditScore(index: number) {
    const sets = Math.max(1, vm?.blocks[index]?.score?.sets ?? 1);
    const existing = normalizeEntry(vm?.clientScores?.[String(index)]);
    const values = Array.from({ length: sets }, (_, i) => existing?.values[i] || "");
    setDraftValues(values);
    setDraftRx(existing?.rx ?? true);
    setEditingIndex(index);
    setOpenBlocks((prev) => ({ ...prev, [index]: true }));
  }

  function updateDraftValue(setIndex: number, value: string) {
    setDraftValues((prev) => prev.map((v, i) => (i === setIndex ? value : v)));
  }

  // Chiamata quando il timer AMRAP finisce (o viene fermato): somma i giri
  // registrati con il tasto "+" durante ogni set e apre l'editor del
  // punteggio già precompilato, così l'atleta deve solo controllare/correggere.
  function applyTimerResult(index: number, roundsBySet: number[][]) {
    if (!vm) return;
    const block = vm.blocks[index];
    if (!block.score || block.score.type !== "amrap") return;
    const totalGiri = roundsBySet.reduce((sum, arr) => sum + arr.length, 0);
    if (totalGiri === 0) return;
    startEditScore(index);
    setDraftValues((prev) => {
      const next = [...prev];
      next[0] = formatAmrapValue(totalGiri, 0);
      return next;
    });
  }

  async function saveScore(index: number) {
    if (!vm || draftValues.some((v) => v.trim() === "")) return;
    setSaving(true);
    const nextScores: ClientScores = {
      ...vm.clientScores,
      [String(index)]: { values: draftValues.map((v) => v.trim()), rx: draftRx },
    };
    setVm({ ...vm, clientScores: nextScores });

    if (vm.source.kind === "individual") {
      await supabase
        .from("workout_assignments")
        .update({ client_scores: nextScores })
        .eq("id", vm.source.assignmentId);
    } else {
      await supabase.from("group_workout_scores").upsert(
        {
          group_workout_id: vm.source.groupWorkoutId,
          client_id: clientId,
          client_scores: nextScores,
          completed: vm.completed,
        },
        { onConflict: "group_workout_id,client_id" }
      );
    }
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

  const liked = !!vm?.likedBy.includes(profileId);
  const likeCount = vm?.likedBy.length || 0;
  const tabelloneHref =
    vm?.source.kind === "group"
      ? `/cliente/tabellone/${date}?g=${vm.source.groupWorkoutId}`
      : `/cliente/tabellone/${date}`;

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

        {!vm ? (
          <div className="card text-gray-500">
            <p className="text-lg font-semibold text-gray-900 mb-1">{dateLabel}</p>
            Giorno di riposo / nessuna scheda assegnata.
          </div>
        ) : (
          <>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{vm.title}</h1>
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
              href={tabelloneHref}
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
              ({vm.blocks.length}) blocchi · tocca per aprire
            </p>

            <div className="space-y-3">
              {vm.blocks.map((b, i) => {
                const scoreEntry = normalizeEntry(vm.clientScores?.[String(i)]);
                const isEditing = editingIndex === i;
                const open = isBlockOpen(i);
                const sets = Math.max(1, b.score?.sets ?? 1);
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
                              ⏱ {TIMER_LABELS[b.timer.type]} ·{" "}
                              {formatClock(totalTimerSeconds(getTimerSets(b.timer)))}
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
                          <WorkoutTimer
                            timer={b.timer}
                            autoStart
                            onComplete={(roundsBySet) => applyTimerResult(i, roundsBySet)}
                          />
                        )}

                        <div
                          className="text-sm text-gray-600 [&_a]:text-brand-dark [&_a]:underline [&_ul]:list-disc [&_ul]:ml-5 [&_ol]:list-decimal [&_ol]:ml-5 [&_h1]:text-base [&_h1]:font-bold [&_h2]:text-sm [&_h2]:font-semibold"
                          dangerouslySetInnerHTML={{ __html: b.description }}
                        />

                        {computeMaxLines(b.description).map((m, mi) =>
                                                  h(
                                                                                "div",
                                                    {
                                                                                    key: mi,
                                                                                    className: "flex items-center gap-2 bg-brand/10 border border-brand/30 rounded-xl px-3 py-2",
                                                    },
                                                                                h("span", { className: "text-brand-dark" }, "🔢"),
                                                                                h(
                                                                                                                "span",
                                                                                  { className: "text-sm text-gray-700" },
                                                                                                                m.exerciseName + " " + m.pct + "%: ",
                                                                                                                h("span", { className: "font-semibold" }, m.kg + " kg")
                                                                                                              )
                                                                              )
                                                                                    )}

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

                            {(() => {
                              const prevEntry = normalizeEntry(prevScores?.[String(i)]);
                              if (!prevEntry) return null;
                              return (
                                <div className="flex items-center gap-2 bg-brand/10 border border-brand/30 rounded-xl px-3 py-2 mb-2">
                                  <span className="text-brand-dark">🕐</span>
                                  <span className="text-sm text-gray-700">
                                    Settimana scorsa:{" "}
                                    <span className="font-semibold">
                                      {displayScoreValue(prevEntry, b.score?.aggregation)}{" "}
                                      {prevEntry.rx ? "RX" : "SC"}
                                    </span>
                                  </span>
                                </div>
                              );
                            })()}

                            {isEditing ? (
                              <div className="space-y-2">
                                {Array.from({ length: sets }).map((_, setIdx) => {
                                  if (b.score!.type === "amrap") {
                                    const { giri, reps } = parseAmrapValue(draftValues[setIdx] || "");
                                    return (
                                      <div key={setIdx} className="space-y-1">
                                        {sets > 1 && (
                                          <p className="text-xs text-gray-400">Serie {setIdx + 1}</p>
                                        )}
                                        <div className="grid grid-cols-2 gap-2">
                                          <div>
                                            <label className="text-xs text-gray-500">Giri</label>
                                            <input
                                              type="number"
                                              inputMode="numeric"
                                              min={0}
                                              className="input"
                                              value={giri || ""}
                                              onChange={(e) =>
                                                updateDraftValue(
                                                  setIdx,
                                                  formatAmrapValue(Number(e.target.value) || 0, reps)
                                                )
                                              }
                                            />
                                          </div>
                                          <div>
                                            <label className="text-xs text-gray-500">Reps supplementari</label>
                                            <input
                                              type="number"
                                              inputMode="numeric"
                                              min={0}
                                              className="input"
                                              value={reps || ""}
                                              onChange={(e) =>
                                                updateDraftValue(
                                                  setIdx,
                                                  formatAmrapValue(giri, Number(e.target.value) || 0)
                                                )
                                              }
                                            />
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  }
                                  return (
                                    <input
                                      key={setIdx}
                                      className="input"
                                      placeholder={
                                        sets > 1
                                          ? `Serie ${setIdx + 1}`
                                          : "es. 100 kg, 5 giri + 12 rep…"
                                      }
                                      value={draftValues[setIdx] || ""}
                                      onChange={(e) => updateDraftValue(setIdx, e.target.value)}
                                    />
                                  );
                                })}
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
                                <span className="font-semibold flex-1">
                                  {displayScoreValue(scoreEntry, b.score?.aggregation)}
                                </span>
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

      {vm && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-gray-50 via-gray-50 to-transparent">
          <button
            onClick={toggleCompleted}
            className="max-w-xl mx-auto w-full flex items-center justify-center gap-2 font-semibold rounded-full px-5 py-3.5"
            style={
              vm.completed
                ? { background: "#e5e7eb", color: "#374151" }
                : { background: "#d4f547", color: "#0c1210" }
            }
          >
            {vm.completed ? "✓ Sessione completata" : "Convalida della sessione"}
          </button>
        </div>
      )}
    </div>
  );
}

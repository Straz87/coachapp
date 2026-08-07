"use client";

import { useState } from "react";
import RichTextEditor from "@/components/RichTextEditor";
import WorkoutTimer from "@/components/WorkoutTimer";
import { WEEKDAY_LABELS } from "@/lib/dates";
import { IconEdit } from "@/components/icons";
import {
  BLOCK_TYPES,
  SCORE_TYPES,
  AGGREGATION_TYPES,
  TIMER_TYPES,
  TIMER_LABELS,
  ACTIVITY_TYPES,
  Block,
  emptyBlock,
  emptyScoreConfig,
  htmlToLines,
} from "@/lib/workoutTypes";

export type WorkoutDraft = {
  title: string;
  blocks: Block[];
  activityType?: string | null;
};

function formatDatePill(iso?: string): string | null {
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const label = WEEKDAY_LABELS[(date.getDay() + 6) % 7];
  return `${label} ${d}/${m}`;
}

function timerSummary(block: Block): string | null {
  if (!block.timer) return null;
  const t = block.timer;
  if (t.type === "EMOM") return `EMOM ${t.minutes}:${String(t.seconds).padStart(2, "0")}`;
  if (t.type === "AMRAP") {
    const rounds = t.rounds ?? 1;
    return rounds > 1
      ? `${rounds}x AMRAP ${t.minutes}:${String(t.seconds).padStart(2, "0")}`
      : `AMRAP ${t.minutes}:${String(t.seconds).padStart(2, "0")}`;
  }
  if (t.type === "TABATA") return `Tabata ${t.minutes}:${String(t.seconds).padStart(2, "0")}`;
  return `For Time ${t.minutes}:${String(t.seconds).padStart(2, "0")}`;
}

function blockPreview(block: Block): string {
  const lines = htmlToLines(block.description);
  return lines.join(" · ").slice(0, 90) || "Vuoto — tocca per compilare";
}

export default function WorkoutEditorPanel({
  initial,
  date,
  onCancel,
  onSave,
  onDelete,
  saving,
}: {
  initial: WorkoutDraft;
  date?: string;
  onCancel: () => void;
  onSave: (draft: WorkoutDraft) => void;
  onDelete?: () => void;
  saving?: boolean;
}) {
  const [title, setTitle] = useState(initial.title);
  const [activityType, setActivityType] = useState<string | null>(initial.activityType ?? null);
  const [blocks, setBlocks] = useState<Block[]>(
    initial.blocks.length > 0 ? initial.blocks : [emptyBlock()]
  );
  const [openBlocks, setOpenBlocks] = useState<Set<number>>(
    new Set(initial.blocks.length > 0 ? [] : [0])
  );

  function updateBlock(index: number, patch: Partial<Block>) {
    setBlocks((b) => b.map((blk, i) => (i === index ? { ...blk, ...patch } : blk)));
  }

  function addBlock(type?: string) {
    setBlocks((b) => {
      const next = [...b, type ? { ...emptyBlock(), type } : emptyBlock()];
      setOpenBlocks((s) => new Set(s).add(next.length - 1));
      return next;
    });
  }

  function removeBlock(index: number) {
    setBlocks((b) => b.filter((_, i) => i !== index));
    setOpenBlocks((s) => {
      const next = new Set<number>();
      s.forEach((i) => {
        if (i < index) next.add(i);
        else if (i > index) next.add(i - 1);
      });
      return next;
    });
  }

  function toggleBlock(index: number) {
    setOpenBlocks((s) => {
      const next = new Set(s);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  function handleSave() {
    const cleaned = blocks.filter((b) => b.description.trim() !== "");
    onSave({ title: title.trim() || "Allenamento", blocks: cleaned, activityType });
  }

  const datePill = formatDatePill(date);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[88vh] overflow-y-auto p-6 space-y-5">
        <div className="flex items-center gap-2 text-gray-400">
          <IconEdit className="w-4 h-4" />
          <p className="text-xs font-medium uppercase tracking-wide">Modifica la sessione</p>
        </div>

        <input
          className="w-full text-xl font-semibold border-none outline-none px-0 placeholder:text-gray-300"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="es. WOD, Giorno 1…"
        />

        <div className="flex flex-wrap gap-2">
          {datePill && (
            <span className="bg-gray-100 text-gray-600 rounded-full px-4 py-1.5 text-sm">
              {datePill}
            </span>
          )}
          {ACTIVITY_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setActivityType(activityType === t ? null : t)}
              className={
                activityType === t
                  ? "bg-brand text-brand-dark font-semibold rounded-full px-4 py-1.5 text-sm"
                  : "bg-gray-100 text-gray-700 rounded-full px-4 py-1.5 text-sm hover:bg-gray-200"
              }
            >
              {t}
            </button>
          ))}
        </div>

        <div className="space-y-2">
          {blocks.map((block, i) => (
            <BlockEditor
              key={i}
              block={block}
              open={openBlocks.has(i)}
              onToggle={() => toggleBlock(i)}
              onChange={(patch) => updateBlock(i, patch)}
              onRemove={() => removeBlock(i)}
            />
          ))}
        </div>

        <div className="flex gap-2">
          <button onClick={() => addBlock()} className="btn-secondary text-sm">
            + Aggiungi blocco
          </button>
          <button onClick={() => addBlock("Nota per l'atleta")} className="btn-secondary text-sm">
            + Nota per l&apos;atleta
          </button>
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-gray-100">
          <div className="flex gap-2">
            <button onClick={onCancel} className="btn-secondary">
              Annulla
            </button>
            {onDelete && (
              <button onClick={onDelete} className="text-red-600 text-sm px-3">
                Elimina scheda
              </button>
            )}
          </div>
          <button onClick={handleSave} disabled={saving} className="btn-primary">
            {saving ? "Salvataggio…" : "Salva"}
          </button>
        </div>
      </div>
    </div>
  );
}

function BlockEditor({
  block,
  open,
  onToggle,
  onChange,
  onRemove,
}: {
  block: Block;
  open: boolean;
  onToggle: () => void;
  onChange: (patch: Partial<Block>) => void;
  onRemove: () => void;
}) {
  const [showTimerPreview, setShowTimerPreview] = useState(false);
  const isNote = block.type === "Nota per l'atleta";
  const summary = timerSummary(block);

  if (!open) {
    return (
      <button
        type="button"
        onClick={onToggle}
        className={`w-full text-left border border-gray-200 rounded-xl px-4 py-3 flex items-center justify-between gap-3 ${
          isNote ? "bg-amber-50" : "bg-white hover:bg-gray-50"
        }`}
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span
              className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                isNote ? "bg-amber-100 text-amber-800" : "bg-gray-100 text-gray-700"
              }`}
            >
              {block.type}
            </span>
            {summary && (
              <span className="text-xs text-gray-500 flex items-center gap-1 shrink-0">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="w-3.5 h-3.5">
                  <circle cx="12" cy="12" r="8" />
                  <path d="M12 8v4l3 2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {summary}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400 truncate">{blockPreview(block)}</p>
        </div>
        <span className="text-gray-300 shrink-0">▾</span>
      </button>
    );
  }

  return (
    <div className="border border-gray-200 rounded-xl p-4 space-y-3 bg-gray-50/40">
      <div className="flex gap-2 items-center">
        <select
          className="input"
          value={block.type}
          onChange={(e) => onChange({ type: e.target.value })}
        >
          {BLOCK_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <button
          onClick={onToggle}
          className="text-gray-400 hover:text-gray-700 text-sm px-2 shrink-0"
          title="Comprimi"
        >
          ▴
        </button>
        <button
          onClick={onRemove}
          className="text-gray-400 hover:text-red-600 text-sm px-2 shrink-0"
          title="Rimuovi sezione"
        >
          ✕
        </button>
      </div>

      <RichTextEditor
        value={block.description}
        onChange={(html) => onChange({ description: html })}
        placeholder="Descrivi l'esercizio, le serie/ripetizioni, e incolla eventuali link a video…"
      />

      {/* RPE */}
      <ToggleSection
        label="Aggiungere un RPE"
        enabled={block.rpe !== null}
        onToggle={(on) => onChange({ rpe: on ? 5 : null })}
      >
        {block.rpe !== null && (
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={1}
              max={10}
              value={block.rpe}
              onChange={(e) => onChange({ rpe: Number(e.target.value) })}
              className="flex-1"
            />
            <span className="text-sm font-semibold w-6 text-center">{block.rpe}</span>
          </div>
        )}
      </ToggleSection>

      {/* Punteggio / Obiettivo */}
      <ToggleSection
        label="Chiedere un punteggio / obiettivo"
        enabled={block.score !== null}
        onToggle={(on) => onChange({ score: on ? emptyScoreConfig() : null })}
      >
        {block.score && (
          <div className="grid grid-cols-2 gap-2">
            <select
              className="input"
              value={block.score.type}
              onChange={(e) => onChange({ score: { ...block.score!, type: e.target.value } })}
            >
              {SCORE_TYPES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
            <input
              className="input"
              placeholder="Obiettivo (es. 100 kg, sub 5:00…)"
              value={block.score.target}
              onChange={(e) => onChange({ score: { ...block.score!, target: e.target.value } })}
            />
          </div>
        )}
        {block.score && (
          <div className="grid grid-cols-2 gap-2 mt-2">
            <div>
              <label className="text-xs text-gray-500">Numero di serie</label>
              <input
                type="number"
                min={1}
                max={10}
                className="input"
                value={block.score.sets ?? 1}
                onChange={(e) =>
                  onChange({
                    score: { ...block.score!, sets: Math.min(10, Math.max(1, Number(e.target.value) || 1)) },
                  })
                }
              />
            </div>
            <div>
              <label className="text-xs text-gray-500">Come combinare le serie</label>
              <select
                className="input"
                value={block.score.aggregation ?? "elenco"}
                onChange={(e) => onChange({ score: { ...block.score!, aggregation: e.target.value } })}
              >
                {AGGREGATION_TYPES.map((a) => (
                  <option key={a.value} value={a.value}>
                    {a.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
        {block.score && (
          <div className="mt-2">
            <input
              className="input"
              placeholder="Nome esercizio per la progressione (es. Back Squat) — opzionale"
              value={block.exerciseName || ""}
              onChange={(e) => onChange({ exerciseName: e.target.value.trim() || null })}
            />
            <p className="text-xs text-gray-400 mt-1">
              Se lo compili, i punteggi inseriti dal cliente in blocchi con lo stesso nome
              finiscono automaticamente nel grafico di progressione (pagina Progressi).
            </p>
          </div>
        )}
      </ToggleSection>

      {/* Timer */}
      <ToggleSection
        label="Aggiungere un timer"
        enabled={block.timer !== null}
        onToggle={(on) =>
          onChange({ timer: on ? { type: TIMER_TYPES[0], minutes: 10, seconds: 0 } : null })
        }
      >
        {block.timer && (
          <div className="space-y-2">
            <div className="grid grid-cols-3 gap-2 items-center">
              <select
                className="input"
                value={block.timer.type}
                onChange={(e) => onChange({ timer: { ...block.timer!, type: e.target.value } })}
              >
                {TIMER_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {TIMER_LABELS[t]}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min={0}
                className="input"
                value={block.timer.minutes}
                onChange={(e) =>
                  onChange({ timer: { ...block.timer!, minutes: Number(e.target.value) } })
                }
                placeholder={block.timer.type === "EMOM" ? "ogni (min)" : "min"}
              />
              <input
                type="number"
                min={0}
                max={59}
                className="input"
                value={block.timer.seconds}
                onChange={(e) =>
                  onChange({ timer: { ...block.timer!, seconds: Number(e.target.value) } })
                }
                placeholder="sec"
              />
            </div>
            {(block.timer.type === "EMOM" || block.timer.type === "AMRAP") && (
              <div className="grid grid-cols-2 gap-2 items-end">
                <div>
                  <label className="text-xs text-gray-500">Giri</label>
                  <input
                    type="number"
                    min={1}
                    className="input"
                    value={block.timer.rounds ?? 1}
                    onChange={(e) =>
                      onChange({
                        timer: {
                          ...block.timer!,
                          rounds: Math.max(1, Number(e.target.value) || 1),
                        },
                      })
                    }
                  />
                </div>
                {block.timer.type === "AMRAP" && (block.timer.rounds ?? 1) > 1 && (
                  <div>
                    <label className="text-xs text-gray-500">Riposo tra i giri</label>
                    <div className="flex gap-1">
                      <input
                        type="number"
                        min={0}
                        className="input"
                        placeholder="min"
                        value={block.timer.restMinutes ?? 0}
                        onChange={(e) =>
                          onChange({
                            timer: { ...block.timer!, restMinutes: Number(e.target.value) },
                          })
                        }
                      />
                      <input
                        type="number"
                        min={0}
                        max={59}
                        className="input"
                        placeholder="sec"
                        value={block.timer.restSeconds ?? 0}
                        onChange={(e) =>
                          onChange({
                            timer: { ...block.timer!, restSeconds: Number(e.target.value) },
                          })
                        }
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        {block.timer && (
          <button
            type="button"
            onClick={() => setShowTimerPreview((s) => !s)}
            className="text-xs text-brand-dark hover:underline mt-1"
          >
            {showTimerPreview ? "Nascondi anteprima timer" : "Prova il timer"}
          </button>
        )}
        {block.timer && showTimerPreview && <WorkoutTimer timer={block.timer} />}
      </ToggleSection>
    </div>
  );
}

function ToggleSection({
  label,
  enabled,
  onToggle,
  children,
}: {
  label: string;
  enabled: boolean;
  onToggle: (on: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
        <input type="checkbox" checked={enabled} onChange={(e) => onToggle(e.target.checked)} />
        {label}
      </label>
      {enabled && <div className="mt-2">{children}</div>}
    </div>
  );
}

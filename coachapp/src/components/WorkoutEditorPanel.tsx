"use client";

import { useState } from "react";
import RichTextEditor from "@/components/RichTextEditor";
import WorkoutTimer from "@/components/WorkoutTimer";
import {
  BLOCK_TYPES,
  SCORE_TYPES,
  TIMER_TYPES,
  TIMER_LABELS,
  Block,
  emptyBlock,
} from "@/lib/workoutTypes";

export type WorkoutDraft = {
  title: string;
  blocks: Block[];
};

export default function WorkoutEditorPanel({
  initial,
  onCancel,
  onSave,
  onDelete,
  saving,
}: {
  initial: WorkoutDraft;
  onCancel: () => void;
  onSave: (draft: WorkoutDraft) => void;
  onDelete?: () => void;
  saving?: boolean;
}) {
  const [title, setTitle] = useState(initial.title);
  const [blocks, setBlocks] = useState<Block[]>(
    initial.blocks.length > 0 ? initial.blocks : [emptyBlock()]
  );

  function updateBlock(index: number, patch: Partial<Block>) {
    setBlocks((b) => b.map((blk, i) => (i === index ? { ...blk, ...patch } : blk)));
  }

  function addBlock() {
    setBlocks((b) => [...b, emptyBlock()]);
  }

  function removeBlock(index: number) {
    setBlocks((b) => b.filter((_, i) => i !== index));
  }

  function handleSave() {
    const cleaned = blocks.filter((b) => b.description.trim() !== "");
    onSave({ title: title.trim() || "Allenamento", blocks: cleaned });
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[88vh] overflow-y-auto p-6 space-y-5">
        <h2 className="text-lg font-bold">Scheda del giorno</h2>

        <div>
          <label className="text-sm font-medium">Titolo</label>
          <input
            className="input mt-1"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="es. WOD, Giorno 1…"
          />
        </div>

        <div className="space-y-5">
          {blocks.map((block, i) => (
            <BlockEditor
              key={i}
              block={block}
              onChange={(patch) => updateBlock(i, patch)}
              onRemove={() => removeBlock(i)}
            />
          ))}
        </div>

        <button onClick={addBlock} className="btn-secondary text-sm">
          + Aggiungi sezione
        </button>

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
  onChange,
  onRemove,
}: {
  block: Block;
  onChange: (patch: Partial<Block>) => void;
  onRemove: () => void;
}) {
  const [showTimerPreview, setShowTimerPreview] = useState(false);

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
        onToggle={(on) => onChange({ score: on ? { type: SCORE_TYPES[0].value, target: "" } : null })}
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
              placeholder="min"
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

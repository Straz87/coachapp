"use client";

import { useState } from "react";

export type Block = { section: string; lines: string[] };

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
    initial.blocks.length > 0 ? initial.blocks : [{ section: "Warm up", lines: [""] }]
  );

  function updateSection(index: number, value: string) {
    setBlocks((b) => b.map((blk, i) => (i === index ? { ...blk, section: value } : blk)));
  }

  function updateLines(index: number, value: string) {
    setBlocks((b) =>
      b.map((blk, i) => (i === index ? { ...blk, lines: value.split("\n") } : blk))
    );
  }

  function addSection() {
    setBlocks((b) => [...b, { section: "Nuova sezione", lines: [""] }]);
  }

  function removeSection(index: number) {
    setBlocks((b) => b.filter((_, i) => i !== index));
  }

  function handleSave() {
    const cleanedBlocks = blocks
      .map((b) => ({ section: b.section.trim() || "Sezione", lines: b.lines.filter((l) => l.trim() !== "") }))
      .filter((b) => b.lines.length > 0);
    onSave({ title: title.trim() || "Allenamento", blocks: cleanedBlocks });
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto p-6 space-y-4">
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

        <div className="space-y-4">
          {blocks.map((block, i) => (
            <div key={i} className="border border-gray-100 rounded-xl p-3 space-y-2">
              <div className="flex gap-2 items-center">
                <input
                  className="input"
                  value={block.section}
                  onChange={(e) => updateSection(i, e.target.value)}
                  placeholder="es. Warm up, Skills, Strength…"
                />
                <button
                  onClick={() => removeSection(i)}
                  className="text-gray-400 hover:text-red-600 text-sm px-2"
                  title="Rimuovi sezione"
                >
                  ✕
                </button>
              </div>
              <textarea
                className="input"
                rows={4}
                value={block.lines.join("\n")}
                onChange={(e) => updateLines(i, e.target.value)}
                placeholder={"Un esercizio per riga\nes. 5x5 Back Squat @70%"}
              />
            </div>
          ))}
        </div>

        <button onClick={addSection} className="btn-secondary text-sm">
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

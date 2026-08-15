"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import WorkoutEditorPanel, { WorkoutDraft } from "@/components/WorkoutEditorPanel";
import { Block } from "@/lib/workoutTypes";

type ProgramDay = {
  dayNumber: number;
  title: string;
  blocks: Block[];
  activityType: string | null;
};

export default function ProgramDayEditor({
  programId,
  trainerId,
  lengthDays,
  initialDays,
}: {
  programId: string;
  trainerId: string;
  lengthDays: number;
  initialDays: ProgramDay[];
}) {
  const supabase = createClient();
  const [days, setDays] = useState<Record<number, ProgramDay>>(() => {
    const map: Record<number, ProgramDay> = {};
    initialDays.forEach((d) => {
      map[d.dayNumber] = d;
    });
    return map;
  });
  const [editingDay, setEditingDay] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSave(draft: WorkoutDraft) {
    if (!editingDay) return;
    setSaving(true);

    await supabase.from("program_days").upsert(
      {
        program_id: programId,
        trainer_id: trainerId,
        day_number: editingDay,
        title: draft.title,
        blocks: draft.blocks,
        activity_type: draft.activityType ?? null,
      },
      { onConflict: "program_id,day_number" }
    );

    setDays((d) => ({
      ...d,
      [editingDay]: {
        dayNumber: editingDay,
        title: draft.title,
        blocks: draft.blocks,
        activityType: draft.activityType ?? null,
      },
    }));
    setSaving(false);
    setEditingDay(null);
  }

  async function handleDelete() {
    if (!editingDay) return;
    await supabase.from("program_days").delete().eq("program_id", programId).eq("day_number", editingDay);
    setDays((d) => {
      const next = { ...d };
      delete next[editingDay];
      return next;
    });
    setEditingDay(null);
  }

  const dayNumbers = Array.from({ length: lengthDays }, (_, i) => i + 1);

  return (
    <div>
      <div className="space-y-2">
        {dayNumbers.map((n) => {
          const day = days[n];
          return (
            <button
              key={n}
              onClick={() => setEditingDay(n)}
              className="w-full flex items-center justify-between text-left card hover:bg-gray-50"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold">Giorno {n}</p>
                <p className="text-xs text-gray-400 truncate">
                  {day ? day.title : "Vuoto — tocca per compilare"}
                </p>
              </div>
              {day && (
                <span className="text-xs bg-brand/20 text-brand-dark rounded-full px-2 py-1 shrink-0">
                  {day.blocks.length} blocch{day.blocks.length === 1 ? "o" : "i"}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {editingDay && (
        <WorkoutEditorPanel
          initial={
            days[editingDay]
              ? {
                  title: days[editingDay].title,
                  blocks: days[editingDay].blocks,
                  activityType: days[editingDay].activityType,
                }
              : { title: `Giorno ${editingDay}`, blocks: [], activityType: null }
          }
          onCancel={() => setEditingDay(null)}
          onSave={handleSave}
          onDelete={days[editingDay] ? handleDelete : undefined}
          saving={saving}
        />
      )}
    </div>
  );
}

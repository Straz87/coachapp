"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { addDays, getWeekDays, startOfWeek } from "@/lib/dates";
import WorkoutEditorPanel, { WorkoutDraft } from "@/components/WorkoutEditorPanel";
import { Block } from "@/lib/workoutTypes";

type GroupWorkout = {
  id: string;
  date: string;
  title: string;
  blocks: Block[];
};

export default function GroupWeekCalendar({
  groupId,
  trainerId,
}: {
  groupId: string;
  trainerId: string;
}) {
  const supabase = createClient();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [workouts, setWorkouts] = useState<Record<string, GroupWorkout>>({});
  const [loading, setLoading] = useState(true);
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const days = getWeekDays(weekStart);

  const loadWeek = useCallback(async () => {
    setLoading(true);
    const from = days[0].iso;
    const to = days[6].iso;

    const { data } = await supabase
      .from("group_workouts")
      .select("id, date, title, blocks")
      .eq("group_id", groupId)
      .gte("date", from)
      .lte("date", to);

    const map: Record<string, GroupWorkout> = {};
    (data || []).forEach((w: GroupWorkout) => {
      map[w.date] = w;
    });
    setWorkouts(map);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId, weekStart]);

  useEffect(() => {
    loadWeek();
  }, [loadWeek]);

  async function handleSave(draft: WorkoutDraft) {
    if (!editingDate) return;
    setSaving(true);

    const existing = workouts[editingDate];

    if (existing) {
      await supabase
        .from("group_workouts")
        .update({ title: draft.title, blocks: draft.blocks })
        .eq("id", existing.id);
    } else {
      await supabase.from("group_workouts").insert({
        group_id: groupId,
        trainer_id: trainerId,
        date: editingDate,
        title: draft.title,
        blocks: draft.blocks,
      });
    }

    setSaving(false);
    setEditingDate(null);
    loadWeek();
  }

  async function handleDelete() {
    if (!editingDate) return;
    const existing = workouts[editingDate];
    if (existing) {
      await supabase.from("group_workouts").delete().eq("id", existing.id);
    }
    setEditingDate(null);
    loadWeek();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <button className="btn-secondary" onClick={() => setWeekStart(addDays(weekStart, -7))}>
          ← Settimana prec.
        </button>
        <span className="font-medium">
          {days[0].dayNumber}/{days[0].month} – {days[6].dayNumber}/{days[6].month}
        </span>
        <button className="btn-secondary" onClick={() => setWeekStart(addDays(weekStart, 7))}>
          Settimana succ. →
        </button>
      </div>

      {loading ? (
        <p className="text-gray-400 text-sm">Caricamento…</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {days.map((day) => {
            const w = workouts[day.iso];
            return (
              <div key={day.iso} className="card min-h-[160px] flex flex-col">
                <p className="text-xs text-gray-400 mb-2">
                  {day.label} {day.dayNumber}/{day.month}
                </p>
                {w ? (
                  <div className="flex-1 flex flex-col">
                    <p className="font-semibold text-sm mb-1">{w.title}</p>
                    <ul className="text-xs text-gray-500 space-y-0.5 flex-1">
                      {w.blocks.slice(0, 3).map((b, i) => (
                        <li key={i}>• {b.type}</li>
                      ))}
                    </ul>
                    <button
                      className="text-xs text-gray-500 hover:underline mt-2 text-left"
                      onClick={() => setEditingDate(day.iso)}
                    >
                      Modifica
                    </button>
                  </div>
                ) : (
                  <button
                    className="flex-1 flex items-center justify-center text-gray-300 hover:text-gray-500 text-2xl"
                    onClick={() => setEditingDate(day.iso)}
                  >
                    +
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {editingDate && (
        <WorkoutEditorPanel
          initial={
            workouts[editingDate]
              ? { title: workouts[editingDate].title, blocks: workouts[editingDate].blocks }
              : { title: "", blocks: [] }
          }
          onCancel={() => setEditingDate(null)}
          onSave={handleSave}
          onDelete={workouts[editingDate] ? handleDelete : undefined}
          saving={saving}
        />
      )}
    </div>
  );
}

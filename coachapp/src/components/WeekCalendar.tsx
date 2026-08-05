"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { addDays, getWeekDays, startOfWeek } from "@/lib/dates";
import WorkoutEditorPanel, { WorkoutDraft } from "@/components/WorkoutEditorPanel";

type Assignment = {
  id: string;
  date: string;
  title: string;
  blocks: { section: string; lines: string[] }[];
  completed: boolean;
};

export default function WeekCalendar({
  clientId,
  trainerId,
}: {
  clientId: string;
  trainerId: string;
}) {
  const supabase = createClient();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [assignments, setAssignments] = useState<Record<string, Assignment>>({});
  const [loading, setLoading] = useState(true);
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const days = getWeekDays(weekStart);

  const loadWeek = useCallback(async () => {
    setLoading(true);
    const from = days[0].iso;
    const to = days[6].iso;

    const { data } = await supabase
      .from("workout_assignments")
      .select("*")
      .eq("client_id", clientId)
      .gte("date", from)
      .lte("date", to);

    const map: Record<string, Assignment> = {};
    (data || []).forEach((a: Assignment) => {
      map[a.date] = a;
    });
    setAssignments(map);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, weekStart]);

  useEffect(() => {
    loadWeek();
  }, [loadWeek]);

  async function handleSave(draft: WorkoutDraft) {
    if (!editingDate) return;
    setSaving(true);

    const existing = assignments[editingDate];

    if (existing) {
      await supabase
        .from("workout_assignments")
        .update({ title: draft.title, blocks: draft.blocks })
        .eq("id", existing.id);
    } else {
      await supabase.from("workout_assignments").insert({
        client_id: clientId,
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
    const existing = assignments[editingDate];
    if (existing) {
      await supabase.from("workout_assignments").delete().eq("id", existing.id);
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
            const a = assignments[day.iso];
            return (
              <div key={day.iso} className="card min-h-[160px] flex flex-col">
                <p className="text-xs text-gray-400 mb-2">
                  {day.label} {day.dayNumber}/{day.month}
                </p>
                {a ? (
                  <div className="flex-1 flex flex-col">
                    <p className="font-semibold text-sm mb-1">{a.title}</p>
                    <ul className="text-xs text-gray-500 space-y-0.5 flex-1">
                      {a.blocks.slice(0, 3).map((b, i) => (
                        <li key={i}>• {b.section}</li>
                      ))}
                    </ul>
                    {a.completed && (
                      <span className="text-green-600 text-xs mt-1">✓ Completato dal cliente</span>
                    )}
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
            assignments[editingDate]
              ? { title: assignments[editingDate].title, blocks: assignments[editingDate].blocks }
              : { title: "", blocks: [] }
          }
          onCancel={() => setEditingDate(null)}
          onSave={handleSave}
          onDelete={assignments[editingDate] ? handleDelete : undefined}
          saving={saving}
        />
      )}
    </div>
  );
}

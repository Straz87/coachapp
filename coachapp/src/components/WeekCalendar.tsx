"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { addDays, getWeekDays, startOfWeek, toISODate } from "@/lib/dates";
import WorkoutEditorPanel, { WorkoutDraft } from "@/components/WorkoutEditorPanel";
import { Block, htmlToLines } from "@/lib/workoutTypes";

type Assignment = {
  id: string;
  date: string;
  title: string;
  blocks: Block[];
  completed: boolean;
  activity_type: string | null;
};

type DayInfo = { date: Date; iso: string; label: string; dayNumber: number; month: number };

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
        .update({ title: draft.title, blocks: draft.blocks, activity_type: draft.activityType ?? null })
        .eq("id", existing.id);
    } else {
      await supabase.from("workout_assignments").insert({
        client_id: clientId,
        trainer_id: trainerId,
        date: editingDate,
        title: draft.title,
        blocks: draft.blocks,
        activity_type: draft.activityType ?? null,
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

  // Copia l'allenamento di un giorno sulla stessa data della settimana successiva.
  async function copyDay(day: DayInfo) {
    const source = assignments[day.iso];
    if (!source) return;
    const targetDate = toISODate(addDays(day.date, 7));

    const { data: existingRows } = await supabase
      .from("workout_assignments")
      .select("id")
      .eq("client_id", clientId)
      .eq("date", targetDate)
      .limit(1);
    const existingTarget = existingRows && existingRows[0];

    const ok = window.confirm(
      existingTarget
        ? `Copiare questo giorno sul ${targetDate}? L'allenamento già presente in quella data verrà sovrascritto.`
        : `Copiare questo giorno sul ${targetDate}?`
    );
    if (!ok) return;

    if (existingTarget) {
      await supabase
        .from("workout_assignments")
        .update({ title: source.title, blocks: source.blocks, activity_type: source.activity_type })
        .eq("id", existingTarget.id);
    } else {
      await supabase.from("workout_assignments").insert({
        client_id: clientId,
        trainer_id: trainerId,
        date: targetDate,
        title: source.title,
        blocks: source.blocks,
        activity_type: source.activity_type,
      });
    }
    loadWeek();
  }

  // Copia tutti i giorni non vuoti di una settimana passata sulla settimana visualizzata
  // (stesso giorno della settimana). I giorni già pieni nella settimana visualizzata
  // vengono sovrascritti, dopo conferma.
  async function copyWeekFrom(offsetWeeks: number) {
    const sourceWeekStart = addDays(weekStart, -7 * offsetWeeks);
    const sourceDays = getWeekDays(sourceWeekStart);

    const { data: sourceRows } = await supabase
      .from("workout_assignments")
      .select("*")
      .eq("client_id", clientId)
      .gte("date", sourceDays[0].iso)
      .lte("date", sourceDays[6].iso);

    const bySourceDate: Record<string, Assignment> = {};
    (sourceRows || []).forEach((r: Assignment) => {
      bySourceDate[r.date] = r;
    });

    const pairs = sourceDays
      .map((sd, i) => {
        const source = bySourceDate[sd.iso];
        if (!source) return null;
        return { source, targetIso: days[i].iso, willOverwrite: !!assignments[days[i].iso] };
      })
      .filter(Boolean) as { source: Assignment; targetIso: string; willOverwrite: boolean }[];

    if (pairs.length === 0) {
      alert("Quella settimana non ha allenamenti da copiare.");
      return;
    }

    const overwriteCount = pairs.filter((p) => p.willOverwrite).length;
    const ok = window.confirm(
      `Copiare ${pairs.length} giorni sulla settimana visualizzata?` +
        (overwriteCount > 0
          ? ` ${overwriteCount} giorni già pieni in questa settimana verranno sovrascritti.`
          : "")
    );
    if (!ok) return;

    for (const p of pairs) {
      const existingTarget = assignments[p.targetIso];
      if (existingTarget) {
        await supabase
          .from("workout_assignments")
          .update({
            title: p.source.title,
            blocks: p.source.blocks,
            activity_type: p.source.activity_type,
          })
          .eq("id", existingTarget.id);
      } else {
        await supabase.from("workout_assignments").insert({
          client_id: clientId,
          trainer_id: trainerId,
          date: p.targetIso,
          title: p.source.title,
          blocks: p.source.blocks,
          activity_type: p.source.activity_type,
        });
      }
    }
    loadWeek();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <button className="btn-secondary" onClick={() => setWeekStart(addDays(weekStart, -7))}>
          ← Settimana prec.
        </button>
        <span className="font-medium">
          {days[0].dayNumber}/{days[0].month} – {days[6].dayNumber}/{days[6].month}
        </span>
        <div className="flex items-center gap-2">
          <select
            className="input text-sm w-auto"
            value=""
            onChange={(e) => {
              const v = e.target.value;
              if (v) copyWeekFrom(Number(v));
              e.target.value = "";
            }}
          >
            <option value="">Copia da settimana…</option>
            <option value="1">Settimana precedente</option>
            <option value="2">2 settimane fa</option>
            <option value="3">3 settimane fa</option>
            <option value="4">4 settimane fa</option>
          </select>
          <button className="btn-secondary" onClick={() => setWeekStart(addDays(weekStart, 7))}>
            Settimana succ. →
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-gray-400 text-sm">Caricamento…</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-4 lg:grid-cols-7 gap-3 items-start">
          {days.map((day) => {
            const a = assignments[day.iso];
            return (
              <div key={day.iso} className="card flex flex-col">
                <p className="text-xs text-gray-400 mb-2">
                  {day.label} {day.dayNumber}/{day.month}
                </p>
                {a ? (
                  <div className="flex-1 flex flex-col">
                    <p className="font-semibold text-sm mb-1">{a.title}</p>
                    {a.activity_type && (
                      <span className="inline-block self-start bg-brand/20 text-brand-dark text-[10px] font-semibold px-2 py-0.5 rounded-full mb-2">
                        {a.activity_type}
                      </span>
                    )}
                    <div className="space-y-2 flex-1">
                      {a.blocks.map((b, i) => (
                        <div key={i}>
                          <p className="text-xs font-medium text-gray-700">{b.type}</p>
                          {htmlToLines(b.description).map((line, li) => (
                            <p key={li} className="text-xs text-gray-500">
                              {line}
                            </p>
                          ))}
                        </div>
                      ))}
                    </div>
                    {a.completed && (
                      <span className="text-green-600 text-xs mt-2">✓ Completato dal cliente</span>
                    )}
                    <div className="flex items-center gap-3 mt-2">
                      <button
                        className="text-xs text-gray-500 hover:underline"
                        onClick={() => setEditingDate(day.iso)}
                      >
                        Modifica
                      </button>
                      <button className="text-xs text-gray-500 hover:underline" onClick={() => copyDay(day)}>
                        Copia →
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    className="flex-1 flex items-center justify-center text-gray-300 hover:text-gray-500 text-2xl py-6"
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
              ? {
                  title: assignments[editingDate].title,
                  blocks: assignments[editingDate].blocks,
                  activityType: assignments[editingDate].activity_type,
                }
              : { title: "", blocks: [], activityType: null }
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

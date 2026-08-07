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

type TemplateDay = {
  offset: number;
  title: string;
  blocks: Block[];
  activityType: string | null;
};

type WeekTemplate = {
  id: string;
  name: string;
  days: TemplateDay[];
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
  const [templates, setTemplates] = useState<WeekTemplate[]>([]);
  const [openMenu, setOpenMenu] = useState<"template" | "copy" | null>(null);
  const [banner, setBanner] = useState<string | null>(null);

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

  const loadTemplates = useCallback(async () => {
    const { data } = await supabase
      .from("week_templates")
      .select("id, name, days")
      .eq("trainer_id", trainerId)
      .order("created_at", { ascending: false });
    setTemplates((data || []) as WeekTemplate[]);
  }, [trainerId]);

  useEffect(() => {
    loadWeek();
  }, [loadWeek]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  function flashBanner(text: string) {
    setBanner(text);
    setTimeout(() => setBanner(null), 4000);
  }

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
    setOpenMenu(null);
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
    flashBanner(`Copiati ${pairs.length} giorni sulla settimana visualizzata.`);
    loadWeek();
  }

  // Salva la settimana visualizzata come modello riutilizzabile.
  async function saveWeekAsTemplate() {
    const name = window.prompt('Nome del modello (es. "Settimana forza 5x5")');
    if (!name || !name.trim()) return;

    const entries: TemplateDay[] = days
      .map((d, i) => {
        const a = assignments[d.iso];
        if (!a) return null;
        return { offset: i, title: a.title, blocks: a.blocks, activityType: a.activity_type };
      })
      .filter((e): e is TemplateDay => e !== null);

    if (entries.length === 0) {
      alert("Questa settimana non ha allenamenti da salvare come modello.");
      return;
    }

    await supabase.from("week_templates").insert({
      trainer_id: trainerId,
      name: name.trim(),
      days: entries,
    });
    setOpenMenu(null);
    flashBanner(`Modello "${name.trim()}" salvato.`);
    loadTemplates();
  }

  // Applica un modello salvato alla settimana visualizzata (stesso offset di giorno).
  async function applyTemplate(tpl: WeekTemplate) {
    const ok = window.confirm(
      `Applicare il modello "${tpl.name}" a questa settimana? I giorni già pieni verranno sovrascritti.`
    );
    if (!ok) return;

    for (const entry of tpl.days) {
      const targetIso = days[entry.offset]?.iso;
      if (!targetIso) continue;
      const existingTarget = assignments[targetIso];
      if (existingTarget) {
        await supabase
          .from("workout_assignments")
          .update({ title: entry.title, blocks: entry.blocks, activity_type: entry.activityType })
          .eq("id", existingTarget.id);
      } else {
        await supabase.from("workout_assignments").insert({
          client_id: clientId,
          trainer_id: trainerId,
          date: targetIso,
          title: entry.title,
          blocks: entry.blocks,
          activity_type: entry.activityType,
        });
      }
    }
    setOpenMenu(null);
    flashBanner(`Modello "${tpl.name}" applicato a questa settimana.`);
    loadWeek();
  }

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_1.7fr] gap-3 mb-3">
        <div className="bg-brand-dark rounded-2xl px-5 py-4 text-white flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-xs font-semibold shrink-0">
            {days[0].dayNumber}
          </div>
          <div>
            <p className="font-semibold text-sm">Piano settimanale</p>
            <p className="text-xs text-white/60">
              {days[0].dayNumber}/{days[0].month} – {days[6].dayNumber}/{days[6].month}
            </p>
          </div>
        </div>

        <div className="bg-gray-100 rounded-2xl px-5 py-4">
          <div className="flex items-center gap-2 mb-3">
            <button
              className="text-gray-500 hover:text-gray-800 text-sm"
              onClick={() => setWeekStart(addDays(weekStart, -7))}
            >
              ← Prec.
            </button>
            <span className="flex-1 text-center text-sm font-medium">
              {days[0].dayNumber}/{days[0].month} – {days[6].dayNumber}/{days[6].month}
            </span>
            <button
              className="text-gray-500 hover:text-gray-800 text-sm"
              onClick={() => setWeekStart(addDays(weekStart, 7))}
            >
              Succ. →
            </button>
          </div>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <button
                onClick={() => setOpenMenu(openMenu === "template" ? null : "template")}
                className="w-full bg-white rounded-full px-3 py-2 text-xs text-gray-700 hover:bg-gray-50"
              >
                Modello di settimana ▾
              </button>
              {openMenu === "template" && (
                <div className="absolute z-10 mt-1 w-60 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden text-left">
                  {templates.length === 0 && (
                    <p className="px-4 py-3 text-xs text-gray-400">Nessun modello salvato</p>
                  )}
                  {templates.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => applyTemplate(t)}
                      className="w-full text-left px-4 py-2.5 text-xs hover:bg-gray-50 border-b border-gray-100"
                    >
                      {t.name}
                    </button>
                  ))}
                  <button
                    onClick={saveWeekAsTemplate}
                    className="w-full text-left px-4 py-2.5 text-xs text-brand-dark bg-brand/10 hover:bg-brand/20 font-medium"
                  >
                    + Salva questa settimana come modello
                  </button>
                </div>
              )}
            </div>
            <div className="relative flex-1">
              <button
                onClick={() => setOpenMenu(openMenu === "copy" ? null : "copy")}
                className="w-full bg-white rounded-full px-3 py-2 text-xs text-gray-700 hover:bg-gray-50"
              >
                Settimana della copia ▾
              </button>
              {openMenu === "copy" && (
                <div className="absolute z-10 mt-1 w-52 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden text-left">
                  {[1, 2, 3, 4].map((n) => (
                    <button
                      key={n}
                      onClick={() => copyWeekFrom(n)}
                      className="w-full text-left px-4 py-2.5 text-xs hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                    >
                      {n === 1 ? "Settimana precedente" : `${n} settimane fa`}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {banner && (
        <div className="bg-green-50 text-green-800 text-xs rounded-xl px-4 py-2.5 mb-3">✓ {banner}</div>
      )}

      {loading ? (
        <p className="text-gray-400 text-sm">Caricamento…</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-4 lg:grid-cols-7 border-t border-gray-200 rounded-xl overflow-hidden">
          {days.map((day, i) => {
            const a = assignments[day.iso];
            return (
              <div
                key={day.iso}
                className={`px-3 pb-3 min-h-[180px] ${i < 6 ? "sm:border-r border-gray-200" : ""}`}
              >
                <p className="text-xs font-medium text-gray-500 bg-gray-100 -mx-3 px-3 py-2 mb-2">
                  {day.label} {day.dayNumber}/{day.month}
                </p>
                {a ? (
                  <div>
                    {a.activity_type && (
                      <span className="inline-block bg-brand/30 text-brand-dark text-[10px] font-semibold px-2 py-1 rounded mb-2">
                        {a.activity_type}
                      </span>
                    )}
                    <p className="font-semibold text-sm mb-1">{a.title}</p>
                    <div className="space-y-2">
                      {a.blocks.map((b, bi) => {
                        const isNote = b.type === "Nota per l'atleta";
                        return (
                          <div key={bi} className={isNote ? "bg-amber-50 rounded px-2 py-1.5" : ""}>
                            <p
                              className={`text-xs font-medium ${
                                isNote ? "text-amber-800" : "text-gray-700"
                              }`}
                            >
                              {b.type}
                            </p>
                            {htmlToLines(b.description).map((line, li) => (
                              <p
                                key={li}
                                className={`text-xs ${isNote ? "text-amber-700" : "text-gray-500"}`}
                              >
                                {line}
                              </p>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                    {a.completed && (
                      <span className="text-green-600 text-xs mt-2 block">✓ Completato dal cliente</span>
                    )}
                    <div className="flex items-center gap-3 mt-2">
                      <button
                        className="text-xs text-gray-400 hover:text-gray-700"
                        onClick={() => setEditingDate(day.iso)}
                      >
                        Modifica
                      </button>
                      <button className="text-xs text-gray-400 hover:text-gray-700" onClick={() => copyDay(day)}>
                        Copia →
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    className="w-full h-24 flex items-center justify-center text-gray-300 hover:text-gray-500 text-2xl"
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

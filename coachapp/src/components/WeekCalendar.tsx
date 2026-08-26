"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { addDays, getWeekDays, startOfWeek, toISODate } from "@/lib/dates";
import WorkoutEditorPanel, { WorkoutDraft } from "@/components/WorkoutEditorPanel";
import { Block, htmlToLines } from "@/lib/workoutTypes";
import {
  IconLibrary,
  IconEdit,
  IconInfinity,
  IconGrid,
  IconList,
  IconChat,
  IconShare,
  IconSettings,
  IconCopy,
  IconTrash,
} from "@/components/icons";

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

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function WeekCalendar({
  clientId,
  trainerId,
  clientName = "Cliente",
  trainerName = "Coach",
  initialDate,
}: {
  clientId: string;
  trainerId: string;
  clientName?: string;
  trainerName?: string;
  initialDate?: string | null;
}) {
  const supabase = createClient();
  const [weekStart, setWeekStart] = useState(() =>
    startOfWeek(initialDate ? new Date(`${initialDate}T00:00:00`) : new Date())
  );
  const [assignments, setAssignments] = useState<Record<string, Assignment>>({});
  const [loading, setLoading] = useState(true);
  const [editingDate, setEditingDate] = useState<string | null>(initialDate || null);
  const [saving, setSaving] = useState(false);
  const [templates, setTemplates] = useState<WeekTemplate[]>([]);
  const [openMenu, setOpenMenu] = useState<"template" | "copy" | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [libraryTab, setLibraryTab] = useState<"programmi" | "templates">("programmi");
  const [dayMenuOpen, setDayMenuOpen] = useState<string | null>(null);
  const [clipboard, setClipboard] = useState<{
    title: string;
    blocks: Block[];
    activityType: string | null;
  } | null>(null);
    const [showTemplatePrompt, setShowTemplatePrompt] = useState(false);
    const [templateNameDraft, setTemplateNameDraft] = useState("");

  const days = getWeekDays(weekStart);
  const todayIso = toISODate(new Date());

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

  // Copia la sessione di un giorno in una "clipboard" in memoria: da qui puoi incollarla
  // su un giorno vuoto qualsiasi, anche di un'altra settimana, aprendo semplicemente il "+".
  function copySessionToClipboard(a: Assignment) {
    setClipboard({ title: a.title, blocks: a.blocks, activityType: a.activity_type });
    setDayMenuOpen(null);
    flashBanner("Sessione copiata. Apri un giorno vuoto e premi + per incollarla.");
  }

  // Elimina direttamente la scheda di un giorno senza dover aprire l'editor.
  async function deleteDay(day: DayInfo) {
    const a = assignments[day.iso];
    if (!a) return;
    const ok = window.confirm(`Eliminare la scheda del ${day.dayNumber}/${day.month}?`);
    if (!ok) return;
    await supabase.from("workout_assignments").delete().eq("id", a.id);
    setDayMenuOpen(null);
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
    // Apre il modale per il nome del modello, dopo aver controllato che ci
  // sia almeno un giorno compilato da salvare.
  function openSaveAsTemplate() {
    const hasContent = days.some((d) => !!assignments[d.iso]);
    if (!hasContent) {
      alert("Questa settimana non ha allenamenti da salvare come modello.");
      return;
    }
    setTemplateNameDraft("");
    setShowTemplatePrompt(true);
  }

  // Salva la settimana visualizzata come modello riutilizzabile.
  async function saveWeekAsTemplate(name: string) {
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

  function goToday() {
    setWeekStart(startOfWeek(new Date()));
  }

  function openNewSession() {
    const target = days.find((d) => d.iso === todayIso)?.iso || days[0].iso;
    setEditingDate(target);
  }

  return (
    <div>
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.25fr_1fr] gap-3 mb-3">
        <div className="bg-[#F1F0EA] rounded-2xl p-5 flex flex-col items-center text-center">
          <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center mb-2 text-gray-700">
            <IconLibrary className="w-5 h-5" />
          </div>
          <p className="text-lg font-semibold mb-3">Library</p>
          <div className="flex gap-2 w-full">
            <button
              onClick={() => setLibraryTab("programmi")}
              className={`flex-1 rounded-full px-3 py-2 text-xs font-medium ${
                libraryTab === "programmi" ? "bg-brand text-brand-dark" : "bg-white text-gray-600"
              }`}
            >
              Programmi
            </button>
            <button
              onClick={() => setLibraryTab("templates")}
              className={`flex-1 rounded-full px-3 py-2 text-xs font-medium ${
                libraryTab === "templates" ? "bg-brand text-brand-dark" : "bg-white text-gray-600"
              }`}
            >
              Templates
            </button>
          </div>
          <div className="flex items-center gap-2 w-full mt-3">
            <button
              onClick={goToday}
              className="bg-white rounded-full px-3 py-2 text-xs text-gray-700 hover:bg-gray-50"
            >
              Oggi
            </button>
            <button
              className="text-gray-500 hover:text-gray-800 text-sm"
              onClick={() => setWeekStart(addDays(weekStart, -7))}
            >
              ←
            </button>
            <span className="flex-1 text-center text-xs font-medium text-gray-600">
              {days[0].dayNumber}/{days[0].month} – {days[6].dayNumber}/{days[6].month}
            </span>
            <button
              className="text-gray-500 hover:text-gray-800 text-sm"
              onClick={() => setWeekStart(addDays(weekStart, 7))}
            >
              →
            </button>
            <IconGrid className="w-4 h-4 text-gray-300" />
            <IconList className="w-4 h-4 text-gray-700" />
          </div>
        </div>

        <div className="bg-[#15171D] rounded-2xl p-5 text-white flex flex-col justify-between">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <IconInfinity className="w-5 h-5" />
                <p className="text-xl font-semibold">{clientName}</p>
              </div>
              <p className="text-xs text-white/50">Scheda individuale</p>
            </div>
            <div className="flex items-center gap-2 pl-4 border-l border-white/10 text-right">
              <div>
                <p className="text-sm font-semibold">{trainerName}</p>
                <p className="text-xs text-white/50">Coach</p>
              </div>
              <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-xs font-semibold shrink-0">
                {initials(trainerName)}
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between mt-4">
            <Link href="/trainer/calendario" className="text-xs text-white/60 hover:text-white underline">
              ← Torna ai clienti
            </Link>
            <div className="flex items-center gap-2">
              <button className="w-8 h-8 rounded-full bg-white/90 flex items-center justify-center text-gray-700 hover:bg-white">
                <IconChat className="w-4 h-4" />
              </button>
              <button className="w-8 h-8 rounded-full bg-white/90 flex items-center justify-center text-gray-700 hover:bg-white">
                <IconShare className="w-4 h-4" />
              </button>
              <button className="w-8 h-8 rounded-full bg-brand flex items-center justify-center text-brand-dark">
                <IconSettings className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        <div className="bg-[#F1F0EA] rounded-2xl p-5 flex flex-col items-center text-center">
          <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center mb-2 text-gray-700">
            <IconEdit className="w-5 h-5" />
          </div>
          <p className="text-lg font-semibold mb-3">Action</p>
          {clipboard && (
            <div className="w-full flex items-center justify-between bg-brand/10 text-brand-dark text-[11px] rounded-full px-3 py-1.5 mb-2">
              <span className="truncate">Sessione copiata, pronta da incollare</span>
              <button
                onClick={() => setClipboard(null)}
                className="ml-2 shrink-0 hover:text-brand-dark/70"
                title="Svuota"
              >
                ✕
              </button>
            </div>
          )}
          <button
            onClick={openNewSession}
            className="w-full bg-brand text-brand-dark rounded-full px-3 py-2.5 text-sm font-medium mb-2"
          >
            + Sessione
          </button>
          <div className="flex gap-2 w-full">
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
                    onClick={openSaveAsTemplate}
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
        <div className="rounded-xl overflow-hidden">
                  <div className="hidden sm:grid sm:grid-cols-4 lg:grid-cols-7 bg-[#E9E8E1]">
            {days.map((day, i) => (
              <div
                key={day.iso}
                                    className={`px-3 py-2.5 text-sm font-semibold text-gray-800 ${
                  i < 6 ? "sm:border-r border-gray-300/60" : ""
                }`}
              >
                {day.label} {day.dayNumber}/{day.month}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-4 lg:grid-cols-7 border border-t-0 border-gray-200">
            {days.map((day, i) => {
              const a = assignments[day.iso];
              const isToday = day.iso === todayIso;
              return (
                <div
                  key={day.iso}
                  className={`px-3 py-3 min-h-[180px] ${i < 6 ? "sm:border-r border-gray-200" : ""} ${
                    isToday ? "bg-brand/10" : ""
                  }`}
                >
                  <p className="font-semibold text-sm mb-2 sm:hidden">{day.label} {day.dayNumber}/{day.month}</p>
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
                      <div className="relative mt-2">
                        <button
                          className="text-gray-400 hover:text-gray-700 text-lg leading-none px-1"
                          onClick={() => setDayMenuOpen(dayMenuOpen === day.iso ? null : day.iso)}
                        >
                          ⋯
                        </button>
                        {dayMenuOpen === day.iso && (
                          <div className="absolute z-20 bottom-full mb-1 w-48 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden text-left">
                            <button
                              onClick={() => {
                                setEditingDate(day.iso);
                                setDayMenuOpen(null);
                              }}
                              className="w-full flex items-center gap-2 text-left px-3 py-2.5 text-xs hover:bg-gray-50 border-b border-gray-100"
                            >
                              <IconEdit className="w-3.5 h-3.5 text-gray-500" />
                              Modifica
                            </button>
                            <button
                              onClick={() => copySessionToClipboard(a)}
                              className="w-full flex items-center gap-2 text-left px-3 py-2.5 text-xs hover:bg-gray-50 border-b border-gray-100"
                            >
                              <IconCopy className="w-3.5 h-3.5 text-gray-500" />
                              Copia sessione
                            </button>
                            <button
                              onClick={() => deleteDay(day)}
                              className="w-full flex items-center gap-2 text-left px-3 py-2.5 text-xs text-red-600 hover:bg-red-50"
                            >
                              <IconTrash className="w-3.5 h-3.5" />
                              Elimina scheda
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <button
                      className="w-full h-24 flex flex-col items-center justify-center text-gray-300 hover:text-gray-500"
                      onClick={() => setEditingDate(day.iso)}
                    >
                      <span className="text-2xl">+</span>
                      {clipboard && (
                        <span className="text-[10px] text-brand-dark font-medium mt-1">Incolla sessione</span>
                      )}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {editingDate && (
        <WorkoutEditorPanel
          date={editingDate}
          initial={
            assignments[editingDate]
              ? {
                  title: assignments[editingDate].title,
                  blocks: assignments[editingDate].blocks,
                  activityType: assignments[editingDate].activity_type,
                }
              : clipboard
              ? { title: clipboard.title, blocks: clipboard.blocks, activityType: clipboard.activityType }
              : { title: "", blocks: [], activityType: null }
          }
          onCancel={() => setEditingDate(null)}
          onSave={handleSave}
          onDelete={assignments[editingDate] ? handleDelete : undefined}
          saving={saving}
        />
      )}

      {showTemplatePrompt && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5 space-y-4">
            <p className="text-sm font-semibold text-gray-900">Nome del modello</p>
            <input
              autoFocus
              className="input w-full"
              placeholder='es. "Settimana forza 5x5"'
              value={templateNameDraft}
              onChange={(e) => setTemplateNameDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const name = templateNameDraft;
                  setShowTemplatePrompt(false);
                  saveWeekAsTemplate(name);
                }
              }}
            />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowTemplatePrompt(false)} className="btn-secondary text-sm">
                Annulla
              </button>
              <button
                type="button"
                onClick={() => {
                  const name = templateNameDraft;
                  setShowTemplatePrompt(false);
                  saveWeekAsTemplate(name);
                }}
                className="btn-primary text-sm"
              >
                Salva
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

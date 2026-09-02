"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  BENCHMARK_CATEGORIES,
  MaxRow,
  formatSecondsToTime,
  parseTimeToSeconds,
  latestByExercise,
} from "@/lib/benchmarks";

// Popup facoltativo che compare una sola volta sulla home del cliente per
// invitarlo a inserire i suoi massimali/riferimenti prestativi (pesistica,
// ginnastica, endurance). Non blocca nulla: si può chiudere subito con
// "Più tardi" e non ricompare più. Usa lo stesso flag benchmarks_onboarded
// già sfruttato dalla pagina /cliente/massimali?onboarding=1, quindi non
// interferisce con quel flusso: se il cliente lo ha già visto in un modo o
// nell'altro, il popup resta chiuso per sempre. Chi salta può comunque
// tornarci quando vuole dalla sezione Massimali nel menu.
export default function MaxesOnboardingPopup({ clientId }: { clientId: string }) {
  const supabase = createClient();
  const [visible, setVisible] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [initialValues, setInitialValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const allNames = BENCHMARK_CATEGORIES.flatMap((c) => c.exercises);

  useEffect(() => {
    let isMounted = true;
    async function load() {
      const { data: client } = await supabase
        .from("clients")
        .select("benchmarks_onboarded")
        .eq("id", clientId)
        .maybeSingle();

      if (!isMounted) return;
      if (client?.benchmarks_onboarded) return;

      const { data } = await supabase
        .from("client_maxes")
        .select("id, exercise_name, value_kg, time_seconds, reps, recorded_at")
        .eq("client_id", clientId)
        .in("exercise_name", allNames);
      const latest = latestByExercise((data as MaxRow[]) || []);
      const nextValues: Record<string, string> = {};
      latest.forEach((r) => {
        if (r.time_seconds != null) nextValues[r.exercise_name] = formatSecondsToTime(r.time_seconds);
        else if (r.value_kg != null) nextValues[r.exercise_name] = String(r.value_kg);
        else if (r.reps != null) nextValues[r.exercise_name] = String(r.reps);
      });
      if (!isMounted) return;
      setValues(nextValues);
      setInitialValues(nextValues);
      setVisible(true);
    }
    load();
    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  function updateValue(name: string, v: string) {
    setValues((prev) => ({ ...prev, [name]: v }));
  }

  async function markOnboarded() {
    try {
      await fetch("/api/cliente/massimali/onboarded", { method: "POST" });
    } catch (e) {}
  }

  async function handleSave() {
    setSaving(true);
    for (const category of BENCHMARK_CATEGORIES) {
      for (const name of category.exercises) {
        const raw = (values[name] || "").trim();
        if (!raw) continue;
        if (initialValues[name] === raw) continue;
        let value_kg: number | null = null;
        let time_seconds: number | null = null;
        let reps: number | null = null;
        if (category.valueType === "time") {
          time_seconds = parseTimeToSeconds(raw);
          if (time_seconds == null) continue;
        } else if (category.valueType === "weight_kg") {
          const n = Number(raw.replace(",", "."));
          if (!n) continue;
          value_kg = n;
        } else {
          const n = Number(raw);
          if (!n) continue;
          reps = n;
        }
        await supabase.from("client_maxes").insert({
          client_id: clientId,
          exercise_name: name,
          category: category.key,
          value_kg,
          time_seconds,
          reps,
        });
      }
    }
    setSaving(false);
    await markOnboarded();
    setVisible(false);
  }

  async function handleSkip() {
    await markOnboarded();
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl flex flex-col max-h-[85vh]">
        <div className="p-5 pb-3 border-b border-gray-100 shrink-0">
          <h2 className="font-semibold">Registra i tuoi massimali</h2>
          <p className="text-xs text-gray-400 mt-1">
            Facoltativo: inserisci solo quello che conosci già, il resto puoi farlo quando vuoi dalla sezione Massimali.
          </p>
        </div>

        <div className="p-5 py-3 overflow-y-auto space-y-5">
          {BENCHMARK_CATEGORIES.map((category) => (
            <div key={category.key} className="space-y-2">
              <h3 className="text-sm font-semibold text-gray-700">{category.label}</h3>
              <div className="space-y-2">
                {category.exercises.map((name) => (
                  <div key={name} className="flex items-center gap-3">
                    <label className="text-sm text-gray-600 flex-1">{name}</label>
                    <input
                      className="input w-28"
                      placeholder={
                        category.valueType === "time" ? "mm:ss" : category.valueType === "weight_kg" ? "kg" : "reps"
                      }
                      value={values[name] || ""}
                      onChange={(e) => updateValue(name, e.target.value)}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="p-5 pt-3 border-t border-gray-100 flex gap-2 shrink-0">
          <button onClick={handleSkip} className="btn-secondary flex-1">
            Più tardi
          </button>
          <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">
            {saving ? "Salvataggio…" : "Salva"}
          </button>
        </div>
      </div>
    </div>
  );
}

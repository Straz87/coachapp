"use client";

import { createElement as h, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
    BENCHMARK_CATEGORIES,
    formatSecondsToTime,
    parseTimeToSeconds,
} from "@/lib/benchmarks";

type Row = {
    id: string;
    exercise_name: string;
    value_kg: number | null;
    time_seconds: number | null;
    reps: number | null;
};

export default function BenchmarkForm({
    clientId,
    onboarding,
}: {
    clientId: string;
    onboarding?: boolean;
}) {
    const supabase = createClient();
    const [values, setValues] = useState<Record<string, string>>({});
    const [existingIds, setExistingIds] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

  const allNames = BENCHMARK_CATEGORIES.flatMap((c) => c.exercises);

  useEffect(() => {
        async function load() {
                setLoading(true);
                const { data } = await supabase
                  .from("client_maxes")
                  .select("id, exercise_name, value_kg, time_seconds, reps")
                  .eq("client_id", clientId)
                  .in("exercise_name", allNames);
                const nextValues: Record<string, string> = {};
                const nextIds: Record<string, string> = {};
                ((data as Row[] | null) || []).forEach((r) => {
                          nextIds[r.exercise_name] = r.id;
                          if (r.time_seconds != null) nextValues[r.exercise_name] = formatSecondsToTime(r.time_seconds);
                          else if (r.value_kg != null) nextValues[r.exercise_name] = String(r.value_kg);
                          else if (r.reps != null) nextValues[r.exercise_name] = String(r.reps);
                });
                setValues(nextValues);
                setExistingIds(nextIds);
                setLoading(false);
        }
        load();
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
      const existingId = existingIds[name];
      if (!raw) {
        if (existingId) {
          await supabase.from("client_maxes").delete().eq("id", existingId);
        }
        continue;
      }
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
      await supabase.from("client_maxes").upsert(
        {
          client_id: clientId,
          exercise_name: name,
          category: category.key,
          value_kg,
          time_seconds,
          reps,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "client_id,exercise_name" }
        );
    }
  }
  setSaving(false);
  if (onboarding) {
    await markOnboarded();
    window.location.href = "/cliente";
  }
}

async function handleSkip() {
  await markOnboarded();
  window.location.href = "/cliente";
}

if (loading) {
  return h("p", { className: "text-gray-400 text-sm" }, "Caricamento…");
}

const sections = BENCHMARK_CATEGORIES.map((category) =>
  h(
    "div",
    { key: category.key, className: "space-y-2" },
    h("h3", { className: "text-sm font-semibold text-gray-700" }, category.label),
    h(
      "div",
      { className: "space-y-2" },
      category.exercises.map((name) =>
        h(
          "div",
          { key: name, className: "flex items-center gap-3" },
          h("label", { className: "text-sm text-gray-600 flex-1" }, name),
          h("input", {
            className: "input w-32",
            placeholder:
              category.valueType === "time"
            ? "mm:ss"
              : category.valueType === "weight_kg"
            ? "kg"
              : "reps",
            value: values[name] || "",
            onChange: (e: any) => updateValue(name, e.target.value),
          })
          )
                             )
      )
    )
                                          );

return h(
  "div",
  { className: "card space-y-5" },
  h("h2", { className: "font-semibold" }, "Riferimenti prestativi personali"),
  h(
    "p",
    { className: "text-xs text-gray-400" },
    "Facoltativo: inserisci solo i valori che conosci gia, lascia vuoti gli altri. Torneranno utili per la programmazione futura."
    ),
  sections,
  h(
    "div",
    { className: "flex gap-2 pt-2" },
    h(
      "button",
      { onClick: handleSave, disabled: saving, className: "btn-primary" },
      saving ? "Salvataggio…" : "Salva"
      ),
    onboarding
    ? h(
      "button",
      { onClick: handleSkip, className: "btn-secondary" },
      "Salta per ora"
      )
    : null
    )
  );
}

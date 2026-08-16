"use client";

import { createElement as h, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
    MaxRow,
    latestByExercise,
    historyForExercise,
    formatMaxValue,
    parseTimeToSeconds,
} from "@/lib/benchmarks";

type ValueType = "time" | "reps";

export default function CategoryMaxes({
    clientId,
    categoryKey,
    label,
    valueType,
}: {
    clientId: string;
    categoryKey: string;
    label: string;
    valueType: ValueType;
}) {
    const supabase = createClient();
    const [rows, setRows] = useState<MaxRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [name, setName] = useState("");
    const [value, setValue] = useState("");
    const [saving, setSaving] = useState(false);
    const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  async function load() {
        setLoading(true);
        const { data } = await supabase
          .from("client_maxes")
          .select("id, exercise_name, value_kg, time_seconds, reps, recorded_at")
          .eq("client_id", clientId)
          .eq("category", categoryKey);
        setRows((data as MaxRow[]) || []);
        setLoading(false);
  }

  useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, categoryKey]);

  function hasValue(r: MaxRow) {
        return valueType === "time" ? r.time_seconds != null : r.reps != null;
  }

  const current = latestByExercise(rows)
      .filter(hasValue)
      .sort((a, b) => a.exercise_name.localeCompare(b.exercise_name));

  function toggleHistory(key: string) {
        setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  const bodyContent = loading
      ? h("p", { className: "text-gray-400 text-sm" }, "Caricamento…")
        : current.length === 0
      ? h("p", { className: "text-gray-400 text-sm" }, "Nessuna voce salvata.")
        : h(
                  "ul",
          { className: "divide-y divide-gray-100" },
                  current.map((r) => {
                              const key = r.exercise_name.trim().toLowerCase();
                              const history = historyForExercise(rows, r.exercise_name).filter(hasValue);
                              const hasHistory = history.length > 1;
                              return h(
                                            "li",
                                { key: r.id, className: "py-2 text-sm" },
                                            h(
                                                            "div",
                                              { className: "flex items-center justify-between" },
                                                            h(
                                                                              "span",
                                                              { className: "flex items-center gap-2" },
                                                                              h("span", null, r.exercise_name),
                                                                              hasHistory
                                                                                ? h(
                                                                                                        "button",
                                                                                  {
                                                                                                            onClick: () => toggleHistory(key),
                                                                                                            className: "text-xs text-brand-dark underline",
                                                                                    },
                                                                                                        expanded[key] ? "Nascondi storico" : "Storico"
                                                                                                      )
                                                                                : null
                                                                            ),
                                                            h(
                                                                              "span",
                                                              { className: "flex items-center gap-3" },
                                                                              h("span", { className: "font-semibold" }, formatMaxValue(r)),
                                                                              h(
                                                                                                  "button",
                                                                                { onClick: () => handleDelete(r.id), className: "text-gray-400 hover:text-red-600" },
                                                                                                  "Elimina"
                                                                                                )
                                                                            )
                                                          ),
                                            expanded[key]
                                              ? h(
                                                                  "ul",
                                                { className: "mt-2 ml-3 space-y-1 border-l border-gray-100 pl-3" },
                                                                  history.map((hrow) =>
                                                                                        h(
                                                                                                                "li",
                                                                                          { key: hrow.id, className: "flex items-center justify-between text-xs text-gray-500" },
                                                                                                                h("span", null, new Date(hrow.recorded_at).toLocaleDateString("it-IT")),
                                                                                                                h("span", null, formatMaxValue(hrow))
                                                                                                              )
                                                                                                )
                                                                )
                                              : null
                                          );
                  })
                );

  async function handleAdd() {
        const trimmedName = name.trim();
        if (!trimmedName || !value.trim()) return;
        const key = trimmedName.toLowerCase();
        const existing = current.find((r) => r.exercise_name.trim().toLowerCase() === key);

      const insertData: any = {
              client_id: clientId,
              exercise_name: trimmedName,
              category: categoryKey,
      };

      if (valueType === "time") {
              const seconds = parseTimeToSeconds(value);
              if (seconds == null) return;
              if (existing && existing.time_seconds === seconds) {
                        setName("");
                        setValue("");
                        return;
              }
              insertData.time_seconds = seconds;
      } else {
              const reps = parseInt(value, 10);
              if (!reps) return;
              if (existing && existing.reps === reps) {
                        setName("");
                        setValue("");
                        return;
              }
              insertData.reps = reps;
      }

      setSaving(true);
        await supabase.from("client_maxes").insert(insertData);
        setName("");
        setValue("");
        setSaving(false);
        load();
  }

  async function handleDelete(id: string) {
        await supabase.from("client_maxes").delete().eq("id", id);
        load();
  }

  return h(
        "div",
    { className: "card space-y-3" },
        h("h2", { className: "font-semibold" }, label),
        bodyContent,
        h(
                "div",
          { className: "flex flex-col sm:flex-row gap-2" },
                h("input", {
                          className: "input flex-1",
                          placeholder: valueType === "time" ? "Es. 5 km Row" : "Es. Pull-Up",
                          value: name,
                          onChange: (e: any) => setName(e.target.value),
                }),
                h("input", {
                          className: "input sm:w-28",
                          placeholder: valueType === "time" ? "mm:ss" : "reps",
                          value: value,
                          onChange: (e: any) => setValue(e.target.value),
                }),
                h(
                          "button",
                  { onClick: handleAdd, disabled: saving, className: "btn-primary shrink-0" },
                          "+ Salva"
                        )
              )
      );
}

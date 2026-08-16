"use client";

import { createElement as h, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type MaxRow = { id: string; exercise_name: string; value_kg: number };

export default function ClientMaxes({ clientId }: { clientId: string }) {
    const supabase = createClient();
    const [rows, setRows] = useState<MaxRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [name, setName] = useState("");
    const [value, setValue] = useState("");
    const [saving, setSaving] = useState(false);

  async function load() {
        setLoading(true);
        const { data } = await supabase
          .from("client_maxes")
          .select("id, exercise_name, value_kg")
          .eq("client_id", clientId)
          .order("exercise_name", { ascending: true });
        setRows(data || []);
        setLoading(false);
  }

  useEffect(() => {
        load();
  }, [clientId]);

  async function handleAdd() {
        const trimmedName = name.trim();
        const numValue = Number(value);
        if (!trimmedName || !numValue) return;
        setSaving(true);
        await supabase
          .from("client_maxes")
          .upsert(
            { client_id: clientId, exercise_name: trimmedName, value_kg: numValue, updated_at: new Date().toISOString() },
            { onConflict: "client_id,exercise_name" }
                  );
        setName("");
        setValue("");
        setSaving(false);
        load();
  }

  async function handleDelete(id: string) {
        await supabase.from("client_maxes").delete().eq("id", id);
        load();
  }

  const bodyContent = loading
      ? h("p", { className: "text-gray-400 text-sm" }, "Caricamento…")
        : rows.length === 0
      ? h("p", { className: "text-gray-400 text-sm" }, "Nessun massimale salvato.")
        : h(
                  "ul",
          { className: "divide-y divide-gray-100" },
                  rows.map((r) =>
                              h(
                                            "li",
                                { key: r.id, className: "py-2 flex items-center justify-between text-sm" },
                                            h("span", null, r.exercise_name),
                                            h(
                                                            "span",
                                              { className: "flex items-center gap-3" },
                                                            h("span", { className: "font-semibold" }, r.value_kg + " kg"),
                                                            h(
                                                                              "button",
                                                              { onClick: () => handleDelete(r.id), className: "text-gray-400 hover:text-red-600" },
                                                                              "Elimina"
                                                                            )
                                                          )
                                          )
                                   )
                );

  return h(
        "div",
    { className: "card space-y-3" },
        h("h2", { className: "font-semibold" }, "Massimali (1RM)"),
        h(
                "p",
          { className: "text-xs text-gray-400" },
                "Salva qui i tuoi massimali. Quando il trainer scrive una percentuale es. 80% accanto al nome di un esercizio nella scheda, vedrai subito il peso calcolato."
              ),
        bodyContent,
        h(
                "div",
          { className: "flex flex-col sm:flex-row gap-2" },
                h("input", {
                          className: "input flex-1",
                          placeholder: "Es. Back Squat",
                          value: name,
                          onChange: (e: any) => setName(e.target.value),
                }),
                h("input", {
                          type: "number",
                          className: "input sm:w-28",
                          placeholder: "kg",
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

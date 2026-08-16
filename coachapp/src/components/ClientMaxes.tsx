"use client";

import { createElement as h, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
    MaxRow,
    latestByExercise,
    historyForExercise,
    formatMaxValue,
} from "@/lib/benchmarks";

export default function ClientMaxes({ clientId }: { clientId: string }) {
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
    .eq("client_id", clientId);
    setRows((data as MaxRow[]) || []);
    setLoading(false);
}

useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
}, [clientId]);

const current = latestByExercise(rows)
    .filter((r) => r.value_kg != null)
    .sort((a, b) => a.exercise_name.localeCompare(b.exercise_name));

function toggleHistory(key: string) {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
}

const bodyContent = loading
    ? h("p", { className: "text-gray-400 text-sm" }, "Caricamento…")
    : current.length === 0
    ? h("p", { className: "text-gray-400 text-sm" }, "Nessun massimale salvato.")
    : h(
        "ul",
        { className: "divide-y divide-gray-100" },
        current.map((r) => {
            const key = r.exercise_name.trim().toLowerCase();
            const history = historyForExercise(rows, r.exercise_name).filter((row) => row.value_kg != null);
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
    const numValue = Number(value.replace(",", "."));
    if (!trimmedName || !numValue) return;
    const key = trimmedName.toLowerCase();
    const existing = current.find((r) => r.exercise_name.trim().toLowerCase() === key);
    if (existing && Number(existing.value_kg) === numValue) {
        setName("");
        setValue("");
        return;
    }
    setSaving(true);
    await supabase.from("client_maxes").insert({
        client_id: clientId,
        exercise_name: trimmedName,
        value_kg: numValue,
    });
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
    h("h2", { className: "font-semibold" }, "Massimali (1RM)"),
    h(
        "p",
        { className: "text-xs text-gray-400" },
        "Salva qui i tuoi massimali. Quando il trainer scrive una percentuale es. 80% accanto al nome di un esercizio nella scheda, vedrai subito il peso calcolato. Ogni aggiornamento resta in storico."
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

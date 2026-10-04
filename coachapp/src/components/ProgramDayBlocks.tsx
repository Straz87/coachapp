"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Block,
  ClientScores,
  clientScoreKey,
  getBlockScores,
  htmlToLines,
  readClientScoreEntry,
  scoreLabel,
} from "@/lib/workoutTypes";

// Blocchi del giorno di un programma a durata fissa, con il campo dove il
// cliente registra il carico (peso in kg di default su tutti i blocchi di
// lavoro; niente su Warm up, Skills, Mobility, ecc. — vedi getBlockScores).
// I valori si salvano da soli quando il cliente esce dal campo, nella
// tabella program_day_scores (stesso formato client_scores delle schede).
export default function ProgramDayBlocks({
  programId,
  clientId,
  dayNumber,
  blocks,
}: {
  programId: string;
  clientId: string;
  dayNumber: number;
  blocks: Block[];
}) {
  const supabase = createClient();
  const [scores, setScores] = useState<ClientScores>({});
  const scoresRef = useRef<ClientScores>({});
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase
        .from("program_day_scores")
        .select("client_scores")
        .eq("program_id", programId)
        .eq("client_id", clientId)
        .eq("day_number", dayNumber)
        .maybeSingle();
      if (!active) return;
      const loaded = ((data as any)?.client_scores as ClientScores | null) || {};
      scoresRef.current = loaded;
      setScores(loaded);
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [programId, clientId, dayNumber]);

  function setValue(blockIndex: number, scoreIndex: number, setIndex: number, sets: number, value: string) {
    const key = clientScoreKey(blockIndex, scoreIndex);
    const existing = readClientScoreEntry(scoresRef.current, blockIndex, scoreIndex);
    const values = Array.from({ length: sets }, (_, i) => existing?.values[i] ?? "");
    values[setIndex] = value;
    const next: ClientScores = { ...scoresRef.current, [key]: { values, rx: existing?.rx ?? true } };
    scoresRef.current = next;
    setScores(next);
    setStatus("idle");
  }

  async function save() {
    setStatus("saving");
    const { error } = await supabase.from("program_day_scores").upsert(
      {
        program_id: programId,
        client_id: clientId,
        day_number: dayNumber,
        client_scores: scoresRef.current,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "program_id,client_id,day_number" }
    );
    setStatus(error ? "error" : "saved");
  }

  return (
    <div className="space-y-3">
      {blocks.map((b, i) => {
        const blockScores = getBlockScores(b);
        return (
          <div key={i} className="card">
            <p className="text-xs font-medium text-gray-700 mb-1">{b.type}</p>
            {htmlToLines(b.description).map((line, li) => (
              <p key={li} className="text-sm text-gray-600">
                {line}
              </p>
            ))}
            {blockScores.map((score, si) => {
              const sets = Math.max(1, score.sets ?? 1);
              const entry = readClientScoreEntry(scores, i, si);
              return (
                <div key={si} className="mt-3 pt-3 border-t border-gray-100">
                  <p className="text-xs font-medium text-gray-500 mb-2">
                    {scoreLabel(score.type)}
                    {score.target ? ` · obiettivo ${score.target}` : ""}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {Array.from({ length: sets }, (_, setIndex) => (
                      <label key={setIndex} className="flex items-center gap-1 text-xs text-gray-400">
                        {sets > 1 ? <span>S{setIndex + 1}</span> : null}
                        <input
                          type="text"
                          inputMode="decimal"
                          placeholder="—"
                          value={entry?.values[setIndex] ?? ""}
                          onChange={(e) => setValue(i, si, setIndex, sets, e.target.value)}
                          onBlur={save}
                          className="w-20 rounded-lg border border-gray-200 px-2 py-1.5 text-sm text-gray-900 text-center"
                        />
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
      {status !== "idle" && (
        <p className={`text-xs ${status === "error" ? "text-red-500" : "text-gray-400"}`}>
          {status === "saving" ? "Salvataggio…" : status === "saved" ? "✓ Carichi salvati" : "Errore nel salvataggio, riprova"}
        </p>
      )}
    </div>
  );
}

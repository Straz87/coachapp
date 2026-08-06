"use client";

import { useCallback, useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { createClient } from "@/lib/supabase/client";
import { Block, ClientScores, parseScoreNumber } from "@/lib/workoutTypes";

type AssignmentRow = {
  date: string;
  blocks: Block[];
  client_scores: ClientScores;
};

type Point = { date: string; value: number; raw: string; rx: boolean };

// Traccia SOLO lo storico dei pesi di lavoro inseriti dal cliente nelle schede
// settimanali (es. "Back Squat 100kg" -> "105kg" la settimana dopo).
// Non è e non sostituisce un eventuale massimale/1RM: è solo l'andamento
// dei carichi realmente usati negli allenamenti assegnati.
export default function ExerciseProgress({ clientId }: { clientId: string }) {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [series, setSeries] = useState<Record<string, Point[]>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("workout_assignments")
      .select("date, blocks, client_scores")
      .eq("client_id", clientId)
      .order("date", { ascending: true });

    const grouped: Record<string, Point[]> = {};
    ((data as AssignmentRow[]) || []).forEach((a) => {
      (a.blocks || []).forEach((b, i) => {
        const name = b.exerciseName?.trim();
        if (!name) return;
        const entry = a.client_scores?.[String(i)];
        if (!entry) return;
        const value = parseScoreNumber(entry.value);
        if (value === null) return;
        if (!grouped[name]) grouped[name] = [];
        grouped[name].push({ date: a.date, value, raw: entry.value, rx: entry.rx });
      });
    });
    setSeries(grouped);
    setLoading(false);
  }, [clientId]);

  useEffect(() => {
    load();
  }, [load]);

  const names = Object.keys(series);

  if (loading) {
    return <p className="text-gray-400 text-sm">Caricamento…</p>;
  }

  if (names.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {names.map((name) => {
        const points = series[name];
        const last = points[points.length - 1];
        const prev = points.length > 1 ? points[points.length - 2] : null;
        const diff = prev ? Math.round((last.value - prev.value) * 10) / 10 : null;
        const chartData = points.map((p) => ({
          ...p,
          dateLabel: new Date(`${p.date}T00:00:00`).toLocaleDateString("it-IT", {
            day: "2-digit",
            month: "2-digit",
          }),
        }));

        return (
          <div key={name} className="card">
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-semibold">{name}</h3>
              <span className="text-sm font-semibold">
                {last.raw} {last.rx ? "RX" : "SC"}
              </span>
            </div>
            {diff !== null && diff !== 0 && (
              <p className={`text-xs mb-2 ${diff > 0 ? "text-green-600" : "text-red-500"}`}>
                {diff > 0 ? "+" : ""}
                {diff} rispetto alla volta precedente
              </p>
            )}
            {points.length < 2 ? (
              <p className="text-gray-400 text-xs">Servono almeno due registrazioni per vedere l&apos;andamento.</p>
            ) : (
              <ResponsiveContainer width="100%" height={140}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                  <XAxis dataKey="dateLabel" fontSize={11} />
                  <YAxis fontSize={11} domain={["auto", "auto"]} />
                  <Tooltip />
                  <Line type="monotone" dataKey="value" stroke="#639922" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        );
      })}
    </div>
  );
}

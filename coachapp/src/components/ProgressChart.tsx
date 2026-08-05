"use client";

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

export default function ProgressChart({
  data,
}: {
  data: { date: string; weight_kg: number | null }[];
}) {
  const chartData = data
    .filter((d) => d.weight_kg !== null)
    .map((d) => ({ ...d, date: new Date(d.date).toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit" }) }));

  if (chartData.length === 0) {
    return <p className="text-gray-400 text-sm">Nessun dato di peso ancora registrato.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
        <XAxis dataKey="date" fontSize={12} />
        <YAxis fontSize={12} domain={["auto", "auto"]} />
        <Tooltip />
        <Line type="monotone" dataKey="weight_kg" stroke="#0F1216" strokeWidth={2} dot={{ r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

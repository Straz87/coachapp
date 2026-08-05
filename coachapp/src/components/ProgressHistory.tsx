"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import ProgressChart from "@/components/ProgressChart";
import ProgressForm from "@/components/ProgressForm";

type Log = { id: string; date: string; weight_kg: number | null; note: string | null; photo_url: string | null };

export default function ProgressHistory({ clientId }: { clientId: string }) {
  const supabase = createClient();
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("progress_logs")
      .select("*")
      .eq("client_id", clientId)
      .order("date", { ascending: true });
    setLogs(data || []);
    setLoading(false);
  }, [clientId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-6">
      <ProgressForm clientId={clientId} onSaved={load} />

      <div className="card">
        <h2 className="font-semibold mb-3">Andamento peso</h2>
        {loading ? <p className="text-gray-400 text-sm">Caricamento…</p> : <ProgressChart data={logs} />}
      </div>

      <div className="card">
        <h2 className="font-semibold mb-3">Storico</h2>
        {logs.length === 0 ? (
          <p className="text-gray-400 text-sm">Nessuna registrazione ancora.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {[...logs].reverse().map((l) => (
              <li key={l.id} className="py-3 flex items-start gap-3 text-sm">
                {l.photo_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={l.photo_url} alt="progresso" className="w-14 h-14 rounded-lg object-cover" />
                )}
                <div>
                  <p className="font-medium">
                    {new Date(l.date).toLocaleDateString("it-IT")} {l.weight_kg ? `· ${l.weight_kg} kg` : ""}
                  </p>
                  {l.note && <p className="text-gray-500">{l.note}</p>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

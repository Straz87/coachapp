"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

export type ClientRow = {
  id: string;
  status: "attivo" | "in_scadenza" | "scaduto" | "sospeso";
  price: number | null;
  expiry_date: string | null;
  profiles: { full_name: string; email: string } | null;
};

const STATUS_LABEL: Record<string, string> = {
  attivo: "Attivo",
  in_scadenza: "In scadenza",
  scaduto: "Scaduto",
  sospeso: "Sospeso",
};

export default function ClientList({ clients }: { clients: ClientRow[] }) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("tutti");

  const filtered = useMemo(() => {
    return clients.filter((c) => {
      const name = c.profiles?.full_name?.toLowerCase() || "";
      const matchesQuery = name.includes(query.toLowerCase());
      const matchesStatus = statusFilter === "tutti" || c.status === statusFilter;
      return matchesQuery && matchesStatus;
    });
  }, [clients, query, statusFilter]);

  return (
    <div>
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <input
          className="input sm:max-w-xs"
          placeholder="Cerca cliente…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          className="input sm:max-w-[200px]"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="tutti">Tutti gli stati</option>
          <option value="attivo">Attivo</option>
          <option value="in_scadenza">In scadenza</option>
          <option value="scaduto">Scaduto</option>
          <option value="sospeso">Sospeso</option>
        </select>
      </div>

      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-left">
            <tr>
              <th className="px-5 py-3 font-medium">Cliente</th>
              <th className="px-5 py-3 font-medium">Stato</th>
              <th className="px-5 py-3 font-medium">Prezzo</th>
              <th className="px-5 py-3 font-medium">Scadenza</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.id} className="border-t border-gray-100 hover:bg-gray-50">
                <td className="px-5 py-3">
                  <Link href={`/trainer/clienti/${c.id}`} className="font-medium hover:underline">
                    {c.profiles?.full_name || "—"}
                  </Link>
                  <div className="text-gray-400 text-xs">{c.profiles?.email}</div>
                </td>
                <td className="px-5 py-3">
                  <span className={`badge-${c.status}`}>{STATUS_LABEL[c.status]}</span>
                </td>
                <td className="px-5 py-3">{c.price ? `${c.price} €/mese` : "—"}</td>
                <td className="px-5 py-3">
                  {c.expiry_date ? new Date(c.expiry_date).toLocaleDateString("it-IT") : "—"}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={4} className="px-5 py-8 text-center text-gray-400">
                  Nessun cliente trovato.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

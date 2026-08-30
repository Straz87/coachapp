"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

export type ClientRow = {
  id: string;
  status: "attivo" | "in_scadenza" | "scaduto" | "sospeso" | "in_attesa_pagamento";
  price: number | null;
  expiry_date: string | null;
  profiles: { full_name: string; email: string } | null;
  // Campi calcolati per la overview (ultima attività, giorni a scadenza).
  last_activity?: string | null;
  days_inactive?: number | null;
  days_to_expiry?: number | null;
  needs_attention?: boolean;
};

const STATUS_LABEL: Record<string, string> = {
  attivo: "Attivo",
  in_scadenza: "In scadenza",
  scaduto: "Scaduto",
  sospeso: "Sospeso",
  in_attesa_pagamento: "In attesa di pagamento",
};

function activityLabel(daysInactive: number | null | undefined, hasHistory: boolean) {
  if (!hasHistory) return "Mai registrato";
  if (daysInactive === 0) return "Oggi";
  if (daysInactive === 1) return "Ieri";
  return `${daysInactive} giorni fa`;
}

function expiryLabel(expiryDate: string | null, daysToExpiry: number | null | undefined) {
  if (!expiryDate) return "—";
  const formatted = new Date(expiryDate).toLocaleDateString("it-IT");
  if (daysToExpiry === null || daysToExpiry === undefined) return formatted;
  if (daysToExpiry < 0) return `${formatted} (scaduto)`;
  if (daysToExpiry === 0) return `${formatted} (oggi)`;
  return `${formatted} (tra ${daysToExpiry}g)`;
}

export default function ClientList({ clients }: { clients: ClientRow[] }) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("tutti");
  const [urgentFirst, setUrgentFirst] = useState(true);

  const filtered = useMemo(() => {
    const list = clients.filter((c) => {
      const name = c.profiles?.full_name?.toLowerCase() || "";
      const matchesQuery = name.includes(query.toLowerCase());
      const matchesStatus =
        statusFilter === "tutti"
          ? true
          : statusFilter === "attenzione"
          ? !!c.needs_attention
          : c.status === statusFilter;
      return matchesQuery && matchesStatus;
    });

    if (urgentFirst) {
      list.sort((a, b) => {
        if (!!b.needs_attention !== !!a.needs_attention) {
          return (b.needs_attention ? 1 : 0) - (a.needs_attention ? 1 : 0);
        }
        return (b.days_inactive ?? -1) - (a.days_inactive ?? -1);
      });
    }

    return list;
  }, [clients, query, statusFilter, urgentFirst]);

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-5">
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
          <option value="attenzione">⚠️ Da contattare</option>
          <option value="attivo">Attivo</option>
          <option value="in_scadenza">In scadenza</option>
          <option value="scaduto">Scaduto</option>
          <option value="sospeso">Sospeso</option>
                    <option value="in_attesa_pagamento">In attesa di pagamento</option>
        </select>
        <label className="flex items-center gap-2 text-sm text-gray-500 sm:ml-auto">
          <input
            type="checkbox"
            checked={urgentFirst}
            onChange={(e) => setUrgentFirst(e.target.checked)}
          />
          Prima chi ha bisogno di attenzione
        </label>
      </div>

              <div className="card p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-left">
            <tr>
          <th className="px-5 py-3 font-medium">Cliente</th>              
          <th className="px-5 py-3 font-medium">Stato</th>
              <th className="px-5 py-3 font-medium">Ultima attività</th>
              <th className="px-5 py-3 font-medium">Prezzo</th>
              <th className="px-5 py-3 font-medium">Scadenza</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => {
              const hasHistory = !!c.last_activity;
              const inactiveWarn = c.days_inactive !== null && c.days_inactive !== undefined
                ? c.days_inactive >= 5
                : !hasHistory && c.needs_attention;
              const expiryWarn =
                c.days_to_expiry !== null &&
                c.days_to_expiry !== undefined &&
                c.days_to_expiry <= 5;

              return (
                <tr
                  key={c.id}
                  className={`border-t border-gray-100 hover:bg-gray-50 ${
                    c.needs_attention ? "bg-orange-50/60" : ""
                  }`}
                >
                  <td className="px-5 py-3">
                    <Link href={`/trainer/clienti/${c.id}`} className="font-medium hover:underline">
                      {c.needs_attention && <span className="mr-1">⚠️</span>}
                      {c.profiles?.full_name || "—"}
                    </Link>
                    <div className="text-gray-400 text-xs">{c.profiles?.email}</div>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`badge-${c.status}`}>{STATUS_LABEL[c.status]}</span>
                  </td>
                  <td className={`px-5 py-3 ${inactiveWarn ? "text-orange-600 font-medium" : "text-gray-600"}`}>
                    {activityLabel(c.days_inactive, hasHistory)}
                  </td>
                  <td className="px-5 py-3">{c.price ? `${c.price} €/mese` : "—"}</td>
                  <td className={`px-5 py-3 ${expiryWarn ? "text-red-600 font-medium" : ""}`}>
                    {expiryLabel(c.expiry_date, c.days_to_expiry)}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-gray-400">
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

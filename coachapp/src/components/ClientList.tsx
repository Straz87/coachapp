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
  if (!hasHistory) return "Nessuna attività";
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

function isExpiring(c: ClientRow) {
  return c.days_to_expiry !== null && c.days_to_expiry !== undefined && c.days_to_expiry >= 0 && c.days_to_expiry <= 5;
}

function isStalled(c: ClientRow) {
  if (c.days_inactive !== null && c.days_inactive !== undefined) return c.days_inactive >= 5;
  return !c.last_activity && !!c.needs_attention && !isExpiring(c);
}

function initials(name: string | undefined) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || "?";
}

export default function ClientList({ clients }: { clients: ClientRow[] }) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("tutti");
  const [urgentFirst, setUrgentFirst] = useState(true);

  const todo = useMemo(
    () => ({
      fermi: clients.filter(isStalled).length,
      scadenza: clients.filter(isExpiring).length,
      scaduti: clients.filter((c) => c.status === "scaduto").length,
    }),
    [clients]
  );

  const filtered = useMemo(() => {
    const list = clients.filter((c) => {
      const name = c.profiles?.full_name?.toLowerCase() || "";
      const matchesQuery = name.includes(query.toLowerCase());
      const matchesStatus =
        statusFilter === "tutti"
          ? true
          : statusFilter === "attenzione"
          ? !!c.needs_attention
          : statusFilter === "fermi"
          ? isStalled(c)
          : statusFilter === "scadenza"
          ? isExpiring(c)
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

  const chip = (value: string, label: string) => (
    <button
      type="button"
      onClick={() => setStatusFilter(value)}
      className={`shrink-0 rounded-full px-3.5 py-1.5 text-[13px] ${
        statusFilter === value
          ? "bg-brand font-semibold text-gray-900"
          : "border border-gray-200 text-gray-600"
      }`}
    >
      {label}
    </button>
  );

  const todoRow = (value: string, color: string, text: string) => (
    <button
      type="button"
      onClick={() => setStatusFilter(value)}
      className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm border-t first:border-t-0 border-gray-100"
    >
      <span className={`h-2 w-2 rounded-full ${color}`} />
      <span className="flex-1">{text}</span>
      <span className="text-gray-300">›</span>
    </button>
  );

  const nothingTodo = todo.fermi + todo.scadenza + todo.scaduti === 0;

  return (
    <div>
      {/* Da fare oggi: solo telefono. Un tocco filtra la lista sotto. */}
      <div className="sm:hidden mb-5">
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">Da fare oggi</p>
        <div className="rounded-2xl border border-gray-100 bg-white overflow-hidden">
          {todo.fermi > 0 &&
            todoRow(
              "fermi",
              "bg-red-500",
              `${todo.fermi} ${todo.fermi === 1 ? "cliente fermo" : "clienti fermi"} da 5+ giorni`
            )}
          {todo.scadenza > 0 &&
            todoRow(
              "scadenza",
              "bg-amber-500",
              `${todo.scadenza} ${todo.scadenza === 1 ? "abbonamento in scadenza" : "abbonamenti in scadenza"}`
            )}
          {todo.scaduti > 0 &&
            todoRow("scaduto", "bg-red-500", `${todo.scaduti} ${todo.scaduti === 1 ? "abbonamento scaduto" : "abbonamenti scaduti"}`)}
          {nothingTodo && (
            <p className="px-4 py-3 text-sm text-gray-500">Tutto a posto: nessun cliente da contattare.</p>
          )}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-5">
        <input
          className="input sm:max-w-xs"
          placeholder="Cerca cliente…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="sm:hidden flex gap-2 overflow-x-auto -mx-1 px-1">
          {chip("tutti", "Tutti")}
          {chip("attenzione", "Da contattare")}
          {chip("scadenza", "In scadenza")}
          {chip("scaduto", "Scaduti")}
        </div>
        <select
          className="input hidden sm:block sm:max-w-[200px]"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="tutti">Tutti gli stati</option>
          <option value="attenzione">⚠️ Da contattare</option>
          <option value="fermi">Fermi da 5+ giorni</option>
          <option value="scadenza">In scadenza (5 giorni)</option>
          <option value="attivo">Attivo</option>
          <option value="in_scadenza">In scadenza</option>
          <option value="scaduto">Scaduto</option>
          <option value="sospeso">Sospeso</option>
          <option value="in_attesa_pagamento">In attesa di pagamento</option>
        </select>
        <label className="hidden sm:flex items-center gap-2 text-sm text-gray-500 sm:ml-auto">
          <input
            type="checkbox"
            checked={urgentFirst}
            onChange={(e) => setUrgentFirst(e.target.checked)}
          />
          Prima chi ha bisogno di attenzione
        </label>
      </div>

      {/* Telefono: righe pulite con avatar e stato in una riga. */}
      <div className="sm:hidden rounded-2xl border border-gray-100 bg-white overflow-hidden">
        {filtered.map((c) => {
          const hasHistory = !!c.last_activity;
          const stalled = isStalled(c);
          const expiring = isExpiring(c) || c.status === "in_scadenza";
          const bad = stalled || c.status === "scaduto" || c.status === "sospeso";
          const tone = bad
            ? { avatar: "bg-red-50 text-red-700", dot: "bg-red-500", text: "text-red-600" }
            : expiring
            ? { avatar: "bg-amber-50 text-amber-700", dot: "bg-amber-500", text: "text-amber-700" }
            : { avatar: "bg-gray-100 text-gray-700", dot: "bg-green-500", text: "text-gray-500" };

          let line: string;
          if (c.status === "scaduto") line = "Abbonamento scaduto";
          else if (c.status === "sospeso") line = "Abbonamento sospeso";
          else if (c.status === "in_attesa_pagamento") line = "In attesa di pagamento";
          else if (isExpiring(c))
            line = c.days_to_expiry === 0 ? "Scade oggi" : `Scade tra ${c.days_to_expiry} giorni`;
          else if (stalled)
            line = hasHistory ? `Fermo da ${c.days_inactive} giorni` : "Nessuna attività";
          else line = `Ultima attività: ${activityLabel(c.days_inactive, hasHistory).toLowerCase()}`;

          return (
            <Link
              key={c.id}
              href={`/trainer/clienti/${c.id}`}
              className="flex items-center gap-3 px-4 py-3 border-t first:border-t-0 border-gray-100"
            >
              <span
                className={`h-9 w-9 shrink-0 rounded-full flex items-center justify-center text-[13px] font-semibold ${tone.avatar}`}
              >
                {initials(c.profiles?.full_name)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{c.profiles?.full_name || "—"}</span>
                <span className={`block truncate text-xs ${tone.text}`}>{line}</span>
              </span>
              <span className={`h-2 w-2 shrink-0 rounded-full ${tone.dot}`} />
            </Link>
          );
        })}
        {filtered.length === 0 && (
          <p className="text-center text-gray-400 py-8">Nessun cliente trovato.</p>
        )}
      </div>

      {/* Vista a tabella: da tablet in su. */}
      <div className="hidden sm:block card p-0 overflow-x-auto">
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
              const inactiveWarn =
                c.days_inactive !== null && c.days_inactive !== undefined
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

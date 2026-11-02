"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import CouponManager from "@/components/CouponManager";
import ShareInviteButton from "@/components/ShareInviteButton";

type Client = {
  id: string;
  name: string;
  status: string;
  price: number | null;
  hasStripeCustomer: boolean;
  hasStripeSubscription: boolean;
  pending: boolean;
  totalPaid: number;
  paidCount: number;
  failedCount: number;
  lastPaidAt: number | null;
  lastFailedAt: number | null;
};

type Payment = {
  id: string;
  clientId: string;
  clientName: string;
  amount: number;
  currency: string;
  created: number;
  paid: boolean;
  refunded: boolean;
  amountRefunded: number;
  description: string | null;
};

const STATUS_LABELS: Record<string, string> = {
  attivo: "Attivo",
  in_scadenza: "In scadenza",
  scaduto: "Scaduto",
  sospeso: "Sospeso",
  in_attesa_di_pagamento: "In attesa di pagamento",
};

const MONTHS = [
  "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
  "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre",
];

function eur(n: number) {
  return `${n.toLocaleString("it-IT", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} €`;
}

function shortDate(ms: number) {
  const d = new Date(ms);
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

function describe(desc: string | null) {
  if (!desc) return "Abbonamento";
  if (/creation/i.test(desc)) return "Nuovo abbonamento";
  if (/update/i.test(desc)) return "Rinnovo";
  return desc;
}

// Riga unica di pagamenti: un pagamento riuscito/rimborsato, oppure l'insieme
// dei tentativi falliti dello stesso cliente nello stesso mese.
type Line =
  | { kind: "payment"; payment: Payment }
  | { kind: "failed"; clientId: string; clientName: string; amount: number; dates: number[]; created: number };

export default function FinanceDashboard() {
  const [clients, setClients] = useState<Client[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"clienti" | "pagamenti" | "sconti">("clienti");
  const [onlyFailed, setOnlyFailed] = useState(false);
  const [openClient, setOpenClient] = useState<string | null>(null);

  const [priceDrafts, setPriceDrafts] = useState<Record<string, string>>({});
  const [savingPriceId, setSavingPriceId] = useState<string | null>(null);
  const [priceMsg, setPriceMsg] = useState<Record<string, string>>({});

  const [refundingId, setRefundingId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/trainer/finance");
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Errore nel caricamento dei dati finanziari");
      } else {
        setClients(data.clients || []);
        setPayments(data.payments || []);
        const drafts: Record<string, string> = {};
        for (const c of data.clients || []) {
          drafts[c.id] = c.price != null ? String(c.price) : "";
        }
        setPriceDrafts(drafts);
      }
    } catch {
      setError("Errore di rete, riprova");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleUpdatePrice(client: Client) {
    const newPrice = Number(priceDrafts[client.id]);
    if (!newPrice || newPrice <= 0) {
      setPriceMsg((m) => ({ ...m, [client.id]: "Prezzo non valido" }));
      return;
    }
    setSavingPriceId(client.id);
    setPriceMsg((m) => ({ ...m, [client.id]: "" }));
    try {
      const res = await fetch("/api/trainer/stripe/update-price", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: client.id, price: newPrice }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPriceMsg((m) => ({ ...m, [client.id]: data.error || "Errore nell'aggiornamento" }));
      } else {
        setPriceMsg((m) => ({ ...m, [client.id]: "Aggiornato ✓" }));
        setClients((cs) => cs.map((c) => (c.id === client.id ? { ...c, price: newPrice } : c)));
      }
    } catch {
      setPriceMsg((m) => ({ ...m, [client.id]: "Errore di rete, riprova" }));
    } finally {
      setSavingPriceId(null);
    }
  }

  async function handleRefund(payment: Payment) {
    if (
      !confirm(
        `Rimborsare ${payment.amount.toFixed(2)} € a ${payment.clientName}? L'operazione non si può annullare.`
      )
    )
      return;
    setRefundingId(payment.id);
    try {
      const res = await fetch(`/api/trainer/clients/${payment.clientId}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chargeId: payment.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error || "Errore nel rimborso");
      } else {
        await load();
      }
    } catch {
      alert("Errore di rete, riprova");
    } finally {
      setRefundingId(null);
    }
  }

  const activeStatuses = ["attivo", "in_scadenza"];
  const mrr = clients
    .filter((c) => activeStatuses.includes(c.status) && c.price)
    .reduce((sum, c) => sum + (c.price || 0), 0);
  const activeCount = clients.filter((c) => activeStatuses.includes(c.status) && !c.pending).length;
  const totalAll = clients.reduce((sum, c) => sum + c.totalPaid, 0);

  // Un cliente "da sistemare" ha un tentativo fallito piu' recente dell'ultimo
  // pagamento riuscito, oppure non si e' ancora iscritto.
  const needsPayment = (c: Client) =>
    !!c.lastFailedAt && (!c.lastPaidAt || c.lastFailedAt > c.lastPaidAt);
  const alerts = clients.filter((c) => c.pending || needsPayment(c));

  const clientPayments = useMemo(() => {
    const m: Record<string, Payment[]> = {};
    for (const p of payments) (m[p.clientId] ||= []).push(p);
    return m;
  }, [payments]);

  const lines = useMemo(() => {
    const out: { month: string; sort: number; lines: Line[] }[] = [];
    const byMonth = new Map<string, { sort: number; lines: Line[]; failed: Map<string, Line & { kind: "failed" }> }>();
    for (const p of payments) {
      const d = new Date(p.created);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      if (!byMonth.has(key)) byMonth.set(key, { sort: d.getFullYear() * 12 + d.getMonth(), lines: [], failed: new Map() });
      const bucket = byMonth.get(key)!;
      if (!p.paid) {
        const ex = bucket.failed.get(p.clientId);
        if (ex) {
          ex.dates.push(p.created);
          ex.created = Math.max(ex.created, p.created);
        } else {
          const l = {
            kind: "failed" as const,
            clientId: p.clientId,
            clientName: p.clientName,
            amount: p.amount,
            dates: [p.created],
            created: p.created,
          };
          bucket.failed.set(p.clientId, l);
          bucket.lines.push(l);
        }
      } else if (!onlyFailed) {
        bucket.lines.push({ kind: "payment", payment: p });
      }
    }
    for (const [key, b] of Array.from(byMonth.entries())) {
      if (b.lines.length === 0) continue;
      const [y, mo] = key.split("-").map(Number);
      b.lines.sort((a, c) => (c.kind === "payment" ? c.payment.created : c.created) - (a.kind === "payment" ? a.payment.created : a.created));
      out.push({ month: `${MONTHS[mo]} ${y}`, sort: b.sort, lines: b.lines });
    }
    return out.sort((a, b) => b.sort - a.sort);
  }, [payments, onlyFailed]);

  function PaymentPill({ p }: { p: Payment }) {
    return (
      <span
        className={`text-xs rounded-full px-2 py-0.5 font-medium shrink-0 ${
          p.refunded
            ? "bg-gray-100 text-gray-500"
            : p.paid
            ? "bg-green-100 text-green-700"
            : "bg-red-100 text-red-700"
        }`}
      >
        {p.refunded ? "Rimborsato" : p.paid ? "Pagato" : "Non pagato"}
      </span>
    );
  }

  const tabBtn = (id: "clienti" | "pagamenti" | "sconti", label: string) => (
    <button
      type="button"
      onClick={() => setTab(id)}
      className={`px-4 py-2 text-sm border-b-2 -mb-px ${
        tab === id ? "border-gray-900 font-medium text-gray-900" : "border-transparent text-gray-500"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl bg-gray-50 p-3">
          <p className="text-xs text-gray-500">Incasso mensile stimato</p>
          <p className="text-2xl font-semibold">{mrr.toFixed(0)} €</p>
        </div>
        <div className="rounded-xl bg-gray-50 p-3">
          <p className="text-xs text-gray-500">Incassato in totale</p>
          <p className="text-2xl font-semibold text-green-700">{eur(totalAll)}</p>
        </div>
        <div className="rounded-xl bg-gray-50 p-3">
          <p className="text-xs text-gray-500">Clienti attivi</p>
          <p className="text-2xl font-semibold">{activeCount}</p>
        </div>
        <div className="rounded-xl bg-gray-50 p-3">
          <p className="text-xs text-gray-500">Da sistemare</p>
          <p className={`text-2xl font-semibold ${alerts.length ? "text-red-600" : ""}`}>{alerts.length}</p>
        </div>
      </div>

      {alerts.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 space-y-1.5">
          <p className="text-sm font-medium text-amber-900">Da sistemare</p>
          {alerts.map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-3 text-sm text-amber-900">
              <span>
                <strong className="font-medium">{c.name}</strong>
                {c.pending
                  ? " · non si è ancora iscritto"
                  : ` · ${c.failedCount} ${c.failedCount === 1 ? "pagamento non riuscito" : "pagamenti non riusciti"}, ultimo il ${shortDate(c.lastFailedAt!)}`}
              </span>
              {c.pending ? (
                <ShareInviteButton clientId={c.id} clientName={c.name} className="underline shrink-0">
                  Manda il link
                </ShareInviteButton>
              ) : (
                <Link href={`/trainer/clienti/${c.id}`} className="underline shrink-0">
                  Apri
                </Link>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex border-b border-gray-200">
        {tabBtn("clienti", "Clienti")}
        {tabBtn("pagamenti", "Pagamenti")}
        {tabBtn("sconti", "Sconti")}
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      {tab === "clienti" && (
        <div>
          <p className="text-xs text-gray-400 mb-2">
            Tocca un cliente per vedere tutto lo storico dei suoi pagamenti. Il nuovo prezzo vale dal
            prossimo rinnovo, senza far ripetere il pagamento (solo per chi ha un abbonamento Stripe attivo).
          </p>
          {loading ? (
            <p className="text-gray-400 text-sm">Caricamento…</p>
          ) : clients.length === 0 ? (
            <p className="text-gray-400 text-sm">Nessun cliente ancora.</p>
          ) : (
            <div className="card !p-0 divide-y divide-gray-100">
              {clients.map((c) => {
                const draft = priceDrafts[c.id] ?? "";
                const changed = draft !== (c.price != null ? String(c.price) : "");
                const open = openClient === c.id;
                const list = clientPayments[c.id] || [];
                const pill = c.pending
                  ? { t: "In attesa", cls: "bg-amber-100 text-amber-800" }
                  : needsPayment(c)
                  ? { t: "Pagamento fallito", cls: "bg-red-100 text-red-700" }
                  : !c.hasStripeSubscription
                  ? { t: "Senza Stripe", cls: "bg-amber-100 text-amber-800" }
                  : { t: STATUS_LABELS[c.status] || c.status, cls: "bg-green-100 text-green-700" };
                return (
                  <div key={c.id} className="px-4 py-3">
                    <div className="flex items-center gap-3 flex-wrap">
                      <button
                        type="button"
                        onClick={() => setOpenClient(open ? null : c.id)}
                        className="flex-1 min-w-[150px] text-left"
                      >
                        <p className="text-sm font-medium">
                          {c.name} <span className="text-gray-300">{open ? "▴" : "▾"}</span>
                        </p>
                        <p className="text-xs text-gray-500">
                          Totale pagato <strong className="font-medium text-gray-700">{eur(c.totalPaid)}</strong>
                          {c.paidCount > 0 && ` · ${c.paidCount} ${c.paidCount === 1 ? "pagamento" : "pagamenti"}`}
                        </p>
                      </button>
                      <span className={`text-xs rounded-full px-2 py-0.5 font-medium shrink-0 ${pill.cls}`}>{pill.t}</span>
                      <div className="flex items-center gap-1 shrink-0">
                        <input
                          type="number"
                          className="input text-sm w-20 text-right"
                          value={draft}
                          onChange={(e) => setPriceDrafts((d) => ({ ...d, [c.id]: e.target.value }))}
                          disabled={!c.hasStripeSubscription}
                          aria-label={`Prezzo mensile di ${c.name}`}
                        />
                        <span className="text-xs text-gray-400">€/mese</span>
                      </div>
                      {changed && c.hasStripeSubscription && (
                        <button
                          onClick={() => handleUpdatePrice(c)}
                          disabled={savingPriceId === c.id}
                          className="btn-secondary text-sm shrink-0"
                        >
                          {savingPriceId === c.id ? "Salvataggio…" : "Salva"}
                        </button>
                      )}
                      {priceMsg[c.id] && <span className="text-xs text-gray-500 shrink-0">{priceMsg[c.id]}</span>}
                    </div>

                    {open && (
                      <div className="mt-3 rounded-xl bg-gray-50 px-3 py-2">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1">
                          Storico pagamenti
                        </p>
                        {list.length === 0 ? (
                          <p className="text-xs text-gray-400 py-1">Nessun pagamento registrato.</p>
                        ) : (
                          <div className="divide-y divide-gray-200">
                            {list.map((p) => (
                              <div key={p.id} className="py-1.5 flex items-center gap-3 text-sm">
                                <span className="flex-1 text-xs text-gray-500">
                                  {new Date(p.created).toLocaleDateString("it-IT")} · {describe(p.description)}
                                </span>
                                <span className="font-medium">{p.amount.toFixed(2)} €</span>
                                <PaymentPill p={p} />
                                {!p.refunded && p.paid && (
                                  <button
                                    onClick={() => handleRefund(p)}
                                    disabled={refundingId === p.id}
                                    className="text-xs text-gray-400 hover:text-red-600 shrink-0"
                                  >
                                    {refundingId === p.id ? "Rimborso…" : "Rimborsa"}
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                        <p className="text-xs text-gray-500 pt-2 border-t border-gray-200 mt-1">
                          Totale pagato: <strong className="font-medium text-gray-700">{eur(c.totalPaid)}</strong>
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {tab === "pagamenti" && (
        <div>
          <div className="flex gap-2 mb-3">
            <button
              type="button"
              onClick={() => setOnlyFailed(false)}
              className={`text-xs rounded-full px-3 py-1 border ${!onlyFailed ? "border-gray-900 bg-gray-900 text-white" : "border-gray-200 text-gray-600"}`}
            >
              Tutti
            </button>
            <button
              type="button"
              onClick={() => setOnlyFailed(true)}
              className={`text-xs rounded-full px-3 py-1 border ${onlyFailed ? "border-gray-900 bg-gray-900 text-white" : "border-gray-200 text-gray-600"}`}
            >
              Non riusciti
            </button>
          </div>
          {loading ? (
            <p className="text-gray-400 text-sm">Caricamento…</p>
          ) : lines.length === 0 ? (
            <p className="text-gray-400 text-sm">{onlyFailed ? "Nessun pagamento non riuscito." : "Nessun pagamento ancora."}</p>
          ) : (
            <div className="space-y-4">
              {lines.map((group) => (
                <div key={group.month}>
                  <p className="text-xs font-medium text-gray-400 mb-1">{group.month}</p>
                  <div className="card !p-0 divide-y divide-gray-100">
                    {group.lines.map((l, i) =>
                      l.kind === "failed" ? (
                        <div key={`f-${l.clientId}-${i}`} className="px-4 py-3 flex items-center gap-3 flex-wrap">
                          <div className="flex-1 min-w-[150px]">
                            <p className="text-sm font-medium">{l.clientName}</p>
                            <p className="text-xs text-gray-500">
                              {l.dates.length} {l.dates.length === 1 ? "tentativo non riuscito" : "tentativi non riusciti"} ·{" "}
                              {l.dates
                                .slice()
                                .sort((a, b) => a - b)
                                .map(shortDate)
                                .join(", ")}
                            </p>
                          </div>
                          <span className="text-sm font-semibold shrink-0">{l.amount.toFixed(2)} €</span>
                          <span className="text-xs rounded-full px-2 py-0.5 font-medium bg-red-100 text-red-700 shrink-0">
                            Non pagato
                          </span>
                        </div>
                      ) : (
                        <div key={l.payment.id} className="px-4 py-3 flex items-center gap-3 flex-wrap">
                          <div className="flex-1 min-w-[150px]">
                            <p className="text-sm font-medium">{l.payment.clientName}</p>
                            <p className="text-xs text-gray-500">
                              {new Date(l.payment.created).toLocaleDateString("it-IT")} · {describe(l.payment.description)}
                            </p>
                          </div>
                          <span className="text-sm font-semibold shrink-0">{l.payment.amount.toFixed(2)} €</span>
                          <PaymentPill p={l.payment} />
                          {!l.payment.refunded && l.payment.paid && (
                            <button
                              onClick={() => handleRefund(l.payment)}
                              disabled={refundingId === l.payment.id}
                              className="text-xs text-gray-400 hover:text-red-600 shrink-0"
                            >
                              {refundingId === l.payment.id ? "Rimborso…" : "Rimborsa"}
                            </button>
                          )}
                        </div>
                      )
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "sconti" && (
        <div>
          <p className="text-xs text-gray-400 mb-2">
            Crea coupon riutilizzabili da applicare ai link di pagamento o far digitare direttamente al
            cliente in fase di iscrizione.
          </p>
          <CouponManager />
        </div>
      )}
    </div>
  );
}

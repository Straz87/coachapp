"use client";

import { useEffect, useState } from "react";
import CouponManager from "@/components/CouponManager";

type Client = {
  id: string;
  name: string;
  status: string;
  price: number | null;
  hasStripeCustomer: boolean;
  hasStripeSubscription: boolean;
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

export default function FinanceDashboard() {
  const [clients, setClients] = useState<Client[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const counts: Record<string, number> = {};
  for (const c of clients) {
    counts[c.status] = (counts[c.status] || 0) + 1;
  }

  return (
    <div className="space-y-8">
      <div className="card space-y-4">
        <h2 className="font-semibold text-sm">Riepilogo</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
          <div>
            <p className="text-gray-400 text-xs">Incasso mensile stimato</p>
            <p className="text-2xl font-bold text-green-600">{mrr.toFixed(0)} €</p>
          </div>
          <div>
            <p className="text-gray-400 text-xs">Clienti totali</p>
            <p className="text-2xl font-bold">{clients.length}</p>
          </div>
          {Object.entries(counts).map(([status, n]) => (
            <div key={status}>
              <p className="text-gray-400 text-xs">{STATUS_LABELS[status] || status}</p>
              <p className="text-2xl font-bold">{n}</p>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="font-semibold text-sm mb-1">Prezzi abbonamento</h2>
        <p className="text-xs text-gray-400 mb-2">
          Aggiorna il prezzo mensile di un cliente senza aprire la sua scheda. Il nuovo importo si
          applica dal rinnovo successivo, senza far ripetere il pagamento al cliente. Funziona solo
          per chi ha già un abbonamento Stripe attivo.
        </p>
        {loading ? (
          <p className="text-gray-400 text-sm">Caricamento…</p>
        ) : clients.length === 0 ? (
          <p className="text-gray-400 text-sm">Nessun cliente ancora.</p>
        ) : (
          <div className="card divide-y divide-gray-100">
            {clients.map((c) => (
              <div key={c.id} className="py-3 first:pt-0 last:pb-0 flex items-center gap-3 flex-wrap">
                <div className="flex-1 min-w-[120px]">
                  <p className="text-sm font-medium">{c.name}</p>
                  <p className="text-xs text-gray-400">
                    {STATUS_LABELS[c.status] || c.status}
                    {!c.hasStripeSubscription && " — nessun abbonamento Stripe attivo"}
                  </p>
                </div>
                <input
                  type="number"
                  className="input text-sm w-28"
                  value={priceDrafts[c.id] ?? ""}
                  onChange={(e) => setPriceDrafts((d) => ({ ...d, [c.id]: e.target.value }))}
                  disabled={!c.hasStripeSubscription}
                />
                <button
                  onClick={() => handleUpdatePrice(c)}
                  disabled={savingPriceId === c.id || !c.hasStripeSubscription}
                  className="btn-secondary text-sm shrink-0"
                >
                  {savingPriceId === c.id ? "Salvataggio…" : "Aggiorna prezzo"}
                </button>
                {priceMsg[c.id] && <span className="text-xs text-gray-500 shrink-0">{priceMsg[c.id]}</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="font-semibold text-sm mb-1">Pagamenti recenti</h2>
        <p className="text-xs text-gray-400 mb-2">
          Gli ultimi pagamenti Stripe di tutti i clienti, in un unico posto.
        </p>
        {loading ? (
          <p className="text-gray-400 text-sm">Caricamento…</p>
        ) : error ? (
          <p className="text-red-600 text-sm">{error}</p>
        ) : payments.length === 0 ? (
          <p className="text-gray-400 text-sm">Nessun pagamento ancora.</p>
        ) : (
          <div className="card divide-y divide-gray-100">
            {payments.map((p) => (
              <div key={p.id} className="py-3 first:pt-0 last:pb-0 flex items-center gap-3 flex-wrap">
                <div className="flex-1 min-w-[140px]">
                  <p className="text-sm font-medium">{p.clientName}</p>
                  <p className="text-xs text-gray-400">
                    {new Date(p.created).toLocaleDateString("it-IT")} · {p.description || "Abbonamento"}
                  </p>
                </div>
                <span className="text-sm font-semibold shrink-0">{p.amount.toFixed(2)} €</span>
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
      </div>

      <div>
        <h2 className="font-semibold text-sm mb-1">Sconti e coupon</h2>
        <p className="text-xs text-gray-400 mb-2">
          Crea coupon riutilizzabili da applicare ai link di pagamento o far digitare direttamente al
          cliente in fase di iscrizione.
        </p>
        <CouponManager />
      </div>
    </div>
  );
}

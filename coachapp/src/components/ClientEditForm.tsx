"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Props = {
  clientId: string;
  initial: {
    status: string;
    price: number | null;
    expiry_date: string | null;
    billing_note: string | null;
    internal_note: string | null;
    payment_managed_by_stripe?: boolean;
    last_payment_at?: string | null;
  };
};

type Coupon = {
  id: string;
  name: string;
  percentOff: number | null;
  duration: string;
  durationInMonths: number | null;
  maxRedemptions: number | null;
  timesRedeemed: number;
  redeemBy: number | null;
  valid: boolean;
};

type Payment = {
    id: string;
    amount: number;
    currency: string;
    created: number;
    paid: boolean;
    refunded: boolean;
    amountRefunded: number;
    description: string | null;
};

export default function ClientEditForm({ clientId, initial }: Props) {
  const supabase = createClient();
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState({
    status: initial.status,
    price: initial.price?.toString() || "",
    expiry_date: initial.expiry_date || "",
    billing_note: initial.billing_note || "",
    internal_note: initial.internal_note || "",
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [paymentLink, setPaymentLink] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [generatingLink, setGeneratingLink] = useState(false);
  const [copied, setCopied] = useState(false);
  const [trialDays, setTrialDays] = useState("");
  const [couponId, setCouponId] = useState("");
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(true);
  const [refundingId, setRefundingId] = useState<string | null>(null);
  const [refundError, setRefundError] = useState<string | null>(null);
  const [updatingPrice, setUpdatingPrice] = useState(false);
  const [priceUpdateMsg, setPriceUpdateMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/trainer/stripe/coupons")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data.coupons)) {
          // Mostra solo i coupon ancora utilizzabili (validi e con utilizzi residui)
          const usable = data.coupons.filter(
            (c: Coupon) => c.valid && (c.maxRedemptions == null || c.timesRedeemed < c.maxRedemptions)
          );
          setCoupons(usable);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadPayments();
  }, []);

  function loadPayments() {
    setLoadingPayments(true);
    fetch(`/api/trainer/clients/${clientId}/payments`)
    .then((res) => res.json())
    .then((data) => {
      if (Array.isArray(data.payments)) {
        setPayments(data.payments);
      }
    })
    .catch(() => {})
    .finally(() => setLoadingPayments(false));
  }

  async function handleRefund(chargeId: string) {
    if (!confirm("Rimborsare questo pagamento? L'importo torna sulla carta del cliente.")) return;
    setRefundingId(chargeId);
    setRefundError(null);
    try {
      const res = await fetch(`/api/trainer/clients/${clientId}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chargeId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setRefundError(data.error || "Errore nel rimborso");
      } else {
        loadPayments();
      }
    } catch {
      setRefundError("Errore di rete, riprova");
    } finally {
      setRefundingId(null);
    }
  }

  async function handleGenerateLink() {
    setGeneratingLink(true);
    setPaymentError(null);
    setPaymentLink(null);
    try {
      const res = await fetch("/api/trainer/stripe/checkout-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          price: form.price ? Number(form.price) : null,
          trialDays: trialDays ? Number(trialDays) : null,
          couponId: couponId || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPaymentError(data.error || "Errore nella generazione del link");
      } else {
        setPaymentLink(data.url);
      }
    } catch {
      setPaymentError("Errore di rete, riprova");
    } finally {
      setGeneratingLink(false);
    }
  }

async function handleUpdateSubscriptionPrice() {
  if (!form.price) return;
  if (!confirm(`Aggiornare l'abbonamento a ${form.price}€/mese dal prossimo rinnovo? Il cliente non deve fare nulla.`)) return;
  setUpdatingPrice(true);
  setPriceUpdateMsg(null);
  try {
    const res = await fetch("/api/trainer/stripe/update-price", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId, price: Number(form.price) }),
    });
    const data = await res.json();
    if (!res.ok) {
      setPriceUpdateMsg(data.error || "Errore nell'aggiornamento");
    } else {
      setPriceUpdateMsg("Prezzo aggiornato ✓ (in vigore dal prossimo rinnovo)");
    }
  } catch {
    setPriceUpdateMsg("Errore di rete, riprova");
  } finally {
    setUpdatingPrice(false);
  }
}

  async function handleCopyLink() {
    if (!paymentLink) return;
    await navigator.clipboard.writeText(paymentLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleSave() {
    setSaving(true);
    setSaved(false);

    await supabase
      .from("clients")
      .update({
        status: form.status,
        price: form.price ? Number(form.price) : null,
        expiry_date: form.expiry_date || null,
        billing_note: form.billing_note || null,
        internal_note: form.internal_note || null,
      })
      .eq("id", clientId);

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function handleDelete() {
    if (
      !confirm(
        "Eliminare definitivamente questo cliente? Verranno cancellati account, schede allenamento, progressi e messaggi. L'eventuale abbonamento Stripe attivo viene disdetto. Azione irreversibile."
      )
    )
      return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/trainer/clients/${clientId}`, { method: "DELETE" });
      if (res.ok) {
        router.push("/trainer");
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Errore durante l'eliminazione");
        setDeleting(false);
      }
    } catch {
      alert("Errore di rete, riprova");
      setDeleting(false);
    }
  }

  return (
    <div className="card space-y-4">
      <h2 className="font-semibold">Abbonamento</h2>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium">Stato</label>
          <select
            className="input mt-1"
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value })}
          >
            <option value="attivo">Attivo</option>
            <option value="in_scadenza">In scadenza</option>
            <option value="scaduto">Scaduto</option>
            <option value="sospeso">Sospeso</option>
          </select>
        </div>
        <div>
          <label className="text-sm font-medium">Prezzo (€/mese)</label>
          <input
            type="number"
            className="input mt-1"
            value={form.price}
            onChange={(e) => setForm({ ...form, price: e.target.value })}
          />
        </div>
      </div>

      <div>
        <label className="text-sm font-medium">Scadenza</label>
        <input
          type="date"
          className="input mt-1"
          value={form.expiry_date}
          onChange={(e) => setForm({ ...form, expiry_date: e.target.value })}
        />
      </div>

      <div>
        <label className="text-sm font-medium">Nota fatturazione</label>
        <input
          className="input mt-1"
          value={form.billing_note}
          onChange={(e) => setForm({ ...form, billing_note: e.target.value })}
        />
      </div>

      <div>
        <label className="text-sm font-medium">Nota interna (solo tu la vedi)</label>
        <textarea
          className="input mt-1"
          rows={3}
          value={form.internal_note}
          onChange={(e) => setForm({ ...form, internal_note: e.target.value })}
        />
      </div>

      <div className="flex items-center gap-3">
        <button onClick={handleSave} disabled={saving} className="btn-primary">
          {saving ? "Salvataggio…" : "Salva"}
        </button>
        {saved && <span className="text-green-600 text-sm">Salvato ✓</span>}
      </div>

      <div className="pt-4 border-t border-gray-100 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm">Pagamento con Stripe</h3>
          {initial.payment_managed_by_stripe && (
            <span className="text-xs bg-green-100 text-green-700 rounded-full px-2 py-0.5 font-medium">
              Gestito da Stripe ✓
            </span>
          )}
        </div>

        {initial.payment_managed_by_stripe && initial.last_payment_at && (
          <p className="text-xs text-gray-400">
            Ultimo pagamento ricevuto: {new Date(initial.last_payment_at).toLocaleDateString("it-IT")}
          </p>
        )}
        {initial.payment_managed_by_stripe && (
          <div className="flex items-center gap-3">
            <button
              onClick={handleUpdateSubscriptionPrice}
              disabled={updatingPrice || !form.price}
              className="btn-secondary text-sm"
            >
              {updatingPrice ? "Aggiornamento…" : "Aggiorna prezzo abbonamento"}
            </button>            {priceUpdateMsg && <span className="text-xs text-gray-500">{priceUpdateMsg}</span>}
          </div>
        )}

        <p className="text-xs text-gray-400">
          Genera un link di pagamento per l&apos;abbonamento mensile ({form.price ? `${form.price}€/mese` : "imposta prima il prezzo sopra"}).
          Il cliente lo apre, inserisce la carta e da quel momento il rinnovo è automatico ogni mese.
        </p>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-gray-500">Giorni di prova gratuita</label>
            <input
              type="number"
              min={0}
              placeholder="0"
              className="input mt-1 text-sm"
              value={trialDays}
              onChange={(e) => setTrialDays(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500">Sconto (coupon)</label>
            <select
              className="input mt-1 text-sm"
              value={couponId}
              onChange={(e) => setCouponId(e.target.value)}
            >
              <option value="">Nessuno</option>
              {coupons.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} — {c.percentOff}%
                  {c.maxRedemptions ? ` (${c.timesRedeemed}/${c.maxRedemptions})` : ""}
                </option>
              ))}
            </select>
          </div>
        </div>
        {coupons.length === 0 && (
          <p className="text-xs text-gray-400">
            Nessun coupon disponibile. Puoi crearne uno dalla pagina{" "}
            <a href="/trainer/sconti" className="text-brand-dark font-medium">
              Sconti e coupon
            </a>
            .
          </p>
        )}

        <button
          onClick={handleGenerateLink}
          disabled={generatingLink || !form.price}
          className="btn-secondary text-sm"
        >
          {generatingLink ? "Generazione…" : "Genera link di pagamento"}
        </button>

        {paymentError && <p className="text-xs text-red-600">{paymentError}</p>}

        {paymentLink && (
          <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
            <input
              readOnly
              value={paymentLink}
              className="flex-1 bg-transparent text-xs text-gray-600 outline-none truncate"
              onFocus={(e) => e.target.select()}
            />
            <button onClick={handleCopyLink} className="text-xs text-brand-dark font-medium shrink-0">
              {copied ? "Copiato ✓" : "Copia"}
            </button>
          </div>
        )}
      </div>

<div className="pt-4 border-t border-gray-100 space-y-2">
<h3 className="font-semibold text-sm">Ultimi pagamenti</h3>
<p className="text-xs text-gray-400">
Storno diretto dall&apos;app: niente piu dashboard Stripe da aprire per un rimborso.
</p>

  {loadingPayments ? (
  <p className="text-xs text-gray-400">Caricamento...</p>
  ) : payments.length === 0 ? (
  <p className="text-xs text-gray-400">Nessun pagamento trovato.</p>
  ) : (
  <ul className="divide-y divide-gray-100">
    {payments.map((p) => (
    <li key={p.id} className="py-2 flex items-center justify-between text-sm">
    <span>
      {new Date(p.created).toLocaleDateString("it-IT")} - {p.amount.toFixed(2)} {p.currency.toUpperCase()}
      {p.refunded && " (rimborsato)"}
      {!p.paid && " (non riuscito)"}
    </span>
      {p.paid && !p.refunded && (
      <button onClick={() => handleRefund(p.id)} disabled={refundingId === p.id} className="text-xs text-red-600 hover:text-red-700 font-medium shrink-0">{refundingId === p.id ? "Rimborso..." : "Rimborsa"}</button>
    )}
    </li>
    ))}
  </ul>
)}

  {refundError && <p className="text-xs text-red-600">{refundError}</p>}
</div>
      <div className="pt-4 border-t border-gray-100">
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="text-sm text-red-600 hover:text-red-700 font-medium"
        >
          {deleting ? "Eliminazione…" : "🗑️ Elimina cliente"}
        </button>
      </div>
    </div>
  );
}

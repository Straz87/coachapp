"use client";

import { useEffect, useState } from "react";

type Coupon = {
  id: string;
  name: string;
  code: string | null;
  percentOff: number | null;
  duration: "once" | "repeating" | "forever";
  durationInMonths: number | null;
  maxRedemptions: number | null;
  timesRedeemed: number;
  redeemBy: number | null;
  valid: boolean;
};

const DURATION_LABELS: Record<string, string> = {
  once: "Solo il primo mese",
  repeating: "Per più mesi",
  forever: "Per sempre",
};

export default function CouponManager() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [percentOff, setPercentOff] = useState("");
  const [duration, setDuration] = useState<"once" | "repeating" | "forever">("once");
  const [durationInMonths, setDurationInMonths] = useState("");
  const [maxRedemptions, setMaxRedemptions] = useState("");
  const [redeemBy, setRedeemBy] = useState("");
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function loadCoupons() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/trainer/stripe/coupons");
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Errore nel caricamento dei coupon");
      } else {
        setCoupons(data.coupons || []);
      }
    } catch {
      setError("Errore di rete, riprova");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCoupons();
  }, []);

  async function handleCreate() {
    setFormError(null);
    if (!name.trim()) {
      setFormError("Dai un nome al coupon (es. PRIMI5)");
      return;
    }
    if (!percentOff || Number(percentOff) <= 0 || Number(percentOff) > 100) {
      setFormError("Inserisci una percentuale di sconto valida (1-100)");
      return;
    }
    if (duration === "repeating" && !durationInMonths) {
      setFormError("Indica per quanti mesi vale lo sconto");
      return;
    }

    setCreating(true);
    try {
      const res = await fetch("/api/trainer/stripe/coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          percentOff: Number(percentOff),
          duration,
          durationInMonths: duration === "repeating" ? Number(durationInMonths) : undefined,
          maxRedemptions: maxRedemptions ? Number(maxRedemptions) : undefined,
          redeemBy: redeemBy || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || "Errore nella creazione del coupon");
      } else {
        setName("");
        setPercentOff("");
        setDuration("once");
        setDurationInMonths("");
        setMaxRedemptions("");
        setRedeemBy("");
        await loadCoupons();
      }
    } catch {
      setFormError("Errore di rete, riprova");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Disattivare questo coupon? Non potrà più essere usato per nuovi link di pagamento.")) return;
    await fetch(`/api/trainer/stripe/coupons?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    await loadCoupons();
  }

  return (
    <div className="space-y-4">
      <div className="card space-y-3">
        <h3 className="font-semibold text-sm">Nuovo coupon</h3>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-gray-500">Nome (diventa anche il codice)</label>
            <input
              className="input mt-1 text-sm"
              placeholder="es. PRIMI5"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500">Sconto %</label>
            <input
              type="number"
              min={1}
              max={100}
              className="input mt-1 text-sm"
              placeholder="es. 50 (100 = gratis)"
              value={percentOff}
              onChange={(e) => setPercentOff(e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-gray-500">Durata sconto</label>
            <select
              className="input mt-1 text-sm"
              value={duration}
              onChange={(e) => setDuration(e.target.value as "once" | "repeating" | "forever")}
            >
              <option value="once">Solo il primo mese</option>
              <option value="repeating">Per più mesi</option>
              <option value="forever">Per sempre</option>
            </select>
          </div>
          {duration === "repeating" && (
            <div>
              <label className="text-xs font-medium text-gray-500">Per quanti mesi</label>
              <input
                type="number"
                min={1}
                className="input mt-1 text-sm"
                placeholder="es. 3"
                value={durationInMonths}
                onChange={(e) => setDurationInMonths(e.target.value)}
              />
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-gray-500">Limite utilizzi (opzionale)</label>
            <input
              type="number"
              min={1}
              className="input mt-1 text-sm"
              placeholder="es. 5"
              value={maxRedemptions}
              onChange={(e) => setMaxRedemptions(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500">Scadenza (opzionale)</label>
            <input
              type="date"
              className="input mt-1 text-sm"
              value={redeemBy}
              onChange={(e) => setRedeemBy(e.target.value)}
            />
          </div>
        </div>

        {formError && <p className="text-xs text-red-600">{formError}</p>}

        <button onClick={handleCreate} disabled={creating} className="btn-primary text-sm">
          {creating ? "Creazione…" : "+ Crea coupon"}
        </button>
      </div>

      <div>
        <h3 className="font-semibold text-sm mb-1">Coupon esistenti</h3>
        <p className="text-xs text-gray-400 mb-2">
          Ogni coupon ha un codice: chi si iscrive dal link pubblico può digitarlo da solo nella pagina di
          pagamento, senza che tu debba preparare un link apposta.
        </p>
        {loading ? (
          <p className="text-gray-400 text-sm">Caricamento…</p>
        ) : error ? (
          <p className="text-red-600 text-sm">{error}</p>
        ) : coupons.length === 0 ? (
          <p className="text-gray-400 text-sm">Nessun coupon creato finora.</p>
        ) : (
          <div className="space-y-2">
            {coupons.map((c) => {
              const exhausted = c.maxRedemptions != null && c.timesRedeemed >= c.maxRedemptions;
              const expired = c.redeemBy != null && c.redeemBy < Date.now();
              const active = c.valid && !exhausted && !expired;
              return (
                <div key={c.id} className="card flex items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">{c.name}</span>
                      {c.code && (
                        <span className="text-xs font-mono font-semibold bg-brand/10 text-brand-dark rounded-full px-2 py-0.5">
                          Codice: {c.code}
                        </span>
                      )}
                      <span className="text-xs bg-gray-100 text-gray-600 rounded-full px-2 py-0.5">
                        {c.percentOff}% — {DURATION_LABELS[c.duration] || c.duration}
                        {c.duration === "repeating" && c.durationInMonths ? ` (${c.durationInMonths} mesi)` : ""}
                      </span>
                      <span
                        className={`text-xs rounded-full px-2 py-0.5 font-medium ${
                          active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {active ? "Attivo" : exhausted ? "Esaurito" : expired ? "Scaduto" : "Disattivato"}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      Utilizzi: {c.timesRedeemed}
                      {c.maxRedemptions ? `/${c.maxRedemptions}` : " (illimitati)"}
                      {c.redeemBy ? ` — scade il ${new Date(c.redeemBy).toLocaleDateString("it-IT")}` : ""}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDelete(c.id)}
                    className="text-gray-400 hover:text-red-600 text-sm px-2 shrink-0"
                  >
                    Elimina
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

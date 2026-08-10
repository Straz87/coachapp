"use client";

import { useEffect, useState } from "react";

type Coupon = {
  id: string;
  name: string;
  percentOff: number | null;
  valid: boolean;
};

export default function PublicLinkManager({ trainerId }: { trainerId: string }) {
  const [price, setPrice] = useState("");
  const [trialDays, setTrialDays] = useState("");
  const [couponId, setCouponId] = useState("");
  const [active, setActive] = useState(false);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
    Promise.all([
      fetch("/api/trainer/public-link").then((r) => r.json()),
      fetch("/api/trainer/stripe/coupons").then((r) => r.json()),
    ])
      .then(([linkData, couponData]) => {
        if (linkData?.link) {
          setPrice(linkData.link.price?.toString() || "");
          setTrialDays(linkData.link.trial_days?.toString() || "");
          setCouponId(linkData.link.coupon_id || "");
          setActive(!!linkData.link.active);
        }
        if (Array.isArray(couponData?.coupons)) {
          setCoupons(couponData.coupons.filter((c: Coupon) => c.valid));
        }
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleSave(nextActive: boolean) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/trainer/public-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          price: price ? Number(price) : null,
          trialDays: trialDays ? Number(trialDays) : 0,
          couponId: couponId || null,
          active: nextActive,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Errore nel salvataggio");
      } else {
        setActive(nextActive);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } catch {
      setError("Errore di rete, riprova");
    } finally {
      setSaving(false);
    }
  }

  const link = `${origin}/iscriviti/${trainerId}`;

  async function handleCopy() {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) return null;

  return (
    <div className="card space-y-3 mb-6">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">Link pubblico di iscrizione</h3>
        {active && (
          <span className="text-xs bg-green-100 text-green-700 rounded-full px-2 py-0.5 font-medium">
            Attivo
          </span>
        )}
      </div>
      <p className="text-xs text-gray-400">
        Un link fisso da mettere in bio o nelle storie: chi lo apre si iscrive e paga da solo, tu lo ritrovi
        subito qui come nuovo cliente attivo.
      </p>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-gray-500">Prezzo (€/mese)</label>
          <input
            type="number"
            className="input mt-1 text-sm"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
        </div>
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
      </div>

      <div>
        <label className="text-xs font-medium text-gray-500">Sconto (coupon, opzionale)</label>
        <select className="input mt-1 text-sm" value={couponId} onChange={(e) => setCouponId(e.target.value)}>
          <option value="">Nessuno</option>
          {coupons.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} — {c.percentOff}%
            </option>
          ))}
        </select>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex items-center gap-3 flex-wrap">
        {!active ? (
          <button onClick={() => handleSave(true)} disabled={saving || !price} className="btn-primary text-sm">
            {saving ? "Attivazione…" : "Attiva link"}
          </button>
        ) : (
          <>
            <button onClick={() => handleSave(true)} disabled={saving} className="btn-secondary text-sm">
              {saving ? "Salvataggio…" : "Salva modifiche"}
            </button>
            <button
              onClick={() => handleSave(false)}
              disabled={saving}
              className="text-xs text-gray-400 hover:text-red-600"
            >
              Disattiva
            </button>
          </>
        )}
        {saved && <span className="text-green-600 text-sm">Salvato ✓</span>}
      </div>

      {active && (
        <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
          <input
            readOnly
            value={link}
            className="flex-1 bg-transparent text-xs text-gray-600 outline-none truncate"
            onFocus={(e) => e.target.select()}
          />
          <button onClick={handleCopy} className="text-xs text-brand-dark font-medium shrink-0">
            {copied ? "Copiato ✓" : "Copia"}
          </button>
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";

type Coupon = {
  id: string;
  name: string;
  percentOff: number | null;
  valid: boolean;
};

type GroupOption = { id: string; name: string };

type PublicLink = {
  price: number | null;
  trial_days: number | null;
  coupon_id: string | null;
  group_id: string | null;
  active: boolean;
} | null;

export default function PublicLinkManager({
  trainerId,
  groups = [],
  initialLink = null,
}: {
  trainerId: string;
  groups?: GroupOption[];
  initialLink?: PublicLink;
}) {
  const [price, setPrice] = useState(initialLink?.price?.toString() || "");
  const [trialDays, setTrialDays] = useState(
    initialLink?.trial_days?.toString() || ""
  );
  const [couponId, setCouponId] = useState(initialLink?.coupon_id || "");
  const [groupId, setGroupId] = useState(initialLink?.group_id || "");
  const [active, setActive] = useState(!!initialLink?.active);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [couponsLoading, setCouponsLoading] = useState(false);
  const [couponsLoaded, setCouponsLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  async function loadCoupons() {
    if (couponsLoaded || couponsLoading) return;
    setCouponsLoading(true);
    try {
      const res = await fetch("/api/trainer/stripe/coupons");
      const data = await res.json();
      if (Array.isArray(data?.coupons)) {
        setCoupons(data.coupons.filter((c: Coupon) => c.valid));
      }
      setCouponsLoaded(true);
    } catch {
    } finally {
      setCouponsLoading(false);
    }
  }

  useEffect(() => {
    if (initialLink?.coupon_id) {
      loadCoupons();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSave(nextActive: boolean) {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/trainer/public-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          price: price ? Number(price) : null,
          trial_days: trialDays ? Number(trialDays) : null,
          coupon_id: couponId || null,
          group_id: groupId || null,
          active: nextActive,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "Errore nel salvataggio");
      }
      setActive(nextActive);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Errore nel salvataggio");
    } finally {
      setSaving(false);
    }
  }

  const link = `${origin}/iscriviti/${trainerId}`;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  }

  return (
    <div className="card space-y-3 mb-6">
      <div>
        <h3 className="font-semibold text-sm">Link pubblico di iscrizione</h3>
        <p className="text-xs text-gray-500 mt-0.5">
          Condividi questo link per far iscrivere nuovi clienti direttamente,
          con pagamento incluso.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-gray-500">
            Prezzo mensile (€)
          </label>
          <input
            type="number"
            className="input mt-1 text-sm"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="es. 49"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-500">
            Giorni di prova gratuita
          </label>
          <input
            type="number"
            className="input mt-1 text-sm"
            value={trialDays}
            onChange={(e) => setTrialDays(e.target.value)}
            placeholder="es. 7"
          />
        </div>
      </div>

      <div>
        <label className="text-xs font-medium text-gray-500">
          Sconto (coupon, opzionale)
        </label>
        <select
          className="input mt-1 text-sm"
          value={couponId}
          onFocus={loadCoupons}
          onChange={(e) => setCouponId(e.target.value)}
        >
          <option value="">
            {couponsLoading ? "Caricamento sconti…" : "Nessuno"}
          </option>
          {coupons.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} — {c.percentOff}%
            </option>
          ))}
        </select>
      </div>

      {groups.length > 0 && (
        <div>
          <label className="text-xs font-medium text-gray-500">
            Gruppo di assegnazione (opzionale)
          </label>
          <select
            className="input mt-1 text-sm"
            value={groupId}
            onChange={(e) => setGroupId(e.target.value)}
          >
            <option value="">Nessun gruppo</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {error && <p className="text-xs text-red-500">{error}</p>}

      <div className="flex items-center gap-2">
        <button
          className="btn-primary text-sm"
          disabled={saving}
          onClick={() => handleSave(true)}
        >
          {saving ? "Salvataggio…" : active ? "Aggiorna" : "Attiva link"}
        </button>
        {active && (
          <button
            className="btn-secondary text-sm"
            disabled={saving}
            onClick={() => handleSave(false)}
          >
            Disattiva
          </button>
        )}
        {saved && <span className="text-xs text-green-600">Salvato ✓</span>}
      </div>

      {active && (
        <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
          <input
            readOnly
            className="flex-1 bg-transparent text-xs text-gray-600 outline-none"
            value={link}
          />
          <button
            className="text-xs font-medium text-brand-600 hover:underline"
            onClick={handleCopy}
          >
            {copied ? "Copiato ✓" : "Copia"}
          </button>
        </div>
      )}
    </div>
  );
}

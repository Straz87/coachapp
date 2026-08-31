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
  title: string | null;
  description: string | null;
  show_in_vetrina: boolean;
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
  const [title, setTitle] = useState(initialLink?.title || "");
  const [description, setDescription] = useState(initialLink?.description || "");
    const [showInVetrina, setShowInVetrina] = useState(!!initialLink?.show_in_vetrina);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [couponsLoading, setCouponsLoading] = useState(false);
  const [couponsLoaded, setCouponsLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedShowcase, setCopiedShowcase] = useState(false);
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
          title: title || null,
          description: description || null,
          show_in_vetrina: showInVetrina,
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
  const showcaseLink = `${origin}/vetrina/${trainerId}`;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  }

  async function handleCopyShowcase() {
    try {
      await navigator.clipboard.writeText(showcaseLink);
      setCopiedShowcase(true);
      setTimeout(() => setCopiedShowcase(false), 2000);
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
      <div>
      <label className="text-xs font-medium text-gray-500">Titolo (mostrato nella pagina vetrina)</label>
      </div>
        <input
            className="input mt-1 text-sm"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Es. Coaching individuale"
          />
<div>
<label className="text-xs font-medium text-gray-500">Mini bio (mostrata nella pagina vetrina)</label>
<textarea
    className="input mt-1 text-sm w-full"
    rows={2}
    maxLength={200}
    value={description}
    onChange={(e) => setDescription(e.target.value)}
    placeholder="Es. Programma su misura, seguito passo passo, per i tuoi obiettivi."
  /></div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input
          type="checkbox"
          checked={showInVetrina}
          onChange={(e) => setShowInVetrina(e.target.checked)}
        />
        Mostra nella pagina vetrina pubblica
      </label>

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

      <div className="pt-3 mt-1 border-t border-gray-100">
        <p className="text-xs font-medium text-gray-500 mb-1">Link vetrina (per la bio Instagram)</p>
        <p className="text-xs text-gray-400 mb-2">
          Una pagina dove chi ti scopre può scegliere tra i tuoi percorsi pubblici (individuale, gruppi,
          programmi) prima di iscriversi.
        </p>
        <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
          <input
            readOnly
            className="flex-1 bg-transparent text-xs text-gray-600 outline-none"
            value={showcaseLink}
          />
          <button
            className="text-xs font-medium text-brand-600 hover:underline"
            onClick={handleCopyShowcase}
          >
            {copiedShowcase ? "Copiato ✓" : "Copia"}
          </button>
        </div>
      </div>
    </div>
  );
}

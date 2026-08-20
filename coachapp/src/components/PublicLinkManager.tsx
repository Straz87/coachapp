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
  const [trialDays, setTrialDays] = useState(initialLink?.trial_days?.toString() || "");
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

  // I dati del link (prezzo, prova, attivo) arrivano già dal server tramite
  // initialLink: niente fetch client-side per questi, evitando il round-trip
  // in più che rallentava l'apertura della dashboard.
  //
  // I coupon Stripe invece li carichiamo solo quando servono davvero (menu
  // a tendina aperto, o se un coupon è già impostato sul link), perché è
  // una chiamata live a Stripe e non deve bloccare il resto della pagina.
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
      // silenzioso: il trainer può riprovare aprendo di nuovo il menu
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
    try {
      const res = await fetch("/api/trainer/public-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          price: price ? Number(price) : null,
          trialDays: trialDays ? Number(trialDays) : 0,
          couponId: couponId || null,
          groupId: groupId || null,
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
        <select
          className="input mt-1 text-sm"
          value={couponId}
          onFocus={loadCoupons}
          onChange={(e) => setCouponId(e.target.value)}
        >
          <option value="">{couponsLoading ? "Caricamento sconti…" : "Nessuno"}</option>
          {coupons.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} — {c.percentOff}%
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-xs font-medium text-gray-500">Assegna al gruppo (opzionale)</label>
        <select className="input mt-1 text-sm" value={groupId} onChange={(e) => setGroupId(e.target.value)}>
          <option value="">Nessuno — resta da assegnare a mano</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
        <p className="text-xs text-gray-400 mt-1">
          Se scegli un gruppo, chi si iscrive da questo link ci entra subito e vede il programma senza che tu
          debba fare nulla. Lascia su &quot;Nessuno&quot; se il tuo link è per piani personalizzati che costruisci
          tu a mano.
        </p>
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
"use client";

import { useEffect, useState } from "react";

type Coupon = {
  id: string;
  name: string;
  percentOff: number | null;
  valid: boolean;
};

type GroupOption = { id: string; name: string };

export default function PublicLinkManager({
  trainerId,
  groups = [],
}: {
  trainerId: string;
  groups?: GroupOption[];
}) {
  const [price, setPrice] = useState("");
  const [trialDays, setTrialDays] = useState("");
  const [couponId, setCouponId] = useState("");
  const [groupId, setGroupId] = useState("");
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
          setGroupId(linkData.link.group_id || "");
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
          groupId: groupId || null,
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

      <div>
        <label className="text-xs font-medium text-gray-500">Assegna al gruppo (opzionale)</label>
        <select className="input mt-1 text-sm" value={groupId} onChange={(e) => setGroupId(e.target.value)}>
          <option value="">Nessuno — resta da assegnare a mano</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
        <p className="text-xs text-gray-400 mt-1">
          Se scegli un gruppo, chi si iscrive da questo link ci entra subito e vede il programma senza che tu
          debba fare nulla. Lascia su &quot;Nessuno&quot; se il tuo link è per piani personalizzati che costruisci
          tu a mano.
        </p>
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

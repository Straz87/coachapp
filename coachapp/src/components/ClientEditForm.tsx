"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Props = {
  clientId: string;
  initial: {
    status: string;
    price: number | null;
    expiry_date: string | null;
    billing_note: string | null;
    internal_note: string | null;
  };
};

export default function ClientEditForm({ clientId, initial }: Props) {
  const supabase = createClient();
  const [form, setForm] = useState({
    status: initial.status,
    price: initial.price?.toString() || "",
    expiry_date: initial.expiry_date || "",
    billing_note: initial.billing_note || "",
    internal_note: initial.internal_note || "",
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

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
    </div>
  );
}

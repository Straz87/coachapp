"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NuovoClientePage() {
  const router = useRouter();
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    price: "",
    billing_note: "",
    expiry_date: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ email: string; tempPassword: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch("/api/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        price: form.price ? Number(form.price) : null,
      }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error || "Errore durante la creazione.");
      return;
    }

    setResult({ email: data.email, tempPassword: data.tempPassword });
  }

  if (result) {
    return (
      <div className="max-w-lg">
        <h1 className="text-2xl font-bold mb-4">Cliente creato ✅</h1>
        <div className="card space-y-3">
          <p className="text-sm text-gray-600">
            Comunica queste credenziali al cliente (es. via WhatsApp) per il primo accesso.
            Potrà cambiare la password una volta entrato.
          </p>
          <div>
            <p className="text-xs text-gray-400">Email</p>
            <p className="font-mono">{result.email}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Password temporanea</p>
            <p className="font-mono">{result.tempPassword}</p>
          </div>
          <button className="btn-primary mt-2" onClick={() => router.push("/trainer")}>
            Torna alla lista clienti
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-bold mb-6">Nuovo cliente</h1>
      <form onSubmit={handleSubmit} className="card space-y-4">
        <div>
          <label className="text-sm font-medium">Nome e cognome</label>
          <input
            required
            className="input mt-1"
            value={form.full_name}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })}
          />
        </div>
        <div>
          <label className="text-sm font-medium">Email</label>
          <input
            type="email"
            required
            className="input mt-1"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium">Prezzo (€/mese)</label>
            <input
              type="number"
              className="input mt-1"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
            />
          </div>
          <div>
            <label className="text-sm font-medium">Scadenza abbonamento</label>
            <input
              type="date"
              className="input mt-1"
              value={form.expiry_date}
              onChange={(e) => setForm({ ...form, expiry_date: e.target.value })}
            />
          </div>
        </div>
        <div>
          <label className="text-sm font-medium">Nota fatturazione (facoltativo)</label>
          <input
            className="input mt-1"
            placeholder="es. Bonifico mensile"
            value={form.billing_note}
            onChange={(e) => setForm({ ...form, billing_note: e.target.value })}
          />
        </div>

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? "Creazione…" : "Crea cliente"}
        </button>
      </form>
    </div>
  );
}

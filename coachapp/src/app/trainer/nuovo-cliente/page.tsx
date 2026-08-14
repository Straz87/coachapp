"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NuovoClientePage() {
  const router = useRouter();
  const [mode, setMode] = useState<"link" | "manuale">("link");

  // --- Modalità link: il trainer imposta solo il prezzo, il cliente
  // inserisce da sé nome/email/password aprendo il link che gli mandi ---
  const [inviteForm, setInviteForm] = useState({
    price: "",
    trialDays: "",
    billing_note: "",
  });
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);

  // --- Modalità manuale: il trainer inserisce lui nome ed email ---
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

  async function handleInviteSubmit(e: React.FormEvent) {
    e.preventDefault();
    setInviteLoading(true);
    setInviteError(null);

    const res = await fetch("/api/clients/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        price: inviteForm.price ? Number(inviteForm.price) : null,
        trialDays: inviteForm.trialDays ? Number(inviteForm.trialDays) : null,
        billingNote: inviteForm.billing_note || null,
      }),
    });

    const data = await res.json();
    setInviteLoading(false);

    if (!res.ok) {
      setInviteError(data.error || "Errore durante la creazione del link.");
      return;
    }

    setInviteUrl(data.url);
  }

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

  if (inviteUrl) {
    const waText = encodeURIComponent(
      `Ciao! Per iscriverti apri questo link e inserisci i tuoi dati: ${inviteUrl}`
    );
    return (
      <div className="max-w-lg">
        <h1 className="text-2xl font-bold mb-4">Link generato ✅</h1>
        <div className="card space-y-3">
          <p className="text-sm text-gray-600">
            Manda questo link al cliente: aprirà una pagina dove inserisce nome, email e password
            e procede al pagamento. L&apos;account viene creato in automatico al termine, senza
            che tu debba fare nient&apos;altro.
          </p>
          <p className="font-mono text-sm break-all bg-gray-50 p-3 rounded">{inviteUrl}</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-primary"
              onClick={() => navigator.clipboard.writeText(inviteUrl)}
            >
              Copia link
            </button>
            <a
              className="btn-primary bg-green-600 hover:bg-green-700"
              href={`https://wa.me/?text=${waText}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Invia su WhatsApp
            </a>
          </div>
          <button
            type="button"
            className="text-sm text-gray-500 underline mt-2"
            onClick={() => router.push("/trainer")}
          >
            Torna alla lista clienti
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-bold mb-2">Nuovo cliente</h1>
      <div className="flex gap-2 mb-6">
        <button
          type="button"
          onClick={() => setMode("link")}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
            mode === "link" ? "bg-black text-white" : "bg-gray-100 text-gray-600"
          }`}
        >
          Genera link di iscrizione
        </button>
        <button
          type="button"
          onClick={() => setMode("manuale")}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
            mode === "manuale" ? "bg-black text-white" : "bg-gray-100 text-gray-600"
          }`}
        >
          Crea manualmente
        </button>
      </div>

      {mode === "link" ? (
        <form onSubmit={handleInviteSubmit} className="card space-y-4">
          <p className="text-sm text-gray-500">
            Imposti solo il prezzo, il cliente inserisce lui nome, email e password aprendo il
            link che gli mandi. Niente email da digitare per te.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">Prezzo (€/mese)</label>
              <input
                type="number"
                required
                className="input mt-1"
                value={inviteForm.price}
                onChange={(e) => setInviteForm({ ...inviteForm, price: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Giorni di prova (facoltativo)</label>
              <input
                type="number"
                className="input mt-1"
                value={inviteForm.trialDays}
                onChange={(e) => setInviteForm({ ...inviteForm, trialDays: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">Nota fatturazione (facoltativo)</label>
            <input
              className="input mt-1"
              placeholder="es. Bonifico mensile"
              value={inviteForm.billing_note}
              onChange={(e) => setInviteForm({ ...inviteForm, billing_note: e.target.value })}
            />
          </div>

          {inviteError && <p className="text-red-600 text-sm">{inviteError}</p>}

          <button type="submit" disabled={inviteLoading} className="btn-primary w-full">
            {inviteLoading ? "Creazione…" : "Genera link"}
          </button>
        </form>
      ) : (
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
      )}
    </div>
  );
}

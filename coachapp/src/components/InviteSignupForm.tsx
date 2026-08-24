"use client";

import { useState } from "react";

// Form usato nella pagina pubblica /iscriviti/invito/[token]: il cliente
// inserisce nome, email e password. Prezzo e prova gratuita arrivano già
// decisi dal trainer (client_invites), il cliente non li vede modificabili.
export default function InviteSignupForm({
  token,
  isFree = false,
}: {
  token: string;
  isFree?: boolean;
}) {
  const [form, setForm] = useState({ fullName: "", email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/public/signup-invito", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, ...form }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Errore durante la registrazione");
        setLoading(false);
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("Errore di rete, riprova");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-4">
      <div>
        <label className="text-sm font-medium">Nome e cognome</label>
        <input
          required
          className="input mt-1"
          value={form.fullName}
          onChange={(e) => setForm({ ...form, fullName: e.target.value })}
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
      <div>
        <label className="text-sm font-medium">Crea una password</label>
        <input
          type="password"
          required
          minLength={6}
          className="input mt-1"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
        />
        <p className="text-xs text-gray-400 mt-1">
          Ti servirà per accedere alla tua area dopo l&apos;iscrizione.
        </p>
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      <button type="submit" disabled={loading} className="btn-primary w-full">
        {loading ? "Attendi…" : isFree ? "Crea account" : "Continua al pagamento"}
      </button>
      {!isFree && (
        <p className="text-xs text-gray-400 text-center">
          Nel passaggio successivo inserisci i dati della carta, in modo sicuro tramite Stripe.
        </p>
      )}
    </form>
  );
}

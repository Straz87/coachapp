"use client";

import { useState } from "react";
import Link from "next/link";

export default function PublicSignupForm({
  trainerId,
  groupId,
  programId,
}: {
  trainerId: string;
  groupId?: string;
  programId?: string;
}) {
  const [form, setForm] = useState({ fullName: "", email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Se il visitatore ha già un account (es. aveva iniziato l'iscrizione
  // un'altra volta e poi abbandonato il pagamento), la creazione di un
  // nuovo account fallisce sempre con questo errore. Mostrargli solo il
  // testo lo lasciava bloccato senza sapere cosa fare: ora aggiungiamo un
  // link diretto al login, da cui — se l'abbonamento è ancora in attesa di
  // pagamento — trova il pulsante per completare il pagamento da solo.
  const accountExists = error?.toLowerCase().includes("esiste già un account");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/public/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trainerId, groupId, programId, ...form }),
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
        <p className="text-xs text-gray-400 mt-1">Ti servirà per accedere alla tua area dopo l&apos;iscrizione.</p>
      </div>

      {error && (
        <div>
          <p className="text-red-600 text-sm">{error}</p>
          {accountExists && (
            <Link href="/login" className="text-sm font-semibold text-brand-dark underline mt-1 inline-block">
              Vai al login →
            </Link>
          )}
        </div>
      )}

      <button type="submit" disabled={loading} className="btn-primary w-full">
        {loading ? "Attendi…" : "Continua al pagamento"}
      </button>
      <p className="text-xs text-gray-400 text-center">
        Nel passaggio successivo inserisci i dati della carta, in modo sicuro tramite Stripe.
      </p>
      <p className="text-xs text-gray-400 text-center">
        Hai già un account?{" "}
        <Link href="/login" className="text-brand-dark underline">
          Accedi
        </Link>
      </p>
    </form>
  );
}

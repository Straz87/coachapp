"use client";

import { useState } from "react";

type Plan =
  | { id: "mensile"; price: number; trialDays: number }
  | { id: "unico"; total: number; months: number };

// Form della pagina pubblica /iscriviti/invito/[token]: il cliente sceglie il
// piano (abbonamento mensile oppure pagamento unico, se il trainer li ha
// offerti entrambi) e inserisce nome, email e password.
export default function InviteSignupForm({
  token,
  plans,
  manual = false,
  defaultName = "",
}: {
  token: string;
  plans: Plan[];
  manual?: boolean;
  defaultName?: string;
}) {
  const [plan, setPlan] = useState<Plan["id"] | null>(plans[0]?.id ?? null);
  const [form, setForm] = useState({ fullName: defaultName, email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const chosen = plans.find((p) => p.id === plan) || null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/public/signup-invito", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, plan, ...form }),
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

  const payByCard = !manual && !!chosen;
  const label = !payByCard
    ? "Crea account"
    : chosen!.id === "unico"
    ? `Crea account e paga ${chosen!.total} €`
    : "Crea account e continua al pagamento";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {plans.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">{plans.length > 1 ? "Scegli come pagare" : "Il tuo piano"}</p>
          {plans.map((p) => {
            const active = plan === p.id;
            return (
              <button
                type="button"
                key={p.id}
                onClick={() => setPlan(p.id)}
                className={`w-full text-left rounded-xl border-2 px-4 py-3 transition ${
                  active ? "border-gray-900 bg-white" : "border-gray-200 bg-white/60"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">
                    {p.id === "mensile" ? "Abbonamento mensile" : "Pagamento unico"}
                  </span>
                  <span
                    className={`w-4 h-4 rounded-full border-2 ${
                      active ? "border-gray-900 bg-gray-900" : "border-gray-300"
                    }`}
                  />
                </div>
                {p.id === "mensile" ? (
                  <>
                    <p className="text-2xl font-semibold mt-1">
                      {p.price} € <span className="text-sm font-normal text-gray-500">al mese</span>
                    </p>
                    <p className="text-xs text-gray-500">
                      {p.trialDays > 0 ? `${p.trialDays} giorni di prova gratuita, poi si rinnova ogni mese` : "Si rinnova ogni mese, disdici quando vuoi"}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-2xl font-semibold mt-1">
                      {p.total} € <span className="text-sm font-normal text-gray-500">una volta sola</span>
                    </p>
                    <p className="text-xs text-gray-500">
                      {p.months} mesi di coaching, cioè {(p.total / p.months).toFixed(0)} € al mese, senza rinnovo automatico
                    </p>
                  </>
                )}
              </button>
            );
          })}
        </div>
      )}

      <div className="card space-y-4">
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
          <p className="text-xs text-gray-400 mt-1">Ti servirà per accedere alla tua area.</p>
        </div>

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? "Attendi…" : label}
        </button>
        <p className="text-xs text-gray-400 text-center">
          {payByCard
            ? "Pagamento sicuro con carta, tramite Stripe."
            : manual && plans.length > 0
            ? "Pagherai di persona al tuo coach: l'accesso si attiva appena lui conferma."
            : ""}
        </p>
      </div>
    </form>
  );
}

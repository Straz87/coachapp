"use client";

import { useState } from "react";

// Pulsante nella schermata di blocco (abbonamento scaduto/sospeso): il
// cliente genera da solo un link di pagamento Stripe per se stesso e viene
// mandato direttamente al checkout, senza dover aspettare che il trainer
// gli mandi un link a mano.
export default function ReactivatePaymentButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/cliente/checkout-link", { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.url) {
        setError(data?.error || "Errore durante la generazione del link di pagamento.");
        setLoading(false);
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("Errore di connessione. Riprova.");
      setLoading(false);
    }
  }

  return (
    <div className="mt-6">
      <button onClick={handleClick} disabled={loading} className="btn-primary">
        {loading ? "Attendere…" : "💳 Paga ora e riattiva"}
      </button>
      {error && <p className="text-red-500 text-sm mt-3">{error}</p>}
    </div>
  );
}

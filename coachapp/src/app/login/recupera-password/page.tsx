"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function RecuperaPasswordPage() {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login/nuova-password`,
    });
    setLoading(false);
    if (error) {
      setError("Non siamo riusciti a inviare l'email. Riprova.");
      return;
    }
    setSent(true);
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="card w-full max-w-sm space-y-4">
        <div className="text-center mb-2">
          <h1 className="text-2xl font-bold">Password dimenticata</h1>
          <p className="text-gray-500 text-sm">
            Inserisci la tua email: ti mandiamo un link per impostarne una nuova.
          </p>
        </div>
        {sent ? (
          <p className="text-sm text-gray-600 text-center">
            Controlla la tua email ({email}): se l&apos;indirizzo è registrato, trovi un link per
            reimpostare la password.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium">Email</label>
              <input type="email" required className="input mt-1" value={email}
                onChange={(e) => setEmail(e.target.value)} placeholder="tuo@email.it" />
            </div>
            {error && <p className="text-red-600 text-sm">{error}</p>}
            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? "Invio…" : "Invia link di recupero"}
            </button>
          </form>
        )}
        <Link href="/login" className="text-sm text-gray-500 text-center block">
          ← Torna al login
        </Link>
      </div>
    </div>
  );
}

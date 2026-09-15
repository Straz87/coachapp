"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function NuovaPasswordPage() {
  const supabase = createClient();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [expired, setExpired] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let isMounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (isMounted && data.session) setReady(true);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" && session) setReady(true);
    });
    const timeout = setTimeout(() => {
      if (isMounted) setReady((r) => { if (!r) setExpired(true); return r; });
    }, 4000);
    return () => { isMounted = false; listener.subscription.unsubscribe(); clearTimeout(timeout); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 6) { setError("La password deve avere almeno 6 caratteri."); return; }
    if (password !== confirm) { setError("Le due password non coincidono."); return; }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (error) { setError("Non siamo riusciti a salvare la nuova password. Riprova."); return; }
    setDone(true);
    setTimeout(() => { router.push("/login"); }, 2000);
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="card w-full max-w-sm space-y-4">
        <div className="text-center mb-2"><h1 className="text-2xl font-bold">Nuova password</h1></div>
        {expired && !ready ? (
          <p className="text-sm text-gray-600 text-center">
            Questo link non è più valido o è scaduto.{" "}
            <a href="/login/recupera-password" className="text-brand-dark font-medium">Richiedine un altro</a>.
          </p>
        ) : done ? (
          <p className="text-sm text-green-600 text-center">Password aggiornata ✓ Ti riportiamo al login…</p>
        ) : !ready ? (
          <p className="text-gray-400 text-sm text-center">Verifica del link in corso…</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium">Nuova password</label>
              <input type="password" required className="input mt-1" value={password}
                onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
            </div>
            <div>
              <label className="text-sm font-medium">Ripeti password</label>
              <input type="password" required className="input mt-1" value={confirm}
                onChange={(e) => setConfirm(e.target.value)} placeholder="••••••••" />
            </div>
            {error && <p className="text-red-600 text-sm">{error}</p>}
            <button type="submit" disabled={saving} className="btn-primary w-full">
              {saving ? "Salvataggio…" : "Salva nuova password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

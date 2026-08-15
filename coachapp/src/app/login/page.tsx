"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);

    if (error) {
      setError("Email o password non corrette.");
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <form onSubmit={handleLogin} className="card w-full max-w-sm space-y-4">
        <div className="text-center mb-2">
          <h1 className="text-2xl font-bold">Bentornato</h1>
          <p className="text-gray-500 text-sm">Accedi al tuo account Hybridmethod</p>
        </div>

        <div>
          <label className="text-sm font-medium">Email</label>
          <input
            type="email"
            required
            className="input mt-1"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tuo@email.it"
          />
        </div>

        <div>
          <label className="text-sm font-medium">Password</label>
          <input
            type="password"
            required
            className="input mt-1"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </div>

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? "Accesso in corso…" : "Accedi"}
        </button>
      </form>
    </div>
  );
}

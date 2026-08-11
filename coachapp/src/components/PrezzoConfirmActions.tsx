"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function PrezzoConfirmActions({ changeId }: { changeId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState<"accept" | "decline" | null>(null);
  const [error, setError] = useState("");
  const [done, setDone] = useState<"accepted" | "declined" | null>(null);

  async function respond(action: "accept" | "decline") {
    setError("");
    setLoading(action);
    try {
      const res = await fetch(`/api/cliente/prezzo/${changeId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || "Si è verificato un errore, riprova.");
        setLoading(null);
        return;
      }
      setDone(data.status);
      router.refresh();
    } catch {
      setError("Si è verificato un errore, riprova.");
      setLoading(null);
    }
  }

  if (done === "accepted") {
    return (
      <div className="rounded-xl bg-green-50 border border-green-200 text-green-800 text-sm p-4">
        Nuovo prezzo confermato. Il tuo abbonamento è aggiornato, grazie!
      </div>
    );
  }

  if (done === "declined") {
    return (
      <div className="rounded-xl bg-gray-50 border border-gray-200 text-gray-700 text-sm p-4">
        Hai rifiutato il nuovo prezzo. Sei stato rimosso dal gruppo e l'abbonamento è stato annullato: nessun
        addebito verrà effettuato.
      </div>
    );
  }

  return (
    <div>
      {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={() => respond("accept")}
          disabled={loading !== null}
          className="flex-1 rounded-full bg-lime-300 hover:bg-lime-400 disabled:opacity-50 text-gray-900 font-semibold py-3 px-6 transition"
        >
          {loading === "accept" ? "Conferma in corso..." : "Accetto il nuovo prezzo"}
        </button>
        <button
          onClick={() => respond("decline")}
          disabled={loading !== null}
          className="flex-1 rounded-full border border-gray-300 hover:bg-gray-50 disabled:opacity-50 text-gray-700 font-semibold py-3 px-6 transition"
        >
          {loading === "decline" ? "Attendere..." : "Rifiuto, esco dal gruppo"}
        </button>
      </div>
    </div>
  );
}

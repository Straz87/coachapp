"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Bottone "Segna come fatto" per la pagina di un singolo giorno di
// programma: stessa chiamata usata da ClientProgramCard sulla home, ma
// qui dopo il salvataggio porta subito alla pagina del nuovo giorno
// corrente (o alla home se il programma e' finito).
export default function ProgramMarkDoneButton({ programId }: { programId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function markDone() {
    setBusy(true);
    try {
      const res = await fetch(`/api/cliente/programmi/${programId}/completa`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        if (data.completed) {
          router.push("/cliente");
        } else {
          router.push(`/cliente/programmi/${programId}/giorno/${data.currentDay}`);
        }
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <button onClick={markDone} disabled={busy} className="btn-primary w-full text-sm">
      {busy ? "Attendi…" : "✓ Segna come fatto"}
    </button>
  );
}

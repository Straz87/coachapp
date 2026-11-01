"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Dati = {
  induction_onboarded: boolean | null;
  induction_phone: string | null;
  induction_city: string | null;
  induction_tax_code: string | null;
  induction_sex: string | null;
  induction_birth_date: string | null;
  induction_height_cm: number | null;
  induction_weight_kg: number | null;
  induction_limitations: string | null;
  induction_health: string | null;
  induction_goal: string | null;
  induction_experience: string | null;
  induction_days_per_week: number | null;
  induction_sports_background: string | null;
  induction_notes: string | null;
};

// Scheda "Dati del cliente" per il trainer: tutto quello che il cliente ha
// compilato dopo l'iscrizione (contatti, salute, obiettivi, misure), in un
// unico posto ordinato. Sostituisce il vecchio riquadro "Cosa vuole dal
// programma" dentro il form abbonamento.
export default function ClientDati({ clientId, email }: { clientId: string; email?: string | null }) {
  const supabase = createClient();
  const [d, setD] = useState<Dati | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("clients")
        .select(
          "induction_onboarded, induction_phone, induction_city, induction_tax_code, induction_sex, induction_birth_date, induction_height_cm, induction_weight_kg, induction_limitations, induction_health, induction_goal, induction_experience, induction_days_per_week, induction_sports_background, induction_notes"
        )
        .eq("id", clientId)
        .maybeSingle();
      setD((data as Dati) || null);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  if (!d) return null;

  const rows: { title: string; items: [string, string | null | undefined][] }[] = [
    {
      title: "Contatti",
      items: [
        ["Email", email && email.endsWith("@invito.hybridmethod.app") ? "In attesa di iscrizione" : email],
        ["Telefono", d.induction_phone],
        ["Città", d.induction_city],
        ["Codice fiscale", d.induction_tax_code],
      ],
    },
    {
      title: "Misure",
      items: [
        ["Sesso", d.induction_sex],
        ["Nascita", d.induction_birth_date ? new Date(d.induction_birth_date).toLocaleDateString("it-IT") : null],
        ["Altezza", d.induction_height_cm ? `${d.induction_height_cm} cm` : null],
        ["Peso", d.induction_weight_kg ? `${d.induction_weight_kg} kg` : null],
      ],
    },
    {
      title: "Salute",
      items: [
        ["Infortuni e limitazioni", d.induction_limitations],
        ["Patologie, farmaci, allergie", d.induction_health],
      ],
    },
    {
      title: "Obiettivi ed esperienza",
      items: [
        ["Obiettivo", d.induction_goal],
        ["Esperienza", d.induction_experience],
        ["Giorni a settimana", d.induction_days_per_week ? String(d.induction_days_per_week) : null],
        ["Sport praticati", d.induction_sports_background],
        ["Note", d.induction_notes],
      ],
    },
  ];

  const hasAny = rows.some((r) => r.items.some(([k, v]) => k !== "Email" && v));

  return (
    <div className="card space-y-4">
      <h2 className="font-semibold">Dati del cliente</h2>
      {!d.induction_onboarded && !hasAny ? (
        <p className="text-sm text-gray-400">Non ha ancora compilato il questionario di benvenuto.</p>
      ) : !hasAny ? (
        <p className="text-sm text-gray-400">Ha saltato il questionario per ora.</p>
      ) : null}
      {rows.map((section) => {
        const filled = section.items.filter(([, v]) => !!v);
        if (filled.length === 0) return null;
        return (
          <div key={section.title}>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1">{section.title}</p>
            <dl className="text-sm space-y-1">
              {filled.map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4">
                  <dt className="text-gray-500">{k}</dt>
                  <dd className="text-right text-gray-800 break-words max-w-[60%]">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        );
      })}
    </div>
  );
}

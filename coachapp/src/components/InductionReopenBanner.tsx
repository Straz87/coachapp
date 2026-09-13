"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import InductionPopup from "./InductionPopup";

// Se il cliente ha chiuso il popup di benvenuto con "Piu tardi" (o non ha
// mai risposto), induction_onboarded resta senza nessuna risposta compilata.
// Invece di perdere per sempre la possibilita' di raccogliere queste info,
// mostriamo qui un piccolo banner permanente (non un popup invadente) che
// gli permette di riaprire lo stesso questionario quando ha tempo. Sparisce
// da solo appena il cliente lo compila davvero.
export default function InductionReopenBanner({ clientId }: { clientId: string }) {
  const supabase = createClient();
  const [show, setShow] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function load() {
      const { data } = await supabase
        .from("clients")
        .select(
          "induction_onboarded, induction_goal, induction_experience, induction_days_per_week, induction_limitations, induction_notes, induction_sex, induction_birth_date, induction_height_cm, induction_weight_kg, induction_sports_background"
        )
        .eq("id", clientId)
        .maybeSingle();

      if (!isMounted || !data) return;

      const hasAnyAnswer = !!(
        data.induction_goal ||
        data.induction_experience ||
        data.induction_days_per_week ||
        data.induction_limitations ||
        data.induction_notes ||
        data.induction_sex ||
        data.induction_birth_date ||
        data.induction_height_cm ||
        data.induction_weight_kg ||
        data.induction_sports_background
      );

      if (data.induction_onboarded && !hasAnyAnswer) {
        setShow(true);
      }
    }
    load();
    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  if (open) {
    return (
      <InductionPopup
        clientId={clientId}
        forceOpen
        onDone={() => {
          setOpen(false);
          setShow(false);
        }}
      />
    );
  }

  if (!show) return null;

  return (
    <button
      onClick={() => setOpen(true)}
      className="w-full text-left mb-4 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600 hover:bg-gray-100 transition"
    >
      📝 Non hai ancora raccontato al trainer i tuoi obiettivi —{" "}
      <span className="font-medium text-gray-800">Compila il questionario quando vuoi</span>
    </button>
  );
}

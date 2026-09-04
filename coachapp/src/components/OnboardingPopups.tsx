"use client";

import { useState } from "react";
import InductionPopup from "./InductionPopup";
import MaxesOnboardingPopup from "./MaxesOnboardingPopup";

// Mostra i due popup di benvenuto in sequenza (prima l'induction, poi i
// massimali) invece che sovrapposti: quando il primo viene chiuso
// (salvato, saltato, o gia' completato in precedenza), passa al secondo.
export default function OnboardingPopups({ clientId }: { clientId: string }) {
  const [inductionDone, setInductionDone] = useState(false);

  if (!inductionDone) {
    return <InductionPopup clientId={clientId} onDone={() => setInductionDone(true)} />;
  }
  return <MaxesOnboardingPopup clientId={clientId} />;
}

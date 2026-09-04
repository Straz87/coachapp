"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const GOALS = [
  "Perdere peso",
  "Aumentare massa muscolare",
  "Migliorare la forma fisica generale",
  "Performance sportiva",
  "Tornare in forma dopo un infortunio",
];

const LEVELS = ["Principiante", "Intermedio", "Avanzato"];

const DAYS_OPTIONS = [2, 3, 4, 5, 6];

// Popup facoltativo che compare una sola volta sulla home del cliente per
// chiedere obiettivo, livello, disponibilita e limitazioni fisiche, cosi
// il trainer sa subito cosa vuole il cliente dal programma. Si puo
// saltare con "Piu tardi" e non ricompare piu (stesso pattern del popup
// massimali). Usa il flag induction_onboarded sulla tabella clients.
export default function InductionPopup({ clientId, onDone }: { clientId: string; onDone: () => void }) {
  const supabase = createClient();
  const [visible, setVisible] = useState(false);
  const [goal, setGoal] = useState("");
  const [experience, setExperience] = useState("");
  const [daysPerWeek, setDaysPerWeek] = useState("");
  const [limitations, setLimitations] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function load() {
      const { data: client } = await supabase
        .from("clients")
        .select("induction_onboarded")
        .eq("id", clientId)
        .maybeSingle();

      if (!isMounted) return;
      if (client?.induction_onboarded) {
        onDone();
        return;
      }
      setVisible(true);
    }
    load();
    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  async function handleSkip() {
    setSaving(true);
    try {
      await fetch("/api/cliente/induction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skip: true }),
      });
    } catch (e) {}
    setSaving(false);
    setVisible(false);
    onDone();
  }

  async function handleSave() {
    setSaving(true);
    try {
      await fetch("/api/cliente/induction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal, experience, daysPerWeek, limitations, notes }),
      });
    } catch (e) {}
    setSaving(false);
    setVisible(false);
    onDone();
  }

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl flex flex-col max-h-[85vh]">
        <div className="p-5 pb-3 border-b border-gray-100 shrink-0">
          <h2 className="font-semibold">Benvenuto! Facciamo due chiacchiere</h2>
          <p className="text-xs text-gray-400 mt-1">Facoltativo: rispondi cosi il tuo trainer puo costruire il programma giusto per te.</p>
        </div>
        <div className="p-5 py-3 overflow-y-auto space-y-4">
          <div>
            <label className="text-sm text-gray-600 block mb-1">Qual e il tuo obiettivo principale?</label>
            <select className="input w-full" value={goal} onChange={(e) => setGoal(e.target.value)}>
              <option value="">Seleziona...</option>
              {GOALS.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm text-gray-600 block mb-1">Livello di esperienza</label>
            <div className="flex gap-2">
              {LEVELS.map((lvl) => <button key={lvl} type="button" onClick={() => setExperience(lvl)} className={"flex-1 text-xs py-2 rounded-lg border " + (experience === lvl ? "border-black bg-black text-white" : "border-gray-200 text-gray-600")}>{lvl}</button>)}
            </div>
          </div>
          <div>
            <label className="text-sm text-gray-600 block mb-1">Quanti giorni a settimana puoi allenarti?</label>
            <select className="input w-full" value={daysPerWeek} onChange={(e) => setDaysPerWeek(e.target.value)}>
              <option value="">Seleziona...</option>
              {DAYS_OPTIONS.map((d) => <option key={d} value={d}>{d} giorni</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm text-gray-600 block mb-1">Infortuni o limitazioni fisiche</label>
            <textarea className="input w-full" rows={2} placeholder="Es. dolore alla spalla destra, nessuno..." value={limitations} onChange={(e) => setLimitations(e.target.value)} />
          </div>
          <div>
            <label className="text-sm text-gray-600 block mb-1">Altro che vorresti farci sapere</label>
            <textarea className="input w-full" rows={2} placeholder="Preferenze, orari, sport praticati..." value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <div className="p-5 pt-3 border-t border-gray-100 flex gap-2 shrink-0">
          <button onClick={handleSkip} disabled={saving} className="btn-secondary flex-1">Piu tardi</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">{saving ? "Invio..." : "Invia al trainer"}</button>
        </div>
      </div>
    </div>
  );
}

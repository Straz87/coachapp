"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type ClientOption = { id: string; name: string };
type Program = {
  id: string;
  name: string;
  description: string | null;
  lengthDays: number;
  memberIds: string[];
  public: boolean;
  price: number | null;
  trialDays: number;
};

export default function ProgramManager({
  trainerId,
  clients,
  initialPrograms,
}: {
  trainerId: string;
  clients: ClientOption[];
  initialPrograms: Program[];
}) {
  const supabase = createClient();
  const [programs, setPrograms] = useState<Program[]>(initialPrograms);
  const [newName, setNewName] = useState("");
  const [newLength, setNewLength] = useState("28");
  const [creating, setCreating] = useState(false);
  const [openProgram, setOpenProgram] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  async function createProgram() {
    const name = newName.trim();
    const lengthDays = Math.max(1, Number(newLength) || 28);
    if (!name) return;
    setCreating(true);
    const { data } = await supabase
      .from("programs")
      .insert({ trainer_id: trainerId, name, length_days: lengthDays })
      .select()
      .single();
    if (data) {
      setPrograms((p) => [
        {
          id: data.id,
          name: data.name,
          description: data.description,
          lengthDays: data.length_days,
          memberIds: [],
          public: false,
          price: null,
          trialDays: 0,
        },
        ...p,
      ]);
      setOpenProgram(data.id);
    }
    setNewName("");
    setNewLength("28");
    setCreating(false);
  }

  async function deleteProgram(programId: string) {
    if (
      !confirm("Eliminare questo programma? Verranno rimossi anche i giorni e le iscrizioni collegate.")
    )
      return;
    await supabase.from("programs").delete().eq("id", programId);
    setPrograms((p) => p.filter((x) => x.id !== programId));
  }

  async function toggleMember(programId: string, clientId: string, isMember: boolean) {
    setPrograms((p) =>
      p.map((prg) =>
        prg.id === programId
          ? {
              ...prg,
              memberIds: isMember
                ? prg.memberIds.filter((id) => id !== clientId)
                : [...prg.memberIds, clientId],
            }
          : prg
      )
    );
    if (isMember) {
      await supabase.from("program_members").delete().eq("program_id", programId).eq("client_id", clientId);
    } else {
      await supabase
        .from("program_members")
        .insert({ program_id: programId, client_id: clientId, current_day: 1 });
    }
  }

  return (
    <div className="space-y-4">
      <div className="card flex flex-col sm:flex-row gap-2 items-stretch sm:items-end">
        <div className="flex-1 flex flex-col gap-1">
          <label className="text-xs text-gray-500">Nome programma</label>
          <input
            className="input"
            placeholder="Es. Percorso 8 settimane"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1 sm:w-28">
          <label className="text-xs text-gray-500">Giorni</label>
          <input
            type="number"
            min={1}
            className="input"
            value={newLength}
            onChange={(e) => setNewLength(e.target.value)}
          />
        </div>
        <button onClick={createProgram} disabled={creating || !newName.trim()} className="btn-primary">
          + Crea programma
        </button>
      </div>

      {programs.length === 0 ? (
        <p className="text-gray-400 text-sm">Nessun programma ancora creato.</p>
      ) : (
        programs.map((program) => {
          const open = openProgram === program.id;
          return (
            <div key={program.id} className="card">
              <div className="flex items-center justify-between gap-2">
                <button
                  onClick={() => setOpenProgram(open ? null : program.id)}
                  className="flex items-center gap-2 text-left flex-1 min-w-0"
                >
                  <span className="font-semibold truncate">{program.name}</span>
                  <span className="text-xs text-gray-400 shrink-0">{program.lengthDays} giorni</span>
                  <span className="text-xs text-gray-400 shrink-0">
                    {program.memberIds.length} {program.memberIds.length === 1 ? "iscritto" : "iscritti"}
                  </span>
                  {program.public && (
                    <span className="text-xs bg-green-100 text-green-700 rounded-full px-2 py-0.5 font-medium shrink-0">
                      Link attivo
                    </span>
                  )}
                </button>
                <Link href={`/trainer/programmi/${program.id}`} className="btn-secondary text-sm shrink-0">
                  Apri
                </Link>
                <button
                  onClick={() => deleteProgram(program.id)}
                  className="text-gray-400 hover:text-red-600 text-sm px-2 shrink-0"
                >
                  Elimina
                </button>
              </div>

              {open && (
                <div className="mt-3 pt-3 border-t border-gray-100 space-y-4">
                  <ProgramSignupSettings
                    trainerId={trainerId}
                    program={program}
                    onSaved={(updated) =>
                      setPrograms((p) => p.map((x) => (x.id === program.id ? { ...x, ...updated } : x)))
                    }
                    origin={origin}
                  />

                  <div className="pt-3 border-t border-gray-100 space-y-1">
                    <p className="text-xs font-medium text-gray-500 mb-1">Iscritti</p>
                    {clients.length === 0 ? (
                      <p className="text-gray-400 text-sm">Nessun cliente disponibile.</p>
                    ) : (
                      clients.map((c) => {
                        const isMember = program.memberIds.includes(c.id);
                        return (
                          <label key={c.id} className="flex items-center gap-2 text-sm py-1 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={isMember}
                              onChange={() => toggleMember(program.id, c.id, isMember)}
                            />
                            {c.name}
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

function ProgramSignupSettings({
  trainerId,
  program,
  onSaved,
  origin,
}: {
  trainerId: string;
  program: Program;
  onSaved: (updated: Partial<Program>) => void;
  origin: string;
}) {
  const [isPublic, setIsPublic] = useState(program.public);
  const [price, setPrice] = useState(program.price != null ? program.price.toString() : "");
  const [trialDays, setTrialDays] = useState(program.trialDays ? program.trialDays.toString() : "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const link = `${origin}/iscriviti-programma/${trainerId}/${program.id}`;

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/trainer/programmi/${program.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          public: isPublic,
          price: price === "" ? 0 : Number(price),
          trialDays: trialDays ? Number(trialDays) : 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Errore nel salvataggio");
      } else {
        onSaved({
          public: isPublic,
          price: price === "" ? 0 : Number(price),
          trialDays: trialDays ? Number(trialDays) : 0,
        });
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      }
    } catch {
      setError("Errore di rete, riprova");
    } finally {
      setSaving(false);
    }
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-3">
      <p className="text-xs font-medium text-gray-500">Link pubblico di questo programma</p>

      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
        Pubblico (chi ha il link può iscriversi da solo, partendo dal giorno 1)
      </label>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-gray-500">Prezzo (€/mese, 0 = gratis)</label>
          <input
            type="number"
            min={0}
            placeholder="0"
            className="input mt-1 text-sm"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-500">Giorni di prova gratuita</label>
          <input
            type="number"
            min={0}
            placeholder="0"
            className="input mt-1 text-sm"
            value={trialDays}
            onChange={(e) => setTrialDays(e.target.value)}
          />
        </div>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex items-center gap-3">
        <button onClick={handleSave} disabled={saving} className="btn-secondary text-sm">
          {saving ? "Salvataggio…" : "Salva impostazioni"}
        </button>
        {saved && <span className="text-green-600 text-sm">Salvato ✓</span>}
      </div>

      {program.public && (
        <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
          <input
            readOnly
            value={link}
            className="flex-1 bg-transparent text-xs text-gray-600 outline-none truncate"
            onFocus={(e) => e.target.select()}
          />
          <button onClick={handleCopy} className="text-xs text-brand-dark font-medium shrink-0">
            {copied ? "Copiato ✓" : "Copia"}
          </button>
        </div>
      )}
    </div>
  );
}

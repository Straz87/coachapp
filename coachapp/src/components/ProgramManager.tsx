"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type ClientOption = { id: string; name: string };
type Program = {
  id: string;
  name: string;
  description: string | null;
  showInVetrina: boolean;
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
          showInVetrina: data.show_in_vetrina ?? false,
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
                  {program.showInVetrina && (
                    <span className="text-xs bg-blue-100 text-blue-700 rounded-full px-2 py-0.5 font-medium shrink-0">
                      In vetrina
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

                  <div className="pt-3 border-t border-gray-100">
                    <ProgramMembersProgress programId={program.id} lengthDays={program.lengthDays} clients={clients} />
                  </div>

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
  const [showInVetrina, setShowInVetrina] = useState(program.showInVetrina);
  const [price, setPrice] = useState(program.price != null ? program.price.toString() : "");
  const [trialDays, setTrialDays] = useState(program.trialDays ? program.trialDays.toString() : "");
  const [lengthDays, setLengthDays] = useState(program.lengthDays ? program.lengthDays.toString() : "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const link = `${origin}/s/${program.id.slice(0, 8)}`;

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/trainer/programmi/${program.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          public: isPublic,
          showInVetrina,
          price: price === "" ? 0 : Number(price),
          trialDays: trialDays ? Number(trialDays) : 0,
          lengthDays: lengthDays ? Number(lengthDays) : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Errore nel salvataggio");
      } else {
        onSaved({
          public: isPublic,
          showInVetrina,
          price: price === "" ? 0 : Number(price),
          trialDays: trialDays ? Number(trialDays) : 0,
          lengthDays: lengthDays ? Number(lengthDays) : program.lengthDays,
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

      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input
          type="checkbox"
          checked={showInVetrina}
          onChange={(e) => setShowInVetrina(e.target.checked)}
        />
        Mostra nella pagina vetrina pubblica
      </label>

        <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="text-xs font-medium text-gray-500">Durata (giorni)</label>
          <input
            type="number"
            min={1}
            placeholder="28"
            className="input mt-1 text-sm"
            value={lengthDays}
            onChange={(e) => setLengthDays(e.target.value)}
          />
        </div>
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

function ProgramMembersProgress({
  programId,
  lengthDays,
  clients,
}: {
  programId: string;
  lengthDays: number;
  clients: ClientOption[];
}) {
  const supabase = createClient();
  const [rows, setRows] = useState<
    | null
    | {
        clientId: string;
        name: string;
        currentDay: number;
        completed: boolean;
        daysSinceActivity: number | null;
      }[]
  >(null);

  useEffect(() => {
    let isMounted = true;
    async function load() {
      const { data: members } = await supabase
        .from("program_members")
        .select("id, client_id, current_day, completed, started_at")
        .eq("program_id", programId);

      if (!members || members.length === 0) {
        if (isMounted) setRows([]);
        return;
      }

      const memberIds = members.map((m: any) => m.id);
      const { data: progress } = await supabase
        .from("program_progress")
        .select("program_member_id, completed_at")
        .in("program_member_id", memberIds)
        .order("completed_at", { ascending: false });

      const lastActivity = new Map<string, string>();
      (progress || []).forEach((p: any) => {
        if (!lastActivity.has(p.program_member_id)) {
          lastActivity.set(p.program_member_id, p.completed_at);
        }
      });

      const now = Date.now();
      const result = members.map((m: any) => {
        const clientName = clients.find((c) => c.id === m.client_id)?.name || "Cliente";
        const lastAt = lastActivity.get(m.id) || m.started_at;
        const daysSinceActivity = lastAt ? Math.floor((now - new Date(lastAt).getTime()) / 86400000) : null;
        return {
          clientId: m.client_id as string,
          name: clientName,
          currentDay: m.current_day as number,
          completed: m.completed as boolean,
          daysSinceActivity,
        };
      });

      result.sort((a, b) => a.name.localeCompare(b.name));
      if (isMounted) setRows(result);
    }
    load();
    return () => {
      isMounted = false;
    };
  }, [programId]);

  if (rows === null) return <p className="text-gray-400 text-sm">Caricamento…</p>;
  if (rows.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-gray-500 mb-1">Progressi</p>
      {rows.map((r) => {
        const percent = r.completed ? 100 : Math.min(100, Math.round(((r.currentDay - 1) / lengthDays) * 100));
        const stalled = !r.completed && r.daysSinceActivity !== null && r.daysSinceActivity >= 5;
        return (
          <div key={r.clientId} className={`rounded-lg px-2 py-2 ${stalled ? "bg-amber-50" : ""}`}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium">{r.name}</span>
              {r.completed ? (
                <span className="text-xs font-medium text-green-700">✓ Completato</span>
              ) : stalled ? (
                <span className="text-xs font-medium text-amber-700">Fermo da {r.daysSinceActivity} giorni</span>
              ) : (
                <span className="text-xs text-gray-400">giorno {r.currentDay}/{lengthDays}</span>
              )}
            </div>
            <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
              <div
                className={`h-full ${r.completed ? "bg-green-600" : stalled ? "bg-amber-500" : "bg-emerald-600"}`}
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

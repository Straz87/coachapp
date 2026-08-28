"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type ClientOption = { id: string; name: string };
type Group = {
  id: string;
  name: string;
  description: string | null;
  memberIds: string[];
  public: boolean;
  price: number | null;
  trialDays: number;
};

export default function GroupManager({
  trainerId,
  clients,
  initialGroups,
}: {
  trainerId: string;
  clients: ClientOption[];
  initialGroups: Group[];
}) {
  const supabase = createClient();
  const [groups, setGroups] = useState<Group[]>(initialGroups);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  async function createGroup() {
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    const { data } = await supabase
      .from("workout_groups")
      .insert({ trainer_id: trainerId, name })
      .select()
      .single();
    if (data) {
      setGroups((g) => [
        { id: data.id, name: data.name, description: data.description, memberIds: [], public: false, price: null, trialDays: 0 },
        ...g,
      ]);
      setOpenGroup(data.id);
    }
    setNewName("");
    setCreating(false);
  }

  async function deleteGroup(groupId: string) {
    if (!confirm("Eliminare questo gruppo? Verranno rimossi anche gli allenamenti di gruppo collegati.")) return;
    await supabase.from("workout_groups").delete().eq("id", groupId);
    setGroups((g) => g.filter((x) => x.id !== groupId));
  }

  async function toggleMember(groupId: string, clientId: string, isMember: boolean) {
    setGroups((g) =>
      g.map((grp) =>
        grp.id === groupId
          ? {
              ...grp,
              memberIds: isMember
                ? grp.memberIds.filter((id) => id !== clientId)
                : [...grp.memberIds, clientId],
            }
          : grp
      )
    );
    if (isMember) {
      await supabase.from("group_members").delete().eq("group_id", groupId).eq("client_id", clientId);
    } else {
      await supabase.from("group_members").insert({ group_id: groupId, client_id: clientId });
    }
  }

  return (
    <div className="space-y-4">
      <div className="card flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
        <input
          className="input flex-1"
          placeholder="Nome gruppo (es. CrossFit)"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <button onClick={createGroup} disabled={creating || !newName.trim()} className="btn-primary">
          + Crea gruppo
        </button>
      </div>

      {groups.length === 0 ? (
        <p className="text-gray-400 text-sm">Nessun gruppo ancora creato.</p>
      ) : (
        groups.map((group) => {
          const open = openGroup === group.id;
          return (
            <div key={group.id} className="card">
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setOpenGroup(open ? null : group.id)}
                  className="flex items-center gap-2 text-left flex-1"
                >
                  <span className="font-semibold">{group.name}</span>
                  <span className="text-xs text-gray-400">
                    {group.memberIds.length} {group.memberIds.length === 1 ? "membro" : "membri"}
                  </span>
                  {group.public && (
                    <span className="text-xs bg-green-100 text-green-700 rounded-full px-2 py-0.5 font-medium">
                      Link attivo
                    </span>
                  )}
                </button>
                <button
                  onClick={() => deleteGroup(group.id)}
                  className="text-gray-400 hover:text-red-600 text-sm px-2"
                >
                  Elimina
                </button>
              </div>

              {open && (
                <div className="mt-3 pt-3 border-t border-gray-100 space-y-4">
                  <GroupSignupSettings
                    trainerId={trainerId}
                    group={group}
                    onSaved={(updated) =>
                      setGroups((g) => g.map((x) => (x.id === group.id ? { ...x, ...updated } : x)))
                    }
                    origin={origin}
                  />

                  <div className="pt-3 border-t border-gray-100 space-y-1">
                    <p className="text-xs font-medium text-gray-500 mb-1">Membri</p>
                    {clients.length === 0 ? (
                      <p className="text-gray-400 text-sm">Nessun cliente disponibile.</p>
                    ) : (
                      clients.map((c) => {
                        const isMember = group.memberIds.includes(c.id);
                        return (
                          <label key={c.id} className="flex items-center gap-2 text-sm py-1 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={isMember}
                              onChange={() => toggleMember(group.id, c.id, isMember)}
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

function GroupSignupSettings({
  trainerId,
  group,
  onSaved,
  origin,
}: {
  trainerId: string;
  group: Group;
  onSaved: (updated: Partial<Group>) => void;
  origin: string;
}) {
  const [isPublic, setIsPublic] = useState(group.public);
  const [price, setPrice] = useState(group.price != null ? group.price.toString() : "");
  const [trialDays, setTrialDays] = useState(group.trialDays ? group.trialDays.toString() : "");
  const [description, setDescription] = useState(group.description || "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const link = `${origin}/s/${group.id.slice(0, 8)}`;

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/trainer/gruppi/${group.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          public: isPublic,
          price: price === "" ? 0 : Number(price),
          trialDays: trialDays ? Number(trialDays) : 0,
          description,
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
          description,
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
      <p className="text-xs font-medium text-gray-500">Link pubblico di questo gruppo</p>

      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
        Pubblico (chi ha il link può iscriversi da solo)
      </label>

      <div>
        <label className="text-xs font-medium text-gray-500">Mini bio (mostrata nella pagina vetrina)</label>
        <textarea
          className="input mt-1 text-sm w-full"
          rows={2}
          maxLength={200}
          placeholder="Es. Allenamenti di gruppo in stile CrossFit, 3 volte a settimana."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

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
      <p className="text-xs text-gray-400">
        Anche i gruppi gratuiti raccolgono la carta al momento dell&apos;iscrizione: così, se in futuro
        metti un prezzo, l&apos;addebito può partire in automatico su chi è già dentro, senza doverlo
        ricontattare.
      </p>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex items-center gap-3">
        <button onClick={handleSave} disabled={saving} className="btn-secondary text-sm">
          {saving ? "Salvataggio…" : "Salva impostazioni"}
        </button>
        {saved && <span className="text-green-600 text-sm">Salvato ✓</span>}
      </div>

      {group.public && (
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

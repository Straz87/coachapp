"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type ClientOption = { id: string; name: string };
type Group = { id: string; name: string; memberIds: string[] };

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
      setGroups((g) => [{ id: data.id, name: data.name, memberIds: [] }, ...g]);
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
                </button>
                <button
                  onClick={() => deleteGroup(group.id)}
                  className="text-gray-400 hover:text-red-600 text-sm px-2"
                >
                  Elimina
                </button>
              </div>

              {open && (
                <div className="mt-3 pt-3 border-t border-gray-100 space-y-1">
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
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

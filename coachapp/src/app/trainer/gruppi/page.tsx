import { requireTrainer } from "@/lib/auth";
import GroupManager from "@/components/GroupManager";

export default async function GruppiPage() {
  const { supabase, profile } = await requireTrainer();

  const { data: groups } = await supabase
    .from("workout_groups")
    .select("id, name, created_at, group_members(client_id)")
    .eq("trainer_id", profile.id)
    .order("created_at", { ascending: false });

  const { data: clients } = await supabase
    .from("clients")
    .select("id, profiles:profile_id(full_name)")
    .eq("trainer_id", profile.id)
    .order("created_at", { ascending: false });

  const clientOptions = (clients || []).map((c: any) => ({
    id: c.id,
    name: c.profiles?.full_name || "Cliente",
  }));

  const groupsData = (groups || []).map((g: any) => ({
    id: g.id,
    name: g.name,
    memberIds: (g.group_members || []).map((m: any) => m.client_id),
  }));

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">Gruppi</h1>
      <p className="text-gray-500 text-sm mb-6">
        Crea un gruppo (es. &quot;CrossFit&quot;) e aggiungi i clienti che lo seguono. Poi, dal calendario,
        potrai assegnare un allenamento all&apos;intero gruppo invece che a un cliente alla volta: chi è
        iscritto lo vede automaticamente, ogni giorno.
      </p>
      <GroupManager trainerId={profile.id} clients={clientOptions} initialGroups={groupsData} />
    </div>
  );
}

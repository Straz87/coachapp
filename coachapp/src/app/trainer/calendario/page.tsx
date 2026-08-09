import { requireTrainer } from "@/lib/auth";
import ClientSelector from "@/components/ClientSelector";
import GroupSelector from "@/components/GroupSelector";
import WeekCalendar from "@/components/WeekCalendar";
import GroupWeekCalendar from "@/components/GroupWeekCalendar";

export default async function CalendarioPage({
  searchParams,
}: {
  searchParams: { cliente?: string; gruppo?: string; data?: string };
}) {
  const { supabase, profile } = await requireTrainer();

  const { data: clients } = await supabase
    .from("clients")
    .select("id, profiles:profile_id(full_name)")
    .eq("trainer_id", profile.id)
    .order("created_at", { ascending: false });

  const { data: groups } = await supabase
    .from("workout_groups")
    .select("id, name")
    .eq("trainer_id", profile.id)
    .order("created_at", { ascending: false });

  const clientOptions = (clients || []).map((c: any) => ({
    id: c.id,
    name: c.profiles?.full_name || "Cliente",
  }));

  const groupOptions = (groups || []).map((g: any) => ({
    id: g.id,
    name: g.name,
  }));

  const selectedClientId = searchParams.cliente || null;
  const selectedGroupId = searchParams.gruppo || null;
  const initialDate = searchParams.data || null;

  const selectedClientName = clientOptions.find((c) => c.id === selectedClientId)?.name;
  const selectedGroupName = groupOptions.find((g) => g.id === selectedGroupId)?.name;
  const trainerName = (profile as any).full_name || "Coach";

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Calendario allenamenti</h1>
      <div className="mb-6 flex flex-col sm:flex-row gap-4">
        <div>
          <p className="text-xs text-gray-400 mb-1">Cliente singolo</p>
          <ClientSelector clients={clientOptions} selected={selectedClientId} />
        </div>
        <div>
          <p className="text-xs text-gray-400 mb-1">Gruppo (allenamento condiviso)</p>
          <GroupSelector groups={groupOptions} selected={selectedGroupId} />
        </div>
      </div>

      {selectedGroupId ? (
        <GroupWeekCalendar
          groupId={selectedGroupId}
          trainerId={profile.id}
          groupName={selectedGroupName}
          trainerName={trainerName}
          initialDate={initialDate}
        />
      ) : selectedClientId ? (
        <WeekCalendar
          clientId={selectedClientId}
          trainerId={profile.id}
          clientName={selectedClientName}
          trainerName={trainerName}
          initialDate={initialDate}
        />
      ) : (
        <p className="text-gray-400">
          Seleziona un cliente per una scheda individuale, oppure un gruppo per assegnare lo stesso
          allenamento a tutti i suoi membri.
        </p>
      )}
    </div>
  );
}

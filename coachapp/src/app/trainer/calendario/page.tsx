import { requireTrainer } from "@/lib/auth";
import ClientSelector from "@/components/ClientSelector";
import WeekCalendar from "@/components/WeekCalendar";

export default async function CalendarioPage({
  searchParams,
}: {
  searchParams: { cliente?: string };
}) {
  const { supabase, profile } = await requireTrainer();

  const { data: clients } = await supabase
    .from("clients")
    .select("id, profiles:profile_id(full_name)")
    .eq("trainer_id", profile.id)
    .order("created_at", { ascending: false });

  const options = (clients || []).map((c: any) => ({
    id: c.id,
    name: c.profiles?.full_name || "Cliente",
  }));

  const selectedId = searchParams.cliente || null;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Calendario allenamenti</h1>
      <div className="mb-6">
        <ClientSelector clients={options} selected={selectedId} />
      </div>

      {selectedId ? (
        <WeekCalendar clientId={selectedId} trainerId={profile.id} />
      ) : (
        <p className="text-gray-400">Seleziona un cliente per vedere/assegnare gli allenamenti.</p>
      )}
    </div>
  );
}

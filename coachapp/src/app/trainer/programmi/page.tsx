import { requireTrainer } from "@/lib/auth";
import ProgramManager from "@/components/ProgramManager";

export default async function ProgrammiPage() {
  const { supabase, profile } = await requireTrainer();

  const { data: programs } = await supabase
    .from("programs")
    .select("*, program_members(client_id)")
    .eq("trainer_id", profile.id)
    .order("created_at", { ascending: false });

  const { data: clientsRaw } = await supabase
    .from("clients")
    .select("id, profiles:profile_id(full_name)")
    .eq("trainer_id", profile.id);

  const clients = (clientsRaw || []).map((c: any) => ({
    id: c.id,
    name: c.profiles?.full_name || "Cliente",
  }));

  const initialPrograms = (programs || []).map((p: any) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    showInVetrina: p.show_in_vetrina,
    lengthDays: p.length_days,
    public: p.public,
    price: p.price,
    trialDays: p.trial_days,
    memberIds: (p.program_members || []).map((m: any) => m.client_id),
  }));

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">Programmi</h1>
      <p className="text-gray-500 text-sm mb-6">
        Percorsi pronti a durata fissa: ogni iscritto avanza al proprio ritmo, dal giorno 1, quando segna
        gli allenamenti come fatti.
      </p>
      <ProgramManager trainerId={profile.id} clients={clients} initialPrograms={initialPrograms} />
    </div>
  );
}

import { requireClientRole } from "@/lib/auth";
import ProgressHistory from "@/components/ProgressHistory";
import ExerciseProgress from "@/components/ExerciseProgress";

export default async function ProgressiPage() {
  const { supabase, profile } = await requireClientRole();

  const { data: client } = await supabase
    .from("clients")
    .select("id")
    .eq("profile_id", profile.id)
    .single();

  if (!client) return null;

  return (
    <div className="max-w-xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold mb-6">I miei progressi</h1>
        <ProgressHistory clientId={client.id} />
      </div>

      <div>
        <h2 className="text-xl font-bold mb-4">Progressioni di carico</h2>
        <ExerciseProgress clientId={client.id} />
      </div>
    </div>
  );
}

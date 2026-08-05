import { requireClientRole } from "@/lib/auth";

export default async function ClienteDietaPage() {
  const { supabase, profile } = await requireClientRole();

  const { data: client } = await supabase
    .from("clients")
    .select("id")
    .eq("profile_id", profile.id)
    .single();

  if (!client) return null;

  const { data: plan } = await supabase
    .from("diet_plans")
    .select("*")
    .eq("client_id", client.id)
    .maybeSingle();

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-bold mb-6">Il mio piano alimentare</h1>
      {plan ? (
        <div className="card">
          <h2 className="font-semibold mb-3">{plan.title}</h2>
          <p className="whitespace-pre-wrap text-sm text-gray-700">{plan.content}</p>
          <p className="text-xs text-gray-400 mt-4">
            Aggiornato il {new Date(plan.updated_at).toLocaleDateString("it-IT")}
          </p>
        </div>
      ) : (
        <p className="text-gray-400">Il tuo trainer non ha ancora assegnato un piano alimentare.</p>
      )}
    </div>
  );
}

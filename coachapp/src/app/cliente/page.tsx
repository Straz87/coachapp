import { requireClientRole } from "@/lib/auth";
import ClientWeekView from "@/components/ClientWeekView";

export default async function ClienteHome() {
  const { supabase, profile } = await requireClientRole();

  const { data: client } = await supabase
    .from("clients")
    .select("id")
    .eq("profile_id", profile.id)
    .single();

  if (!client) {
    return <p className="text-gray-400">Il tuo trainer non ti ha ancora collegato ad un profilo.</p>;
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-1">Ciao {profile.full_name.split(" ")[0]} 👋</h1>
      <p className="text-gray-500 text-sm mb-6">Ecco i tuoi allenamenti della settimana.</p>
      <ClientWeekView clientId={client.id} />
    </div>
  );
}

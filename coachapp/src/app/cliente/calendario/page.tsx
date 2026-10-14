import { requireClientRole } from "@/lib/auth";
import ClientWeekView from "@/components/ClientWeekView";

export default async function ClienteCalendario() {
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
      <h1 className="text-2xl font-bold mb-4">Calendario</h1>
      <ClientWeekView clientId={client.id} />
    </div>
  );
}

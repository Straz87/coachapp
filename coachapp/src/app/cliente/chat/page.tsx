import { requireClientRole } from "@/lib/auth";
import ChatThread from "@/components/ChatThread";

export default async function ClienteChatPage() {
  const { supabase, profile } = await requireClientRole();

  const { data: client } = await supabase
    .from("clients")
    .select("trainer_id, profiles:trainer_id(full_name)")
    .eq("profile_id", profile.id)
    .single();

  if (!client) {
    return <p className="text-gray-400">Nessun trainer collegato al tuo profilo.</p>;
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">Messaggi</h1>
      <ChatThread
        currentUserId={profile.id}
        peerId={client.trainer_id}
        peerName={(client as any).profiles?.full_name || "Il tuo coach"}
      />
    </div>
  );
}

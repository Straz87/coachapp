import Link from "next/link";
import { notFound } from "next/navigation";
import { requireTrainer } from "@/lib/auth";
import ChatThread from "@/components/ChatThread";

export default async function TrainerChatThreadPage({ params }: { params: { peerId: string } }) {
  const { supabase, profile } = await requireTrainer();

  const { data: peer } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", params.peerId)
    .single();

  if (!peer) notFound();

  return (
    <div className="max-w-2xl">
      <Link href="/trainer/chat" className="text-sm text-gray-500 hover:underline">
        ← Tutti i messaggi
      </Link>
      <div className="mt-3">
        <ChatThread currentUserId={profile.id} peerId={params.peerId} peerName={peer.full_name} />
      </div>
    </div>
  );
}

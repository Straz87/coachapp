import Link from "next/link";
import { requireTrainer } from "@/lib/auth";

export default async function TrainerChatListPage() {
  const { supabase, profile } = await requireTrainer();

  const { data: clients } = await supabase
    .from("clients")
    .select("profile_id, profiles:profile_id(full_name, email)")
    .eq("trainer_id", profile.id)
    .order("created_at", { ascending: false });

  return (
    <div className="max-w-md">
      <h1 className="text-2xl font-bold mb-6">Messaggi</h1>
      <div className="card p-0 overflow-hidden">
        {(clients || []).map((c: any) => (
          <Link
            key={c.profile_id}
            href={`/trainer/chat/${c.profile_id}`}
            className="flex items-center justify-between px-5 py-3 border-b last:border-b-0 border-gray-100 hover:bg-gray-50"
          >
            <div>
              <p className="font-medium">{c.profiles?.full_name}</p>
              <p className="text-xs text-gray-400">{c.profiles?.email}</p>
            </div>
            <span className="text-gray-300">→</span>
          </Link>
        ))}
        {(!clients || clients.length === 0) && (
          <p className="px-5 py-8 text-center text-gray-400 text-sm">Nessun cliente ancora.</p>
        )}
      </div>
    </div>
  );
}

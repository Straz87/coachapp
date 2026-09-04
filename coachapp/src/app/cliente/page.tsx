import Link from "next/link";
import { requireClientRole } from "@/lib/auth";
import ClientWeekView from "@/components/ClientWeekView";
import ClientProgramCard from "@/components/ClientProgramCard";
import OnboardingPopups from "@/components/OnboardingPopups";

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

  // Richieste di conferma nuovo prezzo ancora in sospeso: le mostriamo qui
  // sopra come banner, così il cliente non rischia di perderle (oltre
  // all'email che riceve quando il trainer alza il prezzo).
  const { data: pendingPriceChanges } = await supabase
    .from("workout_group_price_changes")
    .select("id, new_price, expires_at, workout_groups:group_id(name)")
    .eq("client_id", client.id)
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });

  return (
    <div className="max-w-2xl">
      <OnboardingPopups clientId={client.id} />

      <h1 className="text-2xl font-bold mb-1">Ciao {profile.full_name.split(" ")[0]} 👋</h1>
      <p className="text-gray-500 text-sm mb-6">Ecco i tuoi allenamenti della settimana.</p>

      {(pendingPriceChanges || []).map((change: any) => (
        <Link
          key={change.id}
          href={`/cliente/prezzo/${change.id}`}
          className="block mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 hover:bg-amber-100 transition"
        >
          <p className="text-sm text-amber-900">
            ⚠️ Il prezzo di <strong>{change.workout_groups?.name || "un tuo gruppo"}</strong> sta cambiando a{" "}
            <strong>{Number(change.new_price)}€/mese</strong>. Tocca qui per accettare o rifiutare.
          </p>
        </Link>
      ))}

      <ClientProgramCard clientId={client.id} />

      <ClientWeekView clientId={client.id} />
    </div>
  );
}

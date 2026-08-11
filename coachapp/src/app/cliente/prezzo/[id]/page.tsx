import { requireClientRole } from "@/lib/auth";
import PrezzoConfirmActions from "@/components/PrezzoConfirmActions";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" });
}

export default async function PrezzoConfermaPage({ params }: { params: { id: string } }) {
  const { supabase, profile } = await requireClientRole();

  const { data: client } = await supabase.from("clients").select("id").eq("profile_id", profile.id).single();

  if (!client) {
    return <p className="text-gray-400">Il tuo trainer non ti ha ancora collegato ad un profilo.</p>;
  }

  const { data: change } = await supabase
    .from("workout_group_price_changes")
    .select("*, workout_groups:group_id(name)")
    .eq("id", params.id)
    .eq("client_id", client.id)
    .maybeSingle();

  if (!change) {
    return (
      <div className="max-w-lg">
        <h1 className="text-2xl font-bold mb-2">Richiesta non trovata</h1>
        <p className="text-gray-500 text-sm">Questo link non è valido oppure non ti riguarda.</p>
      </div>
    );
  }

  const groupName = (change as any).workout_groups?.name || "il tuo gruppo";
  const expired = change.status === "pending" && new Date(change.expires_at).getTime() < Date.now();

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-bold mb-1">Aggiornamento prezzo</h1>
      <p className="text-gray-500 text-sm mb-6">Il tuo trainer ha proposto un nuovo prezzo per {groupName}.</p>

      <div className="rounded-2xl border border-gray-200 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <span className="text-gray-500 text-sm">Prezzo attuale</span>
          <span className="text-gray-900 font-semibold">{Number(change.old_price)}€/mese</span>
        </div>
        <div className="flex items-center justify-between mb-4">
          <span className="text-gray-500 text-sm">Nuovo prezzo</span>
          <span className="text-gray-900 font-bold text-lg">{Number(change.new_price)}€/mese</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-gray-500 text-sm">Rispondi entro</span>
          <span className="text-gray-900 font-semibold">{formatDate(change.expires_at)}</span>
        </div>
      </div>

      {change.status === "pending" && !expired && (
        <>
          <p className="text-gray-500 text-sm mb-4">
            Nessun addebito verrà effettuato senza la tua conferma. Se rifiuti, o non rispondi entro la data
            indicata, verrai semplicemente rimosso dal gruppo, senza alcun addebito.
          </p>
          <PrezzoConfirmActions changeId={change.id} />
        </>
      )}

      {(change.status !== "pending" || expired) && (
        <div className="rounded-xl bg-gray-50 border border-gray-200 text-gray-700 text-sm p-4">
          {change.status === "accepted" && "Hai già accettato questo nuovo prezzo."}
          {change.status === "declined" && "Hai già rifiutato questo nuovo prezzo."}
          {(change.status === "expired" || expired) &&
            "Il tempo per rispondere a questa richiesta è scaduto."}
        </div>
      )}
    </div>
  );
}

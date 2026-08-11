import { createAdminClient } from "@/lib/supabase/admin";
import PublicSignupForm from "@/components/PublicSignupForm";

// Pagina pubblica del link di un singolo gruppo (es. "CF Training"):
// chi si iscrive da qui entra subito in quel gruppo, con il prezzo e la
// prova gratuita impostati per quel gruppo specifico (indipendenti dal
// link generico del trainer). Letta con il client admin perché va vista
// da chiunque, anche senza sessione Supabase.
export default async function IscrivitiGruppoPage({
  params,
}: {
  params: { trainerId: string; groupId: string };
}) {
  const admin = createAdminClient();

  const { data: trainer } = await admin
    .from("profiles")
    .select("full_name")
    .eq("id", params.trainerId)
    .eq("role", "trainer")
    .maybeSingle();

  const { data: group } = await admin
    .from("workout_groups")
    .select("id, name, public, price, trial_days")
    .eq("id", params.groupId)
    .eq("trainer_id", params.trainerId)
    .eq("public", true)
    .maybeSingle();

  if (!trainer || !group || group.price === null || group.price === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
        <div className="card max-w-sm text-center">
          <p className="text-gray-500 text-sm">Questo link non è al momento disponibile.</p>
        </div>
      </div>
    );
  }

  const isFree = Number(group.price) <= 0;

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <p className="text-3xl mb-1">💪</p>
          <h1 className="text-xl font-bold">{group.name}</h1>
          <p className="text-gray-500 text-sm mt-1">con {trainer.full_name}</p>
          <p className="text-gray-500 text-sm mt-1">
            {isFree
              ? "Gratuito"
              : `${group.trial_days > 0 ? `${group.trial_days} giorni di prova gratuita, poi ` : ""}${
                  group.price
                }€/mese`}
          </p>
        </div>
        <PublicSignupForm trainerId={params.trainerId} groupId={group.id} />
      </div>
    </div>
  );
}

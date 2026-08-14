import { createAdminClient } from "@/lib/supabase/admin";
import PublicSignupForm from "@/components/PublicSignupForm";
import Link from "next/link";

// Pagina pubblica del link di un singolo gruppo (es. "CF Training"):
// chi si iscrive da qui entra subito in quel gruppo, con il prezzo e la
// prova gratuita impostati per quel gruppo specifico (indipendenti dal
// link generico del trainer). Letta con il client admin perché va vista
// da chiunque, anche senza sessione Supabase.
export default async function IscrivitiGruppoPage({
  params,
  searchParams,
}: {
  params: { trainerId: string; groupId: string };
  searchParams: { ok?: string; annullato?: string };
}) {
  // Dopo il pagamento Stripe torna qui con ?ok=1: prima mostravamo di nuovo
  // il form di iscrizione, il che confondeva chi si era appena iscritto e
  // lo portava a compilarlo una seconda volta, ottenendo un errore
  // "account già esistente". Ora mostriamo una conferma chiara con un
  // link diretto al login.
  if (searchParams.ok) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
        <div className="card max-w-sm text-center">
          <p className="text-3xl mb-2">✅</p>
          <h1 className="text-xl font-bold mb-2">Iscrizione completata!</h1>
          <p className="text-gray-500 text-sm mb-4">
            Il tuo account è pronto e il pagamento è andato a buon fine. Accedi con l&apos;email e
            la password che hai appena creato.
          </p>
          <Link href="/login" className="btn-primary inline-block">
            Vai al login
          </Link>
        </div>
      </div>
    );
  }

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
        {searchParams.annullato && (
          <p className="text-sm text-amber-600 text-center mb-4">
            Pagamento annullato. Se hai già creato l&apos;account puoi accedere dal login, oppure
            riprova qui sotto.
          </p>
        )}
        <PublicSignupForm trainerId={params.trainerId} groupId={group.id} />
      </div>
    </div>
  );
}

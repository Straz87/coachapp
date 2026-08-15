import { createAdminClient } from "@/lib/supabase/admin";
import PublicSignupForm from "@/components/PublicSignupForm";
import Link from "next/link";

// Pagina pubblica di iscrizione a un PROGRAMMA a durata fissa (es.
// "Functional Bodybuilding"): a differenza dei gruppi, qui chi si iscrive
// parte sempre dal giorno 1, indipendentemente da quando si iscrive.
// Letta con il client admin perché va vista da chiunque, anche senza
// sessione Supabase.
export default async function IscrivitiProgrammaPage({
  params,
  searchParams,
}: {
  params: { trainerId: string; programId: string };
  searchParams: { ok?: string; annullato?: string };
}) {
  if (searchParams.ok) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
        <div className="card max-w-sm text-center">
          <p className="text-3xl mb-2">✅</p>
          <h1 className="text-xl font-bold mb-2">Iscrizione completata!</h1>
          <p className="text-gray-500 text-sm mb-4">
            Il tuo account è pronto e il pagamento è andato a buon fine. Accedi con l&apos;email e la
            password che hai appena creato: il tuo programma parte dal giorno 1.
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

  const { data: program } = await admin
    .from("programs")
    .select("id, name, description, length_days, public, price, trial_days")
    .eq("id", params.programId)
    .eq("trainer_id", params.trainerId)
    .eq("public", true)
    .maybeSingle();

  if (!trainer || !program || program.price === null || program.price === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
        <div className="card max-w-sm text-center">
          <p className="text-gray-500 text-sm">Questo link non è al momento disponibile.</p>
        </div>
      </div>
    );
  }

  const isFree = Number(program.price) <= 0;

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <p className="text-3xl mb-1">💪</p>
          <h1 className="text-xl font-bold">{program.name}</h1>
          <p className="text-gray-500 text-sm mt-1">con {trainer.full_name}</p>
          <p className="text-gray-500 text-sm mt-1">Programma di {program.length_days} giorni</p>
          <p className="text-gray-500 text-sm mt-1">
            {isFree
              ? "Gratuito"
              : `${
                  program.trial_days > 0 ? `${program.trial_days} giorni di prova gratuita, poi ` : ""
                }${program.price}€/mese`}
          </p>
        </div>
        {searchParams.annullato && (
          <p className="text-sm text-amber-600 text-center mb-4">
            Pagamento annullato. Se hai già creato l&apos;account puoi accedere dal login, oppure riprova
            qui sotto.
          </p>
        )}
        <PublicSignupForm trainerId={params.trainerId} programId={program.id} />
      </div>
    </div>
  );
}

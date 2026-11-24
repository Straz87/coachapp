import { createAdminClient } from "@/lib/supabase/admin";
import PublicSignupForm from "@/components/PublicSignupForm";
import Link from "next/link";

// Pagina pubblica del link di un singolo gruppo (es. "CF Training"):
// chi si iscrive da qui entra subito in quel gruppo, con il prezzo e la
// prova gratuita impostati per quel gruppo specifico (indipendenti dal
// link generico del trainer). Se il trainer ha attivato anche il pagamento
// unico, chi si iscrive sceglie tra mensile e un'unica soluzione. Letta con
// il client admin perché va vista da chiunque, anche senza sessione Supabase.
export default async function IscrivitiGruppoPage({
  params,
  searchParams,
}: {
  params: { trainerId: string; groupId: string };
  searchParams: { ok?: string; annullato?: string };
}) {
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
    .select("*")
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
  type Plan =
    | { id: "mensile"; price: number; trialDays: number }
    | { id: "unico"; total: number; months: number };
  const plans: Plan[] = [];
  if (!isFree) plans.push({ id: "mensile", price: Number(group.price), trialDays: Number(group.trial_days) || 0 });
  if (Number(group.one_shot_total) > 0 && Number(group.one_shot_months) > 0) {
    plans.push({ id: "unico", total: Number(group.one_shot_total), months: Number(group.one_shot_months) });
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
      <div className="w-full max-w-sm">
        <div className="mb-5">
          <p className="text-xs tracking-widest text-gray-400 mb-1">HYBRIDMETHOD</p>
          <h1 className="text-2xl font-bold leading-tight">{group.name}</h1>
          <p className="text-gray-500 text-sm mt-1">con {trainer.full_name}</p>
          {group.description && <p className="text-gray-600 text-sm mt-3">{group.description}</p>}
          {plans.length === 0 && <p className="text-gray-500 text-sm mt-2">Gratuito</p>}
        </div>
        {searchParams.annullato && (
          <p className="text-sm text-amber-600 text-center mb-4">
            Pagamento annullato. Se hai già creato l&apos;account puoi accedere dal login, oppure
            riprova qui sotto.
          </p>
        )}
        <PublicSignupForm trainerId={params.trainerId} groupId={group.id} plans={plans} />
      </div>
    </div>
  );
}

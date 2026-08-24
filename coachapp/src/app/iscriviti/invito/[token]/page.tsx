import { createAdminClient } from "@/lib/supabase/admin";
import InviteSignupForm from "@/components/InviteSignupForm";

// Pagina pubblica (nessun login richiesto): il link personale che il
// trainer genera dalla schermata "Nuovo cliente" per UN cliente
// specifico, con il prezzo già impostato da lui. Il cliente apre il
// link e inserisce solo nome, email e password: il trainer non deve
// più digitare l'email altrui per creare l'account.
export default async function InvitoPage({
  params,
  searchParams,
}: {
  params: { token: string };
  searchParams: { annullato?: string };
}) {
  const admin = createAdminClient();

  const { data: invite } = await admin
    .from("client_invites")
    .select("*, profiles:trainer_id(full_name)")
    .eq("token", params.token)
    .maybeSingle();

  if (!invite) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
        <div className="card max-w-sm text-center">
          <p className="text-gray-500 text-sm">Questo link non è valido.</p>
        </div>
      </div>
    );
  }

  if (invite.used_at) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
        <div className="card max-w-sm text-center">
          <p className="text-3xl mb-2">✅</p>
          <p className="text-gray-500 text-sm">
            Questo link è già stato usato per completare un&apos;iscrizione. Se sei tu e devi
            accedere, vai alla pagina di login.
          </p>
        </div>
      </div>
    );
  }

  const trainerName = (invite as any).profiles?.full_name || "il tuo trainer";
  const isFree = !invite.price || Number(invite.price) <= 0;

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <p className="text-3xl mb-1">💪</p>
          <h1 className="text-xl font-bold">{trainerName}</h1>
          <p className="text-gray-500 text-sm mt-1">
            {isFree
              ? "Gratis"
              : `${invite.trial_days > 0 ? `${invite.trial_days} giorni di prova gratuita, poi ` : ""}${invite.price}€/mese`}
          </p>
        </div>
        {searchParams.annullato && (
          <p className="text-sm text-amber-600 text-center mb-4">
            Pagamento annullato. Puoi riprovare quando vuoi.
          </p>
        )}
        <InviteSignupForm token={params.token} isFree={isFree} />
      </div>
    </div>
  );
}

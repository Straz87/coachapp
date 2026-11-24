import { createAdminClient } from "@/lib/supabase/admin";
import InviteSignupForm from "@/components/InviteSignupForm";

// Pagina pubblica (nessun login richiesto): il link personale che il trainer
// genera da "Nuovo cliente" per UN cliente. Il cliente sceglie il piano
// offerto (mensile e/o pagamento unico) e crea il suo account.
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

  const trainerName = (invite as any).profiles?.full_name || "il tuo coach";

  // Nome del cliente (il trainer lo ha inserito creando il link)
  let clientName = "";
  if (invite.client_id) {
    const { data: c } = await admin
      .from("clients")
      .select("profiles:profile_id(full_name)")
      .eq("id", invite.client_id)
      .maybeSingle();
    clientName = (c as any)?.profiles?.full_name || "";
  }
  const firstName = clientName.split(" ")[0];

  const note = String(invite.billing_note || "");
  const manual = note.startsWith("Pagamento a mano");
  const legacy = note.match(/Pagamento unico (\d+) mesi/);

  type Plan =
    | { id: "mensile"; price: number; trialDays: number }
    | { id: "unico"; total: number; months: number };
  const plans: Plan[] = [];
  if (legacy) {
    plans.push({ id: "unico", total: Number(invite.price), months: Number(legacy[1]) });
  } else {
    if (Number(invite.price) > 0) {
      plans.push({ id: "mensile", price: Number(invite.price), trialDays: Number(invite.trial_days) || 0 });
    }
    if (Number(invite.one_shot_total) > 0 && Number(invite.one_shot_months) > 0) {
      plans.push({ id: "unico", total: Number(invite.one_shot_total), months: Number(invite.one_shot_months) });
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
      <div className="w-full max-w-sm">
        <div className="mb-5">
          <p className="text-xs tracking-widest text-gray-400 mb-1">HYBRIDMETHOD</p>
          <h1 className="text-2xl font-bold leading-tight">
            {firstName ? `Ciao ${firstName}, il tuo percorso è pronto` : "Il tuo percorso è pronto"}
          </h1>
          <p className="text-gray-500 text-sm mt-2">
            {trainerName} ha preparato per te un programma personalizzato. Crea l&apos;account per iniziare.
          </p>
          <ul className="mt-4 space-y-1.5 text-sm text-gray-700">
            <li>🏋️ Programma di allenamento personalizzato</li>
            <li>💬 Chat diretta con il tuo coach</li>
            <li>📈 Pesi, feedback e progressi sempre tracciati</li>
          </ul>
        </div>
        {searchParams.annullato && (
          <p className="text-sm text-amber-600 text-center mb-4">
            Pagamento annullato. Puoi riprovare quando vuoi.
          </p>
        )}
        <InviteSignupForm token={params.token} plans={plans} manual={manual} defaultName={clientName} />
      </div>
    </div>
  );
}

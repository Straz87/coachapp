import { requireClientRole } from "@/lib/auth";
import SideNav from "@/components/SideNav";
import ReactivatePaymentButton from "@/components/ReactivatePaymentButton";

const NAV_ITEMS = [
  { href: "/cliente", label: "I miei allenamenti", icon: "🏋️" },
  { href: "/cliente/progressi", label: "Progressi", icon: "📈" },
  { href: "/cliente/dieta", label: "Piano alimentare", icon: "🥗" },
  { href: "/cliente/chat", label: "Messaggi", icon: "💬" },
  { href: "/cliente/massimali", label: "Massimali", icon: "🔢" },
];

// Stati che bloccano l'accesso all'app: il webhook Stripe li imposta in
// automatico quando un pagamento fallisce (scaduto) o l'abbonamento viene
// cancellato (sospeso). Fino ad oggi questi stati erano solo un'etichetta
// visibile al trainer: il cliente continuava a vedere tutto normalmente.
// Ora blocchiamo qui, in un unico punto condiviso da tutte le pagine
// cliente, invece di ripetere il controllo in ogni pagina.
const BLOCKED_STATUSES = ["scaduto", "sospeso"];

export default async function ClienteLayout({ children }: { children: React.ReactNode }) {
  const { supabase, profile } = await requireClientRole();

  const { data: client } = await supabase
    .from("clients")
    .select("status")
    .eq("profile_id", profile.id)
    .maybeSingle();

  const blocked = client?.status && BLOCKED_STATUSES.includes(client.status);

  if (blocked) {
    const message =
      client!.status === "sospeso"
        ? "Il tuo abbonamento è stato sospeso."
        : "Il tuo abbonamento è scaduto.";

    return (
      <div className="flex flex-col md:flex-row">
        <SideNav items={[]} fullName={profile.full_name} />
        <main className="flex-1 flex items-center justify-center p-4 md:p-8 min-h-screen">
          <div className="max-w-sm text-center">
            <div className="text-4xl mb-4">🔒</div>
            <h1 className="text-xl font-bold mb-2">{message}</h1>
            <p className="text-gray-500 text-sm">
              Paga ora per riattivarlo subito, oppure contatta il tuo trainer. Non appena il pagamento sarà
              regolarizzato tornerai a vedere i tuoi allenamenti, i progressi e la chat.
            </p>
            <ReactivatePaymentButton />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row">
      <SideNav items={NAV_ITEMS} fullName={profile.full_name} />
      <main className="flex-1 p-4 md:p-8 min-w-0">{children}</main>
    </div>
  );
}

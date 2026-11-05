import { requireClientRole } from "@/lib/auth";
import SideNav from "@/components/SideNav";
import ReactivatePaymentButton from "@/components/ReactivatePaymentButton";

const NAV_ITEMS = [
  { href: "/cliente", label: "I miei allenamenti", icon: "🏋️" },
  { href: "/cliente/progressi", label: "Progressi", icon: "📈" },
  { href: "/cliente/dieta", label: "Piano alimentare", icon: "🥗" },
  { href: "/cliente/chat", label: "Messaggi", icon: "💬" },
];

// Stati che bloccano l'accesso all'app: il webhook Stripe li imposta in
// automatico quando un pagamento fallisce (scaduto) o l'abbonamento viene
// cancellato (sospeso). Un cliente appena iscritto da invito resta "sospeso"
// finche' non paga con carta (webhook) o il trainer da' l'OK al pagamento a mano.
const BLOCKED_STATUSES = ["scaduto", "sospeso"];

export default async function ClienteLayout({ children }: { children: React.ReactNode }) {
  const { supabase, profile } = await requireClientRole();

  const { data: client } = await supabase
    .from("clients")
    .select("status, billing_note, stripe_subscription_id, last_payment_at")
    .eq("profile_id", profile.id)
    .maybeSingle();

  const blocked = client?.status && BLOCKED_STATUSES.includes(client.status);

  if (blocked) {
    const neverPaid = client!.status === "sospeso" && !client!.stripe_subscription_id && !client!.last_payment_at;
    const manual = String(client!.billing_note || "").startsWith("Pagamento a mano");

    let message: string;
    let text: string;
    let showPay = true;
    if (neverPaid && manual) {
      message = "Account in attesa di attivazione.";
      text = "Il tuo trainer attivera' l'accesso appena ricevuto il pagamento. Appena fatto vedrai subito i tuoi allenamenti.";
      showPay = false;
    } else if (neverPaid) {
      message = "Completa il pagamento per accedere.";
      text = "Appena il pagamento sara' confermato vedrai i tuoi allenamenti, i progressi e la chat.";
    } else {
      message = client!.status === "sospeso" ? "Il tuo abbonamento è stato sospeso." : "Il tuo abbonamento è scaduto.";
      text =
        "Paga ora per riattivarlo subito, oppure contatta il tuo trainer. Non appena il pagamento sarà regolarizzato tornerai a vedere i tuoi allenamenti, i progressi e la chat.";
    }

    return (
      <div className="flex flex-col md:flex-row">
        <SideNav items={[]} fullName={profile.full_name} />
        <main className="flex-1 flex items-center justify-center p-4 md:p-8 min-h-screen">
          <div className="max-w-sm text-center">
            <div className="text-4xl mb-4">🔒</div>
            <h1 className="text-xl font-bold mb-2">{message}</h1>
            <p className="text-gray-500 text-sm">{text}</p>
            {showPay && <ReactivatePaymentButton />}
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

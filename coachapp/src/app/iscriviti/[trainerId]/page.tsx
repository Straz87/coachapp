import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";
import PublicSignupForm from "@/components/PublicSignupForm";

// Pagina pubblica (nessun login richiesto): il link fisso che il trainer
// mette in bio o nelle storie. Legge le impostazioni con il client admin
// perché va vista da chiunque, anche senza sessione Supabase.
export default async function IscrivitiPage({ params }: { params: { trainerId: string } }) {
  const admin = createAdminClient();

  const { data: trainer } = await admin
    .from("profiles")
    .select("full_name")
    .eq("id", params.trainerId)
    .eq("role", "trainer")
    .maybeSingle();

  const { data: link } = await admin
    .from("public_signup_links")
    .select("*")
    .eq("trainer_id", params.trainerId)
    .eq("active", true)
    .maybeSingle();

  if (!trainer || !link || !link.price) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
        <div className="card max-w-sm text-center">
          <p className="text-gray-500 text-sm">Questo link non è al momento disponibile.</p>
        </div>
      </div>
    );
  }

  let percentOff: number | null = null;
  if (link.coupon_id) {
    try {
      const stripe = getStripe();
      const coupon = await stripe.coupons.retrieve(link.coupon_id);
      percentOff = coupon.percent_off ?? null;
    } catch {
      percentOff = null;
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <p className="text-3xl mb-1">💪</p>
          <h1 className="text-xl font-bold">{trainer.full_name}</h1>
          <p className="text-gray-500 text-sm mt-1">
            {link.trial_days > 0 ? `${link.trial_days} giorni di prova gratuita, poi ` : ""}
            {link.price}€/mese
            {percentOff ? ` (${percentOff}% di sconto)` : ""}
          </p>
        </div>
        <PublicSignupForm trainerId={params.trainerId} />
      </div>
    </div>
  );
}

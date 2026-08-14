import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";
import PublicSignupForm from "@/components/PublicSignupForm";
import Link from "next/link";

// Pagina pubblica (nessun login richiesto): il link fisso che il trainer
// mette in bio o nelle storie. Legge le impostazioni con il client admin
// perché va vista da chiunque, anche senza sessione Supabase.
export default async function IscrivitiPage({
  params,
  searchParams,
}: {
  params: { trainerId: string };
  searchParams: { ok?: string; annullato?: string };
}) {
  // Dopo il pagamento Stripe torna qui con ?ok=1: prima mostravamo di nuovo
  // il form di iscrizione, che confondeva chi si era appena iscritto e lo
  // portava a compilarlo una seconda volta, ottenendo un errore "account
  // già esistente". Ora mostriamo una schermata di conferma chiara con un
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
        {searchParams.annullato && (
          <p className="text-sm text-amber-600 text-center mb-4">
            Pagamento annullato. Se hai già creato l&apos;account puoi accedere dal login, oppure
            riprova qui sotto.
          </p>
        )}
        <PublicSignupForm trainerId={params.trainerId} />
      </div>
    </div>
  );
}

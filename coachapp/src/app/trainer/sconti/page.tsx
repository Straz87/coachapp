import { requireTrainer } from "@/lib/auth";
import CouponManager from "@/components/CouponManager";

export default async function ScontiPage() {
  await requireTrainer();

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">Sconti e coupon</h1>
      <p className="text-gray-500 text-sm mb-6">
        Crea coupon riutilizzabili (percentuale di sconto, durata, numero massimo di utilizzi,
        scadenza opzionale). Poi, dal profilo di un cliente, potrai applicarne uno quando generi il
        link di pagamento — insieme, se vuoi, a dei giorni di prova gratuita.
      </p>
      <CouponManager />
    </div>
  );
}

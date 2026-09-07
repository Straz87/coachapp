import { requireTrainer } from "@/lib/auth";
import FinanceDashboard from "@/components/FinanceDashboard";

export default async function FinanzaPage() {
  await requireTrainer();

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">Finanza</h1>
      <p className="text-gray-500 text-sm mb-6">
        Tutto quello che riguarda i pagamenti in un unico posto: incasso stimato, stato dei
        clienti, prezzi degli abbonamenti, pagamenti recenti (con rimborso rapido) e i coupon
        sconto.
      </p>
      <FinanceDashboard />
    </div>
  );
}

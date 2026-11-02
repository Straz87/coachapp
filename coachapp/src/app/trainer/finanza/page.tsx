import { requireTrainer } from "@/lib/auth";
import FinanceDashboard from "@/components/FinanceDashboard";

export default async function FinanzaPage() {
  await requireTrainer();

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold mb-1">Finanza</h1>
      <p className="text-gray-500 text-sm mb-5">Incassi, prezzi, storico dei pagamenti e sconti.</p>
      <FinanceDashboard />
    </div>
  );
}

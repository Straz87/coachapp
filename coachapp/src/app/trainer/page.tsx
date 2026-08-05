import Link from "next/link";
import { requireTrainer } from "@/lib/auth";
import ClientList, { ClientRow } from "@/components/ClientList";

export default async function TrainerHome() {
  const { supabase, profile } = await requireTrainer();

  const { data: clients } = await supabase
    .from("clients")
    .select("id, status, price, expiry_date, profiles:profile_id(full_name, email)")
    .eq("trainer_id", profile.id)
    .order("created_at", { ascending: false });

  const rows = (clients || []) as unknown as ClientRow[];

  const counts = {
    totale: rows.length,
    attivi: rows.filter((c) => c.status === "attivo").length,
    in_scadenza: rows.filter((c) => c.status === "in_scadenza").length,
    scaduti: rows.filter((c) => c.status === "scaduto").length,
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">I tuoi clienti</h1>
          <p className="text-gray-500 text-sm">Gestisci abbonamenti, schede e progressi.</p>
        </div>
        <Link href="/trainer/nuovo-cliente" className="btn-primary">
          + Nuovo cliente
        </Link>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="card">
          <p className="text-gray-400 text-xs">Totale</p>
          <p className="text-2xl font-bold">{counts.totale}</p>
        </div>
        <div className="card">
          <p className="text-gray-400 text-xs">Attivi</p>
          <p className="text-2xl font-bold text-green-600">{counts.attivi}</p>
        </div>
        <div className="card">
          <p className="text-gray-400 text-xs">In scadenza</p>
          <p className="text-2xl font-bold text-yellow-600">{counts.in_scadenza}</p>
        </div>
        <div className="card">
          <p className="text-gray-400 text-xs">Scaduti</p>
          <p className="text-2xl font-bold text-red-600">{counts.scaduti}</p>
        </div>
      </div>

      <ClientList clients={rows} />
    </div>
  );
}

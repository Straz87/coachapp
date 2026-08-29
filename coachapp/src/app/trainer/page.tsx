import Link from "next/link";
import { requireTrainer } from "@/lib/auth";
import ClientList, { ClientRow } from "@/components/ClientList";
import VetrinaQuickLink from "@/components/VetrinaQuickLink";

const INACTIVITY_DAYS = 5;
const EXPIRY_DAYS = 5;

export default async function TrainerHome() {
    const { supabase, profile } = await requireTrainer();

  const [{ data: clients }, { data: individualDone }] = await Promise.all([
        supabase
          .from("clients")
          .select(
                    "id, status, price, expiry_date, start_date, created_at, profiles:profile_id(full_name, email)"
                  )
          .eq("trainer_id", profile.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("workout_assignments")
          .select("client_id, completed_at")
          .eq("trainer_id", profile.id)
          .eq("completed", true)
          .not("completed_at", "is", null),
      ]);

  const baseRows = (clients || []) as unknown as (ClientRow & {
        start_date: string | null;
        created_at: string;
  })[];

  const clientIds = baseRows.map((c) => c.id);

  const { data: groupDone } =
        clientIds.length > 0
        ? await supabase
              .from("group_workout_scores")
              .select("client_id, completed_at")
              .in("client_id", clientIds)
              .eq("completed", true)
              .not("completed_at", "is", null)
          : { data: [] as { client_id: string; completed_at: string }[] };

  const lastActivity = new Map<string, string>();
    for (const row of [...(individualDone || []), ...(groupDone || [])]) {
          const prev = lastActivity.get(row.client_id);
          if (!prev || row.completed_at > prev) lastActivity.set(row.client_id, row.completed_at);
    }

  const now = Date.now();
    const rows: ClientRow[] = baseRows.map((c) => {
          const last = lastActivity.get(c.id) || null;
          const daysInactive = last ? Math.floor((now - new Date(last).getTime()) / 86400000) : null;
          const joinedAt = c.start_date ? new Date(`${c.start_date}T00:00:00`) : new Date(c.created_at);
          const daysSinceJoined = Math.floor((now - joinedAt.getTime()) / 86400000);
          const inactive = last ? daysInactive! >= INACTIVITY_DAYS : daysSinceJoined >= INACTIVITY_DAYS;

                                               const daysToExpiry = c.expiry_date
            ? Math.ceil((new Date(`${c.expiry_date}T00:00:00`).getTime() - now) / 86400000)
                                                       : null;
          const expiring = daysToExpiry !== null && daysToExpiry >= 0 && daysToExpiry <= EXPIRY_DAYS;

                                               return {
                                                       id: c.id,
                                                       status: c.status,
                                                       price: c.price,
                                                       expiry_date: c.expiry_date,
                                                       profiles: c.profiles,
                                                       last_activity: last,
                                                       days_inactive: last ? daysInactive : null,
                                                       days_to_expiry: daysToExpiry,
                                                       needs_attention: inactive || expiring,
                                               };
    });

  const counts = {
        totale: rows.length,
        attivi: rows.filter((c) => c.status === "attivo").length,
        in_scadenza: rows.filter((c) => c.status === "in_scadenza").length,
        scaduti: rows.filter((c) => c.status === "scaduto").length,
        da_contattare: rows.filter((c) => c.needs_attention).length,
  };

  return (
    <div>
    <div className="flex items-center justify-between mb-6">
    <div>
    <h1 className="text-2xl font-bold">I tuoi clienti</h1>
      <p className="text-gray-500 text-sm">Gestisci abbonamenti, schede e progressi.</p></div>
      <Link href="/trainer/nuovo-cliente" className="btn-primary">
        + Nuovo cliente</Link>
    </div>

      <VetrinaQuickLink trainerId={profile.id} />

<div className="grid grid-cols-2 sm:grid-cols-5 gap-6 mb-8"><div><p className="text-gray-400 text-xs">Totale</p><p className="text-2xl font-bold">{counts.totale}</p></div><div><p className="text-gray-400 text-xs">Attivi</p><p className="text-2xl font-bold text-green-600">{counts.attivi}</p></div><div><p className="text-gray-400 text-xs">In scadenza</p><p className="text-2xl font-bold text-yellow-600">{counts.in_scadenza}</p></div><div><p className="text-gray-400 text-xs">Scaduti</p><p className="text-2xl font-bold text-red-600">{counts.scaduti}</p></div><div><p className="text-gray-400 text-xs">Da contattare</p><p className="text-2xl font-bold text-orange-600">{counts.da_contattare}</p></div></div><ClientList clients={rows} /></div>);
}

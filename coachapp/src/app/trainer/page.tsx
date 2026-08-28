import Link from "next/link";
import { requireTrainer } from "@/lib/auth";
import ClientList, { ClientRow } from "@/components/ClientList";
import PublicLinkManager from "@/components/PublicLinkManager";
import VetrinaProfileManager from "@/components/VetrinaProfileManager";

// Stesse soglie usate dal job dei promemoria automatici (/api/cron/reminders),
// così l'indicatore "da contattare" qui coincide con quando parte l'avviso.
const INACTIVITY_DAYS = 5;
const EXPIRY_DAYS = 5;

export default async function TrainerHome() {
  const { supabase, profile } = await requireTrainer();

  // Le query che seguono sono tutte indipendenti tra loro (dipendono solo da
  // profile.id, non l'una dall'altra): eseguendole in sequenza con await si
  // sommavano i tempi di rete di ognuna, aggiungendo secondi al caricamento
  // della dashboard. Lanciandole in parallelo con Promise.all si paga solo il
  // tempo della più lenta, non la somma di tutte.
  const [
    { data: clients },
    { data: individualDone },
    { data: groupsData },
    { data: linkData },
  ] = await Promise.all([
    supabase
      .from("clients")
      .select(
        "id, status, price, expiry_date, start_date, created_at, profiles:profile_id(full_name, email)"
      )
      .eq("trainer_id", profile.id)
      .order("created_at", { ascending: false }),
    // Ultima attività per cliente: come nel job dei promemoria, il massimo tra
    // allenamento individuale e di gruppo completato.
    supabase
      .from("workout_assignments")
      .select("client_id, completed_at")
      .eq("trainer_id", profile.id)
      .eq("completed", true)
      .not("completed_at", "is", null),
    // Gruppi del trainer, per poter collegare il link pubblico di iscrizione
    // a un gruppo (es. "CF Training") direttamente dalla dashboard.
    supabase
      .from("workout_groups")
      .select("id, name")
      .eq("trainer_id", profile.id)
      .order("created_at", { ascending: false }),
    // Dati del link pubblico già letti qui lato server (stesso giro di query
    // già in corso): evita a PublicLinkManager di doverli richiedere di nuovo
    // via fetch client-side ad ogni apertura della dashboard, che aggiungeva
    // un secondo o più al caricamento iniziale.
    supabase
      .from("public_signup_links")
      .select("*")
      .eq("trainer_id", profile.id)
      .maybeSingle(),
  ]);

  const baseRows = (clients || []) as unknown as (ClientRow & {
    start_date: string | null;
    created_at: string;
  })[];

  const clientIds = baseRows.map((c) => c.id);

  // Questa dipende dagli id dei clienti appena caricati, quindi resta
  // necessariamente dopo il Promise.all qui sopra.
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
          <p className="text-gray-500 text-sm">Gestisci abbonamenti, schede e progressi.</p>
        </div>
        <Link href="/trainer/nuovo-cliente" className="btn-primary">
          + Nuovo cliente
        </Link>
      </div>

      <PublicLinkManager trainerId={profile.id} groups={groupsData || []} initialLink={linkData} />
      <VetrinaProfileManager trainerId={profile.id} initialBio={profile.vetrina_bio} initialPhotoUrl={profile.vetrina_photo_url} />

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-6">
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
        <div className="card">
          <p className="text-gray-400 text-xs">Da contattare</p>
          <p className="text-2xl font-bold text-orange-600">{counts.da_contattare}</p>
        </div>
      </div>

      <ClientList clients={rows} />
    </div>
  );
}

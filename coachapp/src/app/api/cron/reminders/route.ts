import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushToProfile } from "@/lib/push";

// GET /api/cron/reminders
// Job schedulato (Vercel Cron, una volta al giorno) che:
// 1) avvisa il trainer (notifica in-app) quando un cliente non completa
//    un allenamento da INACTIVITY_DAYS giorni, e manda un promemoria
//    automatico al cliente stesso nella chat;
// 2) avvisa il trainer quando l'abbonamento di un cliente scade entro
//    EXPIRY_DAYS giorni.
// Non ha una sessione utente (nessun cookie): l'autorizzazione è tramite
// l'header "Authorization: Bearer <CRON_SECRET>" che Vercel Cron aggiunge
// automaticamente quando la variabile d'ambiente CRON_SECRET è impostata.
// Tutte le letture/scritture passano dal client "admin" (service role),
// che bypassa la Row Level Security — necessario perché il job scandisce
// i clienti di tutti i trainer, non di un singolo utente autenticato.

const INACTIVITY_DAYS = 5;
const EXPIRY_DAYS = 5;
const REMIND_EVERY_DAYS = 7; // non ripetere lo stesso avviso più spesso di così

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const admin = createAdminClient();
  const now = new Date();

  const { data: clients } = await admin
    .from("clients")
    .select(
      "id, profile_id, trainer_id, status, expiry_date, start_date, created_at, last_inactivity_reminder_sent_at, last_expiry_reminder_sent_at, profiles:profile_id(full_name)"
    )
    .in("status", ["attivo", "in_scadenza"]);

  if (!clients || clients.length === 0) {
    return NextResponse.json({ ok: true, clients: 0, inactivityCount: 0, expiryCount: 0 });
  }

  const { data: individualDone } = await admin
    .from("workout_assignments")
    .select("client_id, completed_at")
    .eq("completed", true)
    .not("completed_at", "is", null);

  const { data: groupDone } = await admin
    .from("group_workout_scores")
    .select("client_id, completed_at")
    .eq("completed", true)
    .not("completed_at", "is", null);

  // Ultima attività per cliente: il massimo tra individuale e di gruppo.
  const lastActivity = new Map<string, string>();
  for (const row of [...(individualDone || []), ...(groupDone || [])]) {
    const prev = lastActivity.get(row.client_id);
    if (!prev || row.completed_at > prev) lastActivity.set(row.client_id, row.completed_at);
  }

  let inactivityCount = 0;
  let expiryCount = 0;

  for (const c of clients as any[]) {
    const clientName = c.profiles?.full_name || "Cliente";

    // --- Cliente inattivo ---
    const last = lastActivity.get(c.id);
    const daysSince = last ? (now.getTime() - new Date(last).getTime()) / 86400000 : null;
    const joinedAt = c.start_date ? new Date(`${c.start_date}T00:00:00`) : new Date(c.created_at);
    const daysSinceJoined = (now.getTime() - joinedAt.getTime()) / 86400000;

    let inactive = false;
    let inactivityLabel = "";
    if (daysSince !== null && daysSince >= INACTIVITY_DAYS) {
      inactive = true;
      inactivityLabel = `${Math.floor(daysSince)} giorni senza allenamenti completati`;
    } else if (daysSince === null && daysSinceJoined >= INACTIVITY_DAYS) {
      inactive = true;
      inactivityLabel = "Non ha ancora completato un allenamento";
    }

    if (inactive) {
      const lastSent = c.last_inactivity_reminder_sent_at ? new Date(c.last_inactivity_reminder_sent_at) : null;
      const canSend = !lastSent || (now.getTime() - lastSent.getTime()) / 86400000 >= REMIND_EVERY_DAYS;
      if (canSend) {
        await admin.from("notifications").insert({
          trainer_id: c.trainer_id,
          client_id: c.id,
          client_name: clientName,
          workout_title: inactivityLabel,
          kind: "inattivita",
        });
        await admin
          .from("clients")
          .update({ last_inactivity_reminder_sent_at: now.toISOString() })
          .eq("id", c.id);
        await admin.from("messages").insert({
          sender_id: c.trainer_id,
          receiver_id: c.profile_id,
          content: `Ciao ${clientName.split(" ")[0]}! È da un po' che non ci alleniamo insieme, quando vuoi ripartiamo 💪`,
        });
        await sendPushToProfile(c.trainer_id, {
          title: "Cliente inattivo",
          body: `${clientName}: ${inactivityLabel}`,
          url: `/trainer/clienti/${c.id}`,
        });
        inactivityCount++;
      }
    }

    // --- Abbonamento in scadenza ---
    if (c.expiry_date) {
      const expiry = new Date(`${c.expiry_date}T00:00:00`);
      const daysToExpiry = Math.ceil((expiry.getTime() - now.getTime()) / 86400000);
      if (daysToExpiry >= 0 && daysToExpiry <= EXPIRY_DAYS) {
        const lastSent = c.last_expiry_reminder_sent_at ? new Date(c.last_expiry_reminder_sent_at) : null;
        const canSend = !lastSent || (now.getTime() - lastSent.getTime()) / 86400000 >= REMIND_EVERY_DAYS;
        if (canSend) {
          await admin.from("notifications").insert({
            trainer_id: c.trainer_id,
            client_id: c.id,
            client_name: clientName,
            workout_title: `Abbonamento in scadenza il ${c.expiry_date}`,
            kind: "scadenza",
          });
          await admin
            .from("clients")
            .update({ last_expiry_reminder_sent_at: now.toISOString() })
            .eq("id", c.id);
          await sendPushToProfile(c.trainer_id, {
            title: "Abbonamento in scadenza",
            body: `${clientName}: abbonamento in scadenza il ${c.expiry_date}`,
            url: `/trainer/clienti/${c.id}`,
          });
          expiryCount++;
        }
      }
    }
  }

  return NextResponse.json({ ok: true, clients: clients.length, inactivityCount, expiryCount });
}

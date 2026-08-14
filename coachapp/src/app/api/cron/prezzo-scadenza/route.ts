import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";
import { sendPushToProfile } from "@/lib/push";

// GET /api/cron/prezzo-scadenza
// Job schedulato (Vercel Cron, una volta al giorno) che chiude le
// richieste di conferma nuovo prezzo gruppo rimaste senza risposta: se il
// cliente non ha accettato né rifiutato entro "expires_at" (3 giorni),
// viene rimosso dal gruppo e l'abbonamento Stripe collegato viene
// cancellato, esattamente come se avesse rifiutato esplicitamente. Nessun
// addebito automatico viene mai fatto da questo job.
// Stessa autorizzazione degli altri cron: header
// "Authorization: Bearer <CRON_SECRET>".
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const admin = createAdminClient();
  const stripe = getStripe();

  const { data: expiredChanges } = await admin
    .from("workout_group_price_changes")
    .select("id, group_id, client_id, trainer_id, new_price, workout_groups:group_id(name)")
    .eq("status", "pending")
    .lt("expires_at", new Date().toISOString());

  let removedCount = 0;

  for (const change of (expiredChanges as any[]) || []) {
    const { data: client } = await admin
      .from("clients")
      .select("id, stripe_subscription_id, profile_id, profiles:profile_id(full_name)")
      .eq("id", change.client_id)
      .single();

    if (client?.stripe_subscription_id) {
      try {
        await stripe.subscriptions.cancel(client.stripe_subscription_id);
      } catch {
        // Se è già cancellato o non esiste più, procediamo comunque.
      }
    }

    await admin.from("group_members").delete().eq("group_id", change.group_id).eq("client_id", change.client_id);
    await admin
      .from("workout_group_price_changes")
      .update({ status: "expired", responded_at: new Date().toISOString() })
      .eq("id", change.id);

    const clientName = (client as any)?.profiles?.full_name || "Un cliente";
    const groupName = change.workout_groups?.name || "";
    await admin.from("notifications").insert({
      trainer_id: change.trainer_id,
      client_id: change.client_id,
      client_name: clientName,
      workout_title: `Non ha risposto entro 3 giorni al nuovo prezzo (${change.new_price}€/mese) di "${groupName}" ed è stato rimosso`,
      kind: "prezzo_gruppo",
    });

    await sendPushToProfile(change.trainer_id, {
      title: "Cliente rimosso per mancata risposta",
      body: `${clientName} non ha risposto al nuovo prezzo di "${groupName}" ed è stato rimosso.`,
      url: `/trainer/clienti/${change.client_id}`,
    });

    if (client?.profile_id) {
      await sendPushToProfile(client.profile_id, {
        title: "Sei stato rimosso dal gruppo",
        body: `Non hai risposto in tempo al nuovo prezzo di "${groupName}". Nessun addebito è stato effettuato.`,
        url: "/cliente",
      });
    }

    removedCount++;
  }

  return NextResponse.json({ ok: true, checked: expiredChanges?.length || 0, removedCount });
}

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";
import { sendPushToProfile } from "@/lib/push";

// POST /api/cliente/prezzo/[id]
// Body: { action: "accept" | "decline" }
//
// Il cliente risponde a una richiesta di conferma nuovo prezzo gruppo:
// - accept: l'abbonamento Stripe viene aggiornato al nuovo prezzo (senza
//   nessun addebito immediato extra, solo il rinnovo del mese successivo
//   cambia importo).
// - decline: il cliente viene rimosso dal gruppo e l'abbonamento Stripe
//   collegato viene cancellato (non ha più senso tenerlo attivo per un
//   servizio a cui il cliente ha scelto di non aderire al nuovo prezzo).
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  if (!profile || profile.role !== "client") {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const { data: clientRow } = await supabase.from("clients").select("id").eq("profile_id", profile.id).single();
  if (!clientRow) {
    return NextResponse.json({ error: "Cliente non trovato" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const action = body?.action;
  if (action !== "accept" && action !== "decline") {
    return NextResponse.json({ error: "Azione non valida" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: change } = await admin
    .from("workout_group_price_changes")
    .select("*")
    .eq("id", params.id)
    .eq("client_id", clientRow.id)
    .maybeSingle();

  if (!change) {
    return NextResponse.json({ error: "Richiesta non trovata" }, { status: 404 });
  }
  if (change.status !== "pending") {
    return NextResponse.json({ error: "Questa richiesta non è più valida" }, { status: 400 });
  }
  if (new Date(change.expires_at).getTime() < Date.now()) {
    return NextResponse.json({ error: "Il tempo per rispondere è scaduto" }, { status: 400 });
  }

  const { data: client } = await admin
    .from("clients")
    .select("id, stripe_subscription_id, trainer_id, profiles:profile_id(full_name)")
    .eq("id", clientRow.id)
    .single();

  const { data: group } = await admin.from("workout_groups").select("name").eq("id", change.group_id).single();
  const clientName = (client as any)?.profiles?.full_name || "Un cliente";

  if (action === "accept") {
    try {
      if (client?.stripe_subscription_id) {
        const stripe = getStripe();
        const sub = await stripe.subscriptions.retrieve(client.stripe_subscription_id);
        const item = sub.items.data[0];
        if (item) {
          await stripe.subscriptions.update(client.stripe_subscription_id, {
            items: [
              {
                id: item.id,
                price_data: {
                  currency: "eur",
                  unit_amount: Math.round(Number(change.new_price) * 100),
                  recurring: { interval: "month" },
                  product: item.price.product as string,
                },
              },
            ],
            proration_behavior: "none",
          });
        }
      }

      await admin.from("clients").update({ price: change.new_price }).eq("id", clientRow.id);
      await admin
        .from("workout_group_price_changes")
        .update({ status: "accepted", responded_at: new Date().toISOString() })
        .eq("id", change.id);

      return NextResponse.json({ ok: true, status: "accepted" });
    } catch (err: any) {
      return NextResponse.json(
        { error: "Errore nell'aggiornamento del pagamento: " + (err?.message || "sconosciuto") },
        { status: 500 }
      );
    }
  }

  // action === "decline"
  try {
    if (client?.stripe_subscription_id) {
      try {
        const stripe = getStripe();
        await stripe.subscriptions.cancel(client.stripe_subscription_id);
      } catch {
        // Se è già cancellato o non esiste più, non blocchiamo il rifiuto.
      }
    }

    await admin.from("group_members").delete().eq("group_id", change.group_id).eq("client_id", clientRow.id);
    await admin
      .from("workout_group_price_changes")
      .update({ status: "declined", responded_at: new Date().toISOString() })
      .eq("id", change.id);

    if (client?.trainer_id) {
      await admin.from("notifications").insert({
        trainer_id: client.trainer_id,
        client_id: clientRow.id,
        client_name: clientName,
        workout_title: `Ha rifiutato il nuovo prezzo (${change.new_price}€/mese) del gruppo "${group?.name || ""}" ed è stato rimosso`,
        kind: "prezzo_gruppo",
      });

      await sendPushToProfile(client.trainer_id, {
        title: "Prezzo rifiutato",
        body: `${clientName} ha rifiutato il nuovo prezzo (${change.new_price}€/mese) di "${group?.name || ""}" ed è stato rimosso dal gruppo.`,
        url: `/trainer/clienti/${clientRow.id}`,
      });
    }

    return NextResponse.json({ ok: true, status: "declined" });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Errore durante il rifiuto: " + (err?.message || "sconosciuto") },
      { status: 500 }
    );
  }
}

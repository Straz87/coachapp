import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushToProfile } from "@/lib/push";
import type Stripe from "stripe";

// POST /api/stripe/webhook
// Riceve gli eventi da Stripe (nessuna sessione utente: l'autenticazione
// è la firma "stripe-signature", verificata con STRIPE_WEBHOOK_SECRET).
// Aggiorna in automatico lo stato abbonamento del cliente in "clients"
// e avvisa il trainer con una notifica in-app quando serve.
// Serve il body "raw" (non json-parsato) per verificare la firma: per
// questo leggiamo request.text() e passiamo quello a constructEvent.

export const runtime = "nodejs";

async function updateFromSubscription(
  admin: ReturnType<typeof createAdminClient>,
  subscription: Stripe.Subscription
) {
  const clientId = subscription.metadata?.client_id;
  const periodEnd = subscription.current_period_end
    ? new Date(subscription.current_period_end * 1000).toISOString().slice(0, 10)
    : null;

  let status: "attivo" | "scaduto" | "sospeso" = "attivo";
  if (subscription.status === "canceled" || subscription.status === "unpaid") status = "sospeso";
  else if (subscription.status === "past_due" || subscription.status === "incomplete_expired") status = "scaduto";

  const query = clientId
    ? admin.from("clients").update({
        stripe_customer_id: subscription.customer as string,
        stripe_subscription_id: subscription.id,
        payment_managed_by_stripe: true,
        status,
        expiry_date: periodEnd,
      }).eq("id", clientId)
    : admin.from("clients").update({
        payment_managed_by_stripe: true,
        status,
        expiry_date: periodEnd,
      }).eq("stripe_subscription_id", subscription.id);

  await query;

  return clientId;
}

async function notifyTrainer(
  admin: ReturnType<typeof createAdminClient>,
  subscriptionId: string,
  message: string
) {
  const { data: client } = await admin
    .from("clients")
    .select("id, trainer_id, profiles:profile_id(full_name)")
    .eq("stripe_subscription_id", subscriptionId)
    .single();

  if (!client) return;
  const clientName = (client as any).profiles?.full_name || "Cliente";

  await admin.from("notifications").insert({
    trainer_id: client.trainer_id,
    client_id: client.id,
    client_name: clientName,
    workout_title: message,
    kind: "pagamento",
  });
}

// Avvisa il CLIENTE stesso (push sul telefono, se ha attivato le notifiche)
// quando il suo abbonamento viene bloccato: prima d'ora solo il trainer
// veniva avvisato, il cliente se ne accorgeva solo aprendo l'app e trovando
// la schermata di blocco.
async function notifyClient(
  admin: ReturnType<typeof createAdminClient>,
  subscriptionId: string,
  title: string,
  body: string
) {
  const { data: client } = await admin
    .from("clients")
    .select("profile_id")
    .eq("stripe_subscription_id", subscriptionId)
    .single();

  if (!client?.profile_id) return;

  await sendPushToProfile(client.profile_id, { title, body, url: "/cliente" });
}

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !secret) {
    return NextResponse.json({ error: "Webhook non configurato" }, { status: 400 });
  }

  const rawBody = await request.text();
  const stripe = getStripe();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, secret);
  } catch (err: any) {
    console.error("Firma webhook Stripe non valida:", err?.message);
    return NextResponse.json({ error: "Firma non valida" }, { status: 400 });
  }

  const admin = createAdminClient();

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode === "subscription" && session.subscription) {
          const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
          const clientId = await updateFromSubscription(admin, subscription);
          if (clientId) {
            await admin.from("clients").update({ last_payment_at: new Date().toISOString() }).eq("id", clientId);
          }
        }
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        if (invoice.subscription) {
          const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string);
          await updateFromSubscription(admin, subscription);
          await admin
            .from("clients")
            .update({ last_payment_at: new Date().toISOString() })
            .eq("stripe_subscription_id", subscription.id);
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        if (invoice.subscription) {
          await admin
            .from("clients")
            .update({ status: "scaduto" })
            .eq("stripe_subscription_id", invoice.subscription as string);
          await notifyTrainer(
            admin,
            invoice.subscription as string,
            "Pagamento abbonamento non riuscito"
          );
          await notifyClient(
            admin,
            invoice.subscription as string,
            "Abbonamento scaduto",
            "Il pagamento non è andato a buon fine. Apri l'app per regolarizzare e riattivare l'accesso."
          );
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        await updateFromSubscription(admin, subscription);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await admin
          .from("clients")
          .update({ status: "sospeso" })
          .eq("stripe_subscription_id", subscription.id);
        await notifyTrainer(admin, subscription.id, "Abbonamento annullato su Stripe");
        await notifyClient(
          admin,
          subscription.id,
          "Abbonamento sospeso",
          "Il tuo abbonamento è stato annullato. Apri l'app per riattivarlo."
        );
        break;
      }

      default:
        break;
    }
  } catch (err: any) {
    console.error("Errore gestione webhook Stripe:", err?.message);
    return NextResponse.json({ error: "Errore interno" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

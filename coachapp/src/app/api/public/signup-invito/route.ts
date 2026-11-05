import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";

// POST /api/public/signup-invito
// Endpoint pubblico (nessuna sessione utente): completa l'iscrizione a
// partire da un link di invito personale generato dal trainer dalla
// schermata "Nuovo cliente" (client_invites). Prezzo e prova gratuita sono
// già decisi dal trainer per QUESTO cliente; il cliente inserisce solo
// nome, email e password.
//
// Se l'invito ha già un client_id (cliente "segnaposto" creato dal trainer
// prima di mandare il link, con la scheda già caricata) l'account esistente
// viene completato con email e password scelte dal cliente: la scheda resta
// al suo posto. Altrimenti si crea tutto da zero come prima.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const token = body?.token;
  const fullName = (body?.fullName || "").trim();
  const email = (body?.email || "").trim().toLowerCase();
  const password = body?.password || "";

  if (!token || !fullName || !email || !password) {
    return NextResponse.json({ error: "Compila tutti i campi" }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "La password deve avere almeno 6 caratteri" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: invite } = await admin
    .from("client_invites")
    .select("*")
    .eq("token", token)
    .maybeSingle();

  if (!invite) {
    return NextResponse.json({ error: "Link non valido" }, { status: 404 });
  }
  if (invite.used_at) {
    return NextResponse.json({ error: "Questo link è già stato usato" }, { status: 400 });
  }

  let client: { id: string } | null = null;

  if (invite.client_id) {
    // --- Cliente già preparato dal trainer: completiamo l'account ---
    const { data: existing } = await admin
      .from("clients")
      .select("id, profile_id")
      .eq("id", invite.client_id)
      .maybeSingle();

    if (!existing) {
      return NextResponse.json({ error: "Link non valido" }, { status: 404 });
    }

    const { error: updateAuthError } = await admin.auth.admin.updateUserById(existing.profile_id, {
      email,
      password,
      email_confirm: true,
    });
    if (updateAuthError) {
      const msg = updateAuthError.message?.toLowerCase().includes("already")
        ? "Esiste già un account con questa email. Prova ad accedere invece di registrarti."
        : updateAuthError.message || "Impossibile creare l'account.";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const { error: profileUpdateError } = await admin
      .from("profiles")
      .update({ full_name: fullName, email })
      .eq("id", existing.profile_id);
    if (profileUpdateError) {
      return NextResponse.json({ error: profileUpdateError.message }, { status: 400 });
    }

    // L'accesso resta BLOCCATO (sospeso) finché non arriva il pagamento
    // (webhook Stripe) o il trainer non da' l'OK per il pagamento a mano.
    await admin.from("clients").update({ status: "sospeso" }).eq("id", existing.id);
    client = { id: existing.id };
  } else {
    // --- Comportamento originale: creiamo account, profilo e cliente ---
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (createError || !created.user) {
      const msg = createError?.message?.toLowerCase().includes("already")
        ? "Esiste già un account con questa email. Prova ad accedere invece di registrarti."
        : createError?.message || "Impossibile creare l'account.";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const newUserId = created.user.id;

    const { error: profileError } = await admin.from("profiles").insert({
      id: newUserId,
      role: "client",
      full_name: fullName,
      email,
    });

    if (profileError) {
      await admin.auth.admin.deleteUser(newUserId);
      return NextResponse.json({ error: profileError.message }, { status: 400 });
    }

    const { data: createdClient, error: clientError } = await admin
      .from("clients")
      .insert({
        profile_id: newUserId,
        trainer_id: invite.trainer_id,
        price: invite.price,
        billing_note: invite.billing_note,
        status: "sospeso",
      })
      .select()
      .single();

    if (clientError || !createdClient) {
      await admin.auth.admin.deleteUser(newUserId);
      return NextResponse.json(
        { error: clientError?.message || "Errore nella creazione del cliente" },
        { status: 400 }
      );
    }
    client = { id: createdClient.id };
  }

  await admin
    .from("client_invites")
    .update({ used_at: new Date().toISOString(), client_id: client.id })
    .eq("token", token);

  // Pagamento a mano: niente Stripe, il cliente resta in attesa dell'OK del trainer.
  if (String(invite.billing_note || "").startsWith("Pagamento a mano")) {
    return NextResponse.json({ url: "/login?iscrizione=attesa" });
  }

  const oneShotMatch = String(invite.billing_note || "").match(/Pagamento unico (\d+) mesi/);

  if (oneShotMatch) {
    const months = Number(oneShotMatch[1]);
    try {
      const stripe = getStripe();
      const origin = new URL(request.url).origin;
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        customer_email: email,
        customer_creation: "always",
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "eur",
              unit_amount: Math.round(Number(invite.price) * 100),
              product_data: { name: `Coaching ${months} mesi - ${fullName}` },
            },
          },
        ],
        metadata: { client_id: client.id, trainer_id: invite.trainer_id, months: String(months), kind: "unico" },
        success_url: `${origin}/login?iscrizione=ok`,
        cancel_url: `${origin}/iscriviti/invito/${token}?annullato=1`,
      });
      return NextResponse.json({ url: session.url });
    } catch (err: any) {
      console.error("Errore checkout unico:", err);
      return NextResponse.json(
        { error: "Errore nel collegamento al pagamento: " + (err?.message || "sconosciuto") },
        { status: 500 }
      );
    }
  }

  try {
    const stripe = getStripe();
    const origin = new URL(request.url).origin;

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: email,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "eur",
            unit_amount: Math.round(Number(invite.price) * 100),
            recurring: { interval: "month" },
            product_data: {
              name: `Coaching mensile - ${fullName}`,
            },
          },
        },
      ],
      metadata: { client_id: client.id, trainer_id: invite.trainer_id },
      subscription_data: {
        metadata: { client_id: client.id, trainer_id: invite.trainer_id },
        ...(invite.trial_days && invite.trial_days > 0
          ? { trial_period_days: invite.trial_days }
          : {}),
      },
      success_url: `${origin}/login?iscrizione=ok`,
      cancel_url: `${origin}/iscriviti/invito/${token}?annullato=1`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    console.error("Errore checkout invito Stripe:", err);
    return NextResponse.json(
      { error: "Errore nel collegamento al pagamento: " + (err?.message || "sconosciuto") },
      { status: 500 }
    );
  }
}

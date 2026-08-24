import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";

// POST /api/public/signup-invito
// Endpoint pubblico (nessuna sessione utente): completa l'iscrizione a
// partire da un link di invito personale generato dal trainer dalla
// schermata "Nuovo cliente" (client_invites). A differenza del link
// fisso /api/public/signup, qui prezzo e prova gratuita sono già decisi
// dal trainer per QUESTO cliente specifico; il cliente inserisce solo
// nome, email e password.
// Se il trainer ha impostato l'invito come gratuito (price a 0) si
// salta del tutto Stripe: l'account è già attivo, si va dritti al login.
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

  const { data: client, error: clientError } = await admin
    .from("clients")
    .insert({
      profile_id: newUserId,
      trainer_id: invite.trainer_id,
      price: invite.price,
      billing_note: invite.billing_note,
      status: "attivo",
    })
    .select()
    .single();

  if (clientError || !client) {
    await admin.auth.admin.deleteUser(newUserId);
    return NextResponse.json(
      { error: clientError?.message || "Errore nella creazione del cliente" },
      { status: 400 }
    );
  }

  await admin
    .from("client_invites")
    .update({ used_at: new Date().toISOString(), client_id: client.id })
    .eq("token", token);

  const origin = new URL(request.url).origin;

  // Invito gratuito: l'account è già attivo, niente Stripe.
  if (!invite.price || Number(invite.price) <= 0) {
    return NextResponse.json({ url: `${origin}/login?iscrizione=ok` });
  }

  try {
    const stripe = getStripe();

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

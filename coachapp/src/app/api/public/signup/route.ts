import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";
import { sendPushToProfile } from "@/lib/push";

// POST /api/public/signup
// Endpoint pubblico (nessuna sessione utente): un follower che clicca il
// link pubblico di un trainer (es. da una storia Instagram) si registra
// da solo. Il link può essere quello generico del trainer
// (public_signup_links), quello di un gruppo specifico (workout_groups,
// con groupId nel body: stesso calendario per tutti) oppure quello di un
// programma a durata fissa (programs, con programId nel body: chi si
// iscrive parte sempre dal giorno 1, al proprio ritmo). In tutti i casi
// prezzo e prova gratuita arrivano dalla sorgente giusta e il follower
// entra subito, senza che il trainer debba fare nulla.
//
// Gruppi e programmi possono offrire anche il "pagamento unico" (totale per
// N mesi): il follower sceglie con "plan" ("mensile" | "unico").
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const trainerId = body?.trainerId;
  const groupId = body?.groupId || null;
  const programId = body?.programId || null;
  const fullName = (body?.fullName || "").trim();
  const email = (body?.email || "").trim().toLowerCase();
  const password = body?.password || "";
  const plan = body?.plan === "unico" ? "unico" : "mensile";

  if (!trainerId || !fullName || !email || !password) {
    return NextResponse.json({ error: "Compila tutti i campi" }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "La password deve avere almeno 6 caratteri" }, { status: 400 });
  }

  const admin = createAdminClient();

  let price: number | null = null;
  let trialDays = 0;
  let couponId: string | null = null;
  let joinGroupId: string | null = null;
  let groupName: string | null = null;
  let joinProgramId: string | null = null;
  let programName: string | null = null;
  let offerTotal = 0;
  let offerMonths = 0;

  if (programId) {
    const { data: program } = await admin
      .from("programs")
      .select("*")
      .eq("id", programId)
      .eq("trainer_id", trainerId)
      .eq("public", true)
      .maybeSingle();

    if (!program || program.price === null || program.price === undefined) {
      return NextResponse.json({ error: "Questo link non è al momento disponibile" }, { status: 404 });
    }
    price = Number(program.price);
    trialDays = program.trial_days || 0;
    couponId = program.coupon_id || null;
    joinProgramId = program.id;
    programName = program.name;
    offerTotal = Number(program.one_shot_total) || 0;
    offerMonths = Number(program.one_shot_months) || 0;
  } else if (groupId) {
    const { data: group } = await admin
      .from("workout_groups")
      .select("*")
      .eq("id", groupId)
      .eq("trainer_id", trainerId)
      .eq("public", true)
      .maybeSingle();

    if (!group || group.price === null || group.price === undefined) {
      return NextResponse.json({ error: "Questo link non è al momento disponibile" }, { status: 404 });
    }
    price = Number(group.price);
    trialDays = group.trial_days || 0;
    couponId = group.coupon_id || null;
    joinGroupId = group.id;
    groupName = group.name;
    offerTotal = Number(group.one_shot_total) || 0;
    offerMonths = Number(group.one_shot_months) || 0;
  } else {
    const { data: link } = await admin
      .from("public_signup_links")
      .select("*")
      .eq("trainer_id", trainerId)
      .eq("active", true)
      .maybeSingle();

    if (!link || link.price === null || link.price === undefined) {
      return NextResponse.json({ error: "Questo link non è al momento disponibile" }, { status: 404 });
    }
    price = Number(link.price);
    trialDays = link.trial_days || 0;
    couponId = link.coupon_id || null;
    joinGroupId = link.group_id || null;
  }

  const chosenOneShot = plan === "unico" && offerTotal > 0 && offerMonths > 0;

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

  // Lo status parte da "in_attesa_pagamento" e non da "attivo": il cliente
  // resta bloccato (vedi app/cliente/layout.tsx) finché il webhook Stripe
  // (checkout.session.completed) non conferma il pagamento.
  const { data: client, error: clientError } = await admin
    .from("clients")
    .insert({
      profile_id: newUserId,
      trainer_id: trainerId,
      price: chosenOneShot ? Math.round((offerTotal / offerMonths) * 100) / 100 : price,
      ...(chosenOneShot ? { billing_note: `Pagamento unico ${offerMonths} mesi` } : {}),
      status: "in_attesa_pagamento",
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

  // Avvisa il trainer che un follower si è appena iscritto da solo.
  try {
    await admin.from("notifications").insert({
      trainer_id: trainerId,
      client_id: client.id,
      client_name: fullName,
      workout_title: "Nuovo cliente iscritto",
      kind: "nuovo_iscritto",
    });
    await sendPushToProfile(trainerId, {
      title: "Nuovo cliente",
      body: `${fullName} si è appena iscritto`,
      url: `/trainer/clienti/${client.id}`,
    });
  } catch (err) {
    console.error("Errore notifica nuovo iscritto:", err);
  }

  if (joinGroupId) {
    await admin.from("group_members").insert({
      group_id: joinGroupId,
      client_id: client.id,
    });
  }

  if (joinProgramId) {
    await admin.from("program_members").insert({
      program_id: joinProgramId,
      client_id: client.id,
      current_day: 1,
    });
  }

  try {
    const stripe = getStripe();
    const origin = new URL(request.url).origin;
    const basePath = joinProgramId
      ? `/iscriviti-programma/${trainerId}/${joinProgramId}`
      : groupId
      ? `/iscriviti/${trainerId}/${groupId}`
      : `/iscriviti/${trainerId}`;

    const productName = programName
      ? `${programName} - ${fullName}`
      : groupName
      ? `${groupName} - ${fullName}`
      : `Coaching mensile - ${fullName}`;

    const metadata = {
      client_id: client.id,
      trainer_id: trainerId,
      group_id: joinGroupId || "",
      program_id: joinProgramId || "",
    };

    if (chosenOneShot) {
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        customer_email: email,
        customer_creation: "always",
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "eur",
              unit_amount: Math.round(offerTotal * 100),
              product_data: { name: `${productName} (${offerMonths} mesi)` },
            },
          },
        ],
        metadata: { ...metadata, months: String(offerMonths), kind: "unico" },
        allow_promotion_codes: true,
        success_url: `${origin}${basePath}?ok=1`,
        cancel_url: `${origin}${basePath}?annullato=1`,
      });
      return NextResponse.json({ url: session.url });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: email,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "eur",
            unit_amount: Math.round(Number(price) * 100),
            recurring: { interval: "month" },
            product_data: {
              name: productName,
            },
          },
        },
      ],
      metadata,
      subscription_data: {
        metadata,
        ...(trialDays && trialDays > 0 ? { trial_period_days: trialDays } : {}),
      },
      // Se il trainer ha scelto uno sconto per questo link lo applichiamo in
      // automatico; altrimenti chi si iscrive può inserire un codice.
      ...(couponId
        ? { discounts: [{ coupon: couponId }] }
        : { allow_promotion_codes: true }),
      // Chiediamo SEMPRE la carta, anche se un coupon azzera il totale.
      success_url: `${origin}${basePath}?ok=1`,
      cancel_url: `${origin}${basePath}?annullato=1`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    console.error("Errore checkout pubblico Stripe:", err);
    return NextResponse.json(
      { error: "Errore nel collegamento al pagamento: " + (err?.message || "sconosciuto") },
      { status: 500 }
    );
  }
}

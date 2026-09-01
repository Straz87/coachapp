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
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const trainerId = body?.trainerId;
  const groupId = body?.groupId || null;
  const programId = body?.programId || null;
  const fullName = (body?.fullName || "").trim();
  const email = (body?.email || "").trim().toLowerCase();
  const password = body?.password || "";

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

  // Lo status parte da "in_attesa_pagamento" e non da "attivo": prima
  // d'ora il cliente risultava già attivo nella lista del trainer anche
  // se il checkout Stripe falliva o veniva abbandonato, creando account
  // fantasma senza alcun pagamento reale. Sarà il webhook Stripe
  // (checkout.session.completed) a portarlo ad "attivo" solo quando il
  // pagamento (o l'avvio di un trial con carta) è confermato.
  const { data: client, error: clientError } = await admin
    .from("clients")
    .insert({
      profile_id: newUserId,
      trainer_id: trainerId,
      price,
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

  // Avvisa il trainer che un follower si è appena iscritto da solo, cosi
  // non se ne accorge solo controllando a mano la lista clienti. Non
  // blocchiamo l'iscrizione se questo fallisce.
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

  // Se il link è collegato a un gruppo (es. "CF Training"), il follower ci
  // entra subito e vede il programma senza che il trainer debba fare nulla.
  // Non blocchiamo l'iscrizione se questo fallisce: il trainer può sempre
  // aggiungerlo a mano dalla pagina Gruppi.
  if (joinGroupId) {
    await admin.from("group_members").insert({
      group_id: joinGroupId,
      client_id: client.id,
    });
  }

  // Se il link è collegato a un programma a durata fissa, il follower parte
  // subito dal giorno 1 del suo percorso personale.
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
      metadata: {
        client_id: client.id,
        trainer_id: trainerId,
        group_id: joinGroupId || "",
        program_id: joinProgramId || "",
      },
      subscription_data: {
        metadata: {
          client_id: client.id,
          trainer_id: trainerId,
          group_id: joinGroupId || "",
          program_id: joinProgramId || "",
        },
        ...(trialDays && trialDays > 0 ? { trial_period_days: trialDays } : {}),
      },
      // Se il trainer ha già scelto lui uno sconto specifico per questo
      // link (coupon_id salvato su link/gruppo/programma), lo applichiamo
      // in automatico e non mostriamo il campo codice (Stripe non
      // permette di combinare le due cose sulla stessa sessione).
      // Altrimenti lasciamo che sia chi si iscrive a inserire da solo un
      // eventuale codice tra quelli creati in "Sconti e coupon".
      ...(couponId
        ? { discounts: [{ coupon: couponId }] }
        : { allow_promotion_codes: true }),
      // Se un coupon (pre-impostato o inserito dal follower) azzera del
      // tutto quanto dovuto oggi, Stripe salta anche la richiesta della
      // carta: utile per iscrizioni realmente gratuite/comp senza dover
      // comunque chiedere i dati di pagamento.
      payment_method_collection: "if_required",
      success_url: `${origin}${basePath}?ok=1`,
      cancel_url: `${origin}${basePath}?annullato=1`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    console.error("Errore checkout pubblico Stripe:", err);
    // Il cliente resta comunque creato (in attesa di pagamento): il
    // trainer lo ritrova nella lista clienti e può generare un link di
    // pagamento a mano dalla sua scheda.
    return NextResponse.json(
      { error: "Errore nel collegamento al pagamento: " + (err?.message || "sconosciuto") },
      { status: 500 }
    );
  }
}

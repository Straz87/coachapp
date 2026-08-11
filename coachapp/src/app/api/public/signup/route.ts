import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";

// POST /api/public/signup
// Endpoint pubblico (nessuna sessione utente): un follower che clicca il
// link pubblico di un trainer (es. da una storia Instagram) si registra
// da solo. Il link può essere quello generico del trainer
// (public_signup_links) oppure quello di un gruppo specifico
// (workout_groups, con groupId nel body): in quel caso prezzo e prova
// gratuita arrivano dal gruppo e il follower ci entra subito come membro,
// vedendo il programma senza che il trainer debba fare nulla.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const trainerId = body?.trainerId;
  const groupId = body?.groupId || null;
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

  if (groupId) {
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

  const { data: client, error: clientError } = await admin
    .from("clients")
    .insert({
      profile_id: newUserId,
      trainer_id: trainerId,
      price,
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

  try {
    const stripe = getStripe();
    const origin = new URL(request.url).origin;
    // I gruppi gratuiti (price 0) raccolgono comunque la carta: questo
    // permette al trainer di passare il gruppo a pagamento in futuro e far
    // partire l'addebito in automatico, senza dover richiedere di nuovo i
    // dati di pagamento a chi è già iscritto.
    const basePath = groupId ? `/iscriviti/${trainerId}/${groupId}` : `/iscriviti/${trainerId}`;

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
              name: groupName ? `${groupName} - ${fullName}` : `Coaching mensile - ${fullName}`,
            },
          },
        ],
      metadata: { client_id: client.id, trainer_id: trainerId, group_id: joinGroupId || "" },
      subscription_data: {
        metadata: { client_id: client.id, trainer_id: trainerId, group_id: joinGroupId || "" },
        ...(trialDays && trialDays > 0 ? { trial_period_days: trialDays } : {}),
      },
      ...(couponId ? { discounts: [{ coupon: couponId }] } : {}),
      success_url: `${origin}${basePath}?ok=1`,
      cancel_url: `${origin}${basePath}?annullato=1`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    console.error("Errore checkout pubblico Stripe:", err);
    // Il cliente resta comunque creato (senza abbonamento attivo): il
    // trainer lo ritrova nella lista clienti e può generare un link di
    // pagamento a mano dalla sua scheda.
    return NextResponse.json(
      { error: "Errore nel collegamento al pagamento: " + (err?.message || "sconosciuto") },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";

// POST /api/public/signup
// Endpoint pubblico (nessuna sessione utente): un follower che clicca il
// link pubblico di un trainer (es. da una storia Instagram) si registra
// da solo. Crea account + profilo + scheda cliente, poi genera la
// sessione di checkout Stripe con la prova gratuita/lo sconto impostati
// dal trainer per quel link, e restituisce l'url a cui reindirizzare.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const trainerId = body?.trainerId;
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

  const { data: link } = await admin
    .from("public_signup_links")
    .select("*")
    .eq("trainer_id", trainerId)
    .eq("active", true)
    .maybeSingle();

  if (!link || !link.price) {
    return NextResponse.json({ error: "Questo link non è al momento disponibile" }, { status: 404 });
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
      price: link.price,
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
  if (link.group_id) {
    await admin.from("group_members").insert({
      group_id: link.group_id,
      client_id: client.id,
    });
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
            unit_amount: Math.round(Number(link.price) * 100),
            recurring: { interval: "month" },
            product_data: {
              name: `Coaching mensile - ${fullName}`,
            },
          },
        },
      ],
      metadata: { client_id: client.id, trainer_id: trainerId },
      subscription_data: {
        metadata: { client_id: client.id, trainer_id: trainerId },
        ...(link.trial_days && link.trial_days > 0 ? { trial_period_days: link.trial_days } : {}),
      },
      ...(link.coupon_id ? { discounts: [{ coupon: link.coupon_id }] } : {}),
      success_url: `${origin}/iscriviti/${trainerId}?ok=1`,
      cancel_url: `${origin}/iscriviti/${trainerId}?annullato=1`,
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

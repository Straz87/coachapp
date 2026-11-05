import { NextResponse } from "next/server";
import crypto from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireTrainer } from "@/lib/auth";

// POST /api/clients/invite
// Il trainer imposta il nome del cliente, il prezzo (ed eventualmente giorni
// di prova gratuita e una nota di fatturazione) e genera un link personale
// da mandare via WhatsApp.
//
// Novità: se arriva anche il nome (fullName) il cliente viene creato subito
// come "segnaposto" (account interno con email provvisoria, stato sospeso).
// Così il trainer può caricargli la scheda PRIMA di mandare il link. Quando
// il cliente apre il link e si iscrive (signup-invito), il segnaposto viene
// completato con la sua email e la sua password, senza perdere la scheda.
// Senza nome il comportamento resta quello di prima (cliente creato solo
// al momento dell'iscrizione).
export async function POST(request: Request) {
  const { profile: trainerProfile } = await requireTrainer();

  const body = await request.json().catch(() => null);
  const price = body?.price ? Number(body.price) : null;
  const trialDays = body?.trialDays ? Number(body.trialDays) : 0;
  const manual = !!body?.manualPayment;
  // Pagamento unico: "price" e' il TOTALE da pagare in un'unica soluzione per
  // "months" mesi di coaching (es. 150 € per 3 mesi). Il prezzo mensile del
  // cliente diventa totale/mesi.
  const oneShot = !!body?.oneShot;
  const months = oneShot ? Math.max(1, Math.round(Number(body?.months) || 0)) : 0;
  if (oneShot && (!months || !price || price <= 0)) {
    return NextResponse.json({ error: "Imposta totale e numero di mesi." }, { status: 400 });
  }
  const MANUAL_TAG = "Pagamento a mano";
  let billingNote: string | null = body?.billingNote || null;
  if (oneShot) {
    billingNote = `Pagamento unico ${months} mesi${billingNote ? " - " + billingNote : ""}`;
  }
  if (manual && !(billingNote || "").startsWith(MANUAL_TAG)) {
    billingNote = billingNote ? `${MANUAL_TAG} - ${billingNote}` : MANUAL_TAG;
  }
  const fullName = (body?.fullName || "").trim();

  if (!manual && (!price || price <= 0)) {
    return NextResponse.json(
      { error: "Imposta un prezzo mensile per generare il link." },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const token = crypto.randomBytes(20).toString("hex");

  let clientId: string | null = null;

  if (fullName) {
    const placeholderEmail = `invito-${token.slice(0, 16)}@invito.hybridmethod.app`;
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: placeholderEmail,
      password: crypto.randomBytes(18).toString("base64url"),
      email_confirm: true,
    });
    if (createError || !created.user) {
      return NextResponse.json(
        { error: createError?.message || "Impossibile preparare il cliente." },
        { status: 400 }
      );
    }
    const newUserId = created.user.id;

    const { error: profileError } = await admin.from("profiles").insert({
      id: newUserId,
      role: "client",
      full_name: fullName,
      email: placeholderEmail,
    });
    if (profileError) {
      await admin.auth.admin.deleteUser(newUserId);
      return NextResponse.json({ error: profileError.message }, { status: 400 });
    }

    const { data: client, error: clientError } = await admin
      .from("clients")
      .insert({
        profile_id: newUserId,
        trainer_id: trainerProfile.id,
        price: oneShot && price ? Math.round((price / months) * 100) / 100 : price || null,
        billing_note: billingNote,
        status: "sospeso",
      })
      .select("id")
      .single();
    if (clientError || !client) {
      await admin.auth.admin.deleteUser(newUserId);
      return NextResponse.json(
        { error: clientError?.message || "Errore nella creazione del cliente" },
        { status: 400 }
      );
    }
    clientId = client.id;
  }

  const { error } = await admin.from("client_invites").insert({
    trainer_id: trainerProfile.id,
    price: price || 0,
    trial_days: trialDays,
    billing_note: billingNote,
    token,
    ...(clientId ? { client_id: clientId } : {}),
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const origin = new URL(request.url).origin;
  return NextResponse.json({ url: `${origin}/iscriviti/invito/${token}`, clientId });
}

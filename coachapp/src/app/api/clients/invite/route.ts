import { NextResponse } from "next/server";
import crypto from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireTrainer } from "@/lib/auth";

// POST /api/clients/invite
// Il trainer imposta solo il prezzo (ed eventualmente giorni di prova
// gratuita e una nota di fatturazione) e genera un link personale da
// mandare al cliente via WhatsApp: sarà il cliente ad inserire nome,
// email e password quando apre il link, così il trainer non deve più
// digitare l'email altrui per creare l'account.
// Se isFree è true il cliente non paga nulla: si salta del tutto il
// controllo sul prezzo e il checkout Stripe più avanti.
export async function POST(request: Request) {
  const { profile: trainerProfile } = await requireTrainer();

  const body = await request.json().catch(() => null);
  const isFree = !!body?.isFree;
  const price = isFree ? 0 : body?.price ? Number(body.price) : null;
  const trialDays = isFree ? 0 : body?.trialDays ? Number(body.trialDays) : 0;
  const billingNote = body?.billingNote || null;

  if (!isFree && (!price || price <= 0)) {
    return NextResponse.json(
      { error: "Imposta un prezzo mensile per generare il link." },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const token = crypto.randomBytes(20).toString("hex");

  const { error } = await admin.from("client_invites").insert({
    trainer_id: trainerProfile.id,
    price,
    trial_days: trialDays,
    billing_note: billingNote,
    token,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const origin = new URL(request.url).origin;
  return NextResponse.json({ url: `${origin}/iscriviti/invito/${token}` });
}

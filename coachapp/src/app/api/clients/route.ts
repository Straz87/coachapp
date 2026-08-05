import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireTrainer } from "@/lib/auth";

// Genera una password temporanea leggibile da comunicare al cliente
function generateTempPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let pwd = "";
  for (let i = 0; i < 10; i++) pwd += chars[Math.floor(Math.random() * chars.length)];
  return pwd;
}

// POST /api/clients
// Crea un nuovo cliente: account auth + profilo + riga di gestione (clients).
// Solo il trainer autenticato può chiamarla.
export async function POST(request: Request) {
  const { profile: trainerProfile } = await requireTrainer();

  const body = await request.json();
  const { full_name, email, price, billing_note, expiry_date } = body;

  if (!full_name || !email) {
    return NextResponse.json({ error: "Nome ed email sono obbligatori." }, { status: 400 });
  }

  const admin = createAdminClient();
  const tempPassword = generateTempPassword();

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
  });

  if (createError || !created.user) {
    return NextResponse.json(
      { error: createError?.message || "Impossibile creare l'account." },
      { status: 400 }
    );
  }

  const newUserId = created.user.id;

  const { error: profileError } = await admin.from("profiles").insert({
    id: newUserId,
    role: "client",
    full_name,
    email,
  });

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 400 });
  }

  const { error: clientError } = await admin.from("clients").insert({
    profile_id: newUserId,
    trainer_id: trainerProfile.id,
    price: price || null,
    billing_note: billing_note || null,
    expiry_date: expiry_date || null,
    status: "attivo",
  });

  if (clientError) {
    return NextResponse.json({ error: clientError.message }, { status: 400 });
  }

  return NextResponse.json({
    success: true,
    email,
    tempPassword,
  });
}

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireTrainer } from "@/lib/auth";

// POST /api/trainer/manual-payments  { clientId, amount, paidAt?, note?, months? }
// Registra un pagamento ricevuto di persona (contanti, bonifico...). Entra nei
// totali della Finanza. Se "months" e' indicato, estende anche l'accesso del
// cliente di quei mesi (e lo sblocca).
export async function POST(request: Request) {
  const { profile } = await requireTrainer();
  const body = await request.json().catch(() => null);
  const clientId = body?.clientId;
  const amount = Number(body?.amount);
  const months = Math.round(Number(body?.months) || 0);
  const note = (body?.note || "").toString().trim() || null;
  const paidAt = /^\d{4}-\d{2}-\d{2}$/.test(body?.paidAt || "") ? body.paidAt : new Date().toISOString().slice(0, 10);

  if (!clientId || !amount || amount <= 0) {
    return NextResponse.json({ error: "Inserisci un importo valido." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: client } = await admin
    .from("clients")
    .select("id, trainer_id, expiry_date")
    .eq("id", clientId)
    .maybeSingle();
  if (!client || client.trainer_id !== profile.id) {
    return NextResponse.json({ error: "Cliente non trovato" }, { status: 404 });
  }

  const { error } = await admin.from("manual_payments").insert({
    client_id: clientId,
    trainer_id: profile.id,
    amount,
    paid_at: paidAt,
    note,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const upd: Record<string, any> = { last_payment_at: new Date(`${paidAt}T12:00:00`).toISOString() };
  if (months > 0) {
    const cur = client.expiry_date ? new Date(`${client.expiry_date}T00:00:00`) : null;
    const start = cur && cur.getTime() > Date.now() ? cur : new Date();
    start.setMonth(start.getMonth() + months);
    upd.expiry_date = start.toISOString().slice(0, 10);
    upd.status = "attivo";
  }
  await admin.from("clients").update(upd).eq("id", clientId);

  return NextResponse.json({ ok: true });
}

// DELETE /api/trainer/manual-payments?id=...
export async function DELETE(request: Request) {
  const { profile } = await requireTrainer();
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Id mancante" }, { status: 400 });
  const admin = createAdminClient();
  const { error } = await admin.from("manual_payments").delete().eq("id", id).eq("trainer_id", profile.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

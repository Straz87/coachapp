import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireTrainer } from "@/lib/auth";

// GET /api/clients/invite-link?clientId=...
// Restituisce il link da mandare a un cliente. Se il cliente non si è ancora
// iscritto (invito non usato) è il suo link personale di iscrizione; altrimenti
// è il link di accesso all'app. Serve al pulsante "Condividi" del calendario.
export async function GET(request: Request) {
  const { profile: trainerProfile } = await requireTrainer();

  const clientId = new URL(request.url).searchParams.get("clientId");
  if (!clientId) {
    return NextResponse.json({ error: "Cliente mancante" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: client } = await admin
    .from("clients")
    .select("id")
    .eq("id", clientId)
    .eq("trainer_id", trainerProfile.id)
    .maybeSingle();

  if (!client) {
    return NextResponse.json({ error: "Cliente non trovato" }, { status: 404 });
  }

  const origin = new URL(request.url).origin;

  const { data: invite } = await admin
    .from("client_invites")
    .select("token")
    .eq("client_id", clientId)
    .is("used_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (invite?.token) {
    return NextResponse.json({ url: `${origin}/iscriviti/invito/${invite.token}`, pending: true });
  }

  return NextResponse.json({ url: `${origin}/login`, pending: false });
}

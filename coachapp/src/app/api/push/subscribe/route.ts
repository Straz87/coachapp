import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// POST /api/push/subscribe
// Body: l'oggetto PushSubscription del browser (sub.toJSON()):
// { endpoint, keys: { p256dh, auth } }
//
// Salva/aggiorna la sottoscrizione push dell'utente loggato (trainer o
// cliente). Scrive con il client di sessione normale: la tabella ha RLS
// che permette a ciascun utente di scrivere solo le proprie righe.
export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const endpoint = body?.endpoint;
  const p256dh = body?.keys?.p256dh;
  const auth = body?.keys?.auth;

  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: "Dati sottoscrizione non validi" }, { status: 400 });
  }

  const { error } = await supabase
    .from("push_subscriptions")
    .upsert(
      { profile_id: user.id, endpoint, p256dh, auth },
      { onConflict: "profile_id,endpoint" }
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

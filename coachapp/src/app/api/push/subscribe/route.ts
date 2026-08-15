import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendPushToProfile } from "@/lib/push";

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

  // Guardiamo PRIMA di salvare se il cliente aveva già almeno una
  // sottoscrizione push: ci serve per capire se questa è la prima volta
  // in assoluto che attiva le notifiche, per mandargli un push di
  // benvenuto (non possiamo farlo subito alla registrazione perché a
  // quel punto non ha ancora dato il permesso per le notifiche).
  const { count: existingCount } = await supabase
    .from("push_subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", user.id);

  const { error } = await supabase
    .from("push_subscriptions")
    .upsert(
      { profile_id: user.id, endpoint, p256dh, auth },
      { onConflict: "profile_id,endpoint" }
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Messaggio di benvenuto: solo per un CLIENTE (non il trainer), solo la
  // primissima volta che attiva le notifiche, e solo se si è registrato
  // di recente (evita di mandarlo a un cliente storico che oggi accende
  // per la prima volta le notifiche, ma non è propriamente "nuovo").
  const isFirstSubscription = !existingCount || existingCount === 0;
  if (isFirstSubscription) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, full_name, created_at")
      .eq("id", user.id)
      .single();

    const isRecentSignup =
      profile?.created_at &&
      Date.now() - new Date(profile.created_at).getTime() < 48 * 60 * 60 * 1000;

    if (profile?.role === "client" && isRecentSignup) {
      await sendPushToProfile(user.id, {
        title: "Benvenuto in Hybridmethod! 💪",
        body: "Il tuo account è pronto: qui trovi i tuoi allenamenti, i progressi e i messaggi del tuo coach.",
        url: "/cliente",
      });
    }
  }

  return NextResponse.json({ ok: true });
}

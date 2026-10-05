import { NextResponse } from "next/server";
import webpush from "web-push";
import { createClient } from "@/lib/supabase/server";

// GET /api/push/test
//
// Manda una notifica push di prova a TUTTI i dispositivi registrati
// dell'utente loggato e risponde con un riepilogo: quante sottoscrizioni
// ci sono e com'è andato l'invio a ciascuna (200/201 = consegnata al
// servizio push; 404/410 = sottoscrizione scaduta, il dispositivo non
// riceverà più nulla finché non si riattivano le notifiche).
// Serve a diagnosticare "non mi arrivano più le notifiche".
export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) {
    return NextResponse.json({ ok: false, error: "Chiavi VAPID non configurate sul server" });
  }
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:info@coachapp.app", publicKey, privateKey);

  const { data: subs, error } = await supabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("profile_id", user.id);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message });
  }

  const payload = JSON.stringify({
    title: "Notifica di prova",
    body: "Se leggi questo messaggio, le notifiche funzionano sul tuo telefono.",
    url: "/trainer",
  });

  const results = await Promise.all(
    (subs || []).map(async (sub) => {
      let host = "?";
      try {
        host = new URL(sub.endpoint).hostname;
      } catch {
        // endpoint non valido: lo segnaliamo comunque sotto
      }
      try {
        const res = await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        );
        return { host, status: res.statusCode };
      } catch (err: any) {
        return { host, status: err?.statusCode ?? "errore", detail: String(err?.body || err?.message || "").slice(0, 120) };
      }
    })
  );

  return NextResponse.json({ ok: true, subscriptions: results.length, results });
}

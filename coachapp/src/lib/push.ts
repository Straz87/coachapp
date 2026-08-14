import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";

// Invio notifiche push (Web Push standard, funziona su Android e su
// iPhone se il cliente ha aggiunto l'app alla schermata Home) usando il
// pacchetto "web-push", che si occupa di firmare la richiesta (VAPID) e
// cifrare il contenuto come richiesto dal protocollo.
//
// Richiede le env var su Vercel:
// - NEXT_PUBLIC_VAPID_PUBLIC_KEY (esposta anche al browser)
// - VAPID_PRIVATE_KEY (segreta)
// - VAPID_SUBJECT (opzionale, es. "mailto:tuamail@esempio.it")
//
// Se le chiavi non sono configurate, non fa nulla (logga un avviso)
// invece di far fallire chi la chiama: il resto dell'app continua a
// funzionare normalmente (restano comunque le notifiche in-app).
let vapidReady = false;

function ensureVapid() {
  if (vapidReady) return true;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return false;

  const subject = process.env.VAPID_SUBJECT || "mailto:info@coachapp.app";
  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidReady = true;
  return true;
}

export async function sendPushToProfile(
  profileId: string,
  payload: { title: string; body: string; url?: string }
) {
  if (!ensureVapid()) {
    console.warn("VAPID keys non configurate: notifica push non inviata a", profileId);
    return;
  }

  const admin = createAdminClient();
  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("profile_id", profileId);

  if (!subs || subs.length === 0) return;

  const body = JSON.stringify(payload);

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          body
        );
      } catch (err: any) {
        // 404/410 = il browser ha revocato la sottoscrizione (permesso
        // tolto, app disinstallata, ecc.): la rimuoviamo per non
        // riprovare all'infinito.
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          await admin.from("push_subscriptions").delete().eq("id", sub.id);
        } else {
          console.error("Errore invio push:", err?.statusCode, err?.body || err);
        }
      }
    })
  );
}

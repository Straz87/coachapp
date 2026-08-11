// Invio email tramite Resend (https://resend.com), chiamato direttamente
// via fetch alla loro API REST: evita di aggiungere una nuova dipendenza
// npm solo per questo. Richiede la env var RESEND_API_KEY su Vercel.
//
// Se RESEND_API_KEY non è configurata, la funzione non fa nulla (e logga
// un avviso) invece di far fallire la richiesta che la chiama: così finché
// il trainer non ha collegato Resend, il resto dell'app continua a
// funzionare normalmente (l'utente vede comunque la notifica in-app).
export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("RESEND_API_KEY non configurata: email non inviata a", to);
    return { ok: false, skipped: true };
  }

  const from = process.env.RESEND_FROM_EMAIL || "Coach App <onboarding@resend.dev>";

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to, subject, html }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("Errore invio email Resend:", res.status, text);
      return { ok: false, error: text };
    }

    return { ok: true };
  } catch (err) {
    console.error("Errore invio email:", err);
    return { ok: false, error: String(err) };
  }
}

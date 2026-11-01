"use client";

import { ReactNode, useState } from "react";

// Pulsante "Condividi" per mandare a un cliente il suo link: se non si è
// ancora iscritto è il link personale di iscrizione (con la scheda già pronta),
// altrimenti il link di accesso all'app. Apre un piccolo pannello con tre
// azioni affidabili: condividi (menu del telefono), WhatsApp e copia. La copia
// ha un piano B per i browser che bloccano la clipboard.
export default function ShareInviteButton({
  clientId,
  clientName,
  className,
  children,
}: {
  clientId: string;
  clientName?: string;
  className?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [copied, setCopied] = useState(false);

  const firstName = (clientName || "").trim().split(" ")[0];
  const text = pending
    ? `Ciao${firstName ? " " + firstName : ""}! Apri questo link, crea il tuo accesso e trovi subito il tuo programma: ${url}`
    : `Ciao${firstName ? " " + firstName : ""}! Ecco il link per accedere alla tua area: ${url}`;

  async function openPanel() {
    setOpen(true);
    setLoading(true);
    setError(null);
    setCopied(false);
    try {
      const res = await fetch(`/api/clients/invite-link?clientId=${clientId}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Non riesco a recuperare il link");
      } else {
        setUrl(data.url);
        setPending(!!data.pending);
      }
    } catch {
      setError("Errore di rete, riprova");
    }
    setLoading(false);
  }

  async function copy() {
    if (!url) return;
    let ok = false;
    try {
      await navigator.clipboard.writeText(url);
      ok = true;
    } catch {
      try {
        const ta = document.createElement("textarea");
        ta.value = url;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        ok = document.execCommand("copy");
        document.body.removeChild(ta);
      } catch {}
    }
    setCopied(ok);
    if (!ok) setError("Copia non riuscita: tieni premuto sul link qui sopra e copialo");
    else setTimeout(() => setCopied(false), 2500);
  }

  async function nativeShare() {
    try {
      await navigator.share({ text, url: url! });
    } catch {}
  }

  const canShare = typeof navigator !== "undefined" && typeof (navigator as any).share === "function";

  return (
    <>
      <button type="button" className={className} onClick={openPanel} aria-label="Condividi il link">
        {children}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-sm bg-white rounded-2xl p-5 space-y-3 text-left"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-sm">Manda il link{clientName ? ` a ${firstName}` : ""}</p>
                <p className="text-xs text-gray-500">
                  {pending
                    ? "Si iscrive, paga ed entra: trova già il suo programma."
                    : "Link per accedere alla sua area."}
                </p>
              </div>
              <button type="button" className="text-gray-400 text-lg leading-none" onClick={() => setOpen(false)} aria-label="Chiudi">
                ×
              </button>
            </div>

            {loading && <p className="text-sm text-gray-400">Un attimo…</p>}
            {error && <p className="text-xs text-red-600">{error}</p>}

            {url && (
              <>
                <input
                  readOnly
                  value={url}
                  onFocus={(e) => e.target.select()}
                  className="w-full bg-gray-50 rounded-lg px-3 py-2 text-xs text-gray-600 outline-none"
                />
                <div className="grid grid-cols-1 gap-2">
                  {canShare && (
                    <button type="button" className="btn-primary w-full" onClick={nativeShare}>
                      Condividi…
                    </button>
                  )}
                  <a
                    className={`${canShare ? "btn-secondary" : "btn-primary"} w-full text-center`}
                    href={`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Apri WhatsApp
                  </a>
                  <button type="button" className="btn-secondary w-full" onClick={copy}>
                    {copied ? "Copiato ✓" : "Copia il link"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

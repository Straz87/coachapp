"use client";

import { ReactNode, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import ClientEditForm from "@/components/ClientEditForm";

type Initial = {
  status: string;
  price: number | null;
  expiry_date: string | null;
  billing_note: string | null;
  internal_note: string | null;
  payment_managed_by_stripe?: boolean;
  stripe_subscription_id?: string | null;
  last_payment_at?: string | null;
};

// Pulsante "Impostazioni" del calendario: apre, senza lasciare la pagina,
// le impostazioni del cliente (stato, prezzo, abbonamento, link di pagamento,
// ultimi pagamenti e rimborsi).
export default function ClientSettingsButton({
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
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [initial, setInitial] = useState<Initial | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function openPanel() {
    setOpen(true);
    setError(null);
    setInitial(null);
    const { data, error: err } = await supabase
      .from("clients")
      .select("status, price, expiry_date, billing_note, internal_note, payment_managed_by_stripe, last_payment_at, stripe_subscription_id")
      .eq("id", clientId)
      .maybeSingle();
    if (err || !data) {
      setError("Non riesco a caricare le impostazioni");
      return;
    }
    setInitial(data as Initial);
  }

  const [approving, setApproving] = useState(false);
  async function approve() {
    if (!confirm("Confermi di aver ricevuto il pagamento? Il cliente vedra' subito il programma.")) return;
    setApproving(true);
    const { error: err } = await supabase
      .from("clients")
      .update({ status: "attivo", last_payment_at: new Date().toISOString() })
      .eq("id", clientId);
    setApproving(false);
    if (err) {
      setError("Non riesco a sbloccare: " + err.message);
      return;
    }
    openPanel();
  }
  const waiting = !!initial && initial.status === "sospeso" && !initial.stripe_subscription_id;

  return (
    <>
      <button type="button" className={className} onClick={openPanel} aria-label="Impostazioni cliente">
        {children}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-lg bg-gray-50 rounded-t-2xl sm:rounded-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 z-10 bg-gray-50 flex items-center justify-between px-5 py-3 border-b border-gray-100">
              <p className="font-semibold text-sm">Impostazioni{clientName ? ` · ${clientName}` : ""}</p>
              <button type="button" className="text-gray-400 text-xl leading-none" onClick={() => setOpen(false)} aria-label="Chiudi">
                ×
              </button>
            </div>
            <div className="p-4">
              {error && <p className="text-sm text-red-600">{error}</p>}
              {!initial && !error && <p className="text-sm text-gray-400">Caricamento…</p>}
              {waiting && (
                <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <p className="text-sm font-semibold text-amber-900">🔒 Accesso bloccato</p>
                  <p className="text-xs text-amber-800 mt-1">Il cliente non vede il programma finche' non confermi il pagamento.</p>
                  <button type="button" onClick={approve} disabled={approving} className="btn-primary w-full mt-3">
                    {approving ? "Attendere…" : "✅ Ho ricevuto il pagamento: sblocca"}
                  </button>
                </div>
              )}
              {initial && <ClientEditForm clientId={clientId} initial={initial} />}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";

async function requireTrainerContext() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  if (!profile || profile.role !== "trainer") return null;
  return { supabase, profile };
}

// DELETE /api/trainer/clients/[id]
// Cancella definitivamente un cliente: disdice l'abbonamento Stripe se
// attivo, poi elimina l'utente. L'eliminazione dell'utente rimuove a
// cascata profilo, scheda cliente, allenamenti, progressi e messaggi
// collegati (stesso meccanismo già usato per il rollback nell'iscrizione
// pubblica).
export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const ctx = await requireTrainerContext();
  if (!ctx) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }
  const { supabase, profile } = ctx;

  const { data: client } = await supabase
    .from("clients")
    .select("id, profile_id, stripe_subscription_id")
    .eq("id", params.id)
    .eq("trainer_id", profile.id)
    .maybeSingle();

  if (!client) {
    return NextResponse.json({ error: "Cliente non trovato" }, { status: 404 });
  }

  if (client.stripe_subscription_id) {
    try {
      const stripe = getStripe();
      await stripe.subscriptions.cancel(client.stripe_subscription_id);
    } catch {
      // Se l'abbonamento è già cancellato o non esiste più su Stripe, non blocchiamo l'eliminazione.
    }
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(client.profile_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

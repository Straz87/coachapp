import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Client "admin" con la Service Role Key: bypassa la Row Level Security.
// USARE SOLO lato server (route handlers), MAI esporlo al browser.
//
// Il fetch custom con cache "no-store" evita che le risposte delle query
// vengano messe in cache da Next.js: senza questo, capitava che una query
// eseguita con certi filtri restituisse dati vecchi (es. una riga con un
// flag ancora a false) anche dopo un aggiornamento nel database, perche'
// Next.js mette in cache le chiamate fetch in base all'URL anche in pagine
// dynamic, se la libreria che le esegue non specifica esplicitamente
// cache: "no-store".
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
      global: {
        fetch: (url, options = {}) =>
          fetch(url, { ...options, cache: "no-store" }),
      },
    }
  );
}

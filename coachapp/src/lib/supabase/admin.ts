import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Client "admin" con la Service Role Key: bypassa la Row Level Security.
// USARE SOLO lato server (route handlers), MAI esporlo al browser.
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

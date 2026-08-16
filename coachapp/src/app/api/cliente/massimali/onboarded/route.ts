import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

if (!user) {
  return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
}

const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || profile.role !== "client") {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

const { data: client } = await supabase
  .from("clients")
  .select("id")
  .eq("profile_id", user.id)
  .maybeSingle();

if (!client) {
  return NextResponse.json({ error: "Cliente non trovato" }, { status: 404 });
}

const admin = createAdminClient();
  await admin.from("clients").update({ benchmarks_onboarded: true }).eq("id", client.id);

return NextResponse.json({ ok: true });
}

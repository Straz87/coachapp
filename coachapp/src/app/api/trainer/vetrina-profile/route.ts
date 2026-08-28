import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Salva la foto e il testo di presentazione mostrati in cima alla vetrina
// pubblica del trainer. L'upload del file su Storage avviene lato client
// (stesso pattern delle foto progressi in ProgressForm.tsx); qui salviamo
// solo l'URL risultante e il testo sul profilo, con il client admin per
// non dover dipendere da policy RLS aggiuntive sulla tabella profiles.

async function requireTrainerContext() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  if (!profile || profile.role !== "trainer") return null;
  return { profile };
}

// POST /api/trainer/vetrina-profile
// Body: { bio: string | null, photoUrl: string | null }
export async function POST(request: Request) {
  const ctx = await requireTrainerContext();
  if (!ctx) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const bio = typeof body?.bio === "string" ? body.bio.slice(0, 600) : null;
  const photoUrl = typeof body?.photoUrl === "string" ? body.photoUrl : null;

  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({ vetrina_bio: bio, vetrina_photo_url: photoUrl })
    .eq("id", ctx.profile.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

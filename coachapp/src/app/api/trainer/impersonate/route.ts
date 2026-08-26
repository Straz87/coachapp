import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireTrainer } from "@/lib/auth";

// Permette al trainer di entrare nell'account cliente di prova con un
// click, per controllare l'app come la vede un cliente reale, senza fare
// logout/login a mano ogni volta. L'email di destinazione e' fissa e decisa
// qui, lato server: non arriva mai dal client, quindi non c'e' modo di
// usare questa rotta per entrare in un account diverso da quello di test.
const TEST_CLIENT_EMAIL = "straz1987@gmail.com";

export async function POST() {
await requireTrainer();

const admin = createAdminClient();

const { data: testProfile } = await admin
.from("profiles")
.select("id, role")
.eq("email", TEST_CLIENT_EMAIL)
.maybeSingle();

if (!testProfile || testProfile.role !== "client") {
return NextResponse.json({ error: "Account di prova non trovato." }, { status: 404 });
}

const { data: linkData, error } = await admin.auth.admin.generateLink({
type: "magiclink",
email: TEST_CLIENT_EMAIL,
});

if (error || !linkData?.properties?.hashed_token) {
return NextResponse.json(
{ error: error?.message || "Impossibile generare l'accesso di prova." },
{ status: 400 }
);
}

return NextResponse.json({ tokenHash: linkData.properties.hashed_token });
}

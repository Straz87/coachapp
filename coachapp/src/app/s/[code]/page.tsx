import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";

// Link corto e permanente per programmi e gruppi: usa i primi 8
// caratteri dell'id (prima del primo trattino) come codice, es.
// /s/32c8454a al posto di /iscriviti(-programma)/<trainerId>/<id>.
export default async function ShortLinkPage({
params,
}: {
params: { code: string };
}) {
const code = (params.code || "").toLowerCase();

if (!/^[0-9a-f]{8}$/.test(code)) {
redirect("/");
}

const lower = `${code}-0000-0000-0000-000000000000`;
const upper = `${code}-ffff-ffff-ffff-ffffffffffff`;
const admin = createAdminClient();

const { data: program } = await admin
.from("programs")
.select("id, trainer_id")
.gte("id", lower)
.lte("id", upper)
.eq("public", true)
.maybeSingle();

if (program) {
redirect(`/iscriviti-programma/${program.trainer_id}/${program.id}`);
}

const { data: group } = await admin
.from("workout_groups")
.select("id, trainer_id")
.gte("id", lower)
.lte("id", upper)
.eq("public", true)
.maybeSingle();

if (group) {
redirect(`/iscriviti/${group.trainer_id}/${group.id}`);
}

redirect("/");
}

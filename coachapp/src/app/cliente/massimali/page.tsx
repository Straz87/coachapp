import { createElement as h } from "react";
import { requireClientRole } from "@/lib/auth";
import ClientMaxes from "@/components/ClientMaxes";
import BenchmarkForm from "@/components/BenchmarkForm";

export default async function MassimaliPage({
    searchParams,
}: {
    searchParams: { onboarding?: string };
}) {
    const { supabase, profile } = await requireClientRole();

const { data: client } = await supabase
    .from("clients")
    .select("id")
    .eq("profile_id", profile.id)
    .single();

if (!client) return null;

const onboarding = searchParams?.onboarding === "1";

return h(
    "div",
    { className: "max-w-xl" },
    h("h1", { className: "text-2xl font-bold mb-6" }, "Massimali"),
    h(BenchmarkForm, { clientId: client.id, onboarding }),
    h("div", { className: "mt-6" }, h(ClientMaxes, { clientId: client.id }))
    );
}

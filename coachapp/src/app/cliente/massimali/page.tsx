import { createElement as h } from "react";
import { requireClientRole } from "@/lib/auth";
import ClientMaxes from "@/components/ClientMaxes";
import CategoryMaxes from "@/components/CategoryMaxes";
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
    { className: "max-w-xl space-y-6" },
        h("h1", { className: "text-2xl font-bold" }, "Massimali"),
        onboarding ? h(BenchmarkForm, { clientId: client.id, onboarding: true }) : null,
        h(ClientMaxes, { clientId: client.id }),
        h(CategoryMaxes, { clientId: client.id, categoryKey: "monostructural", label: "Monostructural", valueType: "time" }),
        h(CategoryMaxes, { clientId: client.id, categoryKey: "gymnastics", label: "Gymnastics", valueType: "reps" })
    );
}

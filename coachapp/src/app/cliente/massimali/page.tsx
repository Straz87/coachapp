import { createElement as h } from "react";
import { requireClientRole } from "@/lib/auth";
import ClientMaxes from "@/components/ClientMaxes";

export default async function MassimaliPage() {
    const { supabase, profile } = await requireClientRole();

  const { data: client } = await supabase
      .from("clients")
      .select("id")
      .eq("profile_id", profile.id)
      .single();

  if (!client) return null;

  return h(
        "div",
    { className: "max-w-xl" },
        h("h1", { className: "text-2xl font-bold mb-6" }, "Massimali"),
        h(ClientMaxes, { clientId: client.id })
      );
}

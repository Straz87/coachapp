import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Pagina radice: smista l'utente loggato verso la sua area
// (trainer o cliente) in base al ruolo salvato in "profiles".
export default async function Home() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user!.id)
    .single();

  if (profile?.role === "trainer") {
    redirect("/trainer");
  }

  redirect("/cliente");
}

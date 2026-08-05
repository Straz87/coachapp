import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Recupera l'utente loggato + il suo profilo (ruolo, nome, ecc.).
// Se non è loggato, rimanda al login.
export async function requireProfile() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/login");

  return { supabase, user, profile };
}

// Come sopra, ma obbliga il ruolo "trainer". Altrimenti rimanda all'area cliente.
export async function requireTrainer() {
  const ctx = await requireProfile();
  if (ctx.profile.role !== "trainer") redirect("/cliente");
  return ctx;
}

// Come sopra, ma obbliga il ruolo "client".
export async function requireClientRole() {
  const ctx = await requireProfile();
  if (ctx.profile.role !== "client") redirect("/trainer");
  return ctx;
}

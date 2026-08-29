import { requireTrainer } from "@/lib/auth";
import PublicLinkManager from "@/components/PublicLinkManager";
import VetrinaProfileManager from "@/components/VetrinaProfileManager";

export default async function TrainerVetrinaPage() {
    const { supabase, profile } = await requireTrainer();

  const [{ data: groupsData }, { data: linkData }] = await Promise.all([
        supabase
          .from("workout_groups")
          .select("id, name")
          .eq("trainer_id", profile.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("public_signup_links")
          .select("*")
          .eq("trainer_id", profile.id)
          .maybeSingle(),
      ]);

  return (
    <div>
    <div className="mb-6">
    <h1 className="text-2xl font-bold">Vetrina</h1>
    <p className="text-gray-500 text-sm">Gestisci il link pubblico di iscrizione e la presentazione mostrata nella tua pagina vetrina.</p></div>
      <PublicLinkManager trainerId={profile.id} groups={groupsData || []} initialLink={linkData} />
      <VetrinaProfileManager trainerId={profile.id} initialBio={profile.vetrina_bio} initialPhotoUrl={profile.vetrina_photo_url} />
    </div>
    );
}

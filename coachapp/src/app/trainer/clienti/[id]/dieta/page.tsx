import Link from "next/link";
import { notFound } from "next/navigation";
import { requireTrainer } from "@/lib/auth";
import DietEditor from "@/components/DietEditor";

export default async function ClientDietPage({ params }: { params: { id: string } }) {
  const { supabase, profile } = await requireTrainer();

  const { data: client } = await supabase
    .from("clients")
    .select("id, profiles:profile_id(full_name)")
    .eq("id", params.id)
    .eq("trainer_id", profile.id)
    .single();

  if (!client) notFound();

  const { data: plan } = await supabase
    .from("diet_plans")
    .select("*")
    .eq("client_id", params.id)
    .maybeSingle();

  return (
    <div className="max-w-2xl">
      <Link href={`/trainer/clienti/${params.id}`} className="text-sm text-gray-500 hover:underline">
        ← Torna al cliente
      </Link>
      <h1 className="text-2xl font-bold mt-1 mb-6">
        Piano alimentare · {(client as any).profiles?.full_name}
      </h1>

      <DietEditor
        clientId={params.id}
        trainerId={profile.id}
        planId={plan?.id || null}
        initialTitle={plan?.title || "Piano alimentare"}
        initialContent={plan?.content || ""}
      />
    </div>
  );
}

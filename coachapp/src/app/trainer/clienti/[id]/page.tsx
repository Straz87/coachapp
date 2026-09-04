import Link from "next/link";
import { notFound } from "next/navigation";
import { requireTrainer } from "@/lib/auth";
import ClientEditForm from "@/components/ClientEditForm";
import ProgressChart from "@/components/ProgressChart";
import ClientMaxes from "@/components/ClientMaxes";
import CategoryMaxes from "@/components/CategoryMaxes";

export default async function ClientDetailPage({ params }: { params: { id: string } }) {
  const { supabase, profile } = await requireTrainer();

  const { data: client } = await supabase
    .from("clients")
    .select("*, profiles:profile_id(full_name, email, phone)")
    .eq("id", params.id)
    .eq("trainer_id", profile.id)
    .single();

  if (!client) notFound();

  const { data: progress } = await supabase
    .from("progress_logs")
    .select("date, weight_kg, note, photo_url")
    .eq("client_id", params.id)
    .order("date", { ascending: true });

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link href="/trainer" className="text-sm text-gray-500 hover:underline">
          ← Torna ai clienti
        </Link>
        <h1 className="text-2xl font-bold mt-1">{client.profiles?.full_name}</h1>
        <p className="text-gray-500 text-sm">{client.profiles?.email}</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link href={`/trainer/calendario?cliente=${client.id}`} className="btn-secondary">
          📅 Vedi/assegna allenamenti
        </Link>
        <Link href={`/trainer/clienti/${client.id}/dieta`} className="btn-secondary">
          🥗 Piano alimentare
        </Link>
        <Link href={`/trainer/chat/${client.profile_id}`} className="btn-secondary">
          💬 Scrivi un messaggio
        </Link>
      </div>

      <ClientEditForm
        clientId={client.id}
        initial={{
          status: client.status,
          price: client.price,
          expiry_date: client.expiry_date,
          billing_note: client.billing_note,
          internal_note: client.internal_note,
          payment_managed_by_stripe: client.payment_managed_by_stripe,
          last_payment_at: client.last_payment_at,
          induction_onboarded: client.induction_onboarded,
          induction_goal: client.induction_goal,
          induction_experience: client.induction_experience,
          induction_days_per_week: client.induction_days_per_week,
          induction_limitations: client.induction_limitations,
          induction_notes: client.induction_notes,
        }}
      />

              <ClientMaxes clientId={client.id} />
      <CategoryMaxes clientId={client.id} categoryKey="monostructural" label="Monostructural" valueType="time" />
      <CategoryMaxes clientId={client.id} categoryKey="gymnastics" label="Gymnastics" valueType="reps" />

      <div className="card">
        <h2 className="font-semibold mb-3">Andamento peso</h2>
        <ProgressChart data={progress || []} />
      </div>

      <div className="card">
        <h2 className="font-semibold mb-3">Ultime registrazioni</h2>
        {progress && progress.length > 0 ? (
          <ul className="divide-y divide-gray-100">
            {[...progress].reverse().slice(0, 8).map((p, i) => (
              <li key={i} className="py-2 flex justify-between text-sm">
                <span>{new Date(p.date).toLocaleDateString("it-IT")}</span>
                <span>{p.weight_kg ? `${p.weight_kg} kg` : "—"}</span>
                <span className="text-gray-400">{p.note || ""}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-400 text-sm">Il cliente non ha ancora registrato progressi.</p>
        )}
      </div>
    </div>
  );
}

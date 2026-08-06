import { requireClientRole } from "@/lib/auth";
import AllenamentoGiorno from "@/components/AllenamentoGiorno";
import { WEEKDAY_LABELS } from "@/lib/dates";

const MONTH_LABELS = [
  "gen", "feb", "mar", "apr", "mag", "giu",
  "lug", "ago", "set", "ott", "nov", "dic",
];

function formatDateLabel(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  const weekday = WEEKDAY_LABELS[(d.getDay() + 6) % 7];
  return `${weekday} ${String(d.getDate()).padStart(2, "0")} ${MONTH_LABELS[d.getMonth()]}`;
}

export default async function AllenamentoGiornoPage({
  params,
}: {
  params: { date: string };
}) {
  const { supabase, profile } = await requireClientRole();

  const { data: client } = await supabase
    .from("clients")
    .select("id, trainer_id")
    .eq("profile_id", profile.id)
    .single();

  if (!client) {
    return <p className="text-gray-400">Il tuo trainer non ti ha ancora collegato ad un profilo.</p>;
  }

  const { data: trainer } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", client.trainer_id)
    .single();

  return (
    <div className="-m-4 md:-m-8">
      <AllenamentoGiorno
        clientId={client.id}
        profileId={profile.id}
        trainerName={trainer?.full_name || "Trainer"}
        date={params.date}
        dateLabel={formatDateLabel(params.date)}
      />
    </div>
  );
}

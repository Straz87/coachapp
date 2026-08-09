import Link from "next/link";
import { requireTrainer } from "@/lib/auth";
import { WEEKDAY_LABELS } from "@/lib/dates";
import RevisioneGiornata from "@/components/RevisioneGiornata";

const MONTH_LABELS = [
  "gen", "feb", "mar", "apr", "mag", "giu",
  "lug", "ago", "set", "ott", "nov", "dic",
];

function formatDateLabel(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  const weekday = WEEKDAY_LABELS[(d.getDay() + 6) % 7];
  return `${weekday} ${String(d.getDate()).padStart(2, "0")} ${MONTH_LABELS[d.getMonth()]}`;
}

// Vista di sola lettura di una giornata specifica di un cliente: mostra
// cosa ha svolto (blocchi, punteggi, RPE), senza aprire l'editor della
// scheda. Raggiunta cliccando una notifica di allenamento completato.
export default async function GiornataPage({
  searchParams,
}: {
  searchParams: { cliente?: string; gruppo?: string; data?: string };
}) {
  const { supabase, profile } = await requireTrainer();

  const clientId = searchParams.cliente || null;
  const groupId = searchParams.gruppo || null;
  const date = searchParams.data || null;

  if (!clientId || !date) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-4">Revisione allenamento</h1>
        <p className="text-gray-400">Cliente o data mancanti.</p>
        <Link href="/trainer/calendario" className="text-brand-dark text-sm inline-block mt-3">
          ← Vai al calendario
        </Link>
      </div>
    );
  }

  const { data: client } = await supabase
    .from("clients")
    .select("id, trainer_id, profiles:profile_id(full_name)")
    .eq("id", clientId)
    .eq("trainer_id", profile.id)
    .maybeSingle();

  if (!client) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-4">Revisione allenamento</h1>
        <p className="text-gray-400">Cliente non trovato.</p>
      </div>
    );
  }

  const clientName = (client.profiles as any)?.full_name || "Cliente";

  return (
    <div>
      <Link href="/trainer" className="text-gray-500 text-sm inline-block mb-4">
        ← Torna ai clienti
      </Link>
      <RevisioneGiornata
        clientId={clientId}
        clientName={clientName}
        date={date}
        dateLabel={formatDateLabel(date)}
        groupId={groupId}
      />
    </div>
  );
}

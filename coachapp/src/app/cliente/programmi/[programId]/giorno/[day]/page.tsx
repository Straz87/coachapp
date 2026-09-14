import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireClientRole } from "@/lib/auth";
import { htmlToLines } from "@/lib/workoutTypes";
import ProgramDayStrip from "@/components/ProgramDayStrip";
import ProgramMarkDoneButton from "@/components/ProgramMarkDoneButton";

// Pagina di un singolo giorno di un programma a durata fissa (es. "Giorno
// 12 di 90"), con la striscia dei giorni gia' raggiunti in alto cosi' il
// cliente puo' rivedere il passato senza perdere il filo — stessa idea del
// DayStrip usato per il calendario, applicata qui ai programmi. I giorni
// futuri (non ancora raggiunti) non sono navigabili: se il cliente forza
// l'URL su un giorno futuro viene rimandato al suo giorno corrente.
export default async function ProgramDayPage({
  params,
}: {
  params: { programId: string; day: string };
}) {
  const { supabase, profile } = await requireClientRole();
  const dayNumber = Number(params.day);

  const { data: client } = await supabase
    .from("clients")
    .select("id")
    .eq("profile_id", profile.id)
    .single();

  if (!client) {
    return <p className="text-gray-400">Il tuo trainer non ti ha ancora collegato ad un profilo.</p>;
  }

  const { data: membership } = await supabase
    .from("program_members")
    .select("id, program_id, current_day, completed, programs:program_id(name, length_days)")
    .eq("client_id", client.id)
    .eq("program_id", params.programId)
    .maybeSingle();

  if (!membership) notFound();

  const currentDay = (membership as any).current_day as number;
  const programName = (membership as any).programs?.name || "Programma";
  const lengthDays = (membership as any).programs?.length_days || 0;

  if (!dayNumber || dayNumber < 1 || dayNumber > currentDay) {
    redirect(`/cliente/programmi/${params.programId}/giorno/${currentDay}`);
  }

  const { data: day } = await supabase
    .from("program_days")
    .select("title, blocks")
    .eq("program_id", params.programId)
    .eq("day_number", dayNumber)
    .maybeSingle();

  const isToday = dayNumber === currentDay;

  return (
    <div className="max-w-xl mx-auto p-4 space-y-4">
      <Link href="/cliente" className="text-gray-500 text-sm inline-block">
        ← Torna alla home
      </Link>

      <ProgramDayStrip
        programId={params.programId}
        viewingDay={dayNumber}
        maxDay={currentDay}
        lengthDays={lengthDays}
      />

      <div>
        <p className="text-xs text-gray-400 uppercase tracking-wide">
          {programName} · Giorno {dayNumber} di {lengthDays}
        </p>
        <h1 className="text-2xl font-bold text-gray-900 mt-1">{day?.title || "Giorno di riposo"}</h1>
      </div>

      {day ? (
        <div className="space-y-3">
          {(day.blocks || []).map((b: { type: string; description: string }, i: number) => (
            <div key={i} className="card">
              <p className="text-xs font-medium text-gray-700 mb-1">{b.type}</p>
              {htmlToLines(b.description).map((line: string, li: number) => (
                <p key={li} className="text-sm text-gray-600">
                  {line}
                </p>
              ))}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-gray-400 text-sm">Il tuo coach non ha ancora pubblicato questo giorno.</p>
      )}

      {isToday && day && !membership.completed && <ProgramMarkDoneButton programId={params.programId} />}
    </div>
  );
}

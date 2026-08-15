import { notFound } from "next/navigation";
import Link from "next/link";
import { requireTrainer } from "@/lib/auth";
import ProgramDayEditor from "@/components/ProgramDayEditor";

export default async function ProgrammaDetailPage({ params }: { params: { id: string } }) {
  const { supabase, profile } = await requireTrainer();

  const { data: program } = await supabase
    .from("programs")
    .select("*")
    .eq("id", params.id)
    .eq("trainer_id", profile.id)
    .maybeSingle();

  if (!program) notFound();

  const { data: days } = await supabase
    .from("program_days")
    .select("*")
    .eq("program_id", params.id)
    .order("day_number", { ascending: true });

  return (
    <div className="max-w-3xl">
      <Link href="/trainer/programmi" className="text-sm text-gray-500 hover:underline">
        ← Torna ai programmi
      </Link>
      <h1 className="text-2xl font-bold mt-1 mb-1">{program.name}</h1>
      <p className="text-gray-500 text-sm mb-6">
        {program.length_days} giorni · ogni iscritto vede il giorno in cui si trova lui, non quello del
        calendario.
      </p>
      <ProgramDayEditor
        programId={program.id}
        trainerId={profile.id}
        lengthDays={program.length_days}
        initialDays={(days || []).map((d: any) => ({
          dayNumber: d.day_number,
          title: d.title,
          blocks: d.blocks,
          activityType: d.activity_type,
        }))}
      />
    </div>
  );
}

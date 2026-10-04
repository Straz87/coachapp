import { notFound } from "next/navigation";
import Link from "next/link";
import { requireTrainer } from "@/lib/auth";
import ProgramDayEditor from "@/components/ProgramDayEditor";
import {
  Block,
  ClientScores,
  getBlockScores,
  readClientScoreEntry,
  scoreLabel,
} from "@/lib/workoutTypes";

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

  // Carichi inseriti dai clienti iscritti, giorno per giorno.
  const { data: members } = await supabase
    .from("program_members")
    .select("client_id, current_day, clients:client_id(id, profiles:profile_id(full_name))")
    .eq("program_id", params.id);

  const { data: scoreRows } = await supabase
    .from("program_day_scores")
    .select("client_id, day_number, client_scores")
    .eq("program_id", params.id)
    .order("day_number", { ascending: false });

  const blocksByDay = new Map<number, Block[]>(
    (days || []).map((d: any) => [d.day_number as number, (d.blocks || []) as Block[]] as [number, Block[]])
  );

  const loadsByClient = (members || []).map((m: any) => {
    const name = m.clients?.profiles?.full_name || "Cliente";
    const rows = (scoreRows || [])
      .filter((r: any) => r.client_id === m.client_id)
      .map((r: any) => {
        const blocks = blocksByDay.get(r.day_number) || [];
        const scores = (r.client_scores || {}) as ClientScores;
        const lines: string[] = [];
        blocks.forEach((b, bi) => {
          getBlockScores(b).forEach((s, si) => {
            const entry = readClientScoreEntry(scores, bi, si);
            const filled = (entry?.values || []).filter((v) => v && v.trim() !== "");
            if (filled.length > 0) {
              lines.push(`${b.type} — ${scoreLabel(s.type)}: ${filled.join(" · ")}`);
            }
          });
        });
        return { day: r.day_number as number, lines };
      })
      .filter((r) => r.lines.length > 0);
    return { id: m.client_id as string, name, currentDay: m.current_day as number, rows };
  });

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

      {loadsByClient.length > 0 && (
        <div className="card mb-6">
          <h2 className="font-semibold mb-3">Carichi dei clienti</h2>
          <div className="space-y-4">
            {loadsByClient.map((c) => (
              <div key={c.id}>
                <p className="text-sm font-medium text-gray-900">
                  {c.name} <span className="text-gray-400 font-normal">· giorno {c.currentDay}</span>
                </p>
                {c.rows.length === 0 ? (
                  <p className="text-xs text-gray-400 mt-1">Nessun carico inserito ancora.</p>
                ) : (
                  <div className="mt-1 space-y-2">
                    {c.rows.slice(0, 7).map((r) => (
                      <div key={r.day}>
                        <p className="text-xs font-medium text-gray-500">Giorno {r.day}</p>
                        {r.lines.map((line, li) => (
                          <p key={li} className="text-sm text-gray-600">
                            {line}
                          </p>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

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

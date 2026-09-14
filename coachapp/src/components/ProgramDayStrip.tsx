"use client";

import Link from "next/link";

// Striscia orizzontale dei giorni di un programma a durata fissa (stile
// Hustle Up, come DayStrip per il calendario): mostra solo i giorni gia'
// raggiunti (1..maxDay), cosi' il cliente puo' rivedere il passato e il
// giorno di oggi senza vedere in anteprima i giorni futuri del programma
// pensati dal coach. Il numero di giorni rimanenti resta visibile ma non
// cliccabile, giusto per dare il senso della lunghezza totale.
export default function ProgramDayStrip({
  programId,
  viewingDay,
  maxDay,
  lengthDays,
}: {
  programId: string;
  viewingDay: number;
  maxDay: number;
  lengthDays: number;
}) {
  const days = Array.from({ length: Math.max(0, maxDay) }, (_, i) => i + 1);
  const remaining = Math.max(0, lengthDays - maxDay);

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
      {days.map((d) => {
        const active = d === viewingDay;
        const isToday = d === maxDay;
        return (
          <Link
            key={d}
            href={`/cliente/programmi/${programId}/giorno/${d}`}
            className={`shrink-0 flex items-center justify-center rounded-full w-10 h-10 text-sm font-semibold transition-colors ${
              active
                ? "bg-gray-900 text-white"
                : isToday
                ? "bg-brand/20 text-gray-900"
                : "bg-gray-100 text-gray-500"
            }`}
          >
            {d}
          </Link>
        );
      })}
      {remaining > 0 && (
        <span className="shrink-0 text-xs text-gray-400 px-2 whitespace-nowrap">
          +{remaining} giorni
        </span>
      )}
    </div>
  );
}

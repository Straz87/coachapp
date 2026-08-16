// Riferimenti prestativi personali dell'atleta (facoltativi). Sono divisi
// in 4 categorie fisse: Monostructural (tempo), Strength e Weightlifting
// (1RM in kg, riusano client_maxes cosi' il calcolo automatico delle
// percentuali nelle schede li vede subito), Gymnastics (max unbroken).

export type BenchmarkValueType = "time" | "weight_kg" | "reps";

export type BenchmarkCategory = {
    key: string;
    label: string;
    valueType: BenchmarkValueType;
    exercises: string[];
};

export const BENCHMARK_CATEGORIES: BenchmarkCategory[] = [
  {
        key: "monostructural",
        label: "Monostructural",
        valueType: "time",
                    exercises: ["5 km Row", "5 km Run", "5 km SkiErg", "10 km Bike", "2 km Row", "1 Mile Run", "500m Row", "Max Cal Assault Bike (4')"],
  },
  {
        key: "strength",
        label: "Strength (1RM)",
        valueType: "weight_kg",
        exercises: ["Back Squat", "Deadlift", "Bench Press", "Shoulder Press"],
  },
  {
        key: "weightlifting",
        label: "Weightlifting (1RM)",
        valueType: "weight_kg",
        exercises: ["Snatch", "Clean", "Clean & Jerk"],
  },
  {
        key: "gymnastics",
        label: "Gymnastics (Max Unbroken)",
        valueType: "reps",
                    exercises: ["Pull-Up", "Parallel Bar Dip", "Ring Muscle-Up", "Toes-to-Bar", "Chest-to-Bar Pull-Up", "Bar Muscle-Up", "Handstand Push-Up", "Rope Climb"],
  },
  ];


// Converte un tempo scritto come "mm:ss" o "hh:mm:ss" in secondi totali.
// Ritorna null se il testo e' vuoto o non valido.
export function parseTimeToSeconds(raw: string): number | null {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    const parts = trimmed.split(":").map((p) => p.trim());
    if (parts.some((p) => p === "" || isNaN(Number(p)))) return null;
    const nums = parts.map(Number);
    if (nums.length === 2) return nums[0] * 60 + nums[1];
    if (nums.length === 3) return nums[0] * 3600 + nums[1] * 60 + nums[2];
    return null;
}

// Converte secondi totali in "mm:ss" (o "h:mm:ss" se supera un'ora).
export function formatSecondsToTime(totalSeconds: number): string {
    const clamped = Math.max(0, Math.round(totalSeconds));
    const h = Math.floor(clamped / 3600);
    const m = Math.floor((clamped % 3600) / 60);
    const s = clamped % 60;
    if (h > 0) {
          return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    }
    return `${m}:${String(s).padStart(2, "0")}`;
}


export type MaxRow = {
    id: string;
    exercise_name: string;
    value_kg: number | null;
    time_seconds: number | null;
    reps: number | null;
    recorded_at: string;
};

// Riduce un elenco di righe (che puo' contenere piu' voci nel tempo per lo
// stesso esercizio) al valore piu' recente per ciascuno. Il confronto sul
// nome esercizio ignora maiuscole/minuscole.
export function latestByExercise<T extends { exercise_name: string; recorded_at: string }>(
    rows: T[]
    ): T[] {
    const sorted = [...rows].sort((a, b) => (a.recorded_at < b.recorded_at ? 1 : -1));
    const seen = new Set<string>();
    const result: T[] = [];
    for (const r of sorted) {
        const key = r.exercise_name.trim().toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        result.push(r);
    }
    return result;
}

// Storico completo (dal piu' recente al piu' vecchio) per un dato esercizio.
export function historyForExercise<T extends { exercise_name: string; recorded_at: string }>(
    rows: T[],
    exerciseName: string
    ): T[] {
    const key = exerciseName.trim().toLowerCase();
    return rows
    .filter((r) => r.exercise_name.trim().toLowerCase() === key)
    .sort((a, b) => (a.recorded_at < b.recorded_at ? 1 : -1));
}

// Formatta il valore di una riga massimale a seconda del tipo (kg/tempo/reps).
export function formatMaxValue(row: { value_kg: number | null; time_seconds: number | null; reps: number | null }): string {
    if (row.time_seconds != null) return formatSecondsToTime(row.time_seconds);
    if (row.value_kg != null) return row.value_kg + " kg";
    if (row.reps != null) return row.reps + " reps";
    return "-";
}

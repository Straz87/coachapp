// Tipi condivisi per la struttura delle schede di allenamento,
// ispirati alle sezioni/domini di Hustle Up (Warm up, Skills, WOD, ecc.)

export const BLOCK_TYPES = [
  "Warm up",
  "Skills",
  "Il Movemax del giorno",
  "WOD Specifico",
  "WOD",
  "Bodybuilding",
  "Mobility",
  "Altro",
];

export const SCORE_TYPES = [
  { value: "peso", label: "Peso (kg)" },
  { value: "for_time", label: "For Time (min:sec)" },
  { value: "amrap", label: "AMRAP (round & rep)" },
  { value: "reps", label: "Ripetizioni" },
  { value: "calorie", label: "Calorie" },
  { value: "distanza", label: "Distanza" },
];

export const TIMER_TYPES = ["AMRAP", "EMOM", "TABATA", "FOR_TIME"];

export const TIMER_LABELS: Record<string, string> = {
  AMRAP: "AMRAP",
  EMOM: "EMOM",
  TABATA: "Tabata",
  FOR_TIME: "For Time",
};

export function scoreLabel(value: string): string {
  return SCORE_TYPES.find((s) => s.value === value)?.label || value;
}

export type ScoreConfig = {
  type: string;
  target: string; // es. "100 kg", "sub 5:00", testo libero
};

export type TimerConfig = {
  type: string;
  minutes: number;
  seconds: number;
};

export type Block = {
  type: string;
  description: string; // HTML (grassetto, corsivo, liste, link)
  rpe: number | null;
  score: ScoreConfig | null;
  timer: TimerConfig | null;
};

export function emptyBlock(): Block {
  return {
    type: BLOCK_TYPES[0],
    description: "",
    rpe: null,
    score: null,
    timer: null,
  };
}

// Punteggio effettivo inserito dal cliente per un blocco specifico
// (chiave = indice del blocco nell'array `blocks`, come stringa).
export type ClientScoreEntry = {
  value: string;
  rx: boolean; // true = RX (come da programma), false = Scalato
};

export type ClientScores = Record<string, ClientScoreEntry>;

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
  { value: "amrap_rep", label: "AMRAP (rep)" },
  { value: "reps", label: "Ripetizioni" },
  { value: "calorie", label: "Calorie" },
  { value: "distanza", label: "Distanza" },
  { value: "watt", label: "Watt" },
  { value: "feedback", label: "Feedback degli atleti" },
];

// Come combinare più serie dello stesso punteggio (es. 5 serie di peso)
// in un unico valore mostrato nel tabellone/storico.
export const AGGREGATION_TYPES = [
  { value: "elenco", label: "Elenco (ogni serie)" },
  { value: "totale", label: "Totale (somma)" },
  { value: "media", label: "Media" },
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

export function aggregationLabel(value: string): string {
  return AGGREGATION_TYPES.find((a) => a.value === value)?.label || value;
}

export type ScoreConfig = {
  type: string;
  target: string; // es. "100 kg", "sub 5:00", testo libero
  sets: number; // numero di serie richieste (es. 5x5 back squat -> 5)
  aggregation: string; // come combinare le serie: "elenco" | "totale" | "media"
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
  // Nome del movimento (es. "Back Squat"), usato SOLO per raggruppare i punteggi
  // nel grafico di progressione settimanale. Non è un massimale/1RM: è solo
  // la serie storica dei pesi di lavoro inseriti dal cliente nelle schede.
  exerciseName: string | null;
};

export function emptyBlock(): Block {
  return {
    type: BLOCK_TYPES[0],
    description: "",
    rpe: null,
    score: null,
    timer: null,
    exerciseName: null,
  };
}

export function emptyScoreConfig(): ScoreConfig {
  return { type: SCORE_TYPES[0].value, target: "", sets: 1, aggregation: "elenco" };
}

// Estrae il primo numero da una stringa punteggio (es. "100 kg" -> 100, "5 giri + 12 rep" -> 5).
export function parseScoreNumber(raw: string): number | null {
  const match = raw.match(/(\d+(\.\d+)?)/);
  return match ? Number(match[1]) : null;
}

// Punteggio effettivo inserito dal cliente per un blocco specifico
// (chiave = indice del blocco nell'array `blocks`, come stringa).
// `values` contiene una voce per ogni serie richiesta dal blocco
// (block.score.sets); per i blocchi con una sola serie è un array di 1.
export type ClientScoreEntry = {
  values: string[];
  rx: boolean; // true = RX (come da programma), false = Scalato
};

export type ClientScores = Record<string, ClientScoreEntry>;

// Le schede create prima dell'introduzione delle serie multiple salvavano
// { value: string, rx: boolean }. Questo helper legge sia il formato nuovo
// che quello vecchio, così i dati già in produzione restano leggibili.
export function normalizeEntry(raw: unknown): ClientScoreEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as { values?: unknown; value?: unknown; rx?: unknown };
  if (Array.isArray(r.values)) {
    return { values: r.values.map((v) => String(v)), rx: !!r.rx };
  }
  if (typeof r.value === "string") {
    return { values: [r.value], rx: !!r.rx };
  }
  return null;
}

// Testo da mostrare per un punteggio (una o più serie), secondo la modalità
// di aggregazione scelta dal trainer per quel blocco.
export function displayScoreValue(entry: ClientScoreEntry, aggregation: string = "elenco"): string {
  const values = entry.values.filter((v) => v.trim() !== "");
  if (values.length === 0) return "";
  if (values.length === 1) return values[0];

  if (aggregation === "totale" || aggregation === "media") {
    const nums = values.map(parseScoreNumber);
    const validNums = nums.filter((n): n is number => n !== null);
    if (validNums.length === values.length) {
      const sum = validNums.reduce((a, b) => a + b, 0);
      const result = aggregation === "totale" ? sum : sum / validNums.length;
      const rounded = Math.round(result * 100) / 100;
      return aggregation === "totale" ? `${rounded} (tot.)` : `${rounded} (media)`;
    }
  }
  return values.join(" · ");
}

// Valore numerico rappresentativo di un punteggio (una o più serie), per
// grafici e classifiche. Ritorna null se non c'è nulla di numerico.
export function numericScoreValue(entry: ClientScoreEntry, aggregation: string = "elenco"): number | null {
  const values = entry.values.filter((v) => v.trim() !== "");
  if (values.length === 0) return null;
  const nums = values.map(parseScoreNumber).filter((n): n is number => n !== null);
  if (nums.length === 0) return null;
  if (aggregation === "totale") return nums.reduce((a, b) => a + b, 0);
  if (aggregation === "media") return nums.reduce((a, b) => a + b, 0) / nums.length;
  return nums[0];
}

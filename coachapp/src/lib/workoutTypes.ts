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
  "Nota per l'atleta",
];

// Tipo di attività principale della giornata (facoltativo, mostrato come
// etichetta nel calendario e nell'editor).
export const ACTIVITY_TYPES = ["Palestra", "Metcon", "Sollevamento pesi"];

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

// Un singolo "set" di un timer a più round (es. AMRAP 1, AMRAP 2...): la sua
// durata di lavoro e un riposo opzionale PRIMA che inizi (il primo set di un
// timer ha sempre restMinutes/restSeconds a 0: non c'è riposo prima di iniziare).
export type TimerSet = {
  minutes: number;
  seconds: number;
  restMinutes: number;
  restSeconds: number;
};

export type TimerConfig = {
  type: string;
  // Formato nuovo (AMRAP/EMOM a più set con durate/riposi indipendenti).
  sets?: TimerSet[];
  // Formato precedente, mantenuto per retrocompatibilità con le schede già
  // salvate: usato direttamente da TABATA/FOR TIME, e convertito al volo in
  // `sets` per AMRAP/EMOM tramite getTimerSets().
  minutes?: number;
  seconds?: number;
  rounds?: number;
  restMinutes?: number;
  restSeconds?: number;
};

// Ricava l'elenco dei set di un timer, sia che sia stato salvato nel formato
// nuovo (sets) sia nel vecchio formato (minutes/seconds/rounds/rest...).
export function getTimerSets(timer: TimerConfig): TimerSet[] {
  if (timer.sets && timer.sets.length > 0) return timer.sets;
  const rounds = Math.max(1, timer.rounds ?? 1);
  const minutes = timer.minutes ?? 0;
  const seconds = timer.seconds ?? 0;
  const restMinutes = timer.restMinutes ?? 0;
  const restSeconds = timer.restSeconds ?? 0;
  return Array.from({ length: rounds }, (_, i) => ({
    minutes,
    seconds,
    restMinutes: i === 0 ? 0 : restMinutes,
    restSeconds: i === 0 ? 0 : restSeconds,
  }));
}

export function timerSetSeconds(s: TimerSet): number {
  return Math.max(1, s.minutes * 60 + s.seconds);
}

export function timerRestSeconds(s: TimerSet): number {
  return Math.max(0, s.restMinutes * 60 + s.restSeconds);
}

// Durata totale di un timer a più set: somma di tutte le durate di lavoro e
// di tutti i riposi (il primo set non ne ha, essendo restMinutes/Seconds a 0).
export function totalTimerSeconds(sets: TimerSet[]): number {
  return sets.reduce((sum, s) => sum + timerSetSeconds(s) + timerRestSeconds(s), 0);
}

export function formatClock(totalSeconds: number): string {
  const clamped = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(clamped / 60);
  const s = clamped % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

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

// Per il tipo di punteggio "amrap" (round & rep) il cliente inserisce due
// numeri separati: i giri completati e le ripetizioni supplementari nel
// giro incompleto. Li combiniamo in un'unica stringa per riusare lo stesso
// modello dati (ClientScoreEntry.values: string[]) degli altri tipi.
export function formatAmrapValue(giri: number, reps: number): string {
  return `${giri} giri & ${reps} reps`;
}

export function parseAmrapValue(raw: string): { giri: number; reps: number } {
  const match = raw.match(/(\d+)\s*gir\w*[^\d]*(\d+)\s*rep/i);
  if (match) {
    return { giri: Number(match[1]), reps: Number(match[2]) };
  }
  // Compatibilità con punteggi amrap salvati prima di questa modifica
  // (testo libero, es. "5 giri + 12 rep" o solo un numero di giri).
  const single = parseScoreNumber(raw);
  return { giri: single ?? 0, reps: 0 };
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

// Converte l'HTML del RichTextEditor in righe di solo testo, per mostrare
// l'intero contenuto di un blocco nel calendario (nessun troncamento).
export function htmlToLines(html: string): string[] {
  if (!html) return [];
  const withBreaks = html
    .replace(/<\/(p|li|div|h[1-6])>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n");
  const text = withBreaks.replace(/<[^>]+>/g, "");
  return text
    .split("\n")
    .map((l) => l.replace(/&nbsp;/g, " ").trim())
    .filter((l) => l.length > 0);
}

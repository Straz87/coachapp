"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  TimerConfig,
  TIMER_LABELS,
  getTimerSets,
  timerSetSeconds,
  timerRestSeconds,
  totalTimerSeconds,
  formatClock,
} from "@/lib/workoutTypes";

// I browser mobili (soprattutto Safari/iOS) permettono di produrre audio solo
// se l'AudioContext viene creato/riattivato dentro un tap/click reale. Per
// questo teniamo un unico AudioContext per timer, sbloccato al primo tocco su
// Avvia, e lo riusiamo per tutti i beep successivi (anche quelli lanciati dai
// setInterval, che da soli non sono "gesture" valide per i browser).
function playBeep(ctx: AudioContext | null, frequency = 880, duration = 150) {
  if (!ctx) return;
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration / 1000);
  } catch {
    // audio non disponibile, ignora
  }
}

function CircularProgress({
  progress,
  size = 176,
  color = "#84cc16",
  trackColor = "#e5e7eb",
}: {
  progress: number;
  size?: number;
  color?: string;
  trackColor?: string;
}) {
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(1, Math.max(0, progress));
  const offset = circumference * (1 - clamped);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={radius} stroke={trackColor} strokeWidth={strokeWidth} fill="none" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={color}
        strokeWidth={strokeWidth}
        fill="none"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 0.3s linear" }}
      />
    </svg>
  );
}

// Conto alla rovescia prima di iniziare, e prima di ogni nuovo set dopo un
// riposo (EMOM e AMRAP a più set).
const PRESTART_SECONDS = 10;

type Phase = "idle" | "countdown" | "work" | "rest" | "done";

export default function WorkoutTimer({
  timer,
  autoStart,
  onComplete,
}: {
  timer: TimerConfig;
  autoStart?: boolean;
  // Chiamato una volta, quando il timer finisce tutti i set: passa i giri
  // registrati con il tasto "+" durante ogni set AMRAP (usati per
  // precompilare il punteggio "Giri e ripetizioni").
  onComplete?: (roundsBySet: number[][]) => void;
}) {
  const isTabata = timer.type === "TABATA";
  const isEmom = timer.type === "EMOM";
  const isAmrap = timer.type === "AMRAP";
  const isCountUp = timer.type === "FOR_TIME";

  // AMRAP, EMOM e TABATA usano il motore a più set (conto alla rovescia
  // iniziale, lavoro/riposo per ogni set, stop automatico all'ultimo). Il
  // TABATA li usa per alternare davvero lavoro e recupero come impostati
  // dal trainer. Solo FOR TIME resta sul motore "classico" a durata unica.
  const useNewEngine = isEmom || isAmrap || isTabata;

  // JSON.stringify come chiave stabile: getTimerSets() crea un nuovo array a
  // ogni chiamata, e senza questo il motore ripartirebbe ad ogni render.
  const setsKey = JSON.stringify(timer.sets ?? [timer.minutes, timer.seconds, timer.rounds, timer.restMinutes, timer.restSeconds]);
  const sets = useMemo(() => getTimerSets(timer), [setsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const [running, setRunning] = useState(!!autoStart);

  // Un solo AudioContext per istanza di timer, creato/sbloccato al primo tap
  // su Avvia e riutilizzato per tutti i beep successivi.
  const audioCtxRef = useRef<AudioContext | null>(null);

  function unlockAudio() {
    if (typeof window === "undefined") return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioCtx();
      }
      if (audioCtxRef.current.state === "suspended") {
        audioCtxRef.current.resume();
      }
    } catch {
      // audio non disponibile, ignora
    }
  }

  useEffect(() => {
    return () => {
      audioCtxRef.current?.close();
    };
  }, []);

  // --- Motore "classico": TABATA, FOR TIME ---
  const classicSeconds = Math.max(1, (timer.minutes ?? 0) * 60 + (timer.seconds ?? 0));
  const [elapsed, setElapsed] = useState(0);
  const [targetReached, setTargetReached] = useState(false);

  useEffect(() => {
    if (useNewEngine || !running) return;
    const id = setInterval(() => setElapsed((prev) => prev + 1), 1000);
    return () => clearInterval(id);
  }, [running, useNewEngine]);

  // FOR TIME: beep quando si raggiunge l'obiettivo (una sola volta)
  useEffect(() => {
    if (useNewEngine) return;
    if (isCountUp && running && elapsed >= classicSeconds && !targetReached) {
      setTargetReached(true);
      playBeep(audioCtxRef.current, 660, 400);
    }
  }, [elapsed, isCountUp, running, classicSeconds, targetReached, useNewEngine]);

  // --- Motore a più set: AMRAP, EMOM ---
  const [phase, setPhase] = useState<Phase>(autoStart && useNewEngine ? "countdown" : "idle");
  const [phaseElapsed, setPhaseElapsed] = useState(0);
  const [currentSetIndex, setCurrentSetIndex] = useState(0);
  const [roundsBySet, setRoundsBySet] = useState<number[][]>(() => sets.map(() => []));
  const [lastRoundAt, setLastRoundAt] = useState(0);
  const completedRef = useRef(false);

  useEffect(() => {
    if (!useNewEngine || !running) return;
    const id = setInterval(() => setPhaseElapsed((prev) => prev + 1), 1000);
    return () => clearInterval(id);
  }, [running, useNewEngine]);

  useEffect(() => {
    if (!useNewEngine || !running) return;

    if (phase === "countdown") {
      const remaining = PRESTART_SECONDS - phaseElapsed;
      if (remaining === 3 || remaining === 2 || remaining === 1) {
        playBeep(audioCtxRef.current, 880, 120);
      }
      if (phaseElapsed >= PRESTART_SECONDS) {
        setPhase("work");
        setPhaseElapsed(0);
        setCurrentSetIndex(0);
        setLastRoundAt(0);
        playBeep(audioCtxRef.current, 1046, 250);
      }
      return;
    }

    if (phase === "work") {
      const workSeconds = timerSetSeconds(sets[currentSetIndex]);
      if (phaseElapsed >= workSeconds) {
        if (currentSetIndex >= sets.length - 1) {
          setPhase("done");
          setRunning(false);
          playBeep(audioCtxRef.current, 660, 700);
          return;
        }
        const nextSet = sets[currentSetIndex + 1];
        const rest = isAmrap || isTabata ? timerRestSeconds(nextSet) : 0;
        if (rest > 0) {
          setPhase("rest");
          setPhaseElapsed(0);
          playBeep(audioCtxRef.current, 523, 200);
        } else {
          setCurrentSetIndex((i) => i + 1);
          setPhase("work");
          setPhaseElapsed(0);
          setLastRoundAt(0);
          playBeep(audioCtxRef.current, 1046, 200);
        }
      }
      return;
    }

    if (phase === "rest") {
      const nextSet = sets[currentSetIndex + 1];
      const restTotal = timerRestSeconds(nextSet);
      const remaining = restTotal - phaseElapsed;
      if (remaining === 3 || remaining === 2 || remaining === 1) {
        playBeep(audioCtxRef.current, 880, 120);
      }
      if (phaseElapsed >= restTotal) {
        setCurrentSetIndex((i) => i + 1);
        setPhase("work");
        setPhaseElapsed(0);
        setLastRoundAt(0);
        playBeep(audioCtxRef.current, 1046, 250);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, phaseElapsed, running, useNewEngine, sets, currentSetIndex, isAmrap, isTabata]);

  // Chiama onComplete una sola volta, quando il timer finisce da solo o
  // viene fermato manualmente (tasto rosso).
  useEffect(() => {
    if (phase === "done" && !completedRef.current) {
      completedRef.current = true;
      onComplete?.(roundsBySet);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  function handleLogRound() {
    if (phase !== "work" || !isAmrap) return;
    unlockAudio();
    const split = Math.max(0, phaseElapsed - lastRoundAt);
    setLastRoundAt(phaseElapsed);
    setRoundsBySet((prev) => prev.map((arr, idx) => (idx === currentSetIndex ? [...arr, split] : arr)));
    playBeep(audioCtxRef.current, 784, 90);
  }

  function handleStopEarly() {
    setRunning(false);
    setPhase("done");
    playBeep(audioCtxRef.current, 660, 500);
  }

  function handleStartPause() {
    unlockAudio();
    if (useNewEngine && phase === "idle" && !running) {
      setPhase("countdown");
      setPhaseElapsed(0);
      setRunning(true);
      return;
    }
    setRunning((r) => !r);
  }

  function handleReset() {
    setRunning(false);
    setElapsed(0);
    setTargetReached(false);
    setPhase("idle");
    setPhaseElapsed(0);
    setCurrentSetIndex(0);
    setLastRoundAt(0);
    setRoundsBySet(sets.map(() => []));
    completedRef.current = false;
  }

  // --- Rendering: AMRAP (card chiara, ghiera lime) ---
  if (isAmrap) {
    let mainDisplay: string;
    let subCaption: string;
    let progress = 0;
    let ringColor = "#84cc16";
    const currentSet = sets[Math.min(currentSetIndex, sets.length - 1)];

    if (phase === "idle") {
      mainDisplay = "▶";
      subCaption = `${sets.length > 1 ? `${sets.length} set · ` : ""}Durata totale ${formatClock(totalTimerSeconds(sets))}`;
    } else if (phase === "countdown") {
      const remaining = PRESTART_SECONDS - phaseElapsed;
      mainDisplay = String(Math.max(1, remaining));
      subCaption = "Si parte tra...";
      progress = phaseElapsed / PRESTART_SECONDS;
      ringColor = "#f59e0b";
    } else if (phase === "work") {
      mainDisplay = formatClock(phaseElapsed);
      subCaption = sets.length > 1 ? `Set ${currentSetIndex + 1} di ${sets.length}` : "Tempo trascorso";
      progress = phaseElapsed / timerSetSeconds(currentSet);
    } else if (phase === "rest") {
      const restTotal = timerRestSeconds(sets[currentSetIndex + 1]);
      const remaining = Math.max(0, restTotal - phaseElapsed);
      mainDisplay = formatClock(remaining);
      subCaption = `Riposo · prossimo set ${currentSetIndex + 2} di ${sets.length}`;
      progress = restTotal > 0 ? phaseElapsed / restTotal : 1;
      ringColor = "#0ea5e9";
    } else {
      mainDisplay = "✓";
      subCaption = "Sessione completata!";
      progress = 1;
    }

    const giri = roundsBySet[Math.min(currentSetIndex, roundsBySet.length - 1)] || [];
    const ultimoGiro = giri.length > 0 ? formatClock(giri[giri.length - 1]) : "--:--";
    const setDurationLabel = formatClock(timerSetSeconds(currentSet));

    return (
      <div className="mt-2 rounded-2xl p-4 bg-white border border-gray-200">
        <div className="flex items-center justify-between text-xs mb-2">
          <span className="font-semibold tracking-wide text-gray-400 uppercase">{TIMER_LABELS[timer.type]}</span>
          <span style={{ color: "#65a30d" }} className="font-semibold">
            {phase === "work" ? "IN CORSO" : ""}
          </span>
        </div>
        {(phase === "work" || phase === "rest") && (
          <p className="text-center text-[11px] mb-2 text-gray-400">
            {phase === "work" ? setDurationLabel : subCaption}
          </p>
        )}
        <div className="relative mx-auto my-1 flex items-center justify-center" style={{ width: 160, height: 160 }}>
          <CircularProgress progress={progress} color={ringColor} size={160} trackColor="#e5e7eb" />
          <span className="absolute text-4xl font-semibold tabular-nums text-gray-900">{mainDisplay}</span>
        </div>
        <p className="text-center text-xs mb-3 text-gray-400">
          {phase === "idle" || phase === "countdown" ? subCaption : phase === "done" ? subCaption : running ? "Pausa" : "In pausa"}
        </p>

        {phase === "idle" || phase === "done" ? (
          <div className="flex justify-center gap-2">
            <button onClick={handleStartPause} className="btn-primary" disabled={phase === "done"}>
              {phase === "done" ? "Completato" : "Avvia"}
            </button>
            <button onClick={handleReset} className="btn-secondary">
              Reset
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between px-2 mb-3">
              <button
                onClick={handleStopEarly}
                aria-label="Termina"
                className="w-12 h-12 rounded-full flex items-center justify-center"
                style={{ background: "#fdeceb" }}
              >
                <span className="block w-3.5 h-3.5 rounded-sm" style={{ background: "#e2453f" }} />
              </button>
              <button onClick={handleStartPause} className="text-xs text-gray-400">
                {running ? "Pausa" : "Riprendi"}
              </button>
              <button
                onClick={handleLogRound}
                disabled={phase !== "work"}
                aria-label="Registra giro"
                className="w-12 h-12 rounded-full flex items-center justify-center text-xl font-semibold"
                style={{ background: "#d4f547", color: "#0c1210", opacity: phase === "work" ? 1 : 0.35 }}
              >
                +
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-xl text-center py-2 bg-gray-100">
                <p className="text-[10px] mb-0.5 text-gray-500">Set</p>
                <p className="text-base text-gray-900">
                  {currentSetIndex + 1}
                  <span className="text-xs text-gray-500">/{sets.length}</span>
                </p>
              </div>
              <div className="rounded-xl text-center py-2 bg-gray-100">
                <p className="text-[10px] mb-0.5 text-gray-500">Giri</p>
                <p className="text-base text-gray-900">{giri.length}</p>
              </div>
              <div className="rounded-xl text-center py-2 bg-gray-100">
                <p className="text-[10px] mb-0.5 text-gray-500">Ultimo giro</p>
                <p className="text-base text-gray-900">{ultimoGiro}</p>
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  // --- Rendering: EMOM (motore a più set, card chiara come prima) ---
  if (isEmom) {
    let mainDisplay: string;
    let caption: string;
    let progress = 0;
    let ringColor = "#84cc16";
    const currentSet = sets[Math.min(currentSetIndex, sets.length - 1)];

    if (phase === "idle") {
      mainDisplay = "▶";
      caption = `Giri: ${sets.length} · Durata: ${formatClock(totalTimerSeconds(sets))}`;
    } else if (phase === "countdown") {
      const remaining = PRESTART_SECONDS - phaseElapsed;
      mainDisplay = String(Math.max(1, remaining));
      caption = "Si parte tra...";
      progress = phaseElapsed / PRESTART_SECONDS;
      ringColor = "#f59e0b";
    } else if (phase === "work") {
      mainDisplay = formatClock(phaseElapsed);
      caption = `Giro ${currentSetIndex + 1} di ${sets.length}`;
      progress = phaseElapsed / timerSetSeconds(currentSet);
    } else {
      mainDisplay = "✓";
      caption = "Sessione completata!";
      progress = 1;
    }

    return (
      <div className="mt-2 rounded-xl border border-gray-200 bg-white p-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">
            {TIMER_LABELS[timer.type]}
          </span>
          <span className="text-xs text-gray-400">{caption}</span>
        </div>
        <div className="relative mx-auto my-2 flex items-center justify-center" style={{ width: 176, height: 176 }}>
          <CircularProgress progress={progress} color={ringColor} />
          <span className="absolute text-3xl font-bold tabular-nums text-gray-800">{mainDisplay}</span>
        </div>
        <div className="flex justify-center gap-2">
          <button onClick={handleStartPause} className={running ? "btn-secondary" : "btn-primary"} disabled={phase === "done"}>
            {running ? "Pausa" : phase === "done" ? "Completato" : phase === "idle" ? "Avvia" : "Riprendi"}
          </button>
          <button onClick={handleReset} className="btn-secondary">
            Reset
          </button>
        </div>
      </div>
    );
  }

  // --- Rendering: TABATA (motore a più set: lavoro/recupero/round veri) ---
  if (isTabata) {
    let mainDisplay: string;
    let caption: string;
    let progress = 0;
    let ringColor = "#84cc16";
    const currentSet = sets[Math.min(currentSetIndex, sets.length - 1)];

    if (phase === "idle") {
      mainDisplay = "▶";
      caption = `${sets.length} round · Durata ${formatClock(totalTimerSeconds(sets))}`;
    } else if (phase === "countdown") {
      const remaining = PRESTART_SECONDS - phaseElapsed;
      mainDisplay = String(Math.max(1, remaining));
      caption = "Si parte tra...";
      progress = phaseElapsed / PRESTART_SECONDS;
      ringColor = "#f59e0b";
    } else if (phase === "work") {
      const remaining = Math.max(0, timerSetSeconds(currentSet) - phaseElapsed);
      mainDisplay = formatClock(remaining);
      caption = `Lavoro · round ${currentSetIndex + 1} di ${sets.length}`;
      progress = phaseElapsed / timerSetSeconds(currentSet);
    } else if (phase === "rest") {
      const restTotal = timerRestSeconds(sets[currentSetIndex + 1]);
      const remaining = Math.max(0, restTotal - phaseElapsed);
      mainDisplay = formatClock(remaining);
      caption = `Recupero · prossimo round ${currentSetIndex + 2} di ${sets.length}`;
      progress = restTotal > 0 ? phaseElapsed / restTotal : 1;
      ringColor = "#0ea5e9";
    } else {
      mainDisplay = "✓";
      caption = "Sessione completata!";
      progress = 1;
    }

    return (
      <div className="mt-2 rounded-xl border border-gray-200 bg-white p-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">
            {TIMER_LABELS[timer.type]}
          </span>
          <span className="text-xs text-gray-400">{caption}</span>
        </div>
        <div className="relative mx-auto my-2 flex items-center justify-center" style={{ width: 176, height: 176 }}>
          <CircularProgress progress={progress} color={ringColor} />
          <span className="absolute text-3xl font-bold tabular-nums text-gray-800">{mainDisplay}</span>
        </div>
        <div className="flex justify-center gap-2">
          <button onClick={handleStartPause} className={running ? "btn-secondary" : "btn-primary"} disabled={phase === "done"}>
            {running ? "Pausa" : phase === "done" ? "Completato" : phase === "idle" ? "Avvia" : "Riprendi"}
          </button>
          <button onClick={handleReset} className="btn-secondary">
            Reset
          </button>
        </div>
      </div>
    );
  }

  // --- Rendering: motore classico (FOR TIME) ---
  const mainDisplay = formatClock(elapsed);
  const caption = `Obiettivo: ${formatClock(classicSeconds)}`;

  return (
    <div className="mt-2 rounded-xl border border-gray-200 bg-white p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">
          {TIMER_LABELS[timer.type]}
        </span>
        <span className="text-xs text-gray-400">{caption}</span>
      </div>
      <p className="text-center text-4xl font-bold tabular-nums my-2 text-gray-800">{mainDisplay}</p>
      <div className="flex justify-center gap-2">
        <button onClick={handleStartPause} className={running ? "btn-secondary" : "btn-primary"}>
          {running ? "Pausa" : elapsed > 0 ? "Riprendi" : "Avvia"}
        </button>
        <button onClick={handleReset} className="btn-secondary">
          Reset
        </button>
      </div>
    </div>
  );
}

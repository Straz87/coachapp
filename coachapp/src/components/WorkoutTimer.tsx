"use client";

import { useEffect, useRef, useState } from "react";
import { TimerConfig, TIMER_LABELS } from "@/lib/workoutTypes";

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

function formatClock(totalSeconds: number) {
  const clamped = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(clamped / 60);
  const s = clamped % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
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

// Conto alla rovescia prima di iniziare (EMOM e AMRAP a giri multipli).
const PRESTART_SECONDS = 10;

type Phase = "idle" | "countdown" | "work" | "rest" | "done";

export default function WorkoutTimer({
  timer,
  autoStart,
}: {
  timer: TimerConfig;
  autoStart?: boolean;
}) {
  const roundSeconds = Math.max(1, timer.minutes * 60 + timer.seconds);
  const totalRounds = Math.max(1, timer.rounds ?? 1);
  const restSeconds = Math.max(0, (timer.restMinutes ?? 0) * 60 + (timer.restSeconds ?? 0));
  const isCountUp = timer.type === "FOR_TIME";
  const isTabata = timer.type === "TABATA";
  const isEmom = timer.type === "EMOM";
  const isAmrap = timer.type === "AMRAP";

  // EMOM e AMRAP a giri multipli usano il nuovo motore a fasi (conto alla
  // rovescia iniziale, lavoro/riposo per ogni giro, stop automatico
  // all'ultimo giro). AMRAP singolo, TABATA e FOR TIME restano invariati.
  const useNewEngine = isEmom || (isAmrap && totalRounds > 1);

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

  // --- Motore "classico": AMRAP singolo, TABATA, FOR TIME ---
  const [elapsed, setElapsed] = useState(0);
  const [targetReached, setTargetReached] = useState(false);

  useEffect(() => {
    if (useNewEngine || !running) return;
    const id = setInterval(() => setElapsed((prev) => prev + 1), 1000);
    return () => clearInterval(id);
  }, [running, useNewEngine]);

  // AMRAP singolo: si ferma da sola a zero
  useEffect(() => {
    if (useNewEngine) return;
    if (timer.type === "AMRAP" && running && elapsed >= roundSeconds) {
      setRunning(false);
      playBeep(audioCtxRef.current, 660, 600);
    }
  }, [elapsed, running, timer.type, roundSeconds, useNewEngine]);

  // TABATA: beep a ogni nuovo giro
  useEffect(() => {
    if (useNewEngine) return;
    if (isTabata && running && elapsed > 0 && elapsed % roundSeconds === 0) {
      playBeep(audioCtxRef.current, 1046, 200);
    }
  }, [elapsed, isTabata, running, roundSeconds, useNewEngine]);

  // FOR TIME: beep quando si raggiunge l'obiettivo (una sola volta)
  useEffect(() => {
    if (useNewEngine) return;
    if (isCountUp && running && elapsed >= roundSeconds && !targetReached) {
      setTargetReached(true);
      playBeep(audioCtxRef.current, 660, 400);
    }
  }, [elapsed, isCountUp, running, roundSeconds, targetReached, useNewEngine]);

  // --- Nuovo motore a fasi: EMOM, AMRAP a giri multipli ---
  const [phase, setPhase] = useState<Phase>(autoStart && useNewEngine ? "countdown" : "idle");
  const [phaseElapsed, setPhaseElapsed] = useState(0);
  const [currentRound, setCurrentRound] = useState(1);

  useEffect(() => {
    if (!useNewEngine || !running) return;
    const id = setInterval(() => setPhaseElapsed((prev) => prev + 1), 1000);
    return () => clearInterval(id);
  }, [running, useNewEngine]);

  useEffect(() => {
    if (!useNewEngine || !running) return;

    if (phase === "countdown" && phaseElapsed >= PRESTART_SECONDS) {
      setPhase("work");
      setPhaseElapsed(0);
      setCurrentRound(1);
      playBeep(audioCtxRef.current, 1046, 250);
      return;
    }

    if (phase === "work" && phaseElapsed >= roundSeconds) {
      if (currentRound >= totalRounds) {
        setPhase("done");
        setRunning(false);
        playBeep(audioCtxRef.current, 660, 700);
        return;
      }
      if (isAmrap && restSeconds > 0) {
        setPhase("rest");
        setPhaseElapsed(0);
        playBeep(audioCtxRef.current, 523, 200);
      } else {
        setCurrentRound((r) => r + 1);
        setPhaseElapsed(0);
        playBeep(audioCtxRef.current, 1046, 200);
      }
      return;
    }

    if (phase === "rest" && phaseElapsed >= restSeconds) {
      setCurrentRound((r) => r + 1);
      setPhase("work");
      setPhaseElapsed(0);
      playBeep(audioCtxRef.current, 1046, 200);
    }
  }, [phase, phaseElapsed, running, useNewEngine, roundSeconds, restSeconds, totalRounds, currentRound, isAmrap]);

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
    setCurrentRound(1);
  }

  // --- Rendering: nuovo motore ---
  if (useNewEngine) {
    let mainDisplay: string;
    let caption: string;
    let progress = 0;
    let ringColor = "#84cc16";

    if (phase === "idle") {
      const totalDuration = isEmom
        ? roundSeconds * totalRounds
        : roundSeconds * totalRounds + restSeconds * Math.max(0, totalRounds - 1);
      mainDisplay = "▶";
      caption = `Giri: ${totalRounds} · Durata: ${formatClock(totalDuration)}`;
    } else if (phase === "countdown") {
      const remaining = PRESTART_SECONDS - phaseElapsed;
      mainDisplay = String(Math.max(1, remaining));
      caption = "Si parte tra...";
      progress = phaseElapsed / PRESTART_SECONDS;
      ringColor = "#f59e0b";
    } else if (phase === "work") {
      const displaySeconds = isEmom ? phaseElapsed : Math.max(0, roundSeconds - phaseElapsed);
      mainDisplay = formatClock(displaySeconds);
      caption = `Giro ${currentRound} di ${totalRounds}`;
      progress = phaseElapsed / roundSeconds;
      ringColor = "#84cc16";
    } else if (phase === "rest") {
      const remaining = Math.max(0, restSeconds - phaseElapsed);
      mainDisplay = formatClock(remaining);
      caption = `Riposo · prossimo giro ${currentRound + 1} di ${totalRounds}`;
      progress = restSeconds > 0 ? phaseElapsed / restSeconds : 1;
      ringColor = "#38bdf8";
    } else {
      mainDisplay = "✓";
      caption = "Sessione completata!";
      progress = 1;
      ringColor = "#84cc16";
    }

    return (
      <div className="mt-2 rounded-xl border border-gray-200 bg-white p-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">
            {TIMER_LABELS[timer.type]}
          </span>
          <span className="text-xs text-gray-400">{caption}</span>
        </div>
        <div
          className="relative mx-auto my-2 flex items-center justify-center"
          style={{ width: 176, height: 176 }}
        >
          <CircularProgress progress={progress} color={ringColor} />
          <span className="absolute text-3xl font-bold tabular-nums text-gray-800">
            {mainDisplay}
          </span>
        </div>
        <div className="flex justify-center gap-2">
          <button
            onClick={handleStartPause}
            className={running ? "btn-secondary" : "btn-primary"}
            disabled={phase === "done"}
          >
            {running
              ? "Pausa"
              : phase === "done"
              ? "Completato"
              : phase === "idle"
              ? "Avvia"
              : "Riprendi"}
          </button>
          <button onClick={handleReset} className="btn-secondary">
            Reset
          </button>
        </div>
      </div>
    );
  }

  // --- Rendering: motore classico ---
  let mainDisplay: string;
  let caption: string;

  if (timer.type === "AMRAP") {
    const remaining = roundSeconds - elapsed;
    mainDisplay = formatClock(remaining);
    caption = remaining <= 0 ? "Tempo scaduto!" : "Tempo rimanente";
  } else if (isCountUp) {
    mainDisplay = formatClock(elapsed);
    caption = `Obiettivo: ${formatClock(roundSeconds)}`;
  } else {
    const inRound = elapsed % roundSeconds;
    const remaining = roundSeconds - inRound;
    const currentRoundClassic = Math.floor(elapsed / roundSeconds) + 1;
    mainDisplay = formatClock(remaining);
    caption = `Giro ${currentRoundClassic}`;
  }

  return (
    <div className="mt-2 rounded-xl border border-gray-200 bg-white p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">
          {TIMER_LABELS[timer.type]}
        </span>
        <span className="text-xs text-gray-400">{caption}</span>
      </div>
      <p className="text-center text-4xl font-bold tabular-nums my-2 text-gray-800">
        {mainDisplay}
      </p>
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

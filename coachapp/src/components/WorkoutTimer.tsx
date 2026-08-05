"use client";

import { useEffect, useRef, useState } from "react";
import { TimerConfig, TIMER_LABELS } from "@/lib/workoutTypes";

function playBeep(frequency = 880, duration = 150) {
  if (typeof window === "undefined") return;
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration / 1000);
    osc.onended = () => ctx.close();
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

export default function WorkoutTimer({
  timer,
  autoStart,
}: {
  timer: TimerConfig;
  autoStart?: boolean;
}) {
  const roundSeconds = Math.max(1, timer.minutes * 60 + timer.seconds);
  const isCountUp = timer.type === "FOR_TIME";
  const isInterval = timer.type === "EMOM" || timer.type === "TABATA";

  const [running, setRunning] = useState(!!autoStart);
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const targetReachedRef = useRef(false);

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setElapsed((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [running]);

  // AMRAP: si ferma da sola a zero
  useEffect(() => {
    if (timer.type === "AMRAP" && running && elapsed >= roundSeconds) {
      setRunning(false);
      playBeep(660, 600);
    }
  }, [elapsed, running, timer.type, roundSeconds]);

  // EMOM / TABATA: beep a ogni nuovo giro
  useEffect(() => {
    if (isInterval && running && elapsed > 0 && elapsed % roundSeconds === 0) {
      playBeep(1046, 200);
    }
  }, [elapsed, isInterval, running, roundSeconds]);

  // FOR TIME: beep quando si raggiunge l'obiettivo (una sola volta)
  useEffect(() => {
    if (isCountUp && running && elapsed >= roundSeconds && !targetReachedRef.current) {
      targetReachedRef.current = true;
      playBeep(660, 400);
    }
  }, [elapsed, isCountUp, running, roundSeconds]);

  function handleStartPause() {
    setRunning((r) => !r);
  }

  function handleReset() {
    setRunning(false);
    setElapsed(0);
    targetReachedRef.current = false;
  }

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
    const currentRound = Math.floor(elapsed / roundSeconds) + 1;
    mainDisplay = formatClock(remaining);
    caption = `Giro ${currentRound}`;
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

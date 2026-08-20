// AudioContext condiviso da tutti i timer della pagina.
//
// I browser mobili (soprattutto Safari/iOS) permettono di creare o
// riattivare un AudioContext solo dentro un gesture reale (tap/click).
// Se ogni WorkoutTimer creasse il proprio AudioContext indipendente, un
// timer avviato in automatico (autoStart, es. dal tasto "Inizia" che apre
// e fa partire subito il timer) creerebbe il suo contesto FUORI da un tap
// reale e resterebbe sempre "suspended": niente beep, anche se il tap che
// ha aperto il timer era un gesture reale.
//
// La soluzione e' condividere UN SOLO AudioContext per tutta la pagina:
// basta sbloccarlo una volta sola, dentro un qualsiasi tap reale (anche
// solo il tasto "Inizia"), e riusarlo per tutti i timer successivi.
let sharedCtx: AudioContext | null = null;

export function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!sharedCtx) {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return null;
    sharedCtx = new AudioCtx();
  }
  return sharedCtx;
}

// Da chiamare dentro un handler di click/tap reale, prima di avviare un
// timer in automatico, per sbloccare l'audio su iOS Safari.
export function unlockAudioContext() {
  try {
    const ctx = getAudioContext();
    if (ctx && ctx.state === "suspended") {
      ctx.resume();
    }
  } catch {
    // audio non disponibile, ignora
  }
}

export function playBeep(frequency = 880, duration = 150, volume = 0.25) {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration / 1000);
  } catch {
    // audio non disponibile, ignora
  }
}

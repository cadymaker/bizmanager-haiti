'use client';

// Jenere yon ti son "beep" san okenn fichye odyo.
// Nou sèvi ak Web Audio API — li mache offline epi li rapid.

let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    if (!audioCtx) {
      const Ctor = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!Ctor) return null;
      audioCtx = new Ctor();
    }
    // Sou mobil, kontèks la ka "suspended" jiskaske itilizatè a touche ekran an
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  } catch {
    return null;
  }
}

function tone(freq: number, durationMs: number, volume = 0.15) {
  const ctx = getCtx();
  if (!ctx) return;
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = freq;
    gain.gain.value = volume;
    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;
    osc.start(now);
    // Ti fondi pou evite yon "klik" nan fen an
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + durationMs / 1000);
    osc.stop(now + durationMs / 1000);
  } catch {
    /* inyore — son pa esansyèl */
  }
}

// Eskan reyisi: yon ti beep klè (tankou nan sipèmakè)
export function beepSuccess() {
  tone(1800, 90);
}

// Erè: de ti son pi ba
export function beepError() {
  tone(400, 120);
  setTimeout(() => tone(300, 160), 130);
}
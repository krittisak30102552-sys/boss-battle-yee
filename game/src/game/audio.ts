// Tiny WebAudio synth – no audio files needed.
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let lastHit = 0;
let lastClank = 0;

export function initAudio() {
  try {
    if (!ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.32;
      master.connect(ctx.destination);
    }
    if (ctx.state === "suspended") void ctx.resume();
  } catch {
    /* audio unsupported */
  }
}

function tone(f0: number, f1: number, dur: number, type: OscillatorType, vol: number, delay = 0) {
  if (!ctx || !master) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g);
  g.connect(master);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise(dur: number, vol: number, cutoff: number, delay = 0) {
  if (!ctx || !master) return;
  const t = ctx.currentTime + delay;
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = "lowpass";
  f.frequency.value = cutoff;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f);
  f.connect(g);
  g.connect(master);
  src.start(t);
}

export const sfx = {
  shoot() {
    tone(1400, 380, 0.12, "sawtooth", 0.12);
  },
  slash() {
    noise(0.22, 0.35, 5000);
    tone(900, 200, 0.2, "triangle", 0.1);
  },
  hit() {
    const n = performance.now();
    if (n - lastHit < 60) return;
    lastHit = n;
    tone(220, 90, 0.1, "square", 0.1);
    noise(0.08, 0.18, 3000);
  },
  boom() {
    noise(0.7, 0.7, 700);
    tone(110, 30, 0.6, "sine", 0.5);
  },
  morph() {
    for (let i = 0; i < 6; i++) tone(300 + i * 140, 500 + i * 220, 0.18, "sine", 0.06, i * 0.07);
    noise(0.5, 0.12, 2500);
  },
  hurt() {
    tone(160, 60, 0.25, "sawtooth", 0.2);
    noise(0.15, 0.3, 1500);
  },
  block() {
    tone(1200, 800, 0.15, "square", 0.1);
    noise(0.1, 0.2, 6000);
  },
  parry() {
    tone(1800, 2600, 0.25, "triangle", 0.2);
    tone(900, 1300, 0.3, "sine", 0.2, 0.05);
  },
  roar() {
    tone(90, 40, 1.4, "sawtooth", 0.35);
    tone(130, 50, 1.2, "square", 0.15);
    noise(1.2, 0.35, 900);
  },
  charge() {
    tone(200, 900, 0.9, "sine", 0.08);
  },
  heal() {
    tone(500, 1200, 0.5, "sine", 0.12);
    tone(700, 1500, 0.5, "sine", 0.08, 0.1);
  },
  dash() {
    noise(0.25, 0.3, 4000);
  },
  warn() {
    tone(500, 500, 0.08, "square", 0.06);
  },
  /** Metallic plate movement during the non-combat suit assembly animation. */
  clank() {
    const n = performance.now();
    if (n - lastClank < 55) return;
    lastClank = n;
    noise(0.06, 0.16, 5200);
    tone(340 + Math.random() * 120, 120, 0.07, "square", 0.05);
  },
  suitUnlock() {
    tone(180, 900, 0.5, "sine", 0.1);
    tone(90, 400, 0.4, "sawtooth", 0.04);
    noise(0.35, 0.1, 2600);
  },
  whoosh() {
    noise(0.7, 0.2, 1400);
    tone(140, 420, 0.6, "sine", 0.05);
  },
  suitLock() {
    tone(900, 1500, 0.18, "triangle", 0.12);
    tone(300, 120, 0.25, "square", 0.08);
    noise(0.12, 0.2, 4000);
  },
};

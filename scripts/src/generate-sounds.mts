import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "../../artifacts/wordle-war/public/sounds");

const SAMPLE_RATE = 44100;
const MAX_INT16 = 32767;

// ── WAV writer ───────────────────────────────────────────────────────────────

function writeWav(filename: string, samples: Float32Array) {
  const dataLen = samples.length * 2;
  const buf = Buffer.alloc(44 + dataLen);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + dataLen, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);               // PCM
  buf.writeUInt16LE(1, 22);               // Mono
  buf.writeUInt32LE(SAMPLE_RATE, 24);
  buf.writeUInt32LE(SAMPLE_RATE * 2, 28); // ByteRate
  buf.writeUInt16LE(2, 32);               // BlockAlign
  buf.writeUInt16LE(16, 34);              // BitsPerSample
  buf.write("data", 36);
  buf.writeUInt32LE(dataLen, 40);
  for (let i = 0; i < samples.length; i++) {
    const v = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE(Math.round(v * MAX_INT16), 44 + i * 2);
  }
  writeFileSync(join(OUT_DIR, filename), buf);
  console.log(`  ✓ ${filename}`);
}

// ── Synthesis helpers ────────────────────────────────────────────────────────

type WaveType = "sine" | "square" | "sawtooth" | "triangle";

interface Note {
  freq: number;
  freqEnd?: number;
  type?: WaveType;
  duration: number;  // seconds
  gain: number;
  delay?: number;    // seconds offset
  attack?: number;   // fraction of duration
}

function wave(type: WaveType, phase: number): number {
  const p = phase % (2 * Math.PI);
  switch (type) {
    case "sine":     return Math.sin(p);
    case "square":   return Math.sign(Math.sin(p));
    case "sawtooth": return 2 * ((phase / (2 * Math.PI)) % 1) - 1;
    case "triangle": {
      const t = (phase / (2 * Math.PI)) % 1;
      return t < 0.5 ? 4 * t - 1 : 3 - 4 * t;
    }
  }
}

function synthesize(notes: Note[]): Float32Array {
  const totalSecs = Math.max(...notes.map((n) => (n.delay ?? 0) + n.duration + 0.02));
  const totalSamples = Math.ceil(totalSecs * SAMPLE_RATE);
  const buf = new Float32Array(totalSamples);

  for (const note of notes) {
    const startSample = Math.floor((note.delay ?? 0) * SAMPLE_RATE);
    const noteSamples = Math.ceil(note.duration * SAMPLE_RATE);
    const attackFrac = note.attack ?? 0.03;
    const attackSamples = Math.ceil(attackFrac * noteSamples);
    const type = note.type ?? "sine";

    for (let i = 0; i < noteSamples; i++) {
      const t = i / SAMPLE_RATE;
      const frac = i / noteSamples;
      const freqNow = note.freqEnd
        ? note.freq + (note.freqEnd - note.freq) * frac
        : note.freq;
      const phase = 2 * Math.PI * freqNow * t;
      const env = i < attackSamples
        ? i / attackSamples
        : 1 - (i - attackSamples) / (noteSamples - attackSamples);
      const s = startSample + i;
      if (s < totalSamples) {
        buf[s] += wave(type, phase) * note.gain * Math.max(0, env);
      }
    }
  }

  // Normalize if peak > 1
  let peak = 0;
  for (let i = 0; i < buf.length; i++) if (Math.abs(buf[i]) > peak) peak = Math.abs(buf[i]);
  if (peak > 1) for (let i = 0; i < buf.length; i++) buf[i] /= peak;

  return buf;
}

// ── Sound definitions ────────────────────────────────────────────────────────

mkdirSync(OUT_DIR, { recursive: true });
console.log("Generating WAV sound effects...");

// 1. Key press — short bright click
writeWav("key-press.wav", synthesize([
  { freq: 900, type: "square", duration: 0.05, gain: 0.25 },
  { freq: 1200, type: "sine", duration: 0.03, gain: 0.15 },
]));

// 2. Backspace — soft thud
writeWav("backspace.wav", synthesize([
  { freq: 340, type: "sine", duration: 0.07, gain: 0.35 },
]));

// 3. Invalid word — buzzy error
writeWav("invalid.wav", synthesize([
  { freq: 160, type: "sawtooth", freqEnd: 90, duration: 0.22, gain: 0.5, attack: 0.02 },
  { freq: 120, type: "sine", duration: 0.2, gain: 0.25, delay: 0.02 },
]));

// 4-6. Tile reveal sounds
writeWav("tile-absent.wav", synthesize([
  { freq: 220, type: "sine", duration: 0.14, gain: 0.3, attack: 0.05 },
]));

writeWav("tile-present.wav", synthesize([
  { freq: 550, type: "sine", duration: 0.16, gain: 0.35, attack: 0.05 },
  { freq: 550, type: "triangle", duration: 0.12, gain: 0.1, delay: 0.01 },
]));

writeWav("tile-correct.wav", synthesize([
  { freq: 880, type: "sine", duration: 0.18, gain: 0.4, attack: 0.04 },
  { freq: 1320, type: "sine", duration: 0.1, gain: 0.15, delay: 0.04 },
]));

// 7. Round start — 2-note ascending
writeWav("round-start.wav", synthesize([
  { freq: 440, type: "sine", duration: 0.18, gain: 0.45, attack: 0.04 },
  { freq: 660, type: "sine", duration: 0.22, gain: 0.5, attack: 0.04, delay: 0.19 },
]));

// 8. Round win — 4-note ascending arpeggio
writeWav("round-win.wav", synthesize([
  { freq: 523, type: "sine", duration: 0.22, gain: 0.5, delay: 0.00 },
  { freq: 659, type: "sine", duration: 0.22, gain: 0.5, delay: 0.12 },
  { freq: 784, type: "sine", duration: 0.22, gain: 0.5, delay: 0.24 },
  { freq: 1047, type: "sine", duration: 0.28, gain: 0.55, delay: 0.36, attack: 0.05 },
]));

// 9. Round lose — descending sad
writeWav("round-lose.wav", synthesize([
  { freq: 440, type: "sine", duration: 0.28, gain: 0.45, delay: 0.00 },
  { freq: 370, type: "sine", duration: 0.28, gain: 0.45, delay: 0.15 },
  { freq: 294, type: "sine", duration: 0.32, gain: 0.45, delay: 0.30 },
]));

// 10. Word reveal — gentle chime
writeWav("word-reveal.wav", synthesize([
  { freq: 660, type: "sine", duration: 0.22, gain: 0.4, attack: 0.04 },
  { freq: 880, type: "sine", duration: 0.2, gain: 0.35, attack: 0.04, delay: 0.14 },
  { freq: 1100, type: "sine", duration: 0.18, gain: 0.25, delay: 0.26 },
]));

// 11. Game win — triumphant 5-note fanfare
writeWav("game-win.wav", synthesize([
  { freq: 523, type: "sine", duration: 0.26, gain: 0.55, delay: 0.00 },
  { freq: 659, type: "sine", duration: 0.26, gain: 0.55, delay: 0.12 },
  { freq: 784, type: "sine", duration: 0.26, gain: 0.55, delay: 0.24 },
  { freq: 659, type: "sine", duration: 0.18, gain: 0.45, delay: 0.36 },
  { freq: 1047, type: "sine", duration: 0.38, gain: 0.6, delay: 0.48, attack: 0.06 },
  // Harmony
  { freq: 784, type: "sine", duration: 0.38, gain: 0.3, delay: 0.48 },
]));

// 12. Game lose — mournful descend
writeWav("game-lose.wav", synthesize([
  { freq: 440, type: "sine", duration: 0.32, gain: 0.45, delay: 0.00 },
  { freq: 415, type: "sine", duration: 0.32, gain: 0.45, delay: 0.18 },
  { freq: 370, type: "sine", duration: 0.32, gain: 0.45, delay: 0.36 },
  { freq: 311, type: "sine", duration: 0.42, gain: 0.45, delay: 0.54, attack: 0.06 },
]));

// 13. Emoji — fun double pop
writeWav("emoji.wav", synthesize([
  { freq: 700, type: "sine", duration: 0.09, gain: 0.4, attack: 0.02 },
  { freq: 900, type: "sine", duration: 0.08, gain: 0.35, delay: 0.08 },
]));

// 14. Countdown beep — short tick
writeWav("countdown.wav", synthesize([
  { freq: 880, type: "square", duration: 0.08, gain: 0.2, attack: 0.01 },
]));

// 15. Player joined — notification
writeWav("player-joined.wav", synthesize([
  { freq: 480, type: "sine", duration: 0.16, gain: 0.4, attack: 0.04, delay: 0.00 },
  { freq: 640, type: "sine", duration: 0.2, gain: 0.45, attack: 0.04, delay: 0.16 },
]));

console.log("\nDone! All sounds written to artifacts/wordle-war/public/sounds/");

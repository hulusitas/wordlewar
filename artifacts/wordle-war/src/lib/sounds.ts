// All sounds are pre-generated WAV files stored in /public/sounds/

let _muted = true;
export function setSoundMuted(val: boolean) { _muted = val; }

const BASE = import.meta.env.BASE_URL as string;

function url(name: string) {
  return `${BASE}sounds/${name}`;
}

// Preload pool — one element per sound, cloned on play for overlapping support
const _pool: Record<string, HTMLAudioElement> = {};

function preload(name: string): HTMLAudioElement {
  const a = new Audio(url(name));
  a.preload = "auto";
  _pool[name] = a;
  return a;
}

// Initialise pool immediately so browsers start caching
preload("key-press.wav");
preload("backspace.wav");
preload("invalid.wav");
preload("tile-absent.wav");
preload("tile-present.wav");
preload("tile-correct.wav");
preload("round-start.wav");
preload("round-win.wav");
preload("round-lose.wav");
preload("word-reveal.wav");
preload("game-win.wav");
preload("game-lose.wav");
preload("emoji.wav");
preload("countdown.wav");
preload("player-joined.wav");

function play(name: string, delay = 0) {
  if (_muted) return;
  const src = _pool[name];
  if (!src) return;
  const fire = () => {
    const clone = src.cloneNode() as HTMLAudioElement;
    clone.play().catch(() => { /* autoplay blocked — ignore */ });
  };
  if (delay > 0) setTimeout(fire, delay * 1000);
  else fire();
}

// ── Public API ────────────────────────────────────────────────────────────────

export function playKeyPress()    { play("key-press.wav"); }
export function playBackspace()   { play("backspace.wav"); }
export function playInvalidWord() { play("invalid.wav"); }

export function playTileReveal(result: "correct" | "present" | "absent", delay = 0) {
  play(`tile-${result}.wav`, delay);
}

export function playRoundStart()    { play("round-start.wav"); }
export function playWinRound()      { play("round-win.wav"); }
export function playLoseRound()     { play("round-lose.wav"); }
export function playWordReveal()    { play("word-reveal.wav"); }
export function playGameWin()       { play("game-win.wav"); }
export function playGameLose()      { play("game-lose.wav"); }
export function playEmoji()         { play("emoji.wav"); }
export function playCountdownBeep() { play("countdown.wav"); }
export function playPlayerJoined()  { play("player-joined.wav"); }

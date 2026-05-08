import React, { useState, useEffect, useRef, useCallback } from "react";
import socket from "./lib/socket";
import { Room, Player, Settings } from "./types";
import {
  playKeyPress, playBackspace, playInvalidWord, playTileReveal,
  playRoundStart, playWinRound, playLoseRound, playWordReveal,
  playGameWin, playGameLose, playEmoji, playCountdownBeep, playPlayerJoined,
  setSoundMuted,
} from "./lib/sounds";
import {
  Trophy, Users, Send, Settings as SettingsIcon,
  LogOut, Copy, RefreshCw, Volume2, VolumeX, Swords, Clock,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";

// ─── Word Reveal Toast ────────────────────────────────────────────────────────

const WordRevealToast = ({ word }: { word: string }) => (
  <motion.div
    initial={{ opacity: 0, y: 60, x: "-50%" }}
    animate={{ opacity: 1, y: 0, x: "-50%" }}
    exit={{ opacity: 0, y: 60, x: "-50%" }}
    transition={{ type: "spring", damping: 22, stiffness: 260 }}
    className="fixed bottom-8 left-1/2 z-[90] flex flex-col items-center gap-1 bg-slate-950/95 backdrop-blur-xl border border-white/15 rounded-2xl px-10 py-4 shadow-2xl"
  >
    <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em]">Kelime</p>
    <p className="text-3xl font-black tracking-[0.35em] text-white">{word}</p>
  </motion.div>
);

// ─── Emoji Bar ───────────────────────────────────────────────────────────────

const EMOJIS = ["😂", "😭", "😡", "🤯", "👍", "🔥", "💀", "😤"];

interface FloatingEmoji { id: number; emoji: string; fromMe: boolean }

const EmojiBar = ({
  onSend, disabled,
}: { onSend: (emoji: string) => void; disabled?: boolean }) => (
  <div className="flex justify-center gap-1.5 flex-wrap px-2">
    {EMOJIS.map((e) => (
      <button
        key={e}
        disabled={disabled}
        onPointerDown={(ev) => { ev.preventDefault(); onSend(e); }}
        className="w-10 h-10 text-xl rounded-xl bg-slate-900/60 border border-white/10 active:scale-90 transition-transform touch-manipulation disabled:opacity-30 flex items-center justify-center"
      >
        {e}
      </button>
    ))}
  </div>
);

const FloatingEmojiLayer = ({ items }: { items: FloatingEmoji[] }) => (
  <div className="pointer-events-none fixed inset-0 z-[80] overflow-hidden">
    <AnimatePresence>
      {items.map((item) => (
        <motion.div
          key={item.id}
          initial={{ opacity: 1, y: 0, scale: 0.7, x: item.fromMe ? "70vw" : "20vw" }}
          animate={{ opacity: 0, y: -180, scale: 1.4 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.6, ease: "easeOut" }}
          className="absolute bottom-32 text-5xl select-none"
        >
          {item.emoji}
        </motion.div>
      ))}
    </AnimatePresence>
  </div>
);

// ─── Keyboard ───────────────────────────────────────────────────────────────

const Keyboard = ({
  onKey,
  results,
}: {
  onKey: (key: string) => void;
  results: Record<string, string>;
}) => {
  const rows = [
    ["E", "R", "T", "Y", "U", "I", "O", "P", "Ğ", "Ü"],
    ["A", "S", "D", "F", "G", "H", "J", "K", "L", "Ş", "İ"],
    ["Z", "C", "V", "B", "N", "M", "Ö", "Ç"],
  ];
  const cls = (key: string) => {
    const s = results[key];
    if (s === "correct") return "bg-green-700 text-white border-green-900";
    if (s === "present") return "bg-yellow-600 text-white border-yellow-800";
    if (s === "absent") return "bg-slate-900 text-slate-500 border-slate-900";
    return "bg-slate-800 text-slate-200 border-slate-900 active:bg-slate-700";
  };
  return (
    <div className="flex flex-col gap-1.5 w-full max-w-md mx-auto px-1 pb-safe">
      {rows.map((row, i) => (
        <div key={i} className="flex justify-center gap-1">
          {i === 2 && (
            <button
              onPointerDown={(e) => { e.preventDefault(); onKey("ENTER"); }}
              className="flex-none w-14 py-4 rounded-lg bg-slate-700 text-white font-black text-[10px] border-b-2 border-slate-950 active:translate-y-0.5 active:border-b-0 uppercase transition-all flex items-center justify-center shadow touch-manipulation"
            >
              GİR
            </button>
          )}
          {row.map((key) => (
            <button
              key={key}
              onPointerDown={(e) => { e.preventDefault(); onKey(key); }}
              className={`flex-1 min-w-0 py-4 rounded-lg text-xs font-black uppercase border-b-2 transition-all active:translate-y-0.5 active:border-b-0 flex items-center justify-center shadow touch-manipulation ${cls(key)}`}
            >
              {key}
            </button>
          ))}
          {i === 2 && (
            <button
              onPointerDown={(e) => { e.preventDefault(); onKey("BACKSPACE"); }}
              className="flex-none w-14 py-4 rounded-lg bg-slate-700 text-white font-black text-[10px] border-b-2 border-slate-950 active:translate-y-0.5 active:border-b-0 uppercase transition-all flex items-center justify-center shadow touch-manipulation"
            >
              SİL
            </button>
          )}
        </div>
      ))}
    </div>
  );
};

// ─── Board ───────────────────────────────────────────────────────────────────

const Board = ({
  grid, results, length, attempts, currentGuess, isActive,
}: {
  grid: string[][];
  results: string[][];
  length: number;
  attempts: number;
  currentGuess?: string;
  isActive?: boolean;
}) => (
  <div className="grid gap-1.5 w-full">
    {Array.from({ length: attempts }).map((_, i) => {
      const isCurrent = isActive && i === grid.length;
      const rowLetters = isCurrent
        ? (currentGuess || "").padEnd(length, " ").split("")
        : grid[i]?.map((l) => l) || Array(length).fill("");
      return (
        <div key={i} className="flex gap-1.5 justify-center">
          {Array.from({ length }).map((_, j) => {
            const letter = rowLetters[j] === " " ? "" : rowLetters[j] || "";
            const status = results[i]?.[j];
            let cls = "border-slate-700 bg-transparent text-slate-400";
            if (status === "correct") cls = "border-green-600 bg-green-900/50 text-white";
            else if (status === "present") cls = "border-yellow-500 bg-yellow-900/50 text-white";
            else if (status === "absent") cls = "border-slate-700 bg-slate-800/60 text-slate-500";
            else if (letter) cls = "border-blue-500 bg-blue-900/20 text-white";
            return (
              <motion.div
                key={j}
                animate={
                  status ? { rotateX: [0, 90, 0], scale: [1, 0.9, 1] }
                  : letter && isCurrent ? { scale: [1, 1.08, 1] }
                  : {}
                }
                transition={{ duration: 0.3, delay: status ? j * 0.07 : 0 }}
                className={`flex-1 aspect-square max-w-[52px] min-w-[26px] border-2 flex items-center justify-center text-base sm:text-lg font-black uppercase rounded transition-colors ${cls}`}
              >
                {letter}
              </motion.div>
            );
          })}
        </div>
      );
    })}
  </div>
);

// ─── Scoreboard pill ─────────────────────────────────────────────────────────

const ScorePill = ({ room, myId }: { room: Room; myId: string }) => {
  const me = room.players.find((p) => p.id === myId);
  const opp = room.players.find((p) => p.id !== myId);
  if (!me || !opp) return null;
  return (
    <div className="flex items-center gap-2 bg-slate-900/80 border border-white/10 px-4 py-1.5 rounded-full text-xs font-black font-mono">
      <span className="text-blue-400">{me.score}</span>
      <span className="text-slate-600">—</span>
      <span className="text-red-400">{opp.score}</span>
      <span className="text-slate-500 text-[10px] font-bold ml-1">
        R{room.currentRound}/{room.settings.totalRounds}
      </span>
    </div>
  );
};

// ─── Timer hook ──────────────────────────────────────────────────────────────

function useCountdown(startTime: number | null, limitSecs: number) {
  const [remaining, setRemaining] = useState(limitSecs);
  useEffect(() => {
    if (!startTime || limitSecs === 0) { setRemaining(limitSecs); return; }
    const tick = () => {
      const elapsed = (Date.now() - startTime) / 1000;
      setRemaining(Math.max(0, limitSecs - elapsed));
    };
    tick();
    const id = setInterval(tick, 200);
    return () => clearInterval(id);
  }, [startTime, limitSecs]);
  return remaining;
}

// ─── App ─────────────────────────────────────────────────────────────────────

function getReconnectInfo(): { roomId: string; name: string } | null {
  try {
    const raw = localStorage.getItem("wordleReconnect");
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

export default function App() {
  const [screen, setScreen] = useState<"name" | "lobby" | "game" | "round-end" | "results">("name");
  const [room, setRoom] = useState<Room | null>(null);
  const [name, setName] = useState(localStorage.getItem("playerName") || "");
  const [roomCodeInput, setRoomCodeInput] = useState("");
  const [currentGuess, setCurrentGuess] = useState("");
  const [message, setMessage] = useState("");
  const [mute, setMute] = useState(true);
  const [roundWinnerId, setRoundWinnerId] = useState<string | null>(null);
  const [rematchPending, setRematchPending] = useState(false);
  const [opponentWantsRematch, setOpponentWantsRematch] = useState(false);
  const [roundStartTime, setRoundStartTime] = useState<number | null>(null);
  const [hostReconnectDeadline, setHostReconnectDeadline] = useState<number | null>(null);
  const [reconnectSecsLeft, setReconnectSecsLeft] = useState(0);
  const [savedReconnect, setSavedReconnect] = useState<{ roomId: string; name: string } | null>(getReconnectInfo);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [stats, setStats] = useState<{ won: number; lost: number }>(
    JSON.parse(localStorage.getItem("wordleStats") || '{"won":0,"lost":0}')
  );
  const [floatingEmojis, setFloatingEmojis] = useState<FloatingEmoji[]>([]);
  const [emojiCooldown, setEmojiCooldown] = useState(false);
  const [revealWord, setRevealWord] = useState<string | null>(null);
  const msgTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const roomRef = useRef<Room | null>(null);
  const nameRef = useRef<string>(localStorage.getItem("playerName") || "");
  const emojiCounter = useRef(0);

  useEffect(() => { roomRef.current = room; }, [room]);
  useEffect(() => { nameRef.current = name; }, [name]);

  const me = room?.players.find((p) => p.id === socket.id);
  const opponent = room?.players.find((p) => p.id !== socket.id);
  const timeLimit = room?.settings.timeLimit ?? 0;
  const timeLeft = useCountdown(roundStartTime, timeLimit);

  const prevBeepSec = useRef(-1);
  useEffect(() => {
    if (screen !== "game" || timeLimit === 0) return;
    const sec = Math.ceil(timeLeft);
    if (sec <= 3 && sec > 0 && sec !== prevBeepSec.current) {
      prevBeepSec.current = sec;
      playCountdownBeep();
    }
  }, [timeLeft, screen, timeLimit]);

  const showMessage = useCallback((msg: string, ms = 2200) => {
    setMessage(msg);
    if (msgTimer.current) clearTimeout(msgTimer.current);
    msgTimer.current = setTimeout(() => setMessage(""), ms);
  }, []);

  useEffect(() => {
    if (!hostReconnectDeadline) return;
    const id = setInterval(() => {
      const left = Math.ceil((hostReconnectDeadline - Date.now()) / 1000);
      setReconnectSecsLeft(Math.max(0, left));
    }, 500);
    return () => clearInterval(id);
  }, [hostReconnectDeadline]);

  useEffect(() => {
    // ── Socket.IO connection lifecycle ───────────────────────────────────────
    const handleConnect = () => {
      const r = roomRef.current;
      const n = nameRef.current;
      if (r && n) {
        // Auto-rejoin after reconnect
        socket.emit("rejoin-room", { roomId: r.id, name: n });
      }
      setIsReconnecting(false);
    };
    const handleDisconnect = () => {
      if (roomRef.current) setIsReconnecting(true);
    };
    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);

    // ── Game events ──────────────────────────────────────────────────────────
    socket.on("room-created", (r: Room) => {
      const info = { roomId: r.id, name: r.players[0]?.name || "" };
      localStorage.setItem("wordleReconnect", JSON.stringify(info));
      setSavedReconnect(info);
      setRoom(r);
      setScreen("lobby");
    });
    socket.on("player-joined", (r: Room) => {
      // Save reconnect info for the non-host too
      const myPlayer = r.players.find((p) => p.id === socket.id);
      if (myPlayer && !myPlayer.isHost) {
        const info = { roomId: r.id, name: myPlayer.name };
        localStorage.setItem("wordleReconnect", JSON.stringify(info));
        setSavedReconnect(info);
      }
      playPlayerJoined();
      setRoom(r);
      setScreen("lobby");
    });
    socket.on("player-ready", ({ playerId, ready }: { playerId: string; ready: boolean }) => {
      setRoom((prev) => prev ? { ...prev, players: prev.players.map((p) => p.id === playerId ? { ...p, ready } : p) } : null);
    });
    socket.on("settings-updated", (settings: Settings) => {
      setRoom((prev) => prev ? { ...prev, settings } : null);
    });
    socket.on("round-started", ({ room: r }: { room: Room; roundStartTime: number; timeLimit: number }) => {
      setRoom(r);
      setRoundStartTime(Date.now());
      setScreen("game");
      setCurrentGuess("");
      setHostReconnectDeadline(null);
      playRoundStart();
      const isFirst = r.currentRound === 1;
      showMessage(isFirst ? "⚔️ Savaş Başladı!" : `⚔️ Raunt ${r.currentRound}/${r.settings.totalRounds}`, 2000);
    });
    socket.on("guess-processed", ({ playerId, player }: { playerId: string; player: Player }) => {
      setRoom((prev) => prev ? { ...prev, players: prev.players.map((p) => p.id === playerId ? player : p) } : null);
      if (playerId === socket.id) {
        const lastResult = player.results[player.results.length - 1];
        if (lastResult) lastResult.forEach((r, i) => playTileReveal(r, i * 0.28));
      }
    });
    socket.on("round-over", ({ room: r, winnerId }: { room: Room; winnerId: string | null }) => {
      setRoom(r);
      setRoundWinnerId(winnerId);
      if (winnerId === socket.id) playWinRound();
      else if (winnerId) playLoseRound();
      if (r.secretWord) {
        playWordReveal();
        setRevealWord(r.secretWord);
        setTimeout(() => setRevealWord(null), 4000);
      }
      setScreen("round-end");
    });
    socket.on("game-over", ({ room: r, winnerId }: { room: Room; winnerId: string | null }) => {
      setRoom(r);
      setRoundWinnerId(winnerId);
      const myFinalWin = r.players.find((p) => p.id === socket.id);
      const oppFinal = r.players.find((p) => p.id !== socket.id);
      if (myFinalWin && oppFinal) {
        if (myFinalWin.score > oppFinal.score) {
          confetti({ particleCount: 160, spread: 70, origin: { y: 0.6 } });
          playGameWin();
          setStats((prev) => { const n = { ...prev, won: prev.won + 1 }; localStorage.setItem("wordleStats", JSON.stringify(n)); return n; });
        } else if (myFinalWin.score < oppFinal.score) {
          playGameLose();
          setStats((prev) => { const n = { ...prev, lost: prev.lost + 1 }; localStorage.setItem("wordleStats", JSON.stringify(n)); return n; });
        }
      }
      localStorage.removeItem("wordleReconnect");
      setSavedReconnect(null);
      if (r.secretWord) {
        playWordReveal();
        setRevealWord(r.secretWord);
        setTimeout(() => { setRevealWord(null); setScreen("results"); }, 4000);
      } else {
        setTimeout(() => setScreen("results"), 1400);
      }
    });
    socket.on("player-left", ({ room: r }: { playerId: string; room: Room }) => {
      setRoom(r);
      showMessage("Rakip ayrıldı.", 3000);
    });
    socket.on("player-reconnecting", ({ playerName, deadline }: { playerName: string; deadline: number }) => {
      setHostReconnectDeadline(deadline);
      setReconnectSecsLeft(Math.ceil((deadline - Date.now()) / 1000));
      showMessage(`${playerName} bağlantısı kesildi, geri dönebilir...`, 3000);
    });
    socket.on("player-reconnected", (r: Room) => {
      setRoom(r);
      setHostReconnectDeadline(null);
      showMessage("Rakip geri döndü!", 2000);
    });
    socket.on("room-disbanded", ({ reason }: { reason: string }) => {
      setRoom(null);
      setIsReconnecting(false);
      setScreen("name");
      setRematchPending(false);
      setOpponentWantsRematch(false);
      setHostReconnectDeadline(null);
      localStorage.removeItem("wordleReconnect");
      setSavedReconnect(null);
      showMessage(reason, 3500);
    });
    socket.on("host-reconnecting", ({ deadline }: { deadline: number }) => {
      setHostReconnectDeadline(deadline);
      setReconnectSecsLeft(Math.ceil((deadline - Date.now()) / 1000));
    });
    socket.on("host-reconnected", (r: Room) => {
      setRoom(r);
      setHostReconnectDeadline(null);
      showMessage("Oda kurucusu geri döndü!", 2000);
    });
    socket.on("room-rejoined", ({ room: r, roundStartTime }: { room: Room; roundStartTime: number | null }) => {
      setRoom(r);
      setHostReconnectDeadline(null);
      setIsReconnecting(false);
      if (roundStartTime) setRoundStartTime(roundStartTime);
      localStorage.removeItem("wordleReconnect");
      setSavedReconnect(null);
      const s = r.status;
      if (s === "playing") setScreen("game");
      else if (s === "round-end") setScreen("round-end");
      else if (s === "results") setScreen("results");
      else setScreen("lobby");
      showMessage("Odaya geri döndün!", 2000);
    });
    socket.on("rejoin-failed", (reason: string) => {
      setIsReconnecting(false);
      setRoom(null);
      localStorage.removeItem("wordleReconnect");
      setSavedReconnect(null);
      setScreen("name");
      showMessage(reason, 3500);
    });
    socket.on("rematch-requested", ({ playerId }: { playerId: string }) => {
      if (playerId !== socket.id) setOpponentWantsRematch(true);
    });
    socket.on("rematch-accepted", (r: Room) => {
      setRoom(r);
      setRematchPending(false);
      setOpponentWantsRematch(false);
      setScreen("lobby");
    });
    socket.on("error", (msg: string) => {
      setIsReconnecting(false);
      showMessage(msg, 3000);
    });
    socket.on("invalid-word", () => { playInvalidWord(); showMessage("Kelime listede yok!", 1800); });
    socket.on("emoji-received", ({ fromId, emoji }: { fromId: string; emoji: string }) => {
      const fromMe = fromId === socket.id;
      const id = ++emojiCounter.current;
      setFloatingEmojis((prev) => [...prev, { id, emoji, fromMe }]);
      setTimeout(() => setFloatingEmojis((prev) => prev.filter((e) => e.id !== id)), 2000);
    });

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      ["room-created","player-joined","player-ready","settings-updated","round-started",
       "guess-processed","round-over","game-over","player-left","room-disbanded",
       "host-reconnecting","host-reconnected","room-rejoined",
       "player-reconnecting","player-reconnected","rejoin-failed",
       "rematch-requested","rematch-accepted","error","invalid-word","emoji-received"].forEach((e) => socket.off(e));
    };
  }, [showMessage]);

  useEffect(() => {
    const toTurkishUpper = (s: string) =>
      s.replace(/i/g, "İ").replace(/ı/g, "I").replace(/ğ/g, "Ğ")
       .replace(/ü/g, "Ü").replace(/ş/g, "Ş").replace(/ö/g, "Ö")
       .replace(/ç/g, "Ç").toUpperCase();
    const onKey = (e: KeyboardEvent) => {
      if (screen !== "game" || !me || me.finished) return;
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      const k = toTurkishUpper(e.key);
      if (k === "ENTER") handleKey("ENTER");
      else if (k === "BACKSPACE") handleKey("BACKSPACE");
      else if (/^[A-ZĞÜŞİÖÇI]$/.test(k)) handleKey(k);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [screen, me, currentGuess, room]);

  const handleKey = (key: string) => {
    if (!room || !me || me.finished) return;
    if (key === "ENTER") {
      if (currentGuess.length === room.settings.wordLength) {
        socket.emit("submit-guess", { roomId: room.id, guess: currentGuess });
        setCurrentGuess("");
      } else {
        showMessage("Kelime çok kısa!", 1400);
      }
    } else if (key === "BACKSPACE") {
      playBackspace();
      setCurrentGuess((p) => p.slice(0, -1));
    } else if (currentGuess.length < room.settings.wordLength) {
      playKeyPress();
      setCurrentGuess((p) => p + key);
    }
  };

  const createRoom = () => {
    if (!name.trim()) return showMessage("İsim gerekli!");
    localStorage.setItem("playerName", name);
    socket.emit("create-room", name.toUpperCase());
  };

  const joinRoom = () => {
    if (!name.trim()) return showMessage("İsim gerekli!");
    if (!roomCodeInput.trim()) return showMessage("Oda kodu gerekli!");
    localStorage.setItem("playerName", name);
    socket.emit("join-room", { roomId: roomCodeInput.toUpperCase(), name: name.toUpperCase() });
  };

  const reconnectRoom = () => {
    if (!savedReconnect) return;
    socket.emit("rejoin-room", { roomId: savedReconnect.roomId, name: savedReconnect.name });
  };

  const leaveRoom = () => {
    if (room) socket.emit("leave-room", room.id);
    localStorage.removeItem("wordleReconnect");
    setSavedReconnect(null);
    setRoom(null);
    setScreen("name");
  };

  const sendEmoji = useCallback((emoji: string) => {
    if (!room || emojiCooldown) return;
    socket.emit("send-emoji", { roomId: room.id, emoji });
    playEmoji();
    setEmojiCooldown(true);
    setTimeout(() => setEmojiCooldown(false), 1500);
  }, [room, emojiCooldown]);

  const toggleReady = () => {
    if (room) socket.emit("ready", { roomId: room.id, ready: !me?.ready });
  };

  const updateSetting = (key: keyof Settings, val: number | string) => {
    if (room && me?.isHost) socket.emit("update-settings", { roomId: room.id, settings: { [key]: val } });
  };

  const getKeyboardResults = () => {
    if (!me) return {};
    const res: Record<string, string> = {};
    me.grid.forEach((row, ri) => row.forEach((ch, ci) => {
      const s = me.results[ri]?.[ci];
      if (s === "correct") res[ch] = "correct";
      else if (s === "present" && res[ch] !== "correct") res[ch] = "present";
      else if (s === "absent" && !res[ch]) res[ch] = "absent";
    }));
    return res;
  };

  const shareResults = () => {
    if (!me || !room) return;
    const sq = me.results.map((r) => r.map((s) => s === "correct" ? "🟩" : s === "present" ? "🟨" : "⬛").join("")).join("\n");
    const meP = room.players.find((p) => p.id === socket.id);
    const oppP = room.players.find((p) => p.id !== socket.id);
    const text = `Wordle War\n${meP?.score ?? 0} - ${oppP?.score ?? 0} (${room.settings.totalRounds} raunt)\n\n${sq}`;
    navigator.clipboard.writeText(text);
    showMessage("Panoya kopyalandı!");
  };

  // ── NAME ──────────────────────────────────────────────────────────────────

  if (screen === "name") {
    return (
      <div className="min-h-[100dvh] bg-[#050505] text-slate-200 flex items-center justify-center p-4 font-sans select-none relative overflow-hidden">
        <div className="absolute inset-0 atmosphere opacity-40 pointer-events-none" />
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}
          className="max-w-sm w-full bg-slate-900/30 backdrop-blur-xl border border-white/10 p-8 rounded-[2rem] z-10 shadow-2xl"
        >
          <div className="text-center mb-8">
            <Swords size={28} className="text-red-500 mx-auto mb-3" />
            <h1 className="text-4xl sm:text-5xl font-black italic tracking-tighter text-white uppercase mb-1">
              WORDLE <span className="text-red-500">WAR</span>
            </h1>
            <p className="text-[10px] text-slate-500 font-mono tracking-widest uppercase">Çok Oyunculu Türkçe Arena</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-500 tracking-widest mb-2">SAVAŞÇI ADI</label>
              <input
                type="text" maxLength={12} value={name}
                onChange={(e) => setName(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === "Enter" && createRoom()}
                placeholder="ADINI GİR"
                className="w-full bg-slate-800/40 border border-white/10 rounded-xl px-4 py-4 text-white placeholder-slate-600 focus:outline-none focus:border-red-500/60 transition-all font-mono font-bold tracking-widest text-sm"
              />
            </div>
            <button onClick={createRoom}
              className="w-full py-4 bg-white text-black font-black rounded-xl border-b-4 border-slate-300 active:translate-y-1 active:border-b-0 transition-all uppercase tracking-tighter text-sm touch-manipulation">
              YENİ SAVAŞ BAŞLAT
            </button>
            <div className="relative flex items-center py-1">
              <div className="flex-grow border-t border-white/5" />
              <span className="mx-4 text-slate-600 text-[10px] font-mono font-bold">VEYA</span>
              <div className="flex-grow border-t border-white/5" />
            </div>
            <div className="flex gap-3">
              <input type="text" placeholder="KOD" maxLength={6} value={roomCodeInput}
                onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === "Enter" && joinRoom()}
                className="w-24 bg-slate-800/40 border border-white/10 rounded-xl px-3 py-4 text-center font-mono font-black placeholder-slate-600 uppercase focus:outline-none focus:border-blue-500/50 text-white text-sm"
              />
              <button onClick={joinRoom}
                className="flex-1 py-4 bg-slate-800 hover:bg-slate-700 text-white font-black rounded-xl border-b-4 border-slate-950 active:translate-y-1 active:border-b-0 transition-all uppercase tracking-tighter text-sm touch-manipulation">
                KATIL
              </button>
            </div>
            {savedReconnect && (
              <>
                <div className="relative flex items-center py-1">
                  <div className="flex-grow border-t border-white/5" />
                  <span className="mx-4 text-slate-600 text-[10px] font-mono font-bold">YA DA</span>
                  <div className="flex-grow border-t border-white/5" />
                </div>
                <button onClick={reconnectRoom}
                  className="w-full py-4 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 font-black rounded-xl border border-yellow-500/30 active:scale-95 transition-all uppercase tracking-tighter text-sm touch-manipulation flex items-center justify-center gap-2">
                  <RefreshCw size={14} />
                  Odaya Geri Dön — {savedReconnect.roomId}
                </button>
              </>
            )}
            <div className="pt-4 flex justify-between items-center text-[10px] font-mono font-bold text-slate-500 uppercase tracking-widest border-t border-white/5">
              <span>SKOR: {stats.won}G / {stats.lost}M</span>
              <button onClick={() => { const next = !mute; setMute(next); setSoundMuted(next); }} className="hover:text-white transition-colors touch-manipulation">
                {mute ? <VolumeX size={16} /> : <Volume2 size={16} />}
              </button>
            </div>
            <p className="text-[9px] font-mono text-slate-700 text-left tracking-widest mt-1.5">© HT Games</p>
          </div>
        </motion.div>
        <AnimatePresence>
          {message && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="fixed bottom-8 left-1/2 -translate-x-1/2 px-8 py-3 bg-red-500 text-white font-black text-xs uppercase tracking-widest rounded-full shadow-2xl z-50 whitespace-nowrap">
              {message}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // ── LOBBY ─────────────────────────────────────────────────────────────────

  if (screen === "lobby" && room) {
    const SettingGroup = ({ label, options, value, settingKey }: {
      label: string; options: { val: number; label: string }[]; value: number; settingKey: keyof Settings;
    }) => (
      <div>
        <label className="block text-[10px] font-bold text-slate-600 uppercase mb-3 tracking-widest">{label}</label>
        <div className={`grid gap-2`} style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}>
          {options.map((o) => (
            <button key={o.val} disabled={!me?.isHost}
              onClick={() => updateSetting(settingKey, o.val)}
              className={`py-2.5 rounded-lg font-mono font-bold text-sm border transition-all touch-manipulation ${
                value === o.val ? "bg-white text-black border-white" : "bg-slate-900/50 border-white/5 text-slate-500 hover:border-white/20 disabled:opacity-40"
              }`}>
              {o.label}
            </button>
          ))}
        </div>
      </div>
    );

    return (
      <div className="min-h-[100dvh] bg-[#050505] text-slate-200 p-4 sm:p-6 font-sans select-none relative overflow-hidden flex flex-col">
        <div className="absolute inset-0 atmosphere opacity-20 pointer-events-none" />

        <header className="flex items-center justify-between border-b border-white/10 pb-4 mb-6 z-10">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tighter text-white uppercase italic">
              WORDLE <span className="text-red-500">WAR</span>
            </h1>
            <span className="text-[10px] text-slate-500 font-mono tracking-widest uppercase">Lobi</span>
          </div>
          <button onClick={leaveRoom} className="p-2 hover:bg-slate-800 rounded-full border border-white/5 touch-manipulation">
            <LogOut size={18} className="text-slate-500" />
          </button>
        </header>

        {isReconnecting && (
          <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-center justify-center">
            <div className="bg-slate-900 border border-white/10 rounded-2xl px-8 py-6 flex flex-col items-center gap-3">
              <RefreshCw size={28} className="text-yellow-400 animate-spin" />
              <p className="font-black text-sm uppercase tracking-wider text-white">Bağlanıyor...</p>
            </div>
          </div>
        )}

        {!isReconnecting && hostReconnectDeadline && (
          <div className="fixed top-0 left-0 right-0 z-50 bg-yellow-500 text-black px-4 py-2.5 flex items-center justify-center gap-3 font-black text-xs uppercase tracking-wider">
            <RefreshCw size={14} className="animate-spin" />
            Oda kurucusu bağlantısı kesildi — {reconnectSecsLeft}s içinde geri dönebilir
          </div>
        )}

        <div className={`max-w-2xl mx-auto w-full z-10 flex flex-col gap-5 flex-1 ${hostReconnectDeadline ? "mt-10" : ""}`}>
          {/* Room Code */}
          <button onClick={() => { navigator.clipboard.writeText(room.id); showMessage("Kopyalandı!"); }}
            className="w-full bg-slate-950/60 border border-white/10 rounded-2xl px-6 py-5 flex items-center justify-between hover:border-white/20 active:scale-[0.99] transition-all touch-manipulation shadow-xl group">
            <div>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-1 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse inline-block" />
                ODA KODU — Arkadaşını davet et
              </p>
              <p className="text-3xl sm:text-4xl font-black font-mono tracking-[0.25em] text-white">{room.id}</p>
            </div>
            <div className="flex items-center gap-2 bg-white/5 group-hover:bg-white/10 border border-white/10 rounded-xl px-4 py-3 transition-all">
              <Copy size={16} className="text-slate-300" />
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Kopyala</span>
            </div>
          </button>
          {/* Settings */}
          <div className="bg-slate-950/60 p-5 rounded-2xl border border-white/5 shadow-xl">
            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-5 flex items-center gap-2">
              <SettingsIcon size={12} /> SAVAŞ AYARLARI
            </h3>
            <div className="grid grid-cols-2 gap-5">
              <SettingGroup label="Tahmin Hakkı" options={[5,6,7,8].map((v) => ({ val: v, label: `${v}×` }))}
                value={room.settings.maxAttempts} settingKey="maxAttempts" />
              <SettingGroup label="Raunt Sayısı"
                options={[{val:1,label:"1"},{val:3,label:"3"},{val:5,label:"5"},{val:7,label:"7"}]}
                value={room.settings.totalRounds} settingKey="totalRounds" />
              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-3 tracking-widest flex items-center gap-1">
                  <Clock size={10} /> Süre Sınırı
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[{val:0,label:"∞"},{val:60,label:"1dk"},{val:90,label:"1.5dk"},{val:120,label:"2dk"}].map((o) => (
                    <button key={o.val} disabled={!me?.isHost}
                      onClick={() => updateSetting("timeLimit", o.val)}
                      className={`py-2.5 rounded-lg font-mono font-bold text-xs border transition-all touch-manipulation ${
                        room.settings.timeLimit === o.val ? "bg-white text-black border-white" : "bg-slate-900/50 border-white/5 text-slate-500 hover:border-white/20 disabled:opacity-40"
                      }`}>
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Players */}
          <div className="space-y-2">
            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] flex items-center gap-2 px-1">
              <Users size={12} /> SAVAŞÇILAR
            </h3>
            {room.players.map((p) => (
              <motion.div key={p.id} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }}
                className="bg-slate-950/40 border border-white/5 rounded-2xl px-5 py-4 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm border-2 ${
                    p.isHost ? "bg-white text-black border-white" : "bg-slate-900 text-white border-white/10"}`}>
                    {p.name[0]}
                  </div>
                  <div>
                    <div className="font-bold text-white tracking-tight text-sm">{p.name} {p.id === socket.id && "(SEN)"}</div>
                    <div className="text-[10px] text-slate-500 font-mono uppercase">{p.isHost ? "HOST" : "CHALLENGER"}</div>
                  </div>
                </div>
                {p.ready
                  ? <span className="text-green-400 text-[10px] font-black uppercase border border-green-500/30 bg-green-500/5 px-3 py-1 rounded-full">HAZIR</span>
                  : <span className="text-slate-600 text-[10px] font-black uppercase border border-white/5 px-3 py-1 rounded-full">BEKLE</span>
                }
              </motion.div>
            ))}
            {room.players.length < 2 && (
              <div className="border-2 border-dashed border-white/5 rounded-2xl p-8 text-center text-slate-700 font-bold italic animate-pulse text-sm">
                RAKİP ARANIYOR...
              </div>
            )}
          </div>

          {/* Ready button */}
          <button onClick={toggleReady}
            className={`w-full py-5 rounded-2xl font-black text-lg border-b-4 transition-all uppercase tracking-tighter shadow-xl touch-manipulation ${
              me?.ready ? "bg-green-600 border-green-800 text-white" : "bg-red-600 border-red-800 text-white hover:bg-red-500 active:translate-y-1 active:border-b-0"
            }`}>
            {me?.ready ? "✓ HAZIRSIN" : "SAVAŞA HAZIR OL"}
          </button>

          {/* Emoji Bar */}
          {room.players.length === 2 && (
            <div className="bg-slate-950/40 border border-white/5 rounded-2xl p-3">
              <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest text-center mb-2">REAKSİYON</p>
              <EmojiBar onSend={sendEmoji} disabled={emojiCooldown} />
            </div>
          )}
        </div>

        <FloatingEmojiLayer items={floatingEmojis} />

        <AnimatePresence>
          {message && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="fixed bottom-8 left-1/2 -translate-x-1/2 px-8 py-3 bg-slate-900 border border-white/10 text-white font-black text-xs uppercase tracking-[0.2em] rounded-full shadow-2xl z-50 whitespace-nowrap">
              {message}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // ── ROUND END ─────────────────────────────────────────────────────────────

  if (screen === "round-end" && room && me) {
    const iWon = roundWinnerId === socket.id;
    const opp = room.players.find((p) => p.id !== socket.id);
    return (
      <div className="min-h-[100dvh] bg-[#050505] text-slate-200 flex items-center justify-center p-4 font-sans select-none relative overflow-hidden">
        <div className="absolute inset-0 atmosphere opacity-30 pointer-events-none" />
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
          className="max-w-sm w-full bg-slate-950/60 border border-white/5 p-8 rounded-3xl text-center z-10">
          <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">
            RAUNT {room.currentRound}/{room.settings.totalRounds} BİTTİ
          </div>
          <div className={`text-4xl font-black italic uppercase mb-6 ${iWon ? "text-green-400" : roundWinnerId ? "text-red-400" : "text-slate-400"}`}>
            {iWon ? "RAUNDU KAZANDIN" : roundWinnerId ? "RAUNT RAKIBE" : "BERABERLİK"}
          </div>
          <div className="flex justify-center gap-8 mb-6">
            {room.players.map((p) => (
              <div key={p.id} className="text-center">
                <div className="text-3xl font-black">{p.score}</div>
                <div className="text-[10px] text-slate-500 font-mono uppercase">{p.name}</div>
              </div>
            ))}
          </div>
          <div className="mt-6 text-[10px] text-slate-600 font-mono animate-pulse">Sonraki raunt başlıyor...</div>
        </motion.div>
        <AnimatePresence>{revealWord && <WordRevealToast word={revealWord} />}</AnimatePresence>
      </div>
    );
  }

  // ── GAME ──────────────────────────────────────────────────────────────────

  if (screen === "game" && room && me) {
    const timePct = timeLimit > 0 ? (timeLeft / timeLimit) * 100 : 100;
    const timeColor = timePct > 50 ? "bg-green-500" : timePct > 25 ? "bg-yellow-500" : "bg-red-500";

    return (
      <div className="h-[100dvh] bg-[#050505] text-slate-200 font-sans select-none flex flex-col relative overflow-hidden">
        <div className="absolute inset-0 atmosphere opacity-20 pointer-events-none" />
        {isReconnecting && (
          <div className="absolute inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-center justify-center">
            <div className="bg-slate-900 border border-white/10 rounded-2xl px-8 py-6 flex flex-col items-center gap-3">
              <RefreshCw size={28} className="text-yellow-400 animate-spin" />
              <p className="font-black text-sm uppercase tracking-wider text-white">Bağlanıyor...</p>
            </div>
          </div>
        )}

        {!isReconnecting && hostReconnectDeadline && (
          <div className="absolute top-0 left-0 right-0 z-50 bg-yellow-500 text-black px-4 py-2 flex items-center justify-center gap-3 font-black text-xs uppercase tracking-wider">
            <RefreshCw size={12} className="animate-spin" />
            Oda kurucusu bağlantısı kesildi — {reconnectSecsLeft}s
          </div>
        )}

        {/* Header */}
        <header className="flex-none flex items-center justify-between px-4 pt-safe-top pt-3 pb-3 border-b border-white/10 z-10">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-black tracking-tighter text-white uppercase italic">
              WORDLE <span className="text-red-500">WAR</span>
            </h1>
            {room.settings.totalRounds > 1 && <ScorePill room={room} myId={socket.id} />}
          </div>
          <div className="flex items-center gap-2">
            {opponent && (
              <div className="flex items-center gap-1.5 bg-slate-900 border border-white/10 px-3 py-1.5 rounded-full">
                <span className={`w-1.5 h-1.5 rounded-full ${opponent.finished ? "bg-red-500" : "bg-green-500 animate-pulse"}`} />
                <span className="text-[10px] font-mono font-bold">{opponent.name}: {opponent.attempts}/{room.settings.maxAttempts}</span>
              </div>
            )}
            <button onClick={leaveRoom} className="p-2 hover:bg-slate-800 rounded-lg border border-white/5 touch-manipulation">
              <LogOut size={15} className="text-slate-500" />
            </button>
          </div>
        </header>

        {/* Timer bar */}
        {timeLimit > 0 && (
          <div className="flex-none h-1 bg-slate-800 z-10">
            <motion.div className={`h-full ${timeColor} transition-colors`}
              animate={{ width: `${timePct}%` }} transition={{ duration: 0.2 }} />
          </div>
        )}
        {timeLimit > 0 && (
          <div className="flex-none text-center py-1 z-10">
            <span className={`text-xs font-black font-mono ${timePct < 25 ? "text-red-400 animate-pulse" : "text-slate-500"}`}>
              {Math.ceil(timeLeft)}s
            </span>
          </div>
        )}

        {/* Board area */}
        <main className="flex-1 overflow-y-auto no-scrollbar z-10 px-4 py-2 flex flex-col items-center gap-3">
          <div className="w-full max-w-xs">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">SİZİN TAHTANIZ</span>
              <div className="h-px flex-1 bg-blue-500/20" />
            </div>
            <div className="bg-slate-950/40 p-3 sm:p-4 rounded-2xl border border-white/5">
              <Board
                grid={me.grid} results={me.results}
                length={room.settings.wordLength} attempts={room.settings.maxAttempts}
                currentGuess={currentGuess} isActive={!me.finished}
              />
            </div>
          </div>

          {opponent && (
            <div className="w-full max-w-xs">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] font-black text-red-400 uppercase tracking-widest">{opponent.name}</span>
                <div className="h-px flex-1 bg-red-500/20" />
              </div>
              <div className="flex gap-2 flex-wrap">
                {Array.from({ length: room.settings.maxAttempts }).map((_, i) => (
                  <div key={i} className="flex gap-0.5">
                    {Array.from({ length: room.settings.wordLength }).map((_, j) => {
                      const s = opponent.results[i]?.[j];
                      return (
                        <div key={j} className={`w-3 h-3 rounded-sm ${
                          s === "correct" ? "bg-green-500" : s === "present" ? "bg-yellow-500"
                          : s === "absent" ? "bg-slate-700" : "bg-slate-800/40 border border-slate-800"}`} />
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>

        {/* Keyboard */}
        <footer className="flex-none z-10 px-1 pb-1">
          <div className="mb-1.5">
            <EmojiBar onSend={sendEmoji} disabled={emojiCooldown} />
          </div>
          <Keyboard onKey={handleKey} results={getKeyboardResults()} />
        </footer>

        <FloatingEmojiLayer items={floatingEmojis} />

        <AnimatePresence>{revealWord && <WordRevealToast word={revealWord} />}</AnimatePresence>

        <AnimatePresence>
          {message && (
            <motion.div
              initial={{ opacity: 0, y: -16, x: "-50%" }} animate={{ opacity: 1, y: 0, x: "-50%" }}
              exit={{ opacity: 0, scale: 0.9, x: "-50%" }}
              className="fixed top-20 left-1/2 px-7 py-2.5 bg-white text-black font-black text-xs rounded-full shadow-2xl z-50 uppercase tracking-[0.25em] whitespace-nowrap">
              {message}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // ── RESULTS ───────────────────────────────────────────────────────────────

  if (screen === "results" && room && me) {
    const myScore = me.score;
    const oppScore = opponent?.score ?? 0;
    const iWon = myScore > oppScore;
    const isTie = myScore === oppScore;

    return (
      <div className="min-h-[100dvh] bg-[#050505] text-slate-200 p-4 font-sans select-none flex items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 atmosphere opacity-30 pointer-events-none" />
        <motion.div initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }}
          className="relative max-w-md w-full bg-slate-950/50 backdrop-blur-2xl border border-white/5 p-8 sm:p-12 rounded-[2.5rem] z-10 shadow-2xl text-center">
          <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-blue-500/40 to-transparent rounded-t-full" />
          <button onClick={leaveRoom} className="absolute top-4 right-4 p-2 hover:bg-slate-800 rounded-lg border border-white/5 touch-manipulation" title="Ana Menü">
            <LogOut size={15} className="text-slate-500" />
          </button>

          <div className="mb-8">
            {isTie ? (
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 bg-slate-700/20 rounded-full flex items-center justify-center mb-4 border border-slate-600/20">
                  <Swords size={32} className="text-slate-400" />
                </div>
                <h2 className="text-4xl font-black italic tracking-tighter text-white uppercase mb-1">BERABERLİK</h2>
                <p className="text-[10px] text-slate-500 uppercase font-black tracking-[0.4em]">ONURLU ÇATIŞMA</p>
              </div>
            ) : iWon ? (
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center mb-4 border border-blue-500/20">
                  <Trophy size={32} className="text-blue-400 animate-bounce" />
                </div>
                <h2 className="text-4xl font-black italic tracking-tighter text-white uppercase mb-1">ARENA FATİHİ</h2>
                <p className="text-[10px] text-slate-500 uppercase font-black tracking-[0.4em]">SAVAŞI KAZANDINIZ</p>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-4 border border-red-500/20">
                  <Swords size={32} className="text-red-400" />
                </div>
                <h2 className="text-4xl font-black italic tracking-tighter text-white uppercase mb-1">MAĞLUBİYET</h2>
                <p className="text-[10px] text-slate-500 uppercase font-black tracking-[0.4em]">
                  {opponent?.name} KAZANDI
                </p>
              </div>
            )}
          </div>

          {/* Final scoreboard */}
          <div className="mb-8 p-5 bg-slate-900/40 rounded-2xl border border-white/5">
            <div className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-4">
              FINAL SKORU — {room.settings.totalRounds} RAUNT
            </div>
            <div className="flex justify-center items-center gap-6">
              {room.players.map((p, idx) => (
                <React.Fragment key={p.id}>
                  <div className="text-center">
                    <div className={`text-5xl font-black ${p.id === socket.id ? "text-blue-400" : "text-red-400"}`}>
                      {p.score}
                    </div>
                    <div className="text-[10px] font-mono text-slate-500 uppercase mt-1">{p.name}</div>
                  </div>
                  {idx === 0 && <div className="text-2xl font-black text-slate-700">:</div>}
                </React.Fragment>
              ))}
            </div>
            {room.secretWord && (
              <div className="mt-4 text-[10px] text-slate-600 font-mono">
                Son Kelime: <span className="text-white font-black tracking-widest">{room.secretWord}</span>
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button onClick={shareResults}
              className="flex-1 py-4 bg-white text-black font-black rounded-xl transition-all uppercase tracking-tighter flex items-center justify-center gap-2 hover:bg-slate-100 active:scale-95 text-sm touch-manipulation">
              <Send size={15} /> PAYLAŞ
            </button>
            {rematchPending ? (
              <div className="flex-1 py-4 bg-slate-800/60 border border-white/10 text-slate-400 font-black rounded-xl uppercase tracking-tighter flex flex-col items-center justify-center gap-1 text-sm">
                <div className="flex items-center gap-2">
                  <RefreshCw size={15} className="animate-spin" />
                  RAKİP BEKLENİYOR...
                </div>
                {opponentWantsRematch && (
                  <span className="text-[10px] text-green-400 font-bold tracking-widest animate-pulse">
                    {opponent?.name} KABUL ETTİ
                  </span>
                )}
              </div>
            ) : (
              <button
                onClick={() => {
                  setRematchPending(true);
                  socket.emit("rematch", { roomId: room.id });
                }}
                className="flex-1 py-4 bg-slate-800 hover:bg-slate-700 text-white font-black rounded-xl border-b-4 border-slate-950 active:translate-y-1 active:border-b-0 transition-all uppercase tracking-tighter flex items-center justify-center gap-2 text-sm touch-manipulation">
                <RefreshCw size={15} />
                {opponentWantsRematch ? `${opponent?.name} KABUL ETTİ — SEN DE?` : "YENİDEN OYNA"}
              </button>
            )}
          </div>
        </motion.div>

        <AnimatePresence>
          {message && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="fixed bottom-8 left-1/2 -translate-x-1/2 px-8 py-3 bg-slate-900 border border-white/10 text-white font-black text-xs uppercase tracking-widest rounded-full shadow-2xl z-50 whitespace-nowrap">
              {message}
            </motion.div>
          )}
        </AnimatePresence>
        <AnimatePresence>{revealWord && <WordRevealToast word={revealWord} />}</AnimatePresence>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-[#050505] flex items-center justify-center">
      <div className="text-slate-500 font-mono text-sm animate-pulse">Bağlanılıyor...</div>
    </div>
  );
}

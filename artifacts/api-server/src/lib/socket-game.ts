import { Server, type Socket } from "socket.io";
import { createServer as createHttpServer } from "http";
import type { Express } from "express";
import { WORDS, WORD_SET } from "./words";
import { COMMON_WORDS } from "./common-words";

function seedRandom(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  }
  return () => {
    h = (Math.imul(31, h) + 1) | 0;
    return (h >>> 0) / 4294967296;
  };
}

function normalizeTurkish(str: string): string {
  return str
    .replace(/i/g, "İ")
    .replace(/ı/g, "I")
    .replace(/ğ/g, "Ğ")
    .replace(/ü/g, "Ü")
    .replace(/ş/g, "Ş")
    .replace(/ö/g, "Ö")
    .replace(/ç/g, "Ç")
    .toUpperCase();
}

interface Player {
  id: string;
  name: string;
  ready: boolean;
  isHost: boolean;
  grid: string[][];
  results: string[][];
  attempts: number;
  finished: boolean;
  won: boolean;
  score: number;
}

interface DisconnectedEntry {
  player: Player;
  timer: ReturnType<typeof setTimeout>;
}

interface Room {
  id: string;
  players: Player[];
  settings: {
    wordLength: number;
    maxAttempts: number;
    timeLimit: number;
    totalRounds: number;
    difficulty: "easy" | "hard";
  };
  secretWord: string;
  status: "waiting" | "playing" | "results" | "round-end";
  currentRound: number;
  lastRoundSeed: string;
  usedWords: Set<string>;
  rematchRequests?: Set<string>;
  // Reconnection state
  disconnectedHost?: Player;
  hostReconnectTimer?: ReturnType<typeof setTimeout>;
  disconnectedPlayers?: Map<string, DisconnectedEntry>;
  // For rejoining players mid-game
  roundStartedAt?: number;
}

const rooms: Map<string, Room> = new Map();
const roundTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();

const HOST_GRACE_MS = 120_000;
const PLAYER_GRACE_MS = 90_000;

// Use common words first; if exhausted, fall back to full list
const WORD_POOL = COMMON_WORDS.length >= 20 ? COMMON_WORDS : WORDS;

function evaluateGuess(guess: string, secret: string): string[] {
  const results = new Array(secret.length).fill("absent");
  const secretChars = secret.split("");
  const guessChars = guess.split("");

  for (let i = 0; i < secret.length; i++) {
    if (guessChars[i] === secretChars[i]) {
      results[i] = "correct";
      secretChars[i] = "";
      guessChars[i] = "";
    }
  }
  for (let i = 0; i < secret.length; i++) {
    if (guessChars[i] !== "" && secretChars.indexOf(guessChars[i]) !== -1) {
      results[i] = "present";
      secretChars[secretChars.indexOf(guessChars[i])] = "";
    }
  }
  return results;
}

function clearRoundTimer(roomId: string) {
  const t = roundTimers.get(roomId);
  if (t) {
    clearTimeout(t);
    roundTimers.delete(roomId);
  }
}

function clearHostReconnectTimer(room: Room) {
  if (room.hostReconnectTimer) {
    clearTimeout(room.hostReconnectTimer);
    room.hostReconnectTimer = undefined;
  }
}

function hasPendingReconnections(room: Room): boolean {
  return !!(
    room.disconnectedHost ||
    (room.disconnectedPlayers && room.disconnectedPlayers.size > 0)
  );
}

function disbandRoom(io: Server, roomId: string, reason: string) {
  const room = rooms.get(roomId);
  if (!room) return;
  clearRoundTimer(roomId);
  clearHostReconnectTimer(room);
  room.disconnectedPlayers?.forEach((entry) => clearTimeout(entry.timer));
  io.to(roomId).emit("room-disbanded", { reason });
  rooms.delete(roomId);
}

function startRound(io: Server, roomId: string) {
  const room = rooms.get(roomId);
  if (!room) return;

  clearRoundTimer(roomId);

  room.status = "playing";
  room.lastRoundSeed = Math.random().toString(36).substring(7);
  room.roundStartedAt = Date.now();

  // Prefer common words; avoid repeats
  const available = WORD_POOL.filter((w) => !room.usedWords.has(w));
  const pool = available.length > 0 ? available : WORD_POOL;
  const rng = seedRandom(room.lastRoundSeed + roomId + room.currentRound);
  const word = pool[Math.floor(rng() * pool.length)].toUpperCase();
  room.secretWord = word;
  room.usedWords.add(word);

  room.players.forEach((p) => {
    p.grid = [];
    p.results = [];
    p.attempts = 0;
    p.finished = false;
    p.won = false;
    p.ready = false;
  });

  io.to(roomId).emit("round-started", {
    room: serializeRoom(room),
    roundStartTime: room.roundStartedAt,
    timeLimit: room.settings.timeLimit,
  });

  if (room.settings.timeLimit > 0) {
    const timer = setTimeout(() => {
      const r = rooms.get(roomId);
      if (!r || r.status !== "playing") return;
      r.players.forEach((p) => {
        if (!p.finished) {
          p.finished = true;
          p.won = false;
        }
      });
      endRound(io, roomId, null);
    }, room.settings.timeLimit * 1000);
    roundTimers.set(roomId, timer);
  }
}

function endRound(io: Server, roomId: string, winnerId: string | null) {
  const room = rooms.get(roomId);
  if (!room) return;

  clearRoundTimer(roomId);

  if (winnerId) {
    const winner = room.players.find((p) => p.id === winnerId);
    if (winner) winner.score += 1;
  }

  const isLastRound = room.currentRound >= room.settings.totalRounds;

  if (isLastRound) {
    room.status = "results";
    io.to(roomId).emit("game-over", { room: serializeRoom(room), winnerId });
  } else {
    room.status = "round-end";
    io.to(roomId).emit("round-over", { room: serializeRoom(room), winnerId });
    setTimeout(() => {
      const r = rooms.get(roomId);
      if (!r || r.status !== "round-end") return;
      r.currentRound += 1;
      startRound(io, roomId);
    }, 3000);
  }
}

function handleDisconnect(
  io: Server,
  socket: Socket,
  specifiedRoomId?: string,
  intentional = false
) {
  rooms.forEach((room, roomId) => {
    if (specifiedRoomId && roomId !== specifiedRoomId) return;
    const playerIndex = room.players.findIndex((p) => p.id === socket.id);
    if (playerIndex === -1) return;

    const leavingPlayer = room.players[playerIndex];
    room.players.splice(playerIndex, 1);

    if (room.players.length === 0 && !hasPendingReconnections(room)) {
      // Truly empty — disband immediately
      disbandRoom(io, roomId, "Oda boşaldı.");
    } else if (leavingPlayer.isHost) {
      if (intentional) {
        disbandRoom(io, roomId, "Oda kurucusu ayrıldı.");
      } else {
        room.disconnectedHost = { ...leavingPlayer };
        const deadline = Date.now() + HOST_GRACE_MS;
        io.to(roomId).emit("host-reconnecting", { deadline });
        room.hostReconnectTimer = setTimeout(() => {
          const r = rooms.get(roomId);
          if (!r) return;
          r.disconnectedHost = undefined;
          // If no one else is left, disband
          if (r.players.length === 0 && !hasPendingReconnections(r)) {
            disbandRoom(io, roomId, "Oda kurucusu geri dönmedi.");
          } else {
            disbandRoom(io, roomId, "Oda kurucusu geri dönmedi.");
          }
        }, HOST_GRACE_MS);
      }
    } else {
      if (intentional) {
        io.to(roomId).emit("player-left", {
          playerId: socket.id,
          room: serializeRoom(room),
        });
      } else {
        if (!room.disconnectedPlayers) room.disconnectedPlayers = new Map();
        const key = leavingPlayer.name;
        const deadline = Date.now() + PLAYER_GRACE_MS;
        const timer = setTimeout(() => {
          const r = rooms.get(roomId);
          if (!r) return;
          r.disconnectedPlayers?.delete(key);
          if (r.players.length === 0 && !hasPendingReconnections(r)) {
            disbandRoom(io, roomId, "Oda boşaldı.");
          } else {
            io.to(roomId).emit("player-left", {
              playerId: leavingPlayer.id,
              room: serializeRoom(r),
            });
          }
        }, PLAYER_GRACE_MS);
        room.disconnectedPlayers.set(key, { player: { ...leavingPlayer }, timer });
        io.to(roomId).emit("player-reconnecting", {
          playerName: leavingPlayer.name,
          deadline,
        });
      }
    }
  });
}

export function setupSocketIO(app: Express) {
  const httpServer = createHttpServer(app);

  const io = new Server(httpServer, {
    cors: { origin: "*" },
    path: "/socket.io",
    pingInterval: 10_000,
    pingTimeout: 20_000,
  });

  io.on("connection", (socket: Socket) => {
    socket.on("create-room", (name: string) => {
      try {
        const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
        const player: Player = {
          id: socket.id,
          name: normalizeTurkish(name),
          ready: false,
          isHost: true,
          grid: [],
          results: [],
          attempts: 0,
          finished: false,
          won: false,
          score: 0,
        };
        const room: Room = {
          id: roomId,
          players: [player],
          settings: {
            wordLength: 5,
            maxAttempts: 6,
            timeLimit: 0,
            totalRounds: 1,
            difficulty: "easy" as const,
          },
          secretWord: "",
          status: "waiting",
          currentRound: 1,
          lastRoundSeed: "",
          usedWords: new Set(),
        };
        rooms.set(roomId, room);
        socket.join(roomId);
        socket.emit("room-created", serializeRoom(room));
      } catch (e) { /* ignore */ }
    });

    socket.on("join-room", ({ roomId, name }: { roomId: string; name: string }) => {
      try {
        const upperRoomId = roomId.toUpperCase();
        const room = rooms.get(upperRoomId);
        if (!room) { socket.emit("error", "Oda bulunamadı."); return; }
        if (room.players.length >= 2) { socket.emit("error", "Oda dolu."); return; }

        const player: Player = {
          id: socket.id,
          name: normalizeTurkish(name),
          ready: false,
          isHost: false,
          grid: [],
          results: [],
          attempts: 0,
          finished: false,
          won: false,
          score: 0,
        };
        room.players.push(player);
        socket.join(upperRoomId);
        io.to(upperRoomId).emit("player-joined", serializeRoom(room));
      } catch (e) { /* ignore */ }
    });

    socket.on(
      "update-settings",
      ({ roomId, settings }: { roomId: string; settings: Partial<Room["settings"]> }) => {
        try {
          const room = rooms.get(roomId);
          if (room && room.players.find((p) => p.id === socket.id)?.isHost) {
            const { wordLength: _ignored, ...safeSettings } = settings as any;
            room.settings = { ...room.settings, ...safeSettings, wordLength: 5 };
            io.to(roomId).emit("settings-updated", room.settings);
          }
        } catch (e) { /* ignore */ }
      }
    );

    socket.on("ready", ({ roomId, ready }: { roomId: string; ready: boolean }) => {
      try {
        const room = rooms.get(roomId);
        if (!room) return;
        const player = room.players.find((p) => p.id === socket.id);
        if (player) {
          player.ready = ready;
          io.to(roomId).emit("player-ready", { playerId: socket.id, ready });
          if (room.players.length === 2 && room.players.every((p) => p.ready)) {
            room.currentRound = 1;
            room.usedWords = new Set();
            room.players.forEach((p) => { p.score = 0; });
            startRound(io, roomId);
          }
        }
      } catch (e) { /* ignore */ }
    });

    socket.on(
      "submit-guess",
      ({ roomId, guess }: { roomId: string; guess: string }) => {
        try {
          const room = rooms.get(roomId);
          if (!room || room.status !== "playing") return;
          const player = room.players.find((p) => p.id === socket.id);
          if (!player || player.finished) return;

          const normalizedGuess = normalizeTurkish(guess);
          if (normalizedGuess.length !== room.settings.wordLength) return;

          if (!WORD_SET.has(normalizedGuess)) {
            socket.emit("invalid-word");
            return;
          }

          const result = evaluateGuess(normalizedGuess, room.secretWord);
          player.grid.push(normalizedGuess.split(""));
          player.results.push(result);
          player.attempts++;

          const won = normalizedGuess === room.secretWord;
          if (won || player.attempts >= room.settings.maxAttempts) {
            player.finished = true;
            player.won = won;
          }

          if (won) {
            endRound(io, roomId, player.id);
          } else if (player.finished) {
            // Player used all attempts without finding the word
            const opponent = room.players.find((p) => p.id !== socket.id);
            if (!opponent || opponent.finished) {
              // Both failed simultaneously — draw
              endRound(io, roomId, null);
            } else {
              // Opponent wins immediately — no need to wait
              endRound(io, roomId, opponent.id);
            }
          } else {
            io.to(roomId).emit("guess-processed", { playerId: socket.id, player });
          }
        } catch (e) { /* ignore */ }
      }
    );

    socket.on("rematch", ({ roomId }: { roomId: string }) => {
      try {
        const room = rooms.get(roomId);
        if (!room || room.status !== "results") return;
        const player = room.players.find((p) => p.id === socket.id);
        if (!player) return;

        if (!room.rematchRequests) room.rematchRequests = new Set();
        room.rematchRequests.add(socket.id);
        io.to(roomId).emit("rematch-requested", { playerId: socket.id });

        if (room.players.length === 2 && room.rematchRequests.size >= 2) {
          room.rematchRequests = new Set();
          room.currentRound = 1;
          room.usedWords = new Set();
          room.status = "waiting";
          room.secretWord = "";
          room.players.forEach((p) => {
            p.score = 0;
            p.ready = false;
            p.grid = [];
            p.results = [];
            p.attempts = 0;
            p.finished = false;
            p.won = false;
          });
          io.to(roomId).emit("rematch-accepted", serializeRoom(room));
        }
      } catch (e) { /* ignore */ }
    });

    // Unified rejoin — works for host and non-host, auto-triggered on reconnect
    socket.on(
      "rejoin-room",
      ({ roomId, name }: { roomId: string; name: string }) => {
        try {
          const upperRoomId = roomId.toUpperCase();
          const room = rooms.get(upperRoomId);
          const upperName = normalizeTurkish(name);

          if (!room) {
            socket.emit("rejoin-failed", "Oda bulunamadı veya süre doldu.");
            return;
          }

          // Case 1: Still in active player list (very fast reconnect)
          const existing = room.players.find((p) => p.name === upperName);
          if (existing) {
            existing.id = socket.id;
            socket.join(upperRoomId);
            socket.emit("room-rejoined", {
              room: serializeRoom(room),
              roundStartTime: room.roundStartedAt ?? null,
            });
            socket.to(upperRoomId).emit("player-reconnected", serializeRoom(room));
            return;
          }

          // Case 2: Disconnected host
          if (room.disconnectedHost?.name === upperName) {
            clearHostReconnectTimer(room);
            const restored: Player = { ...room.disconnectedHost, id: socket.id };
            room.disconnectedHost = undefined;
            room.players.unshift(restored);
            socket.join(upperRoomId);
            socket.emit("room-rejoined", {
              room: serializeRoom(room),
              roundStartTime: room.roundStartedAt ?? null,
            });
            socket.to(upperRoomId).emit("host-reconnected", serializeRoom(room));
            return;
          }

          // Case 3: Disconnected non-host player
          const entry = room.disconnectedPlayers?.get(upperName);
          if (entry) {
            clearTimeout(entry.timer);
            room.disconnectedPlayers!.delete(upperName);
            const restored: Player = { ...entry.player, id: socket.id };
            room.players.push(restored);
            socket.join(upperRoomId);
            socket.emit("room-rejoined", {
              room: serializeRoom(room),
              roundStartTime: room.roundStartedAt ?? null,
            });
            socket.to(upperRoomId).emit("player-reconnected", serializeRoom(room));
            return;
          }

          socket.emit("rejoin-failed", "Odaya geri dönme süresi doldu.");
        } catch (e) {
          socket.emit("rejoin-failed", "Bir hata oluştu.");
        }
      }
    );

    socket.on("send-emoji", ({ roomId, emoji }: { roomId: string; emoji: string }) => {
      try {
        const room = rooms.get(roomId);
        if (!room) return;
        const player = room.players.find((p) => p.id === socket.id);
        if (!player) return;
        io.to(roomId).emit("emoji-received", { fromId: socket.id, emoji });
      } catch (e) { /* ignore */ }
    });

    socket.on("leave-room", (roomId: string) => {
      try {
        handleDisconnect(io, socket, roomId, true);
      } catch (e) { /* ignore */ }
    });

    socket.on("disconnect", () => {
      try {
        handleDisconnect(io, socket, undefined, false);
      } catch (e) { /* ignore */ }
    });
  });

  return httpServer;
}

function serializeRoom(room: Room) {
  return {
    ...room,
    usedWords: undefined,
    disconnectedPlayers: undefined,
    hostReconnectTimer: undefined,
  };
}

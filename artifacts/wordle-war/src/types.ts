export type Status = "waiting" | "playing" | "results" | "round-end";

export interface Player {
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

export interface Settings {
  wordLength: number;
  maxAttempts: number;
  timeLimit: number;
  totalRounds: number;
  difficulty: "easy" | "hard";
}

export interface Room {
  id: string;
  players: Player[];
  settings: Settings;
  status: Status;
  secretWord?: string;
  currentRound: number;
}

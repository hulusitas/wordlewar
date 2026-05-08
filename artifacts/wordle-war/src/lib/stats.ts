/**
 * LocalStorage-based game statistics management
 */

export interface GameStats {
  totalGames: number;
  wins: number;
  losses: number;
  draws: number;
  totalRoundsWon: number;
  totalRoundsLost: number;
  averageGuesses: number;
  bestStreak: number;
  currentStreak: number;
  lastPlayedAt: number | null;
  favoriteDifficulty: "easy" | "hard";
}

export interface PlayerRecord {
  name: string;
  stats: GameStats;
  lastUpdated: number;
}

const STATS_KEY = "wordleWarStats";
const LEADERBOARD_KEY = "wordleWarLeaderboard";

const defaultStats: GameStats = {
  totalGames: 0,
  wins: 0,
  losses: 0,
  draws: 0,
  totalRoundsWon: 0,
  totalRoundsLost: 0,
  averageGuesses: 0,
  bestStreak: 0,
  currentStreak: 0,
  lastPlayedAt: null,
  favoriteDifficulty: "easy",
};

export function getPlayerStats(): GameStats {
  try {
    const stored = localStorage.getItem(STATS_KEY);
    return stored ? JSON.parse(stored) : { ...defaultStats };
  } catch {
    return { ...defaultStats };
  }
}

export function updatePlayerStats(updates: Partial<GameStats>) {
  const current = getPlayerStats();
  const updated = { ...current, ...updates, lastPlayedAt: Date.now() };
  localStorage.setItem(STATS_KEY, JSON.stringify(updated));
  return updated;
}

export function recordGameResult(won: boolean, roundsWon: number, roundsLost: number, avgGuesses: number, difficulty: "easy" | "hard") {
  const stats = getPlayerStats();
  
  stats.totalGames += 1;
  if (won) {
    stats.wins += 1;
    stats.currentStreak += 1;
    if (stats.currentStreak > stats.bestStreak) {
      stats.bestStreak = stats.currentStreak;
    }
  } else if (roundsWon === roundsLost) {
    stats.draws += 1;
    stats.currentStreak = 0;
  } else {
    stats.losses += 1;
    stats.currentStreak = 0;
  }
  
  stats.totalRoundsWon += roundsWon;
  stats.totalRoundsLost += roundsLost;
  stats.averageGuesses = (stats.averageGuesses * (stats.totalGames - 1) + avgGuesses) / stats.totalGames;
  stats.favoriteDifficulty = difficulty;
  
  updatePlayerStats(stats);
  return stats;
}

export function getLeaderboard(): PlayerRecord[] {
  try {
    const stored = localStorage.getItem(LEADERBOARD_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export function updateLeaderboard(playerName: string, stats: GameStats) {
  const leaderboard = getLeaderboard();
  const existing = leaderboard.findIndex((p) => p.name === playerName);
  
  const record: PlayerRecord = { name: playerName, stats, lastUpdated: Date.now() };
  
  if (existing >= 0) {
    leaderboard[existing] = record;
  } else {
    leaderboard.push(record);
  }
  
  leaderboard.sort((a, b) => {
    const aWinRate = a.stats.totalGames > 0 ? a.stats.wins / a.stats.totalGames : 0;
    const bWinRate = b.stats.totalGames > 0 ? b.stats.wins / b.stats.totalGames : 0;
    return bWinRate - aWinRate;
  });
  
  localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(leaderboard.slice(0, 100)));
}

export function getWinRate(): number {
  const stats = getPlayerStats();
  return stats.totalGames > 0 ? (stats.wins / stats.totalGames) * 100 : 0;
}

import type { PlayerProfile, PlaygroundResultPayload } from '../../shared/types.ts';
import { getMiniGameDef } from '../../shared/progression.ts';
import { safeFetchJson } from './apiClient.ts';

export interface PlaygroundSessionInfo {
  sessionId: string;
  gameId: string;
  startedAt: number;
  personalBest: number | null;
  globalRank: number | null;
  totalPlayers: number;
  unavailable?: boolean;
}

export async function startPlaygroundSession(
  gameId: string,
  player: PlayerProfile | null
): Promise<PlaygroundSessionInfo> {
  const res = await safeFetchJson<{
    sessionId: string;
    gameId: string;
    startedAt: number;
    personalBest: number | null;
    globalRank: number | null;
    totalPlayers: number;
  }>('/api/playground/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      gameId,
      userId: player?.id || '',
      username: player?.name,
      className: player?.className,
    }),
  });

  if (res.ok && res.data?.sessionId) {
    return res.data;
  }

  return {
    sessionId: `practice_${gameId}_${Date.now()}`,
    gameId,
    startedAt: Date.now(),
    personalBest: null,
    globalRank: null,
    totalPlayers: 0,
    unavailable: true,
  };
}

export async function submitPlaygroundScore(input: {
  session: PlaygroundSessionInfo | null;
  gameId: string;
  player: PlayerProfile | null;
  score: number;
  rawMetric?: number;
  completionTimeMs: number;
  accuracy: number;
  won?: boolean;
  meta?: Record<string, unknown>;
  onUpdatePlayer?: (next: PlayerProfile | null) => void;
}): Promise<{
  payload: PlaygroundResultPayload;
  rankUnavailable: boolean;
  error?: string;
}> {
  const def = getMiniGameDef(input.gameId as never);
  const fallbackFact =
    def?.funFacts[0] ||
    'Engineering mastery balances precision, responsiveness, and structural margin.';

  if (!input.player || !input.session || input.session.unavailable) {
    return {
      rankUnavailable: true,
      error: !input.player
        ? 'Guest practice run — sign in to save your official leaderboard rank.'
        : 'Leaderboard data unavailable right now.',
      payload: {
        resultId: `local_practice_${Date.now()}`,
        sessionId: input.session?.sessionId || `practice_${Date.now()}`,
        gameId: input.gameId,
        userId: input.player?.id || 'guest',
        username: input.player?.name || 'Guest Engineer',
        score: Math.max(0, Math.round(input.score)),
        rawMetric: input.rawMetric ?? Math.round(input.score),
        completionTimeMs: Math.max(200, Math.round(input.completionTimeMs)),
        accuracy: Math.max(0, Math.min(100, Math.round(input.accuracy * 10) / 10)),
        won: input.won !== false && input.score > 0,
        isPersonalBest: false,
        previousBestScore: input.session?.personalBest ?? null,
        globalRank: null,
        prevGlobalRank: null,
        gameRank: null,
        prevGameRank: null,
        totalGamePlayers: 0,
        xpEarned: 0,
        leveledUp: false,
        unlockedAchievements: [],
        funFact: fallbackFact,
        player: input.player,
        createdAt: new Date().toISOString(),
      },
    };
  }

  const res = await safeFetchJson<PlaygroundResultPayload>('/api/playground/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: input.session.sessionId,
      userId: input.player.id,
      username: input.player.name,
      className: input.player.className,
      gameId: input.gameId,
      score: Math.round(input.score),
      rawMetric: input.rawMetric,
      completionTimeMs: Math.round(input.completionTimeMs),
      accuracy: input.accuracy,
      won: input.won !== false,
      meta: input.meta,
    }),
  });

  if (res.ok && res.data) {
    if (res.data.player && input.onUpdatePlayer) {
      input.onUpdatePlayer(res.data.player);
    }
    return { payload: res.data, rankUnavailable: false };
  }

  return {
    rankUnavailable: true,
    error: res.error || 'Leaderboard data unavailable — score not ranked.',
    payload: {
      resultId: `unranked_${Date.now()}`,
      sessionId: input.session.sessionId,
      gameId: input.gameId,
      userId: input.player.id,
      username: input.player.name,
      score: Math.max(0, Math.round(input.score)),
      rawMetric: input.rawMetric ?? Math.round(input.score),
      completionTimeMs: Math.max(200, Math.round(input.completionTimeMs)),
      accuracy: Math.max(0, Math.min(100, Math.round(input.accuracy * 10) / 10)),
      won: input.won !== false && input.score > 0,
      isPersonalBest: false,
      previousBestScore: input.session.personalBest ?? null,
      globalRank: null,
      prevGlobalRank: null,
      gameRank: null,
      prevGameRank: null,
      totalGamePlayers: 0,
      xpEarned: 0,
      leveledUp: false,
      unlockedAchievements: [],
      funFact: fallbackFact,
      player: input.player,
      createdAt: new Date().toISOString(),
    },
  };
}

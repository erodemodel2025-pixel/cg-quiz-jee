import type { PlayerProfile } from '../../../../shared/types.ts';
import { safeFetchJson } from '../../../utils/apiClient.ts';
import type { SimulatorProgressSummary } from './engineeringTypes.ts';

const SIM_PROGRESS_KEY = 'cgquiz_simulator_progress_v1';

export interface SimulatorSubmissionInput {
  userId: string;
  simulator: 'car' | 'phone';
  missionId: string;
  missionTitle: string;
  score: number;
  accuracy: number;
  componentsExplored: number;
  buildTitle: string;
  detailsSummary: string;
}

export interface SimulatorSubmissionResult {
  savedToLeaderboard: boolean;
  xpEarned: number;
  leveledUp: boolean;
  unlockedAchievements: string[];
  player: PlayerProfile | null;
  progress: SimulatorProgressSummary;
  error?: string;
}

export function loadLocalSimulatorProgress(userId?: string | null): SimulatorProgressSummary {
  const key = userId ? `${SIM_PROGRESS_KEY}_${userId}` : `${SIM_PROGRESS_KEY}_guest`;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      return {
        engineeringXp: 0,
        missionsCompleted: 0,
        componentsExplored: 0,
        engineeringAccuracy: 0,
        totalScore: 0,
      };
    }
    const parsed = JSON.parse(raw) as Partial<SimulatorProgressSummary>;
    return {
      engineeringXp: Number(parsed.engineeringXp ?? 0),
      missionsCompleted: Number(parsed.missionsCompleted ?? 0),
      componentsExplored: Number(parsed.componentsExplored ?? 0),
      engineeringAccuracy: Number(parsed.engineeringAccuracy ?? 0),
      totalScore: Number(parsed.totalScore ?? 0),
    };
  } catch {
    return {
      engineeringXp: 0,
      missionsCompleted: 0,
      componentsExplored: 0,
      engineeringAccuracy: 0,
      totalScore: 0,
    };
  }
}

export function recordExploredComponentLocal(
  userId: string | null | undefined,
  totalExploredUnique: number
): SimulatorProgressSummary {
  const key = userId ? `${SIM_PROGRESS_KEY}_${userId}` : `${SIM_PROGRESS_KEY}_guest`;
  const cur = loadLocalSimulatorProgress(userId);
  const next: SimulatorProgressSummary = {
    ...cur,
    componentsExplored: Math.max(cur.componentsExplored, totalExploredUnique),
    engineeringXp: cur.engineeringXp + (totalExploredUnique > cur.componentsExplored ? 8 : 0),
  };
  try {
    localStorage.setItem(key, JSON.stringify(next));
  } catch {
    // ignore storage quota
  }
  return next;
}

export async function submitSimulatorMissionScore(
  input: SimulatorSubmissionInput,
  isAuthenticated: boolean
): Promise<SimulatorSubmissionResult> {
  const cur = loadLocalSimulatorProgress(isAuthenticated ? input.userId : null);

  if (!isAuthenticated) {
    return {
      savedToLeaderboard: false,
      xpEarned: 0,
      leveledUp: false,
      unlockedAchievements: [],
      player: null,
      progress: cur,
      error: 'Sign in with a registered player account to save engineering scores to the leaderboard.',
    };
  }

  const res = await safeFetchJson<{
    xpEarned: number;
    leveledUp: boolean;
    unlockedAchievements: string[];
    player: PlayerProfile | null;
    progress?: SimulatorProgressSummary;
    error?: string;
  }>('/api/simulator/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  const xpEarned = res.data?.xpEarned ?? Math.max(25, Math.round(input.score * 0.4));
  const nextCount = cur.missionsCompleted + 1;
  const avgAcc = Math.round(
    (cur.engineeringAccuracy * cur.missionsCompleted + input.accuracy) / nextCount
  );
  const nextProgress: SimulatorProgressSummary = res.data?.progress ?? {
    engineeringXp: cur.engineeringXp + xpEarned,
    missionsCompleted: nextCount,
    componentsExplored: Math.max(cur.componentsExplored, input.componentsExplored),
    engineeringAccuracy: avgAcc,
    totalScore: cur.totalScore + input.score,
  };

  try {
    localStorage.setItem(`${SIM_PROGRESS_KEY}_${input.userId}`, JSON.stringify(nextProgress));
  } catch {
    // ignore
  }

  return {
    savedToLeaderboard: res.ok,
    xpEarned,
    leveledUp: Boolean(res.data?.leveledUp),
    unlockedAchievements: res.data?.unlockedAchievements ?? [],
    player: res.data?.player ?? null,
    progress: nextProgress,
    error: res.ok ? undefined : res.error || undefined,
  };
}

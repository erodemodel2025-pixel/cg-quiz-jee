import { PLAYGROUND_MINIGAME_MAP } from './progression.ts';
import type { GameModeId, QuizPlayMode } from './types.ts';

export const TRACK_AND_LAB_GAME_IDS = new Set([
  'car-test-0-100',
  'car-test-slalom',
  'car-test-topspeed',
  'car-test-braking',
  'car-test-drag',
  'phone-test-lab',
]);

export function isValidPlaygroundGameId(gameId: string): boolean {
  if (PLAYGROUND_MINIGAME_MAP.has(gameId as GameModeId)) return true;
  if (TRACK_AND_LAB_GAME_IDS.has(gameId)) return true;
  return [
    'circuit-rush',
    'code-breaker',
    'boss-battle',
    'logic-lab',
    'component-match',
    'iq-quiz',
  ].includes(gameId);
}

export interface ValidationCheckResult {
  valid: boolean;
  reason?: string;
  sanitizedScore: number;
  sanitizedMetric: number;
  sanitizedTimeMs: number;
  sanitizedAccuracy: number;
}

export function validatePlaygroundSubmission(input: {
  gameId: string;
  score: number;
  rawMetric?: number;
  completionTimeMs?: number;
  accuracy?: number;
  startedAt: number;
  nowMs?: number;
}): ValidationCheckResult {
  const nowMs = input.nowMs ?? Date.now();
  const gameId = input.gameId.trim();

  if (!isValidPlaygroundGameId(gameId)) {
    return {
      valid: false,
      reason: `Unknown game identifier: ${gameId}`,
      sanitizedScore: 0,
      sanitizedMetric: 0,
      sanitizedTimeMs: 0,
      sanitizedAccuracy: 0,
    };
  }

  const score = Math.round(Number(input.score));
  const rawMetric = Number(input.rawMetric ?? score);
  const accuracy = Math.max(0, Math.min(100, Math.round(Number(input.accuracy ?? 100) * 10) / 10));
  const clientMs = Math.round(Number(input.completionTimeMs ?? nowMs - input.startedAt));
  const serverElapsedMs = Math.max(0, nowMs - input.startedAt);
  const effectiveTimeMs = Math.max(200, Math.min(3600000, clientMs > 0 ? clientMs : serverElapsedMs));

  if (!Number.isFinite(score) || score < 0) {
    return {
      valid: false,
      reason: 'Invalid negative or non-finite score rejected.',
      sanitizedScore: 0,
      sanitizedMetric: 0,
      sanitizedTimeMs: effectiveTimeMs,
      sanitizedAccuracy: accuracy,
    };
  }

  const def = PLAYGROUND_MINIGAME_MAP.get(gameId as GameModeId);
  const maxScore = def ? def.maxValidScore : 4000;
  const minMs = def ? Math.max(1200, def.minValidSeconds * 1000 - 400) : 1200;

  if (score > maxScore) {
    return {
      valid: false,
      reason: `Score ${score} exceeds verified ceiling (${maxScore}) for ${gameId}.`,
      sanitizedScore: 0,
      sanitizedMetric: rawMetric,
      sanitizedTimeMs: effectiveTimeMs,
      sanitizedAccuracy: accuracy,
    };
  }

  // Server clock check: reject instant impossible finishes (allowing test/session clock tolerance)
  if (serverElapsedMs < minMs && effectiveTimeMs < minMs) {
    return {
      valid: false,
      reason: `Completion time too short for ${gameId} (${effectiveTimeMs}ms < ${minMs}ms realistic minimum).`,
      sanitizedScore: 0,
      sanitizedMetric: rawMetric,
      sanitizedTimeMs: effectiveTimeMs,
      sanitizedAccuracy: accuracy,
    };
  }

  // Specific physical bounds checks
  if (gameId === 'reaction-test') {
    if (Number.isFinite(rawMetric) && rawMetric > 0 && rawMetric < 120) {
      return {
        valid: false,
        reason: 'Reaction time under 120ms rejected as physically implausible.',
        sanitizedScore: 0,
        sanitizedMetric: rawMetric,
        sanitizedTimeMs: effectiveTimeMs,
        sanitizedAccuracy: accuracy,
      };
    }
  }

  if (gameId === 'car-test-0-100') {
    // rawMetric is 0-100 time in seconds
    if (rawMetric > 0 && (rawMetric < 1.6 || rawMetric > 45)) {
      return {
        valid: false,
        reason: 'Simulated 0-100 km/h telemetry outside valid physics envelope (1.6s-45s).',
        sanitizedScore: 0,
        sanitizedMetric: rawMetric,
        sanitizedTimeMs: effectiveTimeMs,
        sanitizedAccuracy: accuracy,
      };
    }
  }

  if (gameId === 'car-test-topspeed') {
    if (rawMetric > 460 || rawMetric < 30) {
      return {
        valid: false,
        reason: 'Simulated top speed outside valid vehicle envelope (30-460 km/h).',
        sanitizedScore: 0,
        sanitizedMetric: rawMetric,
        sanitizedTimeMs: effectiveTimeMs,
        sanitizedAccuracy: accuracy,
      };
    }
  }

  return {
    valid: true,
    sanitizedScore: score,
    sanitizedMetric: Number.isFinite(rawMetric) ? rawMetric : score,
    sanitizedTimeMs: effectiveTimeMs,
    sanitizedAccuracy: accuracy,
  };
}

export function computeQuizModeBonus(input: {
  playMode?: QuizPlayMode | string;
  correctAnswers: number;
  totalQuestions: number;
  maxStreak: number;
  completionTime: number;
  marksPerCorrect: number;
}): {
  baseScore: number;
  comboBonus: number;
  speedBonus: number;
  accuracyBonus: number;
  totalScore: number;
} {
  const baseScore = input.correctAnswers * input.marksPerCorrect;
  const mode = (input.playMode || 'normal') as QuizPlayMode;

  // Preserve exact deterministic score when mode is standard 'normal'
  if (mode === 'normal') {
    return {
      baseScore,
      comboBonus: 0,
      speedBonus: 0,
      accuracyBonus: 0,
      totalScore: baseScore,
    };
  }

  const comboBonus = Math.max(0, input.maxStreak - 1) * Math.round(input.marksPerCorrect * 0.4);
  const targetSec = mode === 'speed-round' ? 30 : Math.max(30, input.totalQuestions * 12);
  const speedBonus =
    input.correctAnswers > 0 && input.completionTime < targetSec
      ? Math.round(((targetSec - input.completionTime) / targetSec) * input.marksPerCorrect * 2)
      : 0;
  const accuracy = input.totalQuestions > 0 ? (input.correctAnswers / input.totalQuestions) * 100 : 0;
  const accuracyBonus = accuracy >= 90 ? input.marksPerCorrect * 2 : accuracy >= 75 ? input.marksPerCorrect : 0;

  return {
    baseScore,
    comboBonus,
    speedBonus,
    accuracyBonus,
    totalScore: baseScore + comboBonus + speedBonus + accuracyBonus,
  };
}

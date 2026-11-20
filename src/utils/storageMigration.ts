import type {
  AnalyticsSummary,
  ExamQuestion,
  ExamResultSummary,
  ExamSettings,
  ExamUserAnswer,
  MistakeRecord,
  PublicExamQuestion,
} from '../../shared/types.ts';

const SCHEMA_VERSION_KEY = 'cgquiz_storage_version';
const GUEST_ID_KEY = 'cgquiz_guest_id';
const OFFLINE_CACHE_KEY = 'cgquiz_offline_cache_v2';
const ACTIVE_SESSION_KEY = 'cgquiz_active_quiz_draft_v2';

export interface ActiveQuizDraft {
  mode: ExamSettings['mode'];
  settings: ExamSettings;
  sessionId: string;
  questions: PublicExamQuestion[];
  currentIndex: number;
  answers: Record<string, ExamUserAnswer>;
  markedReview: string[];
  timeLeftSeconds: number;
  savedAt: string;
}

export interface OfflineCacheV2 {
  questions: ExamQuestion[];
  mistakes: MistakeRecord[];
  bookmarks: string[];
  analytics: AnalyticsSummary | null;
  historyResults: Record<string, ExamResultSummary>;
  updatedAt: string;
}

const DEFAULT_CACHE: OfflineCacheV2 = {
  questions: [],
  mistakes: [],
  bookmarks: [],
  analytics: null,
  historyResults: {},
  updatedAt: new Date().toISOString(),
};

/**
 * Safely migrates v1 localStorage keys (cgquiz_participant, cgquiz_arcade_player,
 * cgquiz_audio_prefs, cgquiz_reduced_motion) to v2 without deleting or corrupting user data.
 */
export function runSafeStorageMigration(): void {
  if (typeof window === 'undefined') return;
  try {
    const version = Number(localStorage.getItem(SCHEMA_VERSION_KEY) || '1');
    if (version < 2) {
      // Ensure guest ID exists for instant persistence of mistakes/bookmarks/analytics
      if (!localStorage.getItem(GUEST_ID_KEY)) {
        const legacyRaw = localStorage.getItem('cgquiz_participant');
        const playerRaw = localStorage.getItem('cgquiz_arcade_player');
        let resolvedId = `guest_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        if (playerRaw) {
          const parsed = JSON.parse(playerRaw) as { id?: string };
          if (parsed?.id) resolvedId = parsed.id;
        } else if (legacyRaw) {
          const parsed = JSON.parse(legacyRaw) as { id?: string };
          if (parsed?.id) resolvedId = parsed.id;
        }
        localStorage.setItem(GUEST_ID_KEY, resolvedId);
      }

      if (!localStorage.getItem(OFFLINE_CACHE_KEY)) {
        localStorage.setItem(OFFLINE_CACHE_KEY, JSON.stringify(DEFAULT_CACHE));
      }

      if (!localStorage.getItem('cgquiz_ui_theme')) {
        localStorage.setItem('cgquiz_ui_theme', 'dark');
      }

      localStorage.setItem(SCHEMA_VERSION_KEY, '2');
    }
  } catch {
    // Non-fatal fallback
  }
}

export function getOrCreateGuestUserId(): string {
  runSafeStorageMigration();
  try {
    const existing = localStorage.getItem(GUEST_ID_KEY);
    if (existing) return existing;
    const created = `guest_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    localStorage.setItem(GUEST_ID_KEY, created);
    return created;
  } catch {
    return 'guest_session';
  }
}

export function readOfflineCache(): OfflineCacheV2 {
  try {
    const raw = localStorage.getItem(OFFLINE_CACHE_KEY);
    if (!raw) return DEFAULT_CACHE;
    const parsed = JSON.parse(raw) as Partial<OfflineCacheV2>;
    return {
      questions: Array.isArray(parsed.questions) ? parsed.questions : [],
      mistakes: Array.isArray(parsed.mistakes) ? parsed.mistakes : [],
      bookmarks: Array.isArray(parsed.bookmarks) ? parsed.bookmarks : [],
      analytics: parsed.analytics ?? null,
      historyResults: parsed.historyResults ?? {},
      updatedAt: parsed.updatedAt || new Date().toISOString(),
    };
  } catch {
    return DEFAULT_CACHE;
  }
}

export function updateOfflineCache(patch: Partial<OfflineCacheV2>): void {
  try {
    const curr = readOfflineCache();
    const next: OfflineCacheV2 = {
      ...curr,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(OFFLINE_CACHE_KEY, JSON.stringify(next));
  } catch {
    // ignore storage quota overflow
  }
}

export function saveActiveQuizDraft(draft: ActiveQuizDraft | null): void {
  try {
    if (!draft) {
      localStorage.removeItem(ACTIVE_SESSION_KEY);
      return;
    }
    localStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(draft));
  } catch {
    // ignore
  }
}

export function loadActiveQuizDraft(): ActiveQuizDraft | null {
  try {
    const raw = localStorage.getItem(ACTIVE_SESSION_KEY) || localStorage.getItem('jeejarvis-quiz-progress');
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ActiveQuizDraft;
    if (!parsed?.sessionId || !parsed?.settings) return null;
    return parsed;
  } catch {
    return null;
  }
}

export const JEEJARVIS_HISTORY_KEY = 'jeejarvis-quiz-history';
export const JEEJARVIS_PROGRESS_KEY = 'jeejarvis-quiz-progress';
export const JEEJARVIS_STATS_KEY = 'jeejarvis-quiz-stats';

export interface QuizHistoryEntry {
  attemptId: string;
  mode: ExamSettings['mode'];
  subject: string;
  categoryId: string;
  score: number;
  maxScore: number;
  accuracy: number;
  totalQuestions: number;
  timeSpentSeconds: number;
  questionIds: string[];
  createdAt: string;
  summary: ExamResultSummary;
}

export interface QuizAggregateStats {
  totalQuizzes: number;
  totalQuestions: number;
  totalCorrect: number;
  bestAccuracy: number;
  weakTopics: string[];
  updatedAt: string;
}

export function loadQuizHistory(): QuizHistoryEntry[] {
  try {
    const raw = localStorage.getItem(JEEJARVIS_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as QuizHistoryEntry[]) : [];
  } catch {
    return [];
  }
}

export function getRecentlySeenQuestionIds(limit = 60): string[] {
  const history = loadQuizHistory();
  const seen: string[] = [];
  const added = new Set<string>();
  for (const h of history) {
    for (const qId of h.questionIds || []) {
      if (!added.has(qId)) {
        added.add(qId);
        seen.push(qId);
      }
      if (seen.length >= limit) return seen;
    }
  }
  return seen;
}

export function loadQuizStats(): QuizAggregateStats {
  try {
    const raw = localStorage.getItem(JEEJARVIS_STATS_KEY);
    if (raw) return JSON.parse(raw) as QuizAggregateStats;
  } catch {
    // ignore
  }
  return {
    totalQuizzes: 0,
    totalQuestions: 0,
    totalCorrect: 0,
    bestAccuracy: 0,
    weakTopics: [],
    updatedAt: new Date().toISOString(),
  };
}

export function recordQuizHistory(
  summary: ExamResultSummary,
  subject: string,
  categoryId: string
): void {
  try {
    const prev = loadQuizHistory().filter((h) => h.attemptId !== summary.attemptId);
    const entry: QuizHistoryEntry = {
      attemptId: summary.attemptId,
      mode: summary.mode,
      subject,
      categoryId,
      score: summary.score,
      maxScore: summary.maxScore,
      accuracy: summary.accuracy,
      totalQuestions: summary.totalQuestions,
      timeSpentSeconds: summary.timeSpentSeconds,
      questionIds: summary.details.map((d) => d.questionId),
      createdAt: summary.createdAt,
      summary,
    };
    const nextHistory = [entry, ...prev].slice(0, 25);
    localStorage.setItem(JEEJARVIS_HISTORY_KEY, JSON.stringify(nextHistory));

    const prevStats = loadQuizStats();
    const weakTopics = summary.topicBreakdown
      .filter((t) => t.attempted > 0 && t.accuracy < 65)
      .map((t) => t.topic);
    const nextStats: QuizAggregateStats = {
      totalQuizzes: prevStats.totalQuizzes + 1,
      totalQuestions: prevStats.totalQuestions + summary.totalQuestions,
      totalCorrect: prevStats.totalCorrect + summary.correctCount,
      bestAccuracy: Math.max(prevStats.bestAccuracy, summary.accuracy),
      weakTopics: [...new Set([...weakTopics, ...prevStats.weakTopics])].slice(0, 8),
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(JEEJARVIS_STATS_KEY, JSON.stringify(nextStats));

    // Also store in offline historyResults cache so clickable history works cleanly
    updateOfflineCache({
      historyResults: {
        ...readOfflineCache().historyResults,
        [summary.attemptId]: summary,
      },
    });
  } catch {
    // ignore quota issues
  }
}

export function syncProgressToJeejarvisKey(draft: ActiveQuizDraft | null): void {
  saveActiveQuizDraft(draft);
  try {
    if (!draft) {
      localStorage.removeItem(JEEJARVIS_PROGRESS_KEY);
    } else {
      localStorage.setItem(JEEJARVIS_PROGRESS_KEY, JSON.stringify(draft));
    }
  } catch {
    // ignore
  }
}


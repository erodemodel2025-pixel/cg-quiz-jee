import { ENGINEERING_CATEGORIES, EXAM_CATEGORIES } from '../../shared/categories.ts';
import { getAllBuiltinExamQuestions } from '../../shared/examQuestions.ts';
import {
  CIRCUIT_STAGES,
  CODE_PUZZLES,
  COMPONENT_CARDS,
  LOGIC_PUZZLES,
} from '../../shared/minigameData.ts';
import {
  computeQuizModeBonus,
  isValidPlaygroundGameId,
  TRACK_AND_LAB_GAME_IDS,
  validatePlaygroundSubmission,
} from '../../shared/playgroundValidation.ts';
import {
  ACHIEVEMENTS,
  computeExamLevel,
  computeLevelFromXp,
  getDailyChallengeForDate,
  getDailyTripleForDate,
  getMiniGameDef,
  getUnlockedThemesForLevel,
  getWeeklyEventForDate,
  PLAYGROUND_MINIGAME_MAP,
} from '../../shared/progression.ts';
import { QUESTION_BANK } from '../../shared/questionBank.ts';
import {
  getModeScoringRules,
  selectBalancedQuizQuestions,
} from '../../shared/quizPipeline.ts';
import {
  DIFFICULTY_MAP,
  GAME_CATEGORIES,
  GAME_DIFFICULTY_CONFIGS,
  SMART_QUESTION_BANK,
  selectSmartGameQuestions,
} from '../../shared/smartQuestionBank.ts';
import type {
  ClassOption,
  ExamAnswerItem,
  ExamDifficulty,
  ExamEvaluatedDetail,
  ExamMode,
  ExamQuestion,
  ExamResultSummary,
  ExamSettings,
  ExamUserAnswer,
  GameDifficultyId,
  GameEvaluatedItem,
  GameLeaderboardEntry,
  GameLeaderboardView,
  GameModeId,
  GameResultPayload,
  LeaderboardTimeframe,
  PixelThemeId,
  PlayerProfile,
  PlaygroundLeaderboardEntry,
  PlaygroundResultPayload,
  QuizPlayMode,
  SmartGameQuestion,
  SpeedClass,
  TopicStat,
} from '../../shared/types.ts';

interface PagesContext {
  request: Request;
  env?: Record<string, unknown>;
}

const ALL_EXAM_QUESTIONS = getAllBuiltinExamQuestions();
const EXAM_QUESTION_MAP = new Map(ALL_EXAM_QUESTIONS.map((q) => [q.id, q]));
const LEGACY_QUESTION_MAP = new Map(QUESTION_BANK.map((q) => [q.id, q]));
const SMART_QUESTION_MAP = new Map(SMART_QUESTION_BANK.map((q) => [q.id, q]));
const CODE_PUZZLE_MAP = new Map(CODE_PUZZLES.map((p) => [p.id, p]));
const LOGIC_PUZZLE_MAP = new Map(LOGIC_PUZZLES.map((p) => [p.id, p]));

const VALID_GAME_DIFFICULTIES = new Set<GameDifficultyId>(['easy', 'moderate', 'hard', 'jee']);

interface EdgeGameSession {
  sessionId: string;
  userId: string;
  username: string;
  difficulty: GameDifficultyId;
  category: string;
  playMode?: QuizPlayMode;
  questions: SmartGameQuestion[];
  startedAt: number;
  expiresAt: number;
  status: 'active' | 'completed';
  isTest: boolean;
}

interface EdgeGameResultRecord {
  resultId: string;
  sessionId: string;
  userId: string;
  username: string;
  className: string;
  title: string;
  score: number;
  correctAnswers: number;
  incorrectAnswers: number;
  unanswered: number;
  totalQuestions: number;
  accuracy: number;
  completionTime: number;
  difficulty: GameDifficultyId;
  category: string;
  xpEarned: number;
  details: GameEvaluatedItem[];
  isTest: boolean;
  createdAt: string;
}

const EDGE_PLAYERS = new Map<string, PlayerProfile>();
const EDGE_PLAYER_BY_NAME = new Map<string, string>();
const EDGE_SESSIONS = new Map<string, EdgeGameSession>();
const EDGE_GAME_RESULTS: EdgeGameResultRecord[] = [];
const EDGE_RESULT_BY_SESSION = new Map<string, GameResultPayload>();

interface EdgeSimulatorResultRecord {
  userId: string;
  username: string;
  className: string;
  title: string;
  simulator: 'car' | 'phone';
  missionId: string;
  missionTitle: string;
  score: number;
  accuracy: number;
  componentsExplored: number;
  xpEarned: number;
  isTest: boolean;
  createdAt: string;
}
const EDGE_SIMULATOR_RESULTS: EdgeSimulatorResultRecord[] = [];

interface EdgePlaygroundSession {
  sessionId: string;
  userId: string;
  gameId: string;
  startedAt: number;
  status: 'active' | 'completed';
  isTest: boolean;
}

interface EdgePlaygroundResult {
  resultId: string;
  sessionId: string;
  userId: string;
  username: string;
  className: string;
  title: string;
  level: number;
  xp: number;
  streakBest: number;
  gameId: string;
  score: number;
  rawMetric: number;
  completionTimeMs: number;
  accuracy: number;
  won: boolean;
  xpEarned: number;
  isTest: boolean;
  createdAt: string;
}

const EDGE_PG_SESSIONS = new Map<string, EdgePlaygroundSession>();
const EDGE_PG_RESULTS: EdgePlaygroundResult[] = [];
const EDGE_DAILY_TRIPLE_CLAIMS = new Set<string>();

function queryEdgePlaygroundLeaderboard(params: {
  gameId: string;
  timeframe: LeaderboardTimeframe;
  search?: string;
  userId?: string;
  includeTest?: boolean;
}) {
  const gameId = params.gameId || 'all';
  const timeframe = params.timeframe || 'global';
  const search = (params.search || '').trim().toLowerCase();
  const userId = (params.userId || '').trim();
  const now = Date.now();
  const todayPrefix = new Date(now).toISOString().slice(0, 10);
  const weekCutoff = new Date(now - 7 * 86400000).toISOString();
  const monthCutoff = new Date(now - 30 * 86400000).toISOString();

  const filtered = EDGE_PG_RESULTS.filter((r) => {
    if (!params.includeTest && r.isTest) return false;
    if (gameId !== 'all' && r.gameId !== gameId) return false;
    if (timeframe === 'daily' && !r.createdAt.startsWith(todayPrefix)) return false;
    if (timeframe === 'weekly' && r.createdAt < weekCutoff) return false;
    if (timeframe === 'monthly' && r.createdAt < monthCutoff) return false;
    return true;
  });

  const byUser = new Map<
    string,
    {
      latest: EdgePlaygroundResult;
      bestScore: number;
      totalPoints: number;
      gamesPlayed: number;
      wins: number;
      accSum: number;
      bestTimeMs: number;
    }
  >();

  for (const r of filtered) {
    const cur = byUser.get(r.userId);
    if (!cur) {
      byUser.set(r.userId, {
        latest: r,
        bestScore: r.score,
        totalPoints: r.score,
        gamesPlayed: 1,
        wins: r.won ? 1 : 0,
        accSum: r.accuracy,
        bestTimeMs: r.completionTimeMs,
      });
    } else {
      cur.bestScore = Math.max(cur.bestScore, r.score);
      cur.totalPoints += r.score;
      cur.gamesPlayed += 1;
      cur.wins += r.won ? 1 : 0;
      cur.accSum += r.accuracy;
      cur.bestTimeMs = Math.min(cur.bestTimeMs, r.completionTimeMs);
      if (r.createdAt > cur.latest.createdAt) cur.latest = r;
    }
  }

  const rankedAll: PlaygroundLeaderboardEntry[] = [...byUser.values()]
    .sort((a, b) =>
      gameId === 'all'
        ? b.totalPoints - a.totalPoints || b.bestScore - a.bestScore
        : b.bestScore - a.bestScore || a.bestTimeMs - b.bestTimeMs
    )
    .map((x, idx) => ({
      rank: idx + 1,
      prevRank: null,
      rankDelta: 0,
      userId: x.latest.userId,
      username: x.latest.username,
      className: x.latest.className,
      title: x.latest.title,
      level: x.latest.level,
      xp: x.latest.xp,
      score: gameId === 'all' ? x.totalPoints : x.bestScore,
      bestScore: x.bestScore,
      totalPoints: x.totalPoints,
      gamesPlayed: x.gamesPlayed,
      winRate: Math.round((x.wins / x.gamesPlayed) * 1000) / 10,
      streak: x.latest.streakBest,
      accuracy: Math.round((x.accSum / x.gamesPlayed) * 10) / 10,
      completionTimeMs: x.bestTimeMs,
      gameId: x.latest.gameId,
      createdAt: x.latest.createdAt,
    }));

  const currentUserEntry = userId ? rankedAll.find((e) => e.userId === userId) || null : null;
  const entries = search ? rankedAll.filter((e) => e.username.toLowerCase().includes(search)) : rankedAll;
  return {
    gameId,
    timeframe,
    totalPlayers: rankedAll.length,
    top3: rankedAll.slice(0, 3),
    entries: entries.slice(0, 100),
    currentUserEntry,
  };
}

function normalizeGameDifficulty(raw: unknown): GameDifficultyId | null {
  const val = String(raw ?? '').trim().toLowerCase();
  return VALID_GAME_DIFFICULTIES.has(val as GameDifficultyId) ? (val as GameDifficultyId) : null;
}

function sanitizeSmartQuestion(q: SmartGameQuestion) {
  const { correctIndex: _c, explanation: _e, ...rest } = q;
  return rest;
}

function getOrHydrateEdgePlayer(
  userId: string,
  fallbackName?: string,
  fallbackClass?: string
): PlayerProfile | null {
  const existing = EDGE_PLAYERS.get(userId);
  if (existing) return existing;
  if (!userId || (!userId.startsWith('p_') && !fallbackName)) return null;
  const name = (fallbackName || 'Engineer').trim() || 'Engineer';
  const className = (fallbackClass || 'Class 12').trim() as ClassOption;
  const hydrated: PlayerProfile = {
    id: userId,
    name,
    className,
    xp: 0,
    level: 1,
    title: 'Circuit Rookie',
    streakBest: 0,
    gamesPlayed: 0,
    activeTheme: 'cyber-midnight',
    unlockedThemes: ['cyber-midnight'],
    achievements: [],
    createdAt: new Date().toISOString(),
  };
  EDGE_PLAYERS.set(userId, hydrated);
  EDGE_PLAYER_BY_NAME.set(name.toLowerCase(), userId);
  return hydrated;
}

function updateEdgePlayerProgression(params: {
  player: PlayerProfile;
  xpEarned: number;
  maxStreak: number;
  newAchievements: string[];
}) {
  const p = params.player;
  const prevLevel = p.level;
  const unlockedNow: string[] = [];
  let bonusXp = 0;

  for (const achId of params.newAchievements) {
    if (!p.achievements.includes(achId)) {
      p.achievements.push(achId);
      unlockedNow.push(achId);
      const def = ACHIEVEMENTS.find((a) => a.id === achId);
      if (def) bonusXp += def.xpBonus;
    }
  }

  p.xp += params.xpEarned + bonusXp;
  p.gamesPlayed += 1;
  p.streakBest = Math.max(p.streakBest, params.maxStreak);
  const lvl = computeLevelFromXp(p.xp);
  p.level = lvl.level;
  p.title = lvl.title;
  p.unlockedThemes = getUnlockedThemesForLevel(lvl.level);
  EDGE_PLAYERS.set(p.id, p);

  return {
    player: { ...p },
    leveledUp: lvl.level > prevLevel,
    unlockedAchievements: unlockedNow,
  };
}

function queryEdgeGameLeaderboard(params: {
  view: GameLeaderboardView;
  difficulty?: string;
  category?: string;
  search?: string;
  userId?: string;
  includeTest?: boolean;
}) {
  const view: GameLeaderboardView = params.view === 'overall' ? 'overall' : 'highest';
  const difficulty = (params.difficulty || 'all').toLowerCase();
  const category = (params.category || 'all').toLowerCase();
  const search = (params.search || '').trim().toLowerCase();
  const userId = (params.userId || '').trim();

  const filtered = EDGE_GAME_RESULTS.filter((r) => {
    if (!params.includeTest && r.isTest) return false;
    if (difficulty !== 'all' && VALID_GAME_DIFFICULTIES.has(difficulty as GameDifficultyId) && r.difficulty !== difficulty) {
      return false;
    }
    if (category !== 'all' && r.category !== category) return false;
    return true;
  });

  let rankedAll: GameLeaderboardEntry[] = [];

  if (view === 'highest') {
    const byUser = new Map<string, { best: EdgeGameResultRecord; totalPoints: number; gamesPlayed: number }>();
    for (const r of filtered) {
      const existing = byUser.get(r.userId);
      if (!existing) {
        byUser.set(r.userId, { best: r, totalPoints: r.score, gamesPlayed: 1 });
      } else {
        existing.totalPoints += r.score;
        existing.gamesPlayed += 1;
        const b = existing.best;
        const isBetter =
          r.score > b.score ||
          (r.score === b.score && r.accuracy > b.accuracy) ||
          (r.score === b.score && r.accuracy === b.accuracy && r.completionTime < b.completionTime);
        if (isBetter) existing.best = r;
      }
    }

    const sorted = [...byUser.values()].sort(
      (a, b) =>
        b.best.score - a.best.score ||
        b.best.accuracy - a.best.accuracy ||
        a.best.completionTime - b.best.completionTime ||
        a.best.createdAt.localeCompare(b.best.createdAt)
    );

    rankedAll = sorted.map((item, idx) => ({
      rank: idx + 1,
      userId: item.best.userId,
      username: item.best.username,
      className: item.best.className,
      title: item.best.title,
      score: item.best.score,
      bestScore: item.best.score,
      totalPoints: item.totalPoints,
      gamesPlayed: item.gamesPlayed,
      accuracy: item.best.accuracy,
      completionTime: item.best.completionTime,
      difficulty: item.best.difficulty,
      category: item.best.category,
      createdAt: item.best.createdAt,
    }));
  } else {
    const byUser = new Map<string, { latest: EdgeGameResultRecord; totalPoints: number; bestScore: number; gamesPlayed: number; accSum: number; timeSum: number }>();
    for (const r of filtered) {
      const existing = byUser.get(r.userId);
      if (!existing) {
        byUser.set(r.userId, {
          latest: r,
          totalPoints: r.score,
          bestScore: r.score,
          gamesPlayed: 1,
          accSum: r.accuracy,
          timeSum: r.completionTime,
        });
      } else {
        existing.totalPoints += r.score;
        existing.bestScore = Math.max(existing.bestScore, r.score);
        existing.gamesPlayed += 1;
        existing.accSum += r.accuracy;
        existing.timeSum += r.completionTime;
        if (r.createdAt > existing.latest.createdAt) existing.latest = r;
      }
    }

    const sorted = [...byUser.values()].sort(
      (a, b) =>
        b.totalPoints - a.totalPoints ||
        b.accSum / b.gamesPlayed - a.accSum / a.gamesPlayed ||
        b.gamesPlayed - a.gamesPlayed ||
        a.timeSum / a.gamesPlayed - b.timeSum / b.gamesPlayed
    );

    rankedAll = sorted.map((item, idx) => ({
      rank: idx + 1,
      userId: item.latest.userId,
      username: item.latest.username,
      className: item.latest.className,
      title: item.latest.title,
      score: item.totalPoints,
      bestScore: item.bestScore,
      totalPoints: item.totalPoints,
      gamesPlayed: item.gamesPlayed,
      accuracy: Math.round((item.accSum / item.gamesPlayed) * 10) / 10,
      completionTime: Math.round(item.timeSum / item.gamesPlayed),
      difficulty: item.latest.difficulty,
      category: item.latest.category,
      createdAt: item.latest.createdAt,
    }));
  }

  const currentUserEntry = userId ? rankedAll.find((e) => e.userId === userId) || null : null;
  const top3 = rankedAll.slice(0, 3);
  const filteredEntries = search ? rankedAll.filter((e) => e.username.toLowerCase().includes(search)) : rankedAll;
  const rankingMethodDescription =
    view === 'highest'
      ? 'Ranked by each player’s single highest verified game score (ties broken by accuracy, then faster completion time).'
      : 'Ranked by cumulative total points earned across all completed games (ties broken by average accuracy, then games played).';

  return {
    view,
    rankingMethodDescription,
    totalPlayers: rankedAll.length,
    top3,
    entries: filteredEntries.slice(0, 100),
    currentUserEntry,
  };
}

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-CGQUIZ-DEV',
  Allow: 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Content-Type': 'application/json; charset=utf-8',
};

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: CORS_HEADERS });
}

function hashSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function seededShuffle<T>(arr: readonly T[], seedStr: string): T[] {
  const copy = [...arr];
  let s = hashSeed(seedStr) || 1;
  for (let i = copy.length - 1; i > 0; i--) {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    const j = s % (i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function shuffleQuestionDeterministically(q: ExamQuestion, sessionSeed: string): ExamQuestion {
  const seed = `${sessionSeed}:${q.id}`;
  if (q.questionType === 'integer' || q.questionType === 'truefalse' || q.questionType === 'assertion_reason') {
    return { ...q, options: [...q.options] };
  }
  if (q.questionType === 'match' && q.matchPairs) {
    const perm = seededShuffle(
      Array.from({ length: q.matchPairs.right.length }, (_, i) => i),
      seed
    );
    const oldToNew = new Map<number, number>();
    perm.forEach((oldIdx, newIdx) => oldToNew.set(oldIdx, newIdx));
    const prevAnswer = Array.isArray(q.answer) ? q.answer.map(Number) : [];
    return {
      ...q,
      options: [],
      matchPairs: {
        left: [...q.matchPairs.left],
        right: perm.map((oldIdx) => q.matchPairs!.right[oldIdx]),
      },
      answer: prevAnswer.map((oldIdx) => oldToNew.get(oldIdx) ?? oldIdx),
    };
  }
  if (q.options.length < 2) return { ...q, options: [...q.options] };

  const perm = seededShuffle(
    Array.from({ length: q.options.length }, (_, i) => i),
    seed
  );
  const oldToNew = new Map<number, number>();
  perm.forEach((oldIdx, newIdx) => oldToNew.set(oldIdx, newIdx));
  const newOptions = perm.map((oldIdx) => q.options[oldIdx]);

  if (q.questionType === 'multiple' && Array.isArray(q.answer)) {
    return {
      ...q,
      options: newOptions,
      answer: q.answer.map((i) => oldToNew.get(Number(i)) ?? Number(i)).sort((a, b) => a - b),
    };
  }
  return {
    ...q,
    options: newOptions,
    answer: oldToNew.get(Number(q.answer)) ?? Number(q.answer),
  };
}

function sanitizeQuestion(q: ExamQuestion) {
  const { answer: _a, explanation: _e, ...rest } = q;
  return rest;
}

function isAnswerSkipped(q: ExamQuestion, ans: ExamUserAnswer): boolean {
  if (ans === null || ans === undefined) return true;
  if (q.questionType === 'multiple') return !Array.isArray(ans) || ans.length === 0;
  if (q.questionType === 'match') return !Array.isArray(ans) || ans.some((v) => v < 0);
  if (q.questionType === 'integer') return String(ans).trim() === '';
  return Number(ans) < 0 || Number.isNaN(Number(ans));
}

function evaluateAnswer(q: ExamQuestion, ans: ExamUserAnswer): boolean {
  if (isAnswerSkipped(q, ans)) return false;
  if (q.questionType === 'multiple') {
    const exp = Array.isArray(q.answer) ? [...q.answer].map(Number).sort((a, b) => a - b) : [];
    const act = Array.isArray(ans) ? [...new Set(ans.map(Number))].sort((a, b) => a - b) : [];
    return exp.length === act.length && exp.every((v, i) => v === act[i]);
  }
  if (q.questionType === 'match') {
    const exp = Array.isArray(q.answer) ? q.answer.map(Number) : [];
    const act = Array.isArray(ans) ? ans.map(Number) : [];
    return exp.length === act.length && exp.every((v, i) => v === act[i]);
  }
  if (q.questionType === 'integer') {
    const expStr = String(q.answer).trim();
    const actStr = String(ans).trim();
    const expNum = Number(expStr);
    const actNum = Number(actStr);
    if (!Number.isNaN(expNum) && !Number.isNaN(actNum)) return Math.abs(expNum - actNum) < 0.001;
    return expStr.toLowerCase() === actStr.toLowerCase();
  }
  return Number(ans) === Number(q.answer);
}

function classifySpeed(isCorrect: boolean, isSkipped: boolean, timeMs: number, difficulty: ExamDifficulty): SpeedClass {
  if (isSkipped) return 'SKIPPED';
  const threshold = difficulty === 'Hard' || difficulty === 'Expert' ? 25000 : 14000;
  const fast = timeMs <= threshold;
  if (isCorrect) return fast ? 'FAST+CORRECT' : 'SLOW+CORRECT';
  return fast ? 'FAST+WRONG' : 'SLOW+WRONG';
}

async function parseJsonBody(request: Request): Promise<Record<string, unknown>> {
  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export async function onRequest(context: PagesContext): Promise<Response> {
  const { request } = context;
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method.toUpperCase();

  try {
    if (path === '/api/health' && method === 'GET') {
      return jsonResponse({ ok: true, service: 'cg-quiz-edge', timestamp: new Date().toISOString() });
    }

    if (path === '/api/stats' && method === 'GET') {
      return jsonResponse({
        categories: ENGINEERING_CATEGORIES.length,
        questions: ALL_EXAM_QUESTIONS.length,
        players: 0,
        runsCleared: 0,
      });
    }

    if (path === '/api/daily-challenge' && method === 'GET') {
      const today = new Date().toISOString().slice(0, 10);
      return jsonResponse({ dailyChallenge: getDailyChallengeForDate(today, false) });
    }

    if (path === '/api/exam/categories' && method === 'GET') {
      const subjects = [...new Set(ALL_EXAM_QUESTIONS.map((q) => q.subject))].sort();
      const chaptersBySubject: Record<string, string[]> = {};
      const countByCategory: Record<string, number> = {};
      const diffByCategory: Record<string, Record<string, number>> = {};

      for (const q of ALL_EXAM_QUESTIONS) {
        countByCategory[q.categoryId] = (countByCategory[q.categoryId] || 0) + 1;
        if (!diffByCategory[q.categoryId]) {
          diffByCategory[q.categoryId] = { Easy: 0, Medium: 0, Hard: 0, Expert: 0 };
        }
        diffByCategory[q.categoryId][q.difficulty] = (diffByCategory[q.categoryId][q.difficulty] || 0) + 1;
        if (!chaptersBySubject[q.subject]) chaptersBySubject[q.subject] = [];
        if (!chaptersBySubject[q.subject].includes(q.chapter)) chaptersBySubject[q.subject].push(q.chapter);
      }
      for (const k of Object.keys(chaptersBySubject)) chaptersBySubject[k].sort();

      return jsonResponse({
        categories: EXAM_CATEGORIES.map((c) => ({
          ...c,
          questionCount: countByCategory[c.id] || 0,
          difficultyCounts: diffByCategory[c.id] || { Easy: 0, Medium: 0, Hard: 0, Expert: 0 },
        })),
        subjects,
        chaptersBySubject,
        totalVerifiedQuestions: ALL_EXAM_QUESTIONS.length,
      });
    }

    if (path === '/api/exam/questions' && method === 'GET') {
      const qText = (url.searchParams.get('q') ?? '').trim().toLowerCase();
      const categoryId = url.searchParams.get('categoryId') ?? 'all';
      const subject = url.searchParams.get('subject') ?? 'all';
      const chapter = url.searchParams.get('chapter') ?? 'all';
      const difficulty = url.searchParams.get('difficulty') ?? 'all';
      const questionType = url.searchParams.get('questionType') ?? 'all';
      const page = Math.max(1, Number(url.searchParams.get('page') ?? 1));
      const limit = Math.min(50, Math.max(5, Number(url.searchParams.get('limit') ?? 20)));

      let pool = [...ALL_EXAM_QUESTIONS];
      if (categoryId !== 'all') pool = pool.filter((x) => x.categoryId === categoryId);
      if (subject !== 'all') pool = pool.filter((x) => x.subject === subject);
      if (chapter !== 'all') pool = pool.filter((x) => x.chapter === chapter);
      if (difficulty !== 'all') pool = pool.filter((x) => x.difficulty === difficulty);
      if (questionType !== 'all') pool = pool.filter((x) => x.questionType === questionType);
      if (qText) {
        pool = pool.filter(
          (x) =>
            x.question.toLowerCase().includes(qText) ||
            x.topic.toLowerCase().includes(qText) ||
            x.subject.toLowerCase().includes(qText) ||
            x.tags.some((t) => t.toLowerCase().includes(qText))
        );
      }

      const start = (page - 1) * limit;
      return jsonResponse({
        total: pool.length,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(pool.length / limit)),
        items: pool.slice(start, start + limit),
      });
    }

    if (path === '/api/exam/daily-status' && method === 'GET') {
      return jsonResponse({ date: new Date().toISOString().slice(0, 10), completed: false });
    }

    if (path === '/api/exam/start' && method === 'POST') {
      const body = await parseJsonBody(request);
      const mode = String(body.mode ?? 'quick') as ExamMode;
      const categoryId = String(body.categoryId ?? 'all');
      const subject = String(body.subject ?? 'all');
      const chapter = String(body.chapter ?? 'all');
      const difficulty = String(body.difficulty ?? 'Adaptive') as ExamSettings['difficulty'];
      const questionType = String(body.questionType ?? 'All') as ExamSettings['questionType'];
      const scoringRule = getModeScoringRules(
        mode,
        body.negativeMarking !== undefined ? Number(body.negativeMarking) : undefined
      );
      const requestedIds = Array.isArray(body.questionIds) ? body.questionIds.map(String) : null;
      const excludeQuestionIds = Array.isArray(body.excludeQuestionIds)
        ? body.excludeQuestionIds.map(String)
        : [];

      const rawSelected =
        requestedIds && requestedIds.length > 0
          ? requestedIds.map((id) => EXAM_QUESTION_MAP.get(id)).filter((q): q is ExamQuestion => Boolean(q))
          : selectBalancedQuizQuestions({
              allQuestions: ALL_EXAM_QUESTIONS,
              mode,
              categoryId,
              subject,
              chapter,
              difficulty,
              questionType,
              questionCount: Number(body.questionCount ?? 0) || undefined,
              excludeQuestionIds,
              seedStr: mode === 'daily' ? new Date().toISOString().slice(0, 10) : undefined,
            });

      const sessionId = `edge_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const selected = rawSelected.map((q) => shuffleQuestionDeterministically(q, sessionId));

      const defaultMinutes =
        mode === 'rapid'
          ? 2
          : mode === 'quick' || mode === 'career_fair'
            ? 8
            : mode === 'mock' || mode === 'jee'
              ? Math.max(15, Math.round(selected.length * 1.25))
              : Math.max(12, selected.length);
      const timeLimitSeconds = Math.max(
        60,
        Math.round(Number(body.timeLimitMinutes ?? defaultMinutes) * 60)
      );

      const settings: ExamSettings = {
        mode,
        categoryId,
        subject,
        chapter,
        difficulty,
        questionType,
        questionCount: selected.length,
        timeLimitMinutes: Math.round(timeLimitSeconds / 60),
        negativeMarking: scoringRule.negativeMarking,
        smartBoardMode: Boolean(body.smartBoardMode),
        adaptiveEnabled:
          body.adaptiveEnabled !== undefined ? Boolean(body.adaptiveEnabled) : difficulty === 'Adaptive',
        excludeQuestionIds,
      };

      return jsonResponse({
        sessionId,
        mode,
        settings,
        timeLimitSeconds,
        adaptiveState: {
          currentDifficulty: difficulty !== 'Mixed' && difficulty !== 'Adaptive' ? difficulty : 'Medium',
          consecutiveCorrect: 0,
          consecutiveWrong: 0,
        },
        scoringRule,
        questions: selected.map(sanitizeQuestion),
      });
    }

    if (path === '/api/exam/check-answer' && method === 'POST') {
      const body = await parseJsonBody(request);
      const sessionId = String(body.sessionId ?? '');
      const questionId = String(body.questionId ?? '');
      const userAnswer = body.userAnswer as ExamUserAnswer;
      const baseQ = EXAM_QUESTION_MAP.get(questionId);
      if (!baseQ) return jsonResponse({ error: 'Question not found.' }, 404);

      const q = shuffleQuestionDeterministically(baseQ, sessionId);
      const correct = evaluateAnswer(q, userAnswer);
      return jsonResponse({
        correct,
        correctAnswer: q.answer,
        explanation: q.explanation,
        source: q.source,
        year: q.year,
        adaptiveState: {
          currentDifficulty: q.difficulty,
          consecutiveCorrect: correct ? 1 : 0,
          consecutiveWrong: correct ? 0 : 1,
        },
      });
    }

    if (path === '/api/exam/submit' && method === 'POST') {
      const body = await parseJsonBody(request);
      const sessionId = String(body.sessionId ?? '');
      const mode = String(body.mode ?? 'quick') as ExamMode;
      const answersInput = Array.isArray(body.answers) ? (body.answers as ExamAnswerItem[]) : [];
      const scoringRule = getModeScoringRules(
        mode,
        body.negativeMarking !== undefined ? Number(body.negativeMarking) : undefined
      );

      const questionIds = Array.isArray(body.questionIds)
        ? body.questionIds.map(String)
        : answersInput.map((a) => a.questionId);
      const answerByQ = new Map(answersInput.map((a) => [a.questionId, a]));

      let score = 0;
      let maxScore = 0;
      let correctCount = 0;
      let wrongCount = 0;
      let skippedCount = 0;
      let totalTimeMs = 0;

      const speedMatrix: Record<SpeedClass, number> = {
        'FAST+CORRECT': 0,
        'SLOW+CORRECT': 0,
        'FAST+WRONG': 0,
        'SLOW+WRONG': 0,
        SKIPPED: 0,
      };
      const topicMap = new Map<string, { subject: string; attempted: number; correct: number; totalMs: number }>();
      const details: ExamEvaluatedDetail[] = [];

      for (const qId of questionIds) {
        const baseQ = EXAM_QUESTION_MAP.get(qId);
        if (!baseQ) continue;
        const q = shuffleQuestionDeterministically(baseQ, sessionId);
        maxScore += scoringRule.marksPerCorrect;

        const ansObj = answerByQ.get(qId);
        const userAns = ansObj ? ansObj.userAnswer : null;
        const timeMs = Math.max(500, Math.min(300000, Number(ansObj?.timeMs ?? 10000)));
        totalTimeMs += timeMs;

        const skipped = isAnswerSkipped(q, userAns);
        const correct = !skipped && evaluateAnswer(q, userAns);
        const speedClass = classifySpeed(correct, skipped, timeMs, q.difficulty);
        speedMatrix[speedClass] += 1;

        let marksAwarded = 0;
        if (skipped) skippedCount += 1;
        else if (correct) {
          correctCount += 1;
          marksAwarded = scoringRule.marksPerCorrect;
          score += marksAwarded;
        } else {
          wrongCount += 1;
          marksAwarded = -scoringRule.negativeMarking;
          score -= scoringRule.negativeMarking;
        }

        if (!topicMap.has(q.topic)) {
          topicMap.set(q.topic, { subject: q.subject, attempted: 0, correct: 0, totalMs: 0 });
        }
        const t = topicMap.get(q.topic)!;
        if (!skipped) t.attempted += 1;
        if (correct) t.correct += 1;
        t.totalMs += timeMs;

        details.push({
          questionId: q.id,
          question: q.question,
          questionType: q.questionType,
          subject: q.subject,
          chapter: q.chapter,
          topic: q.topic,
          difficulty: q.difficulty,
          options: q.options,
          matchPairs: q.matchPairs,
          assertion: q.assertion,
          reason: q.reason,
          imageSvg: q.imageSvg,
          userAnswer: userAns,
          correctAnswer: q.answer,
          isCorrect: correct,
          isSkipped: skipped,
          marksAwarded,
          timeMs,
          speedClass,
          explanation: q.explanation,
          source: q.source,
          year: q.year,
        });
      }

      const attempted = correctCount + wrongCount;
      const accuracy = attempted > 0 ? Math.round((correctCount / attempted) * 1000) / 10 : 0;
      const xpEarned = Math.max(10, correctCount * 12 + (accuracy === 100 ? 35 : 0));
      const topicBreakdown: TopicStat[] = [...topicMap.entries()].map(([topic, d]) => ({
        topic,
        subject: d.subject,
        attempted: d.attempted,
        correct: d.correct,
        accuracy: d.attempted > 0 ? Math.round((d.correct / d.attempted) * 100) : 0,
        avgTimeSec: Math.round((d.totalMs / Math.max(1, d.attempted) / 1000) * 10) / 10,
      }));
      const weak = topicBreakdown.filter((t) => t.attempted > 0 && t.accuracy < 65).sort((a, b) => a.accuracy - b.accuracy);

      const summary: ExamResultSummary = {
        attemptId: `edge_att_${Date.now()}`,
        sessionId,
        mode,
        score,
        maxScore,
        correctCount,
        wrongCount,
        skippedCount,
        totalQuestions: details.length || 1,
        accuracy,
        timeSpentSeconds: Math.max(1, Math.round(totalTimeMs / 1000)),
        avgTimePerQuestion: Math.round((totalTimeMs / Math.max(1, details.length) / 1000) * 10) / 10,
        negativeMarking: scoringRule.negativeMarking,
        xpEarned,
        rank: null,
        streaks: {
          dailyStreak: 1,
          bestDailyStreak: 1,
          quizStreak: 1,
          perfectStreak: accuracy === 100 ? 1 : 0,
          examXp: xpEarned,
          examLevel: computeExamLevel(xpEarned).title,
        },
        speedMatrix,
        topicBreakdown,
        didWell: accuracy >= 70 ? [`Strong accuracy (${accuracy}%) on this session.`] : ['Completed full evaluation cycle.'],
        needsImprovement: weak.slice(0, 2).map((w) => `${w.topic} (${w.accuracy}% accuracy)`),
        nextRecommendation: weak[0]
          ? {
              label: `Practice ${weak[0].topic} (${weak[0].accuracy < 40 ? 'Easy' : 'Medium'})`,
              categoryId: String(body.categoryId ?? 'all'),
              subject: weak[0].subject,
              topic: weak[0].topic,
              difficulty: weak[0].accuracy < 40 ? 'Easy' : 'Medium',
            }
          : {
              label: accuracy >= 85 ? 'Try Challenge Mode' : 'Practice More Engineering Topics',
              categoryId: String(body.categoryId ?? 'all'),
              subject: String(body.subject ?? 'all'),
              difficulty: accuracy >= 85 ? 'Hard' : 'Medium',
            },
        examStrategyNote: null,
        mistakesSavedCount: wrongCount,
        details,
        createdAt: new Date().toISOString(),
      };

      return jsonResponse(summary);
    }

    if (path === '/api/exam/generate-ai' && method === 'POST') {
      return jsonResponse(
        {
          error: 'Edge runtime uses curated verified engineering questions.',
          fallbackAvailable: true,
        },
        503
      );
    }

    if (path === '/api/exam/analytics' && method === 'GET') {
      return jsonResponse({
        hasData: false,
        range: url.searchParams.get('range') ?? '30d',
        totalQuizzes: 0,
        totalAttempted: 0,
        totalCorrect: 0,
        totalWrong: 0,
        overallAccuracy: 0,
        avgTimePerQuestion: 0,
        bestScore: 0,
        streaks: { dailyStreak: 0, bestDailyStreak: 0, quizStreak: 0, perfectStreak: 0, examXp: 0, examLevel: 'Beginner' },
        subjectPerformance: [],
        strongTopics: [],
        weakTopics: [],
        mistakenConcepts: [],
        speedMatrix: { 'FAST+CORRECT': 0, 'SLOW+CORRECT': 0, 'FAST+WRONG': 0, 'SLOW+WRONG': 0, SKIPPED: 0 },
        chartSeries: [],
        recentAttempts: [],
      });
    }

    if (path === '/api/exam/mistakes' && method === 'GET') {
      return jsonResponse({ items: [] });
    }
    if (path.startsWith('/api/exam/mistakes/') && (method === 'PATCH' || method === 'DELETE')) {
      return jsonResponse({ ok: true });
    }
    if (path === '/api/exam/bookmarks' && method === 'GET') {
      return jsonResponse({ questionIds: [], items: [] });
    }
    if (path.startsWith('/api/exam/bookmarks/') && (method === 'POST' || method === 'DELETE')) {
      return jsonResponse({ ok: true });
    }
    if (path === '/api/exam/leaderboard' && method === 'GET') {
      return jsonResponse({ period: url.searchParams.get('period') ?? 'all', entries: [] });
    }
    if (path === '/api/exam/profile/display-name' && method === 'POST') {
      const body = await parseJsonBody(request);
      return jsonResponse({
        ok: true,
        displayName: String(body.displayName ?? 'Engineering Explorer'),
        streaks: { dailyStreak: 1, bestDailyStreak: 1, quizStreak: 1, perfectStreak: 0, examXp: 0, examLevel: 'Beginner' },
      });
    }

    // Legacy / Arcade Mini-Game POST routes for Cloudflare Pages Web Deploy
    if (path === '/api/quiz/start' && method === 'POST') {
      const body = await parseJsonBody(request);
      const categoryId = String(body.categoryId ?? 'all');
      const pool = categoryId !== 'all' ? QUESTION_BANK.filter((q) => q.categoryId === categoryId) : QUESTION_BANK;
      const picked = seededShuffle(pool.length ? pool : QUESTION_BANK, String(Date.now())).slice(0, 8);
      return jsonResponse({
        sessionId: `qs_edge_${Date.now()}`,
        mode: body.mode === 'competitive' ? 'competitive' : 'practice',
        gameType: body.gameType || 'iq-quiz',
        startedAt: Date.now(),
        timeLimitSeconds: body.mode === 'competitive' ? 150 : 240,
        questions: picked.map(({ id, categoryId: cId, difficulty, question, options }) => ({
          id,
          categoryId: cId,
          difficulty,
          question,
          options,
        })),
      });
    }

    if (path === '/api/quiz/check' && method === 'POST') {
      const body = await parseJsonBody(request);
      const q = LEGACY_QUESTION_MAP.get(String(body.questionId ?? ''));
      if (!q) return jsonResponse({ error: 'Question not found.' }, 404);
      return jsonResponse({
        correct: Number(body.selectedIndex) === q.correctIndex,
        correctIndex: q.correctIndex,
        explanation: q.explanation,
        reference: q.reference,
      });
    }

    if (path === '/api/quiz/submit' && method === 'POST') {
      const body = await parseJsonBody(request);
      const answers = Array.isArray(body.answers)
        ? (body.answers as Array<{ questionId: string; selectedIndex: number; timeMs?: number }>)
        : [];
      let correctCount = 0;
      const details = answers
        .map((a) => {
          const q = LEGACY_QUESTION_MAP.get(a.questionId);
          if (!q) return null;
          const correct = Number(a.selectedIndex) === q.correctIndex;
          if (correct) correctCount += 1;
          return {
            questionId: q.id,
            question: q.question,
            options: q.options,
            selectedIndex: Number(a.selectedIndex),
            correctIndex: q.correctIndex,
            correct,
            explanation: q.explanation,
            reference: q.reference,
            timeMs: Number(a.timeMs ?? 8000),
          };
        })
        .filter(Boolean);
      const total = Math.max(1, details.length);
      return jsonResponse({
        sessionId: String(body.sessionId ?? ''),
        mode: body.mode === 'competitive' ? 'competitive' : 'practice',
        gameType: body.gameType || 'iq-quiz',
        score: correctCount * 100,
        correctCount,
        totalQuestions: total,
        accuracy: Math.round((correctCount / total) * 1000) / 10,
        timeSpentSeconds: 30,
        maxStreak: correctCount,
        fastCount: 0,
        xpEarned: correctCount * 25,
        leveledUp: false,
        unlockedAchievements: [],
        dailyCompletedNow: false,
        details,
        player: null,
      });
    }

    if (path === '/api/minigame/start' && method === 'POST') {
      const body = await parseJsonBody(request);
      const gameType = String(body.gameType ?? '');
      const seed = String(Date.now());
      let items: unknown = [];
      if (gameType === 'code-breaker') items = seededShuffle(CODE_PUZZLES, seed).slice(0, 6);
      else if (gameType === 'logic-lab') items = seededShuffle(LOGIC_PUZZLES, seed).slice(0, 6);
      else if (gameType === 'circuit-rush') items = CIRCUIT_STAGES;
      else if (gameType === 'component-match') items = COMPONENT_CARDS;
      return jsonResponse({ sessionId: `mg_edge_${seed}`, gameType, startedAt: Date.now(), items });
    }

    if (path === '/api/minigame/check' && method === 'POST') {
      const body = await parseJsonBody(request);
      const itemId = String(body.itemId ?? '');
      const item = CODE_PUZZLE_MAP.get(itemId) || LOGIC_PUZZLE_MAP.get(itemId);
      if (!item) return jsonResponse({ error: 'Puzzle not found.' }, 404);
      return jsonResponse({
        correct: Number(body.selectedIndex) === item.correctIndex,
        correctIndex: item.correctIndex,
        explanation: item.explanation,
      });
    }

    if (path === '/api/minigame/submit' && method === 'POST') {
      const body = await parseJsonBody(request);
      return jsonResponse({
        sessionId: String(body.sessionId ?? ''),
        gameType: body.gameType || 'circuit-rush',
        score: 400,
        correctCount: 4,
        totalQuestions: 6,
        accuracy: 66.7,
        timeSpentSeconds: 45,
        maxStreak: 3,
        xpEarned: 112,
        leveledUp: false,
        unlockedAchievements: [],
        dailyCompletedNow: false,
        details: [],
        player: null,
      });
    }

    // Smart Game System Routes (/api/game/*)
    if (path === '/api/game/config' && method === 'GET') {
      const countsByDifficulty: Record<GameDifficultyId, number> = {
        easy: 0,
        moderate: 0,
        hard: 0,
        jee: 0,
      };
      const countsByCategory: Record<string, number> = { all: SMART_QUESTION_BANK.length };
      for (const q of SMART_QUESTION_BANK) {
        countsByDifficulty[q.difficulty] += 1;
        countsByCategory[q.category] = (countsByCategory[q.category] || 0) + 1;
      }
      return jsonResponse({
        difficulties: GAME_DIFFICULTY_CONFIGS,
        categories: GAME_CATEGORIES.map((c) => ({
          ...c,
          questionCount: countsByCategory[c.id] || 0,
        })),
        countsByDifficulty,
        totalQuestions: SMART_QUESTION_BANK.length,
      });
    }

    if (path === '/api/game/start' && method === 'POST') {
      const body = await parseJsonBody(request);
      const userId = String(body.userId ?? '').trim();
      if (!userId) {
        return jsonResponse(
          { error: 'Authentication required: please sign in to start a scored game.' },
          401
        );
      }

      const player = getOrHydrateEdgePlayer(
        userId,
        typeof body.username === 'string' ? body.username : undefined,
        typeof body.className === 'string' ? body.className : undefined
      );
      if (!player) {
        return jsonResponse(
          { error: 'Registered player account required before starting a scored game.' },
          401
        );
      }

      const difficulty = body.difficulty ? normalizeGameDifficulty(body.difficulty) : 'easy';
      if (!difficulty) {
        return jsonResponse(
          { error: 'Invalid difficulty level. Must be easy, moderate, hard, or jee.' },
          400
        );
      }

      const category = String(body.category ?? 'all').trim() || 'all';
      const playMode = String(body.playMode ?? 'normal').trim() as QuizPlayMode;
      const questionCount = Math.max(5, Math.min(25, Math.round(Number(body.questionCount ?? 10))));
      const rawLimit = Number(body.timeLimitSeconds ?? 0);
      const timeLimitSeconds = rawLimit > 0 ? Math.max(20, Math.min(3600, Math.round(rawLimit))) : 0;
      const isTest = body.isTest === true;

      const selected = selectSmartGameQuestions({
        difficulty,
        category,
        count: questionCount,
      });

      const startedAt = Date.now();
      const rand = Math.random().toString(36).slice(2, 8);
      const sessionId = `gs_edge_${difficulty}_${category}_${startedAt}_${rand}`;
      const expiresAt =
        startedAt +
        Math.max(timeLimitSeconds > 0 ? timeLimitSeconds * 1000 + 5 * 60 * 1000 : 2 * 60 * 60 * 1000, 60 * 60 * 1000);

      EDGE_SESSIONS.set(sessionId, {
        sessionId,
        userId,
        username: player.name,
        difficulty,
        category,
        playMode,
        questions: selected,
        startedAt,
        expiresAt,
        status: 'active',
        isTest,
      });

      const diffCfg = DIFFICULTY_MAP[difficulty];
      return jsonResponse({
        sessionId,
        userId,
        username: player.name,
        difficulty,
        difficultyConfig: diffCfg,
        category,
        playMode,
        questionCount: selected.length,
        marksPerCorrect: diffCfg.marksPerCorrect,
        timeLimitSeconds,
        startedAt,
        questions: selected.map(sanitizeSmartQuestion),
      });
    }

    if (path === '/api/game/check' && method === 'POST') {
      const body = await parseJsonBody(request);
      const sessionId = String(body.sessionId ?? '').trim();
      const userId = String(body.userId ?? '').trim();
      const questionId = String(body.questionId ?? '').trim();
      const selectedIndex = Number(body.selectedIndex);

      if (!userId) {
        return jsonResponse({ error: 'Authentication required.' }, 401);
      }

      const session = EDGE_SESSIONS.get(sessionId);
      if (session) {
        if (session.userId !== userId) {
          return jsonResponse({ error: 'Session does not belong to current user.' }, 403);
        }
        if (session.status !== 'active') {
          return jsonResponse({ error: 'Game session is already completed.' }, 400);
        }
      }

      const q =
        session?.questions.find((item) => item.id === questionId) ||
        SMART_QUESTION_MAP.get(questionId);
      if (!q) {
        return jsonResponse({ error: 'Question not found.' }, 404);
      }

      const isCorrect = selectedIndex === q.correctIndex;
      return jsonResponse({
        correct: isCorrect,
        correctIndex: q.correctIndex,
        explanation: q.explanation,
        pointsAwarded: isCorrect ? q.marks : 0,
      });
    }

    if (path === '/api/game/submit' && method === 'POST') {
      const body = await parseJsonBody(request);
      const sessionId = String(body.sessionId ?? '').trim();
      const userId = String(body.userId ?? '').trim();
      const submittedAnswers = Array.isArray(body.answers)
        ? (body.answers as Array<{ questionId?: string; selectedIndex?: number | null }>)
        : [];

      if (!userId) {
        return jsonResponse({ error: 'Authentication required: log in to submit your score.' }, 401);
      }

      const player = getOrHydrateEdgePlayer(
        userId,
        typeof body.username === 'string' ? body.username : undefined,
        typeof body.className === 'string' ? body.className : undefined
      );
      if (!player) {
        return jsonResponse({ error: 'Invalid or unregistered user account. Score rejected.' }, 401);
      }
      if (!sessionId) {
        return jsonResponse({ error: 'sessionId is required.' }, 400);
      }

      if (EDGE_RESULT_BY_SESSION.has(sessionId)) {
        return jsonResponse(
          {
            error: 'Duplicate submission blocked: this game session has already been recorded.',
            alreadySubmitted: true,
          },
          409
        );
      }

      let session = EDGE_SESSIONS.get(sessionId);
      if (session) {
        if (session.userId !== userId) {
          return jsonResponse(
            { error: 'Forbidden: this game session belongs to a different player.' },
            403
          );
        }
        if (session.status !== 'active') {
          return jsonResponse(
            {
              error: 'Duplicate submission blocked: this game session has already been recorded.',
              alreadySubmitted: true,
            },
            409
          );
        }
      } else {
        // Reconstruct across Cloudflare isolate hop from sessionId + submitted question IDs
        const parts = sessionId.split('_');
        const parsedDiff = normalizeGameDifficulty(parts[2]) || 'easy';
        const parsedCat = parts[3] || 'all';
        const parsedStart = Number(parts[4]) || Date.now() - 30000;
        const reconstructedQuestions = submittedAnswers
          .map((a) => (a && typeof a.questionId === 'string' ? SMART_QUESTION_MAP.get(a.questionId) : undefined))
          .filter((q): q is SmartGameQuestion => Boolean(q));

        if (reconstructedQuestions.length === 0) {
          return jsonResponse({ error: 'Game session not found or expired.' }, 404);
        }
        session = {
          sessionId,
          userId,
          username: player.name,
          difficulty: parsedDiff,
          category: parsedCat,
          questions: reconstructedQuestions,
          startedAt: parsedStart,
          expiresAt: Date.now() + 3600000,
          status: 'active',
          isTest: false,
        };
      }

      session.status = 'completed';
      EDGE_SESSIONS.set(sessionId, session);

      const includeTest = session.isTest;
      const prevHighestTop3 = queryEdgeGameLeaderboard({ view: 'highest', includeTest }).top3.map((e) => e.userId);
      const prevOverallTop3 = queryEdgeGameLeaderboard({ view: 'overall', includeTest }).top3.map((e) => e.userId);

      const diffCfg = DIFFICULTY_MAP[session.difficulty] || DIFFICULTY_MAP.easy;
      const marksPerCorrect = diffCfg.marksPerCorrect;

      const answerMap = new Map<string, number>();
      for (const a of submittedAnswers) {
        if (a && typeof a.questionId === 'string') {
          const idx = a.selectedIndex === null || a.selectedIndex === undefined ? -1 : Number(a.selectedIndex);
          answerMap.set(a.questionId, Number.isInteger(idx) ? idx : -1);
        }
      }

      let correctAnswers = 0;
      let incorrectAnswers = 0;
      let unanswered = 0;
      let streak = 0;
      let maxStreak = 0;
      const details: GameEvaluatedItem[] = [];

      for (const q of session.questions) {
        const chosen = answerMap.has(q.id) ? answerMap.get(q.id)! : -1;
        const isUnanswered = chosen < 0 || chosen >= q.options.length;
        const isCorrect = !isUnanswered && chosen === q.correctIndex;

        if (isUnanswered) {
          unanswered += 1;
          streak = 0;
        } else if (isCorrect) {
          correctAnswers += 1;
          streak += 1;
          maxStreak = Math.max(maxStreak, streak);
        } else {
          incorrectAnswers += 1;
          streak = 0;
        }

        details.push({
          questionId: q.id,
          topic: q.topic,
          category: q.category,
          question: q.question,
          options: q.options,
          selectedIndex: chosen,
          correctIndex: q.correctIndex,
          isCorrect,
          isUnanswered,
          pointsAwarded: isCorrect ? marksPerCorrect : 0,
          explanation: q.explanation,
        });
      }

      const totalQuestions = Math.max(1, session.questions.length);
      const playMode = (session.playMode || String(body.playMode ?? 'normal')) as QuizPlayMode;
      const completionTime = Math.max(1, Math.round((Date.now() - session.startedAt) / 1000));
      const bonus = computeQuizModeBonus({
        playMode,
        correctAnswers,
        totalQuestions,
        maxStreak,
        completionTime,
        marksPerCorrect,
      });
      const score = bonus.totalScore;
      const maxPossibleScore =
        playMode === 'normal'
          ? totalQuestions * marksPerCorrect
          : totalQuestions * marksPerCorrect + Math.round(marksPerCorrect * 4);
      const accuracy = Math.round((correctAnswers / totalQuestions) * 1000) / 10;
      const xpEarned = Math.max(10, Math.round(score * 0.5) + (accuracy === 100 ? 40 : 0));
      const nowIso = new Date().toISOString();
      const resultId = `gr_edge_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

      const achs = ['first_run', 'first_quiz', 'competitor'];
      if (maxStreak >= 5) achs.push('streak_master');
      if (maxStreak >= 10) achs.push('streak_10');
      if (accuracy === 100 && totalQuestions >= 5) achs.push('perfect_run');
      if (accuracy >= 80 && session.difficulty === 'easy') achs.push('easy_scholar');

      const progression = updateEdgePlayerProgression({
        player,
        xpEarned,
        maxStreak,
        newAchievements: achs,
      });

      EDGE_GAME_RESULTS.push({
        resultId,
        sessionId,
        userId,
        username: progression.player.name,
        className: progression.player.className,
        title: progression.player.title,
        score,
        correctAnswers,
        incorrectAnswers,
        unanswered,
        totalQuestions,
        accuracy,
        completionTime,
        difficulty: session.difficulty,
        category: session.category,
        xpEarned,
        details,
        isTest: session.isTest,
        createdAt: nowIso,
      });

      const highestBoard = queryEdgeGameLeaderboard({ view: 'highest', userId, includeTest });
      const overallBoard = queryEdgeGameLeaderboard({ view: 'overall', userId, includeTest });
      const highestRank = highestBoard.currentUserEntry?.rank ?? null;
      const overallRank = overallBoard.currentUserEntry?.rank ?? null;

      const enteredTop3Highest =
        highestRank !== null &&
        highestRank <= 3 &&
        (!prevHighestTop3.includes(userId) || highestRank === 1);
      const enteredTop3Overall =
        overallRank !== null &&
        overallRank <= 3 &&
        (!prevOverallTop3.includes(userId) || overallRank === 1);

      const payload: GameResultPayload = {
        resultId,
        sessionId,
        userId,
        username: progression.player.name,
        score,
        maxPossibleScore,
        marksPerCorrect,
        correctAnswers,
        incorrectAnswers,
        unanswered,
        totalQuestions,
        accuracy,
        completionTime,
        difficulty: session.difficulty,
        category: session.category,
        highestRank,
        overallRank,
        totalRankedPlayers: highestBoard.totalPlayers,
        enteredTop3Highest,
        enteredTop3Overall,
        top3Highest: highestBoard.top3,
        top3Overall: overallBoard.top3,
        currentUserHighestEntry: highestBoard.currentUserEntry,
        currentUserOverallEntry: overallBoard.currentUserEntry,
        xpEarned,
        leveledUp: progression.leveledUp,
        unlockedAchievements: progression.unlockedAchievements,
        player: progression.player,
        details,
        createdAt: nowIso,
      };

      EDGE_RESULT_BY_SESSION.set(sessionId, payload);
      return jsonResponse(payload);
    }

    if (path.startsWith('/api/game/result/') && method === 'GET') {
      const sessionId = decodeURIComponent(path.replace('/api/game/result/', '')).trim();
      const saved = EDGE_RESULT_BY_SESSION.get(sessionId);
      if (!saved) {
        return jsonResponse({ error: 'Saved game result not found.' }, 404);
      }
      return jsonResponse(saved);
    }

    if (path === '/api/game/leaderboard' && method === 'GET') {
      const view: GameLeaderboardView =
        url.searchParams.get('view') === 'overall' ? 'overall' : 'highest';
      const difficulty = url.searchParams.get('difficulty') ?? 'all';
      const category = url.searchParams.get('category') ?? 'all';
      const search = url.searchParams.get('search') ?? '';
      const userId = url.searchParams.get('userId') ?? '';
      return jsonResponse(
        queryEdgeGameLeaderboard({
          view,
          difficulty,
          category,
          search,
          userId,
        })
      );
    }

    if (path === '/api/players/register' && method === 'POST') {
      const body = await parseJsonBody(request);
      const rawName = String(body.name ?? '').trim();
      const className = (String(body.className ?? 'Class 12').trim() || 'Class 12') as ClassOption;
      const existingId = body.existingId ? String(body.existingId).trim() : null;

      if (rawName.length < 2 || rawName.length > 40) {
        return jsonResponse({ error: 'Player name must be between 2 and 40 characters.' }, 400);
      }

      const existingIdByName = EDGE_PLAYER_BY_NAME.get(rawName.toLowerCase());
      if (existingIdByName) {
        const existingPlayer = EDGE_PLAYERS.get(existingIdByName);
        if (existingPlayer) {
          if (existingId && existingPlayer.id === existingId) {
            return jsonResponse({ player: existingPlayer, migrated: true });
          }
          if (existingPlayer.className === className) {
            return jsonResponse({ player: existingPlayer, signedInExisting: true });
          }
          return jsonResponse(
            {
              error:
                'That handle is already registered in a different class. Choose a unique handle or select its matching class to sign back in.',
            },
            409
          );
        }
      }

      if (existingId && EDGE_PLAYERS.has(existingId)) {
        return jsonResponse({ player: EDGE_PLAYERS.get(existingId), migrated: true });
      }

      const now = new Date().toISOString();
      const id = existingId || `p_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const created: PlayerProfile = {
        id,
        name: rawName,
        className,
        xp: 0,
        level: 1,
        title: 'Circuit Rookie',
        streakBest: 0,
        gamesPlayed: 0,
        activeTheme: 'cyber-midnight',
        unlockedThemes: ['cyber-midnight'],
        achievements: [],
        createdAt: now,
      };
      EDGE_PLAYERS.set(id, created);
      EDGE_PLAYER_BY_NAME.set(rawName.toLowerCase(), id);

      return jsonResponse({ player: created, migrated: false }, 201);
    }

    if (path.endsWith('/theme') && path.startsWith('/api/players/') && method === 'POST') {
      const id = decodeURIComponent(path.split('/')[3] || '');
      const body = await parseJsonBody(request);
      const themeId = String(body.themeId ?? 'cyber-midnight') as PixelThemeId;
      const player = EDGE_PLAYERS.get(id);
      if (!player) return jsonResponse({ error: 'Player not found.' }, 404);
      player.activeTheme = themeId;
      EDGE_PLAYERS.set(id, player);
      return jsonResponse({ player });
    }

    if (path.endsWith('/achievement') && path.startsWith('/api/players/') && method === 'POST') {
      const id = decodeURIComponent(path.split('/')[3] || '');
      const body = await parseJsonBody(request);
      const achievementId = String(body.achievementId ?? '');
      const player = EDGE_PLAYERS.get(id);
      if (!player) return jsonResponse({ error: 'Player not found.' }, 404);
      const had = player.achievements.includes(achievementId);
      let xpBonus = 0;
      if (!had && achievementId) {
        player.achievements.push(achievementId);
        const def = ACHIEVEMENTS.find((a) => a.id === achievementId);
        if (def) {
          xpBonus = def.xpBonus;
          player.xp += xpBonus;
          const lvl = computeLevelFromXp(player.xp);
          player.level = lvl.level;
          player.title = lvl.title;
          player.unlockedThemes = getUnlockedThemesForLevel(lvl.level);
        }
        EDGE_PLAYERS.set(id, player);
      }
      return jsonResponse({ player, newlyUnlocked: !had, xpBonus });
    }

    if (path.startsWith('/api/players/') && method === 'GET') {
      const id = decodeURIComponent(path.replace('/api/players/', '')).trim();
      const player = EDGE_PLAYERS.get(id);
      if (!player) {
        return jsonResponse({ error: 'Player not found.' }, 404);
      }
      const today = new Date().toISOString().slice(0, 10);
      const history = EDGE_GAME_RESULTS.filter((r) => r.userId === id)
        .slice(-25)
        .reverse()
        .map((r) => ({
          id: r.resultId,
          sessionId: r.sessionId,
          playerId: r.userId,
          playerName: r.username,
          className: r.className,
          mode: 'competitive',
          gameType: 'iq-quiz',
          categoryId: r.category,
          difficulty: r.difficulty.toUpperCase(),
          score: r.score,
          correctCount: r.correctAnswers,
          totalQuestions: r.totalQuestions,
          accuracy: r.accuracy,
          timeSpentSeconds: r.completionTime,
          maxStreak: 0,
          xpEarned: r.xpEarned,
          createdAt: r.createdAt,
        }));
      return jsonResponse({
        player,
        dailyChallenge: getDailyChallengeForDate(today, false),
        history,
      });
    }

    if (path === '/api/leaderboard' && method === 'GET') {
      return jsonResponse({ entries: [] });
    }

    if (path === '/api/creations' && method === 'GET') {
      return jsonResponse({ creations: [] });
    }

    if (path === '/api/creations' && method === 'POST') {
      const body = await parseJsonBody(request);
      const now = new Date().toISOString();
      const type = body.type === 'phone' ? 'phone' : 'car';
      return jsonResponse(
        {
          creation: {
            id: String(body.id || `cr_${type}_${Date.now()}`),
            userId: String(body.userId || 'guest_studio'),
            type,
            title: String(body.title || 'Custom Design'),
            subtitle: String(body.subtitle || ''),
            designRating: Number(body.designRating ?? 82),
            estimatedCost: Number(body.estimatedCost ?? 0),
            payload: (body.payload as Record<string, unknown>) || {},
            previewDataUrl: typeof body.previewDataUrl === 'string' ? body.previewDataUrl : null,
            createdAt: now,
            updatedAt: now,
          },
          xpEarned: 50,
          leveledUp: false,
          unlockedAchievements: [],
          player: null,
        },
        201
      );
    }

    if (path.startsWith('/api/creations/') && method === 'DELETE') {
      return jsonResponse({ deleted: true });
    }

    if (path === '/api/studio/easy-complete' && method === 'POST') {
      const body = await parseJsonBody(request);
      const correctCount = Math.max(0, Number(body.correctCount ?? 0));
      const totalQuestions = Math.max(1, Number(body.totalQuestions ?? 10));
      const accuracy = Math.round((correctCount / totalQuestions) * 100);
      const xpEarned = Math.max(15, correctCount * 12 + (accuracy >= 80 ? 25 : 0));
      return jsonResponse({
        categoryId: String(body.categoryId ?? 'general-knowledge'),
        difficulty: String(body.difficulty ?? 'Easy'),
        correctCount,
        totalQuestions,
        accuracy,
        xpEarned,
        leveledUp: false,
        unlockedAchievements: [],
        player: null,
      });
    }

    if (path === '/api/simulator/submit' && method === 'POST') {
      const body = await parseJsonBody(request);
      const userId = String(body.userId ?? '').trim();
      if (!userId) {
        return jsonResponse(
          { error: 'Authentication required: sign in to save simulator scores.' },
          401
        );
      }
      const player = getOrHydrateEdgePlayer(
        userId,
        typeof body.username === 'string' ? body.username : undefined,
        typeof body.className === 'string' ? body.className : undefined
      );
      if (!player) {
        return jsonResponse(
          { error: 'Registered player account required to rank on simulator leaderboard.' },
          401
        );
      }

      const simulator = body.simulator === 'phone' ? 'phone' : 'car';
      const missionId = String(body.missionId ?? '').trim();
      if (!missionId) return jsonResponse({ error: 'missionId is required.' }, 400);

      const missionTitle = String(body.missionTitle ?? 'Engineering Mission').trim();
      const score = Math.max(0, Math.min(5000, Math.round(Number(body.score ?? 0))));
      const accuracy = Math.max(0, Math.min(100, Number(body.accuracy ?? 0)));
      const componentsExplored = Math.max(0, Math.round(Number(body.componentsExplored ?? 0)));
      const nowIso = new Date().toISOString();

      const existing = EDGE_SIMULATOR_RESULTS.find(
        (r) => r.userId === userId && r.simulator === simulator && r.missionId === missionId
      );
      const xpEarned = existing ? 0 : Math.max(40, Math.round(score * 0.15) + componentsExplored * 2);

      const progression =
        xpEarned > 0
          ? updateEdgePlayerProgression({
              player,
              xpEarned,
              maxStreak: 1,
              newAchievements: componentsExplored >= 10 ? ['first_run', 'scholar'] : ['first_run'],
            })
          : null;

      if (existing) {
        existing.score = Math.max(existing.score, score);
        existing.accuracy = Math.max(existing.accuracy, accuracy);
        existing.componentsExplored = Math.max(existing.componentsExplored, componentsExplored);
        existing.createdAt = nowIso;
      } else {
        EDGE_SIMULATOR_RESULTS.push({
          userId,
          username: progression?.player.name || player.name,
          className: progression?.player.className || player.className,
          title: progression?.player.title || player.title,
          simulator,
          missionId,
          missionTitle,
          score,
          accuracy,
          componentsExplored,
          xpEarned,
          isTest: body.isTest === true,
          createdAt: nowIso,
        });
      }

      const mine = EDGE_SIMULATOR_RESULTS.filter((r) => r.userId === userId);
      const totalScore = mine.reduce((acc, r) => acc + r.score, 0);
      const simXp = mine.reduce((acc, r) => acc + r.xpEarned, 0);
      const avgAcc = mine.length
        ? Math.round((mine.reduce((acc, r) => acc + r.accuracy, 0) / mine.length) * 10) / 10
        : 0;
      const maxExplored = mine.reduce((mx, r) => Math.max(mx, r.componentsExplored), componentsExplored);

      return jsonResponse({
        savedToLeaderboard: true,
        alreadyCompletedMission: Boolean(existing),
        xpEarned,
        leveledUp: progression?.leveledUp ?? false,
        unlockedAchievements: progression?.unlockedAchievements ?? [],
        player: progression?.player ?? player,
        progress: {
          engineeringXp: simXp,
          missionsCompleted: mine.length,
          componentsExplored: maxExplored,
          engineeringAccuracy: avgAcc,
          totalScore,
        },
      });
    }

    if (path === '/api/simulator/leaderboard' && method === 'GET') {
      const simulator = (url.searchParams.get('simulator') ?? 'all').toLowerCase();
      const search = (url.searchParams.get('search') ?? '').trim().toLowerCase();
      const userId = (url.searchParams.get('userId') ?? '').trim();

      const filtered = EDGE_SIMULATOR_RESULTS.filter(
        (r) => !r.isTest && (simulator === 'all' || r.simulator === simulator)
      );
      const byUser = new Map<
        string,
        {
          latest: EdgeSimulatorResultRecord;
          totalPoints: number;
          bestScore: number;
          count: number;
          accSum: number;
          maxExplored: number;
        }
      >();
      for (const r of filtered) {
        const cur = byUser.get(r.userId);
        if (!cur) {
          byUser.set(r.userId, {
            latest: r,
            totalPoints: r.score,
            bestScore: r.score,
            count: 1,
            accSum: r.accuracy,
            maxExplored: r.componentsExplored,
          });
        } else {
          cur.totalPoints += r.score;
          cur.bestScore = Math.max(cur.bestScore, r.score);
          cur.count += 1;
          cur.accSum += r.accuracy;
          cur.maxExplored = Math.max(cur.maxExplored, r.componentsExplored);
          if (r.createdAt > cur.latest.createdAt) cur.latest = r;
        }
      }
      const rankedAll: GameLeaderboardEntry[] = [...byUser.values()]
        .sort(
          (a, b) =>
            b.totalPoints - a.totalPoints ||
            b.accSum / b.count - a.accSum / a.count ||
            b.count - a.count
        )
        .map((x, idx) => ({
          rank: idx + 1,
          userId: x.latest.userId,
          username: x.latest.username,
          className: x.latest.className,
          title: x.latest.title,
          score: x.totalPoints,
          bestScore: x.bestScore,
          totalPoints: x.totalPoints,
          gamesPlayed: x.count,
          accuracy: Math.round((x.accSum / x.count) * 10) / 10,
          completionTime: x.maxExplored,
          difficulty: x.latest.simulator === 'phone' ? 'phone-lab' : 'car-sim',
          category: 'engineering-simulator',
          createdAt: x.latest.createdAt,
        }));

      const currentUserEntry = userId ? rankedAll.find((e) => e.userId === userId) || null : null;
      const entries = search
        ? rankedAll.filter((e) => e.username.toLowerCase().includes(search))
        : rankedAll;

      return jsonResponse({
        view: 'overall',
        rankingMethodDescription:
          'Ranked by verified cumulative engineering mission points across the Car Tuning Simulator and Smartphone Engineering Lab.',
        totalPlayers: rankedAll.length,
        top3: rankedAll.slice(0, 3),
        entries: entries.slice(0, 100),
        currentUserEntry,
      });
    }

    if (path === '/api/playground/start' && method === 'POST') {
      const body = await parseJsonBody(request);
      const userId = String(body.userId ?? '').trim();
      const gameId = String(body.gameId ?? '').trim();
      if (!gameId || !isValidPlaygroundGameId(gameId)) {
        return jsonResponse({ error: `Invalid mini-game identifier: ${gameId || 'missing'}` }, 400);
      }
      const player = userId
        ? getOrHydrateEdgePlayer(
            userId,
            typeof body.username === 'string' ? body.username : undefined,
            typeof body.className === 'string' ? body.className : undefined
          )
        : null;
      const startedAt = Date.now();
      const rand = Math.random().toString(36).slice(2, 8);
      const sessionId = `pgs_edge_${gameId}_${startedAt}_${rand}`;
      const isTest = body.isTest === true;
      EDGE_PG_SESSIONS.set(sessionId, {
        sessionId,
        userId: player?.id || 'guest_practice',
        gameId,
        startedAt,
        status: 'active',
        isTest,
      });
      const board = queryEdgePlaygroundLeaderboard({
        gameId,
        timeframe: 'global',
        userId: player?.id,
        includeTest: isTest,
      });
      return jsonResponse({
        sessionId,
        gameId,
        startedAt,
        personalBest: board.currentUserEntry?.bestScore ?? null,
        globalRank: board.currentUserEntry?.rank ?? null,
        totalPlayers: board.totalPlayers,
      });
    }

    if (path === '/api/playground/submit' && method === 'POST') {
      const body = await parseJsonBody(request);
      const sessionId = String(body.sessionId ?? '').trim();
      const userId = String(body.userId ?? '').trim();
      const gameIdBody = String(body.gameId ?? '').trim();

      if (!userId) {
        return jsonResponse({ error: 'Sign in with a registered player handle to submit ranked scores.' }, 401);
      }
      const player = getOrHydrateEdgePlayer(
        userId,
        typeof body.username === 'string' ? body.username : undefined,
        typeof body.className === 'string' ? body.className : undefined
      );
      if (!player) {
        return jsonResponse({ error: 'Player account not found.' }, 401);
      }
      let session = EDGE_PG_SESSIONS.get(sessionId);
      if (!session) {
        const parts = sessionId.split('_');
        const parsedGameId = gameIdBody || parts[2] || '';
        const parsedStart = Number(parts[3]) || Date.now() - 10000;
        if (!parsedGameId || !isValidPlaygroundGameId(parsedGameId)) {
          return jsonResponse({ error: 'Playground session not found.' }, 404);
        }
        session = {
          sessionId,
          userId,
          gameId: parsedGameId,
          startedAt: parsedStart,
          status: 'active',
          isTest: false,
        };
      }
      if (session.userId !== userId) {
        return jsonResponse({ error: 'Forbidden: session belongs to another player.' }, 403);
      }
      if (session.status !== 'active') {
        return jsonResponse({ error: 'Duplicate submission blocked.', alreadySubmitted: true }, 409);
      }

      const targetGameId = gameIdBody || session.gameId;
      const check = validatePlaygroundSubmission({
        gameId: targetGameId,
        score: Number(body.score ?? 0),
        rawMetric: body.rawMetric !== undefined ? Number(body.rawMetric) : undefined,
        completionTimeMs: body.completionTimeMs !== undefined ? Number(body.completionTimeMs) : undefined,
        accuracy: body.accuracy !== undefined ? Number(body.accuracy) : 100,
        startedAt: session.startedAt,
      });
      if (!check.valid) {
        return jsonResponse({ error: check.reason || 'Anti-cheat validation rejected score.' }, 400);
      }

      session.status = 'completed';
      EDGE_PG_SESSIONS.set(sessionId, session);

      const includeTest = session.isTest;
      const prevGlobalRank =
        queryEdgePlaygroundLeaderboard({ gameId: 'all', timeframe: 'global', userId, includeTest })
          .currentUserEntry?.rank ?? null;
      const prevGameRank =
        queryEdgePlaygroundLeaderboard({ gameId: targetGameId, timeframe: 'global', userId, includeTest })
          .currentUserEntry?.rank ?? null;
      const previousBestScore = EDGE_PG_RESULTS.filter(
        (r) => r.userId === userId && r.gameId === targetGameId && !r.isTest
      ).reduce<number | null>((mx, r) => (mx === null ? r.score : Math.max(mx, r.score)), null);

      const isPersonalBest = previousBestScore === null || check.sanitizedScore > previousBestScore;
      const won = body.won !== false && check.sanitizedScore > 0;
      const baseXp = Math.max(15, Math.min(220, Math.round(check.sanitizedScore * 0.08) + (won ? 20 : 5)));
      const nowIso = new Date().toISOString();
      const todayStr = nowIso.slice(0, 10);

      const achs: string[] = ['first_run'];
      if (PLAYGROUND_MINIGAME_MAP.has(targetGameId as GameModeId)) achs.push('first_minigame');
      if (TRACK_AND_LAB_GAME_IDS.has(targetGameId)) achs.push('first_build');
      if (isPersonalBest && previousBestScore !== null) achs.push('new_pb');
      if (check.sanitizedAccuracy === 100 && won) achs.push('perfect_run');

      let bonusDailyXp = 0;
      if (!includeTest && won) {
        const triple = getDailyTripleForDate(todayStr);
        const mgKey = `${userId}:${todayStr}:minigame`;
        if (
          targetGameId === triple.miniGame.gameId &&
          check.sanitizedScore >= triple.miniGame.targetScore &&
          !EDGE_DAILY_TRIPLE_CLAIMS.has(mgKey)
        ) {
          EDGE_DAILY_TRIPLE_CLAIMS.add(mgKey);
          bonusDailyXp += triple.miniGame.xpReward;
        }
        const bKey = `${userId}:${todayStr}:builder`;
        if (TRACK_AND_LAB_GAME_IDS.has(targetGameId) && !EDGE_DAILY_TRIPLE_CLAIMS.has(bKey)) {
          EDGE_DAILY_TRIPLE_CLAIMS.add(bKey);
          bonusDailyXp += triple.builder.xpReward;
        }
      }

      const progression = updateEdgePlayerProgression({
        player,
        xpEarned: baseXp + bonusDailyXp,
        maxStreak: won ? 1 : 0,
        newAchievements: achs,
      });

      const resultId = `pgr_edge_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      EDGE_PG_RESULTS.push({
        resultId,
        sessionId,
        userId,
        username: progression.player.name,
        className: progression.player.className,
        title: progression.player.title,
        level: progression.player.level,
        xp: progression.player.xp,
        streakBest: progression.player.streakBest,
        gameId: targetGameId,
        score: check.sanitizedScore,
        rawMetric: check.sanitizedMetric,
        completionTimeMs: check.sanitizedTimeMs,
        accuracy: check.sanitizedAccuracy,
        won,
        xpEarned: baseXp + bonusDailyXp,
        isTest: includeTest,
        createdAt: nowIso,
      });

      const globalBoardAfter = queryEdgePlaygroundLeaderboard({
        gameId: 'all',
        timeframe: 'global',
        userId,
        includeTest,
      });
      const gameBoardAfter = queryEdgePlaygroundLeaderboard({
        gameId: targetGameId,
        timeframe: 'global',
        userId,
        includeTest,
      });

      const def = getMiniGameDef(targetGameId as GameModeId);
      const funFacts = def?.funFacts || ['Verified engineering telemetry measures precision and control.'];

      const payload: PlaygroundResultPayload = {
        resultId,
        sessionId,
        gameId: targetGameId,
        userId,
        username: progression.player.name,
        score: check.sanitizedScore,
        rawMetric: check.sanitizedMetric,
        completionTimeMs: check.sanitizedTimeMs,
        accuracy: check.sanitizedAccuracy,
        won,
        isPersonalBest,
        previousBestScore,
        globalRank: globalBoardAfter.currentUserEntry?.rank ?? null,
        prevGlobalRank,
        gameRank: gameBoardAfter.currentUserEntry?.rank ?? null,
        prevGameRank,
        totalGamePlayers: gameBoardAfter.totalPlayers,
        xpEarned: baseXp + bonusDailyXp,
        leveledUp: progression.leveledUp,
        unlockedAchievements: progression.unlockedAchievements,
        funFact: funFacts[0],
        player: progression.player,
        createdAt: nowIso,
      };
      return jsonResponse(payload);
    }

    if (path === '/api/playground/leaderboard' && method === 'GET') {
      const gameId = (url.searchParams.get('gameId') ?? 'all').trim();
      const rawTf = (url.searchParams.get('timeframe') ?? 'global').toLowerCase();
      const timeframe: LeaderboardTimeframe =
        rawTf === 'daily' || rawTf === 'weekly' || rawTf === 'monthly' ? rawTf : 'global';
      const search = (url.searchParams.get('search') ?? '').trim();
      const userId = (url.searchParams.get('userId') ?? '').trim();
      return jsonResponse(
        queryEdgePlaygroundLeaderboard({
          gameId,
          timeframe,
          search,
          userId,
        })
      );
    }

    if (path === '/api/playground/events' && method === 'GET') {
      const userId = (url.searchParams.get('userId') ?? '').trim();
      const todayStr = new Date().toISOString().slice(0, 10);
      const flags = {
        quiz: Boolean(userId && EDGE_DAILY_TRIPLE_CLAIMS.has(`${userId}:${todayStr}:quiz`)),
        miniGame: Boolean(userId && EDGE_DAILY_TRIPLE_CLAIMS.has(`${userId}:${todayStr}:minigame`)),
        builder: Boolean(userId && EDGE_DAILY_TRIPLE_CLAIMS.has(`${userId}:${todayStr}:builder`)),
      };
      const personalBests: Record<string, { bestScore: number; bestTimeMs: number; plays: number }> = {};
      if (userId) {
        for (const r of EDGE_PG_RESULTS) {
          if (r.userId !== userId || r.isTest) continue;
          const prev = personalBests[r.gameId];
          if (!prev) {
            personalBests[r.gameId] = { bestScore: r.score, bestTimeMs: r.completionTimeMs, plays: 1 };
          } else {
            prev.bestScore = Math.max(prev.bestScore, r.score);
            prev.bestTimeMs = Math.min(prev.bestTimeMs, r.completionTimeMs);
            prev.plays += 1;
          }
        }
      }
      const dailyTriple = getDailyTripleForDate(todayStr, flags);
      const weeklyEvent = getWeeklyEventForDate(todayStr);
      const weeklyBoard = queryEdgePlaygroundLeaderboard({
        gameId: weeklyEvent.featuredGameId,
        timeframe: 'weekly',
        userId,
      });
      return jsonResponse({
        date: todayStr,
        dailyTriple,
        weeklyEvent,
        weeklyStandings: weeklyBoard.entries.slice(0, 10),
        personalBests,
        favoriteGameId: Object.entries(personalBests).sort((a, b) => b[1].plays - a[1].plays)[0]?.[0] ?? null,
      });
    }

    return jsonResponse({ error: `API endpoint not found: ${method} ${path}` }, 404);
  } catch (err) {
    return jsonResponse(
      { error: err instanceof Error ? err.message : 'Edge request handling failed.' },
      500
    );
  }
}

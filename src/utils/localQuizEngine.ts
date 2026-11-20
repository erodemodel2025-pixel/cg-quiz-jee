import { ALLOWED_ENGINEERING_CATEGORY_IDS, EXAM_CATEGORIES } from '../../shared/categories.ts';
import { getAllBuiltinExamQuestions } from '../../shared/examQuestions.ts';
import {
  CIRCUIT_STAGES,
  CODE_PUZZLES,
  COMPONENT_CARDS,
  LOGIC_PUZZLES,
} from '../../shared/minigameData.ts';
import {
  ACHIEVEMENTS,
  computeExamLevel,
  computeLevelFromXp,
  getDailyChallengeForDate,
  getUnlockedThemesForLevel,
} from '../../shared/progression.ts';
import { QUESTION_BANK } from '../../shared/questionBank.ts';
import {
  getModeScoringRules,
  selectBalancedQuizQuestions,
  shuffleQuestionOptions,
} from '../../shared/quizPipeline.ts';
import type {
  AnalyticsSummary,
  ClassOption,
  DailyExamStatus,
  ExamAnswerItem,
  ExamDifficulty,
  ExamEvaluatedDetail,
  ExamLeaderboardRow,
  ExamMode,
  ExamQuestion,
  ExamResultSummary,
  ExamSettings,
  ExamStreakState,
  ExamUserAnswer,
  GameModeId,
  LeaderboardEntry,
  MistakeCategory,
  MistakeRecord,
  PixelThemeId,
  PlayerProfile,
  PublicExamQuestion,
  QuizMode,
  SavedCreation,
  SpeedClass,
  TopicStat,
} from '../../shared/types.ts';

const LOCAL_STORE_KEY = 'cgquiz_static_cloud_store_v1';

interface LocalExamSession {
  sessionId: string;
  userId: string;
  mode: ExamMode;
  settings: ExamSettings;
  questionIds: string[];
  questions?: ExamQuestion[];
  startedAt: number;
  status: 'active' | 'submitted';
  adaptiveState: {
    currentDifficulty: ExamDifficulty;
    consecutiveCorrect: number;
    consecutiveWrong: number;
  };
}

interface LocalArcadeSession {
  sessionId: string;
  mode: QuizMode;
  gameType: GameModeId;
  playerId: string | null;
  categoryId: string;
  questionIds: string[];
  startedAt: number;
}

type StoredMistakeRecord = MistakeRecord & { userId: string };
type StoredAttempt = ExamResultSummary & { userId: string; subject: string; categoryId: string };
type StoredLeaderboardEntry = LeaderboardEntry & { mode: QuizMode };

interface LocalStore {
  profiles: Record<
    string,
    {
      userId: string;
      displayName: string | null;
      dailyStreak: number;
      bestDailyStreak: number;
      lastActiveDate: string | null;
      quizStreak: number;
      perfectStreak: number;
      examXp: number;
    }
  >;
  players: Record<string, PlayerProfile>;
  sessions: Record<string, LocalExamSession>;
  arcadeSessions: Record<string, LocalArcadeSession>;
  attempts: StoredAttempt[];
  mistakes: StoredMistakeRecord[];
  bookmarks: Record<string, string[]>;
  dailyCompletions: Record<string, DailyExamStatus>;
  arcadeLeaderboard: StoredLeaderboardEntry[];
  customQuestions: ExamQuestion[];
  creations: SavedCreation[];
}

function emptyStore(): LocalStore {
  return {
    profiles: {},
    players: {},
    sessions: {},
    arcadeSessions: {},
    attempts: [],
    mistakes: [],
    bookmarks: {},
    dailyCompletions: {},
    arcadeLeaderboard: [],
    customQuestions: [],
    creations: [],
  };
}

function readStore(): LocalStore {
  try {
    const raw = localStorage.getItem(LOCAL_STORE_KEY);
    if (!raw) return emptyStore();
    return { ...emptyStore(), ...(JSON.parse(raw) as Partial<LocalStore>) };
  } catch {
    return emptyStore();
  }
}

function writeStore(store: LocalStore): void {
  try {
    // Keep attempts bounded cleanly to avoid localStorage quota issues
    if (store.attempts.length > 60) {
      store.attempts = store.attempts.slice(0, 60);
    }
    const sessKeys = Object.keys(store.sessions);
    if (sessKeys.length > 25) {
      for (const k of sessKeys.slice(0, sessKeys.length - 25)) {
        delete store.sessions[k];
      }
    }
    localStorage.setItem(LOCAL_STORE_KEY, JSON.stringify(store));
  } catch {
    // ignore storage quota errors
  }
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function yesterdayUtc(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function getAllQuestions(store: LocalStore): ExamQuestion[] {
  const builtin = getAllBuiltinExamQuestions();
  const customMap = new Map(store.customQuestions.map((q) => [q.id, q]));
  const merged = builtin.map((b) => customMap.get(b.id) || b);
  for (const c of store.customQuestions) {
    if (!builtin.some((b) => b.id === c.id) && ALLOWED_ENGINEERING_CATEGORY_IDS.has(c.categoryId)) {
      merged.push(c);
    }
  }
  return merged;
}

function sanitizeQuestion(q: ExamQuestion): PublicExamQuestion {
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

function classifySpeed(
  isCorrect: boolean,
  isSkipped: boolean,
  timeMs: number,
  difficulty: ExamDifficulty
): SpeedClass {
  if (isSkipped) return 'SKIPPED';
  const fastThresholdMs = difficulty === 'Hard' || difficulty === 'Expert' ? 25000 : 14000;
  const isFast = timeMs <= fastThresholdMs;
  if (isCorrect) return isFast ? 'FAST+CORRECT' : 'SLOW+CORRECT';
  return isFast ? 'FAST+WRONG' : 'SLOW+WRONG';
}

function ensureProfile(store: LocalStore, userId: string, displayName?: string) {
  const existingPlayer = store.players[userId];
  const resolved = displayName?.trim() || existingPlayer?.name || null;
  if (!store.profiles[userId]) {
    store.profiles[userId] = {
      userId,
      displayName: resolved,
      dailyStreak: 0,
      bestDailyStreak: 0,
      lastActiveDate: null,
      quizStreak: 0,
      perfectStreak: 0,
      examXp: 0,
    };
  } else if (resolved && store.profiles[userId].displayName !== resolved) {
    store.profiles[userId].displayName = resolved;
  }
  return store.profiles[userId];
}

function parseBody(init?: RequestInit): Record<string, unknown> {
  if (!init?.body || typeof init.body !== 'string') return {};
  try {
    return JSON.parse(init.body) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export interface LocalApiResult {
  handled: boolean;
  ok: boolean;
  status: number;
  data: unknown;
  error: string | null;
}

export function handleLocalApiRequest(urlStr: string, init?: RequestInit): LocalApiResult {
  const method = (init?.method || 'GET').toUpperCase();
  const parsedUrl = new URL(urlStr, 'http://localhost');
  const pathname = parsedUrl.pathname;
  const params = parsedUrl.searchParams;
  const body = parseBody(init);
  const store = readStore();

  const ok = (data: unknown, status = 200): LocalApiResult => ({
    handled: true,
    ok: true,
    status,
    data,
    error: null,
  });
  const fail = (error: string, status = 400): LocalApiResult => ({
    handled: true,
    ok: false,
    status,
    data: { error },
    error,
  });

  // 1. /api/exam/categories
  if (pathname === '/api/exam/categories' && method === 'GET') {
    const all = getAllQuestions(store);
    const subjects = [...new Set(all.map((q) => q.subject))].sort();
    const chaptersBySubject: Record<string, string[]> = {};
    const countByCategory: Record<string, number> = {};
    const diffByCategory: Record<string, Record<string, number>> = {};
    for (const q of all) {
      countByCategory[q.categoryId] = (countByCategory[q.categoryId] || 0) + 1;
      if (!diffByCategory[q.categoryId]) {
        diffByCategory[q.categoryId] = { Easy: 0, Medium: 0, Hard: 0, Expert: 0 };
      }
      diffByCategory[q.categoryId][q.difficulty] =
        (diffByCategory[q.categoryId][q.difficulty] || 0) + 1;
      if (!chaptersBySubject[q.subject]) chaptersBySubject[q.subject] = [];
      if (!chaptersBySubject[q.subject].includes(q.chapter)) {
        chaptersBySubject[q.subject].push(q.chapter);
      }
    }
    return ok({
      categories: EXAM_CATEGORIES.map((c) => ({
        ...c,
        questionCount: countByCategory[c.id] || 0,
        difficultyCounts: diffByCategory[c.id] || { Easy: 0, Medium: 0, Hard: 0, Expert: 0 },
      })),
      subjects,
      chaptersBySubject,
      totalVerifiedQuestions: all.length,
    });
  }

  // 2. /api/exam/questions
  if (pathname === '/api/exam/questions' && method === 'GET') {
    const qText = (params.get('q') || '').trim().toLowerCase();
    const categoryId = params.get('categoryId') || 'all';
    const subject = params.get('subject') || 'all';
    const difficulty = params.get('difficulty') || 'all';
    const source = params.get('source') || 'all';
    const questionType = params.get('questionType') || 'all';
    const page = Math.max(1, Number(params.get('page') || 1));
    const limit = Math.min(50, Math.max(5, Number(params.get('limit') || 20)));

    let pool = getAllQuestions(store);
    if (categoryId !== 'all') pool = pool.filter((x) => x.categoryId === categoryId);
    if (subject !== 'all') pool = pool.filter((x) => x.subject === subject);
    if (difficulty !== 'all') pool = pool.filter((x) => x.difficulty === difficulty);
    if (source !== 'all') {
      pool =
        source === 'PYQ'
          ? pool.filter((x) => x.source.toUpperCase().includes('PYQ'))
          : pool.filter((x) => x.source === source);
    }
    if (questionType !== 'all') pool = pool.filter((x) => x.questionType === questionType);
    if (qText) {
      pool = pool.filter(
        (x) =>
          x.question.toLowerCase().includes(qText) ||
          x.topic.toLowerCase().includes(qText) ||
          x.chapter.toLowerCase().includes(qText) ||
          x.subject.toLowerCase().includes(qText)
      );
    }
    const total = pool.length;
    const start = (page - 1) * limit;
    return ok({
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      items: pool.slice(start, start + limit),
    });
  }

  // 3. /api/exam/daily-status
  if (pathname === '/api/exam/daily-status' && method === 'GET') {
    const userId = (params.get('userId') || '').trim();
    const today = todayUtc();
    const key = `${userId}_${today}`;
    const existing = store.dailyCompletions[key];
    return ok(existing || { date: today, completed: false });
  }

  // 4. /api/exam/start
  if (pathname === '/api/exam/start' && method === 'POST') {
    const userId = String(body.userId ?? '').trim() || 'guest_local';
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
    const negativeMarking = scoringRule.negativeMarking;
    const requestedIds = Array.isArray(body.questionIds) ? (body.questionIds as string[]) : null;
    const excludeQuestionIds = Array.isArray(body.excludeQuestionIds)
      ? body.excludeQuestionIds.map(String)
      : [];

    ensureProfile(store, userId, body.displayName ? String(body.displayName) : undefined);

    if (mode === 'daily' && store.dailyCompletions[`${userId}_${todayUtc()}`]) {
      return fail(
        'Today’s Daily Challenge is already completed. Try Quick Quiz or Arcade mode!',
        409
      );
    }

    const all = getAllQuestions(store);
    const qMap = new Map(all.map((q) => [q.id, q]));
    const userMistakes = store.mistakes.filter((m) => m.userId === userId && !m.resolved);

    const rawSelected =
      requestedIds && requestedIds.length > 0
        ? requestedIds.map((id) => qMap.get(id)).filter((q): q is ExamQuestion => Boolean(q))
        : selectBalancedQuizQuestions({
            allQuestions: all,
            mode,
            categoryId,
            subject,
            chapter,
            difficulty,
            questionType,
            questionCount: Number(body.questionCount ?? 0) || undefined,
            excludeQuestionIds,
            mistakeQuestionIds: userMistakes.map((m) => m.questionId),
            weakTopics: [...new Set(userMistakes.map((m) => m.topic))],
            weakSubjects: [...new Set(userMistakes.map((m) => m.subject))],
            seedStr: mode === 'daily' ? todayUtc() : undefined,
          });

    const selected = rawSelected.map((q) => shuffleQuestionOptions(q));

    const defaultMinutes =
      mode === 'rapid'
        ? 2
        : mode === 'quick' || mode === 'career_fair'
          ? 8
          : mode === 'mock' || mode === 'jee'
            ? 20
            : 15;
    const timeLimitSeconds = Math.max(60, Math.round(Number(body.timeLimitMinutes ?? defaultMinutes) * 60));
    const sessionId = `exs_local_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    const settings: ExamSettings = {
      mode,
      categoryId,
      subject,
      chapter,
      difficulty,
      questionType,
      questionCount: selected.length,
      timeLimitMinutes: Math.round(timeLimitSeconds / 60),
      negativeMarking,
      smartBoardMode: Boolean(body.smartBoardMode),
      adaptiveEnabled:
        body.adaptiveEnabled !== undefined ? Boolean(body.adaptiveEnabled) : difficulty === 'Adaptive',
      excludeQuestionIds,
    };

    const adaptiveState = {
      currentDifficulty: (difficulty !== 'Mixed' && difficulty !== 'Adaptive'
        ? difficulty
        : 'Medium') as ExamDifficulty,
      consecutiveCorrect: 0,
      consecutiveWrong: 0,
    };

    store.sessions[sessionId] = {
      sessionId,
      userId,
      mode,
      settings,
      questionIds: selected.map((q) => q.id),
      questions: selected,
      startedAt: Date.now(),
      status: 'active',
      adaptiveState,
    };
    writeStore(store);

    return ok({
      sessionId,
      mode,
      settings,
      timeLimitSeconds,
      adaptiveState,
      scoringRule,
      questions: selected.map(sanitizeQuestion),
    });
  }

  // 5. /api/exam/check-answer
  if (pathname === '/api/exam/check-answer' && method === 'POST') {
    const sessionId = String(body.sessionId ?? '');
    const questionId = String(body.questionId ?? '');
    const userAnswer = body.userAnswer as ExamUserAnswer;
    const sess = store.sessions[sessionId];
    const q =
      sess?.questions?.find((x) => x.id === questionId) ||
      getAllQuestions(store).find((x) => x.id === questionId);
    if (!q) return fail('Question not found.', 404);

    const correct = evaluateAnswer(q, userAnswer);
    const diffs: ExamDifficulty[] = ['Easy', 'Medium', 'Hard', 'Expert'];
    if (sess) {
      const idx = diffs.indexOf(sess.adaptiveState.currentDifficulty);
      if (correct) {
        sess.adaptiveState.consecutiveCorrect += 1;
        sess.adaptiveState.consecutiveWrong = 0;
        if (sess.adaptiveState.consecutiveCorrect >= 3 && idx < diffs.length - 1) {
          sess.adaptiveState.currentDifficulty = diffs[idx + 1];
          sess.adaptiveState.consecutiveCorrect = 0;
        }
      } else {
        sess.adaptiveState.consecutiveWrong += 1;
        sess.adaptiveState.consecutiveCorrect = 0;
        if (sess.adaptiveState.consecutiveWrong >= 3 && idx > 0) {
          sess.adaptiveState.currentDifficulty = diffs[idx - 1];
          sess.adaptiveState.consecutiveWrong = 0;
        }
      }
      writeStore(store);
    }

    return ok({
      correct,
      correctAnswer: q.answer,
      explanation: q.explanation,
      source: q.source,
      year: q.year,
      adaptiveState: sess?.adaptiveState || { currentDifficulty: 'Medium' },
    });
  }

  // 6. /api/exam/submit
  if (pathname === '/api/exam/submit' && method === 'POST') {
    const sessionId = String(body.sessionId ?? '');
    const userId = String(body.userId ?? '').trim() || 'guest_local';
    const answersInput = Array.isArray(body.answers) ? (body.answers as ExamAnswerItem[]) : [];

    const session = store.sessions[sessionId];
    if (!session) return fail('Quiz session not found.', 404);
    if (session.status !== 'active') return fail('Quiz session already submitted.', 409);

    const profile = ensureProfile(store, userId, body.displayName ? String(body.displayName) : undefined);
    const baseQs = new Map(getAllQuestions(store).map((q) => [q.id, q]));
    const snapQs = new Map((session.questions || []).map((q) => [q.id, q]));
    const allQs = new Map<string, ExamQuestion>([...baseQs, ...snapQs]);
    const answerByQ = new Map(answersInput.map((a) => [a.questionId, a]));

    const scoringRule = getModeScoringRules(session.mode, session.settings.negativeMarking);
    const marksPerCorrect = scoringRule.marksPerCorrect;
    const negPenalty = scoringRule.negativeMarking;
    let score = 0;
    let maxScore = 0;
    let correctCount = 0;
    let wrongCount = 0;
    let skippedCount = 0;
    let totalTimeMs = 0;
    let mistakesSavedCount = 0;

    const speedMatrix: Record<SpeedClass, number> = {
      'FAST+CORRECT': 0,
      'SLOW+CORRECT': 0,
      'FAST+WRONG': 0,
      'SLOW+WRONG': 0,
      SKIPPED: 0,
    };
    const topicMap = new Map<string, { subject: string; attempted: number; correct: number; totalMs: number }>();
    const details: ExamEvaluatedDetail[] = [];
    const nowIso = new Date().toISOString();

    for (const qId of session.questionIds) {
      const q = allQs.get(qId);
      if (!q) continue;
      maxScore += marksPerCorrect;
      const ansObj = answerByQ.get(qId);
      const userAns = ansObj ? ansObj.userAnswer : null;
      const timeMs = Math.max(500, Math.min(300000, Number(ansObj?.timeMs ?? 10000)));
      totalTimeMs += timeMs;

      const skipped = isAnswerSkipped(q, userAns);
      const correct = !skipped && evaluateAnswer(q, userAns);
      const speedClass = classifySpeed(correct, skipped, timeMs, q.difficulty);
      speedMatrix[speedClass] += 1;

      let marksAwarded = 0;
      if (skipped) {
        skippedCount += 1;
      } else if (correct) {
        correctCount += 1;
        marksAwarded = marksPerCorrect;
        score += marksPerCorrect;
        if (session.mode === 'revision' || session.mode === 'weak') {
          for (const mk of store.mistakes) {
            if (mk.userId === userId && mk.questionId === q.id) mk.resolved = true;
          }
        }
      } else {
        wrongCount += 1;
        marksAwarded = -negPenalty;
        score -= negPenalty;
        const existingMk = store.mistakes.find((m) => m.userId === userId && m.questionId === q.id);
        if (existingMk) {
          existingMk.timesMissed += 1;
          existingMk.resolved = false;
          existingMk.lastMissedAt = nowIso;
        } else {
          store.mistakes.unshift({
            id: `mk_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            userId,
            questionId: q.id,
            subject: q.subject,
            topic: q.topic,
            mistakeCategory: speedClass === 'FAST+WRONG' ? 'careless' : 'concept',
            notes: '',
            timesMissed: 1,
            resolved: false,
            lastMissedAt: nowIso,
            question: q,
          });
        }
        mistakesSavedCount += 1;
      }

      if (!topicMap.has(q.topic)) {
        topicMap.set(q.topic, { subject: q.subject, attempted: 0, correct: 0, totalMs: 0 });
      }
      const te = topicMap.get(q.topic)!;
      if (!skipped) te.attempted += 1;
      if (correct) te.correct += 1;
      te.totalMs += timeMs;

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

    const totalQuestions = details.length || 1;
    const attempted = correctCount + wrongCount;
    const accuracy = attempted > 0 ? Math.round((correctCount / attempted) * 1000) / 10 : 0;
    const elapsedSeconds = Math.max(1, Math.round((Date.now() - session.startedAt) / 1000));
    const avgTimePerQuestion = Math.round((totalTimeMs / totalQuestions / 1000) * 10) / 10;

    const topicBreakdown: TopicStat[] = [...topicMap.entries()].map(([topic, d]) => ({
      topic,
      subject: d.subject,
      attempted: d.attempted,
      correct: d.correct,
      accuracy: d.attempted > 0 ? Math.round((d.correct / d.attempted) * 100) : 0,
      avgTimeSec: Math.round((d.totalMs / Math.max(1, d.attempted) / 1000) * 10) / 10,
    }));

    const strongTopics = topicBreakdown.filter((t) => t.attempted > 0 && t.accuracy >= 70);
    const weakTopics = [...topicBreakdown]
      .filter((t) => t.attempted > 0 && t.accuracy < 65)
      .sort((a, b) => a.accuracy - b.accuracy);

    const today = todayUtc();
    const yday = yesterdayUtc();
    if (profile.lastActiveDate === today) {
      profile.dailyStreak = Math.max(1, profile.dailyStreak);
    } else if (profile.lastActiveDate === yday) {
      profile.dailyStreak += 1;
    } else {
      profile.dailyStreak = 1;
    }
    profile.bestDailyStreak = Math.max(profile.bestDailyStreak, profile.dailyStreak);
    profile.lastActiveDate = today;
    profile.quizStreak += 1;
    profile.perfectStreak = accuracy === 100 && wrongCount === 0 ? profile.perfectStreak + 1 : 0;
    const xpEarned = Math.max(10, correctCount * 12 + (accuracy === 100 ? 35 : 0));
    profile.examXp += xpEarned;
    const lvl = computeExamLevel(profile.examXp);

    const streaks: ExamStreakState = {
      dailyStreak: profile.dailyStreak,
      bestDailyStreak: profile.bestDailyStreak,
      quizStreak: profile.quizStreak,
      perfectStreak: profile.perfectStreak,
      examXp: profile.examXp,
      examLevel: lvl.title,
    };

    const attemptId = `att_local_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    session.status = 'submitted';

    const result: ExamResultSummary = {
      attemptId,
      sessionId,
      mode: session.mode,
      score,
      maxScore,
      correctCount,
      wrongCount,
      skippedCount,
      totalQuestions,
      accuracy,
      timeSpentSeconds: elapsedSeconds,
      avgTimePerQuestion,
      negativeMarking: negPenalty,
      xpEarned,
      streaks,
      speedMatrix,
      topicBreakdown,
      didWell: strongTopics.length
        ? strongTopics.slice(0, 2).map((s) => `Strong accuracy in ${s.topic} (${s.accuracy}%).`)
        : [`Completed ${totalQuestions} engineering challenges (${accuracy}% accuracy).`],
      needsImprovement: weakTopics.length
        ? weakTopics.slice(0, 2).map((w) => `Review ${w.topic} concepts (${w.accuracy}%).`)
        : ['Step up to Hard difficulty for your next engineering run!'],
      examStrategyNote: null,
      nextRecommendation: weakTopics[0]
        ? {
            label: `Drill ${weakTopics[0].topic}`,
            categoryId: session.settings.categoryId,
            subject: weakTopics[0].subject,
            topic: weakTopics[0].topic,
            difficulty: 'Medium',
          }
        : {
            label: 'Challenge Hard Engineering Mode',
            categoryId: session.settings.categoryId,
            subject: session.settings.subject,
            difficulty: 'Hard',
          },
      mistakesSavedCount,
      rank: session.mode === 'daily' ? 1 : null,
      details,
      createdAt: nowIso,
    };

    if (session.mode === 'daily') {
      store.dailyCompletions[`${userId}_${today}`] = {
        date: today,
        completed: true,
        attemptId,
        score,
        maxScore,
        accuracy,
        timeSpentSeconds: elapsedSeconds,
        rank: 1,
        totalParticipants: 1,
        weakArea: weakTopics[0]?.topic ?? null,
      };
    }

    store.attempts.unshift({
      ...result,
      userId,
      subject: session.settings.subject,
      categoryId: session.settings.categoryId,
    });
    writeStore(store);

    return ok(result);
  }

  // 7. /api/exam/analytics
  if (pathname === '/api/exam/analytics' && method === 'GET') {
    const userId = (params.get('userId') || '').trim();
    const rangeParam = (params.get('range') || '30d') as '7d' | '30d' | 'all';
    const range: '7d' | '30d' | 'all' =
      rangeParam === '7d' || rangeParam === 'all' ? rangeParam : '30d';
    const profile = ensureProfile(store, userId);
    const lvl = computeExamLevel(profile.examXp);
    const userAttempts = store.attempts.filter((a) => a.userId === userId || !userId);
    const streaks: ExamStreakState = {
      dailyStreak: profile.dailyStreak,
      bestDailyStreak: profile.bestDailyStreak,
      quizStreak: profile.quizStreak,
      perfectStreak: profile.perfectStreak,
      examXp: profile.examXp,
      examLevel: lvl.title,
    };

    if (userAttempts.length === 0) {
      return ok({
        hasData: false,
        range,
        totalQuizzes: 0,
        totalAttempted: 0,
        totalCorrect: 0,
        totalWrong: 0,
        overallAccuracy: 0,
        avgTimePerQuestion: 0,
        bestScore: 0,
        streaks,
        chartSeries: [],
        subjectPerformance: [],
        strongTopics: [],
        weakTopics: [],
        mistakenConcepts: [],
        speedMatrix: { 'FAST+CORRECT': 0, 'SLOW+CORRECT': 0, 'FAST+WRONG': 0, 'SLOW+WRONG': 0, SKIPPED: 0 },
        recentAttempts: [],
      } satisfies AnalyticsSummary);
    }

    let totalCorrect = 0;
    let totalWrong = 0;
    let bestScore = 0;
    let timeSum = 0;
    const speedMatrix: Record<SpeedClass, number> = {
      'FAST+CORRECT': 0,
      'SLOW+CORRECT': 0,
      'FAST+WRONG': 0,
      'SLOW+WRONG': 0,
      SKIPPED: 0,
    };
    const subjMap = new Map<string, { attempted: number; correct: number }>();

    for (const a of userAttempts) {
      totalCorrect += a.correctCount;
      totalWrong += a.wrongCount;
      bestScore = Math.max(bestScore, a.score);
      timeSum += a.avgTimePerQuestion;
      for (const k of Object.keys(speedMatrix) as SpeedClass[]) {
        speedMatrix[k] += a.speedMatrix[k] || 0;
      }
      for (const t of a.topicBreakdown) {
        if (!subjMap.has(t.subject)) subjMap.set(t.subject, { attempted: 0, correct: 0 });
        const se = subjMap.get(t.subject)!;
        se.attempted += t.attempted;
        se.correct += t.correct;
      }
    }

    const totalAttempted = totalCorrect + totalWrong;
    return ok({
      hasData: true,
      range,
      totalQuizzes: userAttempts.length,
      totalAttempted,
      totalCorrect,
      totalWrong,
      overallAccuracy: totalAttempted > 0 ? Math.round((totalCorrect / totalAttempted) * 100) : 0,
      avgTimePerQuestion: Math.round((timeSum / userAttempts.length) * 10) / 10,
      bestScore,
      streaks,
      chartSeries: [...userAttempts]
        .slice(0, 10)
        .reverse()
        .map((a) => ({
          date: a.createdAt.slice(0, 10),
          label: a.createdAt.slice(5, 10),
          accuracy: Math.round(a.accuracy),
          score: Math.round(a.score),
          quizzes: 1,
        })),
      subjectPerformance: [...subjMap.entries()].map(([subject, s]) => ({
        subject,
        attempted: s.attempted,
        correct: s.correct,
        accuracy: s.attempted > 0 ? Math.round((s.correct / s.attempted) * 100) : 0,
      })),
      strongTopics: [],
      weakTopics: [],
      mistakenConcepts: [],
      speedMatrix,
      recentAttempts: userAttempts.slice(0, 15).map((a) => ({
        attemptId: a.attemptId,
        mode: a.mode,
        subject: a.subject,
        score: a.score,
        maxScore: a.maxScore,
        accuracy: a.accuracy,
        totalQuestions: a.totalQuestions,
        timeSpentSeconds: a.timeSpentSeconds,
        createdAt: a.createdAt,
      })),
    } satisfies AnalyticsSummary);
  }

  // 8. /api/exam/history/:attemptId
  if (pathname.startsWith('/api/exam/history/') && method === 'GET') {
    const attemptId = decodeURIComponent(pathname.replace('/api/exam/history/', ''));
    const found = store.attempts.find((a) => a.attemptId === attemptId);
    if (!found) return fail('Attempt not found.', 404);
    return ok(found);
  }

  // 9. /api/exam/mistakes
  if (pathname === '/api/exam/mistakes' && method === 'GET') {
    const userId = (params.get('userId') || '').trim();
    const qMap = new Map(getAllQuestions(store).map((q) => [q.id, q]));
    const list = store.mistakes
      .filter((m) => m.userId === userId && !m.resolved)
      .map((m) => ({ ...m, question: m.question || qMap.get(m.questionId) }));
    return ok({ mistakes: list });
  }
  if (pathname.startsWith('/api/exam/mistakes/') && method === 'PATCH') {
    const qId = decodeURIComponent(pathname.replace('/api/exam/mistakes/', ''));
    const userId = String(body.userId ?? '');
    const cat = String(body.mistakeCategory ?? 'concept') as MistakeCategory;
    for (const m of store.mistakes) {
      if (m.userId === userId && m.questionId === qId) m.mistakeCategory = cat;
    }
    writeStore(store);
    return ok({ ok: true });
  }
  if (pathname.startsWith('/api/exam/mistakes/') && method === 'DELETE') {
    const qId = decodeURIComponent(pathname.replace('/api/exam/mistakes/', ''));
    const userId = params.get('userId') || '';
    store.mistakes = store.mistakes.filter((m) => !(m.userId === userId && m.questionId === qId));
    writeStore(store);
    return ok({ ok: true });
  }

  // 10. /api/exam/bookmarks
  if (pathname === '/api/exam/bookmarks' && method === 'GET') {
    const userId = (params.get('userId') || '').trim();
    const ids = store.bookmarks[userId] || [];
    const qMap = new Map(getAllQuestions(store).map((q) => [q.id, q]));
    return ok({
      ids,
      items: ids.map((id) => qMap.get(id)).filter((q): q is ExamQuestion => Boolean(q)),
    });
  }
  if (pathname.startsWith('/api/exam/bookmarks/') && method === 'POST') {
    const qId = decodeURIComponent(pathname.replace('/api/exam/bookmarks/', ''));
    const userId = String(body.userId ?? '');
    const list = new Set(store.bookmarks[userId] || []);
    list.add(qId);
    store.bookmarks[userId] = [...list];
    writeStore(store);
    return ok({ bookmarked: true });
  }
  if (pathname.startsWith('/api/exam/bookmarks/') && method === 'DELETE') {
    const qId = decodeURIComponent(pathname.replace('/api/exam/bookmarks/', ''));
    const userId = params.get('userId') || '';
    store.bookmarks[userId] = (store.bookmarks[userId] || []).filter((id) => id !== qId);
    writeStore(store);
    return ok({ bookmarked: false });
  }

  // 11. /api/exam/leaderboard & display-name
  if (pathname === '/api/exam/profile/display-name' && method === 'POST') {
    const userId = String(body.userId ?? '').trim();
    const displayName = String(body.displayName ?? '').trim().slice(0, 32);
    const profile = ensureProfile(store, userId, displayName);
    profile.displayName = displayName || null;
    if (store.players[userId] && displayName) {
      store.players[userId].name = displayName;
    }
    writeStore(store);
    return ok({ ok: true, displayName: profile.displayName });
  }

  if (pathname === '/api/exam/leaderboard' && method === 'GET') {
    const search = (params.get('search') || '').trim().toLowerCase();
    const rows: ExamLeaderboardRow[] = Object.values(store.profiles)
      .filter((p) => p.examXp > 0)
      .map((p) => {
        const lvl = computeExamLevel(p.examXp);
        const attempts = store.attempts.filter((a) => a.userId === p.userId);
        const avgAcc = attempts.length
          ? Math.round(attempts.reduce((s, a) => s + a.accuracy, 0) / attempts.length)
          : 0;
        const bestScore = attempts.reduce((mx, a) => Math.max(mx, a.score), 0);
        return {
          rank: 1,
          playerId: p.userId,
          displayName: p.displayName || 'Anonymous Builder',
          xp: p.examXp,
          levelTitle: lvl.title,
          accuracy: avgAcc,
          quizzesCompleted: attempts.length,
          bestScore,
        };
      })
      .filter((r) => !search || r.displayName.toLowerCase().includes(search))
      .sort((a, b) => b.xp - a.xp)
      .map((r, idx) => ({ ...r, rank: idx + 1 }));
    return ok({ entries: rows });
  }

  // 12. Player registration & profile (/api/players/*)
  if (pathname === '/api/players/register' && method === 'POST') {
    const name = String(body.name ?? '').trim();
    const className = (String(body.className ?? 'Other').trim() || 'Other') as ClassOption;
    const existingId = body.existingId ? String(body.existingId) : null;
    if (name.length < 2) return fail('Player name must be at least 2 characters.', 400);

    const id = existingId || `p_local_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const existing = store.players[id];
    const player: PlayerProfile = existing || {
      id,
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
    player.name = name;
    player.className = className;
    store.players[id] = player;
    ensureProfile(store, id, name);
    writeStore(store);
    return ok({ player }, 201);
  }

  if (pathname.startsWith('/api/players/') && method === 'GET') {
    const id = decodeURIComponent(pathname.replace('/api/players/', ''));
    const p = store.players[id];
    if (!p) return fail('Player not found.', 404);
    return ok({ player: p });
  }

  if (pathname.endsWith('/theme') && pathname.startsWith('/api/players/') && method === 'POST') {
    const id = decodeURIComponent(pathname.split('/')[3] || '');
    const themeId = String(body.themeId ?? 'cyber-midnight') as PixelThemeId;
    if (store.players[id]) {
      store.players[id].activeTheme = themeId;
      writeStore(store);
    }
    return ok({ activeTheme: themeId });
  }

  if (pathname.endsWith('/achievement') && pathname.startsWith('/api/players/') && method === 'POST') {
    const id = decodeURIComponent(pathname.split('/')[3] || '');
    const achievementId = String(body.achievementId ?? '');
    const player = store.players[id];
    if (player && !player.achievements.includes(achievementId)) {
      player.achievements.push(achievementId);
      const ach = ACHIEVEMENTS.find((a) => a.id === achievementId);
      if (ach) {
        player.xp += ach.xpBonus;
        const lvl = computeLevelFromXp(player.xp);
        player.level = lvl.level;
        player.title = lvl.title;
        player.unlockedThemes = getUnlockedThemesForLevel(lvl.level);
      }
      writeStore(store);
    }
    return ok({ player });
  }

  // 13. Arcade Quiz & Mini-Games (/api/quiz/* & /api/minigame/* & /api/leaderboard)
  if (pathname === '/api/quiz/start' && method === 'POST') {
    const mode = String(body.mode ?? 'practice') as QuizMode;
    const gameType = String(body.gameType ?? 'iq-quiz') as GameModeId;
    const categoryId = String(body.categoryId ?? 'all');
    const playerId = body.playerId ? String(body.playerId) : null;

    let pool = [...QUESTION_BANK];
    if (categoryId !== 'all') {
      const f = pool.filter((q) => q.categoryId === categoryId);
      if (f.length > 0) pool = f;
    }
    const picked = shuffle(pool).slice(0, gameType === 'boss-battle' ? 8 : 10);
    const sessionId = `qz_local_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    store.arcadeSessions[sessionId] = {
      sessionId,
      mode,
      gameType,
      playerId,
      categoryId,
      questionIds: picked.map((q) => q.id),
      startedAt: Date.now(),
    };
    writeStore(store);
    return ok({
      sessionId,
      questions: picked.map(({ correctIndex: _c, explanation: _e, ...pub }) => pub),
    });
  }

  if (pathname === '/api/quiz/check' && method === 'POST') {
    const qId = String(body.questionId ?? '');
    const selectedIndex = Number(body.selectedIndex ?? -1);
    const q = QUESTION_BANK.find((x) => x.id === qId);
    if (!q) return fail('Question not found', 404);
    return ok({
      correct: selectedIndex === q.correctIndex,
      correctIndex: q.correctIndex,
      explanation: q.explanation,
      reference: q.reference,
    });
  }

  if (pathname === '/api/quiz/submit' && method === 'POST') {
    const sessionId = String(body.sessionId ?? '');
    const sess = store.arcadeSessions[sessionId];
    const answers = Array.isArray(body.answers)
      ? (body.answers as Array<{ questionId: string; selectedIndex: number }>)
      : [];
    let correctCount = 0;
    let streak = 0;
    let maxStreak = 0;
    const details = answers.map((a) => {
      const q = QUESTION_BANK.find((x) => x.id === a.questionId);
      const isCorrect = q ? a.selectedIndex === q.correctIndex : false;
      if (isCorrect) {
        correctCount++;
        streak++;
        maxStreak = Math.max(maxStreak, streak);
      } else {
        streak = 0;
      }
      return {
        questionId: a.questionId,
        selectedIndex: a.selectedIndex,
        correctIndex: q?.correctIndex ?? 0,
        isCorrect,
        explanation: q?.explanation ?? '',
        reference: q?.reference ?? '',
      };
    });
    const total = Math.max(1, answers.length);
    const accuracy = Math.round((correctCount / total) * 100);
    const score = correctCount * 150 + maxStreak * 40;
    const xpEarned = Math.max(15, correctCount * 20);

    let updatedPlayer: PlayerProfile | null = null;
    if (sess?.playerId && store.players[sess.playerId]) {
      const p = store.players[sess.playerId];
      p.xp += xpEarned;
      p.gamesPlayed += 1;
      p.streakBest = Math.max(p.streakBest, maxStreak);
      const lvl = computeLevelFromXp(p.xp);
      p.level = lvl.level;
      p.title = lvl.title;
      p.unlockedThemes = getUnlockedThemesForLevel(lvl.level);
      updatedPlayer = p;
      store.arcadeLeaderboard.push({
        playerId: p.id,
        playerName: p.name,
        className: p.className,
        title: p.title,
        level: p.level,
        bestScore: score,
        totalScore: score,
        accuracy,
        gamesCount: 1,
        bestStreak: maxStreak,
        gameType: sess.gameType,
        mode: sess.mode,
      });
      writeStore(store);
    }

    return ok({
      score,
      correctCount,
      totalQuestions: answers.length,
      accuracy,
      maxStreak,
      xpEarned,
      leveledUp: false,
      unlockedAchievements: [],
      newlyUnlockedThemes: [],
      player: updatedPlayer,
      details,
    });
  }

  if (pathname === '/api/minigame/start' && method === 'POST') {
    const gameType = String(body.gameType ?? 'code-breaker') as GameModeId;
    const playerId = body.playerId ? String(body.playerId) : null;
    const sessionId = `mg_local_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    let payloadIds: string[] = [];
    let items: unknown = [];

    if (gameType === 'circuit-rush') {
      payloadIds = CIRCUIT_STAGES.map((s) => s.id);
      items = CIRCUIT_STAGES;
    } else if (gameType === 'component-match') {
      payloadIds = COMPONENT_CARDS.map((c) => c.id);
      items = COMPONENT_CARDS;
    } else if (gameType === 'logic-lab') {
      const picked = shuffle(LOGIC_PUZZLES).slice(0, 6);
      payloadIds = picked.map((p) => p.id);
      items = picked.map(({ correctIndex: _c, explanation: _e, ...pub }) => pub);
    } else {
      const picked = shuffle(CODE_PUZZLES).slice(0, 6);
      payloadIds = picked.map((p) => p.id);
      items = picked.map(({ correctIndex: _c, explanation: _e, ...pub }) => pub);
    }

    store.arcadeSessions[sessionId] = {
      sessionId,
      mode: 'practice',
      gameType,
      playerId,
      categoryId: 'all',
      questionIds: payloadIds,
      startedAt: Date.now(),
    };
    writeStore(store);
    return ok({ sessionId, gameType, startedAt: Date.now(), items });
  }

  if (pathname === '/api/minigame/check' && method === 'POST') {
    const sessionId = String(body.sessionId ?? '');
    const sess = store.arcadeSessions[sessionId];
    const gameType = sess?.gameType || String(body.gameType ?? 'code-breaker');
    const itemId = String(body.itemId ?? body.puzzleId ?? '');
    const selectedIndex = Number(body.selectedIndex ?? -1);
    const list = gameType === 'logic-lab' ? LOGIC_PUZZLES : CODE_PUZZLES;
    const p = list.find((x) => x.id === itemId);
    if (!p) return fail('Puzzle not found.', 404);
    return ok({
      correct: selectedIndex === p.correctIndex,
      correctIndex: p.correctIndex,
      explanation: p.explanation,
    });
  }

  if (pathname === '/api/minigame/submit' && method === 'POST') {
    const sessionId = String(body.sessionId ?? '');
    const sess = store.arcadeSessions[sessionId];
    const gameType = (sess?.gameType || String(body.gameType ?? 'code-breaker')) as GameModeId;
    const playerId = body.playerId ? String(body.playerId) : sess?.playerId || null;
    const elapsedSeconds = sess
      ? Math.max(2, Math.round((Date.now() - sess.startedAt) / 1000))
      : 15;

    let score = 0;
    let correctCount = 0;
    let totalQuestions = 0;
    let maxStreak = 0;
    const details: Array<{ id: string; title: string; correct: boolean; explanation: string }> = [];

    if (gameType === 'code-breaker' || gameType === 'logic-lab') {
      const answers = Array.isArray(body.answers)
        ? (body.answers as Array<{ id: string; selectedIndex: number }>)
        : [];
      const ansMap = new Map(answers.map((a) => [a.id, a.selectedIndex]));
      const ids = sess?.questionIds.length ? sess.questionIds : answers.map((a) => a.id);
      const list = gameType === 'logic-lab' ? LOGIC_PUZZLES : CODE_PUZZLES;
      totalQuestions = ids.length || 1;
      let streak = 0;
      for (const id of ids) {
        const item = list.find((x) => x.id === id);
        if (!item) continue;
        const okAns = ansMap.get(id) === item.correctIndex;
        if (okAns) {
          correctCount += 1;
          streak += 1;
          maxStreak = Math.max(maxStreak, streak);
          score += 130 + (streak - 1) * 25;
        } else {
          streak = 0;
        }
        details.push({ id: item.id, title: item.title, correct: okAns, explanation: item.explanation });
      }
      if (correctCount >= 4) {
        score += Math.max(0, Math.round((120 - Math.min(120, elapsedSeconds)) * 1.5));
      }
    } else if (gameType === 'circuit-rush') {
      const stagesCleared = Math.max(0, Math.min(CIRCUIT_STAGES.length, Number(body.stagesCleared ?? 0)));
      const totalMoves = Math.max(1, Number(body.moves ?? 20));
      totalQuestions = CIRCUIT_STAGES.length;
      correctCount = stagesCleared;
      maxStreak = stagesCleared;
      const speedBonus = stagesCleared > 0 ? Math.max(0, 220 - Math.min(200, elapsedSeconds * 2)) : 0;
      const effBonus = stagesCleared > 0 ? Math.max(0, 120 - totalMoves * 2) : 0;
      score = stagesCleared * 180 + speedBonus + effBonus;
    } else if (gameType === 'component-match') {
      const pairsMatched = Math.max(0, Math.min(COMPONENT_CARDS.length, Number(body.pairsMatched ?? 0)));
      const mistakes = Math.max(0, Number(body.mistakes ?? 0));
      totalQuestions = COMPONENT_CARDS.length;
      correctCount = pairsMatched;
      maxStreak = Math.max(1, Number(body.bestStreak ?? 1));
      const timeBonus =
        pairsMatched === COMPONENT_CARDS.length ? Math.max(0, 250 - Math.min(240, elapsedSeconds * 2)) : 0;
      score = Math.max(0, pairsMatched * 90 + maxStreak * 20 - mistakes * 10 + timeBonus);
    }

    const accuracy = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 1000) / 10 : 0;
    const xpEarned = Math.round(score * 0.28) + (accuracy === 100 ? 50 : 0);

    let updatedPlayer: PlayerProfile | null = null;
    let leveledUp = false;
    if (playerId && store.players[playerId]) {
      const p = store.players[playerId];
      const prevLvl = p.level;
      p.xp += xpEarned;
      p.gamesPlayed += 1;
      p.streakBest = Math.max(p.streakBest, maxStreak);
      const lvl = computeLevelFromXp(p.xp);
      p.level = lvl.level;
      p.title = lvl.title;
      p.unlockedThemes = getUnlockedThemesForLevel(lvl.level);
      leveledUp = lvl.level > prevLvl;
      updatedPlayer = p;
      store.arcadeLeaderboard.push({
        playerId: p.id,
        playerName: p.name,
        className: p.className,
        title: p.title,
        level: p.level,
        bestScore: score,
        totalScore: score,
        accuracy,
        gamesCount: 1,
        bestStreak: maxStreak,
        gameType,
        mode: 'practice',
      });
      writeStore(store);
    }

    return ok({
      sessionId,
      gameType,
      score,
      correctCount,
      totalQuestions,
      accuracy,
      timeSpentSeconds: elapsedSeconds,
      maxStreak,
      xpEarned,
      leveledUp,
      unlockedAchievements: [],
      dailyCompletedNow: false,
      details,
      player: updatedPlayer,
    });
  }

  if (pathname === '/api/leaderboard' && method === 'GET') {
    const tab = params.get('tab') || 'competitive';
    const className = params.get('className') || 'all';
    const search = (params.get('search') || '').trim().toLowerCase();
    const rows: LeaderboardEntry[] = store.arcadeLeaderboard
      .filter((r) => (tab === 'arcade' ? r.gameType !== 'iq-quiz' : r.mode === tab))
      .filter((r) => className === 'all' || r.className === className)
      .filter((r) => !search || r.playerName.toLowerCase().includes(search))
      .sort((a, b) => b.bestScore - a.bestScore)
      .map(({ mode: _m, ...entry }) => entry);
    return ok({ entries: rows });
  }

  if (pathname === '/api/daily-challenge' && method === 'GET') {
    return ok({ challenge: getDailyChallengeForDate(todayUtc()) });
  }

  // 14. Creations & Easy Quiz Studio fallback
  if (pathname === '/api/creations' && method === 'GET') {
    const userId = (params.get('userId') || '').trim();
    const type = params.get('type') || 'all';
    const list = (store.creations || []).filter(
      (c) => (!userId || c.userId === userId) && (type === 'all' || c.type === type)
    );
    return ok({ creations: list });
  }

  if (pathname === '/api/creations' && method === 'POST') {
    const userId = String(body.userId ?? 'guest_studio').trim() || 'guest_studio';
    const type = body.type === 'phone' ? 'phone' : 'car';
    const now = new Date().toISOString();
    const id = String(body.id || `cr_local_${type}_${Date.now()}`);
    const existingIdx = (store.creations || []).findIndex((c) => c.id === id && c.userId === userId);
    const creation: SavedCreation = {
      id,
      userId,
      type,
      title: String(body.title ?? 'Custom Design'),
      subtitle: String(body.subtitle ?? ''),
      designRating: Math.max(0, Math.min(100, Math.round(Number(body.designRating ?? 80)))),
      estimatedCost: Math.max(0, Math.round(Number(body.estimatedCost ?? 0))),
      payload: (body.payload as Record<string, unknown>) || {},
      previewDataUrl: typeof body.previewDataUrl === 'string' ? body.previewDataUrl : null,
      createdAt: existingIdx >= 0 ? store.creations[existingIdx].createdAt : now,
      updatedAt: now,
    };
    if (!store.creations) store.creations = [];
    if (existingIdx >= 0) {
      store.creations[existingIdx] = creation;
    } else {
      store.creations.unshift(creation);
    }

    const xpAward = existingIdx >= 0 ? 20 : 50;
    let updatedPlayer: PlayerProfile | null = null;
    let leveledUp = false;
    if (store.players[userId]) {
      const p = store.players[userId];
      const prevLvl = p.level;
      p.xp += xpAward;
      const lvl = computeLevelFromXp(p.xp);
      p.level = lvl.level;
      p.title = lvl.title;
      p.unlockedThemes = getUnlockedThemesForLevel(lvl.level);
      leveledUp = lvl.level > prevLvl;
      updatedPlayer = p;
    }
    writeStore(store);
    return ok({
      creation,
      xpEarned: xpAward,
      leveledUp,
      unlockedAchievements: [],
      player: updatedPlayer,
    });
  }

  if (pathname.startsWith('/api/creations/') && method === 'DELETE') {
    const id = decodeURIComponent(pathname.replace('/api/creations/', ''));
    const userId = params.get('userId') || '';
    store.creations = (store.creations || []).filter((c) => !(c.id === id && (!userId || c.userId === userId)));
    writeStore(store);
    return ok({ deleted: true });
  }

  if (pathname === '/api/studio/easy-complete' && method === 'POST') {
    const userId = body.userId ? String(body.userId) : null;
    const correctCount = Math.max(0, Number(body.correctCount ?? 0));
    const totalQuestions = Math.max(1, Number(body.totalQuestions ?? 10));
    const maxStreak = Math.max(0, Number(body.maxStreak ?? 0));
    const accuracy = Math.round((correctCount / totalQuestions) * 100);
    const xpEarned = Math.max(15, correctCount * 12 + (accuracy >= 80 ? 25 : 0));

    let updatedPlayer: PlayerProfile | null = null;
    let leveledUp = false;
    if (userId && store.players[userId]) {
      const p = store.players[userId];
      const prevLvl = p.level;
      p.xp += xpEarned;
      p.gamesPlayed += 1;
      p.streakBest = Math.max(p.streakBest, maxStreak);
      const lvl = computeLevelFromXp(p.xp);
      p.level = lvl.level;
      p.title = lvl.title;
      p.unlockedThemes = getUnlockedThemesForLevel(lvl.level);
      leveledUp = lvl.level > prevLvl;
      updatedPlayer = p;
      writeStore(store);
    }

    return ok({
      categoryId: String(body.categoryId ?? 'general-knowledge'),
      difficulty: String(body.difficulty ?? 'Easy'),
      correctCount,
      totalQuestions,
      accuracy,
      xpEarned,
      leveledUp,
      unlockedAchievements: [],
      player: updatedPlayer,
    });
  }

  return { handled: false, ok: false, status: 404, data: null, error: null };
}

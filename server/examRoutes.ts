import crypto from 'node:crypto';
import { GoogleGenAI, Type } from '@google/genai';
import type { Express } from 'express';
import { ALLOWED_ENGINEERING_CATEGORY_IDS, EXAM_CATEGORIES } from '../shared/categories.ts';
import { getAllBuiltinExamQuestions } from '../shared/examQuestions.ts';
import { computeExamLevel } from '../shared/progression.ts';
import { validateQuestionBank } from '../shared/questionValidator.ts';
import {
  getModeScoringRules,
  selectBalancedQuizQuestions,
  shuffleQuestionOptions,
} from '../shared/quizPipeline.ts';
import type {
  AnalyticsSummary,
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
  MistakeCategory,
  PublicExamQuestion,
  QuestionType,
  SpeedClass,
  TopicStat,
} from '../shared/types.ts';
import { db, logServerError } from './db.ts';

const DEV_HEADER_TOKEN = 'arcade-matrix-dev';
const DIFFICULTIES: ExamDifficulty[] = ['Easy', 'Medium', 'Hard', 'Expert'];
const QUESTION_TYPES: QuestionType[] = [
  'single',
  'multiple',
  'truefalse',
  'integer',
  'assertion_reason',
  'match',
  'image',
  'scenario',
  'comparison',
  'career_path',
];

const BUILTIN_QUESTIONS = getAllBuiltinExamQuestions();

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

function getAllQuestions(includeUnverified = false): ExamQuestion[] {
  const rows = db
    .prepare('SELECT payload_json, verified FROM exam_questions ORDER BY updated_at DESC')
    .all() as Array<{ payload_json: string; verified: number }>;

  const customMap = new Map<string, ExamQuestion>();
  for (const r of rows) {
    try {
      const q = JSON.parse(r.payload_json) as ExamQuestion;
      q.verified = Boolean(r.verified);
      if (includeUnverified || q.verified) {
        customMap.set(q.id, q);
      }
    } catch {
      // skip malformed custom row
    }
  }

  const merged: ExamQuestion[] = [];
  for (const b of BUILTIN_QUESTIONS) {
    if (customMap.has(b.id)) {
      merged.push(customMap.get(b.id)!);
      customMap.delete(b.id);
    } else {
      merged.push(b);
    }
  }
  for (const c of customMap.values()) {
    merged.push(c);
  }
  return merged.filter((q) => ALLOWED_ENGINEERING_CATEGORY_IDS.has(q.categoryId));
}

function sanitizeQuestion(q: ExamQuestion): PublicExamQuestion {
  const { answer: _a, explanation: _e, ...rest } = q;
  return rest;
}

function isAnswerSkipped(q: ExamQuestion, ans: ExamUserAnswer): boolean {
  if (ans === null || ans === undefined) return true;
  if (q.questionType === 'multiple') {
    return !Array.isArray(ans) || ans.length === 0;
  }
  if (q.questionType === 'match') {
    return !Array.isArray(ans) || ans.some((v) => v < 0);
  }
  if (q.questionType === 'integer') {
    return String(ans).trim() === '';
  }
  return Number(ans) < 0 || Number.isNaN(Number(ans));
}

function evaluateAnswer(q: ExamQuestion, ans: ExamUserAnswer): boolean {
  if (isAnswerSkipped(q, ans)) return false;

  if (q.questionType === 'multiple') {
    const expected = Array.isArray(q.answer) ? [...q.answer].map(Number).sort((a, b) => a - b) : [];
    const actual = Array.isArray(ans) ? [...new Set(ans.map(Number))].sort((a, b) => a - b) : [];
    return expected.length === actual.length && expected.every((v, i) => v === actual[i]);
  }

  if (q.questionType === 'match') {
    const expected = Array.isArray(q.answer) ? q.answer.map(Number) : [];
    const actual = Array.isArray(ans) ? ans.map(Number) : [];
    return expected.length === actual.length && expected.every((v, i) => v === actual[i]);
  }

  if (q.questionType === 'integer') {
    const expStr = String(q.answer).trim();
    const actStr = String(ans).trim();
    const expNum = Number(expStr);
    const actNum = Number(actStr);
    if (!Number.isNaN(expNum) && !Number.isNaN(actNum)) {
      return Math.abs(expNum - actNum) < 0.001;
    }
    return expStr.toLowerCase() === actStr.toLowerCase();
  }

  return Number(ans) === Number(q.answer);
}

function classifySpeed(isCorrect: boolean, isSkipped: boolean, timeMs: number, difficulty: ExamDifficulty): SpeedClass {
  if (isSkipped) return 'SKIPPED';
  const fastThresholdMs = difficulty === 'Hard' || difficulty === 'Expert' ? 25000 : 14000;
  const isFast = timeMs <= fastThresholdMs;
  if (isCorrect) return isFast ? 'FAST+CORRECT' : 'SLOW+CORRECT';
  return isFast ? 'FAST+WRONG' : 'SLOW+WRONG';
}

interface AdaptiveState {
  currentDifficulty: ExamDifficulty;
  consecutiveCorrect: number;
  consecutiveWrong: number;
}

function stepAdaptiveDifficulty(state: AdaptiveState, isCorrect: boolean): AdaptiveState {
  const idx = DIFFICULTIES.indexOf(state.currentDifficulty);
  if (isCorrect) {
    const nextCorrect = state.consecutiveCorrect + 1;
    if (nextCorrect >= 3 && idx < DIFFICULTIES.length - 1) {
      return {
        currentDifficulty: DIFFICULTIES[idx + 1],
        consecutiveCorrect: 0,
        consecutiveWrong: 0,
      };
    }
    return {
      currentDifficulty: state.currentDifficulty,
      consecutiveCorrect: nextCorrect,
      consecutiveWrong: 0,
    };
  }

  const nextWrong = state.consecutiveWrong + 1;
  // 2 wrong -> maintain difficulty; 3+ repeated mistakes -> step down temporarily
  if (nextWrong >= 3 && idx > 0) {
    return {
      currentDifficulty: DIFFICULTIES[idx - 1],
      consecutiveCorrect: 0,
      consecutiveWrong: 0,
    };
  }
  return {
    currentDifficulty: state.currentDifficulty,
    consecutiveCorrect: 0,
    consecutiveWrong: nextWrong,
  };
}

function ensureExamProfile(userId: string, displayName?: string): ExamStreakState {
  const existingPlayer = db
    .prepare('SELECT name FROM players WHERE id = ?')
    .get(userId) as { name?: string } | undefined;

  const resolvedName = displayName?.trim() || existingPlayer?.name || null;

  const row = db
    .prepare('SELECT * FROM exam_profiles WHERE user_id = ?')
    .get(userId) as
    | {
        user_id: string;
        display_name: string | null;
        daily_streak: number;
        best_daily_streak: number;
        last_active_date: string | null;
        quiz_streak: number;
        perfect_streak: number;
        exam_xp: number;
        exam_level: string;
      }
    | undefined;

  if (!row) {
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO exam_profiles (
        user_id, display_name, daily_streak, best_daily_streak, last_active_date,
        quiz_streak, perfect_streak, exam_xp, exam_level, updated_at
      ) VALUES (?, ?, 0, 0, NULL, 0, 0, 0, 'Beginner', ?)`
    ).run(userId, resolvedName, now);
    return {
      dailyStreak: 0,
      bestDailyStreak: 0,
      quizStreak: 0,
      perfectStreak: 0,
      examXp: 0,
      examLevel: 'Beginner',
    };
  }

  if (resolvedName && row.display_name !== resolvedName) {
    db.prepare('UPDATE exam_profiles SET display_name = ?, updated_at = ? WHERE user_id = ?').run(
      resolvedName,
      new Date().toISOString(),
      userId
    );
  }

  const lvl = computeExamLevel(row.exam_xp);
  return {
    dailyStreak: row.daily_streak,
    bestDailyStreak: row.best_daily_streak,
    quizStreak: row.quiz_streak,
    perfectStreak: row.perfect_streak,
    examXp: row.exam_xp,
    examLevel: lvl.title,
  };
}

function validateAdminQuestion(body: Record<string, unknown>): { valid: boolean; error?: string; question?: ExamQuestion } {
  const question = String(body.question ?? '').trim();
  const subject = String(body.subject ?? '').trim();
  const categoryId = String(body.categoryId ?? '').trim();
  const chapter = String(body.chapter ?? '').trim();
  const topic = String(body.topic ?? '').trim();
  const difficulty = String(body.difficulty ?? 'Medium') as ExamDifficulty;
  const questionType = String(body.questionType ?? 'single') as QuestionType;
  const source = String(body.source ?? 'CGQUIZ GENERATED').trim() || 'CGQUIZ GENERATED';
  const year = body.year !== null && body.year !== undefined && body.year !== '' ? Number(body.year) : null;
  const verified = Boolean(body.verified);
  const options = Array.isArray(body.options) ? body.options.map((o) => String(o).trim()).filter(Boolean) : [];
  const tags = Array.isArray(body.tags)
    ? body.tags.map((t) => String(t).trim()).filter(Boolean)
    : typeof body.tags === 'string'
      ? body.tags.split(',').map((t) => t.trim()).filter(Boolean)
      : [];

  const expObj = (body.explanation ?? {}) as Record<string, unknown>;
  const explanation = {
    why: String(expObj.why ?? '').trim(),
    concept: String(expObj.concept ?? '').trim(),
    shortcut: String(expObj.shortcut ?? '').trim(),
    commonTrap: String(expObj.commonTrap ?? '').trim(),
  };

  if (question.length < 8) {
    return { valid: false, error: 'Question text must be at least 8 characters.' };
  }
  if (!subject || !categoryId || !chapter || !topic) {
    return { valid: false, error: 'Subject, Category, Chapter, and Topic are required.' };
  }
  if (!DIFFICULTIES.includes(difficulty)) {
    return { valid: false, error: 'Invalid difficulty value.' };
  }
  if (!QUESTION_TYPES.includes(questionType)) {
    return { valid: false, error: 'Invalid question type.' };
  }
  if (!explanation.why || !explanation.concept) {
    return { valid: false, error: 'Explanation "Why" and "Concept" fields are required before publishing.' };
  }

  let normalizedOptions = options;
  let answer: number | number[] | string = body.answer as number | number[] | string;

  if (questionType === 'truefalse') {
    normalizedOptions = ['True', 'False'];
    const numAns = Number(body.answer);
    if (numAns !== 0 && numAns !== 1) {
      return { valid: false, error: 'True/False questions require answer 0 (True) or 1 (False).' };
    }
    answer = numAns;
  } else if (questionType === 'integer') {
    const strAns = String(body.answer ?? '').trim();
    if (!strAns || Number.isNaN(Number(strAns))) {
      return { valid: false, error: 'Integer/Numeric questions require a valid numeric answer.' };
    }
    normalizedOptions = [];
    answer = strAns;
  } else if (questionType === 'multiple') {
    if (normalizedOptions.length < 2) {
      return { valid: false, error: 'Multiple-correct questions require at least 2 options.' };
    }
    if (!Array.isArray(body.answer) || body.answer.length === 0) {
      return { valid: false, error: 'Multiple-correct questions require at least one correct option index.' };
    }
    answer = body.answer.map(Number);
  } else if (questionType === 'match') {
    const mp = body.matchPairs as { left?: string[]; right?: string[] } | undefined;
    if (!mp || !Array.isArray(mp.left) || !Array.isArray(mp.right) || mp.left.length < 2 || mp.right.length < 2) {
      return { valid: false, error: 'Match questions require List I and List II items.' };
    }
    if (!Array.isArray(body.answer) || body.answer.length !== mp.left.length) {
      return { valid: false, error: 'Match answer array length must match List I rows.' };
    }
    answer = body.answer.map(Number);
  } else {
    if (normalizedOptions.length < 2) {
      return { valid: false, error: 'Choice questions require at least 2 options.' };
    }
    const numAns = Number(body.answer);
    if (Number.isNaN(numAns) || numAns < 0 || numAns >= normalizedOptions.length) {
      return { valid: false, error: 'Selected correct option index is out of range.' };
    }
    answer = numAns;
  }

  const id = String(body.id ?? '').trim() || `adm_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;

  return {
    valid: true,
    question: {
      id,
      question,
      assertion: body.assertion ? String(body.assertion).trim() : undefined,
      reason: body.reason ? String(body.reason).trim() : undefined,
      matchPairs: questionType === 'match' ? (body.matchPairs as ExamQuestion['matchPairs']) : undefined,
      imageSvg: body.imageSvg ? String(body.imageSvg) : undefined,
      imageCaption: body.imageCaption ? String(body.imageCaption).trim() : undefined,
      options: normalizedOptions,
      answer,
      explanation: {
        why: explanation.why,
        concept: explanation.concept,
        shortcut: explanation.shortcut || 'Break the problem down into known formulas and units.',
        commonTrap: explanation.commonTrap || 'Double-check signs, units, and boundary conditions.',
      },
      subject,
      categoryId,
      chapter,
      topic,
      difficulty,
      questionType,
      source,
      year: year && !Number.isNaN(year) ? year : null,
      tags,
      verified,
    },
  };
}

export function registerExamRoutes(app: Express): void {
  // 1. Configurable Categories & Dynamic Facets
  app.get('/api/exam/categories', (_req, res) => {
    const all = getAllQuestions(false);
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
    for (const key of Object.keys(chaptersBySubject)) {
      chaptersBySubject[key].sort();
    }

    res.json({
      categories: EXAM_CATEGORIES.map((c) => ({
        ...c,
        questionCount: countByCategory[c.id] || 0,
        difficultyCounts: diffByCategory[c.id] || { Easy: 0, Medium: 0, Hard: 0, Expert: 0 },
      })),
      subjects,
      chaptersBySubject,
      totalVerifiedQuestions: all.length,
    });
  });

  // 2. Paginated Question Bank Search & Multi-Filters
  app.get('/api/exam/questions', (req, res) => {
    try {
      const qText = String(req.query.q ?? '').trim().toLowerCase();
      const categoryId = String(req.query.categoryId ?? 'all');
      const subject = String(req.query.subject ?? 'all');
      const chapter = String(req.query.chapter ?? 'all');
      const difficulty = String(req.query.difficulty ?? 'all');
      const source = String(req.query.source ?? 'all');
      const year = String(req.query.year ?? 'all');
      const questionType = String(req.query.questionType ?? 'all');
      const page = Math.max(1, Number(req.query.page ?? 1));
      const limit = Math.min(50, Math.max(5, Number(req.query.limit ?? 20)));

      let pool = getAllQuestions(false);

      if (categoryId !== 'all') pool = pool.filter((x) => x.categoryId === categoryId);
      if (subject !== 'all') pool = pool.filter((x) => x.subject === subject);
      if (chapter !== 'all') pool = pool.filter((x) => x.chapter === chapter);
      if (difficulty !== 'all') pool = pool.filter((x) => x.difficulty === difficulty);
      if (source !== 'all') {
        if (source === 'PYQ') {
          pool = pool.filter((x) => x.source.toUpperCase().includes('PYQ'));
        } else {
          pool = pool.filter((x) => x.source === source);
        }
      }
      if (year !== 'all') pool = pool.filter((x) => String(x.year ?? '') === year);
      if (questionType !== 'all') pool = pool.filter((x) => x.questionType === questionType);
      if (qText) {
        pool = pool.filter(
          (x) =>
            x.question.toLowerCase().includes(qText) ||
            x.topic.toLowerCase().includes(qText) ||
            x.chapter.toLowerCase().includes(qText) ||
            x.subject.toLowerCase().includes(qText) ||
            x.tags.some((t) => t.toLowerCase().includes(qText))
        );
      }

      const total = pool.length;
      const start = (page - 1) * limit;
      const items = pool.slice(start, start + limit);

      res.json({
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
        items,
      });
    } catch (err) {
      logServerError('/api/exam/questions', String(err));
      res.status(500).json({ error: 'Unable to load question bank right now.' });
    }
  });

  // 3. Daily Challenge Status (1 attempt/day)
  app.get('/api/exam/daily-status', (req, res) => {
    try {
      const userId = String(req.query.userId ?? '').trim();
      const today = todayUtc();
      if (!userId) {
        res.json({ date: today, completed: false } satisfies DailyExamStatus);
        return;
      }

      const row = db
        .prepare('SELECT * FROM daily_exam_completions WHERE user_id = ? AND challenge_date = ?')
        .get(userId, today) as
        | {
            attempt_id: string;
            score: number;
            max_score: number;
            accuracy: number;
            time_spent_seconds: number;
            weak_area: string | null;
          }
        | undefined;

      if (!row) {
        res.json({ date: today, completed: false } satisfies DailyExamStatus);
        return;
      }

      const rankRow = db
        .prepare(
          `SELECT COUNT(*) + 1 as rank FROM daily_exam_completions
           WHERE challenge_date = ? AND (score > ? OR (score = ? AND time_spent_seconds < ?))`
        )
        .get(today, row.score, row.score, row.time_spent_seconds) as { rank: number };

      const totalParticipants = (
        db
          .prepare('SELECT COUNT(*) as c FROM daily_exam_completions WHERE challenge_date = ?')
          .get(today) as { c: number }
      ).c;

      res.json({
        date: today,
        completed: true,
        attemptId: row.attempt_id,
        score: row.score,
        maxScore: row.max_score,
        accuracy: row.accuracy,
        timeSpentSeconds: row.time_spent_seconds,
        rank: rankRow.rank,
        totalParticipants,
        weakArea: row.weak_area,
      } satisfies DailyExamStatus);
    } catch (err) {
      logServerError('/api/exam/daily-status', String(err));
      res.status(500).json({ error: 'Could not check daily challenge status.' });
    }
  });

  // 4. Start Quiz / Mock Exam Session (never leaks answers, randomizes options!)
  app.post('/api/exam/start', (req, res) => {
    try {
      const userId = String(req.body?.userId ?? '').trim();
      const mode = String(req.body?.mode ?? 'quick') as ExamMode;
      const categoryId = String(req.body?.categoryId ?? 'all');
      const subject = String(req.body?.subject ?? 'all');
      const chapter = String(req.body?.chapter ?? 'all');
      const difficulty = String(req.body?.difficulty ?? 'Adaptive') as ExamSettings['difficulty'];
      const questionType = String(req.body?.questionType ?? 'All') as ExamSettings['questionType'];
      const scoringRule = getModeScoringRules(
        mode,
        req.body?.negativeMarking !== undefined ? Number(req.body.negativeMarking) : undefined
      );
      const negativeMarking = scoringRule.negativeMarking;
      const requestedIds = Array.isArray(req.body?.questionIds) ? (req.body.questionIds as string[]) : null;
      const excludeQuestionIds = Array.isArray(req.body?.excludeQuestionIds)
        ? req.body.excludeQuestionIds.map(String)
        : [];
      const smartBoardMode = Boolean(req.body?.smartBoardMode);
      const adaptiveEnabled =
        req.body?.adaptiveEnabled !== undefined
          ? Boolean(req.body.adaptiveEnabled)
          : difficulty === 'Adaptive' || mode === 'adaptive';
      const isTest = req.body?.isTest === true ? 1 : 0;

      if (!userId) {
        res.status(400).json({ error: 'User session ID is required.' });
        return;
      }

      ensureExamProfile(userId, req.body?.displayName ? String(req.body.displayName) : undefined);

      // Daily Challenge: enforce once per day
      if (mode === 'daily') {
        const today = todayUtc();
        const already = db
          .prepare('SELECT 1 FROM daily_exam_completions WHERE user_id = ? AND challenge_date = ?')
          .get(userId, today);
        if (already) {
          res.status(409).json({
            error: 'Today’s Daily Challenge is already completed. Come back tomorrow or try another quiz mode.',
          });
          return;
        }
      }

      const all = getAllQuestions(false);
      const qMap = new Map(all.map((q) => [q.id, q]));

      let selectedRaw: ExamQuestion[];
      if (requestedIds && requestedIds.length > 0) {
        selectedRaw = requestedIds
          .map((id) => qMap.get(id))
          .filter((q): q is ExamQuestion => Boolean(q));
      } else {
        const mistakeRows = db
          .prepare(
            `SELECT question_id, subject, topic FROM mistake_book
             WHERE user_id = ? AND resolved = 0
             ORDER BY last_missed_at DESC`
          )
          .all(userId) as Array<{ question_id: string; subject: string; topic: string }>;

        selectedRaw = selectBalancedQuizQuestions({
          allQuestions: all,
          mode,
          categoryId,
          subject,
          chapter,
          difficulty,
          questionType,
          questionCount: Number(req.body?.questionCount ?? 0) || undefined,
          excludeQuestionIds,
          mistakeQuestionIds: mistakeRows.map((m) => m.question_id),
          weakTopics: [...new Set(mistakeRows.map((m) => m.topic))],
          weakSubjects: [...new Set(mistakeRows.map((m) => m.subject))],
          seedStr: mode === 'daily' ? todayUtc() : undefined,
        });
      }

      // Randomize answer options per session & compute new correct keys cleanly
      const selected = selectedRaw.map((q) => shuffleQuestionOptions(q));

      const defaultMinutes =
        mode === 'rapid'
          ? 2
          : mode === 'quick' || mode === 'career_fair'
            ? 8
            : mode === 'mock' || mode === 'jee'
              ? Math.max(15, Math.round(selected.length * 1.25))
              : mode === 'timed'
                ? Math.max(5, Math.round(selected.length * 0.9))
                : Math.max(12, selected.length);
      const timeLimitSeconds = Math.max(
        60,
        Math.round(Number(req.body?.timeLimitMinutes ?? defaultMinutes) * 60)
      );

      const sessionId = `exs_${Date.now()}_${crypto.randomBytes(5).toString('hex')}`;
      const startedAt = Date.now();
      const expiresAt = startedAt + Math.max(timeLimitSeconds * 1000 + 5 * 60 * 1000, 60 * 60 * 1000);

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
        smartBoardMode,
        adaptiveEnabled,
        excludeQuestionIds,
      };

      const adaptiveState: AdaptiveState = {
        currentDifficulty:
          difficulty !== 'Mixed' && difficulty !== 'Adaptive' ? difficulty : 'Medium',
        consecutiveCorrect: 0,
        consecutiveWrong: 0,
      };

      db.prepare(
        `INSERT INTO exam_sessions (
          session_id, user_id, mode, settings_json, question_ids_json, session_questions_json,
          adaptive_state_json, started_at, expires_at, time_limit_seconds, status, is_test
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)`
      ).run(
        sessionId,
        userId,
        mode,
        JSON.stringify(settings),
        JSON.stringify(selected.map((q) => q.id)),
        JSON.stringify(selected),
        JSON.stringify(adaptiveState),
        startedAt,
        expiresAt,
        timeLimitSeconds,
        isTest
      );

      res.json({
        sessionId,
        mode,
        settings,
        timeLimitSeconds,
        adaptiveState,
        scoringRule,
        questions: selected.map(sanitizeQuestion),
      });
    } catch (err) {
      logServerError('/api/exam/start', String(err));
      res.status(500).json({ error: 'Unable to start quiz session. Please try again.' });
    }
  });

  // 5. Adaptive Immediate Answer Verification (Blocked for Mock & Timed pre-submission!)
  app.post('/api/exam/check-answer', (req, res) => {
    try {
      const sessionId = String(req.body?.sessionId ?? '');
      const questionId = String(req.body?.questionId ?? '');
      const userAnswer = req.body?.userAnswer as ExamUserAnswer;

      const session = db
        .prepare('SELECT * FROM exam_sessions WHERE session_id = ?')
        .get(sessionId) as
        | {
            session_id: string;
            mode: ExamMode;
            question_ids_json: string;
            session_questions_json?: string | null;
            adaptive_state_json: string;
            status: string;
          }
        | undefined;

      if (!session || session.status !== 'active') {
        res.status(400).json({ error: 'Quiz session is not active.' });
        return;
      }
      if (session.mode === 'mock' || session.mode === 'timed') {
        res.status(403).json({ error: 'Answers cannot be revealed before submission in Timed or Mock mode.' });
        return;
      }

      const allowedIds = JSON.parse(session.question_ids_json) as string[];
      if (!allowedIds.includes(questionId)) {
        res.status(400).json({ error: 'Question does not belong to this session.' });
        return;
      }

      let q: ExamQuestion | undefined;
      if (session.session_questions_json) {
        try {
          const snapshot = JSON.parse(session.session_questions_json) as ExamQuestion[];
          q = snapshot.find((x) => x.id === questionId);
        } catch {
          // fallback below
        }
      }
      if (!q) {
        q = getAllQuestions(true).find((x) => x.id === questionId);
      }
      if (!q) {
        res.status(404).json({ error: 'Question not found.' });
        return;
      }

      const isCorrect = evaluateAnswer(q, userAnswer);
      const prevAdaptive = JSON.parse(session.adaptive_state_json) as AdaptiveState;
      const nextAdaptive = stepAdaptiveDifficulty(prevAdaptive, isCorrect);

      db.prepare('UPDATE exam_sessions SET adaptive_state_json = ? WHERE session_id = ?').run(
        JSON.stringify(nextAdaptive),
        sessionId
      );

      res.json({
        correct: isCorrect,
        correctAnswer: q.answer,
        explanation: q.explanation,
        source: q.source,
        year: q.year,
        adaptiveState: nextAdaptive,
      });
    } catch (err) {
      logServerError('/api/exam/check-answer', String(err));
      res.status(500).json({ error: 'Unable to check answer.' });
    }
  });

  // 6. Authoritative Quiz Submission & Smart Analytics Engine
  app.post('/api/exam/submit', (req, res) => {
    try {
      const sessionId = String(req.body?.sessionId ?? '');
      const userId = String(req.body?.userId ?? '').trim();
      const answersInput = Array.isArray(req.body?.answers)
        ? (req.body.answers as ExamAnswerItem[])
        : [];
      const antiCheat = (req.body?.antiCheat ?? {}) as {
        tabSwitches?: number;
        fullscreenExits?: number;
      };

      const session = db
        .prepare('SELECT * FROM exam_sessions WHERE session_id = ?')
        .get(sessionId) as
        | {
            session_id: string;
            user_id: string;
            mode: ExamMode;
            settings_json: string;
            question_ids_json: string;
            session_questions_json?: string | null;
            started_at: number;
            expires_at: number;
            status: string;
            is_test: number;
          }
        | undefined;

      if (!session) {
        res.status(404).json({ error: 'Quiz session not found.' });
        return;
      }
      if (!userId) {
        res.status(401).json({ error: 'User authentication is required to submit this quiz.' });
        return;
      }
      if (session.user_id !== userId) {
        res.status(403).json({ error: 'Forbidden: session belongs to a different user.' });
        return;
      }
      if (session.status !== 'active') {
        res.status(409).json({ error: 'This quiz session was already submitted.' });
        return;
      }

      const effectiveUserId = session.user_id;
      ensureExamProfile(
        effectiveUserId,
        req.body?.displayName ? String(req.body.displayName) : undefined
      );

      const settings = JSON.parse(session.settings_json) as ExamSettings;
      const expectedIds = JSON.parse(session.question_ids_json) as string[];
      const baseQs = new Map(getAllQuestions(true).map((q) => [q.id, q]));
      const snapshotQs = new Map<string, ExamQuestion>();
      if (session.session_questions_json) {
        try {
          for (const item of JSON.parse(session.session_questions_json) as ExamQuestion[]) {
            snapshotQs.set(item.id, item);
          }
        } catch {
          // ignore snapshot parse error
        }
      }
      const allQs = new Map<string, ExamQuestion>([...baseQs, ...snapshotQs]);
      const answerByQ = new Map(answersInput.map((a) => [a.questionId, a]));

      const scoringRule = getModeScoringRules(session.mode, settings.negativeMarking);
      const marksPerCorrect = scoringRule.marksPerCorrect;
      const negPenalty = scoringRule.negativeMarking;

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
      let mistakesSavedCount = 0;
      const nowIso = new Date().toISOString();

      for (const qId of expectedIds) {
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

          // Mark previously logged mistake as resolved on successful correct revision/retry
          if (session.mode === 'revision' || session.mode === 'weak') {
            db.prepare('UPDATE mistake_book SET resolved = 1 WHERE user_id = ? AND question_id = ?').run(
              effectiveUserId,
              q.id
            );
          }
        } else {
          wrongCount += 1;
          marksAwarded = -negPenalty;
          score -= negPenalty;

          // Auto-record into Mistake Book
          const inferredCategory: MistakeCategory =
            speedClass === 'FAST+WRONG' ? 'careless' : 'concept';
          const existingMistake = db
            .prepare('SELECT id, times_missed FROM mistake_book WHERE user_id = ? AND question_id = ?')
            .get(effectiveUserId, q.id) as { id: string; times_missed: number } | undefined;

          if (existingMistake) {
            db.prepare(
              `UPDATE mistake_book
               SET times_missed = ?, resolved = 0, last_missed_at = ?
               WHERE id = ?`
            ).run(existingMistake.times_missed + 1, nowIso, existingMistake.id);
          } else {
            db.prepare(
              `INSERT INTO mistake_book (
                id, user_id, question_id, subject, topic, mistake_category, notes,
                times_missed, resolved, last_missed_at, created_at
              ) VALUES (?, ?, ?, ?, ?, ?, '', 1, 0, ?, ?)`
            ).run(
              `mk_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
              effectiveUserId,
              q.id,
              q.subject,
              q.topic,
              inferredCategory,
              nowIso,
              nowIso
            );
          }
          mistakesSavedCount += 1;
        }

        if (!topicMap.has(q.topic)) {
          topicMap.set(q.topic, { subject: q.subject, attempted: 0, correct: 0, totalMs: 0 });
        }
        const tEntry = topicMap.get(q.topic)!;
        if (!skipped) tEntry.attempted += 1;
        if (correct) tEntry.correct += 1;
        tEntry.totalMs += timeMs;

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
      const elapsedSeconds = Math.max(1, Math.round((Date.now() - session.started_at) / 1000));
      const avgTimePerQuestion = Math.round((totalTimeMs / totalQuestions / 1000) * 10) / 10;

      const topicBreakdown: TopicStat[] = [...topicMap.entries()].map(([topic, data]) => {
        const denom = Math.max(1, data.attempted);
        return {
          topic,
          subject: data.subject,
          attempted: data.attempted,
          correct: data.correct,
          accuracy: data.attempted > 0 ? Math.round((data.correct / denom) * 100) : 0,
          avgTimeSec: Math.round((data.totalMs / Math.max(1, data.attempted) / 1000) * 10) / 10,
        };
      });

      const strongTopics = topicBreakdown.filter((t) => t.attempted > 0 && t.accuracy >= 70);
      const weakTopics = [...topicBreakdown]
        .filter((t) => t.attempted > 0 && t.accuracy < 65)
        .sort((a, b) => a.accuracy - b.accuracy);

      const didWell: string[] = [];
      if (accuracy >= 75) didWell.push(`Strong accuracy (${accuracy}%) across attempted questions.`);
      if (speedMatrix['FAST+CORRECT'] > 0) {
        didWell.push(`${speedMatrix['FAST+CORRECT']} fast & accurate responses.`);
      }
      for (const s of strongTopics.slice(0, 2)) {
        didWell.push(`Solid command in ${s.topic} (${s.accuracy}% accuracy).`);
      }
      if (didWell.length === 0) {
        didWell.push('Completed the session and logged baseline performance data.');
      }

      const needsImprovement: string[] = [];
      for (const w of weakTopics.slice(0, 2)) {
        needsImprovement.push(`${w.topic} (${w.accuracy}% accuracy — review concept & trap notes).`);
      }
      if (speedMatrix['FAST+WRONG'] > 0) {
        needsImprovement.push(`${speedMatrix['FAST+WRONG']} rushed errors (FAST+WRONG) — slow down by 3–5s.`);
      }
      if (speedMatrix['SLOW+WRONG'] > 0) {
        needsImprovement.push(`${speedMatrix['SLOW+WRONG']} conceptual blockers (SLOW+WRONG) — revisit core theory.`);
      }
      if (needsImprovement.length === 0) {
        needsImprovement.push('Try increasing difficulty to Hard/Expert to stress-test retention.');
      }

      const primaryWeak = weakTopics[0];
      const nextRecommendation = primaryWeak
        ? {
            label: `Practice ${primaryWeak.topic} (${primaryWeak.accuracy < 40 ? 'Easy' : 'Medium'})`,
            categoryId: settings.categoryId,
            subject: primaryWeak.subject,
            topic: primaryWeak.topic,
            difficulty: (primaryWeak.accuracy < 40 ? 'Easy' : 'Medium') as ExamDifficulty,
          }
        : {
            label:
              accuracy >= 85
                ? `Challenge ${settings.subject === 'all' ? 'Mixed' : settings.subject} at Hard Difficulty`
                : `Retry Wrong Questions (${wrongCount} items)`,
            categoryId: settings.categoryId,
            subject: settings.subject,
            difficulty: (accuracy >= 85 ? 'Hard' : 'Medium') as ExamDifficulty,
          };

      let examStrategyNote: string | null = null;
      if (session.mode === 'mock') {
        if (negPenalty > 0 && wrongCount > skippedCount && accuracy < 65) {
          examStrategyNote = `Negative marking cost you ${(wrongCount * negPenalty).toFixed(1)} marks. Skip uncertain items rather than guessing.`;
        } else if (skippedCount > Math.round(totalQuestions * 0.35)) {
          examStrategyNote = `You left ${skippedCount} questions unattempted. Prioritize quick-solve questions in Pass 1.`;
        } else {
          examStrategyNote = `Good exam pacing: ${correctCount} correct, ${wrongCount} wrong, ${skippedCount} skipped.`;
        }
      }

      // Update Streaks & Lightweight XP
      const today = todayUtc();
      const yday = yesterdayUtc();
      const profRow = db
        .prepare('SELECT * FROM exam_profiles WHERE user_id = ?')
        .get(effectiveUserId) as {
        daily_streak: number;
        best_daily_streak: number;
        last_active_date: string | null;
        quiz_streak: number;
        perfect_streak: number;
        exam_xp: number;
      };

      let dailyStreak = profRow.daily_streak;
      if (profRow.last_active_date === today) {
        dailyStreak = Math.max(1, dailyStreak);
      } else if (profRow.last_active_date === yday) {
        dailyStreak += 1;
      } else {
        dailyStreak = 1;
      }
      const bestDailyStreak = Math.max(profRow.best_daily_streak, dailyStreak);
      const quizStreak = profRow.quiz_streak + 1;
      const perfectStreak = accuracy === 100 && wrongCount === 0 ? profRow.perfect_streak + 1 : 0;

      const xpEarned = Math.max(10, correctCount * 12 + (accuracy === 100 ? 35 : 0) + (session.mode === 'daily' ? 40 : 0));
      const newXp = profRow.exam_xp + xpEarned;
      const lvl = computeExamLevel(newXp);

      db.prepare(
        `UPDATE exam_profiles
         SET daily_streak = ?, best_daily_streak = ?, last_active_date = ?,
             quiz_streak = ?, perfect_streak = ?, exam_xp = ?, exam_level = ?, updated_at = ?
         WHERE user_id = ?`
      ).run(
        dailyStreak,
        bestDailyStreak,
        today,
        quizStreak,
        perfectStreak,
        newXp,
        lvl.title,
        nowIso,
        effectiveUserId
      );

      const attemptId = `att_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
      db.prepare("UPDATE exam_sessions SET status = 'submitted' WHERE session_id = ?").run(sessionId);

      db.prepare(
        `INSERT INTO exam_attempts (
          id, session_id, user_id, mode, subject, category_id, difficulty,
          score, max_score, correct_count, wrong_count, skipped_count, total_questions,
          accuracy, time_spent_seconds, avg_time_per_q, negative_marking, xp_earned,
          details_json, speed_matrix_json, topic_breakdown_json, anti_cheat_json, is_test, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        attemptId,
        sessionId,
        effectiveUserId,
        session.mode,
        settings.subject,
        settings.categoryId,
        settings.difficulty,
        score,
        maxScore,
        correctCount,
        wrongCount,
        skippedCount,
        totalQuestions,
        accuracy,
        elapsedSeconds,
        avgTimePerQuestion,
        negPenalty,
        xpEarned,
        JSON.stringify(details),
        JSON.stringify(speedMatrix),
        JSON.stringify(topicBreakdown),
        JSON.stringify(antiCheat),
        session.is_test,
        nowIso
      );

      let rank: number | null = null;
      if (session.mode === 'daily') {
        const weakArea = primaryWeak?.topic ?? null;
        db.prepare(
          `INSERT OR IGNORE INTO daily_exam_completions (
            user_id, challenge_date, attempt_id, score, max_score, accuracy,
            time_spent_seconds, weak_area, completed_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(
          effectiveUserId,
          today,
          attemptId,
          score,
          maxScore,
          accuracy,
          elapsedSeconds,
          weakArea,
          nowIso
        );

        const rankRow = db
          .prepare(
            `SELECT COUNT(*) + 1 as rank FROM daily_exam_completions
             WHERE challenge_date = ? AND (score > ? OR (score = ? AND time_spent_seconds < ?))`
          )
          .get(today, score, score, elapsedSeconds) as { rank: number };
        rank = rankRow.rank;
      }

      const streaks: ExamStreakState = {
        dailyStreak,
        bestDailyStreak,
        quizStreak,
        perfectStreak,
        examXp: newXp,
        examLevel: lvl.title,
      };

      const summary: ExamResultSummary = {
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
        rank,
        streaks,
        speedMatrix,
        topicBreakdown,
        didWell,
        needsImprovement,
        nextRecommendation,
        examStrategyNote,
        mistakesSavedCount,
        details,
        createdAt: nowIso,
      };

      res.json(summary);
    } catch (err) {
      logServerError('/api/exam/submit', String(err));
      res.status(500).json({ error: 'Unable to submit quiz right now. Please retry.' });
    }
  });

  // 7. Real-Data Analytics Dashboard
  app.get('/api/exam/analytics', (req, res) => {
    try {
      const userId = String(req.query.userId ?? '').trim();
      const range = (String(req.query.range ?? '30d') as '7d' | '30d' | 'all');

      if (!userId) {
        res.status(400).json({ error: 'userId is required.' });
        return;
      }

      const streaks = ensureExamProfile(userId);
      let dateCutoff = '';
      if (range === '7d') {
        const d = new Date();
        d.setUTCDate(d.getUTCDate() - 7);
        dateCutoff = d.toISOString();
      } else if (range === '30d') {
        const d = new Date();
        d.setUTCDate(d.getUTCDate() - 30);
        dateCutoff = d.toISOString();
      }

      const rows = (
        dateCutoff
          ? db
              .prepare(
                `SELECT * FROM exam_attempts
                 WHERE user_id = ? AND is_test = 0 AND created_at >= ?
                 ORDER BY created_at DESC`
              )
              .all(userId, dateCutoff)
          : db
              .prepare(
                `SELECT * FROM exam_attempts
                 WHERE user_id = ? AND is_test = 0
                 ORDER BY created_at DESC`
              )
              .all(userId)
      ) as Array<{
        id: string;
        mode: ExamMode;
        subject: string;
        score: number;
        max_score: number;
        correct_count: number;
        wrong_count: number;
        total_questions: number;
        accuracy: number;
        time_spent_seconds: number;
        avg_time_per_q: number;
        speed_matrix_json: string;
        topic_breakdown_json: string;
        created_at: string;
      }>;

      if (rows.length === 0) {
        const empty: AnalyticsSummary = {
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
          subjectPerformance: [],
          strongTopics: [],
          weakTopics: [],
          mistakenConcepts: [],
          speedMatrix: {
            'FAST+CORRECT': 0,
            'SLOW+CORRECT': 0,
            'FAST+WRONG': 0,
            'SLOW+WRONG': 0,
            SKIPPED: 0,
          },
          chartSeries: [],
          recentAttempts: [],
        };
        res.json(empty);
        return;
      }

      let totalCorrect = 0;
      let totalWrong = 0;
      let bestScore = -Infinity;
      let totalTimeAvgAcc = 0;

      const speedMatrix: Record<SpeedClass, number> = {
        'FAST+CORRECT': 0,
        'SLOW+CORRECT': 0,
        'FAST+WRONG': 0,
        'SLOW+WRONG': 0,
        SKIPPED: 0,
      };

      const subjectAgg = new Map<string, { attempted: number; correct: number }>();
      const topicAgg = new Map<string, { subject: string; attempted: number; correct: number; avgTimeSum: number; runs: number }>();
      const chartAgg = new Map<string, { accSum: number; scoreSum: number; quizzes: number }>();

      for (const r of rows) {
        totalCorrect += r.correct_count;
        totalWrong += r.wrong_count;
        bestScore = Math.max(bestScore, r.score);
        totalTimeAvgAcc += r.avg_time_per_q;

        const sm = JSON.parse(r.speed_matrix_json) as Record<SpeedClass, number>;
        for (const k of Object.keys(speedMatrix) as SpeedClass[]) {
          speedMatrix[k] += sm[k] || 0;
        }

        const topics = JSON.parse(r.topic_breakdown_json) as TopicStat[];
        for (const t of topics) {
          if (!subjectAgg.has(t.subject)) subjectAgg.set(t.subject, { attempted: 0, correct: 0 });
          const sa = subjectAgg.get(t.subject)!;
          sa.attempted += t.attempted;
          sa.correct += t.correct;

          if (!topicAgg.has(t.topic)) {
            topicAgg.set(t.topic, { subject: t.subject, attempted: 0, correct: 0, avgTimeSum: 0, runs: 0 });
          }
          const ta = topicAgg.get(t.topic)!;
          ta.attempted += t.attempted;
          ta.correct += t.correct;
          ta.avgTimeSum += t.avgTimeSec;
          ta.runs += 1;
        }

        const day = r.created_at.slice(0, 10);
        if (!chartAgg.has(day)) chartAgg.set(day, { accSum: 0, scoreSum: 0, quizzes: 0 });
        const ca = chartAgg.get(day)!;
        ca.accSum += r.accuracy;
        ca.scoreSum += r.score;
        ca.quizzes += 1;
      }

      const totalAttempted = totalCorrect + totalWrong;
      const overallAccuracy = totalAttempted > 0 ? Math.round((totalCorrect / totalAttempted) * 1000) / 10 : 0;
      const avgTimePerQuestion = Math.round((totalTimeAvgAcc / rows.length) * 10) / 10;

      const subjectPerformance = [...subjectAgg.entries()]
        .filter(([, v]) => v.attempted > 0)
        .map(([subject, v]) => ({
          subject,
          attempted: v.attempted,
          correct: v.correct,
          accuracy: Math.round((v.correct / v.attempted) * 100),
        }))
        .sort((a, b) => b.accuracy - a.accuracy);

      const allTopics: TopicStat[] = [...topicAgg.entries()]
        .filter(([, v]) => v.attempted > 0)
        .map(([topic, v]) => ({
          topic,
          subject: v.subject,
          attempted: v.attempted,
          correct: v.correct,
          accuracy: Math.round((v.correct / v.attempted) * 100),
          avgTimeSec: Math.round((v.avgTimeSum / v.runs) * 10) / 10,
        }));

      const strongTopics = allTopics
        .filter((t) => t.accuracy >= 70)
        .sort((a, b) => b.accuracy - a.accuracy)
        .slice(0, 5);
      const weakTopics = allTopics
        .filter((t) => t.accuracy < 70)
        .sort((a, b) => a.accuracy - b.accuracy)
        .slice(0, 5);

      const mistakeRows = db
        .prepare(
          `SELECT topic, subject, mistake_category, SUM(times_missed) as total_missed
           FROM mistake_book
           WHERE user_id = ? AND resolved = 0
           GROUP BY topic, subject
           ORDER BY total_missed DESC
           LIMIT 5`
        )
        .all(userId) as Array<{
        topic: string;
        subject: string;
        mistake_category: MistakeCategory;
        total_missed: number;
      }>;

      const chartSeries = [...chartAgg.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .slice(-14)
        .map(([date, v]) => ({
          date,
          label: date.slice(5),
          accuracy: Math.round(v.accSum / v.quizzes),
          score: Math.round(v.scoreSum / v.quizzes),
          quizzes: v.quizzes,
        }));

      res.json({
        hasData: true,
        range,
        totalQuizzes: rows.length,
        totalAttempted,
        totalCorrect,
        totalWrong,
        overallAccuracy,
        avgTimePerQuestion,
        bestScore: bestScore === -Infinity ? 0 : bestScore,
        streaks,
        subjectPerformance,
        strongTopics,
        weakTopics,
        mistakenConcepts: mistakeRows.map((m) => ({
          topic: m.topic,
          subject: m.subject,
          count: m.total_missed,
          topCategory: m.mistake_category,
        })),
        speedMatrix,
        chartSeries,
        recentAttempts: rows.slice(0, 25).map((r) => ({
          attemptId: r.id,
          mode: r.mode,
          subject: r.subject,
          score: r.score,
          maxScore: r.max_score,
          accuracy: r.accuracy,
          totalQuestions: r.total_questions,
          timeSpentSeconds: r.time_spent_seconds,
          createdAt: r.created_at,
        })),
      } satisfies AnalyticsSummary);
    } catch (err) {
      logServerError('/api/exam/analytics', String(err));
      res.status(500).json({ error: 'Unable to load analytics.' });
    }
  });

  // 8. Reopen Full Saved Quiz Attempt Analysis
  app.get('/api/exam/history/:attemptId', (req, res) => {
    try {
      const row = db
        .prepare('SELECT * FROM exam_attempts WHERE id = ?')
        .get(req.params.attemptId) as
        | {
            id: string;
            session_id: string;
            user_id: string;
            mode: ExamMode;
            subject: string;
            category_id: string;
            difficulty: string;
            score: number;
            max_score: number;
            correct_count: number;
            wrong_count: number;
            skipped_count: number;
            total_questions: number;
            accuracy: number;
            time_spent_seconds: number;
            avg_time_per_q: number;
            negative_marking: number;
            xp_earned: number;
            details_json: string;
            speed_matrix_json: string;
            topic_breakdown_json: string;
            created_at: string;
          }
        | undefined;

      if (!row) {
        res.status(404).json({ error: 'Quiz attempt not found.' });
        return;
      }

      const streaks = ensureExamProfile(row.user_id);
      const topicBreakdown = JSON.parse(row.topic_breakdown_json) as TopicStat[];
      const speedMatrix = JSON.parse(row.speed_matrix_json) as Record<SpeedClass, number>;
      const details = JSON.parse(row.details_json) as ExamEvaluatedDetail[];
      const weak = [...topicBreakdown].filter((t) => t.accuracy < 65).sort((a, b) => a.accuracy - b.accuracy)[0];

      const summary: ExamResultSummary = {
        attemptId: row.id,
        sessionId: row.session_id,
        mode: row.mode,
        score: row.score,
        maxScore: row.max_score,
        correctCount: row.correct_count,
        wrongCount: row.wrong_count,
        skippedCount: row.skipped_count,
        totalQuestions: row.total_questions,
        accuracy: row.accuracy,
        timeSpentSeconds: row.time_spent_seconds,
        avgTimePerQuestion: row.avg_time_per_q,
        negativeMarking: row.negative_marking,
        xpEarned: row.xp_earned,
        rank: null,
        streaks,
        speedMatrix,
        topicBreakdown,
        didWell: [`Scored ${row.score}/${row.max_score} with ${row.accuracy}% accuracy.`],
        needsImprovement: weak ? [`Review ${weak.topic} (${weak.accuracy}% accuracy).`] : ['Try harder difficulty sets.'],
        nextRecommendation: {
          label: weak ? `Practice ${weak.topic}` : 'Retry Wrong Questions',
          categoryId: row.category_id,
          subject: weak ? weak.subject : row.subject,
          topic: weak?.topic,
          difficulty: 'Medium',
        },
        examStrategyNote: null,
        mistakesSavedCount: row.wrong_count,
        details,
        createdAt: row.created_at,
      };

      res.json(summary);
    } catch (err) {
      logServerError('/api/exam/history/:attemptId', String(err));
      res.status(500).json({ error: 'Unable to load quiz history.' });
    }
  });

  // 9. Permanent Mistake Book CRUD
  app.get('/api/exam/mistakes', (req, res) => {
    try {
      const userId = String(req.query.userId ?? '').trim();
      const showResolved = req.query.resolved === '1';
      if (!userId) {
        res.json({ mistakes: [] });
        return;
      }

      const rows = db
        .prepare(
          `SELECT * FROM mistake_book
           WHERE user_id = ? ${showResolved ? '' : 'AND resolved = 0'}
           ORDER BY last_missed_at DESC`
        )
        .all(userId) as Array<{
        id: string;
        question_id: string;
        subject: string;
        topic: string;
        mistake_category: MistakeCategory;
        notes: string;
        times_missed: number;
        resolved: number;
        last_missed_at: string;
      }>;

      const qMap = new Map(getAllQuestions(true).map((q) => [q.id, q]));

      res.json({
        mistakes: rows.map((r) => ({
          id: r.id,
          questionId: r.question_id,
          subject: r.subject,
          topic: r.topic,
          mistakeCategory: r.mistake_category,
          notes: r.notes,
          timesMissed: r.times_missed,
          resolved: Boolean(r.resolved),
          lastMissedAt: r.last_missed_at,
          question: qMap.get(r.question_id),
        })),
      });
    } catch (err) {
      logServerError('/api/exam/mistakes', String(err));
      res.status(500).json({ error: 'Unable to load mistakes.' });
    }
  });

  app.patch('/api/exam/mistakes/:questionId', (req, res) => {
    try {
      const userId = String(req.body?.userId ?? '').trim();
      const questionId = req.params.questionId;
      if (!userId) {
        res.status(400).json({ error: 'userId required.' });
        return;
      }

      const validCats: MistakeCategory[] = [
        'concept',
        'calculation',
        'formula',
        'careless',
        'time-pressure',
        'guessing',
      ];
      if (req.body?.mistakeCategory && validCats.includes(req.body.mistakeCategory)) {
        db.prepare('UPDATE mistake_book SET mistake_category = ? WHERE user_id = ? AND question_id = ?').run(
          req.body.mistakeCategory,
          userId,
          questionId
        );
      }
      if (typeof req.body?.resolved === 'boolean') {
        db.prepare('UPDATE mistake_book SET resolved = ? WHERE user_id = ? AND question_id = ?').run(
          req.body.resolved ? 1 : 0,
          userId,
          questionId
        );
      }
      if (typeof req.body?.notes === 'string') {
        db.prepare('UPDATE mistake_book SET notes = ? WHERE user_id = ? AND question_id = ?').run(
          req.body.notes.slice(0, 400),
          userId,
          questionId
        );
      }
      res.json({ ok: true });
    } catch (err) {
      logServerError('/api/exam/mistakes/patch', String(err));
      res.status(500).json({ error: 'Unable to update mistake.' });
    }
  });

  app.delete('/api/exam/mistakes/:questionId', (req, res) => {
    try {
      const userId = String(req.query.userId ?? '').trim();
      if (!userId) {
        res.status(400).json({ error: 'userId required.' });
        return;
      }
      db.prepare('DELETE FROM mistake_book WHERE user_id = ? AND question_id = ?').run(
        userId,
        req.params.questionId
      );
      res.json({ ok: true });
    } catch (err) {
      logServerError('/api/exam/mistakes/delete', String(err));
      res.status(500).json({ error: 'Unable to remove mistake.' });
    }
  });

  // 10. Saved / Bookmarked Questions
  app.get('/api/exam/bookmarks', (req, res) => {
    try {
      const userId = String(req.query.userId ?? '').trim();
      if (!userId) {
        res.json({ questionIds: [], items: [] });
        return;
      }
      const rows = db
        .prepare('SELECT question_id, created_at FROM bookmarks WHERE user_id = ? ORDER BY created_at DESC')
        .all(userId) as Array<{ question_id: string; created_at: string }>;
      const qMap = new Map(getAllQuestions(true).map((q) => [q.id, q]));
      const items = rows.map((r) => qMap.get(r.question_id)).filter((q): q is ExamQuestion => Boolean(q));
      res.json({
        questionIds: rows.map((r) => r.question_id),
        items,
      });
    } catch (err) {
      logServerError('/api/exam/bookmarks', String(err));
      res.status(500).json({ error: 'Unable to load saved questions.' });
    }
  });

  app.post('/api/exam/bookmarks/:questionId', (req, res) => {
    try {
      const userId = String(req.body?.userId ?? '').trim();
      if (!userId) {
        res.status(400).json({ error: 'userId required.' });
        return;
      }
      db.prepare('INSERT OR IGNORE INTO bookmarks (user_id, question_id, created_at) VALUES (?, ?, ?)').run(
        userId,
        req.params.questionId,
        new Date().toISOString()
      );
      res.json({ ok: true });
    } catch (err) {
      logServerError('/api/exam/bookmarks/add', String(err));
      res.status(500).json({ error: 'Unable to save question.' });
    }
  });

  app.delete('/api/exam/bookmarks/:questionId', (req, res) => {
    try {
      const userId = String(req.query.userId ?? '').trim();
      if (!userId) {
        res.status(400).json({ error: 'userId required.' });
        return;
      }
      db.prepare('DELETE FROM bookmarks WHERE user_id = ? AND question_id = ?').run(
        userId,
        req.params.questionId
      );
      res.json({ ok: true });
    } catch (err) {
      logServerError('/api/exam/bookmarks/delete', String(err));
      res.status(500).json({ error: 'Unable to remove bookmark.' });
    }
  });

  // 11. Exam Leaderboard (Daily / Weekly / Monthly / All-Time; display name optional)
  app.get('/api/exam/leaderboard', (req, res) => {
    try {
      const period = String(req.query.period ?? 'all') as 'daily' | 'weekly' | 'monthly' | 'all';
      const search = String(req.query.search ?? '').trim().toLowerCase();

      let dateClause = '';
      const params: string[] = [];
      if (period === 'daily') {
        dateClause = 'AND a.created_at >= ?';
        params.push(`${todayUtc()}T00:00:00.000Z`);
      } else if (period === 'weekly') {
        const d = new Date();
        d.setUTCDate(d.getUTCDate() - 7);
        dateClause = 'AND a.created_at >= ?';
        params.push(d.toISOString());
      } else if (period === 'monthly') {
        const d = new Date();
        d.setUTCDate(d.getUTCDate() - 30);
        dateClause = 'AND a.created_at >= ?';
        params.push(d.toISOString());
      }

      const rows = db
        .prepare(
          `SELECT
             a.user_id as user_id,
             COALESCE(NULLIF(ep.display_name, ''), NULLIF(p.name, ''), 'Anonymous Learner') as display_name,
             COALESCE(ep.exam_xp, 0) as xp,
             COALESCE(ep.exam_level, 'Beginner') as level_title,
             ROUND(AVG(a.accuracy), 1) as accuracy,
             COUNT(a.id) as quizzes_completed,
             MAX(a.score) as best_score
           FROM exam_attempts a
           LEFT JOIN exam_profiles ep ON ep.user_id = a.user_id
           LEFT JOIN players p ON p.id = a.user_id
           WHERE a.is_test = 0 ${dateClause}
           GROUP BY a.user_id
           ORDER BY xp DESC, accuracy DESC, best_score DESC
           LIMIT 50`
        )
        .all(...params) as Array<{
        user_id: string;
        display_name: string;
        xp: number;
        level_title: string;
        accuracy: number;
        quizzes_completed: number;
        best_score: number;
      }>;

      const filtered = search
        ? rows.filter((r) => r.display_name.toLowerCase().includes(search))
        : rows;

      const entries: ExamLeaderboardRow[] = filtered.map((r, i) => ({
        rank: i + 1,
        playerId: r.user_id,
        displayName: r.display_name,
        xp: r.xp,
        levelTitle: computeExamLevel(r.xp).title,
        accuracy: r.accuracy,
        quizzesCompleted: r.quizzes_completed,
        bestScore: r.best_score,
      }));

      res.json({ period, entries });
    } catch (err) {
      logServerError('/api/exam/leaderboard', String(err));
      res.status(500).json({ error: 'Unable to load leaderboard.' });
    }
  });

  // Update optional Display Name on Exam Profile (no PII required)
  app.post('/api/exam/profile/display-name', (req, res) => {
    try {
      const userId = String(req.body?.userId ?? '').trim();
      const displayName = String(req.body?.displayName ?? '').trim().slice(0, 40);
      if (!userId) {
        res.status(400).json({ error: 'userId required.' });
        return;
      }
      const streaks = ensureExamProfile(userId, displayName || undefined);
      res.json({ ok: true, displayName: displayName || 'Anonymous Learner', streaks });
    } catch (err) {
      logServerError('/api/exam/profile/display-name', String(err));
      res.status(500).json({ error: 'Unable to update display name.' });
    }
  });

  // 12. Admin Question Management (Add / Edit / Delete / Verify with Strict Validation)
  app.get('/api/admin/questions', (req, res) => {
    if (req.headers['x-cgquiz-dev'] !== DEV_HEADER_TOKEN) {
      res.status(403).json({ error: 'Admin/Developer token required.' });
      return;
    }
    const questions = getAllQuestions(true);
    res.json({ total: questions.length, questions });
  });

  app.post('/api/admin/questions', (req, res) => {
    if (req.headers['x-cgquiz-dev'] !== DEV_HEADER_TOKEN) {
      res.status(403).json({ error: 'Admin/Developer token required.' });
      return;
    }
    const check = validateAdminQuestion((req.body ?? {}) as Record<string, unknown>);
    if (!check.valid || !check.question) {
      res.status(400).json({ error: check.error || 'Invalid question payload.' });
      return;
    }
    const q = check.question;
    const now = new Date().toISOString();
    db.prepare(
      `INSERT OR REPLACE INTO exam_questions (
        id, subject, category_id, chapter, topic, difficulty, question_type,
        source, year, verified, payload_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      q.id,
      q.subject,
      q.categoryId,
      q.chapter,
      q.topic,
      q.difficulty,
      q.questionType,
      q.source,
      q.year,
      q.verified ? 1 : 0,
      JSON.stringify(q),
      now,
      now
    );
    res.status(201).json({ question: q });
  });

  app.put('/api/admin/questions/:id', (req, res) => {
    if (req.headers['x-cgquiz-dev'] !== DEV_HEADER_TOKEN) {
      res.status(403).json({ error: 'Admin/Developer token required.' });
      return;
    }
    const check = validateAdminQuestion({ ...(req.body ?? {}), id: req.params.id });
    if (!check.valid || !check.question) {
      res.status(400).json({ error: check.error || 'Invalid question payload.' });
      return;
    }
    const q = check.question;
    const now = new Date().toISOString();
    db.prepare(
      `INSERT OR REPLACE INTO exam_questions (
        id, subject, category_id, chapter, topic, difficulty, question_type,
        source, year, verified, payload_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT created_at FROM exam_questions WHERE id = ?), ?), ?)`
    ).run(
      q.id,
      q.subject,
      q.categoryId,
      q.chapter,
      q.topic,
      q.difficulty,
      q.questionType,
      q.source,
      q.year,
      q.verified ? 1 : 0,
      JSON.stringify(q),
      q.id,
      now,
      now
    );
    res.json({ question: q });
  });

  app.delete('/api/admin/questions/:id', (req, res) => {
    if (req.headers['x-cgquiz-dev'] !== DEV_HEADER_TOKEN) {
      res.status(403).json({ error: 'Admin/Developer token required.' });
      return;
    }
    const del = db.prepare('DELETE FROM exam_questions WHERE id = ?').run(req.params.id);
    res.json({ ok: true, deleted: del.changes });
  });

  // 13. Optional AI Concept Variant Generator (Strictly Validated; Clean 503 if unconfigured)
  app.post('/api/exam/generate-ai', async (req, res) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
        res.status(503).json({
          error: 'AI generation is not configured on this server. Using curated question bank instead.',
          fallbackAvailable: true,
        });
        return;
      }

      const topic = String(req.body?.topic ?? 'Engineering Foundations').trim().slice(0, 80);
      const categoryId = String(req.body?.categoryId ?? 'engineering').trim();
      const difficulty = (DIFFICULTIES.includes(req.body?.difficulty as ExamDifficulty)
        ? req.body.difficulty
        : 'Medium') as ExamDifficulty;
      const count = Math.min(5, Math.max(1, Number(req.body?.count ?? 3)));

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
      });

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Generate ${count} factual, educational multiple-choice engineering quiz questions on the topic "${topic}" at "${difficulty}" difficulty. Do not invent fake 2026 statistics, cutoff ranks, or unverified seat numbers.`,
        config: {
          systemInstruction:
            'You are an engineering educator creating clean, conceptual single-choice MCQ questions for students. Every question must have exactly 4 distinct options, index 0..3 answer, clear explanation, and a Career Fair Knowledge Base source.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                question: { type: Type.STRING },
                options: { type: Type.ARRAY, items: { type: Type.STRING } },
                answer: { type: Type.INTEGER },
                why: { type: Type.STRING },
                concept: { type: Type.STRING },
                shortcut: { type: Type.STRING },
                commonTrap: { type: Type.STRING },
                chapter: { type: Type.STRING },
                topic: { type: Type.STRING },
              },
            },
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '[]').trim()) as Array<Record<string, unknown>>;
      const rawCandidates = parsed.map((item, idx) => ({
        id: `ai_${Date.now()}_${idx}_${crypto.randomBytes(2).toString('hex')}`,
        question: item.question,
        options: item.options,
        answer: item.answer,
        explanation: {
          why: item.why,
          concept: item.concept || topic,
          shortcut: item.shortcut || 'Analyze core engineering constraints.',
          commonTrap: item.commonTrap || 'Double-check assumptions before selecting.',
        },
        subject: topic,
        categoryId: ALLOWED_ENGINEERING_CATEGORY_IDS.has(categoryId) ? categoryId : 'engineering',
        chapter: item.chapter || 'AI Practice Set',
        topic: item.topic || topic,
        difficulty,
        questionType: 'single',
        source: 'AI Practice Generator (Verified Schema)',
        year: null,
        tags: ['ai-practice', categoryId],
        verified: true,
      }));

      const { validQuestions } = validateQuestionBank(rawCandidates);
      if (validQuestions.length === 0) {
        res.status(502).json({
          error: 'Generated items did not pass strict validation. Using curated bank instead.',
          fallbackAvailable: true,
        });
        return;
      }

      res.json({ questions: validQuestions });
    } catch (err) {
      logServerError('/api/exam/generate-ai', String(err));
      res.status(502).json({
        error: 'Unable to reach AI generator right now. Curated question bank remains ready.',
        fallbackAvailable: true,
      });
    }
  });
}

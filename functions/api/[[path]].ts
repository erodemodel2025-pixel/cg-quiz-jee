import { ENGINEERING_CATEGORIES, EXAM_CATEGORIES } from '../../shared/categories.ts';
import { getAllBuiltinExamQuestions } from '../../shared/examQuestions.ts';
import {
  CIRCUIT_STAGES,
  CODE_PUZZLES,
  COMPONENT_CARDS,
  LOGIC_PUZZLES,
} from '../../shared/minigameData.ts';
import { computeExamLevel, getDailyChallengeForDate } from '../../shared/progression.ts';
import { QUESTION_BANK } from '../../shared/questionBank.ts';
import {
  getModeScoringRules,
  selectBalancedQuizQuestions,
} from '../../shared/quizPipeline.ts';
import type {
  ExamAnswerItem,
  ExamDifficulty,
  ExamEvaluatedDetail,
  ExamMode,
  ExamQuestion,
  ExamResultSummary,
  ExamSettings,
  ExamUserAnswer,
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
const CODE_PUZZLE_MAP = new Map(CODE_PUZZLES.map((p) => [p.id, p]));
const LOGIC_PUZZLE_MAP = new Map(LOGIC_PUZZLES.map((p) => [p.id, p]));

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

    if (path === '/api/players/register' && method === 'POST') {
      const body = await parseJsonBody(request);
      const now = new Date().toISOString();
      return jsonResponse({
        player: {
          id: String(body.existingId || `p_${Date.now()}`),
          name: String(body.name || 'Engineer'),
          className: String(body.className || 'Class 12'),
          xp: 0,
          level: 1,
          title: 'Circuit Rookie',
          streakBest: 0,
          gamesPlayed: 0,
          activeTheme: 'cyber-midnight',
          unlockedThemes: ['cyber-midnight'],
          achievements: [],
          createdAt: now,
        },
        migrated: false,
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

    return jsonResponse({ error: `API endpoint not found: ${method} ${path}` }, 404);
  } catch (err) {
    return jsonResponse(
      { error: err instanceof Error ? err.message : 'Edge request handling failed.' },
      500
    );
  }
}

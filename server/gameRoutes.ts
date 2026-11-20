import crypto from 'node:crypto';
import type express from 'express';
import {
  DIFFICULTY_MAP,
  GAME_CATEGORIES,
  GAME_DIFFICULTY_CONFIGS,
  SMART_QUESTION_BANK,
  selectSmartGameQuestions,
} from '../shared/smartQuestionBank.ts';
import type {
  GameDifficultyId,
  GameEvaluatedItem,
  GameLeaderboardEntry,
  GameLeaderboardView,
  GameResultPayload,
  PlayerProfile,
  SmartGameQuestion,
} from '../shared/types.ts';
import { db, logServerError } from './db.ts';

interface UpdateProgressionArgs {
  playerId: string;
  xpEarned: number;
  maxStreak: number;
  newAchievements: string[];
}

interface UpdateProgressionResult {
  player: PlayerProfile;
  leveledUp: boolean;
  unlockedAchievements: string[];
}

interface GameRoutesDeps {
  updatePlayerProgression: (params: UpdateProgressionArgs) => UpdateProgressionResult;
}

const VALID_DIFFICULTIES = new Set<GameDifficultyId>(['easy', 'moderate', 'hard', 'jee']);

export function normalizeDifficulty(raw: unknown): GameDifficultyId | null {
  const val = String(raw ?? '').trim().toLowerCase();
  if (VALID_DIFFICULTIES.has(val as GameDifficultyId)) {
    return val as GameDifficultyId;
  }
  return null;
}

export function sanitizeSmartQuestion(q: SmartGameQuestion) {
  const { correctIndex: _c, explanation: _e, ...rest } = q;
  return rest;
}

export function queryGameLeaderboard(params: {
  view: GameLeaderboardView;
  difficulty?: string;
  category?: string;
  search?: string;
  userId?: string;
  includeTest?: boolean;
}): {
  view: GameLeaderboardView;
  rankingMethodDescription: string;
  totalPlayers: number;
  top3: GameLeaderboardEntry[];
  entries: GameLeaderboardEntry[];
  currentUserEntry: GameLeaderboardEntry | null;
} {
  const view: GameLeaderboardView = params.view === 'overall' ? 'overall' : 'highest';
  const difficulty = (params.difficulty || 'all').toLowerCase();
  const category = (params.category || 'all').toLowerCase();
  const search = (params.search || '').trim().toLowerCase();
  const userId = (params.userId || '').trim();

  const whereClauses: string[] = [];
  const sqlParams: Array<string | number> = [];

  if (!params.includeTest) {
    whereClauses.push('gr.is_test = 0 AND p.is_test = 0');
  }
  if (difficulty !== 'all' && VALID_DIFFICULTIES.has(difficulty as GameDifficultyId)) {
    whereClauses.push('gr.difficulty = ?');
    sqlParams.push(difficulty);
  }
  if (category !== 'all') {
    whereClauses.push('gr.category = ?');
    sqlParams.push(category);
  }

  const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';

  let rankedAll: GameLeaderboardEntry[] = [];

  if (view === 'highest') {
    const rows = db
      .prepare(
        `WITH ranked_runs AS (
           SELECT
             gr.user_id,
             p.name AS username,
             p.class_name,
             p.title,
             gr.score,
             gr.accuracy,
             gr.completion_time,
             gr.difficulty,
             gr.category,
             gr.created_at,
             ROW_NUMBER() OVER (
               PARTITION BY gr.user_id
               ORDER BY gr.score DESC, gr.accuracy DESC, gr.completion_time ASC, gr.created_at ASC
             ) AS rn,
             COUNT(*) OVER (PARTITION BY gr.user_id) AS games_played,
             SUM(gr.score) OVER (PARTITION BY gr.user_id) AS total_points
           FROM game_results gr
           JOIN players p ON p.id = gr.user_id
           ${whereSql}
         )
         SELECT * FROM ranked_runs
         WHERE rn = 1
         ORDER BY score DESC, accuracy DESC, completion_time ASC, created_at ASC`
      )
      .all(...sqlParams) as Array<{
      user_id: string;
      username: string;
      class_name: string;
      title: string;
      score: number;
      accuracy: number;
      completion_time: number;
      difficulty: string;
      category: string;
      created_at: string;
      games_played: number;
      total_points: number;
    }>;

    rankedAll = rows.map((r, i) => ({
      rank: i + 1,
      userId: r.user_id,
      username: r.username,
      className: r.class_name,
      title: r.title,
      score: r.score,
      bestScore: r.score,
      totalPoints: r.total_points,
      gamesPlayed: r.games_played,
      accuracy: r.accuracy,
      completionTime: r.completion_time,
      difficulty: r.difficulty,
      category: r.category,
      createdAt: r.created_at,
    }));
  } else {
    const rows = db
      .prepare(
        `SELECT
           gr.user_id,
           p.name AS username,
           p.class_name,
           p.title,
           SUM(gr.score) AS total_points,
           MAX(gr.score) AS best_score,
           COUNT(gr.result_id) AS games_played,
           ROUND(AVG(gr.accuracy), 1) AS avg_accuracy,
           ROUND(AVG(gr.completion_time)) AS avg_time,
           MAX(gr.difficulty) AS difficulty,
           MAX(gr.category) AS category,
           MAX(gr.created_at) AS latest_at
         FROM game_results gr
         JOIN players p ON p.id = gr.user_id
         ${whereSql}
         GROUP BY gr.user_id
         ORDER BY total_points DESC, avg_accuracy DESC, games_played DESC, avg_time ASC, latest_at ASC`
      )
      .all(...sqlParams) as Array<{
      user_id: string;
      username: string;
      class_name: string;
      title: string;
      total_points: number;
      best_score: number;
      games_played: number;
      avg_accuracy: number;
      avg_time: number;
      difficulty: string;
      category: string;
      latest_at: string;
    }>;

    rankedAll = rows.map((r, i) => ({
      rank: i + 1,
      userId: r.user_id,
      username: r.username,
      className: r.class_name,
      title: r.title,
      score: r.total_points,
      bestScore: r.best_score,
      totalPoints: r.total_points,
      gamesPlayed: r.games_played,
      accuracy: r.avg_accuracy,
      completionTime: r.avg_time,
      difficulty: r.difficulty,
      category: r.category,
      createdAt: r.latest_at,
    }));
  }

  const currentUserEntry = userId
    ? rankedAll.find((e) => e.userId === userId) || null
    : null;

  const top3 = rankedAll.slice(0, 3);
  const filteredEntries = search
    ? rankedAll.filter((e) => e.username.toLowerCase().includes(search))
    : rankedAll;

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

export function registerGameRoutes(app: express.Express, deps: GameRoutesDeps): void {
  // 1. Game configuration, difficulty tiers & counts
  app.get('/api/game/config', (_req, res) => {
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

    res.json({
      difficulties: GAME_DIFFICULTY_CONFIGS,
      categories: GAME_CATEGORIES.map((c) => ({
        ...c,
        questionCount: countsByCategory[c.id] || 0,
      })),
      countsByDifficulty,
      totalQuestions: SMART_QUESTION_BANK.length,
    });
  });

  // 2. Start authenticated game session (never leaks correct answers)
  app.post('/api/game/start', (req, res) => {
    try {
      const userId = String(req.body?.userId ?? '').trim();
      if (!userId) {
        res.status(401).json({ error: 'Authentication required: please sign in to start a scored game.' });
        return;
      }

      const playerRow = db
        .prepare('SELECT id, name, is_test FROM players WHERE id = ?')
        .get(userId) as { id: string; name: string; is_test: number } | undefined;

      if (!playerRow) {
        res.status(401).json({ error: 'Registered player account required before starting a scored game.' });
        return;
      }

      const difficulty = req.body?.difficulty
        ? normalizeDifficulty(req.body.difficulty)
        : 'easy';
      if (!difficulty) {
        res.status(400).json({ error: 'Invalid difficulty level. Must be easy, moderate, hard, or jee.' });
        return;
      }

      const category = String(req.body?.category ?? 'all').trim() || 'all';
      const questionCount = Math.max(5, Math.min(25, Math.round(Number(req.body?.questionCount ?? 10))));
      const rawLimit = Number(req.body?.timeLimitSeconds ?? 0);
      const timeLimitSeconds = rawLimit > 0 ? Math.max(30, Math.min(3600, Math.round(rawLimit))) : 0;
      const isTest = req.body?.isTest === true || playerRow.is_test === 1 ? 1 : 0;

      const selected = selectSmartGameQuestions({
        difficulty,
        category,
        count: questionCount,
      });

      const sessionId = `gs_${Date.now()}_${crypto.randomBytes(5).toString('hex')}`;
      const startedAt = Date.now();
      const expiresAt = startedAt + Math.max(timeLimitSeconds > 0 ? timeLimitSeconds * 1000 + 5 * 60 * 1000 : 2 * 60 * 60 * 1000, 60 * 60 * 1000);

      db.prepare(
        `INSERT INTO game_sessions (
          session_id, user_id, difficulty, category, question_count, time_limit_seconds,
          question_ids_json, session_questions_json, started_at, expires_at, status, is_test
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)`
      ).run(
        sessionId,
        userId,
        difficulty,
        category,
        selected.length,
        timeLimitSeconds,
        JSON.stringify(selected.map((q) => q.id)),
        JSON.stringify(selected),
        startedAt,
        expiresAt,
        isTest
      );

      const diffCfg = DIFFICULTY_MAP[difficulty];

      res.json({
        sessionId,
        userId,
        username: playerRow.name,
        difficulty,
        difficultyConfig: diffCfg,
        category,
        questionCount: selected.length,
        marksPerCorrect: diffCfg.marksPerCorrect,
        timeLimitSeconds,
        startedAt,
        questions: selected.map(sanitizeSmartQuestion),
      });
    } catch (err) {
      logServerError('/api/game/start', String(err));
      res.status(500).json({ error: 'Could not start game session.' });
    }
  });

  // 3. Optional immediate answer feedback during play (does not finalize or submit score)
  app.post('/api/game/check', (req, res) => {
    try {
      const sessionId = String(req.body?.sessionId ?? '').trim();
      const userId = String(req.body?.userId ?? '').trim();
      const questionId = String(req.body?.questionId ?? '').trim();
      const selectedIndex = Number(req.body?.selectedIndex);

      if (!userId) {
        res.status(401).json({ error: 'Authentication required.' });
        return;
      }

      const session = db
        .prepare('SELECT session_id, user_id, session_questions_json, status FROM game_sessions WHERE session_id = ?')
        .get(sessionId) as
        | { session_id: string; user_id: string; session_questions_json: string; status: string }
        | undefined;

      if (!session) {
        res.status(404).json({ error: 'Game session not found.' });
        return;
      }
      if (session.user_id !== userId) {
        res.status(403).json({ error: 'Session does not belong to current user.' });
        return;
      }
      if (session.status !== 'active') {
        res.status(400).json({ error: 'Game session is already completed.' });
        return;
      }

      const questions = JSON.parse(session.session_questions_json) as SmartGameQuestion[];
      const q = questions.find((item) => item.id === questionId);
      if (!q) {
        res.status(404).json({ error: 'Question not part of this session.' });
        return;
      }

      const isCorrect = selectedIndex === q.correctIndex;
      res.json({
        correct: isCorrect,
        correctIndex: q.correctIndex,
        explanation: q.explanation,
        pointsAwarded: isCorrect ? q.marks : 0,
      });
    } catch (err) {
      logServerError('/api/game/check', String(err));
      res.status(500).json({ error: 'Could not check answer.' });
    }
  });

  // 4. Authoritative End-of-Game Validation, DB Persistence & Leaderboard/Podium Calculation
  app.post('/api/game/submit', (req, res) => {
    try {
      const sessionId = String(req.body?.sessionId ?? '').trim();
      const userId = String(req.body?.userId ?? '').trim();
      const submittedAnswers = Array.isArray(req.body?.answers)
        ? (req.body.answers as Array<{ questionId?: string; selectedIndex?: number | null }>)
        : [];

      // Enforce authenticated user
      if (!userId) {
        res.status(401).json({ error: 'Authentication required: log in to submit your score.' });
        return;
      }

      const playerRow = db
        .prepare('SELECT id, name, class_name, is_test FROM players WHERE id = ?')
        .get(userId) as { id: string; name: string; class_name: string; is_test: number } | undefined;

      if (!playerRow) {
        res.status(401).json({ error: 'Invalid or unregistered user account. Score rejected.' });
        return;
      }

      if (!sessionId) {
        res.status(400).json({ error: 'sessionId is required.' });
        return;
      }

      const session = db
        .prepare('SELECT * FROM game_sessions WHERE session_id = ?')
        .get(sessionId) as
        | {
            session_id: string;
            user_id: string;
            difficulty: GameDifficultyId;
            category: string;
            question_count: number;
            time_limit_seconds: number;
            session_questions_json: string;
            started_at: number;
            expires_at: number;
            status: string;
            is_test: number;
          }
        | undefined;

      if (!session) {
        res.status(404).json({ error: 'Game session not found.' });
        return;
      }

      // Enforce session ownership (prevents submitting under another player's name/ID)
      if (session.user_id !== userId) {
        res.status(403).json({ error: 'Forbidden: this game session belongs to a different player.' });
        return;
      }

      // Enforce anti-duplicate protection
      const existingResult = db
        .prepare('SELECT result_id FROM game_results WHERE session_id = ?')
        .get(sessionId);

      if (session.status !== 'active' || existingResult) {
        res.status(409).json({
          error: 'Duplicate submission blocked: this game session has already been recorded.',
          alreadySubmitted: true,
        });
        return;
      }

      if (Date.now() > session.expires_at) {
        res.status(400).json({ error: 'Game session has expired.' });
        return;
      }

      const includeTest = session.is_test === 1;
      const prevHighestTop3 = queryGameLeaderboard({ view: 'highest', includeTest }).top3.map(
        (e) => e.userId
      );
      const prevOverallTop3 = queryGameLeaderboard({ view: 'overall', includeTest }).top3.map(
        (e) => e.userId
      );

      const sessionQuestions = JSON.parse(session.session_questions_json) as SmartGameQuestion[];
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

      for (const q of sessionQuestions) {
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

        const pointsAwarded = isCorrect ? marksPerCorrect : 0;

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
          pointsAwarded,
          explanation: q.explanation,
        });
      }

      const totalQuestions = Math.max(1, sessionQuestions.length);
      const score = correctAnswers * marksPerCorrect;
      const maxPossibleScore = totalQuestions * marksPerCorrect;
      const accuracy = Math.round((correctAnswers / totalQuestions) * 1000) / 10;
      const completionTime = Math.max(1, Math.round((Date.now() - session.started_at) / 1000));
      const xpEarned = Math.max(10, Math.round(score * 0.5) + (accuracy === 100 ? 40 : 0));
      const nowIso = new Date().toISOString();
      const resultId = `gr_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

      let progression: UpdateProgressionResult | null = null;

      db.exec('BEGIN');
      try {
        const updateSession = db
          .prepare(
            "UPDATE game_sessions SET status = 'completed', completed_at = ? WHERE session_id = ? AND status = 'active'"
          )
          .run(Date.now(), sessionId);

        if (updateSession.changes !== 1) {
          db.exec('ROLLBACK');
          res.status(409).json({
            error: 'Duplicate submission blocked: session already closed.',
            alreadySubmitted: true,
          });
          return;
        }

        db.prepare(
          `INSERT INTO game_results (
            result_id, session_id, user_id, username, score,
            correct_answers, incorrect_answers, unanswered, total_questions,
            accuracy, completion_time, difficulty, category, xp_earned,
            details_json, is_test, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(
          resultId,
          sessionId,
          userId,
          playerRow.name,
          score,
          correctAnswers,
          incorrectAnswers,
          unanswered,
          totalQuestions,
          accuracy,
          completionTime,
          session.difficulty,
          session.category,
          xpEarned,
          JSON.stringify(details),
          session.is_test,
          nowIso
        );

        // Keep legacy submissions table synced for ProfilePage run history
        db.prepare(
          `INSERT OR IGNORE INTO submissions (
            id, session_id, player_id, mode, game_type, category_id, difficulty,
            score, correct_count, total_questions, accuracy, time_spent_seconds,
            max_streak, xp_earned, answers_detail, is_test, created_at
          ) VALUES (?, ?, ?, 'competitive', 'iq-quiz', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(
          `sub_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
          sessionId,
          userId,
          session.category,
          session.difficulty.toUpperCase(),
          score,
          correctAnswers,
          totalQuestions,
          accuracy,
          completionTime,
          maxStreak,
          xpEarned,
          JSON.stringify(
            details.map((d) => ({
              questionId: d.questionId,
              question: d.question,
              options: d.options,
              selectedIndex: d.selectedIndex,
              correctIndex: d.correctIndex,
              correct: d.isCorrect,
              explanation: d.explanation,
              reference: d.topic,
              timeMs: Math.round((completionTime * 1000) / totalQuestions),
            }))
          ),
          session.is_test,
          nowIso
        );

        const achs = ['first_run', 'competitor'];
        if (maxStreak >= 5) achs.push('streak_master');
        if (accuracy === 100 && totalQuestions >= 5) achs.push('perfect_run');
        if (accuracy >= 80 && session.difficulty === 'easy') achs.push('easy_scholar');

        progression = deps.updatePlayerProgression({
          playerId: userId,
          xpEarned,
          maxStreak,
          newAchievements: achs,
        });

        db.exec('COMMIT');
      } catch (txErr) {
        try {
          db.exec('ROLLBACK');
        } catch {
          // ignore
        }
        throw txErr;
      }

      const highestBoard = queryGameLeaderboard({
        view: 'highest',
        userId,
        includeTest,
      });
      const overallBoard = queryGameLeaderboard({
        view: 'overall',
        userId,
        includeTest,
      });

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
        username: playerRow.name,
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
        leveledUp: progression?.leveledUp ?? false,
        unlockedAchievements: progression?.unlockedAchievements ?? [],
        player: progression?.player ?? null,
        details,
        createdAt: nowIso,
      };

      res.json(payload);
    } catch (err) {
      logServerError('/api/game/submit', String(err));
      res.status(500).json({ error: 'Failed to validate and save game score.' });
    }
  });

  // 5. Retrieve already-saved game result safely on page refresh (never re-submits!)
  app.get('/api/game/result/:sessionId', (req, res) => {
    try {
      const sessionId = String(req.params.sessionId ?? '').trim();
      const row = db
        .prepare('SELECT * FROM game_results WHERE session_id = ?')
        .get(sessionId) as
        | {
            result_id: string;
            session_id: string;
            user_id: string;
            username: string;
            score: number;
            correct_answers: number;
            incorrect_answers: number;
            unanswered: number;
            total_questions: number;
            accuracy: number;
            completion_time: number;
            difficulty: GameDifficultyId;
            category: string;
            xp_earned: number;
            details_json: string;
            is_test: number;
            created_at: string;
          }
        | undefined;

      if (!row) {
        res.status(404).json({ error: 'Saved game result not found.' });
        return;
      }

      const diffCfg = DIFFICULTY_MAP[row.difficulty] || DIFFICULTY_MAP.easy;
      const includeTest = row.is_test === 1;
      const highestBoard = queryGameLeaderboard({
        view: 'highest',
        userId: row.user_id,
        includeTest,
      });
      const overallBoard = queryGameLeaderboard({
        view: 'overall',
        userId: row.user_id,
        includeTest,
      });

      const payload: GameResultPayload = {
        resultId: row.result_id,
        sessionId: row.session_id,
        userId: row.user_id,
        username: row.username,
        score: row.score,
        maxPossibleScore: row.total_questions * diffCfg.marksPerCorrect,
        marksPerCorrect: diffCfg.marksPerCorrect,
        correctAnswers: row.correct_answers,
        incorrectAnswers: row.incorrect_answers,
        unanswered: row.unanswered,
        totalQuestions: row.total_questions,
        accuracy: row.accuracy,
        completionTime: row.completion_time,
        difficulty: row.difficulty,
        category: row.category,
        highestRank: highestBoard.currentUserEntry?.rank ?? null,
        overallRank: overallBoard.currentUserEntry?.rank ?? null,
        totalRankedPlayers: highestBoard.totalPlayers,
        enteredTop3Highest: false,
        enteredTop3Overall: false,
        top3Highest: highestBoard.top3,
        top3Overall: overallBoard.top3,
        currentUserHighestEntry: highestBoard.currentUserEntry,
        currentUserOverallEntry: overallBoard.currentUserEntry,
        xpEarned: row.xp_earned,
        leveledUp: false,
        unlockedAchievements: [],
        player: null,
        details: JSON.parse(row.details_json) as GameEvaluatedItem[],
        createdAt: row.created_at,
      };

      res.json(payload);
    } catch (err) {
      logServerError('/api/game/result/:sessionId', String(err));
      res.status(500).json({ error: 'Unable to load saved game result.' });
    }
  });

  // 6. Dual-View Real-Database Leaderboard (Highest Single Score vs Overall Performance)
  app.get('/api/game/leaderboard', (req, res) => {
    try {
      const view: GameLeaderboardView =
        String(req.query.view ?? 'highest') === 'overall' ? 'overall' : 'highest';
      const difficulty = String(req.query.difficulty ?? 'all');
      const category = String(req.query.category ?? 'all');
      const search = String(req.query.search ?? '');
      const userId = String(req.query.userId ?? '');
      const includeTest =
        req.query.includeTest === '1' && req.headers['x-cgquiz-dev'] === 'arcade-matrix-dev';

      const board = queryGameLeaderboard({
        view,
        difficulty,
        category,
        search,
        userId,
        includeTest,
      });

      res.json(board);
    } catch (err) {
      logServerError('/api/game/leaderboard', String(err));
      res.status(500).json({ error: 'Failed to load game leaderboard.' });
    }
  });

  // 7. Engineering Simulator Mission Score Submission (Car Tuning + Smartphone Lab)
  app.post('/api/simulator/submit', (req, res) => {
    try {
      const userId = String(req.body?.userId ?? '').trim();
      const simulator = req.body?.simulator === 'phone' ? 'phone' : 'car';
      const missionId = String(req.body?.missionId ?? '').trim();
      const missionTitle = String(req.body?.missionTitle ?? 'Engineering Mission').trim();
      const score = Math.max(0, Math.min(5000, Math.round(Number(req.body?.score ?? 0))));
      const accuracy = Math.max(0, Math.min(100, Number(req.body?.accuracy ?? 0)));
      const componentsExplored = Math.max(0, Math.round(Number(req.body?.componentsExplored ?? 0)));
      const buildTitle = String(req.body?.buildTitle ?? 'Custom Prototype').trim().slice(0, 80);
      const detailsSummary = String(req.body?.detailsSummary ?? '').trim().slice(0, 220);

      if (!userId) {
        res.status(401).json({ error: 'Authentication required: sign in to save simulator scores.' });
        return;
      }
      if (!missionId) {
        res.status(400).json({ error: 'missionId is required.' });
        return;
      }

      const playerRow = db
        .prepare('SELECT id, name, class_name, is_test FROM players WHERE id = ?')
        .get(userId) as { id: string; name: string; class_name: string; is_test: number } | undefined;

      if (!playerRow) {
        res.status(401).json({ error: 'Registered player account required to rank on simulator leaderboard.' });
        return;
      }

      // Prevent duplicate mission score inflation for same user + simulator + mission
      const existing = db
        .prepare(
          'SELECT result_id, score FROM simulator_results WHERE user_id = ? AND simulator = ? AND mission_id = ?'
        )
        .get(userId, simulator, missionId) as { result_id: string; score: number } | undefined;

      const nowIso = new Date().toISOString();
      const xpEarned = existing
        ? 0
        : Math.max(40, Math.round(score * 0.15) + Math.round(componentsExplored * 2));

      if (existing) {
        db.prepare(
          `UPDATE simulator_results
           SET score = MAX(score, ?), accuracy = MAX(accuracy, ?),
               components_explored = MAX(components_explored, ?),
               build_title = ?, details_summary = ?, created_at = ?
           WHERE result_id = ?`
        ).run(score, accuracy, componentsExplored, buildTitle, detailsSummary, nowIso, existing.result_id);
      } else {
        const resultId = `sr_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
        db.prepare(
          `INSERT INTO simulator_results (
            result_id, user_id, username, simulator, mission_id, mission_title,
            score, accuracy, components_explored, build_title, details_summary,
            xp_earned, is_test, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(
          resultId,
          userId,
          playerRow.name,
          simulator,
          missionId,
          missionTitle,
          score,
          accuracy,
          componentsExplored,
          buildTitle,
          detailsSummary,
          xpEarned,
          playerRow.is_test,
          nowIso
        );
      }

      const achs = ['first_run'];
      if (componentsExplored >= 10) achs.push('scholar');
      const progression =
        xpEarned > 0
          ? deps.updatePlayerProgression({
              playerId: userId,
              xpEarned,
              maxStreak: 1,
              newAchievements: achs,
            })
          : null;

      const stats = db
        .prepare(
          `SELECT
             COALESCE(SUM(score), 0) AS total_score,
             COUNT(*) AS missions_completed,
             COALESCE(MAX(components_explored), 0) AS components_explored,
             COALESCE(ROUND(AVG(accuracy), 1), 0) AS avg_acc,
             COALESCE(SUM(xp_earned), 0) AS sim_xp
           FROM simulator_results
           WHERE user_id = ?`
        )
        .get(userId) as {
        total_score: number;
        missions_completed: number;
        components_explored: number;
        avg_acc: number;
        sim_xp: number;
      };

      res.json({
        savedToLeaderboard: true,
        alreadyCompletedMission: Boolean(existing),
        xpEarned,
        leveledUp: progression?.leveledUp ?? false,
        unlockedAchievements: progression?.unlockedAchievements ?? [],
        player: progression?.player ?? null,
        progress: {
          engineeringXp: stats.sim_xp,
          missionsCompleted: stats.missions_completed,
          componentsExplored: Math.max(stats.components_explored, componentsExplored),
          engineeringAccuracy: stats.avg_acc,
          totalScore: stats.total_score,
        },
      });
    } catch (err) {
      logServerError('/api/simulator/submit', String(err));
      res.status(500).json({ error: 'Failed to save simulator mission score.' });
    }
  });

  // 8. Engineering Simulator Leaderboard (Car Tuning + Smartphone Engineering Lab)
  app.get('/api/simulator/leaderboard', (req, res) => {
    try {
      const simulator = String(req.query.simulator ?? 'all').toLowerCase();
      const search = String(req.query.search ?? '').trim().toLowerCase();
      const userId = String(req.query.userId ?? '').trim();
      const includeTest =
        req.query.includeTest === '1' && req.headers['x-cgquiz-dev'] === 'arcade-matrix-dev';

      const whereClauses: string[] = [];
      const sqlParams: Array<string | number> = [];

      if (!includeTest) {
        whereClauses.push('sr.is_test = 0 AND p.is_test = 0');
      }
      if (simulator === 'car' || simulator === 'phone') {
        whereClauses.push('sr.simulator = ?');
        sqlParams.push(simulator);
      }

      const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';
      const rows = db
        .prepare(
          `SELECT
             sr.user_id,
             p.name AS username,
             p.class_name,
             p.title,
             SUM(sr.score) AS total_points,
             MAX(sr.score) AS best_score,
             COUNT(sr.result_id) AS missions_completed,
             ROUND(AVG(sr.accuracy), 1) AS avg_accuracy,
             MAX(sr.components_explored) AS components_explored,
             MAX(sr.simulator) AS simulator,
             MAX(sr.created_at) AS latest_at
           FROM simulator_results sr
           JOIN players p ON p.id = sr.user_id
           ${whereSql}
           GROUP BY sr.user_id
           ORDER BY total_points DESC, avg_accuracy DESC, missions_completed DESC, latest_at ASC`
        )
        .all(...sqlParams) as Array<{
        user_id: string;
        username: string;
        class_name: string;
        title: string;
        total_points: number;
        best_score: number;
        missions_completed: number;
        avg_accuracy: number;
        components_explored: number;
        simulator: string;
        latest_at: string;
      }>;

      const rankedAll: GameLeaderboardEntry[] = rows.map((r, idx) => ({
        rank: idx + 1,
        userId: r.user_id,
        username: r.username,
        className: r.class_name,
        title: r.title,
        score: r.total_points,
        bestScore: r.best_score,
        totalPoints: r.total_points,
        gamesPlayed: r.missions_completed,
        accuracy: r.avg_accuracy,
        completionTime: r.components_explored,
        difficulty: r.simulator === 'phone' ? 'phone-lab' : 'car-sim',
        category: 'engineering-simulator',
        createdAt: r.latest_at,
      }));

      const currentUserEntry = userId
        ? rankedAll.find((e) => e.userId === userId) || null
        : null;
      const filtered = search
        ? rankedAll.filter((e) => e.username.toLowerCase().includes(search))
        : rankedAll;

      res.json({
        view: 'overall',
        rankingMethodDescription:
          'Ranked by verified cumulative engineering mission points across the Car Tuning Simulator and Smartphone Engineering Lab (one verified best submission per mission).',
        totalPlayers: rankedAll.length,
        top3: rankedAll.slice(0, 3),
        entries: filtered.slice(0, 100),
        currentUserEntry,
      });
    } catch (err) {
      logServerError('/api/simulator/leaderboard', String(err));
      res.status(500).json({ error: 'Failed to load simulator leaderboard.' });
    }
  });
}

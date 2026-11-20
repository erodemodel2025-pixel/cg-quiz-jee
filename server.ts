import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import { ENGINEERING_CATEGORIES } from './shared/categories.ts';
import {
  CIRCUIT_STAGES,
  CODE_PUZZLES,
  COMPONENT_CARDS,
  LOGIC_PUZZLES,
} from './shared/minigameData.ts';
import {
  ACHIEVEMENTS,
  computeLevelFromXp,
  getDailyChallengeForDate,
  getUnlockedThemesForLevel,
} from './shared/progression.ts';
import { QUESTION_BANK } from './shared/questionBank.ts';
import {
  CLASS_OPTIONS,
  type AnswerDetail,
  type ClassOption,
  type Difficulty,
  type GameModeId,
  type PixelThemeId,
  type PlayerProfile,
  type QuizMode,
} from './shared/types.ts';
import { db, logServerError } from './server/db.ts';
import { registerExamRoutes } from './server/examRoutes.ts';
import { registerGameRoutes } from './server/gameRoutes.ts';

const PORT = Number(process.env.PORT || 3000);
const DEV_HEADER_TOKEN = 'arcade-matrix-dev';

const QUESTION_MAP = new Map(QUESTION_BANK.map((q) => [q.id, q]));
const CODE_PUZZLE_MAP = new Map(CODE_PUZZLES.map((p) => [p.id, p]));
const LOGIC_PUZZLE_MAP = new Map(LOGIC_PUZZLES.map((p) => [p.id, p]));
const ACHIEVEMENT_MAP = new Map(ACHIEVEMENTS.map((a) => [a.id, a]));

interface PlayerRow {
  id: string;
  name: string;
  name_lower: string;
  class_name: string;
  xp: number;
  level: number;
  title: string;
  streak_best: number;
  games_played: number;
  active_theme: string;
  unlocked_themes: string;
  achievements: string;
  is_test: number;
  created_at: string;
  updated_at: string;
}

function rowToPlayer(row: PlayerRow): PlayerProfile {
  return {
    id: row.id,
    name: row.name,
    className: row.class_name as ClassOption,
    xp: row.xp,
    level: row.level,
    title: row.title,
    streakBest: row.streak_best,
    gamesPlayed: row.games_played,
    activeTheme: row.active_theme as PixelThemeId,
    unlockedThemes: JSON.parse(row.unlocked_themes) as PixelThemeId[],
    achievements: JSON.parse(row.achievements) as string[],
    createdAt: row.created_at,
  };
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function updatePlayerProgression(params: {
  playerId: string;
  xpEarned: number;
  maxStreak: number;
  newAchievements: string[];
}): {
  player: PlayerProfile;
  leveledUp: boolean;
  unlockedAchievements: string[];
  newlyUnlockedThemes: PixelThemeId[];
} {
  const row = db
    .prepare('SELECT * FROM players WHERE id = ?')
    .get(params.playerId) as unknown as PlayerRow | undefined;
  if (!row) {
    throw new Error('Player not found');
  }

  const currentAchievements = new Set<string>(JSON.parse(row.achievements));
  const unlockedAchievements: string[] = [];
  let achievementXp = 0;

  for (const achId of params.newAchievements) {
    if (!currentAchievements.has(achId) && ACHIEVEMENT_MAP.has(achId)) {
      currentAchievements.add(achId);
      unlockedAchievements.push(achId);
      achievementXp += ACHIEVEMENT_MAP.get(achId)!.xpBonus;
    }
  }

  const totalXp = row.xp + Math.max(0, params.xpEarned) + achievementXp;
  const levelInfo = computeLevelFromXp(totalXp);
  const leveledUp = levelInfo.level > row.level;

  const prevThemes = new Set<PixelThemeId>(JSON.parse(row.unlocked_themes));
  const targetThemes = getUnlockedThemesForLevel(levelInfo.level);
  const newlyUnlockedThemes: PixelThemeId[] = [];
  for (const t of targetThemes) {
    if (!prevThemes.has(t)) {
      prevThemes.add(t);
      newlyUnlockedThemes.push(t);
    }
  }

  const bestStreak = Math.max(row.streak_best, params.maxStreak);
  const now = new Date().toISOString();

  db.prepare(
    `UPDATE players
     SET xp = ?, level = ?, title = ?, streak_best = ?, games_played = games_played + 1,
         unlocked_themes = ?, achievements = ?, updated_at = ?
     WHERE id = ?`
  ).run(
    totalXp,
    levelInfo.level,
    levelInfo.title,
    bestStreak,
    JSON.stringify([...prevThemes]),
    JSON.stringify([...currentAchievements]),
    now,
    params.playerId
  );

  const updated = db
    .prepare('SELECT * FROM players WHERE id = ?')
    .get(params.playerId) as unknown as PlayerRow;

  return {
    player: rowToPlayer(updated),
    leveledUp,
    unlockedAchievements,
    newlyUnlockedThemes,
  };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  // Ensure all /api/* endpoints explicitly permit POST, GET, PUT, PATCH, DELETE & OPTIONS preflight
  app.use('/api', (req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-CGQUIZ-DEV');
    res.setHeader('Allow', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });

  // Health & public arcade overview stats
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'cg-quiz-arcade', timestamp: new Date().toISOString() });
  });

  app.get('/api/stats', (_req, res) => {
    const playersCount = (
      db.prepare('SELECT COUNT(*) as c FROM players WHERE is_test = 0').get() as { c: number }
    ).c;
    const runsCount = (
      db.prepare('SELECT COUNT(*) as c FROM submissions WHERE is_test = 0').get() as { c: number }
    ).c;
    res.json({
      categories: ENGINEERING_CATEGORIES.length,
      questions: QUESTION_BANK.length,
      players: playersCount,
      runsCleared: runsCount,
    });
  });

  // Player registration & legacy cgquiz_participant migration (never overwrites existing players!)
  app.post('/api/players/register', (req, res) => {
    try {
      const rawName = String(req.body?.name ?? '').trim();
      const className = String(req.body?.className ?? '').trim() as ClassOption;
      const existingId = req.body?.existingId ? String(req.body.existingId).trim() : null;
      const isTest = req.body?.isTest === true ? 1 : 0;

      if (rawName.length < 2 || rawName.length > 40) {
        res.status(400).json({ error: 'Player name must be between 2 and 40 characters.' });
        return;
      }
      if (!CLASS_OPTIONS.includes(className)) {
        res.status(400).json({ error: 'Please select a valid class.' });
        return;
      }

      const nameLower = rawName.toLowerCase();
      const existingByName = db
        .prepare('SELECT * FROM players WHERE name_lower = ?')
        .get(nameLower) as unknown as PlayerRow | undefined;

      if (existingByName) {
        // Preserve existing record when migrating with matching ID
        if (existingId && existingByName.id === existingId) {
          res.json({ player: rowToPlayer(existingByName), migrated: true });
          return;
        }
        // Allow returning player to sign back into their existing profile when class matches
        if (existingByName.class_name === className) {
          res.json({ player: rowToPlayer(existingByName), signedInExisting: true });
          return;
        }
        res.status(409).json({
          error:
            'That handle is already registered in a different class. Choose a unique handle or select its matching class to sign back in.',
        });
        return;
      }

      // Also check if existingId already exists under another name -> never overwrite
      if (existingId) {
        const existingById = db
          .prepare('SELECT * FROM players WHERE id = ?')
          .get(existingId) as unknown as PlayerRow | undefined;
        if (existingById) {
          res.json({ player: rowToPlayer(existingById), migrated: true });
          return;
        }
      }

      const newId = existingId || `p_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
      const now = new Date().toISOString();

      db.prepare(
        `INSERT INTO players (
          id, name, name_lower, class_name, xp, level, title, streak_best, games_played,
          active_theme, unlocked_themes, achievements, is_test, created_at, updated_at
        ) VALUES (?, ?, ?, ?, 0, 1, 'Circuit Rookie', 0, 0, 'cyber-midnight', '["cyber-midnight"]', '[]', ?, ?, ?)`
      ).run(newId, rawName, nameLower, className, isTest, now, now);

      const created = db
        .prepare('SELECT * FROM players WHERE id = ?')
        .get(newId) as unknown as PlayerRow;
      res.status(201).json({ player: rowToPlayer(created), migrated: false });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Registration error';
      logServerError('/api/players/register', msg);
      res.status(500).json({ error: 'Unable to complete registration.' });
    }
  });

  app.get('/api/players/:id', (req, res) => {
    try {
      const row = db
        .prepare('SELECT * FROM players WHERE id = ?')
        .get(req.params.id) as unknown as PlayerRow | undefined;
      if (!row) {
        res.status(404).json({ error: 'Player not found.' });
        return;
      }

      const history = db
        .prepare(
          `SELECT id, session_id, player_id, mode, game_type, category_id, difficulty,
                  score, correct_count, total_questions, accuracy, time_spent_seconds,
                  max_streak, xp_earned, created_at
           FROM submissions
           WHERE player_id = ?
           ORDER BY created_at DESC
           LIMIT 25`
        )
        .all(req.params.id) as Array<{
        id: string;
        session_id: string;
        player_id: string;
        mode: QuizMode;
        game_type: GameModeId;
        category_id: string | null;
        difficulty: string;
        score: number;
        correct_count: number;
        total_questions: number;
        accuracy: number;
        time_spent_seconds: number;
        max_streak: number;
        xp_earned: number;
        created_at: string;
      }>;

      const today = todayUtc();
      const dailyRow = db
        .prepare('SELECT 1 FROM daily_completions WHERE player_id = ? AND challenge_date = ?')
        .get(req.params.id, today);

      res.json({
        player: rowToPlayer(row),
        dailyChallenge: getDailyChallengeForDate(today, Boolean(dailyRow)),
        history: history.map((h) => ({
          id: h.id,
          sessionId: h.session_id,
          playerId: h.player_id,
          playerName: row.name,
          className: row.class_name,
          mode: h.mode,
          gameType: h.game_type,
          categoryId: h.category_id,
          difficulty: h.difficulty as Difficulty | 'MIXED',
          score: h.score,
          correctCount: h.correct_count,
          totalQuestions: h.total_questions,
          accuracy: h.accuracy,
          timeSpentSeconds: h.time_spent_seconds,
          maxStreak: h.max_streak,
          xpEarned: h.xp_earned,
          createdAt: h.created_at,
        })),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Player lookup failed';
      logServerError('/api/players/:id', msg);
      res.status(500).json({ error: 'Failed to load player profile.' });
    }
  });

  app.post('/api/players/:id/theme', (req, res) => {
    try {
      const themeId = String(req.body?.themeId ?? '') as PixelThemeId;
      const row = db
        .prepare('SELECT * FROM players WHERE id = ?')
        .get(req.params.id) as unknown as PlayerRow | undefined;
      if (!row) {
        res.status(404).json({ error: 'Player not found.' });
        return;
      }
      const unlocked = JSON.parse(row.unlocked_themes) as PixelThemeId[];
      if (!unlocked.includes(themeId)) {
        res.status(403).json({ error: 'Theme is still locked. Level up to unlock it!' });
        return;
      }
      db.prepare('UPDATE players SET active_theme = ?, updated_at = ? WHERE id = ?').run(
        themeId,
        new Date().toISOString(),
        row.id
      );
      const updated = db
        .prepare('SELECT * FROM players WHERE id = ?')
        .get(row.id) as unknown as PlayerRow;
      res.json({ player: rowToPlayer(updated) });
    } catch (err) {
      logServerError('/api/players/:id/theme', String(err));
      res.status(500).json({ error: 'Failed to equip theme.' });
    }
  });

  app.post('/api/players/:id/achievement', (req, res) => {
    try {
      const achievementId = String(req.body?.achievementId ?? '');
      if (!ACHIEVEMENT_MAP.has(achievementId)) {
        res.status(400).json({ error: 'Unknown achievement.' });
        return;
      }
      const row = db
        .prepare('SELECT * FROM players WHERE id = ?')
        .get(req.params.id) as unknown as PlayerRow | undefined;
      if (!row) {
        res.status(404).json({ error: 'Player not found.' });
        return;
      }
      const current = new Set<string>(JSON.parse(row.achievements));
      if (current.has(achievementId)) {
        res.json({ player: rowToPlayer(row), newlyUnlocked: false });
        return;
      }
      current.add(achievementId);
      const bonus = ACHIEVEMENT_MAP.get(achievementId)!.xpBonus;
      const newXp = row.xp + bonus;
      const levelInfo = computeLevelFromXp(newXp);
      const themes = new Set<PixelThemeId>(JSON.parse(row.unlocked_themes));
      for (const t of getUnlockedThemesForLevel(levelInfo.level)) themes.add(t);

      db.prepare(
        `UPDATE players SET xp = ?, level = ?, title = ?, unlocked_themes = ?, achievements = ?, updated_at = ? WHERE id = ?`
      ).run(
        newXp,
        levelInfo.level,
        levelInfo.title,
        JSON.stringify([...themes]),
        JSON.stringify([...current]),
        new Date().toISOString(),
        row.id
      );
      const updated = db
        .prepare('SELECT * FROM players WHERE id = ?')
        .get(row.id) as unknown as PlayerRow;
      res.json({ player: rowToPlayer(updated), newlyUnlocked: true, xpBonus: bonus });
    } catch (err) {
      logServerError('/api/players/:id/achievement', String(err));
      res.status(500).json({ error: 'Failed to unlock achievement.' });
    }
  });

  app.get('/api/daily-challenge', (req, res) => {
    const playerId = req.query.playerId ? String(req.query.playerId) : null;
    const today = todayUtc();
    let completed = false;
    if (playerId) {
      const row = db
        .prepare('SELECT 1 FROM daily_completions WHERE player_id = ? AND challenge_date = ?')
        .get(playerId, today);
      completed = Boolean(row);
    }
    res.json({ dailyChallenge: getDailyChallengeForDate(today, completed) });
  });

  // Start IQ Quiz or Boss Battle session (server issues randomized questions without answer keys)
  app.post('/api/quiz/start', (req, res) => {
    try {
      const mode = (req.body?.mode === 'competitive' ? 'competitive' : 'practice') as QuizMode;
      const gameType = (req.body?.gameType || 'iq-quiz') as GameModeId;
      const categoryId = req.body?.categoryId ? String(req.body.categoryId) : 'all';
      const difficulty = req.body?.difficulty ? String(req.body.difficulty) : 'MIXED';
      const playerId = req.body?.playerId ? String(req.body.playerId) : null;
      const isTest = req.body?.isTest === true ? 1 : 0;

      if (mode === 'competitive' && !playerId) {
        res.status(401).json({ error: 'Register your player name and class to enter Competitive mode.' });
        return;
      }

      if (playerId) {
        const exists = db.prepare('SELECT 1 FROM players WHERE id = ?').get(playerId);
        if (!exists) {
          res.status(404).json({ error: 'Player registration not found.' });
          return;
        }
      }

      let pool = QUESTION_BANK;
      if (categoryId !== 'all' && mode !== 'competitive') {
        const filtered = pool.filter((q) => q.categoryId === categoryId);
        if (filtered.length > 0) pool = filtered;
      }
      if (difficulty !== 'MIXED' && mode !== 'competitive') {
        const byDiff = pool.filter((q) => q.difficulty === difficulty);
        if (byDiff.length >= 4) pool = byDiff;
      }

      const targetCount = gameType === 'boss-battle' ? 8 : mode === 'competitive' ? 10 : 8;
      let selected = shuffle(pool).slice(0, Math.min(targetCount, pool.length));
      if (selected.length < targetCount) {
        const usedIds = new Set(selected.map((q) => q.id));
        const extra = shuffle(QUESTION_BANK.filter((q) => !usedIds.has(q.id))).slice(
          0,
          targetCount - selected.length
        );
        selected = [...selected, ...extra];
      }

      // Order progressively for Boss Battle or Competitive
      if (gameType === 'boss-battle' || mode === 'competitive') {
        const rank: Record<Difficulty, number> = { EASY: 1, NORMAL: 2, HARD: 3, EXPERT: 4 };
        selected.sort((a, b) => rank[a.difficulty] - rank[b.difficulty]);
      }

      const sessionId = `qs_${Date.now()}_${crypto.randomBytes(5).toString('hex')}`;
      const startedAt = Date.now();
      const expiresAt = startedAt + 30 * 60 * 1000;

      db.prepare(
        `INSERT INTO quiz_sessions (session_id, player_id, mode, game_type, category_id, difficulty, question_ids, started_at, expires_at, status, is_test)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)`
      ).run(
        sessionId,
        playerId,
        mode,
        gameType,
        categoryId,
        difficulty,
        JSON.stringify(selected.map((q) => q.id)),
        startedAt,
        expiresAt,
        isTest
      );

      res.json({
        sessionId,
        mode,
        gameType,
        startedAt,
        timeLimitSeconds: mode === 'competitive' ? 150 : gameType === 'boss-battle' ? 180 : 240,
        questions: selected.map(({ id, categoryId: cId, difficulty: diff, question, options }) => ({
          id,
          categoryId: cId,
          difficulty: diff,
          question,
          options,
        })),
      });
    } catch (err) {
      logServerError('/api/quiz/start', String(err));
      res.status(500).json({ error: 'Unable to start quiz session.' });
    }
  });

  // Instant server-side single-question verification (so answer keys stay on server during play!)
  app.post('/api/quiz/check', (req, res) => {
    try {
      const sessionId = String(req.body?.sessionId ?? '');
      const questionId = String(req.body?.questionId ?? '');
      const selectedIndex = Number(req.body?.selectedIndex);

      const session = db
        .prepare('SELECT * FROM quiz_sessions WHERE session_id = ?')
        .get(sessionId) as
        | { session_id: string; question_ids: string; status: string }
        | undefined;
      if (!session || session.status !== 'active') {
        res.status(400).json({ error: 'Invalid or closed session.' });
        return;
      }

      const allowedIds = JSON.parse(session.question_ids) as string[];
      if (!allowedIds.includes(questionId)) {
        res.status(400).json({ error: 'Question does not belong to this session.' });
        return;
      }

      const q = QUESTION_MAP.get(questionId);
      if (!q) {
        res.status(404).json({ error: 'Question not found.' });
        return;
      }

      res.json({
        correct: selectedIndex === q.correctIndex,
        correctIndex: q.correctIndex,
        explanation: q.explanation,
        reference: q.reference,
      });
    } catch (err) {
      logServerError('/api/quiz/check', String(err));
      res.status(500).json({ error: 'Verification error.' });
    }
  });

  // Authoritative server-side quiz / boss battle scoring & submission
  app.post('/api/quiz/submit', (req, res) => {
    try {
      const sessionId = String(req.body?.sessionId ?? '');
      const playerId = req.body?.playerId ? String(req.body.playerId) : null;
      const submittedAnswers = Array.isArray(req.body?.answers)
        ? (req.body.answers as Array<{ questionId: string; selectedIndex: number; timeMs?: number }>)
        : [];
      const bossWon = Boolean(req.body?.bossWon);

      if (!playerId) {
        res.status(401).json({ error: 'Authentication required to submit a quiz score.' });
        return;
      }

      const registeredPlayer = db
        .prepare('SELECT id FROM players WHERE id = ?')
        .get(playerId);
      if (!registeredPlayer) {
        res.status(401).json({ error: 'Registered player account required to submit scores.' });
        return;
      }

      const session = db
        .prepare('SELECT * FROM quiz_sessions WHERE session_id = ?')
        .get(sessionId) as
        | {
            session_id: string;
            player_id: string | null;
            mode: QuizMode;
            game_type: GameModeId;
            category_id: string | null;
            difficulty: string;
            question_ids: string;
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
      if (session.player_id && session.player_id !== playerId) {
        res.status(403).json({ error: 'Forbidden: session belongs to a different player.' });
        return;
      }
      if (session.status !== 'active') {
        res.status(409).json({ error: 'Duplicate submission blocked: this session was already scored.' });
        return;
      }
      if (Date.now() > session.expires_at) {
        res.status(400).json({ error: 'Quiz session expired.' });
        return;
      }

      const expectedIds = JSON.parse(session.question_ids) as string[];
      const answerByQ = new Map(submittedAnswers.map((a) => [a.questionId, a]));

      const diffMult: Record<Difficulty, number> = {
        EASY: 1.0,
        NORMAL: 1.25,
        HARD: 1.5,
        EXPERT: 2.0,
      };

      let correctCount = 0;
      let streak = 0;
      let maxStreak = 0;
      let fastCount = 0;
      let rawScore = 0;
      const details: AnswerDetail[] = [];

      for (const qId of expectedIds) {
        const q = QUESTION_MAP.get(qId);
        if (!q) continue;
        const ans = answerByQ.get(qId);
        const sel = ans ? Number(ans.selectedIndex) : -1;
        const timeMs = Math.max(200, Math.min(60000, Number(ans?.timeMs ?? 8000)));
        const correct = sel === q.correctIndex;

        if (correct) {
          correctCount += 1;
          streak += 1;
          maxStreak = Math.max(maxStreak, streak);
          if (timeMs <= 4500) fastCount += 1;
          const speedBonus = Math.max(0, Math.round((12000 - timeMs) / 400));
          const comboMult = Math.min(2.0, 1 + (streak - 1) * 0.15);
          rawScore += Math.round((100 * diffMult[q.difficulty] + speedBonus) * comboMult);
        } else {
          streak = 0;
        }

        details.push({
          questionId: q.id,
          question: q.question,
          options: q.options,
          selectedIndex: sel,
          correctIndex: q.correctIndex,
          correct,
          explanation: q.explanation,
          reference: q.reference,
          timeMs,
        });
      }

      if (session.game_type === 'boss-battle' && bossWon && correctCount >= 4) {
        rawScore += 250;
      }

      const totalQuestions = expectedIds.length || 1;
      const accuracy = Math.round((correctCount / totalQuestions) * 1000) / 10;
      const elapsedSeconds = Math.max(1, Math.round((Date.now() - session.started_at) / 1000));
      const xpEarned =
        Math.round(rawScore * (session.mode === 'competitive' ? 0.35 : 0.25)) +
        (accuracy === 100 ? 60 : 0);

      // Mark session submitted immediately to enforce anti-duplicate protection
      db.prepare("UPDATE quiz_sessions SET status = 'submitted' WHERE session_id = ?").run(sessionId);

      const effectivePlayerId = session.player_id || playerId;
      let playerResult: PlayerProfile | null = null;
      let leveledUp = false;
      let unlockedAchievements: string[] = [];
      let dailyCompletedNow = false;

      if (effectivePlayerId) {
        const playerExists = db
          .prepare('SELECT * FROM players WHERE id = ?')
          .get(effectivePlayerId) as unknown as PlayerRow | undefined;

        if (playerExists) {
          const submissionId = `sub_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
          db.prepare(
            `INSERT INTO submissions (
              id, session_id, player_id, mode, game_type, category_id, difficulty,
              score, correct_count, total_questions, accuracy, time_spent_seconds,
              max_streak, xp_earned, answers_detail, is_test, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).run(
            submissionId,
            sessionId,
            effectivePlayerId,
            session.mode,
            session.game_type,
            session.category_id,
            session.difficulty,
            rawScore,
            correctCount,
            totalQuestions,
            accuracy,
            elapsedSeconds,
            maxStreak,
            xpEarned,
            JSON.stringify(details),
            session.is_test,
            new Date().toISOString()
          );

          const earnedAchs: string[] = ['first_run'];
          if (maxStreak >= 5) earnedAchs.push('streak_master');
          if (accuracy === 100 && totalQuestions >= 5) earnedAchs.push('perfect_run');
          if (session.mode === 'competitive') earnedAchs.push('competitor');
          if (session.game_type === 'boss-battle' && bossWon && correctCount >= 4) {
            earnedAchs.push('boss_slayer');
          }

          let bonusDailyXp = 0;
          const today = todayUtc();
          const daily = getDailyChallengeForDate(today);
          if (daily.gameType === session.game_type && rawScore >= daily.targetScore) {
            const alreadyDone = db
              .prepare('SELECT 1 FROM daily_completions WHERE player_id = ? AND challenge_date = ?')
              .get(effectivePlayerId, today);
            if (!alreadyDone) {
              db.prepare(
                'INSERT INTO daily_completions (player_id, challenge_date, score, completed_at) VALUES (?, ?, ?, ?)'
              ).run(effectivePlayerId, today, rawScore, new Date().toISOString());
              bonusDailyXp = daily.xpReward;
              dailyCompletedNow = true;
            }
          }

          const prog = updatePlayerProgression({
            playerId: effectivePlayerId,
            xpEarned: xpEarned + bonusDailyXp,
            maxStreak,
            newAchievements: earnedAchs,
          });
          playerResult = prog.player;
          leveledUp = prog.leveledUp;
          unlockedAchievements = prog.unlockedAchievements;
        }
      }

      res.json({
        sessionId,
        mode: session.mode,
        gameType: session.game_type,
        score: rawScore,
        correctCount,
        totalQuestions,
        accuracy,
        timeSpentSeconds: elapsedSeconds,
        maxStreak,
        fastCount,
        xpEarned,
        leveledUp,
        unlockedAchievements,
        dailyCompletedNow,
        details,
        player: playerResult,
      });
    } catch (err) {
      logServerError('/api/quiz/submit', String(err));
      res.status(500).json({ error: 'Failed to validate and record quiz submission.' });
    }
  });

  // Mini-game session start & server-validated submission (Circuit Rush, Code Breaker, Logic Lab, Component Match)
  app.post('/api/minigame/start', (req, res) => {
    try {
      const gameType = String(req.body?.gameType ?? '') as GameModeId;
      const playerId = req.body?.playerId ? String(req.body.playerId) : null;
      const isTest = req.body?.isTest === true ? 1 : 0;

      if (!['circuit-rush', 'code-breaker', 'logic-lab', 'component-match'].includes(gameType)) {
        res.status(400).json({ error: 'Unsupported mini-game type.' });
        return;
      }

      const sessionId = `mg_${Date.now()}_${crypto.randomBytes(5).toString('hex')}`;
      const startedAt = Date.now();
      const expiresAt = startedAt + 30 * 60 * 1000;

      let payloadIds: string[] = [];
      let clientData: unknown = null;

      if (gameType === 'code-breaker') {
        const picked = shuffle(CODE_PUZZLES).slice(0, 6);
        payloadIds = picked.map((p) => p.id);
        clientData = picked.map(({ id, language, kind, title, prompt, code, options }) => ({
          id,
          language,
          kind,
          title,
          prompt,
          code,
          options,
        }));
      } else if (gameType === 'logic-lab') {
        const picked = shuffle(LOGIC_PUZZLES).slice(0, 6);
        payloadIds = picked.map((p) => p.id);
        clientData = picked.map(
          ({ id, topic, title, prompt, diagramLines, gateChallenge, options }) => ({
            id,
            topic,
            title,
            prompt,
            diagramLines,
            gateChallenge,
            options,
          })
        );
      } else if (gameType === 'circuit-rush') {
        payloadIds = CIRCUIT_STAGES.map((s) => s.id);
        clientData = CIRCUIT_STAGES;
      } else if (gameType === 'component-match') {
        payloadIds = COMPONENT_CARDS.map((c) => c.id);
        clientData = COMPONENT_CARDS;
      }

      db.prepare(
        `INSERT INTO quiz_sessions (session_id, player_id, mode, game_type, category_id, difficulty, question_ids, started_at, expires_at, status, is_test)
         VALUES (?, ?, 'practice', ?, NULL, 'MIXED', ?, ?, ?, 'active', ?)`
      ).run(sessionId, playerId, gameType, JSON.stringify(payloadIds), startedAt, expiresAt, isTest);

      res.json({
        sessionId,
        gameType,
        startedAt,
        items: clientData,
      });
    } catch (err) {
      logServerError('/api/minigame/start', String(err));
      res.status(500).json({ error: 'Could not start mini-game session.' });
    }
  });

  app.post('/api/minigame/check', (req, res) => {
    try {
      const sessionId = String(req.body?.sessionId ?? '');
      const itemId = String(req.body?.itemId ?? '');
      const selectedIndex = Number(req.body?.selectedIndex);

      const session = db
        .prepare('SELECT * FROM quiz_sessions WHERE session_id = ?')
        .get(sessionId) as
        | { session_id: string; game_type: GameModeId; question_ids: string; status: string }
        | undefined;
      if (!session || session.status !== 'active') {
        res.status(400).json({ error: 'Invalid or closed mini-game session.' });
        return;
      }

      const allowed = JSON.parse(session.question_ids) as string[];
      if (!allowed.includes(itemId)) {
        res.status(400).json({ error: 'Puzzle does not belong to this session.' });
        return;
      }

      const item =
        session.game_type === 'code-breaker'
          ? CODE_PUZZLE_MAP.get(itemId)
          : LOGIC_PUZZLE_MAP.get(itemId);
      if (!item) {
        res.status(404).json({ error: 'Puzzle not found.' });
        return;
      }

      res.json({
        correct: selectedIndex === item.correctIndex,
        correctIndex: item.correctIndex,
        explanation: item.explanation,
      });
    } catch (err) {
      logServerError('/api/minigame/check', String(err));
      res.status(500).json({ error: 'Mini-game check failed.' });
    }
  });

  app.post('/api/minigame/submit', (req, res) => {
    try {
      const sessionId = String(req.body?.sessionId ?? '');
      const playerId = req.body?.playerId ? String(req.body.playerId) : null;
      const mode = (req.body?.mode === 'competitive' ? 'competitive' : 'practice') as QuizMode;

      const session = db
        .prepare('SELECT * FROM quiz_sessions WHERE session_id = ?')
        .get(sessionId) as
        | {
            session_id: string;
            player_id: string | null;
            game_type: GameModeId;
            question_ids: string;
            started_at: number;
            expires_at: number;
            status: string;
            is_test: number;
          }
        | undefined;

      if (!session) {
        res.status(404).json({ error: 'Mini-game session not found.' });
        return;
      }
      if (session.status !== 'active') {
        res.status(409).json({ error: 'Duplicate submission blocked.' });
        return;
      }

      const elapsedSeconds = Math.max(2, Math.round((Date.now() - session.started_at) / 1000));
      let score = 0;
      let correctCount = 0;
      let totalQuestions = 0;
      let maxStreak = 0;
      const details: Array<{ id: string; title: string; correct: boolean; explanation: string }> = [];
      const extraAchs: string[] = ['first_run'];

      if (session.game_type === 'code-breaker' || session.game_type === 'logic-lab') {
        const answers = Array.isArray(req.body?.answers)
          ? (req.body.answers as Array<{ id: string; selectedIndex: number }>)
          : [];
        const answerMap = new Map(answers.map((a) => [a.id, a.selectedIndex]));
        const expectedIds = JSON.parse(session.question_ids) as string[];
        totalQuestions = expectedIds.length;
        let streak = 0;

        for (const id of expectedIds) {
          const item =
            session.game_type === 'code-breaker'
              ? CODE_PUZZLE_MAP.get(id)
              : LOGIC_PUZZLE_MAP.get(id);
          if (!item) continue;
          const isCorrect = answerMap.get(id) === item.correctIndex;
          if (isCorrect) {
            correctCount += 1;
            streak += 1;
            maxStreak = Math.max(maxStreak, streak);
            score += 130 + (streak - 1) * 25;
          } else {
            streak = 0;
          }
          details.push({
            id: item.id,
            title: item.title,
            correct: isCorrect,
            explanation: item.explanation,
          });
        }
        if (correctCount >= 4) {
          score += Math.max(0, Math.round((120 - Math.min(120, elapsedSeconds)) * 1.5));
        }
        if (session.game_type === 'code-breaker' && correctCount >= 5) {
          extraAchs.push('code_ninja');
        }
      } else if (session.game_type === 'circuit-rush') {
        const stagesCleared = Math.max(
          0,
          Math.min(CIRCUIT_STAGES.length, Number(req.body?.stagesCleared ?? 0))
        );
        const totalMoves = Math.max(1, Number(req.body?.moves ?? 20));
        totalQuestions = CIRCUIT_STAGES.length;
        correctCount = stagesCleared;
        maxStreak = stagesCleared;
        const speedBonus = stagesCleared > 0 ? Math.max(0, 220 - Math.min(200, elapsedSeconds * 2)) : 0;
        const efficiencyBonus = stagesCleared > 0 ? Math.max(0, 120 - totalMoves * 2) : 0;
        score = stagesCleared * 180 + speedBonus + efficiencyBonus;
        if (stagesCleared >= 4) extraAchs.push('circuit_architect');
      } else if (session.game_type === 'component-match') {
        const pairsMatched = Math.max(
          0,
          Math.min(COMPONENT_CARDS.length, Number(req.body?.pairsMatched ?? 0))
        );
        const mistakes = Math.max(0, Number(req.body?.mistakes ?? 0));
        totalQuestions = COMPONENT_CARDS.length;
        correctCount = pairsMatched;
        maxStreak = Math.max(1, Number(req.body?.bestStreak ?? 1));
        const timeBonus =
          pairsMatched === COMPONENT_CARDS.length
            ? Math.max(0, 250 - Math.min(240, elapsedSeconds * 2))
            : 0;
        score = Math.max(0, pairsMatched * 90 + maxStreak * 20 - mistakes * 10 + timeBonus);
      }

      const accuracy =
        totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 1000) / 10 : 0;
      const xpEarned = Math.round(score * 0.28) + (accuracy === 100 ? 50 : 0);

      if (maxStreak >= 5) extraAchs.push('streak_master');
      if (accuracy === 100 && totalQuestions >= 4) extraAchs.push('perfect_run');

      db.prepare("UPDATE quiz_sessions SET status = 'submitted' WHERE session_id = ?").run(sessionId);

      const effectivePlayerId = session.player_id || playerId;
      let playerResult: PlayerProfile | null = null;
      let leveledUp = false;
      let unlockedAchievements: string[] = [];
      let dailyCompletedNow = false;

      if (effectivePlayerId) {
        const playerExists = db
          .prepare('SELECT * FROM players WHERE id = ?')
          .get(effectivePlayerId) as unknown as PlayerRow | undefined;

        if (playerExists) {
          db.prepare(
            `INSERT INTO submissions (
              id, session_id, player_id, mode, game_type, category_id, difficulty,
              score, correct_count, total_questions, accuracy, time_spent_seconds,
              max_streak, xp_earned, answers_detail, is_test, created_at
            ) VALUES (?, ?, ?, ?, ?, NULL, 'MIXED', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).run(
            `sub_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
            sessionId,
            effectivePlayerId,
            mode,
            session.game_type,
            score,
            correctCount,
            totalQuestions,
            accuracy,
            elapsedSeconds,
            maxStreak,
            xpEarned,
            JSON.stringify(details),
            session.is_test,
            new Date().toISOString()
          );

          let bonusDailyXp = 0;
          const today = todayUtc();
          const daily = getDailyChallengeForDate(today);
          if (daily.gameType === session.game_type && score >= daily.targetScore) {
            const done = db
              .prepare('SELECT 1 FROM daily_completions WHERE player_id = ? AND challenge_date = ?')
              .get(effectivePlayerId, today);
            if (!done) {
              db.prepare(
                'INSERT INTO daily_completions (player_id, challenge_date, score, completed_at) VALUES (?, ?, ?, ?)'
              ).run(effectivePlayerId, today, score, new Date().toISOString());
              bonusDailyXp = daily.xpReward;
              dailyCompletedNow = true;
            }
          }

          const prog = updatePlayerProgression({
            playerId: effectivePlayerId,
            xpEarned: xpEarned + bonusDailyXp,
            maxStreak,
            newAchievements: extraAchs,
          });
          playerResult = prog.player;
          leveledUp = prog.leveledUp;
          unlockedAchievements = prog.unlockedAchievements;
        }
      }

      res.json({
        sessionId,
        gameType: session.game_type,
        score,
        correctCount,
        totalQuestions,
        accuracy,
        timeSpentSeconds: elapsedSeconds,
        maxStreak,
        xpEarned,
        leveledUp,
        unlockedAchievements,
        dailyCompletedNow,
        details,
        player: playerResult,
      });
    } catch (err) {
      logServerError('/api/minigame/submit', String(err));
      res.status(500).json({ error: 'Failed to submit mini-game run.' });
    }
  });

  // Leaderboard (separated by competitive vs practice vs arcade mini-games)
  app.get('/api/leaderboard', (req, res) => {
    try {
      const tab = String(req.query.tab ?? 'competitive');
      const className = String(req.query.className ?? 'all');
      const search = String(req.query.search ?? '').trim().toLowerCase();
      const includeTest =
        req.query.includeTest === '1' && req.headers['x-cgquiz-dev'] === DEV_HEADER_TOKEN;

      const whereClauses: string[] = [];
      const params: Array<string | number> = [];

      if (!includeTest) {
        whereClauses.push('s.is_test = 0 AND p.is_test = 0');
      }
      if (tab === 'competitive') {
        whereClauses.push("s.mode = 'competitive'");
      } else if (tab === 'practice') {
        whereClauses.push("s.mode = 'practice' AND s.game_type = 'iq-quiz'");
      } else if (tab === 'arcade') {
        whereClauses.push("s.game_type != 'iq-quiz'");
      }
      if (className !== 'all') {
        whereClauses.push('p.class_name = ?');
        params.push(className);
      }
      if (search) {
        whereClauses.push('p.name_lower LIKE ?');
        params.push(`%${search}%`);
      }

      const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';

      const rows = db
        .prepare(
          `SELECT
             p.id as player_id,
             p.name as player_name,
             p.class_name as class_name,
             p.title as title,
             p.level as level,
             MAX(s.score) as best_score,
             SUM(s.score) as total_score,
             ROUND(AVG(s.accuracy), 1) as accuracy,
             COUNT(s.id) as games_count,
             MAX(s.max_streak) as best_streak,
             MAX(s.game_type) as game_type
           FROM submissions s
           JOIN players p ON p.id = s.player_id
           ${whereSql}
           GROUP BY p.id
           ORDER BY best_score DESC, total_score DESC
           LIMIT 50`
        )
        .all(...params) as Array<{
        player_id: string;
        player_name: string;
        class_name: string;
        title: string;
        level: number;
        best_score: number;
        total_score: number;
        accuracy: number;
        games_count: number;
        best_streak: number;
        game_type: string;
      }>;

      res.json({
        entries: rows.map((r) => ({
          playerId: r.player_id,
          playerName: r.player_name,
          className: r.class_name,
          title: r.title,
          level: r.level,
          bestScore: r.best_score,
          totalScore: r.total_score,
          accuracy: r.accuracy,
          gamesCount: r.games_count,
          bestStreak: r.best_streak,
          gameType: r.game_type,
        })),
      });
    } catch (err) {
      logServerError('/api/leaderboard', String(err));
      res.status(500).json({ error: 'Failed to load leaderboard.' });
    }
  });

  // Hidden Developer-Only Diagnostics & Safe Test-Data Reset
  app.get('/api/dev/diagnostics', (req, res) => {
    if (req.headers['x-cgquiz-dev'] !== DEV_HEADER_TOKEN) {
      res.status(403).json({ error: 'Developer token required.' });
      return;
    }
    const realPlayers = (
      db.prepare('SELECT COUNT(*) as c FROM players WHERE is_test = 0').get() as { c: number }
    ).c;
    const testPlayers = (
      db.prepare('SELECT COUNT(*) as c FROM players WHERE is_test = 1').get() as { c: number }
    ).c;
    const realSubmissions = (
      db.prepare('SELECT COUNT(*) as c FROM submissions WHERE is_test = 0').get() as { c: number }
    ).c;
    const testSubmissions = (
      db.prepare('SELECT COUNT(*) as c FROM submissions WHERE is_test = 1').get() as { c: number }
    ).c;
    const recentErrors = db
      .prepare('SELECT id, endpoint, message, created_at FROM error_logs ORDER BY id DESC LIMIT 20')
      .all();

    res.json({
      realPlayers,
      testPlayers,
      realSubmissions,
      testSubmissions,
      questionCount: QUESTION_BANK.length,
      categoryCount: ENGINEERING_CATEGORIES.length,
      recentErrors,
    });
  });

  app.get('/api/dev/questions', (req, res) => {
    if (req.headers['x-cgquiz-dev'] !== DEV_HEADER_TOKEN) {
      res.status(403).json({ error: 'Developer token required.' });
      return;
    }
    res.json({ questions: QUESTION_BANK });
  });

  /* ============================================================
     CG QUIZ STUDIO: Creations & Easy Quiz Completion Routes
     ============================================================ */
  app.get('/api/creations', (req, res) => {
    try {
      const userId = String(req.query.userId ?? '').trim();
      const type = String(req.query.type ?? 'all').trim();
      if (!userId) {
        res.json({ creations: [] });
        return;
      }
      const rows = (
        type === 'car' || type === 'phone'
          ? db
              .prepare(
                `SELECT id, user_id, type, title, subtitle, design_rating, estimated_cost, payload_json, preview_data_url, created_at, updated_at
                 FROM creations WHERE user_id = ? AND type = ? AND is_test = 0 ORDER BY updated_at DESC LIMIT 40`
              )
              .all(userId, type)
          : db
              .prepare(
                `SELECT id, user_id, type, title, subtitle, design_rating, estimated_cost, payload_json, preview_data_url, created_at, updated_at
                 FROM creations WHERE user_id = ? AND is_test = 0 ORDER BY updated_at DESC LIMIT 40`
              )
              .all(userId)
      ) as Array<{
        id: string;
        user_id: string;
        type: 'car' | 'phone';
        title: string;
        subtitle: string;
        design_rating: number;
        estimated_cost: number;
        payload_json: string;
        preview_data_url: string | null;
        created_at: string;
        updated_at: string;
      }>;

      res.json({
        creations: rows.map((r) => ({
          id: r.id,
          userId: r.user_id,
          type: r.type,
          title: r.title,
          subtitle: r.subtitle,
          designRating: r.design_rating,
          estimatedCost: r.estimated_cost,
          payload: JSON.parse(r.payload_json) as Record<string, unknown>,
          previewDataUrl: r.preview_data_url,
          createdAt: r.created_at,
          updatedAt: r.updated_at,
        })),
      });
    } catch (err) {
      logServerError('/api/creations', String(err));
      res.status(500).json({ error: 'Unable to load saved creations.' });
    }
  });

  app.post('/api/creations', (req, res) => {
    try {
      const userId = String(req.body?.userId ?? '').trim() || 'guest_studio';
      const type = req.body?.type === 'phone' ? 'phone' : 'car';
      const title = String(req.body?.title ?? (type === 'car' ? 'Custom Machine' : 'Next Smartphone'))
        .trim()
        .slice(0, 60);
      const subtitle = String(req.body?.subtitle ?? '').trim().slice(0, 120);
      const designRating = Math.max(0, Math.min(100, Math.round(Number(req.body?.designRating ?? 80))));
      const estimatedCost = Math.max(0, Math.round(Number(req.body?.estimatedCost ?? 0)));
      const payload = (req.body?.payload && typeof req.body.payload === 'object' ? req.body.payload : {}) as Record<
        string,
        unknown
      >;
      const rawPreview = typeof req.body?.previewDataUrl === 'string' ? req.body.previewDataUrl : null;
      const previewDataUrl = rawPreview && rawPreview.length <= 450000 ? rawPreview : null;
      const isTest = req.body?.isTest === true ? 1 : 0;
      const existingId = req.body?.id ? String(req.body.id).trim() : '';
      const now = new Date().toISOString();

      const existingRow = existingId
        ? (db.prepare('SELECT id, created_at FROM creations WHERE id = ? AND user_id = ?').get(existingId, userId) as
            | { id: string; created_at: string }
            | undefined)
        : undefined;

      const creationId = existingRow?.id || `cr_${type}_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
      const createdAt = existingRow?.created_at || now;

      if (existingRow) {
        db.prepare(
          `UPDATE creations
           SET title = ?, subtitle = ?, design_rating = ?, estimated_cost = ?, payload_json = ?, preview_data_url = COALESCE(?, preview_data_url), updated_at = ?
           WHERE id = ? AND user_id = ?`
        ).run(
          title,
          subtitle,
          designRating,
          estimatedCost,
          JSON.stringify(payload),
          previewDataUrl,
          now,
          creationId,
          userId
        );
      } else {
        db.prepare(
          `INSERT INTO creations (
            id, user_id, type, title, subtitle, design_rating, estimated_cost,
            payload_json, preview_data_url, is_test, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(
          creationId,
          userId,
          type,
          title,
          subtitle,
          designRating,
          estimatedCost,
          JSON.stringify(payload),
          previewDataUrl,
          isTest,
          createdAt,
          now
        );
      }

      let playerResult: PlayerProfile | null = null;
      let leveledUp = false;
      let unlockedAchievements: string[] = [];
      const xpAward = existingRow ? 20 : 50;

      const playerExists = db.prepare('SELECT id FROM players WHERE id = ?').get(userId);
      if (playerExists) {
        const typeRows = db
          .prepare('SELECT DISTINCT type FROM creations WHERE user_id = ? AND is_test = 0')
          .all(userId) as Array<{ type: string }>;
        const typesSet = new Set(typeRows.map((r) => r.type));
        typesSet.add(type);
        const achs = ['first_run', type === 'car' ? 'car_designer' : 'phone_architect'];
        if (typesSet.has('car') && typesSet.has('phone')) {
          achs.push('studio_master');
        }
        const prog = updatePlayerProgression({
          playerId: userId,
          xpEarned: xpAward,
          maxStreak: 0,
          newAchievements: achs,
        });
        playerResult = prog.player;
        leveledUp = prog.leveledUp;
        unlockedAchievements = prog.unlockedAchievements;
      }

      res.status(existingRow ? 200 : 201).json({
        creation: {
          id: creationId,
          userId,
          type,
          title,
          subtitle,
          designRating,
          estimatedCost,
          payload,
          previewDataUrl,
          createdAt,
          updatedAt: now,
        },
        xpEarned: xpAward,
        leveledUp,
        unlockedAchievements,
        player: playerResult,
      });
    } catch (err) {
      logServerError('/api/creations', String(err));
      res.status(500).json({ error: 'Unable to save creation.' });
    }
  });

  app.delete('/api/creations/:id', (req, res) => {
    try {
      const userId = String(req.query.userId ?? '').trim();
      if (!userId) {
        res.status(400).json({ error: 'userId is required.' });
        return;
      }
      const result = db
        .prepare('DELETE FROM creations WHERE id = ? AND user_id = ?')
        .run(req.params.id, userId);
      res.json({ deleted: result.changes > 0 });
    } catch (err) {
      logServerError('/api/creations/:id', String(err));
      res.status(500).json({ error: 'Unable to delete creation.' });
    }
  });

  app.post('/api/studio/easy-complete', (req, res) => {
    try {
      const userId = req.body?.userId ? String(req.body.userId).trim() : null;
      if (!userId) {
        res.status(401).json({ error: 'Authentication required to record quiz score.' });
        return;
      }
      const playerExists = db.prepare('SELECT id FROM players WHERE id = ?').get(userId);
      if (!playerExists) {
        res.status(401).json({ error: 'Registered player account required to record score.' });
        return;
      }
      const categoryId = String(req.body?.categoryId ?? 'general-knowledge');
      const difficulty = String(req.body?.difficulty ?? 'Easy');
      const correctCount = Math.max(0, Number(req.body?.correctCount ?? 0));
      const totalQuestions = Math.max(1, Number(req.body?.totalQuestions ?? 10));
      const maxStreak = Math.max(0, Number(req.body?.maxStreak ?? 0));
      const accuracy = Math.round((correctCount / totalQuestions) * 100);
      const xpEarned = Math.max(15, correctCount * 12 + (accuracy >= 80 ? 25 : 0));

      const achs = ['first_run'];
      if (accuracy >= 80) achs.push('easy_scholar');
      if (maxStreak >= 5) achs.push('streak_master');
      if (accuracy === 100 && totalQuestions >= 5) achs.push('perfect_run');
      const prog = updatePlayerProgression({
        playerId: userId,
        xpEarned,
        maxStreak,
        newAchievements: achs,
      });

      res.json({
        categoryId,
        difficulty,
        correctCount,
        totalQuestions,
        accuracy,
        xpEarned,
        leveledUp: prog.leveledUp,
        unlockedAchievements: prog.unlockedAchievements,
        player: prog.player,
      });
    } catch (err) {
      logServerError('/api/studio/easy-complete', String(err));
      res.status(500).json({ error: 'Unable to record Easy Quiz completion.' });
    }
  });

  app.post('/api/dev/reset-test', (req, res) => {
    if (req.headers['x-cgquiz-dev'] !== DEV_HEADER_TOKEN) {
      res.status(403).json({ error: 'Developer token required.' });
      return;
    }
    const delSubs = db.prepare('DELETE FROM submissions WHERE is_test = 1').run().changes;
    const delSessions = db.prepare('DELETE FROM quiz_sessions WHERE is_test = 1').run().changes;
    const delGameResults = db.prepare('DELETE FROM game_results WHERE is_test = 1').run().changes;
    const delGameSessions = db.prepare('DELETE FROM game_sessions WHERE is_test = 1').run().changes;
    const delPlayers = db.prepare('DELETE FROM players WHERE is_test = 1').run().changes;
    const delExamAttempts = db.prepare('DELETE FROM exam_attempts WHERE is_test = 1').run().changes;
    const delExamSessions = db.prepare('DELETE FROM exam_sessions WHERE is_test = 1').run().changes;
    const delCreations = db.prepare('DELETE FROM creations WHERE is_test = 1').run().changes;
    res.json({
      cleared: {
        testPlayers: delPlayers,
        testSessions: delSessions,
        testSubmissions: delSubs,
        testGameResults: delGameResults,
        testGameSessions: delGameSessions,
        testExamAttempts: delExamAttempts,
        testExamSessions: delExamSessions,
        testCreations: delCreations,
      },
      preservedRealData: true,
    });
  });

  // Mount Smart Quiz Arena (4-Difficulty + Podium + Leaderboard) API Routes
  registerGameRoutes(app, { updatePlayerProgression });

  // Mount v2 Competitive Quiz Platform & Analytics API Routes
  registerExamRoutes(app);

  // Never let unmatched /api/* fall through to Vite HTML fallback
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'API endpoint not found.' });
  });

  // Always return JSON for Express/body-parser errors on API routes
  app.use(
    (
      err: unknown,
      req: express.Request,
      res: express.Response,
      next: express.NextFunction
    ) => {
      if (res.headersSent) {
        next(err);
        return;
      }
      const msg = err instanceof Error ? err.message : 'Unexpected server error.';
      if (req.path.startsWith('/api')) {
        const status =
          typeof (err as { status?: number })?.status === 'number'
            ? (err as { status: number }).status
            : 500;
        logServerError(req.path, msg);
        res.status(status).json({ error: msg });
        return;
      }
      next(err);
    }
  );

  // Vite dev middleware OR static production build
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      const indexFile = path.join(distPath, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Build not found. Run npm run build.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`CG QUIZ Engineering Arcade running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Server boot error:', err);
  process.exit(1);
});

import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const DATA_DIR = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'cgquiz.db');
export const db = new DatabaseSync(DB_PATH);

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS players (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    name_lower TEXT UNIQUE NOT NULL,
    class_name TEXT NOT NULL,
    xp INTEGER NOT NULL DEFAULT 0,
    level INTEGER NOT NULL DEFAULT 1,
    title TEXT NOT NULL DEFAULT 'Circuit Rookie',
    streak_best INTEGER NOT NULL DEFAULT 0,
    games_played INTEGER NOT NULL DEFAULT 0,
    active_theme TEXT NOT NULL DEFAULT 'cyber-midnight',
    unlocked_themes TEXT NOT NULL DEFAULT '["cyber-midnight"]',
    achievements TEXT NOT NULL DEFAULT '[]',
    is_test INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS quiz_sessions (
    session_id TEXT PRIMARY KEY,
    player_id TEXT,
    mode TEXT NOT NULL,
    game_type TEXT NOT NULL,
    category_id TEXT,
    difficulty TEXT,
    question_ids TEXT NOT NULL,
    started_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    is_test INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS submissions (
    id TEXT PRIMARY KEY,
    session_id TEXT UNIQUE NOT NULL,
    player_id TEXT NOT NULL,
    mode TEXT NOT NULL,
    game_type TEXT NOT NULL,
    category_id TEXT,
    difficulty TEXT NOT NULL,
    score INTEGER NOT NULL,
    correct_count INTEGER NOT NULL,
    total_questions INTEGER NOT NULL,
    accuracy REAL NOT NULL,
    time_spent_seconds INTEGER NOT NULL,
    max_streak INTEGER NOT NULL,
    xp_earned INTEGER NOT NULL,
    answers_detail TEXT NOT NULL,
    is_test INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS daily_completions (
    player_id TEXT NOT NULL,
    challenge_date TEXT NOT NULL,
    score INTEGER NOT NULL,
    completed_at TEXT NOT NULL,
    PRIMARY KEY (player_id, challenge_date)
  );

  CREATE TABLE IF NOT EXISTS error_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    endpoint TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  /* ============================================================
     v2 Competitive Quiz Platform Tables (Additive Migration)
     ============================================================ */
  CREATE TABLE IF NOT EXISTS exam_profiles (
    user_id TEXT PRIMARY KEY,
    display_name TEXT,
    daily_streak INTEGER NOT NULL DEFAULT 0,
    best_daily_streak INTEGER NOT NULL DEFAULT 0,
    last_active_date TEXT,
    quiz_streak INTEGER NOT NULL DEFAULT 0,
    perfect_streak INTEGER NOT NULL DEFAULT 0,
    exam_xp INTEGER NOT NULL DEFAULT 0,
    exam_level TEXT NOT NULL DEFAULT 'Beginner',
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS exam_questions (
    id TEXT PRIMARY KEY,
    subject TEXT NOT NULL,
    category_id TEXT NOT NULL,
    chapter TEXT NOT NULL,
    topic TEXT NOT NULL,
    difficulty TEXT NOT NULL,
    question_type TEXT NOT NULL,
    source TEXT NOT NULL,
    year INTEGER,
    verified INTEGER NOT NULL DEFAULT 1,
    payload_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS exam_sessions (
    session_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    mode TEXT NOT NULL,
    settings_json TEXT NOT NULL,
    question_ids_json TEXT NOT NULL,
    adaptive_state_json TEXT NOT NULL,
    started_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    time_limit_seconds INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    is_test INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS exam_attempts (
    id TEXT PRIMARY KEY,
    session_id TEXT UNIQUE NOT NULL,
    user_id TEXT NOT NULL,
    mode TEXT NOT NULL,
    subject TEXT NOT NULL,
    category_id TEXT NOT NULL,
    difficulty TEXT NOT NULL,
    score REAL NOT NULL,
    max_score REAL NOT NULL,
    correct_count INTEGER NOT NULL,
    wrong_count INTEGER NOT NULL,
    skipped_count INTEGER NOT NULL,
    total_questions INTEGER NOT NULL,
    accuracy REAL NOT NULL,
    time_spent_seconds INTEGER NOT NULL,
    avg_time_per_q REAL NOT NULL,
    negative_marking REAL NOT NULL DEFAULT 0,
    xp_earned INTEGER NOT NULL DEFAULT 0,
    details_json TEXT NOT NULL,
    speed_matrix_json TEXT NOT NULL,
    topic_breakdown_json TEXT NOT NULL,
    anti_cheat_json TEXT NOT NULL,
    is_test INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS mistake_book (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    question_id TEXT NOT NULL,
    subject TEXT NOT NULL,
    topic TEXT NOT NULL,
    mistake_category TEXT NOT NULL DEFAULT 'concept',
    notes TEXT NOT NULL DEFAULT '',
    times_missed INTEGER NOT NULL DEFAULT 1,
    resolved INTEGER NOT NULL DEFAULT 0,
    last_missed_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE(user_id, question_id)
  );

  CREATE TABLE IF NOT EXISTS bookmarks (
    user_id TEXT NOT NULL,
    question_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (user_id, question_id)
  );

  CREATE TABLE IF NOT EXISTS daily_exam_completions (
    user_id TEXT NOT NULL,
    challenge_date TEXT NOT NULL,
    attempt_id TEXT NOT NULL,
    score REAL NOT NULL,
    max_score REAL NOT NULL,
    accuracy REAL NOT NULL,
    time_spent_seconds INTEGER NOT NULL,
    weak_area TEXT,
    completed_at TEXT NOT NULL,
    PRIMARY KEY (user_id, challenge_date)
  );

  /* ============================================================
     CG QUIZ STUDIO: User-Created Cars & Smartphones
     ============================================================ */
  CREATE TABLE IF NOT EXISTS creations (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    subtitle TEXT NOT NULL,
    design_rating INTEGER NOT NULL DEFAULT 80,
    estimated_cost INTEGER NOT NULL DEFAULT 0,
    payload_json TEXT NOT NULL,
    preview_data_url TEXT,
    is_test INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  /* ============================================================
     SMART QUIZ ARENA: Unified Game Sessions & Results Leaderboard
     ============================================================ */
  CREATE TABLE IF NOT EXISTS game_sessions (
    session_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    difficulty TEXT NOT NULL,
    category TEXT NOT NULL,
    question_count INTEGER NOT NULL,
    time_limit_seconds INTEGER NOT NULL,
    question_ids_json TEXT NOT NULL,
    session_questions_json TEXT NOT NULL,
    started_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    completed_at INTEGER,
    status TEXT NOT NULL DEFAULT 'active',
    is_test INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS game_results (
    result_id TEXT PRIMARY KEY,
    session_id TEXT UNIQUE NOT NULL,
    user_id TEXT NOT NULL,
    username TEXT NOT NULL,
    score INTEGER NOT NULL,
    correct_answers INTEGER NOT NULL,
    incorrect_answers INTEGER NOT NULL,
    unanswered INTEGER NOT NULL,
    total_questions INTEGER NOT NULL,
    accuracy REAL NOT NULL,
    completion_time INTEGER NOT NULL,
    difficulty TEXT NOT NULL,
    category TEXT NOT NULL,
    xp_earned INTEGER NOT NULL DEFAULT 0,
    details_json TEXT NOT NULL DEFAULT '[]',
    is_test INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );
`);

// Safe index creation for fast query/analytics performance
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_exam_attempts_user_date ON exam_attempts(user_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_mistake_book_user ON mistake_book(user_id, resolved, last_missed_at DESC);
  CREATE INDEX IF NOT EXISTS idx_exam_questions_cat ON exam_questions(category_id, subject, difficulty);
  CREATE INDEX IF NOT EXISTS idx_creations_user ON creations(user_id, updated_at DESC);
  CREATE INDEX IF NOT EXISTS idx_game_sessions_user ON game_sessions(user_id, started_at DESC);
  CREATE INDEX IF NOT EXISTS idx_game_results_user ON game_results(user_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_game_results_score ON game_results(is_test, score DESC, accuracy DESC, completion_time ASC);
`);

// Safe additive column migration for per-session option-shuffled question snapshots
try {
  const cols = db.prepare('PRAGMA table_info(exam_sessions)').all() as Array<{ name: string }>;
  if (!cols.some((c) => c.name === 'session_questions_json')) {
    db.exec('ALTER TABLE exam_sessions ADD COLUMN session_questions_json TEXT');
  }
} catch {
  // ignore if already present
}

export function logServerError(endpoint: string, message: string): void {
  try {
    db.prepare(
      'INSERT INTO error_logs (endpoint, message, created_at) VALUES (?, ?, ?)'
    ).run(endpoint, message.slice(0, 500), new Date().toISOString());
  } catch {
    // ignore logging failure
  }
}


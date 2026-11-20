export type Difficulty = 'EASY' | 'NORMAL' | 'HARD' | 'EXPERT';

export type QuizMode = 'practice' | 'competitive';

export type GameModeId =
  | 'iq-quiz'
  | 'circuit-rush'
  | 'code-breaker'
  | 'boss-battle'
  | 'logic-lab'
  | 'component-match'
  | 'auto-engineer'
  | 'phone-designer';

export type PixelThemeId =
  | 'cyber-midnight'
  | 'emerald-matrix'
  | 'volcanic-forge'
  | 'synthwave-grid';

export type UiThemeMode = 'dark' | 'light';

export type ClassOption =
  | 'Class 9'
  | 'Class 10'
  | 'Class 11'
  | 'Class 12'
  | 'Other';

export const CLASS_OPTIONS: ClassOption[] = [
  'Class 9',
  'Class 10',
  'Class 11',
  'Class 12',
  'Other',
];

export interface CategoryInfo {
  id: string;
  name: string;
  shortName: string;
  color: string;
  intro: string;
  iconName: string;
}

export interface EngineeringQuestion {
  id: string;
  categoryId: string;
  difficulty: Difficulty;
  question: string;
  options: [string, string, string, string];
  correctIndex: 0 | 1 | 2 | 3;
  explanation: string;
  reference: string;
}

export interface PublicQuestion {
  id: string;
  categoryId: string;
  difficulty: Difficulty;
  question: string;
  options: [string, string, string, string];
}

export interface PlayerProfile {
  id: string;
  name: string;
  className: ClassOption;
  xp: number;
  level: number;
  title: string;
  streakBest: number;
  gamesPlayed: number;
  activeTheme: PixelThemeId;
  unlockedThemes: PixelThemeId[];
  achievements: string[];
  createdAt: string;
}

export interface AnswerDetail {
  questionId: string;
  question: string;
  options: string[];
  selectedIndex: number;
  correctIndex: number;
  correct: boolean;
  explanation: string;
  reference: string;
  timeMs: number;
}

export interface SubmissionRecord {
  id: string;
  sessionId: string;
  playerId: string;
  playerName: string;
  className: string;
  mode: QuizMode;
  gameType: GameModeId;
  categoryId: string | null;
  difficulty: Difficulty | 'MIXED';
  score: number;
  correctCount: number;
  totalQuestions: number;
  accuracy: number;
  timeSpentSeconds: number;
  maxStreak: number;
  xpEarned: number;
  createdAt: string;
}

export interface LeaderboardEntry {
  playerId: string;
  playerName: string;
  className: string;
  title: string;
  level: number;
  bestScore: number;
  totalScore: number;
  accuracy: number;
  gamesCount: number;
  bestStreak: number;
  gameType: string;
}

export interface DailyChallengeInfo {
  date: string;
  title: string;
  description: string;
  gameType: GameModeId;
  categoryId: string;
  targetScore: number;
  xpReward: number;
  completed: boolean;
}

/* ============================================================
   CGQUIZ COMPETITIVE EXAM & ANALYTICS UPGRADE TYPES (v2)
   ============================================================ */

export type ExamDifficulty = 'Easy' | 'Medium' | 'Hard' | 'Expert';

export type ExamMode =
  | 'quick'
  | 'standard'
  | 'challenge'
  | 'career_fair'
  | 'jee'
  | 'mixed'
  | 'adaptive'
  | 'practice'
  | 'timed'
  | 'mock'
  | 'rapid'
  | 'weak'
  | 'daily'
  | 'survival'
  | 'revision';

export type QuestionType =
  | 'single'
  | 'multiple'
  | 'truefalse'
  | 'integer'
  | 'assertion_reason'
  | 'match'
  | 'image'
  | 'scenario'
  | 'comparison'
  | 'career_path';

export type MistakeCategory =
  | 'concept'
  | 'calculation'
  | 'formula'
  | 'careless'
  | 'time-pressure'
  | 'guessing';

export type SpeedClass =
  | 'FAST+CORRECT'
  | 'SLOW+CORRECT'
  | 'FAST+WRONG'
  | 'SLOW+WRONG'
  | 'SKIPPED';

export type ExamLevelTitle =
  | 'Beginner'
  | 'Learner'
  | 'Explorer'
  | 'Advanced'
  | 'Expert'
  | 'Master';

export interface ExamCategoryInfo {
  id: string;
  name: string;
  shortName: string;
  group: 'Branches' | 'JEE & Admissions' | 'Careers & Pathways' | 'Core Subjects' | 'General & Tech';
  description: string;
  accentColor: string;
  difficultyLabel?: string;
}

export interface SmartExplanation {
  why: string;
  concept: string;
  shortcut: string;
  commonTrap: string;
}

export interface MatchPairData {
  left: string[];
  right: string[];
}

export interface ExamQuestion {
  id: string;
  question: string;
  assertion?: string;
  reason?: string;
  matchPairs?: MatchPairData;
  imageSvg?: string;
  imageCaption?: string;
  options: string[];
  /**
   * Canonical server-side answer representation:
   * - single / scenario / comparison / career_path / assertion_reason / image / truefalse: number (option index)
   * - multiple: number[] (sorted option indices)
   * - integer: number | string (exact numeric match)
   * - match: number[] (right-index assigned to each left row)
   */
  answer: number | number[] | string;
  explanation: SmartExplanation;
  subject: string;
  categoryId: string;
  chapter: string;
  topic: string;
  concept?: string;
  difficulty: ExamDifficulty;
  questionType: QuestionType;
  source: string;
  sourceUrl?: string | null;
  lastUpdated?: string | null;
  year: number | null;
  tags: string[];
  verified: boolean;
}

export type PublicExamQuestion = Omit<ExamQuestion, 'answer' | 'explanation'>;

export type ExamUserAnswer = number | number[] | string | null;

export interface ExamSettings {
  mode: ExamMode;
  categoryId: string;
  subject: string;
  chapter: string;
  difficulty: ExamDifficulty | 'Adaptive' | 'Mixed';
  questionType: QuestionType | 'All';
  questionCount: number;
  timeLimitMinutes: number;
  negativeMarking: number;
  smartBoardMode?: boolean;
  adaptiveEnabled?: boolean;
  excludeQuestionIds?: string[];
}

export interface ExamAnswerItem {
  questionId: string;
  userAnswer: ExamUserAnswer;
  timeMs: number;
  markedForReview?: boolean;
}

export interface ExamEvaluatedDetail {
  questionId: string;
  question: string;
  questionType: QuestionType;
  subject: string;
  chapter: string;
  topic: string;
  difficulty: ExamDifficulty;
  options: string[];
  matchPairs?: MatchPairData;
  assertion?: string;
  reason?: string;
  imageSvg?: string;
  userAnswer: ExamUserAnswer;
  correctAnswer: number | number[] | string;
  isCorrect: boolean;
  isSkipped: boolean;
  marksAwarded: number;
  timeMs: number;
  speedClass: SpeedClass;
  explanation: SmartExplanation;
  source: string;
  year: number | null;
}

export interface TopicStat {
  topic: string;
  subject: string;
  attempted: number;
  correct: number;
  accuracy: number;
  avgTimeSec: number;
}

export interface ExamStreakState {
  dailyStreak: number;
  bestDailyStreak: number;
  quizStreak: number;
  perfectStreak: number;
  examXp: number;
  examLevel: ExamLevelTitle;
}

export interface ExamResultSummary {
  attemptId: string;
  sessionId: string;
  mode: ExamMode;
  score: number;
  maxScore: number;
  correctCount: number;
  wrongCount: number;
  skippedCount: number;
  totalQuestions: number;
  accuracy: number;
  timeSpentSeconds: number;
  avgTimePerQuestion: number;
  negativeMarking: number;
  xpEarned: number;
  rank: number | null;
  streaks: ExamStreakState;
  speedMatrix: Record<SpeedClass, number>;
  topicBreakdown: TopicStat[];
  didWell: string[];
  needsImprovement: string[];
  nextRecommendation: {
    label: string;
    categoryId: string;
    subject: string;
    topic?: string;
    difficulty: ExamDifficulty | 'Mixed';
  };
  examStrategyNote: string | null;
  mistakesSavedCount: number;
  details: ExamEvaluatedDetail[];
  createdAt: string;
}

export interface MistakeRecord {
  id: string;
  questionId: string;
  subject: string;
  topic: string;
  mistakeCategory: MistakeCategory;
  notes: string;
  timesMissed: number;
  resolved: boolean;
  lastMissedAt: string;
  question?: ExamQuestion;
}

export interface AnalyticsSummary {
  hasData: boolean;
  range: '7d' | '30d' | 'all';
  totalQuizzes: number;
  totalAttempted: number;
  totalCorrect: number;
  totalWrong: number;
  overallAccuracy: number;
  avgTimePerQuestion: number;
  bestScore: number;
  streaks: ExamStreakState;
  subjectPerformance: Array<{
    subject: string;
    attempted: number;
    correct: number;
    accuracy: number;
  }>;
  strongTopics: TopicStat[];
  weakTopics: TopicStat[];
  mistakenConcepts: Array<{
    topic: string;
    subject: string;
    count: number;
    topCategory: MistakeCategory;
  }>;
  speedMatrix: Record<SpeedClass, number>;
  chartSeries: Array<{
    date: string;
    label: string;
    accuracy: number;
    score: number;
    quizzes: number;
  }>;
  recentAttempts: Array<{
    attemptId: string;
    mode: ExamMode;
    subject: string;
    score: number;
    maxScore: number;
    accuracy: number;
    totalQuestions: number;
    timeSpentSeconds: number;
    createdAt: string;
  }>;
}

export interface ExamLeaderboardRow {
  rank: number;
  playerId: string;
  displayName: string;
  xp: number;
  levelTitle: ExamLevelTitle;
  accuracy: number;
  quizzesCompleted: number;
  bestScore: number;
}

export interface DailyExamStatus {
  date: string;
  completed: boolean;
  attemptId?: string;
  score?: number;
  maxScore?: number;
  accuracy?: number;
  timeSpentSeconds?: number;
  rank?: number | null;
  totalParticipants?: number;
  weakArea?: string | null;
}

/* ============================================================
   CG QUIZ STUDIO: EASY QUIZ ZONE & CREATIONS TYPES
   ============================================================ */

export type EasyDifficulty = 'Beginner' | 'Easy' | 'Easy Challenge';

export type EasyCategoryId =
  | 'general-knowledge'
  | 'science'
  | 'physics'
  | 'chemistry'
  | 'mathematics'
  | 'computer-science'
  | 'engineering'
  | 'automobile'
  | 'space'
  | 'ai'
  | 'tech-innovation';

export interface EasyCategoryInfo {
  id: EasyCategoryId;
  name: string;
  shortName: string;
  description: string;
  accentColor: string;
  iconKey: string;
}

export interface EasyQuizQuestion {
  id: string;
  categoryId: EasyCategoryId;
  difficulty: EasyDifficulty;
  question: string;
  options: [string, string, string, string];
  correctIndex: 0 | 1 | 2 | 3;
  explanation: string;
}

export type CreationType = 'car' | 'phone';

export interface SavedCreation {
  id: string;
  userId: string;
  type: CreationType;
  title: string;
  subtitle: string;
  designRating: number;
  estimatedCost: number;
  payload: Record<string, unknown>;
  previewDataUrl?: string | null;
  createdAt: string;
  updatedAt: string;
}

/* ============================================================
   SMART QUIZ ARENA: 4 DIFFICULTIES, PODIUM & LEADERBOARD TYPES
   ============================================================ */

export type GameDifficultyId = 'easy' | 'moderate' | 'hard' | 'jee';

export type GameCategoryId =
  | 'all'
  | 'physics'
  | 'chemistry'
  | 'mathematics'
  | 'computer-science'
  | 'engineering'
  | 'automobile'
  | 'general-stem';

export type GameLeaderboardView = 'highest' | 'overall';

export interface GameDifficultyConfig {
  id: GameDifficultyId;
  levelNumber: 1 | 2 | 3 | 4;
  name: string;
  shortLabel: string;
  description: string;
  exampleStyle: string;
  marksPerCorrect: 10 | 20 | 30 | 50;
  marksWrong: 0;
  marksUnanswered: 0;
  accentColor: string;
}

export interface SmartGameQuestion {
  id: string;
  difficulty: GameDifficultyId;
  category: Exclude<GameCategoryId, 'all'>;
  topic: string;
  question: string;
  options: [string, string, string, string];
  correctIndex: 0 | 1 | 2 | 3;
  explanation: string;
  marks: 10 | 20 | 30 | 50;
}

export type PublicSmartQuestion = Omit<SmartGameQuestion, 'correctIndex' | 'explanation'>;

export interface GameEvaluatedItem {
  questionId: string;
  topic: string;
  category: string;
  question: string;
  options: [string, string, string, string];
  selectedIndex: number;
  correctIndex: 0 | 1 | 2 | 3;
  isCorrect: boolean;
  isUnanswered: boolean;
  pointsAwarded: number;
  explanation: string;
}

export interface GameLeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  className: string;
  title: string;
  score: number;
  bestScore: number;
  totalPoints: number;
  gamesPlayed: number;
  accuracy: number;
  completionTime: number;
  difficulty: string;
  category: string;
  createdAt: string;
}

export interface GameResultPayload {
  resultId: string;
  sessionId: string;
  userId: string;
  username: string;
  score: number;
  maxPossibleScore: number;
  marksPerCorrect: number;
  correctAnswers: number;
  incorrectAnswers: number;
  unanswered: number;
  totalQuestions: number;
  accuracy: number;
  completionTime: number;
  difficulty: GameDifficultyId;
  category: string;
  highestRank: number | null;
  overallRank: number | null;
  totalRankedPlayers: number;
  enteredTop3Highest: boolean;
  enteredTop3Overall: boolean;
  top3Highest: GameLeaderboardEntry[];
  top3Overall: GameLeaderboardEntry[];
  currentUserHighestEntry: GameLeaderboardEntry | null;
  currentUserOverallEntry: GameLeaderboardEntry | null;
  xpEarned: number;
  leveledUp: boolean;
  unlockedAchievements: string[];
  player: PlayerProfile | null;
  details: GameEvaluatedItem[];
  createdAt: string;
}



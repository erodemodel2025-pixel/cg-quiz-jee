import type { DailyChallengeInfo, GameModeId, PixelThemeId } from './types.ts';

export interface LevelThreshold {
  level: number;
  minXp: number;
  title: string;
}

export const LEVEL_THRESHOLDS: LevelThreshold[] = [
  { level: 1, minXp: 0, title: 'Circuit Rookie' },
  { level: 2, minXp: 250, title: 'Solder Apprentice' },
  { level: 3, minXp: 600, title: 'Logic Master' },
  { level: 4, minXp: 1100, title: 'Code Wizard' },
  { level: 5, minXp: 1750, title: 'System Architect' },
  { level: 6, minXp: 2600, title: 'Engineering Legend' },
  { level: 7, minXp: 3800, title: 'Arcade Champion' },
];

export interface PixelThemeDef {
  id: PixelThemeId;
  name: string;
  unlockLevel: number;
  description: string;
  swatches: [string, string, string];
}

export const PIXEL_THEMES: PixelThemeDef[] = [
  {
    id: 'cyber-midnight',
    name: 'Cyber Midnight',
    unlockLevel: 1,
    description: 'Deep navy void with electric cyan & arcade yellow.',
    swatches: ['#080C1E', '#00F0FF', '#FFE600'],
  },
  {
    id: 'emerald-matrix',
    name: 'Emerald Matrix',
    unlockLevel: 2,
    description: 'Classic phosphor CRT green terminal palette.',
    swatches: ['#05130C', '#22FF66', '#FFE600'],
  },
  {
    id: 'volcanic-forge',
    name: 'Volcanic Forge',
    unlockLevel: 4,
    description: 'Superheated obsidian with pixel orange plasma.',
    swatches: ['#160A08', '#FF6B00', '#FFE600'],
  },
  {
    id: 'synthwave-grid',
    name: 'Synthwave Grid',
    unlockLevel: 6,
    description: 'High-voltage arcade purple and neon horizon.',
    swatches: ['#120824', '#D946EF', '#00F0FF'],
  },
];

export interface AchievementDef {
  id: string;
  name: string;
  description: string;
  xpBonus: number;
  category: 'gameplay' | 'mastery' | 'secret';
}

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    id: 'first_run',
    name: 'BOOT SEQUENCE',
    description: 'Complete your first engineering challenge.',
    xpBonus: 50,
    category: 'gameplay',
  },
  {
    id: 'streak_master',
    name: 'STREAK MASTER',
    description: 'Hit a 5-answer combo streak without missing.',
    xpBonus: 100,
    category: 'mastery',
  },
  {
    id: 'perfect_run',
    name: 'FLAWLESS CIRCUIT',
    description: 'Score 100% accuracy in a full quiz or mini-game.',
    xpBonus: 150,
    category: 'mastery',
  },
  {
    id: 'boss_slayer',
    name: 'ENTROPY SLAYER',
    description: 'Defeat an Engineering Boss in Boss Battle.',
    xpBonus: 175,
    category: 'gameplay',
  },
  {
    id: 'circuit_architect',
    name: 'CIRCUIT ARCHITECT',
    description: 'Clear 4+ stages in Circuit Rush.',
    xpBonus: 120,
    category: 'gameplay',
  },
  {
    id: 'code_ninja',
    name: 'DEBUG NINJA',
    description: 'Solve 5+ puzzles in Code Breaker.',
    xpBonus: 120,
    category: 'gameplay',
  },
  {
    id: 'competitor',
    name: 'ARENA CONTENDER',
    description: 'Submit an official Competitive mode run.',
    xpBonus: 100,
    category: 'gameplay',
  },
  {
    id: 'konami',
    name: 'LEGACY OVERRIDE',
    description: 'Entered the classic arcade code.',
    xpBonus: 75,
    category: 'secret',
  },
  {
    id: 'logo_poke',
    name: 'CORE OVERHEAT',
    description: 'Poked the CG QUIZ logo 5 times in a row.',
    xpBonus: 50,
    category: 'secret',
  },
  {
    id: 'cpu_key',
    name: 'SILICON WHISPER',
    description: 'Typed "CG" on the keyboard outside inputs.',
    xpBonus: 50,
    category: 'secret',
  },
  {
    id: 'night_owl',
    name: 'MIDNIGHT LAB',
    description: 'Trained in the engineering studio after midnight.',
    xpBonus: 60,
    category: 'secret',
  },
  {
    id: 'easy_scholar',
    name: 'KNOWLEDGE SPARK',
    description: 'Complete an Easy Quiz Zone round with 80%+ accuracy.',
    xpBonus: 80,
    category: 'gameplay',
  },
  {
    id: 'car_designer',
    name: 'CHASSIS ARCHITECT',
    description: 'Build and save your first custom 3D car design.',
    xpBonus: 120,
    category: 'gameplay',
  },
  {
    id: 'phone_architect',
    name: 'DEVICE CREATOR',
    description: 'Design and save your first next-gen smartphone.',
    xpBonus: 120,
    category: 'gameplay',
  },
  {
    id: 'studio_master',
    name: 'STUDIO INNOVATOR',
    description: 'Create both a custom car and a custom smartphone.',
    xpBonus: 180,
    category: 'mastery',
  },
];

export function computeLevelFromXp(xp: number): {
  level: number;
  title: string;
  currentLevelXp: number;
  nextLevelXp: number | null;
  progressPercent: number;
} {
  let current = LEVEL_THRESHOLDS[0];
  let next: LevelThreshold | null = LEVEL_THRESHOLDS[1];

  for (let i = 0; i < LEVEL_THRESHOLDS.length; i++) {
    if (xp >= LEVEL_THRESHOLDS[i].minXp) {
      current = LEVEL_THRESHOLDS[i];
      next = LEVEL_THRESHOLDS[i + 1] ?? null;
    }
  }

  if (!next) {
    return {
      level: current.level,
      title: current.title,
      currentLevelXp: current.minXp,
      nextLevelXp: null,
      progressPercent: 100,
    };
  }

  const span = next.minXp - current.minXp;
  const gained = xp - current.minXp;
  return {
    level: current.level,
    title: current.title,
    currentLevelXp: current.minXp,
    nextLevelXp: next.minXp,
    progressPercent: Math.min(100, Math.max(0, Math.round((gained / span) * 100))),
  };
}

export function getUnlockedThemesForLevel(level: number): PixelThemeId[] {
  return PIXEL_THEMES.filter((t) => level >= t.unlockLevel).map((t) => t.id);
}

const DAILY_TEMPLATES: Array<{
  title: string;
  description: string;
  gameType: GameModeId;
  categoryId: string;
  targetScore: number;
  xpReward: number;
}> = [
  {
    title: 'Circuit Overload Sprint',
    description: 'Score 600+ in Circuit Rush today.',
    gameType: 'circuit-rush',
    categoryId: 'electronics',
    targetScore: 600,
    xpReward: 150,
  },
  {
    title: 'Bug Hunt Protocol',
    description: 'Score 500+ in Code Breaker today.',
    gameType: 'code-breaker',
    categoryId: 'programming',
    targetScore: 500,
    xpReward: 150,
  },
  {
    title: 'Defeat Entropy Golem',
    description: 'Win an Engineering Boss Battle with 700+ score.',
    gameType: 'boss-battle',
    categoryId: 'cs',
    targetScore: 700,
    xpReward: 200,
  },
  {
    title: 'Boolean Gate Mastery',
    description: 'Score 550+ in Logic Lab today.',
    gameType: 'logic-lab',
    categoryId: 'aptitude',
    targetScore: 550,
    xpReward: 150,
  },
  {
    title: 'Hardware Recall Blitz',
    description: 'Score 500+ in Component Match today.',
    gameType: 'component-match',
    categoryId: 'electronics',
    targetScore: 500,
    xpReward: 140,
  },
  {
    title: 'IQ Arena Qualifier',
    description: 'Score 600+ in Engineering IQ Quiz today.',
    gameType: 'iq-quiz',
    categoryId: 'mechanical',
    targetScore: 600,
    xpReward: 160,
  },
];

export function getDailyChallengeForDate(dateStr: string, completed = false): DailyChallengeInfo {
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    hash = (hash * 31 + dateStr.charCodeAt(i)) >>> 0;
  }
  const tpl = DAILY_TEMPLATES[hash % DAILY_TEMPLATES.length];
  return {
    date: dateStr,
    ...tpl,
    completed,
  };
}

export const ENGINEERING_JOKES: string[] = [
  'Why do programmers prefer dark mode? Because light attracts bugs!',
  'A resistor walks into a bar... wait, there was too much impedance.',
  'There are 10 types of engineers: those who read binary and those who do not.',
  'Mechanical engineers build weapons. Civil engineers build targets.',
  'Why was the capacitor promoted? It had tremendous potential.',
  'Debugging: being the detective in a crime movie where you are also the culprit.',
  'An infinite loop walks into a bar. An infinite loop walks into a bar...',
  'Hardware is the part of a computer you can kick when software freezes.',
  'Ohm my goodness, current events are shocking today!',
  'Why did the neural network fail art class? Overfitting to the training canvas.',
];

export const FUNNY_GAME_OVER_MESSAGES: string[] = [
  'Magic smoke escaped! Check polarity and reboot.',
  'Segmentation fault in brain cache. Insert coin to retry!',
  'Even Nikola Tesla tripped over a wire once. Probably.',
  'Your solder joint went cold. Grab the iron and go again!',
  'Stack overflow! Time to pop some knowledge back onto the heap.',
];

export const EXAM_LEVEL_THRESHOLDS: Array<{ minXp: number; title: 'Beginner' | 'Learner' | 'Explorer' | 'Advanced' | 'Expert' | 'Master' }> = [
  { minXp: 0, title: 'Beginner' },
  { minXp: 200, title: 'Learner' },
  { minXp: 550, title: 'Explorer' },
  { minXp: 1100, title: 'Advanced' },
  { minXp: 1900, title: 'Expert' },
  { minXp: 3000, title: 'Master' },
];

export function computeExamLevel(xp: number): {
  title: 'Beginner' | 'Learner' | 'Explorer' | 'Advanced' | 'Expert' | 'Master';
  nextMinXp: number | null;
  progressPercent: number;
} {
  let current = EXAM_LEVEL_THRESHOLDS[0];
  let next: typeof EXAM_LEVEL_THRESHOLDS[number] | null = EXAM_LEVEL_THRESHOLDS[1];
  for (let i = 0; i < EXAM_LEVEL_THRESHOLDS.length; i++) {
    if (xp >= EXAM_LEVEL_THRESHOLDS[i].minXp) {
      current = EXAM_LEVEL_THRESHOLDS[i];
      next = EXAM_LEVEL_THRESHOLDS[i + 1] ?? null;
    }
  }
  if (!next) {
    return { title: current.title, nextMinXp: null, progressPercent: 100 };
  }
  const span = next.minXp - current.minXp;
  const gained = xp - current.minXp;
  return {
    title: current.title,
    nextMinXp: next.minXp,
    progressPercent: Math.min(100, Math.max(0, Math.round((gained / span) * 100))),
  };
}


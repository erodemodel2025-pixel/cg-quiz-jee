import { PART1_EASY_QUESTIONS } from './easyQuestionsPart1.ts';
import { PART2_EASY_QUESTIONS } from './easyQuestionsPart2.ts';
import type { EasyCategoryId, EasyCategoryInfo, EasyDifficulty, EasyQuizQuestion } from './types.ts';

export const EASY_CATEGORIES: EasyCategoryInfo[] = [
  {
    id: 'general-knowledge',
    name: 'General Knowledge',
    shortName: 'General',
    description: 'World facts, continents, landmarks, and everyday curiosity.',
    accentColor: '#38BDF8',
    iconKey: 'globe',
  },
  {
    id: 'science',
    name: 'Science',
    shortName: 'Science',
    description: 'Earth, planets, plants, states of matter, and life science.',
    accentColor: '#22C55E',
    iconKey: 'flask',
  },
  {
    id: 'physics',
    name: 'Physics',
    shortName: 'Physics',
    description: 'Forces, motion, energy, light, sound, and simple machines.',
    accentColor: '#3B82F6',
    iconKey: 'atom',
  },
  {
    id: 'chemistry',
    name: 'Chemistry',
    shortName: 'Chemistry',
    description: 'Elements, atoms, water, acids, bases, and reactions.',
    accentColor: '#F59E0B',
    iconKey: 'beaker',
  },
  {
    id: 'mathematics',
    name: 'Mathematics',
    shortName: 'Math',
    description: 'Arithmetic, geometry, percentages, patterns, and puzzles.',
    accentColor: '#A855F7',
    iconKey: 'calculator',
  },
  {
    id: 'computer-science',
    name: 'Computer Science',
    shortName: 'Computing',
    description: 'Hardware basics, binary bits, internet, and coding ideas.',
    accentColor: '#06B6D4',
    iconKey: 'cpu',
  },
  {
    id: 'engineering',
    name: 'Engineering',
    shortName: 'Engineering',
    description: 'Bridges, prototypes, materials, turbines, and design thinking.',
    accentColor: '#6366F1',
    iconKey: 'wrench',
  },
  {
    id: 'automobile',
    name: 'Automobile Technology',
    shortName: 'Automobiles',
    description: 'Car systems, EVs, aerodynamics, brakes, and chassis basics.',
    accentColor: '#EF4444',
    iconKey: 'car',
  },
  {
    id: 'space',
    name: 'Space and Astronomy',
    shortName: 'Space',
    description: 'Solar system, moons, rockets, ISRO, and cosmic distances.',
    accentColor: '#8B5CF6',
    iconKey: 'rocket',
  },
  {
    id: 'ai',
    name: 'Artificial Intelligence',
    shortName: 'AI & ML',
    description: 'Machine learning, vision, chatbots, and smart assistants.',
    accentColor: '#EC4899',
    iconKey: 'brain',
  },
  {
    id: 'tech-innovation',
    name: 'Technology and Innovation',
    shortName: 'Tech & Design',
    description: 'Smartphones, OLED screens, sensors, clean energy, and 5G.',
    accentColor: '#10B981',
    iconKey: 'smartphone',
  },
];

export const EASY_QUESTIONS: EasyQuizQuestion[] = [
  ...PART1_EASY_QUESTIONS,
  ...PART2_EASY_QUESTIONS,
];

function shuffleItems<T>(arr: readonly T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function shuffleEasyOptions(q: EasyQuizQuestion): EasyQuizQuestion {
  const order = shuffleItems([0, 1, 2, 3]);
  const options = order.map((idx) => q.options[idx]) as [string, string, string, string];
  const correctIndex = order.indexOf(q.correctIndex) as 0 | 1 | 2 | 3;
  return { ...q, options, correctIndex };
}

export function selectEasyQuizRound(params: {
  categoryId: EasyCategoryId | 'all';
  difficulty: EasyDifficulty | 'All';
  count?: number;
  excludeIds?: string[];
}): EasyQuizQuestion[] {
  const targetCount = Math.max(5, Math.min(20, params.count ?? 10));
  const exclude = new Set(params.excludeIds || []);

  let pool =
    params.categoryId === 'all'
      ? [...EASY_QUESTIONS]
      : EASY_QUESTIONS.filter((q) => q.categoryId === params.categoryId);

  if (params.difficulty !== 'All') {
    const filtered = pool.filter((q) => q.difficulty === params.difficulty);
    if (filtered.length >= 5) {
      pool = filtered;
    } else if (filtered.length > 0) {
      const remaining = pool.filter((q) => q.difficulty !== params.difficulty);
      pool = [...filtered, ...shuffleItems(remaining)];
    }
  }

  const fresh = pool.filter((q) => !exclude.has(q.id));
  const working = fresh.length >= targetCount ? fresh : pool;

  const picked: EasyQuizQuestion[] = [];
  if (params.difficulty === 'All' && params.categoryId === 'all') {
    // Spread across categories cleanly
    const byCat = new Map<string, EasyQuizQuestion[]>();
    for (const q of shuffleItems(working)) {
      if (!byCat.has(q.categoryId)) byCat.set(q.categoryId, []);
      byCat.get(q.categoryId)!.push(q);
    }
    const keys = shuffleItems([...byCat.keys()]);
    while (picked.length < targetCount) {
      let added = false;
      for (const k of keys) {
        const list = byCat.get(k)!;
        if (list.length > 0 && picked.length < targetCount) {
          picked.push(list.shift()!);
          added = true;
        }
      }
      if (!added) break;
    }
  } else {
    picked.push(...shuffleItems(working).slice(0, targetCount));
  }

  return picked.map(shuffleEasyOptions);
}

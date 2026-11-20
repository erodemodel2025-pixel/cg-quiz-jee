import type {
  ExamDifficulty,
  ExamMode,
  ExamQuestion,
  QuestionType,
} from './types.ts';

export function shuffleArray<T>(arr: readonly T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Shuffles option positions for randomized quiz delivery and recalculates exact answer keys.
 * Preserves canonical order for Assertion-Reason ("Both A and R...") and True/False ("True" first).
 */
export function shuffleQuestionOptions(q: ExamQuestion): ExamQuestion {
  if (q.questionType === 'integer' || q.questionType === 'truefalse' || q.questionType === 'assertion_reason') {
    return {
      ...q,
      options: [...q.options],
      matchPairs: q.matchPairs
        ? { left: [...q.matchPairs.left], right: [...q.matchPairs.right] }
        : undefined,
    };
  }

  if (q.questionType === 'match' && q.matchPairs) {
    const rightLen = q.matchPairs.right.length;
    const perm = shuffleArray(Array.from({ length: rightLen }, (_, i) => i));
    const newRight = perm.map((oldIdx) => q.matchPairs!.right[oldIdx]);
    const oldToNew = new Map<number, number>();
    perm.forEach((oldIdx, newIdx) => oldToNew.set(oldIdx, newIdx));

    const prevAnswer = Array.isArray(q.answer) ? q.answer.map(Number) : [];
    const newAnswer = prevAnswer.map((oldRightIdx) => oldToNew.get(oldRightIdx) ?? oldRightIdx);

    return {
      ...q,
      options: [],
      matchPairs: {
        left: [...q.matchPairs.left],
        right: newRight,
      },
      answer: newAnswer,
    };
  }

  if (q.options.length < 2) {
    return { ...q, options: [...q.options] };
  }

  const indices = shuffleArray(Array.from({ length: q.options.length }, (_, i) => i));
  const newOptions = indices.map((oldIdx) => q.options[oldIdx]);
  const oldToNew = new Map<number, number>();
  indices.forEach((oldIdx, newIdx) => oldToNew.set(oldIdx, newIdx));

  if (q.questionType === 'multiple' && Array.isArray(q.answer)) {
    const mapped = q.answer
      .map((oldIdx) => oldToNew.get(Number(oldIdx)) ?? Number(oldIdx))
      .sort((a, b) => a - b);
    return {
      ...q,
      options: newOptions,
      answer: mapped,
    };
  }

  const prevAns = Number(q.answer);
  const newAns = oldToNew.get(prevAns) ?? prevAns;
  return {
    ...q,
    options: newOptions,
    answer: newAns,
  };
}

export function getModeScoringRules(mode: ExamMode, requestedNeg?: number): {
  marksPerCorrect: number;
  negativeMarking: number;
  label: string;
} {
  if (mode === 'jee' || mode === 'mock') {
    const neg = requestedNeg !== undefined && !Number.isNaN(requestedNeg) ? Math.max(0, Math.min(2, requestedNeg)) : 1;
    return {
      marksPerCorrect: 4,
      negativeMarking: neg,
      label: neg > 0 ? `+4 / -${neg} / 0 (JEE Practice)` : '+4 / 0 (Practice)',
    };
  }
  const neg = requestedNeg !== undefined && !Number.isNaN(requestedNeg) ? Math.max(0, Math.min(2, requestedNeg)) : 0;
  return {
    marksPerCorrect: 1,
    negativeMarking: neg,
    label: neg > 0 ? `+1 / -${neg} / 0` : '+1 / 0',
  };
}

export function getPerformanceLevel(accuracy: number): {
  label: 'Excellent' | 'Strong' | 'Good Progress' | 'Keep Practicing' | 'Start with the Basics';
  encouragement: string;
  suggestedNextMode: 'challenge' | 'standard' | 'career_fair';
} {
  if (accuracy >= 90) {
    return {
      label: 'Excellent',
      encouragement: 'Outstanding mastery across topics. You are ready for Challenge or JEE Practice mode!',
      suggestedNextMode: 'challenge',
    };
  }
  if (accuracy >= 75) {
    return {
      label: 'Strong',
      encouragement: 'Strong engineering intuition! Review the few missed items and push into harder problems.',
      suggestedNextMode: 'challenge',
    };
  }
  if (accuracy >= 60) {
    return {
      label: 'Good Progress',
      encouragement: 'Solid momentum. Practicing missed concepts once more will lift you past 80%.',
      suggestedNextMode: 'standard',
    };
  }
  if (accuracy >= 40) {
    return {
      label: 'Keep Practicing',
      encouragement: 'You are building core foundations—focus on weak concepts with instant explanations.',
      suggestedNextMode: 'standard',
    };
  }
  return {
    label: 'Start with the Basics',
    encouragement: 'Great starting diagnostic! Try Career Fair or Beginner mode to build confidence step by step.',
    suggestedNextMode: 'career_fair',
  };
}

interface SelectQuizParams {
  allQuestions: ExamQuestion[];
  mode: ExamMode;
  categoryId?: string;
  subject?: string;
  chapter?: string;
  difficulty?: ExamDifficulty | 'Adaptive' | 'Mixed';
  questionType?: QuestionType | 'All';
  questionCount?: number;
  excludeQuestionIds?: string[];
  mistakeQuestionIds?: string[];
  weakTopics?: string[];
  weakSubjects?: string[];
  seedStr?: string;
}

function distributeByTopicRoundRobin(questions: ExamQuestion[], limit: number): ExamQuestion[] {
  const buckets = new Map<string, ExamQuestion[]>();
  for (const q of shuffleArray(questions)) {
    const key = `${q.categoryId}::${q.topic}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(q);
  }
  const keys = shuffleArray([...buckets.keys()]);
  const result: ExamQuestion[] = [];
  let added = true;
  while (result.length < limit && added) {
    added = false;
    for (const k of keys) {
      const list = buckets.get(k)!;
      if (list.length > 0 && result.length < limit) {
        result.push(list.shift()!);
        added = true;
      }
    }
  }
  return result;
}

function selectWithDifficultyRatio(
  pool: ExamQuestion[],
  targetCount: number,
  ratios: { easy: number; medium: number; hard: number }
): ExamQuestion[] {
  const easyPool = distributeByTopicRoundRobin(pool.filter((q) => q.difficulty === 'Easy'), pool.length);
  const mediumPool = distributeByTopicRoundRobin(pool.filter((q) => q.difficulty === 'Medium'), pool.length);
  const hardPool = distributeByTopicRoundRobin(
    pool.filter((q) => q.difficulty === 'Hard' || q.difficulty === 'Expert'),
    pool.length
  );

  const wantEasy = Math.round(targetCount * ratios.easy);
  const wantMedium = Math.round(targetCount * ratios.medium);
  const wantHard = Math.max(0, targetCount - wantEasy - wantMedium);

  const picked: ExamQuestion[] = [];
  const used = new Set<string>();

  const take = (src: ExamQuestion[], count: number) => {
    for (const q of src) {
      if (picked.length >= targetCount || count <= 0) break;
      if (!used.has(q.id)) {
        used.add(q.id);
        picked.push(q);
        count -= 1;
      }
    }
  };

  take(easyPool, wantEasy);
  take(mediumPool, wantMedium);
  take(hardPool, wantHard);

  if (picked.length < targetCount) {
    const remaining = distributeByTopicRoundRobin(pool.filter((q) => !used.has(q.id)), targetCount - picked.length);
    for (const q of remaining) {
      if (picked.length >= targetCount) break;
      used.add(q.id);
      picked.push(q);
    }
  }

  return shuffleArray(picked);
}

export function selectBalancedQuizQuestions(params: SelectQuizParams): ExamQuestion[] {
  const {
    allQuestions,
    mode,
    categoryId = 'all',
    subject = 'all',
    chapter = 'all',
    difficulty = 'Adaptive',
    questionType = 'All',
    excludeQuestionIds = [],
    mistakeQuestionIds = [],
    weakTopics = [],
    weakSubjects = [],
    seedStr,
  } = params;

  let targetCount = Number(params.questionCount ?? 10);
  if (mode === 'quick' || mode === 'career_fair' || mode === 'daily') targetCount = Math.min(12, Math.max(5, targetCount || 10));
  else if (mode === 'standard' || mode === 'challenge' || mode === 'mixed') targetCount = Math.min(25, Math.max(10, targetCount || 20));
  else if (mode === 'rapid') targetCount = Math.min(12, Math.max(6, targetCount || 10));
  else if (mode === 'jee' || mode === 'mock') targetCount = Math.min(30, Math.max(10, targetCount || 20));
  else if (mode === 'survival') targetCount = Math.min(25, Math.max(10, targetCount || 15));
  else targetCount = Math.min(40, Math.max(5, targetCount || 10));

  const qMap = new Map(allQuestions.map((q) => [q.id, q]));

  // Mistake Practice (Revision / Weak): prioritize related-concept variants first!
  if (mode === 'revision') {
    const missedSet = new Set(mistakeQuestionIds);
    const missedQuestions = mistakeQuestionIds
      .map((id) => qMap.get(id))
      .filter((q): q is ExamQuestion => Boolean(q));

    const missedConcepts = new Set(
      missedQuestions.map((q) => q.concept || q.explanation.concept || q.topic).filter(Boolean)
    );
    const missedTopics = new Set(missedQuestions.map((q) => q.topic));

    // Related-concept variant questions (different ID, shared concept or topic)
    const variants = allQuestions.filter(
      (q) =>
        !missedSet.has(q.id) &&
        ((q.concept && missedConcepts.has(q.concept)) ||
          missedConcepts.has(q.explanation.concept) ||
          missedTopics.has(q.topic))
    );

    const combined = [...shuffleArray(variants), ...shuffleArray(missedQuestions)];
    if (combined.length > 0) {
      return combined.slice(0, Math.min(targetCount, combined.length));
    }
  }

  let pool = [...allQuestions];

  if (mode === 'weak' && (mistakeQuestionIds.length > 0 || weakTopics.length > 0 || weakSubjects.length > 0)) {
    const weakConceptSet = new Set<string>();
    const missedSet = new Set(mistakeQuestionIds);
    for (const id of mistakeQuestionIds) {
      const q = qMap.get(id);
      if (q) {
        if (q.concept) weakConceptSet.add(q.concept);
        weakConceptSet.add(q.explanation.concept);
      }
    }
    const weakTopicSet = new Set(weakTopics);
    const weakSubjectSet = new Set(weakSubjects);

    const variants = pool.filter(
      (q) =>
        !missedSet.has(q.id) &&
        ((q.concept && weakConceptSet.has(q.concept)) ||
          weakConceptSet.has(q.explanation.concept) ||
          weakTopicSet.has(q.topic) ||
          weakSubjectSet.has(q.subject))
    );
    if (variants.length >= 4) {
      pool = variants;
    } else {
      const broadWeak = pool.filter(
        (q) =>
          (q.concept && weakConceptSet.has(q.concept)) ||
          weakTopicSet.has(q.topic) ||
          weakSubjectSet.has(q.subject)
      );
      if (broadWeak.length > 0) pool = broadWeak;
    }
  } else if (mode === 'rapid') {
    const shortPool = pool.filter((q) => q.question.length <= 165 && q.questionType !== 'match');
    if (shortPool.length >= 6) pool = shortPool;
  } else if (mode === 'career_fair') {
    const fairPool = pool.filter(
      (q) =>
        q.categoryId === 'career-fair' ||
        q.tags.includes('career-fair') ||
        q.difficulty === 'Easy' ||
        q.difficulty === 'Medium'
    );
    if (fairPool.length >= 10) pool = fairPool;
  } else if (mode === 'jee') {
    const jeePool = pool.filter(
      (q) =>
        q.categoryId === 'jee-main' ||
        q.categoryId === 'jee-advanced' ||
        q.categoryId === 'colleges' ||
        q.categoryId === 'admissions' ||
        q.categoryId === 'physics' ||
        q.categoryId === 'chemistry' ||
        q.categoryId === 'mathematics'
    );
    if (jeePool.length >= 10) pool = jeePool;
  }

  // Apply user topic/subject/chapter/type filters
  if (categoryId !== 'all') {
    const filtered = pool.filter((q) => q.categoryId === categoryId);
    if (filtered.length > 0) pool = filtered;
  }
  if (subject !== 'all') {
    const filtered = pool.filter((q) => q.subject === subject);
    if (filtered.length > 0) pool = filtered;
  }
  if (chapter !== 'all') {
    const filtered = pool.filter((q) => q.chapter === chapter);
    if (filtered.length > 0) pool = filtered;
  }
  if (questionType !== 'All') {
    const filtered = pool.filter((q) => q.questionType === questionType);
    if (filtered.length > 0) pool = filtered;
  }
  if (difficulty !== 'Mixed' && difficulty !== 'Adaptive') {
    const filtered = pool.filter((q) => q.difficulty === difficulty);
    if (filtered.length > 0) pool = filtered;
  }

  // Filter out recently seen questions (if enough fresh questions remain)
  const excludeSet = new Set(excludeQuestionIds);
  const freshPool = excludeSet.size > 0 ? pool.filter((q) => !excludeSet.has(q.id)) : pool;
  if (freshPool.length >= Math.min(targetCount, Math.max(4, pool.length))) {
    pool = freshPool;
  } else if (freshPool.length > 0 && freshPool.length < targetCount) {
    // Keep all fresh questions first, only reuse seen questions from pool if user exhausted the topic
    const reused = shuffleArray(pool.filter((q) => excludeSet.has(q.id)));
    pool = [...freshPool, ...reused];
  }

  // Deterministic seed for Daily Challenge
  if (mode === 'daily') {
    const seedInput = seedStr || new Date().toISOString().slice(0, 10);
    let seed = 0;
    for (let i = 0; i < seedInput.length; i++) seed = (seed * 31 + seedInput.charCodeAt(i)) >>> 0;
    const seeded = [...pool].sort((a, b) => {
      const ha = (a.id.charCodeAt(0) * 17 + seed) % 97;
      const hb = (b.id.charCodeAt(0) * 17 + seed) % 97;
      return ha - hb;
    });
    return seeded.slice(0, Math.min(targetCount, seeded.length));
  }

  // Mode-specific balanced difficulty & topic distribution
  let selected: ExamQuestion[];
  if (mode === 'challenge') {
    selected = selectWithDifficultyRatio(pool, Math.min(targetCount, pool.length), {
      easy: 0.1,
      medium: 0.3,
      hard: 0.6,
    });
  } else if (mode === 'career_fair') {
    selected = selectWithDifficultyRatio(pool, Math.min(targetCount, pool.length), {
      easy: 0.5,
      medium: 0.4,
      hard: 0.1,
    });
  } else if (mode === 'standard' || mode === 'mixed' || mode === 'quick' || mode === 'jee') {
    selected = selectWithDifficultyRatio(pool, Math.min(targetCount, pool.length), {
      easy: 0.3,
      medium: 0.45,
      hard: 0.25,
    });
  } else {
    selected = distributeByTopicRoundRobin(pool, Math.min(targetCount, pool.length));
  }

  // Progressive ordering for Adaptive, Mock, JEE, or Challenge
  if (difficulty === 'Adaptive' || mode === 'adaptive' || mode === 'mock' || mode === 'jee') {
    const order: Record<ExamDifficulty, number> = { Easy: 1, Medium: 2, Hard: 3, Expert: 4 };
    selected.sort((a, b) => order[a.difficulty] - order[b.difficulty]);
  }

  if (selected.length === 0) {
    selected = shuffleArray(allQuestions).slice(0, Math.min(targetCount, allQuestions.length));
  }

  return selected;
}

import { ALLOWED_ENGINEERING_CATEGORY_IDS } from './categories.ts';
import type { ExamDifficulty, ExamQuestion, QuestionType } from './types.ts';

const VALID_DIFFICULTIES = new Set<ExamDifficulty>(['Easy', 'Medium', 'Hard', 'Expert']);
const VALID_TYPES = new Set<QuestionType>([
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
]);

export function validateExamQuestion(raw: unknown): {
  valid: boolean;
  reason?: string;
  question?: ExamQuestion;
} {
  if (!raw || typeof raw !== 'object') {
    return { valid: false, reason: 'Question entry is not an object.' };
  }
  const obj = raw as Record<string, unknown>;
  const id = String(obj.id ?? '').trim();
  const questionText = String(obj.question ?? '').trim();
  const subject = String(obj.subject ?? '').trim();
  const categoryId = String(obj.categoryId ?? '').trim();
  const chapter = String(obj.chapter ?? 'Foundations').trim();
  const topic = String(obj.topic ?? subject).trim();
  const difficulty = String(obj.difficulty ?? 'Medium') as ExamDifficulty;
  const questionType = String(obj.questionType ?? 'single') as QuestionType;
  const source = String(obj.source ?? 'Career Fair Knowledge Base').trim();
  const concept = obj.concept ? String(obj.concept).trim() : undefined;
  const lastUpdated = obj.lastUpdated ? String(obj.lastUpdated).trim() : null;
  const sourceUrl = obj.sourceUrl ? String(obj.sourceUrl).trim() : null;
  const year =
    obj.year !== null && obj.year !== undefined && obj.year !== '' && !Number.isNaN(Number(obj.year))
      ? Number(obj.year)
      : null;
  const verified = obj.verified === undefined ? true : Boolean(obj.verified);

  if (!id || questionText.length < 8) {
    return { valid: false, reason: `Invalid id or short question text (${id}).` };
  }
  if (!subject || !ALLOWED_ENGINEERING_CATEGORY_IDS.has(categoryId)) {
    return { valid: false, reason: `Unknown engineering category "${categoryId}" on ${id}.` };
  }
  if (!VALID_DIFFICULTIES.has(difficulty)) {
    return { valid: false, reason: `Invalid difficulty "${difficulty}" on ${id}.` };
  }
  if (!VALID_TYPES.has(questionType)) {
    return { valid: false, reason: `Invalid questionType "${questionType}" on ${id}.` };
  }

  const expRaw = (obj.explanation ?? {}) as Record<string, unknown>;
  const why = String(expRaw.why ?? '').trim();
  const expConcept = String(expRaw.concept ?? topic).trim();
  const shortcut = String(expRaw.shortcut ?? 'Focus on core engineering principles and eliminate distractors.').trim();
  const commonTrap = String(expRaw.commonTrap ?? 'Watch for boundary conditions, units, and extreme claims.').trim();
  if (!why || !expConcept) {
    return { valid: false, reason: `Missing explanation fields on ${id}.` };
  }

  const rawOptions = Array.isArray(obj.options)
    ? obj.options.map((o) => String(o).trim()).filter(Boolean)
    : [];
  const tags = Array.isArray(obj.tags)
    ? obj.tags.map((t) => String(t).trim()).filter(Boolean)
    : [categoryId];

  let normalizedOptions = rawOptions;
  let answer: number | number[] | string;

  if (questionType === 'integer') {
    const strAns = String(obj.answer ?? '').trim();
    if (!strAns || Number.isNaN(Number(strAns))) {
      return { valid: false, reason: `Numeric question ${id} requires numeric answer.` };
    }
    normalizedOptions = [];
    answer = strAns;
  } else if (questionType === 'match') {
    const mp = obj.matchPairs as { left?: unknown[]; right?: unknown[] } | undefined;
    if (!mp || !Array.isArray(mp.left) || !Array.isArray(mp.right) || mp.left.length < 2 || mp.right.length < 2) {
      return { valid: false, reason: `Match question ${id} requires valid left/right arrays.` };
    }
    if (!Array.isArray(obj.answer) || obj.answer.length !== mp.left.length) {
      return { valid: false, reason: `Match question ${id} answer length mismatch.` };
    }
    const mappedAns = obj.answer.map(Number);
    if (mappedAns.some((idx) => Number.isNaN(idx) || idx < 0 || idx >= mp.right!.length)) {
      return { valid: false, reason: `Match question ${id} answer index out of range.` };
    }
    normalizedOptions = [];
    answer = mappedAns;
  } else if (questionType === 'multiple') {
    const uniqueOpts = [...new Set(rawOptions)];
    if (uniqueOpts.length < 2 || uniqueOpts.length !== rawOptions.length) {
      return { valid: false, reason: `Multiple-select question ${id} needs unique options.` };
    }
    if (!Array.isArray(obj.answer) || obj.answer.length === 0) {
      return { valid: false, reason: `Multiple-select question ${id} needs answer array.` };
    }
    const indices = [...new Set(obj.answer.map(Number))].sort((a, b) => a - b);
    if (indices.some((idx) => Number.isNaN(idx) || idx < 0 || idx >= rawOptions.length)) {
      return { valid: false, reason: `Multiple-select question ${id} has out-of-range answer.` };
    }
    answer = indices;
  } else if (questionType === 'truefalse') {
    if (rawOptions.length !== 2) {
      normalizedOptions = ['True', 'False'];
    }
    const numAns = Number(obj.answer);
    if (numAns !== 0 && numAns !== 1) {
      return { valid: false, reason: `True/False question ${id} needs answer 0 or 1.` };
    }
    answer = numAns;
  } else {
    const uniqueOpts = [...new Set(rawOptions)];
    if (rawOptions.length < 2 || uniqueOpts.length !== rawOptions.length) {
      return { valid: false, reason: `MCQ question ${id} needs at least 2 unique options.` };
    }
    const numAns = Number(obj.answer);
    if (!Number.isInteger(numAns) || numAns < 0 || numAns >= rawOptions.length) {
      return { valid: false, reason: `MCQ question ${id} answer index out of bounds.` };
    }
    answer = numAns;
  }

  return {
    valid: true,
    question: {
      id,
      question: questionText,
      assertion: obj.assertion ? String(obj.assertion).trim() : undefined,
      reason: obj.reason ? String(obj.reason).trim() : undefined,
      matchPairs:
        questionType === 'match'
          ? {
              left: (obj.matchPairs as { left: unknown[] }).left.map((x) => String(x).trim()),
              right: (obj.matchPairs as { right: unknown[] }).right.map((x) => String(x).trim()),
            }
          : undefined,
      imageSvg: obj.imageSvg ? String(obj.imageSvg) : undefined,
      imageCaption: obj.imageCaption ? String(obj.imageCaption).trim() : undefined,
      options: normalizedOptions,
      answer,
      explanation: {
        why,
        concept: expConcept,
        shortcut,
        commonTrap,
      },
      subject,
      categoryId,
      chapter,
      topic,
      concept,
      difficulty,
      questionType,
      source,
      sourceUrl,
      lastUpdated,
      year,
      tags,
      verified,
    },
  };
}

export function validateQuestionBank(rawItems: unknown[]): {
  validQuestions: ExamQuestion[];
  rejected: Array<{ id: string; reason: string }>;
} {
  const validQuestions: ExamQuestion[] = [];
  const rejected: Array<{ id: string; reason: string }> = [];
  const seenIds = new Set<string>();
  const seenStems = new Set<string>();

  for (const item of rawItems) {
    const check = validateExamQuestion(item);
    if (!check.valid || !check.question) {
      const id = (item as { id?: string })?.id ?? 'unknown';
      rejected.push({ id: String(id), reason: check.reason ?? 'Validation failed' });
      continue;
    }
    const q = check.question;
    const stemKey = q.question.toLowerCase().replace(/\s+/g, ' ').trim();
    if (seenIds.has(q.id)) {
      rejected.push({ id: q.id, reason: 'Duplicate question id.' });
      continue;
    }
    if (seenStems.has(stemKey)) {
      rejected.push({ id: q.id, reason: 'Duplicate question stem.' });
      continue;
    }
    seenIds.add(q.id);
    seenStems.add(stemKey);
    validQuestions.push(q);
  }

  return { validQuestions, rejected };
}

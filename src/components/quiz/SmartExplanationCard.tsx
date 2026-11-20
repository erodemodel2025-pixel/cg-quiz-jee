import React, { useState } from 'react';
import { arcadeAudio } from '../../audio/arcadeAudio.ts';
import type { ExamUserAnswer, QuestionType, SmartExplanation } from '../../../shared/types.ts';
import { PixelIcon } from '../pixel/PixelArtAssets.tsx';

interface SmartExplanationCardProps {
  isCorrect: boolean;
  isSkipped?: boolean;
  questionType: QuestionType;
  options: string[];
  matchRight?: string[];
  userAnswer: ExamUserAnswer;
  correctAnswer: number | number[] | string;
  explanation: SmartExplanation;
  source?: string;
  year?: number | null;
  defaultExpanded?: boolean;
}

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

export function formatAnswerLabel(
  type: QuestionType,
  ans: ExamUserAnswer | number | number[] | string,
  options: string[],
  matchRight?: string[]
): string {
  if (ans === null || ans === undefined || ans === '') return 'Unanswered';
  if (type === 'integer') return String(ans);
  if (type === 'multiple' && Array.isArray(ans)) {
    if (ans.length === 0) return 'Unanswered';
    return ans.map((i) => `${LETTERS[i] ?? i + 1} (${options[i] ?? ''})`).join(', ');
  }
  if (type === 'match' && Array.isArray(ans)) {
    return ans
      .map((rIdx, lIdx) =>
        rIdx >= 0
          ? `${lIdx + 1}→${LETTERS[rIdx]}${matchRight?.[rIdx] ? ` (${matchRight[rIdx]})` : ''}`
          : `${lIdx + 1}→?`
      )
      .join(' · ');
  }
  const idx = Number(ans);
  if (Number.isNaN(idx) || idx < 0) return 'Unanswered';
  return `${LETTERS[idx] ?? idx + 1} — ${options[idx] ?? ''}`;
}

export const SmartExplanationCard: React.FC<SmartExplanationCardProps> = ({
  isCorrect,
  isSkipped = false,
  questionType,
  options,
  matchRight,
  userAnswer,
  correctAnswer,
  explanation,
  source,
  year,
  defaultExpanded = true,
}) => {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div
      className={`exam-card p-4 sm:p-5 ${
        isCorrect
          ? 'border-[var(--exam-success)]'
          : isSkipped
            ? 'border-[var(--exam-warning)]'
            : 'border-[var(--exam-danger)]'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 font-pixel text-xs">
          {isCorrect ? (
            <span className="text-[var(--exam-success)] flex items-center gap-2">
              <PixelIcon name="check" size={16} /> CORRECT!
            </span>
          ) : isSkipped ? (
            <span className="text-[var(--exam-warning)] flex items-center gap-2">
              <PixelIcon name="flag" size={15} /> SKIPPED
            </span>
          ) : (
            <span className="text-[var(--exam-danger)] flex items-center gap-2">
              <PixelIcon name="close" size={15} /> NOT QUITE
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={() => {
            arcadeAudio.playSfx('click');
            setExpanded((v) => !v);
          }}
          className="font-display-pixel text-xs text-[var(--exam-accent)] hover:underline cursor-pointer"
        >
          {expanded ? 'Hide Explanation ▲' : 'Show Explanation ▼'}
        </button>
      </div>

      {/* Answer Comparison */}
      <div className="grid sm:grid-cols-2 gap-2.5 text-xs sm:text-sm mb-3">
        <div className="exam-card-subtle px-3 py-2">
          <span className="font-display-pixel text-[11px] text-[var(--exam-text-muted)]">
            YOUR PICK:{' '}
          </span>
          <span
            className={`font-semibold ${
              isCorrect ? 'text-[var(--exam-success)]' : 'text-[var(--exam-danger)]'
            }`}
          >
            {formatAnswerLabel(questionType, userAnswer, options, matchRight)}
          </span>
        </div>
        <div className="exam-card-subtle px-3 py-2">
          <span className="font-display-pixel text-[11px] text-[var(--exam-text-muted)]">
            ANSWER:{' '}
          </span>
          <span className="font-semibold text-[var(--exam-success)]">
            {formatAnswerLabel(questionType, correctAnswer, options, matchRight)}
          </span>
        </div>
      </div>

      {expanded && (
        <div className="space-y-2.5 text-sm pt-3 border-t-2 border-[var(--exam-border)]">
          <div>
            <span className="font-display-pixel text-xs font-bold text-[var(--exam-text)]">
              WHY:{' '}
            </span>
            <span className="text-[var(--exam-text-secondary)]">{explanation.why}</span>
          </div>
          <div>
            <span className="font-display-pixel text-xs font-bold text-[var(--exam-accent)]">
              CONCEPT:{' '}
            </span>
            <span className="text-[var(--exam-text-secondary)]">{explanation.concept}</span>
          </div>
          {explanation.commonTrap && (
            <div className="bg-[var(--exam-warning-soft)] border-2 border-[var(--exam-warning)] px-3 py-2 text-xs sm:text-sm">
              <span className="font-display-pixel text-xs font-bold text-[var(--exam-warning)]">
                WATCH OUT:{' '}
              </span>
              <span className="text-[var(--exam-text)]">{explanation.commonTrap}</span>
            </div>
          )}
          {explanation.shortcut && (
            <div className="bg-[var(--exam-accent-soft)] border-2 border-[var(--exam-accent)] px-3 py-2 text-xs sm:text-sm">
              <span className="font-display-pixel text-xs font-bold text-[var(--exam-accent)]">
                QUICK TIP:{' '}
              </span>
              <span className="text-[var(--exam-text)]">{explanation.shortcut}</span>
            </div>
          )}
          {source && (
            <div className="pt-1 font-code text-[11px] text-[var(--exam-text-muted)]">
              Source: {source}
              {year ? ` · ${year}` : ''}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

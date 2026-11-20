import React, { useEffect, useState } from 'react';
import { Volume2, VolumeX, Mic } from 'lucide-react';
import { arcadeAudio } from '../../audio/arcadeAudio.ts';
import {
  isSpeechRecognitionSupported,
  isSpeechSynthesisSupported,
  speakQuestion,
  stopSpeaking,
} from '../../utils/quizVoice.ts';
import type { ExamUserAnswer, PublicExamQuestion } from '../../../shared/types.ts';
import { PixelIcon } from '../pixel/PixelArtAssets.tsx';

interface QuestionRendererProps {
  question: PublicExamQuestion;
  userAnswer: ExamUserAnswer;
  onChangeAnswer: (answer: ExamUserAnswer) => void;
  disabled?: boolean;
  /** Only populated AFTER an answer is checked/submitted in immediate-feedback modes */
  revealCorrectAnswer?: number | number[] | string | null;
  isBookmarked?: boolean;
  onToggleBookmark?: () => void;
  smartBoardMode?: boolean;
  voiceListening?: boolean;
  onToggleVoiceCommand?: () => void;
}

const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

const TYPE_LABEL: Record<string, string> = {
  single: 'MCQ',
  multiple: 'Multi-Select',
  truefalse: 'True / False',
  integer: 'Numeric',
  assertion_reason: 'Assertion & Reason',
  match: 'Match',
  image: 'Diagram',
  scenario: 'Scenario',
  comparison: 'Comparison',
  career_path: 'Career Path',
};

export const QuestionRenderer: React.FC<QuestionRendererProps> = ({
  question,
  userAnswer,
  onChangeAnswer,
  disabled = false,
  revealCorrectAnswer = null,
  isBookmarked = false,
  onToggleBookmark,
  smartBoardMode = false,
  voiceListening = false,
  onToggleVoiceCommand,
}) => {
  const revealed = revealCorrectAnswer !== null && revealCorrectAnswer !== undefined;
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    setSpeaking(false);
    stopSpeaking();
    return () => {
      stopSpeaking();
    };
  }, [question.id]);

  const handleToggleSpeak = () => {
    arcadeAudio.playSfx('click');
    if (speaking) {
      stopSpeaking();
      setSpeaking(false);
      return;
    }
    const ok = speakQuestion(question, () => setSpeaking(false));
    if (ok) setSpeaking(true);
  };

  const renderChoiceBox = (opt: string, idx: number, isMulti: boolean) => {
    const selectedArr = Array.isArray(userAnswer) ? userAnswer.map(Number) : [];
    const isSelected = isMulti ? selectedArr.includes(idx) : userAnswer === idx;

    const correctArr = Array.isArray(revealCorrectAnswer)
      ? revealCorrectAnswer.map(Number)
      : typeof revealCorrectAnswer === 'number'
        ? [revealCorrectAnswer]
        : [];
    const isCorrectOption = revealed && correctArr.includes(idx);
    const isWrongChosen = revealed && isSelected && !isCorrectOption;

    let styleClass =
      'bg-[var(--exam-surface-alt)] border-[var(--exam-border)] text-[var(--exam-text)] hover:border-[var(--exam-accent)]';
    if (isSelected && !revealed) {
      styleClass =
        'bg-[var(--exam-accent-soft)] border-[var(--voxel-gold)] text-[var(--exam-text)] ring-2 ring-[var(--voxel-gold)]';
    } else if (revealed) {
      if (isCorrectOption) {
        styleClass =
          'bg-[var(--exam-success-soft)] border-[var(--exam-success)] text-[var(--exam-text)] animate-pixel-pop';
      } else if (isWrongChosen) {
        styleClass =
          'bg-[var(--exam-danger-soft)] border-[var(--exam-danger)] text-[var(--exam-text)] animate-pixel-shake';
      } else {
        styleClass =
          'bg-[var(--exam-surface-alt)] border-[var(--exam-border)] text-[var(--exam-text-muted)] opacity-75';
      }
    }

    const handleClick = () => {
      if (disabled) return;
      arcadeAudio.playSfx('click');
      if (isMulti) {
        const next = isSelected
          ? selectedArr.filter((i) => i !== idx)
          : [...selectedArr, idx].sort((a, b) => a - b);
        onChangeAnswer(next);
      } else {
        onChangeAnswer(idx);
      }
    };

    return (
      <button
        key={idx}
        type="button"
        disabled={disabled}
        onClick={handleClick}
        aria-pressed={isSelected}
        className={`voxel-tile w-full ${
          smartBoardMode ? 'min-h-[68px] px-5 py-4' : 'min-h-[54px] px-4 py-3.5'
        } text-left flex items-center gap-3.5 cursor-pointer disabled:cursor-default ${styleClass}`}
      >
        <span
          className={`${
            smartBoardMode ? 'w-11 h-11 text-sm' : 'w-9 h-9 text-xs'
          } border-2 flex items-center justify-center font-pixel shrink-0 ${
            isSelected && !revealed
              ? 'bg-[var(--voxel-gold)] text-[#0B0F1A] border-[#0B0F1A]'
              : isCorrectOption
                ? 'bg-[var(--exam-success)] text-[#07120C] border-[#0B0F1A]'
                : isWrongChosen
                  ? 'bg-[var(--exam-danger)] text-white border-[#0B0F1A]'
                  : 'bg-[var(--exam-surface)] text-[var(--exam-text)] border-[var(--exam-border)]'
          }`}
        >
          {OPTION_LETTERS[idx] ?? idx + 1}
        </span>

        <span
          className={`flex-1 font-semibold leading-snug ${
            smartBoardMode ? 'text-base sm:text-xl' : 'text-sm sm:text-base'
          }`}
        >
          {opt}
        </span>

        {isSelected && !revealed && (
          <span className="text-[var(--voxel-gold)] shrink-0">
            <PixelIcon name="check" size={smartBoardMode ? 20 : 16} />
          </span>
        )}
      </button>
    );
  };

  return (
    <div className={`exam-card ${smartBoardMode ? 'p-6 sm:p-9' : 'p-5 sm:p-7'}`}>
      {/* Compact Metadata + Voice Controls Header */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 mb-4">
        <div className="flex flex-wrap items-center gap-2 text-xs font-display-pixel">
          <span className="px-2 py-0.5 bg-[var(--exam-accent-soft)] border-2 border-[var(--exam-border)] text-[var(--exam-accent)]">
            {question.subject}
          </span>
          <span className="text-[var(--exam-text-muted)]">
            {question.topic} · {question.difficulty} · {TYPE_LABEL[question.questionType] || 'Quiz'}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isSpeechSynthesisSupported() && (
            <button
              type="button"
              onClick={handleToggleSpeak}
              aria-label={speaking ? 'Stop reading question' : 'Read question aloud'}
              className={`min-h-[38px] px-2.5 py-1.5 border-2 font-display-pixel text-xs flex items-center gap-1.5 cursor-pointer ${
                speaking
                  ? 'bg-[var(--exam-accent-soft)] border-[var(--exam-accent)] text-[var(--exam-accent)]'
                  : 'bg-[var(--exam-surface-alt)] border-[var(--exam-border)] text-[var(--exam-text-muted)] hover:text-[var(--exam-text)]'
              }`}
            >
              {speaking ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{speaking ? 'STOP' : 'READ'}</span>
            </button>
          )}

          {onToggleVoiceCommand && isSpeechRecognitionSupported() && (
            <button
              type="button"
              onClick={() => {
                arcadeAudio.playSfx('click');
                onToggleVoiceCommand();
              }}
              aria-label="Push to talk voice command"
              className={`min-h-[38px] px-2.5 py-1.5 border-2 font-display-pixel text-xs flex items-center gap-1.5 cursor-pointer ${
                voiceListening
                  ? 'bg-[var(--exam-danger-soft)] border-[var(--exam-danger)] text-[var(--exam-danger)] animate-pulse'
                  : 'bg-[var(--exam-surface-alt)] border-[var(--exam-border)] text-[var(--exam-text-muted)] hover:text-[var(--exam-text)]'
              }`}
            >
              <Mic className="w-3.5 h-3.5" />
              <span>{voiceListening ? 'LISTENING...' : 'VOICE'}</span>
            </button>
          )}

          {onToggleBookmark && (
            <button
              type="button"
              onClick={() => {
                arcadeAudio.playSfx('click');
                onToggleBookmark();
              }}
              aria-label={isBookmarked ? 'Remove bookmark' : 'Bookmark question'}
              className={`min-h-[38px] px-2.5 py-1.5 border-2 font-display-pixel text-xs flex items-center gap-1.5 cursor-pointer ${
                isBookmarked
                  ? 'bg-[var(--exam-warning-soft)] border-[var(--exam-warning)] text-[var(--exam-warning)]'
                  : 'bg-[var(--exam-surface-alt)] border-[var(--exam-border)] text-[var(--exam-text-muted)] hover:text-[var(--exam-text)]'
              }`}
            >
              <PixelIcon name="bookmark" size={13} />
              <span className="hidden sm:inline">{isBookmarked ? 'SAVED' : 'SAVE'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Highly Readable Question Prompt */}
      <h2
        className={`font-bold text-[var(--exam-text)] leading-relaxed mb-5 ${
          smartBoardMode ? 'text-xl sm:text-3xl' : 'text-lg sm:text-xl'
        }`}
      >
        {question.question}
      </h2>

      {/* Assertion / Reason Block */}
      {question.questionType === 'assertion_reason' && (
        <div className="exam-card-subtle p-4 mb-5 space-y-2.5 text-sm sm:text-base">
          <div>
            <span className="font-display-pixel text-xs font-bold text-[var(--exam-accent)] mr-2">
              ASSERTION (A):
            </span>
            <span className="text-[var(--exam-text)]">{question.assertion}</span>
          </div>
          <div>
            <span className="font-display-pixel text-xs font-bold text-[var(--exam-warning)] mr-2">
              REASON (R):
            </span>
            <span className="text-[var(--exam-text)]">{question.reason}</span>
          </div>
        </div>
      )}

      {/* Image / Diagram Block */}
      {question.questionType === 'image' && question.imageSvg && (
        <div className="mb-5 border-3 border-[var(--exam-border)] bg-slate-950 p-3">
          <div
            className="max-w-md mx-auto aspect-[360/170]"
            dangerouslySetInnerHTML={{ __html: question.imageSvg }}
          />
          {question.imageCaption && (
            <div className="text-xs text-slate-300 text-center mt-2">{question.imageCaption}</div>
          )}
        </div>
      )}

      {/* Type-Specific Interactive Inputs */}
      {question.questionType === 'integer' ? (
        <div className="space-y-2.5">
          <label
            htmlFor={`int-${question.id}`}
            className="block font-display-pixel text-xs text-[var(--exam-text-muted)]"
          >
            ENTER NUMERICAL ANSWER
          </label>
          <input
            id={`int-${question.id}`}
            type="text"
            inputMode="decimal"
            disabled={disabled}
            value={userAnswer === null || userAnswer === undefined ? '' : String(userAnswer)}
            onChange={(e) => onChangeAnswer(e.target.value)}
            placeholder="e.g. 9"
            className={`exam-input w-full sm:max-w-xs px-4 py-3 font-code font-bold ${
              smartBoardMode ? 'text-xl min-h-[60px]' : 'text-base min-h-[48px]'
            }`}
          />
          {revealed && (
            <div className="font-display-pixel text-sm text-[var(--exam-success)] pt-1">
              CORRECT ANSWER: {String(revealCorrectAnswer)}
            </div>
          )}
        </div>
      ) : question.questionType === 'match' && question.matchPairs ? (
        <div className="space-y-3">
          <div className="font-display-pixel text-xs text-[var(--exam-text-muted)]">
            MATCH LIST I TO LIST II:
          </div>
          <div className="space-y-2.5">
            {question.matchPairs.left.map((leftLabel, rowIdx) => {
              const currentArr = Array.isArray(userAnswer)
                ? [...userAnswer]
                : question.matchPairs!.left.map(() => -1);
              const selectedRight = currentArr[rowIdx] ?? -1;
              const expectedRight = Array.isArray(revealCorrectAnswer)
                ? revealCorrectAnswer[rowIdx]
                : null;
              const rowCorrect = revealed && expectedRight === selectedRight;

              return (
                <div
                  key={rowIdx}
                  className={`p-3 border-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 ${
                    revealed
                      ? rowCorrect
                        ? 'bg-[var(--exam-success-soft)] border-[var(--exam-success)]'
                        : 'bg-[var(--exam-danger-soft)] border-[var(--exam-danger)]'
                      : 'bg-[var(--exam-surface-alt)] border-[var(--exam-border)]'
                  }`}
                >
                  <div
                    className={`font-semibold text-[var(--exam-text)] ${
                      smartBoardMode ? 'text-base sm:text-lg' : 'text-sm sm:text-base'
                    }`}
                  >
                    <span className="font-code text-[var(--exam-accent)] mr-2">{rowIdx + 1}.</span>
                    {leftLabel}
                  </div>
                  <select
                    disabled={disabled}
                    value={selectedRight}
                    aria-label={`Match for ${leftLabel}`}
                    onChange={(e) => {
                      const next = [...currentArr];
                      next[rowIdx] = Number(e.target.value);
                      onChangeAnswer(next);
                    }}
                    className={`exam-input px-3 py-2 text-sm sm:w-72 ${
                      smartBoardMode ? 'min-h-[54px] text-base' : 'min-h-[48px]'
                    }`}
                  >
                    <option value={-1}>Select match...</option>
                    {question.matchPairs!.right.map((rOpt, rIdx) => (
                      <option key={rIdx} value={rIdx}>
                        {OPTION_LETTERS[rIdx]}. {rOpt}
                      </option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>
          {revealed && Array.isArray(revealCorrectAnswer) && (
            <div className="font-code text-xs text-[var(--exam-success)] pt-1">
              Correct Mapping:{' '}
              {revealCorrectAnswer
                .map((rIdx, lIdx) => `${lIdx + 1}→${OPTION_LETTERS[rIdx]}`)
                .join(' · ')}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {question.questionType === 'multiple' && (
            <div className="font-display-pixel text-xs text-[var(--exam-accent)]">
              SELECT ALL CORRECT BLOCKS:
            </div>
          )}
          {question.options.map((opt, idx) =>
            renderChoiceBox(opt, idx, question.questionType === 'multiple')
          )}
        </div>
      )}

      {/* Subtle Verified Source Transparency Line */}
      <div className="mt-5 pt-3 border-t border-[var(--exam-border)] flex flex-wrap items-center justify-between gap-2 font-code text-[11px] text-[var(--exam-text-muted)]">
        <span>
          Source: {question.source}
          {question.year ? ` (${question.year})` : ''}
        </span>
        <span>{question.lastUpdated ? `Updated ${question.lastUpdated}` : 'Verified Concept'}</span>
      </div>
    </div>
  );
};

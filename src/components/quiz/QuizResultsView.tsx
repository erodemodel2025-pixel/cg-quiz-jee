import React, { useEffect, useState } from 'react';
import { getPerformanceLevel } from '../../../shared/quizPipeline.ts';
import type { ExamResultSummary, ExamSettings } from '../../../shared/types.ts';
import { arcadeAudio, type SfxName } from '../../audio/arcadeAudio.ts';
import { useArcade } from '../../context/ArcadeContext.tsx';
import { PixelIcon, PixelIllustration, PixelMascot } from '../pixel/PixelArtAssets.tsx';
import { QuizOrb } from './QuizOrb.tsx';
import { SmartExplanationCard } from './SmartExplanationCard.tsx';

interface QuizResultsViewProps {
  result: ExamResultSummary;
  onPlayAgain: () => void;
  onRetryWrong: (wrongIds: string[]) => void;
  onPracticeSimilar: (preset: Partial<ExamSettings>) => void;
  onBackToStudio: () => void;
  onViewAnalytics: () => void;
}

const MEME_REACTIONS: Array<{ id: SfxName; label: string }> = [
  { id: 'drumRoll', label: 'Drum Roll' },
  { id: 'airhorn', label: 'Airhorn' },
  { id: 'vineBoom', label: 'Vine Boom' },
  { id: 'sadTrombone', label: 'Sad Trombone' },
  { id: 'bonk', label: 'Bonk' },
  { id: 'baDumTss', label: 'Ba-Dum-Tss' },
];

export const QuizResultsView: React.FC<QuizResultsViewProps> = ({
  result,
  onPlayAgain,
  onRetryWrong,
  onPracticeSimilar,
  onBackToStudio,
  onViewAnalytics,
}) => {
  const { bookmarkedIds, toggleBookmark, setMusicMode } = useArcade();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [filterMode, setFilterMode] = useState<'all' | 'wrong' | 'correct'>('all');

  useEffect(() => {
    if (result.accuracy === 100) {
      setMusicMode('victory');
      arcadeAudio.playSfx('airhorn');
    } else if (result.accuracy >= 60) {
      setMusicMode('victory');
      arcadeAudio.playSfx('victory');
    } else if (result.accuracy < 45) {
      setMusicMode('sad');
      arcadeAudio.playSfx('sadTrombone');
    } else {
      setMusicMode('home');
      arcadeAudio.playSfx('baDumTss');
    }
  }, [result.accuracy, result.attemptId, setMusicMode]);

  const wrongIds = result.details.filter((d) => !d.isCorrect).map((d) => d.questionId);
  const filteredDetails = result.details.filter((d) => {
    if (filterMode === 'wrong') return !d.isCorrect;
    if (filterMode === 'correct') return d.isCorrect;
    return true;
  });

  const totalQuestions =
    result.details.length || result.correctCount + result.wrongCount + result.skippedCount;

  const perf = getPerformanceLevel(result.accuracy);
  const mascotMood =
    result.accuracy >= 80 ? 'excited' : result.accuracy >= 50 ? 'happy' : 'sad';

  const topStrongTopics = [...result.topicBreakdown]
    .filter((t) => t.attempted > 0)
    .sort((a, b) => b.accuracy - a.accuracy)
    .slice(0, 3);

  const isCareerFairProfile = result.mode === 'career_fair';

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-6">
      {/* Main Celebration & Performance Card */}
      <div className="exam-card p-6 sm:p-10 text-center space-y-5">
        <div className="flex flex-wrap items-center justify-center gap-4">
          <PixelMascot mood={mascotMood} size={74} />
          <PixelIllustration
            name={result.accuracy >= 80 ? 'crown' : result.accuracy >= 50 ? 'trophy' : 'shield'}
            size={64}
            className="animate-pixel-bob"
          />
          <QuizOrb state="result" label={perf.label.toUpperCase()} />
        </div>

        <div className="space-y-2.5">
          <div className="font-display-pixel text-xs text-[var(--exam-accent)] uppercase tracking-wider">
            PERFORMANCE LEVEL · {perf.label}
          </div>
          <h1 className="font-pixel text-lg sm:text-2xl text-[var(--voxel-gold)] tracking-wide">
            {result.accuracy >= 75
              ? 'QUIZ COMPLETE!'
              : result.accuracy >= 50
                ? 'SOLID PROGRESS!'
                : 'KEEP BUILDING!'}
          </h1>

          <div className="inline-flex flex-wrap items-center justify-center gap-4 px-5 py-2.5 bg-[var(--exam-surface-alt)] border-3 border-[var(--exam-border)] font-pixel text-base sm:text-xl text-[var(--exam-text)] tabular-nums">
            <span className="flex items-center gap-2">
              <span className="text-[var(--voxel-gold)]">
                <PixelIcon name="score" size={18} />
              </span>
              {result.correctCount} / {totalQuestions}
            </span>
            <span className="text-sm text-[var(--exam-success)]">{result.accuracy}%</span>
            <span className="text-sm text-[var(--exam-text-secondary)]">
              {result.score}/{result.maxScore} pts
            </span>
            <span className="text-sm text-[var(--exam-accent)]">+{result.xpEarned} XP</span>
          </div>

          <p className="font-display-pixel text-sm sm:text-base text-[var(--exam-text-secondary)] max-w-2xl mx-auto">
            {perf.encouragement}
          </p>
        </div>

        {/* Career Fair Mode Engineering Profile Highlight */}
        {isCareerFairProfile && (
          <div className="exam-card-subtle p-4 text-left space-y-2 max-w-2xl mx-auto">
            <div className="font-display-pixel text-xs font-bold text-[var(--exam-success)]">
              YOUR ENGINEERING PROFILE
            </div>
            <p className="text-sm text-[var(--exam-text)] leading-relaxed">
              {topStrongTopics.length > 0
                ? `Strongest spark observed in ${topStrongTopics
                    .map((t) => `${t.topic} (${t.accuracy}%)`)
                    .join(', ')}. Keep exploring real projects in these domains!`
                : 'You explored multiple engineering branches! Pick any branch card in Quiz Studio to dive deeper.'}
            </p>
          </div>
        )}

        {/* Topic Accuracy Visual Bars */}
        {result.topicBreakdown.length > 0 && (
          <div className="text-left max-w-2xl mx-auto space-y-2 pt-2">
            <div className="font-display-pixel text-[11px] text-[var(--exam-text-muted)]">
              TOPIC STRENGTH SNAPSHOT
            </div>
            <div className="grid sm:grid-cols-2 gap-2.5">
              {result.topicBreakdown.slice(0, 6).map((t) => (
                <div
                  key={`${t.subject}-${t.topic}`}
                  className="exam-card-subtle px-3 py-2 space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-semibold text-[var(--exam-text)] truncate">
                      {t.topic}
                    </span>
                    <span className="font-code text-[var(--exam-text-secondary)] tabular-nums shrink-0">
                      {t.correct}/{t.attempted || 1} ({t.accuracy}%)
                    </span>
                  </div>
                  <div className="h-2 w-full bg-[var(--exam-bg)] border border-[var(--exam-border)]">
                    <div
                      className="h-full transition-all"
                      style={{
                        width: `${Math.max(4, t.accuracy)}%`,
                        backgroundColor:
                          t.accuracy >= 75
                            ? 'var(--exam-success)'
                            : t.accuracy >= 50
                              ? 'var(--voxel-gold)'
                              : 'var(--exam-danger)',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Playful Meme Soundboard Reaction Row */}
        <div className="flex flex-wrap items-center justify-center gap-1.5 pt-1">
          {MEME_REACTIONS.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => arcadeAudio.playSfx(m.id)}
              className="min-h-[38px] px-2.5 py-1.5 border-2 border-[var(--exam-border)] bg-[var(--exam-surface-alt)] hover:border-[var(--voxel-gold)] font-display-pixel text-[11px] text-[var(--exam-text-secondary)] hover:text-[var(--exam-text)] cursor-pointer"
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col items-center gap-3 pt-2">
          <div className="flex flex-wrap items-center justify-center gap-3 w-full">
            <button
              type="button"
              onClick={() => {
                arcadeAudio.playSfx('gameStart');
                onPlayAgain();
              }}
              className="exam-btn exam-btn-primary px-7 py-3.5 text-sm sm:text-base min-h-[50px]"
            >
              <PixelIcon name="play" size={16} /> PLAY AGAIN
            </button>

            {wrongIds.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  arcadeAudio.playSfx('click');
                  onPracticeSimilar({
                    mode: 'revision',
                    questionCount: Math.max(5, wrongIds.length),
                  });
                }}
                className="exam-btn exam-btn-gold px-5 py-3.5 text-xs sm:text-sm min-h-[50px]"
              >
                <PixelIcon name="refresh" size={15} /> PRACTICE MISTAKES ({wrongIds.length})
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                arcadeAudio.playSfx('click');
                onPracticeSimilar({
                  mode: perf.suggestedNextMode,
                  categoryId: result.nextRecommendation.categoryId,
                  subject: result.nextRecommendation.subject,
                  difficulty: result.nextRecommendation.difficulty,
                });
              }}
              className="exam-btn exam-btn-secondary px-5 py-3.5 text-xs sm:text-sm min-h-[50px]"
            >
              <PixelIcon name="target" size={15} />{' '}
              {result.accuracy >= 80
                ? 'TRY CHALLENGE MODE'
                : result.accuracy < 45
                  ? 'START CAREER FAIR BASICS'
                  : 'PRACTICE WEAK TOPICS'}
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-5 pt-1">
            <button
              type="button"
              onClick={() => {
                arcadeAudio.playSfx('click');
                setDetailsOpen((v) => !v);
              }}
              className="font-display-pixel text-xs sm:text-sm text-[var(--exam-accent)] hover:underline cursor-pointer min-h-[40px]"
            >
              {detailsOpen ? 'HIDE FULL BREAKDOWN ▲' : 'REVIEW QUESTIONS & SOURCES ▼'}
            </button>

            <button
              type="button"
              onClick={() => {
                arcadeAudio.playSfx('click');
                onBackToStudio();
              }}
              className="font-display-pixel text-xs sm:text-sm text-[var(--exam-text-secondary)] hover:text-[var(--exam-text)] hover:underline cursor-pointer min-h-[40px]"
            >
              Back to Topics
            </button>
          </div>
        </div>
      </div>

      {/* Expandable Diagnostic Breakdown & Explanations */}
      {detailsOpen && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div className="exam-card p-3.5">
              <div className="font-display-pixel text-[11px] text-[var(--exam-text-muted)]">ACCURACY</div>
              <div className="font-pixel text-base text-[var(--exam-success)] mt-1 tabular-nums">
                {result.accuracy}%
              </div>
            </div>
            <div className="exam-card p-3.5">
              <div className="font-display-pixel text-[11px] text-[var(--exam-text-muted)]">SCORE</div>
              <div className="font-pixel text-base text-[var(--exam-text)] mt-1 tabular-nums">
                {result.score}/{result.maxScore}
              </div>
            </div>
            <div className="exam-card p-3.5">
              <div className="font-display-pixel text-[11px] text-[var(--exam-text-muted)]">AVG TIME</div>
              <div className="font-pixel text-base text-[var(--exam-text)] mt-1 tabular-nums">
                {result.avgTimePerQuestion}s
              </div>
            </div>
            <div className="exam-card p-3.5">
              <div className="font-display-pixel text-[11px] text-[var(--exam-text-muted)]">
                {result.rank ? 'RANK' : 'XP EARNED'}
              </div>
              <div className="font-pixel text-base text-[var(--voxel-gold)] mt-1 tabular-nums">
                {result.rank ? `#${result.rank}` : `+${result.xpEarned}`}
              </div>
            </div>
          </div>

          <div className="exam-card p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2.5">
              {wrongIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => onRetryWrong(wrongIds)}
                  className="exam-btn exam-btn-gold text-xs min-h-[44px]"
                >
                  <PixelIcon name="refresh" size={14} /> Retry Exact Missed ({wrongIds.length})
                </button>
              )}
              <button
                type="button"
                onClick={() =>
                  onPracticeSimilar({
                    mode: 'weak',
                    categoryId: result.nextRecommendation.categoryId,
                    subject: result.nextRecommendation.subject,
                    difficulty: result.nextRecommendation.difficulty,
                  })
                }
                className="exam-btn exam-btn-secondary text-xs min-h-[44px]"
              >
                <PixelIcon name="target" size={14} /> Practice Weak Concepts
              </button>
            </div>

            <button
              type="button"
              onClick={onViewAnalytics}
              className="font-display-pixel text-xs text-[var(--exam-accent)] hover:underline cursor-pointer"
            >
              View Full Analytics →
            </button>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="exam-card p-5 space-y-3">
              <h2 className="font-display-pixel text-xs font-bold text-[var(--exam-success)] flex items-center gap-2">
                <PixelIcon name="check" size={15} /> WHAT YOU DID WELL
              </h2>
              <ul className="space-y-2 text-sm text-[var(--exam-text-secondary)]">
                {result.didWell.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-[var(--exam-success)] font-bold">▪</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="exam-card p-5 space-y-3">
              <h2 className="font-display-pixel text-xs font-bold text-[var(--exam-warning)] flex items-center gap-2">
                <PixelIcon name="target" size={15} /> NEXT LEVEL FOCUS
              </h2>
              <ul className="space-y-2 text-sm text-[var(--exam-text-secondary)]">
                {result.needsImprovement.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-[var(--exam-warning)] font-bold">▪</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display-pixel text-sm font-bold text-[var(--exam-text)]">
                QUESTION BREAKDOWN ({filteredDetails.length})
              </h2>
              <div className="flex gap-2 text-xs">
                {(
                  [
                    { id: 'all', label: `All (${result.details.length})` },
                    { id: 'wrong', label: `Missed (${result.details.length - result.correctCount})` },
                    { id: 'correct', label: `Correct (${result.correctCount})` },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setFilterMode(tab.id)}
                    className={`min-h-[40px] px-3 py-1.5 border-2 font-display-pixel cursor-pointer ${
                      filterMode === tab.id
                        ? 'bg-[var(--exam-accent)] text-[#0B0F1A] border-[#0B0F1A]'
                        : 'bg-[var(--exam-surface)] border-[var(--exam-border)] text-[var(--exam-text-secondary)]'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {filteredDetails.map((d, idx) => {
              const isSaved = bookmarkedIds.includes(d.questionId);
              return (
                <div key={d.questionId} className="space-y-2">
                  <div className="flex items-start justify-between gap-3 px-1">
                    <div className="text-sm font-semibold text-[var(--exam-text)]">
                      <span className="font-code text-[var(--exam-text-muted)] mr-2">
                        #{idx + 1} · {d.speedClass} · {(d.timeMs / 1000).toFixed(1)}s
                      </span>
                      {d.question}
                    </div>
                    <button
                      type="button"
                      onClick={() => void toggleBookmark(d.questionId)}
                      className={`p-2 min-h-[40px] min-w-[40px] flex items-center justify-center border-2 text-xs shrink-0 cursor-pointer ${
                        isSaved
                          ? 'border-[var(--exam-warning)] text-[var(--exam-warning)]'
                          : 'border-[var(--exam-border)] text-[var(--exam-text-muted)]'
                      }`}
                      aria-label="Toggle bookmark"
                    >
                      <PixelIcon name="bookmark" size={14} />
                    </button>
                  </div>
                  <SmartExplanationCard
                    isCorrect={d.isCorrect}
                    isSkipped={d.isSkipped}
                    questionType={d.questionType}
                    options={d.options}
                    matchRight={d.matchPairs?.right}
                    userAnswer={d.userAnswer}
                    correctAnswer={d.correctAnswer}
                    explanation={d.explanation}
                    source={d.source}
                    year={d.year}
                    defaultExpanded={!d.isCorrect}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

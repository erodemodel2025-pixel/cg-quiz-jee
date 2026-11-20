import React, { useState } from 'react';
import {
  Award,
  CheckCircle2,
  Clock,
  Crown,
  MinusCircle,
  RotateCcw,
  ShieldCheck,
  SlidersHorizontal,
  Trophy,
  XCircle,
} from 'lucide-react';
import { DIFFICULTY_MAP } from '../../../shared/smartQuestionBank.ts';
import type { GameLeaderboardView, GameResultPayload } from '../../../shared/types.ts';
import { arcadeAudio } from '../../audio/arcadeAudio.ts';
import { AnimatedPodium } from './AnimatedPodium.tsx';

interface GamePodiumResultsProps {
  result: GameResultPayload;
  onPlayAgain: () => void;
  onChangeSettings: () => void;
  onOpenLeaderboard: () => void;
}

function formatTimeTaken(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return m > 0 ? `${m}m ${rem}s` : `${rem}s`;
}

export const GamePodiumResults: React.FC<GamePodiumResultsProps> = ({
  result,
  onPlayAgain,
  onChangeSettings,
  onOpenLeaderboard,
}) => {
  const [podiumView, setPodiumView] = useState<GameLeaderboardView>('highest');
  const diffCfg = DIFFICULTY_MAP[result.difficulty] || DIFFICULTY_MAP.easy;

  const activeTop3 = podiumView === 'highest' ? result.top3Highest : result.top3Overall;
  const activeCurrentUserEntry =
    podiumView === 'highest' ? result.currentUserHighestEntry : result.currentUserOverallEntry;
  const activeRank = podiumView === 'highest' ? result.highestRank : result.overallRank;
  const enteredTop3 =
    podiumView === 'highest' ? result.enteredTop3Highest : result.enteredTop3Overall;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Header Summary Card */}
      <section className="studio-card p-6 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--studio-border)] pb-5">
          <div>
            <div className="font-mono-tech text-xs font-bold uppercase tracking-wider text-[var(--studio-emerald-text)] flex items-center gap-2">
              <ShieldCheck size={15} /> Score Verified &amp; Saved to Database
            </div>
            <h1 className="font-heading font-bold text-2xl sm:text-3xl text-[var(--studio-text)] mt-1">
              {result.username} — Final Match Report
            </h1>
            <p className="text-xs sm:text-sm text-[var(--studio-text-secondary)] mt-1">
              {diffCfg.name} (+{result.marksPerCorrect} pts / correct · 0 wrong · 0 unanswered)
            </p>
          </div>

          <div className="flex flex-col sm:items-end gap-1">
            <div className="px-4 py-2 rounded-xl bg-[#D97706] text-white font-heading font-bold text-2xl sm:text-3xl tabular-nums shadow-md">
              {result.score} pts
            </div>
            <div className="font-mono-tech text-xs font-bold text-[var(--studio-accent-text)]">
              +{result.xpEarned} XP Earned
              {result.leveledUp && ' · LEVEL UP!'}
            </div>
          </div>
        </div>

        {/* All 8 Required Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3.5 studio-well">
            <div className="font-mono-tech text-[11px] font-bold text-[var(--studio-text-muted)]">
              PLAYER USERNAME
            </div>
            <div className="font-sora font-bold text-base text-[var(--studio-text)] mt-1 truncate">
              {result.username}
            </div>
          </div>

          <div className="p-3.5 studio-well">
            <div className="font-mono-tech text-[11px] font-bold text-[var(--studio-text-muted)]">
              TOTAL POINTS
            </div>
            <div className="font-heading font-bold text-2xl text-[var(--studio-amber-text)] mt-0.5 tabular-nums">
              {result.score}{' '}
              <span className="text-xs font-mono-tech text-[var(--studio-text-muted)]">
                / {result.maxPossibleScore}
              </span>
            </div>
          </div>

          <div className="p-3.5 studio-well">
            <div className="font-mono-tech text-[11px] font-bold text-[var(--studio-text-muted)]">
              ACCURACY %
            </div>
            <div className="font-heading font-bold text-2xl text-[var(--studio-accent-text)] mt-0.5 tabular-nums">
              {result.accuracy}%
            </div>
          </div>

          <div className="p-3.5 studio-well">
            <div className="font-mono-tech text-[11px] font-bold text-[var(--studio-text-muted)]">
              LEADERBOARD RANK
            </div>
            <div className="font-heading font-bold text-2xl text-[var(--studio-purple-text)] mt-0.5 tabular-nums">
              {activeRank ? `#${activeRank}` : 'Unranked'}
              {result.totalRankedPlayers > 0 && (
                <span className="text-xs font-mono-tech text-[var(--studio-text-muted)]">
                  {' '}
                  / {result.totalRankedPlayers}
                </span>
              )}
            </div>
          </div>

          <div className="p-3.5 studio-well flex items-center justify-between gap-2">
            <div>
              <div className="font-mono-tech text-[11px] font-bold text-[var(--studio-text-muted)]">
                CORRECT
              </div>
              <div className="font-heading font-bold text-xl text-[var(--studio-emerald-text)] tabular-nums">
                {result.correctAnswers}
              </div>
            </div>
            <CheckCircle2 size={20} className="text-[var(--studio-emerald-text)] shrink-0" />
          </div>

          <div className="p-3.5 studio-well flex items-center justify-between gap-2">
            <div>
              <div className="font-mono-tech text-[11px] font-bold text-[var(--studio-text-muted)]">
                INCORRECT
              </div>
              <div className="font-heading font-bold text-xl text-[#FB7185] tabular-nums">
                {result.incorrectAnswers}
              </div>
            </div>
            <XCircle size={20} className="text-[#FB7185] shrink-0" />
          </div>

          <div className="p-3.5 studio-well flex items-center justify-between gap-2">
            <div>
              <div className="font-mono-tech text-[11px] font-bold text-[var(--studio-text-muted)]">
                UNANSWERED
              </div>
              <div className="font-heading font-bold text-xl text-[var(--studio-text-secondary)] tabular-nums">
                {result.unanswered}
              </div>
            </div>
            <MinusCircle size={20} className="text-[var(--studio-text-muted)] shrink-0" />
          </div>

          <div className="p-3.5 studio-well flex items-center justify-between gap-2">
            <div>
              <div className="font-mono-tech text-[11px] font-bold text-[var(--studio-text-muted)]">
                TIME TAKEN
              </div>
              <div className="font-heading font-bold text-xl text-[var(--studio-text)] tabular-nums">
                {formatTimeTaken(result.completionTime)}
              </div>
            </div>
            <Clock size={20} className="text-[var(--studio-accent-text)] shrink-0" />
          </div>
        </div>
      </section>

      {/* LIVE DATABASE ANIMATED PODIUM */}
      <section className="studio-card-solid p-6 sm:p-8 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-heading font-bold text-xl text-[var(--studio-text)] flex items-center gap-2">
              <Crown size={20} className="text-[var(--studio-amber-text)]" />
              Live Championship Podium
            </h2>
            <p className="text-xs text-[var(--studio-text-secondary)] mt-0.5">
              Updated automatically from the verified database immediately after saving your run.
            </p>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                arcadeAudio.playSfx('click');
                setPodiumView('highest');
              }}
              className={`studio-btn text-xs px-3.5 py-1.5 min-h-[36px] ${
                podiumView === 'highest' ? 'studio-btn-primary' : 'studio-btn-ghost'
              }`}
            >
              Highest Single Score
            </button>
            <button
              type="button"
              onClick={() => {
                arcadeAudio.playSfx('click');
                setPodiumView('overall');
              }}
              className={`studio-btn text-xs px-3.5 py-1.5 min-h-[36px] ${
                podiumView === 'overall' ? 'studio-btn-cyan' : 'studio-btn-ghost'
              }`}
            >
              Overall Performance
            </button>
          </div>
        </div>

        <AnimatedPodium
          top3={activeTop3}
          currentUserId={result.userId}
          currentUserEntry={activeCurrentUserEntry}
          metricLabel={podiumView === 'highest' ? 'Best Game' : 'Total Points'}
          totalPlayers={result.totalRankedPlayers}
          enteredTop3={enteredTop3}
        />

        {/* Action Bar */}
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2 border-t border-[var(--studio-border)]">
          <button
            type="button"
            onClick={() => {
              arcadeAudio.playSfx('gameStart');
              onPlayAgain();
            }}
            className="studio-btn studio-btn-primary text-xs sm:text-sm px-6"
          >
            <RotateCcw size={15} />
            <span>Play Same Settings Again</span>
          </button>

          <button
            type="button"
            onClick={() => {
              arcadeAudio.playSfx('click');
              onChangeSettings();
            }}
            className="studio-btn studio-btn-ghost text-xs sm:text-sm px-5"
          >
            <SlidersHorizontal size={15} />
            <span>Change Difficulty / Topic</span>
          </button>

          <button
            type="button"
            onClick={() => {
              arcadeAudio.playSfx('click');
              onOpenLeaderboard();
            }}
            className="studio-btn studio-btn-amber text-xs sm:text-sm px-5"
          >
            <Trophy size={15} />
            <span>Full Leaderboard</span>
          </button>
        </div>
      </section>

      {/* Concept & Explanation Breakdown */}
      <section className="studio-card-solid p-5 sm:p-6 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-heading font-bold text-lg text-[var(--studio-text)] flex items-center gap-2">
            <Award size={18} className="text-[var(--studio-accent-text)]" /> Question-by-Question Review
          </h2>
          <span className="font-mono-tech text-xs text-[var(--studio-text-muted)]">
            {result.details.length} Questions
          </span>
        </div>

        <div className="space-y-3">
          {result.details.map((item, idx) => (
            <div key={item.questionId} className="p-4 rounded-xl studio-well space-y-1.5">
              <div className="flex items-start justify-between gap-3">
                <div className="font-sora font-bold text-sm text-[var(--studio-text)]">
                  {idx + 1}. {item.question}
                </div>
                <span
                  className={`font-mono-tech text-xs font-bold px-2.5 py-0.5 rounded shrink-0 ${
                    item.isCorrect
                      ? 'bg-[#059669] text-white'
                      : item.isUnanswered
                        ? 'bg-[#475569] text-white'
                        : 'bg-[#DC2626] text-white'
                  }`}
                >
                  {item.isCorrect
                    ? `+${item.pointsAwarded} PTS`
                    : item.isUnanswered
                      ? 'UNANSWERED (0)'
                      : 'WRONG (0)'}
                </span>
              </div>

              <div className="text-xs font-semibold text-[var(--studio-emerald-text)]">
                Correct Answer: {item.options[item.correctIndex]}
              </div>
              {!item.isCorrect && !item.isUnanswered && (
                <div className="text-xs font-semibold text-[#FB7185]">
                  Your Answer: {item.options[item.selectedIndex]}
                </div>
              )}
              <p className="text-xs sm:text-sm text-[var(--studio-text-secondary)] leading-relaxed">
                {item.explanation}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

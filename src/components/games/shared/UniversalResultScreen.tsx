import React from 'react';
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Award,
  Home,
  Lightbulb,
  RotateCcw,
  Sparkles,
  Trophy,
} from 'lucide-react';
import type { PlaygroundResultPayload } from '../../../../shared/types.ts';
import { arcadeAudio } from '../../../audio/arcadeAudio.ts';

interface UniversalResultScreenProps {
  title: string;
  result: PlaygroundResultPayload;
  rankUnavailable?: boolean;
  statusNote?: string | null;
  primaryMetricLabel?: string;
  primaryMetricValue?: string;
  onPlayAgain: () => void;
  onNextChallenge?: () => void;
  nextChallengeLabel?: string;
  onLeaderboard: () => void;
  onHome: () => void;
}

export const UniversalResultScreen: React.FC<UniversalResultScreenProps> = ({
  title,
  result,
  rankUnavailable,
  statusNote,
  primaryMetricLabel,
  primaryMetricValue,
  onPlayAgain,
  onNextChallenge,
  nextChallengeLabel,
  onLeaderboard,
  onHome,
}) => {
  const rankDelta =
    result.prevGameRank !== null && result.gameRank !== null
      ? result.prevGameRank - result.gameRank
      : null;

  const isTop1 = result.gameRank === 1 || result.globalRank === 1;
  const isTop10 =
    !isTop1 &&
    ((result.gameRank !== null && result.gameRank <= 10) ||
      (result.globalRank !== null && result.globalRank <= 10));

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 sm:py-8">
      <div className="studio-card-solid border-2 border-[var(--studio-border-strong)] p-5 sm:p-7 space-y-5">
        {/* Top Celebration Strip (Zero Fake Ranks) */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--studio-border)] pb-4">
          <div>
            <div className="font-mono-tech text-xs font-bold text-[var(--studio-accent-text)] uppercase">
              {title} · Run Summary
            </div>
            <h2 className="font-heading text-2xl sm:text-3xl font-bold text-[var(--studio-text)] mt-0.5">
              {result.won ? 'Challenge Complete' : 'Run Recorded'}
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {result.isPersonalBest && (
              <span className="px-2.5 py-1 rounded-md bg-[#F59E0B] text-black font-mono-tech text-xs font-bold inline-flex items-center gap-1">
                <Sparkles size={13} />
                NEW PERSONAL BEST!
              </span>
            )}
            {isTop1 && (
              <span className="px-2.5 py-1 rounded-md bg-[#FACC15] text-black font-mono-tech text-xs font-bold inline-flex items-center gap-1">
                <Trophy size={13} />
                YOU&apos;RE #1!
              </span>
            )}
            {isTop10 && (
              <span className="px-2.5 py-1 rounded-md bg-[#0EA5E9] text-white font-mono-tech text-xs font-bold inline-flex items-center gap-1">
                <Award size={13} />
                TOP 10!
              </span>
            )}
          </div>
        </div>

        {/* Core Score & Telemetry Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="studio-well p-3.5 rounded-xl">
            <div className="font-mono-tech text-[11px] font-bold text-[var(--studio-text-muted)] uppercase">
              Final Score
            </div>
            <div className="font-heading text-2xl font-bold text-[var(--studio-accent-text)] tabular-nums mt-0.5">
              {result.score.toLocaleString()}
            </div>
            {result.previousBestScore !== null && (
              <div className="font-mono-tech text-[11px] text-[var(--studio-text-secondary)] mt-0.5">
                Prev PB: {result.previousBestScore.toLocaleString()}
              </div>
            )}
          </div>

          <div className="studio-well p-3.5 rounded-xl">
            <div className="font-mono-tech text-[11px] font-bold text-[var(--studio-text-muted)] uppercase">
              {primaryMetricLabel || 'Time Taken'}
            </div>
            <div className="font-heading text-2xl font-bold text-[var(--studio-text)] tabular-nums mt-0.5">
              {primaryMetricValue || `${(result.completionTimeMs / 1000).toFixed(2)}s`}
            </div>
            <div className="font-mono-tech text-[11px] text-[var(--studio-text-secondary)] mt-0.5">
              Clock: {(result.completionTimeMs / 1000).toFixed(1)}s
            </div>
          </div>

          <div className="studio-well p-3.5 rounded-xl">
            <div className="font-mono-tech text-[11px] font-bold text-[var(--studio-text-muted)] uppercase">
              Accuracy
            </div>
            <div className="font-heading text-2xl font-bold text-[var(--studio-emerald-text)] tabular-nums mt-0.5">
              {result.accuracy.toFixed(0)}%
            </div>
            <div className="font-mono-tech text-[11px] text-[var(--studio-text-secondary)] mt-0.5">
              {result.xpEarned > 0 ? `+${result.xpEarned} XP Earned` : 'Practice Run'}
            </div>
          </div>

          <div className="studio-well p-3.5 rounded-xl col-span-2 sm:col-span-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="font-mono-tech text-[11px] font-bold text-[var(--studio-text-muted)] uppercase">
                Verified Leaderboard Standing
              </div>
              {rankUnavailable || result.gameRank === null ? (
                <div className="font-sora text-sm font-semibold text-[var(--studio-text-secondary)] mt-0.5">
                  {statusNote || 'Leaderboard data unavailable'}
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-3 mt-0.5">
                  <span className="font-heading text-xl font-bold text-[var(--studio-text)] tabular-nums">
                    Game Rank #{result.gameRank}
                    {result.totalGamePlayers > 0 ? ` / ${result.totalGamePlayers}` : ''}
                  </span>
                  {result.globalRank !== null && (
                    <span className="font-mono-tech text-xs text-[var(--studio-accent-text)]">
                      Global Playground #{result.globalRank}
                    </span>
                  )}
                  {rankDelta !== null && rankDelta !== 0 && (
                    <span
                      className={`font-mono-tech text-xs font-bold inline-flex items-center gap-0.5 ${
                        rankDelta > 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {rankDelta > 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                      {rankDelta > 0 ? `↑ ${rankDelta}` : `↓ ${Math.abs(rankDelta)}`}
                    </span>
                  )}
                </div>
              )}
            </div>
            {result.leveledUp && result.player && (
              <div className="px-3 py-1.5 rounded-lg bg-[#2563EB] text-white font-mono-tech text-xs font-bold">
                LEVEL UP · LVL {result.player.level} ({result.player.title})
              </div>
            )}
          </div>
        </div>

        {/* Unlocked Achievements */}
        {result.unlockedAchievements.length > 0 && (
          <div className="p-3 rounded-xl border border-amber-500/40 bg-amber-500/10">
            <div className="font-mono-tech text-xs font-bold text-[var(--studio-amber-text)] mb-1">
              Unlocked Achievements: {result.unlockedAchievements.join(' · ').toUpperCase()}
            </div>
          </div>
        )}

        {/* Engineering Fun Fact */}
        <div className="p-3.5 rounded-xl bg-[var(--studio-surface-2)] border border-[var(--studio-border)] flex items-start gap-2.5">
          <Lightbulb size={18} className="text-[var(--studio-amber-text)] shrink-0 mt-0.5" />
          <div className="text-xs sm:text-sm text-[var(--studio-text-secondary)]">
            <span className="font-sora font-bold text-[var(--studio-text)]">Engineering Fact: </span>
            {result.funFact}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
          <button
            type="button"
            onClick={() => {
              arcadeAudio.playSfx('click');
              onPlayAgain();
            }}
            className="studio-btn studio-btn-primary text-xs sm:text-sm px-3 py-2.5 min-h-[44px]"
          >
            <RotateCcw size={15} />
            <span>PLAY AGAIN</span>
          </button>

          {onNextChallenge && (
            <button
              type="button"
              onClick={() => {
                arcadeAudio.playSfx('click');
                onNextChallenge();
              }}
              className="studio-btn studio-btn-cyan text-xs sm:text-sm px-3 py-2.5 min-h-[44px]"
            >
              <span>{nextChallengeLabel || 'NEXT GAME'}</span>
              <ArrowRight size={15} />
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              arcadeAudio.playSfx('click');
              onLeaderboard();
            }}
            className="studio-btn studio-btn-ghost text-xs sm:text-sm px-3 py-2.5 min-h-[44px]"
          >
            <Trophy size={15} />
            <span>LEADERBOARD</span>
          </button>

          <button
            type="button"
            onClick={() => {
              arcadeAudio.playSfx('click');
              onHome();
            }}
            className="studio-btn studio-btn-ghost text-xs sm:text-sm px-3 py-2.5 min-h-[44px]"
          >
            <Home size={15} />
            <span>HOME</span>
          </button>
        </div>
      </div>
    </div>
  );
};

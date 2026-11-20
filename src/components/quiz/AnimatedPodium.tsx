import React from 'react';
import { Award, Crown, Medal, Shield, Sparkles } from 'lucide-react';
import type { GameLeaderboardEntry } from '../../../shared/types.ts';

interface AnimatedPodiumProps {
  top3: GameLeaderboardEntry[];
  currentUserId?: string | null;
  currentUserEntry?: GameLeaderboardEntry | null;
  metricLabel?: string;
  totalPlayers?: number;
  enteredTop3?: boolean;
  emptyActionLabel?: string;
  onEmptyAction?: () => void;
}

export const AnimatedPodium: React.FC<AnimatedPodiumProps> = ({
  top3,
  currentUserId,
  currentUserEntry,
  metricLabel = 'Points',
  totalPlayers = 0,
  enteredTop3 = false,
  emptyActionLabel,
  onEmptyAction,
}) => {
  const first = top3.find((p) => p.rank === 1) || top3[0] || null;
  const second = top3.find((p) => p.rank === 2) || top3[1] || null;
  const third = top3.find((p) => p.rank === 3) || top3[2] || null;

  const isMe = (entry: GameLeaderboardEntry | null) =>
    Boolean(entry && currentUserId && entry.userId === currentUserId);

  const showSeparateRankRow =
    Boolean(currentUserEntry) && (currentUserEntry!.rank > 3 || !top3.some((p) => p.userId === currentUserEntry!.userId));

  return (
    <div className="space-y-5">
      {enteredTop3 && (
        <div className="p-3.5 rounded-xl bg-[#059669] border-2 border-[#34D399] text-white flex items-center justify-center gap-2.5 text-center shadow-lg animate-pulse">
          <Sparkles size={18} className="shrink-0" />
          <span className="font-heading font-bold text-sm sm:text-base">
            Congratulations! You climbed onto the Championship Podium!
          </span>
        </div>
      )}

      {top3.length === 0 ? (
        <div className="p-8 rounded-xl studio-well border border-[var(--studio-border-strong)] text-center space-y-3">
          <Crown size={36} className="mx-auto text-[var(--studio-amber-text)]" />
          <div className="font-heading font-bold text-lg text-[var(--studio-text)]">
            Podium Awaits Its First Champion
          </div>
          <p className="text-xs sm:text-sm text-[var(--studio-text-secondary)] max-w-md mx-auto">
            Complete a verified quiz round to claim #1 Gold on the real database podium.
          </p>
          {emptyActionLabel && onEmptyAction && (
            <button
              type="button"
              onClick={onEmptyAction}
              className="studio-btn studio-btn-primary text-xs px-5"
            >
              {emptyActionLabel}
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-3 items-end gap-3 sm:gap-5 max-w-3xl mx-auto pt-4">
          {/* 2ND PLACE – SILVER */}
          <div className="flex flex-col items-center text-center transition-all duration-500">
            <div className="mb-1.5 flex items-center gap-1">
              <Medal size={26} className="text-[#CBD5E1]" />
            </div>
            <div
              className={`font-sora text-xs sm:text-sm font-bold truncate max-w-full px-2 py-0.5 rounded ${
                isMe(second)
                  ? 'bg-[#2563EB] text-white'
                  : 'text-[var(--studio-text)]'
              }`}
              title={second?.username}
            >
              {second ? `${second.username}${isMe(second) ? ' (You)' : ''}` : 'Open #2'}
            </div>
            <div className="font-mono-tech text-xs font-bold text-[var(--studio-text-secondary)] mt-0.5 mb-2 tabular-nums">
              {second ? `${second.score} pts` : '—'}
            </div>
            <div
              className={`w-full h-24 sm:h-28 rounded-t-xl border-2 text-white flex flex-col items-center justify-center shadow-md transition-all duration-500 ${
                isMe(second)
                  ? 'bg-[#334155] border-[#60A5FA] ring-2 ring-[#38BDF8]'
                  : 'bg-[#475569] border-[#94A3B8]'
              }`}
            >
              <span className="font-heading font-bold text-xl sm:text-2xl">🥈 #2</span>
              <span className="font-mono-tech text-[10px] font-bold tracking-wider uppercase">
                SILVER
              </span>
              {second && (
                <span className="font-mono-tech text-[10px] opacity-90 mt-0.5">
                  {second.accuracy}% ACC
                </span>
              )}
            </div>
          </div>

          {/* 1ST PLACE – GOLD */}
          <div className="flex flex-col items-center text-center transition-all duration-500">
            <div className="mb-1.5">
              <Crown size={34} className="text-[#FBBF24]" />
            </div>
            <div
              className={`font-sora text-xs sm:text-base font-bold truncate max-w-full px-2.5 py-0.5 rounded ${
                isMe(first)
                  ? 'bg-[#059669] text-white'
                  : 'text-[var(--studio-amber-text)]'
              }`}
              title={first?.username}
            >
              {first ? `${first.username}${isMe(first) ? ' (You)' : ''}` : 'Open #1'}
            </div>
            <div className="font-mono-tech text-xs sm:text-sm font-bold text-[var(--studio-emerald-text)] mt-0.5 mb-2 tabular-nums">
              {first ? `${first.score} pts` : '—'}
            </div>
            <div
              className={`w-full h-32 sm:h-36 rounded-t-xl border-2 text-white flex flex-col items-center justify-center shadow-xl transition-all duration-500 ${
                isMe(first)
                  ? 'bg-[#B45309] border-[#FDE68A] ring-2 ring-[#FBBF24]'
                  : 'bg-[#D97706] border-[#FDE68A]'
              }`}
            >
              <span className="font-heading font-bold text-2xl sm:text-3xl">🥇 #1</span>
              <span className="font-mono-tech text-[10px] font-bold tracking-wider uppercase">
                GOLD CHAMPION
              </span>
              {first && (
                <span className="font-mono-tech text-[10px] opacity-95 mt-0.5">
                  {first.accuracy}% ACC · {metricLabel}
                </span>
              )}
            </div>
          </div>

          {/* 3RD PLACE – BRONZE */}
          <div className="flex flex-col items-center text-center transition-all duration-500">
            <div className="mb-1.5">
              <Shield size={24} className="text-[#FB923C]" />
            </div>
            <div
              className={`font-sora text-xs sm:text-sm font-bold truncate max-w-full px-2 py-0.5 rounded ${
                isMe(third)
                  ? 'bg-[#2563EB] text-white'
                  : 'text-[var(--studio-text)]'
              }`}
              title={third?.username}
            >
              {third ? `${third.username}${isMe(third) ? ' (You)' : ''}` : 'Open #3'}
            </div>
            <div className="font-mono-tech text-xs font-bold text-[var(--studio-text-secondary)] mt-0.5 mb-2 tabular-nums">
              {third ? `${third.score} pts` : '—'}
            </div>
            <div
              className={`w-full h-20 sm:h-24 rounded-t-xl border-2 text-white flex flex-col items-center justify-center shadow-md transition-all duration-500 ${
                isMe(third)
                  ? 'bg-[#7C2D12] border-[#60A5FA] ring-2 ring-[#38BDF8]'
                  : 'bg-[#9A3412] border-[#FB923C]'
              }`}
            >
              <span className="font-heading font-bold text-lg sm:text-xl">🥉 #3</span>
              <span className="font-mono-tech text-[10px] font-bold tracking-wider uppercase">
                BRONZE
              </span>
              {third && (
                <span className="font-mono-tech text-[10px] opacity-90 mt-0.5">
                  {third.accuracy}% ACC
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Separate Rank Display below Podium when Current User is #4 or Lower */}
      {showSeparateRankRow && currentUserEntry && (
        <div
          data-testid="outside-top3-rank"
          className="max-w-3xl mx-auto p-3.5 sm:p-4 rounded-xl bg-[var(--studio-surface-2)] border-2 border-[var(--studio-accent-text)] flex flex-wrap items-center justify-between gap-3"
        >
          <div className="flex items-center gap-3">
            <span className="px-3 py-1.5 rounded-lg bg-[#2563EB] text-white font-heading font-bold text-sm tabular-nums">
              Rank #{currentUserEntry.rank}
            </span>
            <div>
              <div className="font-sora font-bold text-sm text-[var(--studio-text)]">
                {currentUserEntry.username} (Your Standing)
              </div>
              <div className="font-mono-tech text-xs text-[var(--studio-text-muted)]">
                Ranked #{currentUserEntry.rank} out of {totalPlayers || currentUserEntry.rank} players
              </div>
            </div>
          </div>
          <div className="text-right font-mono-tech tabular-nums">
            <div className="text-sm font-bold text-[var(--studio-emerald-text)]">
              {currentUserEntry.score} pts
            </div>
            <div className="text-xs text-[var(--studio-text-secondary)]">
              {currentUserEntry.accuracy}% accuracy
            </div>
          </div>
        </div>
      )}

      {currentUserEntry && currentUserEntry.rank <= 3 && (
        <div className="max-w-3xl mx-auto flex items-center justify-center gap-2 font-mono-tech text-xs font-bold text-[var(--studio-emerald-text)]">
          <Award size={15} />
          <span>
            Your Current Standing: #{currentUserEntry.rank} of {totalPlayers || 3} ·{' '}
            {currentUserEntry.score} pts
          </span>
        </div>
      )}
    </div>
  );
};

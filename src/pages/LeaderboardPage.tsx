import React, { useCallback, useEffect, useState } from 'react';
import {
  Award,
  Crown,
  Drum,
  Play,
  RefreshCw,
  Trophy,
  Volume2,
} from 'lucide-react';
import {
  CLASS_OPTIONS,
  type AnalyticsSummary,
  type GameDifficultyId,
  type GameLeaderboardEntry,
  type GameLeaderboardView,
  type LeaderboardEntry,
} from '../../shared/types.ts';
import { arcadeAudio } from '../audio/arcadeAudio.ts';
import { AnimatedPodium } from '../components/quiz/AnimatedPodium.tsx';
import { useArcade } from '../context/ArcadeContext.tsx';
import { safeFetchJson } from '../utils/apiClient.ts';

interface LeaderboardPageProps {
  onPlayCompete: () => void;
}

interface TrophyDef {
  id: string;
  name: string;
  req: string;
  earned: boolean;
}

interface GameLeaderboardApiResponse {
  view: GameLeaderboardView;
  rankingMethodDescription: string;
  totalPlayers: number;
  top3: GameLeaderboardEntry[];
  entries: GameLeaderboardEntry[];
  currentUserEntry: GameLeaderboardEntry | null;
}

export const LeaderboardPage: React.FC<LeaderboardPageProps> = ({ onPlayCompete }) => {
  const { player, examUserId, setMusicMode, reportError } = useArcade();

  const [hallView, setHallView] = useState<'rankings' | 'vault'>('rankings');
  const [boardTab, setBoardTab] = useState<'highest' | 'overall' | 'arcade'>('highest');
  const [diffFilter, setDiffFilter] = useState<'all' | GameDifficultyId>('all');
  const [className, setClassName] = useState<string>('all');
  const [search, setSearch] = useState('');

  const [gameBoard, setGameBoard] = useState<GameLeaderboardApiResponse | null>(null);
  const [arcadeRows, setArcadeRows] = useState<LeaderboardEntry[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [celebratingTrophy, setCelebratingTrophy] = useState<string | null>(null);

  useEffect(() => {
    setMusicMode('trophy');
  }, [setMusicMode]);

  const loadLeaderboard = useCallback(async () => {
    setLoading(true);
    try {
      const aRes = await safeFetchJson<AnalyticsSummary>(
        `/api/exam/analytics?userId=${encodeURIComponent(examUserId)}&range=all`
      );
      if (aRes.ok && aRes.data) setAnalytics(aRes.data);

      if (boardTab === 'arcade') {
        const qs = new URLSearchParams({ tab: 'arcade', className, search });
        const res = await safeFetchJson<{ entries?: LeaderboardEntry[] }>(
          `/api/leaderboard?${qs.toString()}`
        );
        if (res.ok && res.data && Array.isArray(res.data.entries)) {
          setArcadeRows(res.data.entries);
        }
      } else {
        const qs = new URLSearchParams({
          view: boardTab,
          difficulty: diffFilter,
          search,
          userId: player?.id || '',
        });
        const res = await safeFetchJson<GameLeaderboardApiResponse>(
          `/api/game/leaderboard?${qs.toString()}`
        );
        if (res.ok && res.data) {
          setGameBoard(res.data);
        }
      }
    } catch (err) {
      reportError(String(err));
    } finally {
      setLoading(false);
    }
  }, [boardTab, className, diffFilter, examUserId, player?.id, reportError, search]);

  useEffect(() => {
    void loadLeaderboard();
  }, [loadLeaderboard]);

  const totalXp = (analytics?.streaks.examXp ?? 0) + (player?.xp ?? 0);
  const totalRuns = (analytics?.totalQuizzes ?? 0) + (player?.gamesPlayed ?? 0);
  const bestStreak = Math.max(analytics?.streaks.dailyStreak ?? 0, player?.streakBest ?? 0);
  const bestAccuracy = analytics?.overallAccuracy ?? 0;

  const trophies: TrophyDef[] = [
    { id: 'first_spark', name: 'First Spark', req: 'Complete 1 Quiz or Game Run', earned: totalRuns >= 1 },
    { id: 'bronze_cup', name: 'Bronze Gear Cup', req: 'Earn 100+ Total XP', earned: totalXp >= 100 },
    { id: 'silver_crest', name: 'Silver Circuit Crest', req: 'Earn 300+ Total XP', earned: totalXp >= 300 },
    { id: 'gold_crown', name: 'Grand Gold Crown', req: 'Earn 600+ Total XP', earned: totalXp >= 600 },
    { id: 'diamond_relic', name: 'Diamond Architect', req: 'Earn 1,200+ Total XP', earned: totalXp >= 1200 },
    {
      id: 'sharpshooter',
      name: 'Precision Shield',
      req: 'Reach 80%+ Overall Accuracy',
      earned: totalRuns >= 1 && bestAccuracy >= 80,
    },
    {
      id: 'streak_master',
      name: 'Overclock Flame',
      req: 'Hit a 3+ Combo / Streak',
      earned: bestStreak >= 3 || (analytics?.streaks.perfectStreak ?? 0) >= 1,
    },
    { id: 'veteran_builder', name: 'Grand Builder', req: 'Complete 5+ Runs', earned: totalRuns >= 5 },
  ];

  const earnedCount = trophies.filter((t) => t.earned).length;

  // Map arcade rows for podium when Arcade Mini-Games tab is selected
  const arcadeTop3: GameLeaderboardEntry[] = arcadeRows.slice(0, 3).map((e, i) => ({
    rank: i + 1,
    userId: e.playerId,
    username: e.playerName,
    className: e.className,
    title: e.title,
    score: e.bestScore,
    bestScore: e.bestScore,
    totalPoints: e.totalScore,
    gamesPlayed: e.gamesCount,
    accuracy: Math.round(e.accuracy),
    completionTime: 0,
    difficulty: e.gameType,
    category: 'arcade',
    createdAt: '',
  }));

  const activeTop3 = boardTab === 'arcade' ? arcadeTop3 : gameBoard?.top3 || [];
  const activeCurrentEntry = boardTab === 'arcade' ? null : gameBoard?.currentUserEntry || null;
  const activeTotalPlayers =
    boardTab === 'arcade' ? arcadeRows.length : gameBoard?.totalPlayers || 0;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* GRAND HALL BANNER */}
      <section className="studio-card p-6 sm:p-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-[#D97706] text-white flex items-center justify-center shrink-0 shadow-lg">
              <Trophy size={28} />
            </div>
            <div>
              <div className="font-mono-tech text-xs font-bold text-[var(--studio-amber-text)] tracking-widest uppercase">
                Live Database Leaderboard
              </div>
              <h1 className="font-heading font-bold text-2xl sm:text-3xl text-[var(--studio-text)] mt-0.5">
                Championship Podium &amp; Trophy Room
              </h1>
              <p className="text-xs sm:text-sm text-[var(--studio-text-secondary)] mt-0.5">
                {earnedCount} / {trophies.length} Studio Trophies Unlocked · {totalXp} Total XP
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => arcadeAudio.playSfx('drumRoll')}
              className="studio-btn studio-btn-ghost text-xs px-3.5"
            >
              <Drum size={14} className="text-[var(--studio-amber-text)]" /> Drum Roll
            </button>
            <button
              type="button"
              onClick={() => arcadeAudio.playSfx('airhorn')}
              className="studio-btn studio-btn-ghost text-xs px-3.5"
            >
              <Volume2 size={14} className="text-[var(--studio-accent-text)]" /> Fanfare
            </button>
            <button
              type="button"
              onClick={() => {
                arcadeAudio.playSfx('gameStart');
                onPlayCompete();
              }}
              className="studio-btn studio-btn-primary text-xs px-4"
            >
              <Play size={14} fill="currentColor" /> Play Quiz
            </button>
          </div>
        </div>
      </section>

      {/* Primary Section Tabs + Leaderboard View Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              arcadeAudio.playSfx('click');
              setHallView('rankings');
            }}
            className={`studio-btn text-xs sm:text-sm px-4 ${
              hallView === 'rankings' ? 'studio-btn-primary' : 'studio-btn-ghost'
            }`}
          >
            <Award size={15} /> Leaderboard &amp; Podium
          </button>
          <button
            type="button"
            onClick={() => {
              arcadeAudio.playSfx('click');
              setHallView('vault');
            }}
            className={`studio-btn text-xs sm:text-sm px-4 ${
              hallView === 'vault' ? 'studio-btn-amber' : 'studio-btn-ghost'
            }`}
          >
            <Crown size={15} /> Trophy Vault ({earnedCount}/{trophies.length})
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {(
            [
              { id: 'highest', label: 'Highest Single Score' },
              { id: 'overall', label: 'Overall Performance' },
              { id: 'arcade', label: 'Mini-Games' },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                arcadeAudio.playSfx('click');
                setBoardTab(t.id);
                setHallView('rankings');
              }}
              className={`studio-btn text-xs px-3.5 py-1.5 min-h-[36px] ${
                boardTab === t.id ? 'studio-btn-cyan' : 'studio-btn-ghost'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* LIVE ANIMATED PODIUM */}
      <section className="studio-card-solid p-6 sm:p-8 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-heading font-bold text-lg sm:text-xl text-[var(--studio-text)] flex items-center gap-2">
              <Crown size={19} className="text-[var(--studio-amber-text)]" />
              {boardTab === 'highest'
                ? 'Top 3 — Highest Single Score'
                : boardTab === 'overall'
                  ? 'Top 3 — Overall Performance (Total Points)'
                  : 'Top 3 — Arcade Mini-Games'}
            </h2>
            {boardTab !== 'arcade' && gameBoard?.rankingMethodDescription && (
              <p className="text-xs text-[var(--studio-text-secondary)] mt-0.5">
                {gameBoard.rankingMethodDescription}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              arcadeAudio.playSfx('click');
              void loadLeaderboard();
            }}
            className="studio-btn studio-btn-ghost text-xs px-3 py-1.5 min-h-[34px]"
          >
            <RefreshCw size={13} /> Refresh
          </button>
        </div>

        <AnimatedPodium
          top3={activeTop3}
          currentUserId={player?.id}
          currentUserEntry={activeCurrentEntry}
          metricLabel={boardTab === 'overall' ? 'Total Points' : 'Best Score'}
          totalPlayers={activeTotalPlayers}
          emptyActionLabel="Play First Quiz Match"
          onEmptyAction={onPlayCompete}
        />
      </section>

      {hallView === 'vault' ? (
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-heading font-bold text-lg text-[var(--studio-text)]">Studio Trophy Vault</h2>
            <span className="font-mono-tech text-xs font-bold text-[var(--studio-text-muted)]">
              Click unlocked trophies to celebrate
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            {trophies.map((t) => {
              const popping = celebratingTrophy === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    if (t.earned) {
                      arcadeAudio.playSfx('wow');
                      setCelebratingTrophy(t.id);
                      window.setTimeout(() => setCelebratingTrophy(null), 600);
                    } else {
                      arcadeAudio.playSfx('bonk');
                    }
                  }}
                  className={`studio-card-interactive p-4 text-center flex flex-col items-center gap-2 cursor-pointer ${
                    t.earned ? 'border-2 border-[#F59E0B]' : 'opacity-70'
                  } ${popping ? 'scale-105' : ''}`}
                >
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      t.earned
                        ? 'bg-[#D97706] text-white'
                        : 'bg-[var(--studio-surface-2)] text-[var(--studio-text-muted)] border border-[var(--studio-border)]'
                    }`}
                  >
                    <Trophy size={24} />
                  </div>
                  <div className="font-sora font-bold text-xs sm:text-sm text-[var(--studio-text)]">
                    {t.name}
                  </div>
                  <div className="text-xs text-[var(--studio-text-secondary)]">{t.req}</div>
                  <span
                    className={`font-mono-tech text-[10px] font-bold mt-auto px-2 py-0.5 rounded ${
                      t.earned
                        ? 'bg-[#059669] text-white'
                        : 'bg-[var(--studio-surface-2)] text-[var(--studio-text-muted)]'
                    }`}
                  >
                    {t.earned ? 'UNLOCKED' : 'LOCKED'}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      ) : (
        <section className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search player username..."
              className="studio-input flex-1 px-3.5 py-2 text-sm"
            />

            {boardTab === 'arcade' ? (
              <select
                value={className}
                onChange={(e) => setClassName(e.target.value)}
                aria-label="Filter by class"
                className="studio-input px-3 py-2 text-sm"
              >
                <option value="all">All Classes</option>
                {CLASS_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            ) : (
              <select
                value={diffFilter}
                onChange={(e) => setDiffFilter(e.target.value as 'all' | GameDifficultyId)}
                aria-label="Filter by difficulty"
                className="studio-input px-3 py-2 text-sm"
              >
                <option value="all">All Difficulties</option>
                <option value="easy">Level 1 – Easy (+10)</option>
                <option value="moderate">Level 2 – Moderate (+20)</option>
                <option value="hard">Level 3 – Hard (+30)</option>
                <option value="jee">Level 4 – JEE Aspirants (+50)</option>
              </select>
            )}
          </div>

          {loading ? (
            <div className="studio-card-solid p-8 text-center font-mono-tech text-xs font-bold text-[var(--studio-accent-text)]">
              Loading verified rankings from database...
            </div>
          ) : boardTab === 'arcade' ? (
            arcadeRows.length === 0 ? (
              <div className="studio-card-solid p-8 text-center space-y-4">
                <Trophy size={40} className="mx-auto text-[var(--studio-amber-text)]" />
                <div className="font-heading font-bold text-lg text-[var(--studio-text)]">
                  No Arcade Runs Recorded Yet
                </div>
                <button type="button" onClick={onPlayCompete} className="studio-btn studio-btn-primary text-xs">
                  Start Playing
                </button>
              </div>
            ) : (
              <div className="studio-card-solid overflow-x-auto">
                <table className="w-full text-left text-sm tabular-nums">
                  <thead>
                    <tr className="border-b border-[var(--studio-border)] font-mono-tech text-xs text-[var(--studio-text-muted)]">
                      <th className="py-3 px-4">#</th>
                      <th className="py-3 px-4">PLAYER</th>
                      <th className="py-3 px-4 hidden sm:table-cell">CLASS</th>
                      <th className="py-3 px-4 text-right">BEST SCORE</th>
                      <th className="py-3 px-4 text-right">ACC</th>
                    </tr>
                  </thead>
                  <tbody>
                    {arcadeRows.map((e, idx) => (
                      <tr
                        key={e.playerId}
                        className={`border-b border-[var(--studio-border)] last:border-0 ${
                          player?.id === e.playerId ? 'bg-[var(--studio-surface-2)]' : ''
                        }`}
                      >
                        <td className="py-3 px-4 font-mono-tech text-xs font-bold text-[var(--studio-amber-text)]">
                          {idx + 1}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-sora font-bold text-[var(--studio-text)]">
                            {e.playerName}
                          </div>
                          <div className="text-xs text-[var(--studio-text-muted)]">{e.title}</div>
                        </td>
                        <td className="py-3 px-4 hidden sm:table-cell text-[var(--studio-text-secondary)]">
                          {e.className}
                        </td>
                        <td className="py-3 px-4 text-right font-mono-tech text-xs font-bold text-[var(--studio-accent-text)]">
                          {e.bestScore}
                        </td>
                        <td className="py-3 px-4 text-right font-mono-tech font-bold text-[var(--studio-emerald-text)]">
                          {Math.round(e.accuracy)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : !gameBoard || gameBoard.entries.length === 0 ? (
            <div className="studio-card-solid p-8 text-center space-y-4">
              <Trophy size={40} className="mx-auto text-[var(--studio-amber-text)]" />
              <div className="font-heading font-bold text-lg text-[var(--studio-text)]">
                No Completed Matches Recorded Yet
              </div>
              <p className="text-sm text-[var(--studio-text-secondary)]">
                Complete a quiz game to publish your verified score onto the live database leaderboard.
              </p>
              <button type="button" onClick={onPlayCompete} className="studio-btn studio-btn-primary text-xs">
                Play Quiz Now
              </button>
            </div>
          ) : (
            <div className="studio-card-solid overflow-x-auto">
              <table className="w-full text-left text-sm tabular-nums">
                <thead>
                  <tr className="border-b border-[var(--studio-border)] font-mono-tech text-xs text-[var(--studio-text-muted)]">
                    <th className="py-3 px-4">RANK</th>
                    <th className="py-3 px-4">USERNAME</th>
                    <th className="py-3 px-4 hidden sm:table-cell">
                      {boardTab === 'highest' ? 'DIFFICULTY' : 'GAMES PLAYED'}
                    </th>
                    <th className="py-3 px-4 text-right">
                      {boardTab === 'highest' ? 'BEST SCORE' : 'TOTAL POINTS'}
                    </th>
                    <th className="py-3 px-4 text-right">ACCURACY</th>
                  </tr>
                </thead>
                <tbody>
                  {gameBoard.entries.map((entry) => {
                    const isMe = Boolean(player?.id && entry.userId === player.id);
                    return (
                      <tr
                        key={entry.userId}
                        className={`border-b border-[var(--studio-border)] last:border-0 ${
                          isMe ? 'bg-[var(--studio-surface-2)]' : ''
                        }`}
                      >
                        <td className="py-3 px-4 font-mono-tech text-xs font-bold text-[var(--studio-amber-text)]">
                          {entry.rank === 1
                            ? '🥇 #1'
                            : entry.rank === 2
                              ? '🥈 #2'
                              : entry.rank === 3
                                ? '🥉 #3'
                                : `#${entry.rank}`}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-sora font-bold text-[var(--studio-text)]">
                            {entry.username} {isMe ? '★ (You)' : ''}
                          </div>
                          <div className="text-xs text-[var(--studio-text-muted)]">
                            {entry.className} · {entry.gamesPlayed}{' '}
                            {entry.gamesPlayed === 1 ? 'game' : 'games'}
                          </div>
                        </td>
                        <td className="py-3 px-4 hidden sm:table-cell font-mono-tech text-xs uppercase text-[var(--studio-accent-text)]">
                          {boardTab === 'highest'
                            ? entry.difficulty
                            : `${entry.gamesPlayed} games (best ${entry.bestScore})`}
                        </td>
                        <td className="py-3 px-4 text-right font-mono-tech text-sm font-bold text-[var(--studio-emerald-text)]">
                          {entry.score} pts
                        </td>
                        <td className="py-3 px-4 text-right font-mono-tech text-xs font-bold text-[var(--studio-text)]">
                          {entry.accuracy}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
};

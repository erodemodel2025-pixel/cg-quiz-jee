import React, { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  Award,
  Crown,
  Drum,
  Play,
  RefreshCw,
  Trophy,
  Volume2,
} from 'lucide-react';
import { PLAYGROUND_MINIGAMES } from '../../shared/progression.ts';
import {
  CLASS_OPTIONS,
  type AnalyticsSummary,
  type GameDifficultyId,
  type GameLeaderboardEntry,
  type GameLeaderboardView,
  type LeaderboardEntry,
  type LeaderboardTimeframe,
  type PlaygroundLeaderboardEntry,
} from '../../shared/types.ts';
import { arcadeAudio } from '../audio/arcadeAudio.ts';
import { AnimatedPodium } from '../components/quiz/AnimatedPodium.tsx';
import { useArcade } from '../context/ArcadeContext.tsx';
import { safeFetchJson } from '../utils/apiClient.ts';

interface LeaderboardPageProps {
  initialPlaygroundGameId?: string;
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

interface PlaygroundLeaderboardApiResponse {
  gameId: string;
  timeframe: LeaderboardTimeframe;
  totalPlayers: number;
  top3: PlaygroundLeaderboardEntry[];
  entries: PlaygroundLeaderboardEntry[];
  currentUserEntry: PlaygroundLeaderboardEntry | null;
}

const TRACK_LAB_GAMES: Array<{ id: string; title: string }> = [
  { id: 'car-test-0-100', title: 'Car Track: 0–100 km/h Sprint' },
  { id: 'car-test-topspeed', title: 'Car Track: Top Speed Run' },
  { id: 'car-test-braking', title: 'Car Track: 100–0 Braking Test' },
  { id: 'car-test-slalom', title: 'Car Track: Cornering & Slalom' },
  { id: 'car-test-drag', title: 'Car Track: Drag Race vs AI' },
  { id: 'phone-test-lab', title: 'Phone Test Lab: 200-Pt Challenge' },
];

export const LeaderboardPage: React.FC<LeaderboardPageProps> = ({
  initialPlaygroundGameId,
  onPlayCompete,
}) => {
  const { player, examUserId, setMusicMode, reportError } = useArcade();

  const [hallView, setHallView] = useState<'rankings' | 'vault'>('rankings');
  const [boardTab, setBoardTab] = useState<
    'playground' | 'highest' | 'overall' | 'simulators' | 'arcade'
  >(initialPlaygroundGameId ? 'playground' : 'highest');
  const [pgGameId, setPgGameId] = useState<string>(initialPlaygroundGameId || 'all');
  const [timeframe, setTimeframe] = useState<LeaderboardTimeframe>('global');
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);
  const [diffFilter, setDiffFilter] = useState<'all' | GameDifficultyId>('all');
  const [simFilter, setSimFilter] = useState<'all' | 'car' | 'phone'>('all');
  const [className, setClassName] = useState<string>('all');
  const [search, setSearch] = useState('');

  const [pgBoard, setPgBoard] = useState<PlaygroundLeaderboardApiResponse | null>(null);
  const [pgUnavailable, setPgUnavailable] = useState(false);
  const [gameBoard, setGameBoard] = useState<GameLeaderboardApiResponse | null>(null);
  const [arcadeRows, setArcadeRows] = useState<LeaderboardEntry[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [celebratingTrophy, setCelebratingTrophy] = useState<string | null>(null);

  useEffect(() => {
    setMusicMode('trophy');
  }, [setMusicMode]);

  useEffect(() => {
    if (initialPlaygroundGameId) {
      setBoardTab('playground');
      setPgGameId(initialPlaygroundGameId);
      setHallView('rankings');
    }
  }, [initialPlaygroundGameId]);

  const loadLeaderboard = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const aRes = await safeFetchJson<AnalyticsSummary>(
          `/api/exam/analytics?userId=${encodeURIComponent(examUserId)}&range=all`
        );
        if (aRes.ok && aRes.data) setAnalytics(aRes.data);

        if (boardTab === 'playground') {
          const qs = new URLSearchParams({
            gameId: pgGameId,
            timeframe,
            search,
            userId: player?.id || '',
          });
          const res = await safeFetchJson<PlaygroundLeaderboardApiResponse>(
            `/api/playground/leaderboard?${qs.toString()}`
          );
          if (res.ok && res.data) {
            setPgBoard(res.data);
            setPgUnavailable(false);
          } else {
            setPgUnavailable(true);
          }
        } else if (boardTab === 'arcade') {
          const qs = new URLSearchParams({ tab: 'arcade', className, search });
          const res = await safeFetchJson<{ entries?: LeaderboardEntry[] }>(
            `/api/leaderboard?${qs.toString()}`
          );
          if (res.ok && res.data && Array.isArray(res.data.entries)) {
            setArcadeRows(res.data.entries);
          }
        } else if (boardTab === 'simulators') {
          const qs = new URLSearchParams({
            simulator: simFilter,
            search,
            userId: player?.id || '',
          });
          const res = await safeFetchJson<GameLeaderboardApiResponse>(
            `/api/simulator/leaderboard?${qs.toString()}`
          );
          if (res.ok && res.data) {
            setGameBoard(res.data);
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
        if (boardTab === 'playground') setPgUnavailable(true);
        reportError(String(err));
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [
      boardTab,
      className,
      diffFilter,
      examUserId,
      pgGameId,
      player?.id,
      reportError,
      search,
      simFilter,
      timeframe,
    ]
  );

  useEffect(() => {
    void loadLeaderboard(false);
  }, [loadLeaderboard]);

  // Silent live auto-refresh every 15s (never reloads full page!)
  useEffect(() => {
    if (!autoRefresh || hallView !== 'rankings') return;
    const id = window.setInterval(() => {
      void loadLeaderboard(true);
    }, 15000);
    return () => window.clearInterval(id);
  }, [autoRefresh, hallView, loadLeaderboard]);

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

  const toPodiumFromPlayground = (e: PlaygroundLeaderboardEntry): GameLeaderboardEntry => ({
    rank: e.rank,
    userId: e.userId,
    username: e.username,
    className: `${e.className} · LVL ${e.level}`,
    title: e.title,
    score: e.score,
    bestScore: e.bestScore,
    totalPoints: e.totalPoints,
    gamesPlayed: e.gamesPlayed,
    accuracy: Math.round(e.accuracy),
    completionTime: Math.round(e.completionTimeMs / 1000),
    difficulty: e.gameId,
    category: timeframe,
    createdAt: e.createdAt,
  });

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

  const activeTop3 =
    boardTab === 'playground'
      ? (pgBoard?.top3 || []).map(toPodiumFromPlayground)
      : boardTab === 'arcade'
        ? arcadeTop3
        : gameBoard?.top3 || [];

  const activeCurrentEntry =
    boardTab === 'playground'
      ? pgBoard?.currentUserEntry
        ? toPodiumFromPlayground(pgBoard.currentUserEntry)
        : null
      : boardTab === 'arcade'
        ? null
        : gameBoard?.currentUserEntry || null;

  const activeTotalPlayers =
    boardTab === 'playground'
      ? pgBoard?.totalPlayers || 0
      : boardTab === 'arcade'
        ? arcadeRows.length
        : gameBoard?.totalPlayers || 0;

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
              onClick={() => setAutoRefresh((v) => !v)}
              className={`studio-btn text-xs px-3 ${
                autoRefresh ? 'studio-btn-emerald' : 'studio-btn-ghost'
              }`}
              title="Toggle 15-second live polling without page reload"
            >
              <Activity size={14} /> {autoRefresh ? 'Live 15s ON' : 'Live OFF'}
            </button>
            <button
              type="button"
              onClick={() => arcadeAudio.playSfx('drumRoll')}
              className="studio-btn studio-btn-ghost text-xs px-3"
            >
              <Drum size={14} className="text-[var(--studio-amber-text)]" /> Drum Roll
            </button>
            <button
              type="button"
              onClick={() => arcadeAudio.playSfx('airhorn')}
              className="studio-btn studio-btn-ghost text-xs px-3"
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
              { id: 'playground', label: '12 Mini-Games & Track' },
              { id: 'highest', label: 'Highest Quiz Score' },
              { id: 'overall', label: 'Overall Performance' },
              { id: 'simulators', label: '3D Missions' },
              { id: 'arcade', label: 'Classic Labs' },
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
              {boardTab === 'playground'
                ? `Top 3 — ${
                    pgGameId === 'all'
                      ? 'Playground Cumulative'
                      : PLAYGROUND_MINIGAMES.find((g) => g.id === pgGameId)?.title ||
                        TRACK_LAB_GAMES.find((t) => t.id === pgGameId)?.title ||
                        pgGameId
                  } (${timeframe})`
                : boardTab === 'highest'
                  ? 'Top 3 — Highest Single Score'
                  : boardTab === 'overall'
                    ? 'Top 3 — Overall Performance (Total Points)'
                    : boardTab === 'simulators'
                      ? 'Top 3 — 3D Engineering Simulators'
                      : 'Top 3 — Classic Arcade Mini-Games'}
            </h2>
            {boardTab === 'playground' ? (
              <p className="text-xs text-[var(--studio-text-secondary)] mt-0.5">
                {pgGameId === 'all'
                  ? 'Ranked by total verified score across all 12 mini-games, 3D Track runs, and Phone Test Lab.'
                  : 'Ranked by best verified single-run score (ties broken by faster completion time & accuracy).'}
              </p>
            ) : boardTab !== 'arcade' && gameBoard?.rankingMethodDescription ? (
              <p className="text-xs text-[var(--studio-text-secondary)] mt-0.5">
                {gameBoard.rankingMethodDescription}
              </p>
            ) : null}
          </div>

          <button
            type="button"
            onClick={() => {
              arcadeAudio.playSfx('click');
              void loadLeaderboard(false);
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
          metricLabel={
            boardTab === 'overall' || (boardTab === 'playground' && pgGameId === 'all')
              ? 'Total Points'
              : 'Best Score'
          }
          totalPlayers={activeTotalPlayers}
          emptyActionLabel="Play First Challenge"
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
          <div className="flex flex-col md:flex-row gap-3">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search player username..."
              className="studio-input flex-1 px-3.5 py-2 text-sm"
            />

            {boardTab === 'playground' ? (
              <>
                <select
                  value={pgGameId}
                  onChange={(e) => setPgGameId(e.target.value)}
                  aria-label="Filter by playground game"
                  className="studio-input px-3 py-2 text-sm"
                >
                  <option value="all">All Playground Games (Cumulative)</option>
                  <optgroup label="12 Interactive Mini-Games">
                    {PLAYGROUND_MINIGAMES.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.title}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="3D Track & Phone Lab">
                    {TRACK_LAB_GAMES.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title}
                      </option>
                    ))}
                  </optgroup>
                </select>

                <div className="flex gap-1.5">
                  {(['global', 'daily', 'weekly', 'monthly'] as const).map((tf) => (
                    <button
                      key={tf}
                      type="button"
                      onClick={() => {
                        arcadeAudio.playSfx('click');
                        setTimeframe(tf);
                      }}
                      className={`studio-btn text-xs px-3 py-2 uppercase ${
                        timeframe === tf ? 'studio-btn-primary' : 'studio-btn-ghost'
                      }`}
                    >
                      {tf}
                    </button>
                  ))}
                </div>
              </>
            ) : boardTab === 'arcade' ? (
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
            ) : boardTab === 'simulators' ? (
              <select
                value={simFilter}
                onChange={(e) => setSimFilter(e.target.value as 'all' | 'car' | 'phone')}
                aria-label="Filter by simulator"
                className="studio-input px-3 py-2 text-sm"
              >
                <option value="all">All Engineering Simulators</option>
                <option value="car">Car Tuning Simulator</option>
                <option value="phone">Smartphone Engineering Lab</option>
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
          ) : boardTab === 'playground' ? (
            pgUnavailable ? (
              <div className="studio-card-solid p-8 text-center space-y-3">
                <div className="font-heading font-bold text-lg text-[var(--studio-rose-text)]">
                  Leaderboard data unavailable right now.
                </div>
                <button
                  type="button"
                  onClick={() => void loadLeaderboard(false)}
                  className="studio-btn studio-btn-ghost text-xs px-4"
                >
                  Retry Load
                </button>
              </div>
            ) : !pgBoard || pgBoard.entries.length === 0 ? (
              <div className="studio-card-solid p-8 text-center space-y-4">
                <Trophy size={40} className="mx-auto text-[var(--studio-amber-text)]" />
                <div className="font-heading font-bold text-lg text-[var(--studio-text)]">
                  No scores recorded yet
                </div>
                <p className="text-sm text-[var(--studio-text-secondary)]">
                  No verified playground runs found for this game and timeframe. Play any mini-game or 3D track test to claim #1!
                </p>
                <button type="button" onClick={onPlayCompete} className="studio-btn studio-btn-primary text-xs">
                  Start Playing
                </button>
              </div>
            ) : (
              <div className="studio-card-solid overflow-x-auto">
                <table className="w-full text-left text-sm tabular-nums">
                  <thead>
                    <tr className="border-b border-[var(--studio-border)] font-mono-tech text-xs text-[var(--studio-text-muted)]">
                      <th className="py-3 px-4">RANK</th>
                      <th className="py-3 px-4">ENGINEER</th>
                      <th className="py-3 px-4 hidden sm:table-cell">LEVEL</th>
                      <th className="py-3 px-4 text-right hidden md:table-cell">WIN RATE</th>
                      <th className="py-3 px-4 text-right">
                        {pgGameId === 'all' ? 'TOTAL PTS' : 'BEST SCORE'}
                      </th>
                      <th className="py-3 px-4 text-right">ACC</th>
                      <th className="py-3 px-4 text-right hidden sm:table-cell">BEST TIME</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pgBoard.entries.map((entry) => {
                      const isMe = Boolean(player?.id && entry.userId === player.id);
                      const delta = entry.rankDelta ?? 0;
                      return (
                        <tr
                          key={entry.userId}
                          className={`border-b border-[var(--studio-border)] last:border-0 ${
                            isMe ? 'bg-[var(--studio-surface-2)]' : ''
                          }`}
                        >
                          <td className="py-3 px-4 font-mono-tech text-xs font-bold text-[var(--studio-amber-text)] whitespace-nowrap">
                            {entry.rank === 1
                              ? '🥇 #1'
                              : entry.rank === 2
                                ? '🥈 #2'
                                : entry.rank === 3
                                  ? '🥉 #3'
                                  : `#${entry.rank}`}
                            {delta > 0 && (
                              <span className="ml-1.5 text-[10px] text-[var(--studio-emerald-text)]">
                                ↑{delta}
                              </span>
                            )}
                            {delta < 0 && (
                              <span className="ml-1.5 text-[10px] text-[var(--studio-rose-text)]">
                                ↓{Math.abs(delta)}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-sora font-bold text-[var(--studio-text)]">
                              {entry.username} {isMe ? '★ (You)' : ''}
                            </div>
                            <div className="text-xs text-[var(--studio-text-muted)]">
                              {entry.className} · {entry.gamesPlayed} {entry.gamesPlayed === 1 ? 'run' : 'runs'}
                            </div>
                          </td>
                          <td className="py-3 px-4 hidden sm:table-cell font-mono-tech text-xs text-[var(--studio-accent-text)]">
                            LVL {entry.level} · {entry.title}
                          </td>
                          <td className="py-3 px-4 text-right hidden md:table-cell font-mono-tech text-xs font-bold text-[var(--studio-cyan-text)]">
                            {entry.winRate}%
                          </td>
                          <td className="py-3 px-4 text-right font-mono-tech text-sm font-bold text-[var(--studio-emerald-text)]">
                            {entry.score} pts
                          </td>
                          <td className="py-3 px-4 text-right font-mono-tech text-xs font-bold text-[var(--studio-text)]">
                            {entry.accuracy}%
                          </td>
                          <td className="py-3 px-4 text-right hidden sm:table-cell font-mono-tech text-xs text-[var(--studio-text-muted)]">
                            {(entry.completionTimeMs / 1000).toFixed(1)}s
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )
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

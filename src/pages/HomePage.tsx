import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Award,
  Calendar,
  Car,
  CheckCircle2,
  Circle,
  Cpu,
  Flame,
  Gamepad2,
  Play,
  Rocket,
  Smartphone,
  Sparkles,
  Trophy,
  Zap,
} from 'lucide-react';
import { EASY_QUESTIONS } from '../../shared/easyQuestions.ts';
import {
  ACHIEVEMENTS,
  computeLevelFromXp,
  getDailyTripleForDate,
  getMiniGameDef,
  getWeeklyEventForDate,
  PLAYGROUND_MINIGAMES,
  PROGRESSION_MILESTONES,
} from '../../shared/progression.ts';
import type {
  AnalyticsSummary,
  DailyTripleStatus,
  GameModeId,
  PlaygroundLeaderboardEntry,
  SavedCreation,
  WeeklyEventInfo,
} from '../../shared/types.ts';
import { arcadeAudio } from '../audio/arcadeAudio.ts';
import { useArcade } from '../context/ArcadeContext.tsx';
import { safeFetchJson } from '../utils/apiClient.ts';
import { getGuestOrUserId, listCreations } from '../utils/creationsStore.ts';
import { loadActiveQuizDraft, type ActiveQuizDraft } from '../utils/storageMigration.ts';

interface HomePageProps {
  onOpenEasyQuiz: () => void;
  onOpenAutoEngineer: () => void;
  onOpenPhoneDesigner: () => void;
  onOpenArena: () => void;
  onOpenExamStudio: () => void;
  onResumeDraft: (draft: ActiveQuizDraft) => void;
  onOpenTrophyRoom: () => void;
  onOpenCreation: (creation: SavedCreation) => void;
  onLaunchMiniGame?: (gameId: GameModeId) => void;
  onOpenSimulator?: (sim: 'car-track' | 'car-dyno' | 'car-drag' | 'phone-lab') => void;
  onOpenLeaderboard?: (gameId?: string) => void;
}

interface EventsApiResponse {
  date: string;
  dailyTriple: DailyTripleStatus;
  weeklyEvent: WeeklyEventInfo;
  weeklyStandings: PlaygroundLeaderboardEntry[];
  personalBests: Record<string, { bestScore: number; bestTimeMs: number; plays: number }>;
  favoriteGameId: string | null;
}

export const HomePage: React.FC<HomePageProps> = ({
  onOpenEasyQuiz,
  onOpenAutoEngineer,
  onOpenPhoneDesigner,
  onOpenArena,
  onOpenExamStudio,
  onResumeDraft,
  onOpenTrophyRoom,
  onOpenCreation,
  onLaunchMiniGame,
  onOpenSimulator,
  onOpenLeaderboard,
}) => {
  const { player, examUserId, setMusicMode } = useArcade();
  const userId = getGuestOrUserId(player?.id);

  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [recentCreations, setRecentCreations] = useState<SavedCreation[]>([]);
  const [eventsData, setEventsData] = useState<EventsApiResponse | null>(null);
  const [globalTop5, setGlobalTop5] = useState<PlaygroundLeaderboardEntry[]>([]);
  const [boardUnavailable, setBoardUnavailable] = useState(false);
  const [draft] = useState(() => loadActiveQuizDraft());

  useEffect(() => {
    setMusicMode('home');
  }, [setMusicMode]);

  useEffect(() => {
    void safeFetchJson<AnalyticsSummary>(
      `/api/exam/analytics?userId=${encodeURIComponent(examUserId)}&range=7d`
    ).then((res) => {
      if (res.ok && res.data) setAnalytics(res.data);
    });
    void listCreations(userId).then((items) => setRecentCreations(items.slice(0, 3)));
  }, [examUserId, userId]);

  useEffect(() => {
    void safeFetchJson<EventsApiResponse>(
      `/api/playground/events?userId=${encodeURIComponent(player?.id || '')}`
    ).then((res) => {
      if (res.ok && res.data) setEventsData(res.data);
    });

    void safeFetchJson<{ entries?: PlaygroundLeaderboardEntry[] }>(
      `/api/playground/leaderboard?gameId=all&timeframe=global&userId=${encodeURIComponent(player?.id || '')}`
    ).then((res) => {
      if (res.ok && res.data && Array.isArray(res.data.entries)) {
        setGlobalTop5(res.data.entries.slice(0, 5));
        setBoardUnavailable(false);
      } else {
        setBoardUnavailable(true);
      }
    });
  }, [player?.id]);

  const todayStr = new Date().toISOString().slice(0, 10);
  const dailyTriple = eventsData?.dailyTriple || getDailyTripleForDate(todayStr);
  const weeklyEvent = eventsData?.weeklyEvent || getWeeklyEventForDate(todayStr);
  const levelInfo = computeLevelFromXp(player?.xp ?? 0);

  const spotlightMiniGames = useMemo(
    () => [
      PLAYGROUND_MINIGAMES[0], // reaction-test
      PLAYGROUND_MINIGAMES[1], // circuit-connect
      PLAYGROUND_MINIGAMES[7], // bridge-builder
      PLAYGROUND_MINIGAMES[11], // engineering-speedrun
    ],
    []
  );

  // Real history-based recommendation
  const recommendation = useMemo(() => {
    const fav = eventsData?.favoriteGameId;
    if (fav?.startsWith('car-') || recentCreations.some((c) => c.type === 'car')) {
      return {
        reason: 'Because you built or raced an automobile',
        title: 'Drone Landing & Slalom Physics',
        desc: 'Master counter-thrust wind compensation and steering control precision.',
        gameId: 'drone-landing' as GameModeId,
      };
    }
    if (fav === 'phone-test-lab' || recentCreations.some((c) => c.type === 'phone')) {
      return {
        reason: 'Because you engineered a smartphone',
        title: 'Circuit Connect & Tech Assembly',
        desc: 'Wire parallel power rails cleanly and snap workstation silicon under target time.',
        gameId: 'circuit-connect' as GameModeId,
      };
    }
    if (fav) {
      const def = getMiniGameDef(fav as GameModeId);
      const nextPick =
        fav === 'reaction-test'
          ? ('engineering-speedrun' as GameModeId)
          : fav === 'circuit-connect'
            ? ('gear-machine' as GameModeId)
            : ('bridge-builder' as GameModeId);
      const nextDef = getMiniGameDef(nextPick)!;
      return {
        reason: `Because you played ${def?.title || fav}`,
        title: nextDef.title,
        desc: nextDef.tagline,
        gameId: nextDef.id,
      };
    }
    return null;
  }, [eventsData?.favoriteGameId, recentCreations]);

  const featuredExperiences = [
    {
      id: 'easy-quiz',
      kicker: `Knowledge Zone · ${EASY_QUESTIONS.length}+ Questions · 6 Play Modes`,
      title: 'Easy Quiz Zone',
      description:
        'Test your instincts across 11 topics with Normal, Speed Round (30s), Streak Mode, Time Attack, Boss Round, and Daily Challenge.',
      image: '/src/assets/images/card_easy_quiz_1795174514172.jpg',
      btnClass: 'studio-btn-emerald',
      icon: Sparkles,
      cta: 'Play Easy Quizzes',
      onClick: onOpenEasyQuiz,
    },
    {
      id: 'auto-engineer',
      kicker: '3D CAD Simulator · 43 Subsystems · Test Track & Dyno',
      title: 'Car Tuning Engineering Simulator',
      description:
        'Customize paint, aero, wheels, engine & suspension in 3D, open the hood for X-Ray CAD inspection, and drive the 3D Proving Ground Track & Dyno.',
      image: '/src/assets/images/card_auto_engineer_1795174514567.jpg',
      btnClass: 'studio-btn-cyan',
      icon: Car,
      cta: 'Launch Car Engineering Sim',
      onClick: onOpenAutoEngineer,
    },
    {
      id: 'phone-designer',
      kicker: '3D Hardware CAD · 38 Parts · Test Lab & 200-Pt Challenge',
      title: 'Smartphone Engineering Lab',
      description:
        'Explode 7 hardware layers in 3D, equip protective cases, plug USB-C charging, toggle screen wake, and stress-test inside the Smartphone Test Lab.',
      image: '/src/assets/images/card_phone_designer_1795174514396.jpg',
      btnClass: 'studio-btn-purple',
      icon: Smartphone,
      cta: 'Open Smartphone Lab',
      onClick: onOpenPhoneDesigner,
    },
  ];

  const handleLaunchMiniGame = (gid: GameModeId) => {
    arcadeAudio.playSfx('gameStart');
    if (onLaunchMiniGame) onLaunchMiniGame(gid);
    else onOpenArena();
  };

  const recentAchievements = useMemo(() => {
    if (!player?.achievements?.length) return [];
    return player.achievements
      .slice(-3)
      .reverse()
      .map((id) => ACHIEVEMENTS.find((a) => a.id === id))
      .filter((a): a is NonNullable<typeof a> => Boolean(a));
  }, [player?.achievements]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-10">
      {/* HERO SECTION */}
      <section className="studio-card px-6 py-8 sm:px-10 sm:py-11 border border-[var(--studio-border-strong)]">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-8 space-y-5">
            <div className="font-mono-tech text-xs font-bold tracking-widest text-[var(--studio-accent-text)] uppercase">
              CG Quiz Studio · Engineering Playground
            </div>

            <h1 className="font-heading font-bold text-3xl sm:text-5xl lg:text-[52px] leading-[1.08] tracking-tight text-[var(--studio-text)] max-w-2xl">
              Your Next Level{' '}
              <span className="text-[var(--studio-accent-text)]">Starts Here.</span>
            </h1>

            <p className="font-sora text-base sm:text-lg text-[var(--studio-text-secondary)] max-w-2xl leading-relaxed">
              Play 12 interactive engineering mini-games, race custom 3D cars on a test track, invent next-gen smartphones, and climb Level 1–50 ranks.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => handleLaunchMiniGame('reaction-test')}
                className="studio-btn studio-btn-primary px-6 py-3 text-sm"
              >
                <Play size={16} fill="currentColor" />
                <span>Play 12 Mini-Games</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  arcadeAudio.playSfx('click');
                  onOpenEasyQuiz();
                }}
                className="studio-btn studio-btn-emerald px-5 py-3 text-sm"
              >
                <Zap size={16} />
                <span>Start Easy Quiz</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  arcadeAudio.playSfx('click');
                  onOpenArena();
                }}
                className="studio-btn studio-btn-purple px-5 py-3 text-sm"
              >
                <Gamepad2 size={16} />
                <span>Enter Playground Hub</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  arcadeAudio.playSfx('click');
                  onOpenExamStudio();
                }}
                className="studio-btn studio-btn-ghost px-4 py-3 text-xs sm:text-sm"
              >
                <Cpu size={15} className="text-[var(--studio-accent-text)]" />
                <span>Exam Studio</span>
              </button>
            </div>

            {draft && draft.questions?.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  arcadeAudio.playSfx('click');
                  onResumeDraft(draft);
                }}
                className="inline-flex items-center gap-2 text-xs font-mono-tech font-bold text-[var(--studio-emerald-text)] hover:underline cursor-pointer pt-1"
              >
                <span>Resume saved exam draft ({draft.mode}) →</span>
              </button>
            )}
          </div>

          {/* Right Player Rank & Quick Summary Card */}
          <div className="lg:col-span-4 studio-well p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono-tech text-xs font-bold uppercase tracking-wider text-[var(--studio-accent-text)]">
                {player ? `Rank · Level ${levelInfo.level}` : 'Playground Overview'}
              </span>
              {player && (
                <span className="font-mono-tech text-[11px] font-bold text-[var(--studio-amber-text)]">
                  {player.xp} XP
                </span>
              )}
            </div>

            {player ? (
              <div className="space-y-2 pb-2 border-b border-[var(--studio-border)]">
                <div className="font-heading font-bold text-lg text-[var(--studio-text)]">
                  {player.name} · {levelInfo.title}
                </div>
                <div className="h-2.5 rounded-full bg-[var(--studio-surface-2)] border border-[var(--studio-border)] overflow-hidden">
                  <div
                    className="h-full bg-[#2563EB]"
                    style={{ width: `${levelInfo.progressPercent}%` }}
                  />
                </div>
                <div className="flex justify-between font-mono-tech text-[10px] text-[var(--studio-text-muted)]">
                  <span>{player.gamesPlayed} Completed Runs</span>
                  <span>
                    {levelInfo.nextLevelXp ? `${levelInfo.nextLevelXp - player.xp} XP to next` : 'Max Rank'}
                  </span>
                </div>
              </div>
            ) : null}

            <div className="space-y-2.5 text-sm">
              <div className="flex items-center justify-between gap-2 pb-2 border-b border-[var(--studio-border)]">
                <span className="font-sora font-semibold text-[var(--studio-text)]">Mini-Games</span>
                <span className="font-mono-tech text-xs font-bold text-[var(--studio-emerald-text)]">
                  12 Interactive
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 pb-2 border-b border-[var(--studio-border)]">
                <span className="font-sora font-semibold text-[var(--studio-text)]">3D Car + Track Lab</span>
                <span className="font-mono-tech text-xs font-bold text-[var(--studio-cyan-text)]">
                  43 Parts · Dyno
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 pb-2 border-b border-[var(--studio-border)]">
                <span className="font-sora font-semibold text-[var(--studio-text)]">Smartphone Lab</span>
                <span className="font-mono-tech text-xs font-bold text-[var(--studio-purple-text)]">
                  38 Parts · Bench
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="font-sora font-semibold text-[var(--studio-text)]">Quiz Bank</span>
                <span className="font-mono-tech text-xs font-bold text-[var(--studio-amber-text)]">
                  {EASY_QUESTIONS.length}+ Qs · 6 Modes
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                arcadeAudio.playSfx('click');
                onOpenTrophyRoom();
              }}
              className="studio-btn studio-btn-amber w-full text-xs py-2.5"
            >
              <Trophy size={15} />
              <span>View Live Leaderboards</span>
            </button>
          </div>
        </div>
      </section>

      {/* TODAY'S 3-PART DAILY CHALLENGE + WEEKLY EVENT */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* 3-Part Daily Challenge */}
        <div className="lg:col-span-7 studio-card-solid p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="font-mono-tech text-xs font-bold uppercase tracking-wider text-[var(--studio-emerald-text)] flex items-center gap-1.5">
                <Calendar size={14} /> Today’s 3-Part Daily Challenge · {dailyTriple.date}
              </div>
              <h2 className="font-heading font-bold text-xl text-[var(--studio-text)] mt-0.5">
                Complete Quiz + Mini-Game + Builder Today
              </h2>
            </div>
            <span className="font-mono-tech text-xs font-bold text-[var(--studio-amber-text)]">
              Up to +{dailyTriple.quiz.xpReward + dailyTriple.miniGame.xpReward + dailyTriple.builder.xpReward} Bonus XP
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              {
                key: 'quiz',
                label: '1. Daily Quiz',
                title: dailyTriple.quiz.title,
                desc: dailyTriple.quiz.description,
                xp: dailyTriple.quiz.xpReward,
                done: dailyTriple.quiz.completed,
                onGo: onOpenEasyQuiz,
              },
              {
                key: 'miniGame',
                label: '2. Daily Mini-Game',
                title: dailyTriple.miniGame.title,
                desc: dailyTriple.miniGame.description,
                xp: dailyTriple.miniGame.xpReward,
                done: dailyTriple.miniGame.completed,
                onGo: () => handleLaunchMiniGame(dailyTriple.miniGame.gameId),
              },
              {
                key: 'builder',
                label: '3. Daily 3D Test',
                title: dailyTriple.builder.title,
                desc: dailyTriple.builder.description,
                xp: dailyTriple.builder.xpReward,
                done: dailyTriple.builder.completed,
                onGo: () => {
                  if (dailyTriple.builder.studio === 'auto-engineer') {
                    if (onOpenSimulator) onOpenSimulator('car-track');
                    else onOpenAutoEngineer();
                  } else if (onOpenSimulator) {
                    onOpenSimulator('phone-lab');
                  } else {
                    onOpenPhoneDesigner();
                  }
                },
              },
            ].map((slot) => (
              <div
                key={slot.key}
                className={`p-4 rounded-xl border-2 flex flex-col justify-between gap-3 ${
                  slot.done
                    ? 'studio-well border-[#10B981]'
                    : 'studio-well border-[var(--studio-border-strong)]'
                }`}
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-1 font-mono-tech text-[10px] font-bold">
                    <span className={slot.done ? 'text-[var(--studio-emerald-text)]' : 'text-[var(--studio-accent-text)]'}>
                      {slot.label}
                    </span>
                    {slot.done ? (
                      <CheckCircle2 size={15} className="text-[var(--studio-emerald-text)]" />
                    ) : (
                      <Circle size={14} className="text-[var(--studio-text-muted)]" />
                    )}
                  </div>
                  <div className="font-heading font-bold text-sm text-[var(--studio-text)]">
                    {slot.title}
                  </div>
                  <p className="text-xs text-[var(--studio-text-secondary)] leading-relaxed">
                    {slot.desc}
                  </p>
                </div>

                <div className="flex items-center justify-between gap-2 pt-1">
                  <span className="font-mono-tech text-[11px] font-bold text-[var(--studio-amber-text)]">
                    {slot.done ? 'CLAIMED' : `+${slot.xp} XP`}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      arcadeAudio.playSfx('click');
                      slot.onGo();
                    }}
                    className={`studio-btn text-[11px] px-3 py-1.5 min-h-[32px] ${
                      slot.done ? 'studio-btn-ghost' : 'studio-btn-primary'
                    }`}
                  >
                    {slot.done ? 'Replay' : 'Start'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Weekly Event Spotlight */}
        <div className="lg:col-span-5 studio-card-solid p-6 flex flex-col justify-between gap-4 border-2 border-[#8B5CF6]/50">
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono-tech text-xs font-bold uppercase tracking-wider text-[var(--studio-purple-text)] flex items-center gap-1.5">
                <Flame size={14} /> Weekly Event · {weeklyEvent.weekId}
              </span>
              <span className="font-mono-tech text-[11px] font-bold px-2.5 py-0.5 rounded bg-[#7C3AED] text-white">
                {weeklyEvent.endsInLabel}
              </span>
            </div>
            <h2 className="font-heading font-bold text-2xl text-[var(--studio-text)]">
              {weeklyEvent.title}
            </h2>
            <div className="font-sora font-semibold text-xs text-[var(--studio-cyan-text)]">
              {weeklyEvent.subtitle}
            </div>
            <p className="text-xs sm:text-sm text-[var(--studio-text-secondary)] leading-relaxed">
              {weeklyEvent.ruleSummary}
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[var(--studio-border)]">
            <span className="font-mono-tech text-xs font-bold text-[var(--studio-amber-text)]">
              Event Reward: +{weeklyEvent.bonusXp} Bonus XP
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  arcadeAudio.playSfx('click');
                  if (onOpenLeaderboard) onOpenLeaderboard(weeklyEvent.featuredGameId);
                  else onOpenTrophyRoom();
                }}
                className="studio-btn studio-btn-ghost text-xs px-3 py-2"
              >
                Standings
              </button>
              <button
                type="button"
                onClick={() => {
                  arcadeAudio.playSfx('gameStart');
                  const fid = weeklyEvent.featuredGameId;
                  if (fid.startsWith('car-test-')) {
                    if (onOpenSimulator) onOpenSimulator(fid === 'car-test-slalom' ? 'car-track' : 'car-track');
                    else onOpenAutoEngineer();
                  } else {
                    handleLaunchMiniGame(fid as GameModeId);
                  }
                }}
                className="studio-btn studio-btn-purple text-xs px-4 py-2"
              >
                <Rocket size={14} /> Enter Event
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURED MINI-GAMES QUICK LAUNCH */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="font-mono-tech text-xs font-bold uppercase tracking-wider text-[var(--studio-cyan-text)]">
              Featured Engineering Mini-Games
            </div>
            <h2 className="font-heading font-bold text-2xl text-[var(--studio-text)] mt-0.5">
              Quick-Launch 12 Interactive Games
            </h2>
          </div>
          <button
            type="button"
            onClick={() => {
              arcadeAudio.playSfx('click');
              onOpenArena();
            }}
            className="studio-btn studio-btn-ghost text-xs px-4 py-2"
          >
            <span>Browse All 12 Mini-Games</span>
            <ArrowRight size={14} />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {spotlightMiniGames.map((mg) => {
            const pb = eventsData?.personalBests?.[mg.id];
            return (
              <div
                key={mg.id}
                className="studio-card-solid p-5 flex flex-col justify-between gap-3 hover:border-[var(--studio-accent-text)] transition-colors"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className="px-2 py-0.5 rounded font-mono-tech text-[10px] font-bold uppercase text-white"
                      style={{ backgroundColor: mg.accentColor }}
                    >
                      {mg.category}
                    </span>
                    <span className="font-mono-tech text-[10px] font-bold text-[var(--studio-text-muted)]">
                      {mg.difficulty}
                    </span>
                  </div>
                  <h3 className="font-heading font-bold text-lg text-[var(--studio-text)]">
                    {mg.title}
                  </h3>
                  <p className="text-xs text-[var(--studio-text-secondary)] leading-relaxed">
                    {mg.tagline}
                  </p>
                  {pb && (
                    <div className="font-mono-tech text-[11px] font-bold text-[var(--studio-emerald-text)]">
                      Your Best: {pb.bestScore} pts
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => handleLaunchMiniGame(mg.id)}
                  className="studio-btn studio-btn-primary w-full text-xs py-2"
                >
                  <Play size={13} fill="currentColor" /> Play
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* THREE FLAGSHIP EXPERIENCES (PRESERVED) */}
      <section className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <div className="font-mono-tech text-xs font-bold uppercase tracking-wider text-[var(--studio-accent-text)]">
              Interactive Studios &amp; Simulators
            </div>
            <h2 className="font-heading font-bold text-2xl sm:text-3xl text-[var(--studio-text)] mt-0.5">
              Choose Your Studio Mission
            </h2>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {featuredExperiences.map((exp) => {
            const Icon = exp.icon;
            return (
              <div
                key={exp.id}
                className="studio-card-interactive overflow-hidden flex flex-col justify-between group"
              >
                <div>
                  <div className="relative aspect-video w-full overflow-hidden bg-[#0B1120] border-b border-[var(--studio-border)]">
                    <img
                      src={exp.image}
                      alt={exp.title}
                      loading="eager"
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display = 'none';
                      }}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#090E1A]/85 via-transparent to-transparent" />
                  </div>

                  <div className="p-6 space-y-2.5">
                    <div className="flex items-center gap-2 font-mono-tech text-xs font-bold text-[var(--studio-accent-text)]">
                      <Icon size={14} />
                      <span>{exp.kicker}</span>
                    </div>
                    <h3 className="font-heading font-bold text-xl sm:text-2xl text-[var(--studio-text)]">
                      {exp.title}
                    </h3>
                    <p className="text-sm text-[var(--studio-text-secondary)] leading-relaxed">
                      {exp.description}
                    </p>
                  </div>
                </div>

                <div className="px-6 pb-6 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      arcadeAudio.playSfx('gameStart');
                      exp.onClick();
                    }}
                    className={`w-full studio-btn ${exp.btnClass} text-sm py-3`}
                  >
                    <span>{exp.cta}</span>
                    <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* REAL RECOMMENDATION + LEADERBOARD PREVIEW + LEVEL MILESTONES */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Global Playground Leaderboard Preview */}
        <div className="lg:col-span-7 studio-card-solid p-6 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="font-mono-tech text-xs font-bold uppercase text-[var(--studio-amber-text)]">
                Live Global Playground Rankings
              </div>
              <h2 className="font-heading font-bold text-xl text-[var(--studio-text)]">
                Top Engineers (Verified Runs)
              </h2>
            </div>
            <button
              type="button"
              onClick={() => {
                arcadeAudio.playSfx('click');
                if (onOpenLeaderboard) onOpenLeaderboard('all');
                else onOpenTrophyRoom();
              }}
              className="studio-btn studio-btn-ghost text-xs px-3.5 py-2"
            >
              Full Leaderboard →
            </button>
          </div>

          {boardUnavailable ? (
            <div className="p-5 studio-well text-center text-sm text-[var(--studio-text-secondary)]">
              Leaderboard data unavailable right now.
            </div>
          ) : globalTop5.length === 0 ? (
            <div className="p-5 studio-well text-center space-y-2">
              <p className="text-sm text-[var(--studio-text-secondary)]">
                No playground runs recorded yet. Complete any mini-game to claim #1!
              </p>
              <button
                type="button"
                onClick={() => handleLaunchMiniGame('reaction-test')}
                className="studio-btn studio-btn-primary text-xs px-4 py-2"
              >
                Play Reaction Test
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {globalTop5.map((row) => (
                <div
                  key={row.userId}
                  className="p-3 rounded-xl studio-well flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="font-mono-tech text-xs font-bold text-[var(--studio-amber-text)] w-8 shrink-0">
                      #{row.rank}
                    </span>
                    <div className="min-w-0">
                      <div className="font-sora font-bold text-sm text-[var(--studio-text)] truncate">
                        {row.username}
                      </div>
                      <div className="font-mono-tech text-[10px] text-[var(--studio-text-muted)]">
                        LVL {row.level} · {row.gamesPlayed} plays · {row.accuracy}% avg acc
                      </div>
                    </div>
                  </div>
                  <div className="font-mono-tech text-sm font-bold text-[var(--studio-emerald-text)] shrink-0">
                    {row.totalPoints} pts
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Milestones + Recent Achievements + Personalized Recommendation */}
        <div className="lg:col-span-5 space-y-4">
          {recommendation && (
            <div className="studio-card-solid p-5 space-y-2.5 border-2 border-[#06B6D4]/50">
              <div className="font-mono-tech text-[11px] font-bold uppercase text-[var(--studio-cyan-text)]">
                {recommendation.reason}
              </div>
              <h3 className="font-heading font-bold text-lg text-[var(--studio-text)]">
                Try Next: {recommendation.title}
              </h3>
              <p className="text-xs text-[var(--studio-text-secondary)]">
                {recommendation.desc}
              </p>
              <button
                type="button"
                onClick={() => handleLaunchMiniGame(recommendation.gameId)}
                className="studio-btn studio-btn-cyan text-xs px-4 py-2"
              >
                <Play size={13} fill="currentColor" /> Launch Recommended
              </button>
            </div>
          )}

          <div className="studio-card-solid p-5 space-y-3">
            <div className="font-mono-tech text-xs font-bold uppercase text-[var(--studio-purple-text)] flex items-center gap-1.5">
              <Award size={14} /> Level 1–50 Engineering Roadmap
            </div>
            <div className="grid grid-cols-2 gap-2">
              {PROGRESSION_MILESTONES.map((m) => {
                const reached = (player?.level ?? 1) >= m.level;
                return (
                  <div
                    key={m.level}
                    className={`p-2.5 rounded-lg border text-xs ${
                      reached
                        ? 'studio-well border-[#10B981]'
                        : 'studio-well border-[var(--studio-border)] opacity-75'
                    }`}
                  >
                    <div className="font-mono-tech font-bold text-[10px] text-[var(--studio-accent-text)]">
                      LVL {m.level} · {m.minXp.toLocaleString()} XP
                    </div>
                    <div className="font-sora font-bold text-[var(--studio-text)] truncate">
                      {m.title}
                    </div>
                  </div>
                );
              })}
            </div>

            {recentAchievements.length > 0 && (
              <div className="pt-2 border-t border-[var(--studio-border)] space-y-1.5">
                <div className="font-mono-tech text-[10px] font-bold text-[var(--studio-amber-text)]">
                  Recent Unlocked Achievements
                </div>
                {recentAchievements.map((a) => (
                  <div key={a.id} className="text-xs text-[var(--studio-text-secondary)] flex justify-between">
                    <span className="font-bold text-[var(--studio-emerald-text)]">{a.name}</span>
                    <span className="font-mono-tech text-[11px] text-[var(--studio-amber-text)]">+{a.xpBonus} XP</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* RECENT CREATIONS & CONTINUE PLAYING (PRESERVED) */}
      {(recentCreations.length > 0 || analytics?.hasData) && (
        <section className="studio-card-solid p-5 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-heading font-bold text-lg text-[var(--studio-text)]">
                {recentCreations.length > 0 ? 'Continue Playing · Saved 3D Creations' : 'Your Progress Snapshot'}
              </h2>
              {analytics?.hasData && (
                <p className="font-mono-tech text-xs font-bold text-[var(--studio-accent-text)]">
                  {analytics.streaks.examXp} Exam XP · {analytics.overallAccuracy}% Accuracy · {analytics.streaks.dailyStreak}d Streak
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                arcadeAudio.playSfx('click');
                onOpenArena();
              }}
              className="studio-btn studio-btn-ghost text-xs px-3.5 py-2 min-h-[36px]"
            >
              <span>Explore Game Arena</span>
              <ArrowRight size={14} />
            </button>
          </div>

          {recentCreations.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {recentCreations.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    arcadeAudio.playSfx('click');
                    onOpenCreation(c);
                  }}
                  className="p-3.5 rounded-xl studio-well hover:border-[var(--studio-accent-text)] text-left flex items-center gap-3 cursor-pointer transition-colors"
                >
                  {c.previewDataUrl ? (
                    <img
                      src={c.previewDataUrl}
                      alt={c.title}
                      className="w-16 h-12 rounded-lg object-cover border border-[var(--studio-border)] shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-[#2563EB] text-white flex items-center justify-center shrink-0">
                      {c.type === 'car' ? <Car size={20} /> : <Smartphone size={20} />}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="font-sora font-bold text-sm text-[var(--studio-text)] truncate">
                      {c.title}
                    </div>
                    <div className="font-mono-tech text-[11px] font-bold text-[var(--studio-accent-text)]">
                      {c.type === 'car' ? '3D Car Build' : 'Phone Design'} · Rating {c.designRating}/100
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
};

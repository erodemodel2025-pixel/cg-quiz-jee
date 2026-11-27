import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowRight,
  BrainCircuit,
  Car,
  Code2,
  Cpu,
  Flag,
  Gauge,
  GraduationCap,
  Layers,
  Play,
  Rocket,
  Search,
  Smartphone,
  Sparkles,
  Swords,
  Trophy,
  Wrench,
  Zap,
} from 'lucide-react';
import { PLAYGROUND_MINIGAMES } from '../../shared/progression.ts';
import type { GameModeId, PlaygroundGameCategory, QuizMode } from '../../shared/types.ts';
import { arcadeAudio } from '../audio/arcadeAudio.ts';
import type { ArenaFilterTab } from '../components/TopNav.tsx';
import { useArcade } from '../context/ArcadeContext.tsx';
import { safeFetchJson } from '../utils/apiClient.ts';

interface ArcadeHubPageProps {
  initialTab?: ArenaFilterTab;
  onTabChange?: (tab: ArenaFilterTab) => void;
  onSelectGame: (game: GameModeId, quizMode?: QuizMode) => void;
  onOpenAutoEngineer: () => void;
  onOpenPhoneDesigner: () => void;
  onOpenSimulator?: (sim: 'car-track' | 'car-dyno' | 'car-drag' | 'phone-lab') => void;
  onOpenLeaderboard?: (gameId: GameModeId) => void;
}

const CATEGORY_CHIPS: Array<'All' | PlaygroundGameCategory> = [
  'All',
  'Physics',
  'Tech',
  'Engineering',
  'Reaction',
  'Memory',
  'Building',
];

const DIFFICULTY_CHIPS = ['All', 'Easy', 'Medium', 'Hard'] as const;

const CLASSIC_LABS: Array<{
  id: GameModeId;
  title: string;
  subtitle: string;
  description: string;
  color: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}> = [
  {
    id: 'iq-quiz',
    title: 'Engineering IQ Challenge',
    subtitle: '12 Disciplines · Practice & Ranked',
    description:
      'Multiple-choice engineering challenges with progressive difficulty, combo streaks, and textbook explanations.',
    color: '#0284C7',
    icon: GraduationCap,
  },
  {
    id: 'circuit-rush',
    title: 'Circuit Rush',
    subtitle: '2D Grid · Live Current Flow',
    description:
      'Rotate PCB wire segments and complete energized closed circuits from 5V/12V rails to the load.',
    color: '#D97706',
    icon: Zap,
  },
  {
    id: 'code-breaker',
    title: 'Code Breaker',
    subtitle: 'C · C++ · Python · Java · Web',
    description:
      'Predict program outputs, spot elusive bugs, and analyze algorithmic complexity in a fast terminal.',
    color: '#059669',
    icon: Code2,
  },
  {
    id: 'boss-battle',
    title: 'Engineering Boss Battle',
    subtitle: 'Multi-Round · 2x Critical Strikes',
    description:
      'Face the Entropy Golem! Correct answers fire laser damage; mistakes drain your energy shield.',
    color: '#EA580C',
    icon: Swords,
  },
  {
    id: 'logic-lab',
    title: 'Logic Lab',
    subtitle: 'Boolean Gates · Gears · Math Patterns',
    description:
      'Solve digital logic gate schematics, binary/hex conversions, compound gear trains, and engineering probability.',
    color: '#7C3AED',
    icon: BrainCircuit,
  },
  {
    id: 'component-match',
    title: 'Component Match',
    subtitle: 'Fast Hardware Memory Blitz',
    description:
      'Pair electronic components—resistors, MOSFETs, op-amps, sensors—with their schematic symbols and functions.',
    color: '#2563EB',
    icon: Cpu,
  },
];

export const ArcadeHubPage: React.FC<ArcadeHubPageProps> = ({
  initialTab = 'all',
  onTabChange,
  onSelectGame,
  onOpenAutoEngineer,
  onOpenPhoneDesigner,
  onOpenSimulator,
  onOpenLeaderboard,
}) => {
  const { player, setMusicMode } = useArcade();

  const [activeTab, setActiveTab] = useState<ArenaFilterTab>(initialTab);
  const [catFilter, setCatFilter] = useState<'All' | PlaygroundGameCategory>('All');
  const [diffFilter, setDiffFilter] = useState<(typeof DIFFICULTY_CHIPS)[number]>('All');
  const [search, setSearch] = useState('');
  const [personalBests, setPersonalBests] = useState<
    Record<string, { bestScore: number; bestTimeMs: number; plays: number }>
  >({});

  useEffect(() => {
    setMusicMode('home');
  }, [setMusicMode]);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    const uid = player?.id || '';
    void safeFetchJson<{
      personalBests?: Record<string, { bestScore: number; bestTimeMs: number; plays: number }>;
    }>(`/api/playground/events?userId=${encodeURIComponent(uid)}`).then((res) => {
      if (res.ok && res.data?.personalBests) {
        setPersonalBests(res.data.personalBests);
      }
    });
  }, [player?.id]);

  const handleSetTab = (tab: ArenaFilterTab) => {
    arcadeAudio.playSfx('click');
    setActiveTab(tab);
    onTabChange?.(tab);
  };

  const filteredMiniGames = useMemo(() => {
    const q = search.trim().toLowerCase();
    return PLAYGROUND_MINIGAMES.filter((g) => {
      if (catFilter !== 'All' && g.category !== catFilter) return false;
      if (diffFilter !== 'All' && g.difficulty !== diffFilter) return false;
      if (q && !g.title.toLowerCase().includes(q) && !g.tagline.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [catFilter, diffFilter, search]);

  const showMiniGames = activeTab === 'all' || activeTab === 'minigames';
  const showBuilders = activeTab === 'all' || activeTab === 'builders';
  const showSimulators = activeTab === 'all' || activeTab === 'simulators';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8 relative z-10">
      {/* Arena Hero Header */}
      <div className="studio-card p-6 sm:p-8 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-1.5 font-mono-tech text-xs font-bold uppercase tracking-widest text-[var(--studio-accent-text)]">
            <Sparkles size={14} /> CG Engineering Playground · 12 Mini-Games &amp; 3D Simulators
          </div>
          <h1 className="font-heading font-bold text-2xl sm:text-4xl text-[var(--studio-text)]">
            Play, Build, Test &amp; Race
          </h1>
          <p className="text-sm sm:text-base text-[var(--studio-text-secondary)] max-w-2xl">
            Compete in 12 hands-on engineering mini-games with verified global leaderboards, build 3D cars &amp; smartphones, and run live track/lab simulations.
          </p>
        </div>

        <div className="flex flex-wrap gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => {
              arcadeAudio.playSfx('gameStart');
              onSelectGame('engineering-speedrun');
            }}
            className="studio-btn studio-btn-amber px-4 py-2.5 text-xs sm:text-sm"
          >
            <Rocket size={15} /> Play Speed Run
          </button>
          <button
            type="button"
            onClick={() => {
              arcadeAudio.playSfx('gameStart');
              onSelectGame('iq-quiz', 'competitive');
            }}
            className="studio-btn studio-btn-primary px-4 py-2.5 text-xs sm:text-sm"
          >
            <Trophy size={15} /> Ranked IQ Quiz
          </button>
        </div>
      </div>

      {/* SECTION TABS */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {(
            [
              { id: 'all', label: 'All Experiences' },
              { id: 'minigames', label: '12 Mini-Games' },
              { id: 'builders', label: '3D Builders (Car & Phone)' },
              { id: 'simulators', label: 'Track, Dyno & Lab Simulators' },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => handleSetTab(t.id)}
              className={`studio-btn text-xs sm:text-sm px-4 py-2 ${
                activeTab === t.id ? 'studio-btn-cyan' : 'studio-btn-ghost'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <span className="font-mono-tech text-xs font-bold text-[var(--studio-text-muted)]">
          12 Mini-Games · 2 3D CAD Studios · 4 Track/Lab Simulators · 6 Classic Labs
        </span>
      </div>

      {/* ============================================================
         SECTION 1: 12 INTERACTIVE ENGINEERING MINI-GAMES
         ============================================================ */}
      {showMiniGames && (
        <section className="space-y-4">
          <div className="studio-card-solid p-4 sm:p-5 space-y-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h2 className="font-heading font-bold text-xl text-[var(--studio-text)]">
                  Engineering Playground — 12 Interactive Mini-Games
                </h2>
                <p className="text-xs text-[var(--studio-text-secondary)]">
                  Every run validates completion bounds on the server, awards XP toward Level 1–50, and ranks you on game-specific leaderboards.
                </p>
              </div>
              <div className="relative w-full md:w-64">
                <Search
                  size={15}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--studio-text-muted)]"
                />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search mini-games..."
                  className="studio-input w-full pl-9 pr-3 py-2 text-xs"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div className="flex flex-wrap gap-1.5">
                {CATEGORY_CHIPS.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => {
                      arcadeAudio.playSfx('click');
                      setCatFilter(cat);
                    }}
                    className={`px-3 py-1.5 rounded-lg font-mono-tech text-[11px] font-bold cursor-pointer border transition-colors ${
                      catFilter === cat
                        ? 'bg-[#2563EB] border-[#60A5FA] text-white'
                        : 'bg-[var(--studio-surface-2)] border-[var(--studio-border)] text-[var(--studio-text-secondary)] hover:text-[var(--studio-text)]'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1.5">
                {DIFFICULTY_CHIPS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => {
                      arcadeAudio.playSfx('click');
                      setDiffFilter(d);
                    }}
                    className={`px-2.5 py-1 rounded-lg font-mono-tech text-[11px] font-bold cursor-pointer border ${
                      diffFilter === d
                        ? 'bg-[#D97706] border-[#FBBF24] text-white'
                        : 'bg-[var(--studio-surface-2)] border-[var(--studio-border)] text-[var(--studio-text-muted)]'
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {filteredMiniGames.length === 0 ? (
            <div className="studio-card-solid p-8 text-center space-y-3">
              <p className="text-sm text-[var(--studio-text-secondary)]">
                No mini-games match those filters.
              </p>
              <button
                type="button"
                onClick={() => {
                  setCatFilter('All');
                  setDiffFilter('All');
                  setSearch('');
                }}
                className="studio-btn studio-btn-ghost text-xs px-4"
              >
                Reset Filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredMiniGames.map((g, idx) => {
                const pb = personalBests[g.id];
                return (
                  <div
                    key={g.id}
                    className="studio-card-solid p-5 flex flex-col justify-between gap-4 hover:border-[var(--studio-accent-text)] transition-colors"
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className="px-2.5 py-1 rounded-md font-mono-tech text-[10px] font-bold uppercase text-white"
                          style={{ backgroundColor: g.accentColor }}
                        >
                          #{String(idx + 1).padStart(2, '0')} · {g.category}
                        </span>
                        <span
                          className={`font-mono-tech text-[10px] font-bold px-2 py-0.5 rounded border ${
                            g.difficulty === 'Easy'
                              ? 'text-[var(--studio-emerald-text)] border-[#10B981]'
                              : g.difficulty === 'Medium'
                                ? 'text-[var(--studio-amber-text)] border-[#F59E0B]'
                                : 'text-[var(--studio-rose-text)] border-[#FB7185]'
                          }`}
                        >
                          {g.difficulty}
                        </span>
                      </div>

                      <h3 className="font-heading font-bold text-lg text-[var(--studio-text)]">
                        {g.title}
                      </h3>
                      <p className="text-xs sm:text-sm text-[var(--studio-text-secondary)] leading-relaxed">
                        {g.tagline}
                      </p>

                      <div className="p-2.5 rounded-lg studio-well border border-[var(--studio-border)] flex items-center justify-between gap-2 text-[11px] font-mono-tech">
                        <span className="text-[var(--studio-text-muted)] truncate">
                          {g.controlsSummary}
                        </span>
                        {pb ? (
                          <span className="text-[var(--studio-emerald-text)] font-bold shrink-0">
                            PB: {pb.bestScore} pts
                          </span>
                        ) : (
                          <span className="text-[var(--studio-text-muted)] shrink-0">Unplayed</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          arcadeAudio.playSfx('gameStart');
                          onSelectGame(g.id, 'practice');
                        }}
                        className="flex-1 studio-btn studio-btn-primary text-xs py-2.5"
                      >
                        <Play size={14} fill="currentColor" /> Play Now
                      </button>
                      {onOpenLeaderboard && (
                        <button
                          type="button"
                          onClick={() => {
                            arcadeAudio.playSfx('click');
                            onOpenLeaderboard(g.id);
                          }}
                          title={`${g.title} Leaderboard`}
                          aria-label={`${g.title} Leaderboard`}
                          className="studio-btn studio-btn-ghost px-3 py-2.5 text-xs"
                        >
                          <Trophy size={14} className="text-[var(--studio-amber-text)]" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* ============================================================
         SECTION 2: TRACK, DYNO & PHONE TEST LAB SIMULATORS
         ============================================================ */}
      {showSimulators && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-heading font-bold text-xl text-[var(--studio-text)]">
                Real-Time Physics &amp; Hardware Test Simulators
              </h2>
              <p className="text-xs text-[var(--studio-text-secondary)]">
                Drive your custom 3D car on a proving ground track, pull an RPM dyno sweep, or stress-test smartphones in the Engineering Lab.
              </p>
            </div>
            <span className="font-mono-tech text-[10px] font-bold px-2.5 py-1 rounded bg-[var(--studio-surface-2)] border border-[var(--studio-border-strong)] text-[var(--studio-cyan-text)]">
              SIMULATION · TELEMETRY ENABLED
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                id: 'car-track' as const,
                title: '3D Car Test Track & 0–100',
                desc: 'Steer, accelerate, brake, and run timed 0–100 km/h, Top Speed, Braking, or Cone Slalom runs.',
                badge: '3D Driving',
                color: '#06B6D4',
                icon: Gauge,
                pbKey: 'car-test-0-100',
              },
              {
                id: 'car-dyno' as const,
                title: 'Engine Dyno Lab',
                desc: 'Inspect torque & horsepower vs RPM curves across aspirated, turbo, supercharged & EV tunes.',
                badge: 'Torque Curve',
                color: '#2563EB',
                icon: Activity,
                pbKey: 'car-test-topspeed',
              },
              {
                id: 'car-drag' as const,
                title: 'Drag Strip vs AI',
                desc: 'Launch against Easy, Medium, or Hard AI opponents on a straight proving-ground drag lane.',
                badge: 'AI Race',
                color: '#F97316',
                icon: Flag,
                pbKey: 'car-test-drag',
              },
              {
                id: 'phone-lab' as const,
                title: 'Smartphone Test Lab',
                desc: 'Battery drain, 120Hz display, 5x zoom, thermal bench, USB charging & 200-pt budget challenge.',
                badge: '200-Pt Challenge',
                color: '#8B5CF6',
                icon: Wrench,
                pbKey: 'phone-test-lab',
              },
            ].map((sim) => {
              const Icon = sim.icon;
              const pb = personalBests[sim.pbKey];
              return (
                <div
                  key={sim.id}
                  className="studio-card-solid p-5 flex flex-col justify-between gap-4 hover:border-[var(--studio-accent-text)] transition-colors"
                >
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className="w-10 h-10 rounded-xl text-white flex items-center justify-center shrink-0"
                        style={{ backgroundColor: sim.color }}
                      >
                        <Icon size={20} />
                      </span>
                      <span className="font-mono-tech text-[10px] font-bold px-2 py-0.5 rounded bg-[var(--studio-surface-2)] border border-[var(--studio-border)] text-[var(--studio-accent-text)]">
                        {sim.badge}
                      </span>
                    </div>
                    <h3 className="font-heading font-bold text-base sm:text-lg text-[var(--studio-text)]">
                      {sim.title}
                    </h3>
                    <p className="text-xs text-[var(--studio-text-secondary)] leading-relaxed">
                      {sim.desc}
                    </p>
                    {pb && (
                      <div className="font-mono-tech text-[11px] font-bold text-[var(--studio-emerald-text)]">
                        Best Verified Score: {pb.bestScore} pts
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      arcadeAudio.playSfx('gameStart');
                      if (onOpenSimulator) {
                        onOpenSimulator(sim.id);
                      } else if (sim.id === 'phone-lab') {
                        onOpenPhoneDesigner();
                      } else {
                        onOpenAutoEngineer();
                      }
                    }}
                    className="studio-btn studio-btn-cyan w-full text-xs py-2.5"
                  >
                    <Play size={14} fill="currentColor" /> Launch Simulator
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ============================================================
         SECTION 3: FEATURED 3D CREATION STUDIOS (PRESERVED)
         ============================================================ */}
      {showBuilders && (
        <section className="space-y-4">
          <h2 className="font-heading font-bold text-xl text-[var(--studio-text)]">
            Featured 3D Design &amp; Engineering Studios
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Game 1: Car Tuning Engineering Simulator */}
            <div className="studio-card-interactive overflow-hidden flex flex-col justify-between group">
              <div>
                <div className="relative aspect-[16/9] w-full overflow-hidden bg-[#0B1120] border-b border-[var(--studio-border)]">
                  <img
                    src="/src/assets/images/card_auto_engineer_1795174514567.jpg"
                    alt="Car Tuning Engineering Simulator 3D CAD Studio"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#090E1A]/85 via-transparent to-transparent" />
                </div>
                <div className="p-6 space-y-2">
                  <div className="flex items-center gap-2 text-[var(--studio-cyan-text)] font-mono-tech text-xs font-bold">
                    <Car size={15} /> Sim 01 · 3D Automotive CAD · 43 Subsystems · Test Track &amp; Dyno
                  </div>
                  <h3 className="font-heading font-bold text-2xl text-[var(--studio-text)]">
                    Car Tuning Engineering Simulator
                  </h3>
                  <p className="text-sm text-[var(--studio-text-secondary)] leading-relaxed">
                    Customize paint, body kit, wheels, spoiler, neon, engine &amp; suspension in real-time 3D, inspect 43 engineering subsystems, and test drive your machine on the 3D proving ground!
                  </p>
                </div>
              </div>
              <div className="px-6 pb-6 flex flex-col sm:flex-row gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    arcadeAudio.playSfx('gameStart');
                    onOpenAutoEngineer();
                  }}
                  className="flex-1 studio-btn studio-btn-cyan text-sm py-3"
                >
                  <span>Launch Car Studio</span>
                  <ArrowRight size={16} />
                </button>
                {onOpenSimulator && (
                  <button
                    type="button"
                    onClick={() => {
                      arcadeAudio.playSfx('gameStart');
                      onOpenSimulator('car-track');
                    }}
                    className="studio-btn studio-btn-primary text-xs sm:text-sm py-3 px-4"
                  >
                    <Gauge size={16} />
                    <span>Test Track</span>
                  </button>
                )}
              </div>
            </div>

            {/* Game 2: Smartphone Engineering Lab */}
            <div className="studio-card-interactive overflow-hidden flex flex-col justify-between group">
              <div>
                <div className="relative aspect-[16/9] w-full overflow-hidden bg-[#0B1120] border-b border-[var(--studio-border)]">
                  <img
                    src="/src/assets/images/card_phone_designer_1795174514396.jpg"
                    alt="Smartphone Engineering Lab 3D Hardware Studio"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#090E1A]/85 via-transparent to-transparent" />
                </div>
                <div className="p-6 space-y-2">
                  <div className="flex items-center gap-2 text-[var(--studio-purple-text)] font-mono-tech text-xs font-bold">
                    <Smartphone size={15} /> Sim 02 · 3D Hardware CAD · 38 Parts · Test Lab &amp; 200-Pt Budget
                  </div>
                  <h3 className="font-heading font-bold text-2xl text-[var(--studio-text)]">
                    Smartphone Engineering Lab
                  </h3>
                  <p className="text-sm text-[var(--studio-text-secondary)] leading-relaxed">
                    Configure screen wake, camera lenses, protective cases, 11 internal bays (SoC, LPDDR5X, Vapor Chamber, Li-Ion BMS, Qi2), plug USB power, and benchmark inside the Test Lab.
                  </p>
                </div>
              </div>
              <div className="px-6 pb-6 flex flex-col sm:flex-row gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    arcadeAudio.playSfx('gameStart');
                    onOpenPhoneDesigner();
                  }}
                  className="flex-1 studio-btn studio-btn-purple text-sm py-3"
                >
                  <span>Open Phone Lab</span>
                  <ArrowRight size={16} />
                </button>
                {onOpenSimulator && (
                  <button
                    type="button"
                    onClick={() => {
                      arcadeAudio.playSfx('gameStart');
                      onOpenSimulator('phone-lab');
                    }}
                    className="studio-btn studio-btn-amber text-xs sm:text-sm py-3 px-4"
                  >
                    <Layers size={16} />
                    <span>Test Lab</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* CLASSIC ENGINEERING ARCADES (Preserved 6 Games) */}
      {(activeTab === 'all' || activeTab === 'minigames') && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-heading font-bold text-xl text-[var(--studio-text)]">
              Classic Engineering Arcade Modules
            </h2>
            <span className="font-mono-tech text-xs font-bold text-[var(--studio-text-muted)]">
              6 Classic Labs
            </span>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {CLASSIC_LABS.map((game) => {
              const Icon = game.icon;
              return (
                <div
                  key={game.id}
                  className="studio-card-solid p-5 flex flex-col justify-between gap-4 hover:border-[var(--studio-accent-text)] transition-colors"
                >
                  <div>
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <div
                        className="w-11 h-11 rounded-xl text-white flex items-center justify-center shadow-md shrink-0"
                        style={{ backgroundColor: game.color }}
                      >
                        <Icon size={22} />
                      </div>
                      <span className="font-mono-tech text-[11px] font-bold text-[var(--studio-text-muted)]">
                        {game.subtitle}
                      </span>
                    </div>

                    <h3 className="font-heading font-bold text-lg text-[var(--studio-text)] mb-1.5">
                      {game.title}
                    </h3>
                    <p className="text-xs sm:text-sm text-[var(--studio-text-secondary)] leading-relaxed">
                      {game.description}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      arcadeAudio.playSfx('gameStart');
                      onSelectGame(game.id, 'practice');
                    }}
                    className="studio-btn studio-btn-ghost w-full py-2.5 text-xs"
                  >
                    <Play size={14} fill="currentColor" /> Launch Game
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
};

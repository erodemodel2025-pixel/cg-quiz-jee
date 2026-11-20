import React, { useEffect } from 'react';
import {
  ArrowRight,
  BrainCircuit,
  Car,
  Code2,
  Cpu,
  GraduationCap,
  Play,
  Smartphone,
  Sparkles,
  Swords,
  Trophy,
  Zap,
} from 'lucide-react';
import type { GameModeId, QuizMode } from '../../shared/types.ts';
import { arcadeAudio } from '../audio/arcadeAudio.ts';
import { useArcade } from '../context/ArcadeContext.tsx';

interface ArcadeHubPageProps {
  onSelectGame: (game: GameModeId, quizMode?: QuizMode) => void;
  onOpenAutoEngineer: () => void;
  onOpenPhoneDesigner: () => void;
}

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
  onSelectGame,
  onOpenAutoEngineer,
  onOpenPhoneDesigner,
}) => {
  const { setMusicMode } = useArcade();

  useEffect(() => {
    setMusicMode('home');
  }, [setMusicMode]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-10 relative z-10">
      {/* Arena Hero Header */}
      <div className="studio-card p-6 sm:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-1.5 font-mono-tech text-xs font-bold uppercase tracking-widest text-[var(--studio-accent-text)]">
            <Sparkles size={14} /> CG Quiz Studio · Mini Game Arena
          </div>
          <h1 className="font-heading font-bold text-2xl sm:text-4xl text-[var(--studio-text)]">
            Design, Engineer &amp; Play Interactive Studios
          </h1>
          <p className="text-sm sm:text-base text-[var(--studio-text-secondary)] max-w-2xl">
            Build custom 3D machines, invent next-generation smartphones, or challenge yourself in our classic engineering simulations.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            arcadeAudio.playSfx('gameStart');
            onSelectGame('iq-quiz', 'competitive');
          }}
          className="studio-btn studio-btn-primary px-5 py-3 text-xs sm:text-sm shrink-0"
        >
          <Trophy size={16} /> Ranked IQ Competition
        </button>
      </div>

      {/* FEATURED CREATION GAMES: CAR STUDIO & NEXT iPHONE */}
      <section className="space-y-4">
        <h2 className="font-heading font-bold text-xl text-[var(--studio-text)]">
          Featured Interactive Design Studios
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
                  <Car size={15} /> Sim 01 · 3D Automotive CAD · 43 Subsystems · 7 Missions
                </div>
                <h3 className="font-heading font-bold text-2xl text-[var(--studio-text)]">
                  Car Tuning Engineering Simulator
                </h3>
                <p className="text-sm text-[var(--studio-text-secondary)] leading-relaxed">
                  Open the articulated hood, switch to Tech X-Ray or Exploded CAD view, click and learn 43 engineering components across Engine, Transmission, Suspension, Brakes, ECU &amp; Aero, and complete 7 engineering missions.
                </p>
              </div>
            </div>
            <div className="px-6 pb-6">
              <button
                type="button"
                onClick={() => {
                  arcadeAudio.playSfx('gameStart');
                  onOpenAutoEngineer();
                }}
                className="w-full studio-btn studio-btn-cyan text-sm py-3"
              >
                <span>Launch Car Engineering Simulator</span>
                <ArrowRight size={16} />
              </button>
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
                  <Smartphone size={15} /> Sim 02 · 3D Hardware CAD · 38 Parts · 7 Missions
                </div>
                <h3 className="font-heading font-bold text-2xl text-[var(--studio-text)]">
                  Smartphone Engineering Lab
                </h3>
                <p className="text-sm text-[var(--studio-text-secondary)] leading-relaxed">
                  Remove the rear glass or explode 7 hardware Z-layers in 3D, snap 11 internal bays into place (3nm SoC, LPDDR5X, Vapor Chamber, Li-Ion BMS, OIS Periscope, Qi2 Coil), pass real compatibility checks, and rank up.
                </p>
              </div>
            </div>
            <div className="px-6 pb-6">
              <button
                type="button"
                onClick={() => {
                  arcadeAudio.playSfx('gameStart');
                  onOpenPhoneDesigner();
                }}
                className="w-full studio-btn studio-btn-purple text-sm py-3"
              >
                <span>Open Smartphone Engineering Lab</span>
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* CLASSIC ENGINEERING ARCADES (Preserved 6 Games) */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-heading font-bold text-xl text-[var(--studio-text)]">
            Classic Engineering Mini-Games
          </h2>
          <span className="font-mono-tech text-xs font-bold text-[var(--studio-text-muted)]">
            6 Interactive Modules
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
    </div>
  );
};

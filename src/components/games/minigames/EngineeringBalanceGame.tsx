import React, { useMemo, useState } from 'react';
import { CheckCircle2, RotateCcw, Scale } from 'lucide-react';
import { getMiniGameDef } from '../../../../shared/progression.ts';
import { arcadeAudio } from '../../../audio/arcadeAudio.ts';
import { MiniGameShell } from '../shared/MiniGameShell.tsx';
import { UniversalResultScreen } from '../shared/UniversalResultScreen.tsx';
import { usePlaygroundSession } from '../shared/usePlaygroundSession.ts';
import type { MiniGameComponentProps } from './types.ts';

interface FixedWeight {
  pos: number; // -4..-1 or 1..4
  mass: number;
}

interface BalanceLevel {
  level: number;
  title: string;
  fixed: FixedWeight[];
  available: number[];
}

const LEVELS: BalanceLevel[] = [
  { level: 1, title: 'Level 1 · Simple Lever', fixed: [{ pos: -3, mass: 4 }], available: [3, 4, 6] },
  { level: 2, title: 'Level 2 · Asymmetric Arm', fixed: [{ pos: -4, mass: 3 }], available: [2, 4, 6] },
  { level: 3, title: 'Level 3 · Dual Offset', fixed: [{ pos: -3, mass: 6 }, { pos: 1, mass: 2 }], available: [4, 5, 8] },
  { level: 4, title: 'Level 4 · Crane Counterweight', fixed: [{ pos: 4, mass: 5 }, { pos: -1, mass: 2 }], available: [3, 6, 9] },
  { level: 5, title: 'Level 5 · Precision Truss', fixed: [{ pos: -4, mass: 6 }, { pos: -2, mass: 3 }, { pos: 2, mass: 3 }], available: [4, 6, 8] },
];

const SLOTS = [-4, -3, -2, -1, 1, 2, 3, 4];

export const EngineeringBalanceGame: React.FC<MiniGameComponentProps> = ({
  onExit,
  onNextChallenge,
  onOpenLeaderboard,
  onGoHome,
}) => {
  const def = getMiniGameDef('engineering-balance')!;
  const pg = usePlaygroundSession('engineering-balance');

  const [levelIdx, setLevelIdx] = useState(0);
  const [placed, setPlaced] = useState<Array<{ pos: number; mass: number; idx: number }>>([]);
  const [selectedRackIdx, setSelectedRackIdx] = useState<number | null>(0);
  const [score, setScore] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [feedback, setFeedback] = useState('Select a mass block, then tap any beam slot to balance Σ(m × d) = 0.');

  const level = LEVELS[levelIdx];

  const netTorque = useMemo(() => {
    const fixedSum = level.fixed.reduce((acc, w) => acc + w.mass * w.pos, 0);
    const placedSum = placed.reduce((acc, w) => acc + w.mass * w.pos, 0);
    return fixedSum + placedSum;
  }, [level, placed]);

  const tiltDeg = Math.max(-18, Math.min(18, netTorque * 0.7));
  const isBalanced = netTorque === 0 && placed.length > 0;

  const usedRackIndices = new Set(placed.map((p) => p.idx));
  const occupiedSlots = new Map<number, { mass: number; fixed: boolean; rackIdx?: number }>();
  for (const fw of level.fixed) {
    occupiedSlots.set(fw.pos, { mass: fw.mass, fixed: true });
  }
  for (const pw of placed) {
    occupiedSlots.set(pw.pos, { mass: pw.mass, fixed: false, rackIdx: pw.idx });
  }

  const handleSlotTap = (pos: number) => {
    if (pg.isPaused || pg.result) return;
    const existing = occupiedSlots.get(pos);
    if (existing) {
      if (existing.fixed) {
        arcadeAudio.playSfx('wrong');
        setFeedback('Fixed counterweight cannot be moved.');
        return;
      }
      arcadeAudio.playSfx('click');
      setPlaced((prev) => prev.filter((p) => p.pos !== pos));
      return;
    }

    if (selectedRackIdx === null || usedRackIndices.has(selectedRackIdx)) {
      const nextUnused = level.available.findIndex((_, i) => !usedRackIndices.has(i));
      if (nextUnused === -1) return;
      setSelectedRackIdx(nextUnused);
      const mass = level.available[nextUnused];
      arcadeAudio.playSfx('snap');
      setPlaced((prev) => [...prev, { pos, mass, idx: nextUnused }]);
      return;
    }

    const mass = level.available[selectedRackIdx];
    arcadeAudio.playSfx('snap');
    setPlaced((prev) => [...prev, { pos, mass, idx: selectedRackIdx }]);
    const nextIdx = level.available.findIndex((_, i) => i !== selectedRackIdx && !usedRackIndices.has(i));
    setSelectedRackIdx(nextIdx >= 0 ? nextIdx : null);
  };

  const handleLockVerify = () => {
    if (!isBalanced) {
      arcadeAudio.playSfx('wrong');
      setMistakes((m) => m + 1);
      setFeedback(`Beam unbalanced! Net torque = ${netTorque > 0 ? `+${netTorque}` : netTorque} N·m. Target is 0.`);
      return;
    }

    arcadeAudio.playSfx('correct');
    const gained = Math.max(180, 380 - mistakes * 20);
    const nextScore = score + gained;
    setScore(nextScore);

    if (levelIdx + 1 >= LEVELS.length) {
      const acc = Math.max(50, 100 - mistakes * 8);
      void pg.finishRun({
        score: nextScore,
        accuracy: acc,
        won: true,
        meta: { levelsCleared: LEVELS.length, mistakes },
      });
    } else {
      setLevelIdx((i) => i + 1);
      setPlaced([]);
      setSelectedRackIdx(0);
      setFeedback('Equilibrium locked! Next beam configuration loaded.');
    }
  };

  const handleRestart = () => {
    setLevelIdx(0);
    setPlaced([]);
    setSelectedRackIdx(0);
    setScore(0);
    setMistakes(0);
    setFeedback('Select a mass block, then tap any beam slot to balance Σ(m × d) = 0.');
    void pg.restartSession();
  };

  if (pg.result) {
    return (
      <UniversalResultScreen
        title={def.title}
        result={pg.result}
        rankUnavailable={pg.rankUnavailable}
        statusNote={pg.statusNote}
        primaryMetricLabel="Beams Stabilized"
        primaryMetricValue={`${LEVELS.length} / ${LEVELS.length}`}
        onPlayAgain={handleRestart}
        onNextChallenge={() => onNextChallenge('robot-control')}
        nextChallengeLabel="Robot Control"
        onLeaderboard={() => onOpenLeaderboard('engineering-balance')}
        onHome={onGoHome}
      />
    );
  }

  return (
    <MiniGameShell
      title={def.title}
      subtitle={level.title}
      howToPlay={def.howToPlay}
      controlsSummary={def.controlsSummary}
      elapsedSeconds={pg.elapsedSeconds}
      score={score}
      personalBest={pg.session?.personalBest ?? null}
      globalRank={pg.session?.globalRank ?? null}
      rankUnavailable={pg.session?.unavailable}
      isPaused={pg.isPaused}
      onTogglePause={pg.togglePause}
      onRestart={handleRestart}
      onExit={onExit}
      accentColor={def.accentColor}
      extraHudBadge={`NET TORQUE: ${netTorque > 0 ? `+${netTorque}` : netTorque}`}
    >
      <div className="studio-card-solid border-2 border-[var(--studio-border-strong)] p-4 sm:p-6 space-y-5">
        {/* SVG Live Fulcrum Simulation */}
        <div className="rounded-2xl bg-[#070E1E] border-2 border-[#1E3A5F] p-3">
          <svg viewBox="0 0 600 220" className="w-full h-auto">
            {/* Fulcrum Triangle */}
            <polygon points="300,130 272,195 328,195" fill="#1E293B" stroke="#38BDF8" strokeWidth="2.5" />
            <rect x="60" y="195" width="480" height="8" rx="4" fill="#334155" />

            {/* Rotating Beam */}
            <g transform={`rotate(${tiltDeg}, 300, 125)`} style={{ transition: 'transform 220ms ease-out' }}>
              <rect x="45" y="118" width="510" height="14" rx="5" fill="#0F172A" stroke={isBalanced ? '#34D399' : '#38BDF8'} strokeWidth="2.5" />
              {SLOTS.map((pos) => {
                const x = 300 + pos * 56;
                const occ = occupiedSlots.get(pos);
                return (
                  <g key={pos} onClick={() => handleSlotTap(pos)} className="cursor-pointer">
                    <circle cx={x} cy="125" r="7" fill="#38BDF8" />
                    <text x={x} y="148" textAnchor="middle" fill="#94A3B8" fontSize="11" fontWeight="700">
                      {pos > 0 ? `+${pos}m` : `${pos}m`}
                    </text>
                    {occ ? (
                      <g>
                        <rect
                          x={x - 20}
                          y={80}
                          width="40"
                          height="36"
                          rx="6"
                          fill={occ.fixed ? '#F59E0B' : '#0EA5E9'}
                          stroke="#FFFFFF"
                          strokeWidth="2"
                        />
                        <text x={x} y={102} textAnchor="middle" fill="#0F172A" fontSize="12" fontWeight="900">
                          {occ.mass}kg
                        </text>
                      </g>
                    ) : (
                      <rect
                        x={x - 18}
                        y={84}
                        width="36"
                        height="30"
                        rx="6"
                        fill="rgba(56,189,248,0.08)"
                        stroke="rgba(56,189,248,0.45)"
                        strokeDasharray="4 3"
                      />
                    )}
                  </g>
                );
              })}
            </g>
          </svg>
        </div>

        {/* Mass Block Rack & Verify Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono-tech text-xs font-bold text-[var(--studio-text-muted)] mr-1">
              MASS RACK:
            </span>
            {level.available.map((mass, idx) => {
              const used = usedRackIndices.has(idx);
              const selected = selectedRackIdx === idx;
              return (
                <button
                  key={`${mass}-${idx}`}
                  type="button"
                  disabled={used}
                  onClick={() => {
                    arcadeAudio.playSfx('click');
                    setSelectedRackIdx(idx);
                  }}
                  className={`px-4 py-2.5 min-h-[44px] rounded-xl font-mono-tech text-sm font-bold border-2 cursor-pointer transition-colors ${
                    used
                      ? 'opacity-35 bg-[var(--studio-surface-2)] border-[var(--studio-border)] cursor-not-allowed'
                      : selected
                      ? 'bg-[#2563EB] border-[#60A5FA] text-white'
                      : 'bg-[var(--studio-surface-2)] border-[var(--studio-border-strong)] text-[var(--studio-text)]'
                  }`}
                >
                  {mass} kg
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                arcadeAudio.playSfx('click');
                setPlaced([]);
                setSelectedRackIdx(0);
              }}
              className="studio-btn studio-btn-ghost px-3 py-2.5 min-h-[44px] text-xs"
            >
              <RotateCcw size={15} />
              <span>Clear</span>
            </button>
            <button
              type="button"
              onClick={handleLockVerify}
              className="studio-btn studio-btn-primary px-4 py-2.5 min-h-[44px] text-xs sm:text-sm"
            >
              {isBalanced ? <CheckCircle2 size={16} /> : <Scale size={16} />}
              <span>LOCK &amp; VERIFY</span>
            </button>
          </div>
        </div>

        <div className={`text-xs font-mono-tech font-bold ${isBalanced ? 'text-emerald-400' : 'text-[var(--studio-text-secondary)]'}`}>
          {isBalanced ? 'TORQUE EQUILIBRIUM ACHIEVED (Σ m·d = 0). Click LOCK & VERIFY!' : feedback}
        </div>
      </div>
    </MiniGameShell>
  );
};

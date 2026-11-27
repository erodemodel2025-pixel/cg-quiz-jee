import React, { useEffect, useMemo, useState } from 'react';
import { Cog, Play, RotateCcw } from 'lucide-react';
import { getMiniGameDef } from '../../../../shared/progression.ts';
import { arcadeAudio } from '../../../audio/arcadeAudio.ts';
import { MiniGameShell } from '../shared/MiniGameShell.tsx';
import { UniversalResultScreen } from '../shared/UniversalResultScreen.tsx';
import { usePlaygroundSession } from '../shared/usePlaygroundSession.ts';
import type { MiniGameComponentProps } from './types.ts';

type GearTeeth = 8 | 12 | 16 | 24;

interface PegDef {
  id: string;
  x: number;
  y: number;
  fixedTeeth?: GearTeeth;
  role: 'input' | 'idler' | 'output';
}

interface GearStage {
  title: string;
  inputRpm: number;
  targetOutputRpm: number;
  pegs: PegDef[];
  options: GearTeeth[];
  hint: string;
}

const STAGES: GearStage[] = [
  {
    title: 'Stage 1 · 2:1 Torque Reduction',
    inputRpm: 120,
    targetOutputRpm: 60,
    pegs: [
      { id: 'in', x: 130, y: 120, fixedTeeth: 12, role: 'input' },
      { id: 'mid', x: 250, y: 120, role: 'idler' },
      { id: 'out', x: 370, y: 120, role: 'output' },
    ],
    options: [8, 12, 16, 24],
    hint: 'Input is 12T at 120 RPM. For 60 RPM output, Output needs 24T (any idler works cleanly)!',
  },
  {
    title: 'Stage 2 · 2:1 Speed Overdrive',
    inputRpm: 100,
    targetOutputRpm: 200,
    pegs: [
      { id: 'in', x: 130, y: 120, fixedTeeth: 24, role: 'input' },
      { id: 'mid', x: 250, y: 120, role: 'idler' },
      { id: 'out', x: 370, y: 120, role: 'output' },
    ],
    options: [8, 12, 16, 24],
    hint: 'Input is 24T at 100 RPM. Mount a 12T output gear (with 16T or 12T idler) to reach 200 RPM!',
  },
  {
    title: 'Stage 3 · 3:1 Heavy Hoist Ratio',
    inputRpm: 180,
    targetOutputRpm: 60,
    pegs: [
      { id: 'in', x: 110, y: 120, fixedTeeth: 8, role: 'input' },
      { id: 'mid1', x: 205, y: 120, role: 'idler' },
      { id: 'mid2', x: 300, y: 120, role: 'idler' },
      { id: 'out', x: 395, y: 120, role: 'output' },
    ],
    options: [8, 12, 16, 24],
    hint: 'Input is 8T at 180 RPM. Place 24T on the final Output peg (with idlers filling mid pegs) for 60 RPM!',
  },
];

function drawGearPath(cx: number, cy: number, teeth: number, rOuter: number, rInner: number): string {
  const step = (Math.PI * 2) / (teeth * 2);
  let d = '';
  for (let i = 0; i < teeth * 2; i++) {
    const angle = i * step;
    const r = i % 2 === 0 ? rOuter : rInner;
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;
    d += `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)} `;
  }
  return `${d}Z`;
}

export const GearMachineGame: React.FC<MiniGameComponentProps> = ({
  onExit,
  onNextChallenge,
  onOpenLeaderboard,
  onGoHome,
}) => {
  const def = getMiniGameDef('gear-machine')!;
  const pg = usePlaygroundSession('gear-machine');

  const [stageIdx, setStageIdx] = useState(0);
  const [mounted, setMounted] = useState<Record<string, GearTeeth>>({});
  const [selectedTeeth, setSelectedTeeth] = useState<GearTeeth>(16);
  const [angleTick, setAngleTick] = useState(0);
  const [score, setScore] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [feedback, setFeedback] = useState<string>(STAGES[0].hint);

  const stage = STAGES[stageIdx];

  useEffect(() => {
    if (pg.isPaused || pg.result) return;
    const id = window.setInterval(() => setAngleTick((a) => (a + 4) % 360), 40);
    return () => window.clearInterval(id);
  }, [pg.isPaused, pg.result]);

  const drivetrain = useMemo(() => {
    const chain: Array<{ peg: PegDef; teeth: GearTeeth | null; rpm: number; dir: number }> = [];
    let allFilled = true;
    const inPeg = stage.pegs[0];
    const inTeeth = inPeg.fixedTeeth || mounted[inPeg.id] || 12;
    chain.push({ peg: inPeg, teeth: inTeeth, rpm: stage.inputRpm, dir: 1 });

    for (let i = 1; i < stage.pegs.length; i++) {
      const peg = stage.pegs[i];
      const teeth = peg.fixedTeeth || mounted[peg.id] || null;
      if (!teeth) {
        allFilled = false;
        chain.push({ peg, teeth: null, rpm: 0, dir: 0 });
      } else {
        const prev = chain[i - 1];
        const rpm = prev.teeth ? (prev.rpm * prev.teeth) / teeth : 0;
        chain.push({ peg, teeth, rpm: Math.round(rpm * 10) / 10, dir: -prev.dir });
      }
    }

    const outItem = chain[chain.length - 1];
    const matchesTarget =
      allFilled && outItem && Math.abs(outItem.rpm - stage.targetOutputRpm) < 0.5;
    return { chain, allFilled, outRpm: outItem?.rpm || 0, matchesTarget };
  }, [mounted, stage]);

  const handlePegClick = (peg: PegDef) => {
    if (peg.fixedTeeth || pg.isPaused || pg.result) return;
    if (mounted[peg.id] === selectedTeeth) {
      arcadeAudio.playSfx('click');
      setMounted((prev) => {
        const copy = { ...prev };
        delete copy[peg.id];
        return copy;
      });
      return;
    }
    arcadeAudio.playSfx('snap');
    setMounted((prev) => ({ ...prev, [peg.id]: selectedTeeth }));
  };

  const handleEngageDrivetrain = () => {
    if (!drivetrain.allFilled) {
      arcadeAudio.playSfx('wrong');
      setMistakes((m) => m + 1);
      setFeedback('Fill every intermediate and output axle peg first!');
      return;
    }
    if (!drivetrain.matchesTarget) {
      arcadeAudio.playSfx('wrong');
      setMistakes((m) => m + 1);
      setFeedback(
        `Output is ${drivetrain.outRpm} RPM — target is ${stage.targetOutputRpm} RPM. Swap gear teeth!`
      );
      return;
    }

    arcadeAudio.playSfx('correct');
    const stagePts = Math.max(350, 620 - mistakes * 40);
    const nextScore = score + stagePts;
    setScore(nextScore);

    if (stageIdx + 1 >= STAGES.length) {
      const acc = Math.max(55, 100 - mistakes * 10);
      void pg.finishRun({
        score: nextScore,
        rawMetric: drivetrain.outRpm,
        accuracy: acc,
        won: true,
        meta: { stagesCleared: STAGES.length, mistakes },
      });
    } else {
      const next = stageIdx + 1;
      setStageIdx(next);
      setMounted({});
      setFeedback(STAGES[next].hint);
    }
  };

  const handleRestart = () => {
    setStageIdx(0);
    setMounted({});
    setSelectedTeeth(16);
    setScore(0);
    setMistakes(0);
    setFeedback(STAGES[0].hint);
    void pg.restartSession();
  };

  if (pg.result) {
    return (
      <UniversalResultScreen
        title={def.title}
        result={pg.result}
        rankUnavailable={pg.rankUnavailable}
        statusNote={pg.statusNote}
        primaryMetricLabel="Target Output"
        primaryMetricValue={`${Math.round(pg.result.rawMetric)} RPM`}
        onPlayAgain={handleRestart}
        onNextChallenge={() => onNextChallenge('sort-circuit')}
        nextChallengeLabel="Sort the Circuit"
        onLeaderboard={() => onOpenLeaderboard('gear-machine')}
        onHome={onGoHome}
      />
    );
  }

  return (
    <MiniGameShell
      title={def.title}
      subtitle={stage.title}
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
      extraHudBadge={`TARGET ${stage.targetOutputRpm} RPM · NOW ${drivetrain.outRpm} RPM`}
    >
      <div className="studio-card-solid border-2 border-[var(--studio-border-strong)] p-4 sm:p-6 space-y-4">
        <div className="rounded-2xl bg-[#070E1E] border-2 border-[#1E3A5F] p-2">
          <svg viewBox="0 0 500 240" className="w-full h-auto touch-manipulation">
            <line x1="80" y1="120" x2="430" y2="120" stroke="#1E293B" strokeWidth="10" strokeLinecap="round" />
            {drivetrain.chain.map(({ peg, teeth, rpm, dir }) => {
              const rOuter = teeth ? 18 + teeth * 1.45 : 22;
              const rInner = rOuter - 7;
              const spinSpeed = drivetrain.allFilled ? (rpm / 60) * dir : 0;
              const rot = (angleTick * spinSpeed) % 360;

              return (
                <g key={peg.id} onClick={() => handlePegClick(peg)} className="cursor-pointer">
                  {teeth ? (
                    <g transform={`rotate(${rot}, ${peg.x}, ${peg.y})`}>
                      <path
                        d={drawGearPath(peg.x, peg.y, teeth, rOuter, rInner)}
                        fill={
                          peg.role === 'input'
                            ? '#0EA5E9'
                            : peg.role === 'output'
                            ? drivetrain.matchesTarget
                              ? '#10B981'
                              : '#F59E0B'
                            : '#8B5CF6'
                        }
                        stroke="#F8FAFC"
                        strokeWidth="1.5"
                      />
                    </g>
                  ) : (
                    <circle
                      cx={peg.x}
                      cy={peg.y}
                      r="20"
                      fill="rgba(56,189,248,0.1)"
                      stroke="#38BDF8"
                      strokeWidth="2"
                      strokeDasharray="4 3"
                    />
                  )}
                  <circle cx={peg.x} cy={peg.y} r="7" fill="#0F172A" stroke="#E2E8F0" strokeWidth="2" />
                  <text x={peg.x} y={peg.y + 66} textAnchor="middle" fill="#E2E8F0" fontSize="11" fontWeight="700">
                    {peg.role.toUpperCase()} {teeth ? `(${teeth}T)` : '(EMPTY)'}
                  </text>
                  <text x={peg.x} y={peg.y + 82} textAnchor="middle" fill="#38BDF8" fontSize="10" fontWeight="700">
                    {teeth ? `${rpm} RPM` : 'Tap to Mount'}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono-tech text-xs font-bold text-[var(--studio-text-muted)]">
              SELECT GEAR:
            </span>
            {stage.options.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  arcadeAudio.playSfx('click');
                  setSelectedTeeth(t);
                }}
                className={`px-3.5 py-2.5 min-h-[44px] rounded-xl font-mono-tech text-xs font-bold border-2 cursor-pointer inline-flex items-center gap-1.5 ${
                  selectedTeeth === t
                    ? 'bg-[#2563EB] border-[#60A5FA] text-white'
                    : 'bg-[var(--studio-surface-2)] border-[var(--studio-border)] text-[var(--studio-text)]'
                }`}
              >
                <Cog size={14} />
                <span>{t}T</span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMounted({})}
              className="studio-btn studio-btn-ghost px-3 py-2.5 min-h-[44px] text-xs"
            >
              <RotateCcw size={14} />
              <span>Clear</span>
            </button>
            <button
              type="button"
              onClick={handleEngageDrivetrain}
              className="studio-btn studio-btn-primary px-4 py-2.5 min-h-[44px] text-xs sm:text-sm"
            >
              <Play size={15} />
              <span>ENGAGE GEARS</span>
            </button>
          </div>
        </div>

        <div className={`text-xs font-mono-tech font-bold ${drivetrain.matchesTarget ? 'text-emerald-400' : 'text-[var(--studio-text-secondary)]'}`}>
          {feedback}
        </div>
      </div>
    </MiniGameShell>
  );
};

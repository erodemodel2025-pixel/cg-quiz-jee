import React, { useState } from 'react';
import { CheckCircle2, Flame, Power, Sliders, ToggleRight, Zap } from 'lucide-react';
import { getMiniGameDef } from '../../../../shared/progression.ts';
import { arcadeAudio } from '../../../audio/arcadeAudio.ts';
import { MiniGameShell } from '../shared/MiniGameShell.tsx';
import { UniversalResultScreen } from '../shared/UniversalResultScreen.tsx';
import { usePlaygroundSession } from '../shared/usePlaygroundSession.ts';
import type { MiniGameComponentProps } from './types.ts';

const STAGE_NAMES = [
  '1. Wire Bus',
  '2. Component Snap',
  '3. Switch Matrix',
  '4. Frequency Lock',
  '5. Machine Ignition',
];

export const EngineeringSpeedRunGame: React.FC<MiniGameComponentProps> = ({
  onExit,
  onNextChallenge,
  onOpenLeaderboard,
  onGoHome,
}) => {
  const def = getMiniGameDef('engineering-speedrun')!;
  const pg = usePlaygroundSession('engineering-speedrun');

  const [stage, setStage] = useState(0);
  const [score, setScore] = useState(0);
  const [mistakes, setMistakes] = useState(0);

  // Stage 1: Wire Bus (click VCC -> FUSE -> ECU in order)
  const [wireSeq, setWireSeq] = useState<string[]>([]);

  // Stage 2: Component Snap (click Core -> Fan -> Sensor)
  const [snapped, setSnapped] = useState<string[]>([]);

  // Stage 3: Switch Sequence (target [1,0,1,1])
  const [switches, setSwitches] = useState<[number, number, number, number]>([0, 0, 0, 0]);

  // Stage 4: Frequency Lock (target 60 Hz +/- 2)
  const [freq, setFreq] = useState(32);

  // Stage 5: Ignition Checklist (Prime -> Arm -> Start)
  const [ignSteps, setIgnSteps] = useState<string[]>([]);

  const completeStage = (pts: number) => {
    arcadeAudio.playSfx('correct');
    const nextScore = score + pts;
    setScore(nextScore);

    if (stage + 1 >= 5) {
      const speedBonus = Math.max(150, 950 - pg.elapsedSeconds * 14);
      const total = Math.min(3000, nextScore + speedBonus);
      setScore(total);
      const acc = Math.max(55, 100 - mistakes * 7);
      void pg.finishRun({
        score: total,
        rawMetric: pg.elapsedSeconds,
        accuracy: acc,
        won: true,
        meta: { mistakes, elapsedSeconds: pg.elapsedSeconds },
      });
    } else {
      setStage((s) => s + 1);
    }
  };

  const handleRestart = () => {
    setStage(0);
    setScore(0);
    setMistakes(0);
    setWireSeq([]);
    setSnapped([]);
    setSwitches([0, 0, 0, 0]);
    setFreq(32);
    setIgnSteps([]);
    void pg.restartSession();
  };

  if (pg.result) {
    return (
      <UniversalResultScreen
        title={def.title}
        result={pg.result}
        rankUnavailable={pg.rankUnavailable}
        statusNote={pg.statusNote}
        primaryMetricLabel="Sprint Time"
        primaryMetricValue={`${(pg.result.completionTimeMs / 1000).toFixed(2)}s`}
        onPlayAgain={handleRestart}
        onNextChallenge={() => onNextChallenge('reaction-test')}
        nextChallengeLabel="Reaction Test"
        onLeaderboard={() => onOpenLeaderboard('engineering-speedrun')}
        onHome={onGoHome}
      />
    );
  }

  return (
    <MiniGameShell
      title={def.title}
      subtitle={STAGE_NAMES[stage]}
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
      extraHudBadge={`STAGE ${stage + 1} / 5`}
    >
      <div className="studio-card-solid border-2 border-[var(--studio-border-strong)] p-5 sm:p-7 space-y-6">
        {/* Progress Stepper */}
        <div className="grid grid-cols-5 gap-2">
          {STAGE_NAMES.map((label, i) => (
            <div
              key={label}
              className={`px-2 py-2 rounded-xl text-center font-mono-tech text-[10px] sm:text-xs font-bold border ${
                i < stage
                  ? 'bg-emerald-950/70 border-emerald-400 text-emerald-300'
                  : i === stage
                  ? 'bg-[#2563EB] border-[#60A5FA] text-white'
                  : 'bg-[var(--studio-surface-2)] border-[var(--studio-border)] text-[var(--studio-text-muted)]'
              }`}
            >
              {label}
            </div>
          ))}
        </div>

        {/* Stage 1: Wire Bus */}
        {stage === 0 && (
          <div className="space-y-4">
            <h2 className="font-heading text-xl font-bold text-[var(--studio-text)]">
              Stage 1: Wire Power Bus in Order (VCC -&gt; FUSE -&gt; ECU)
            </h2>
            <div className="grid grid-cols-3 gap-3">
              {['ECU', 'VCC', 'FUSE'].map((node) => {
                const done = wireSeq.includes(node);
                const expected = ['VCC', 'FUSE', 'ECU'][wireSeq.length];
                return (
                  <button
                    key={node}
                    type="button"
                    disabled={done}
                    onClick={() => {
                      if (node === expected) {
                        arcadeAudio.playSfx('snap');
                        const next = [...wireSeq, node];
                        setWireSeq(next);
                        if (next.length === 3) completeStage(340);
                      } else {
                        arcadeAudio.playSfx('wrong');
                        setMistakes((m) => m + 1);
                      }
                    }}
                    className={`min-h-[80px] rounded-2xl border-2 font-heading text-lg font-bold cursor-pointer ${
                      done
                        ? 'bg-emerald-950 border-emerald-400 text-emerald-300'
                        : 'bg-[var(--studio-surface-2)] border-[var(--studio-border-strong)] text-[var(--studio-text)]'
                    }`}
                  >
                    <Zap size={18} className="inline mr-1.5" />
                    {node}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Stage 2: Component Snap */}
        {stage === 1 && (
          <div className="space-y-4">
            <h2 className="font-heading text-xl font-bold text-[var(--studio-text)]">
              Stage 2: Snap All 3 Drive Subsystems (CHIP -&gt; COOLER -&gt; SENSOR)
            </h2>
            <div className="grid grid-cols-3 gap-3">
              {['SENSOR', 'CHIP', 'COOLER'].map((item) => {
                const done = snapped.includes(item);
                const expected = ['CHIP', 'COOLER', 'SENSOR'][snapped.length];
                return (
                  <button
                    key={item}
                    type="button"
                    disabled={done}
                    onClick={() => {
                      if (item === expected) {
                        arcadeAudio.playSfx('snap');
                        const next = [...snapped, item];
                        setSnapped(next);
                        if (next.length === 3) completeStage(360);
                      } else {
                        arcadeAudio.playSfx('wrong');
                        setMistakes((m) => m + 1);
                      }
                    }}
                    className={`min-h-[80px] rounded-2xl border-2 font-heading text-lg font-bold cursor-pointer ${
                      done
                        ? 'bg-emerald-950 border-emerald-400 text-emerald-300'
                        : 'bg-[var(--studio-surface-2)] border-[var(--studio-border-strong)] text-[var(--studio-text)]'
                    }`}
                  >
                    <CheckCircle2 size={18} className="inline mr-1.5" />
                    {item}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Stage 3: Switch Matrix */}
        {stage === 2 && (
          <div className="space-y-4">
            <h2 className="font-heading text-xl font-bold text-[var(--studio-text)]">
              Stage 3: Set Breaker Code to [1 · 0 · 1 · 1]
            </h2>
            <div className="grid grid-cols-4 gap-3">
              {switches.map((val, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    arcadeAudio.playSfx('snap');
                    const copy: [number, number, number, number] = [...switches] as [
                      number,
                      number,
                      number,
                      number
                    ];
                    copy[i] = val ? 0 : 1;
                    setSwitches(copy);
                    if (copy[0] === 1 && copy[1] === 0 && copy[2] === 1 && copy[3] === 1) {
                      completeStage(380);
                    }
                  }}
                  className={`min-h-[84px] rounded-2xl border-2 font-mono-tech text-lg font-bold cursor-pointer ${
                    val
                      ? 'bg-[#2563EB] border-[#60A5FA] text-white'
                      : 'bg-[var(--studio-surface-2)] border-[var(--studio-border)] text-[var(--studio-text)]'
                  }`}
                >
                  <ToggleRight size={18} className="mx-auto mb-1" />
                  SW{i + 1}: {val}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Stage 4: Frequency Target Lock */}
        {stage === 3 && (
          <div className="space-y-4">
            <h2 className="font-heading text-xl font-bold text-[var(--studio-text)]">
              Stage 4: Tune Oscillator to 60 Hz (±2 Hz), then Lock Target
            </h2>
            <div className="p-4 rounded-2xl studio-well space-y-3">
              <div className="flex items-center justify-between font-mono-tech text-sm font-bold">
                <span>CURRENT: {freq} Hz</span>
                <span className={Math.abs(freq - 60) <= 2 ? 'text-emerald-400' : 'text-amber-400'}>
                  TARGET: 58–62 Hz
                </span>
              </div>
              <input
                type="range"
                min={20}
                max={100}
                value={freq}
                onChange={(e) => setFreq(Number(e.target.value))}
                className="w-full h-10 accent-sky-400 cursor-pointer"
              />
              <button
                type="button"
                onClick={() => {
                  if (Math.abs(freq - 60) <= 2) {
                    completeStage(400);
                  } else {
                    arcadeAudio.playSfx('wrong');
                    setMistakes((m) => m + 1);
                  }
                }}
                className="studio-btn studio-btn-primary w-full py-3 min-h-[48px]"
              >
                <Sliders size={16} />
                <span>LOCK 60 Hz FREQUENCY</span>
              </button>
            </div>
          </div>
        )}

        {/* Stage 5: Ignition */}
        {stage === 4 && (
          <div className="space-y-4">
            <h2 className="font-heading text-xl font-bold text-[var(--studio-text)]">
              Stage 5: Machine Start Sequence (PRIME -&gt; ARM -&gt; IGNITE!)
            </h2>
            <div className="grid grid-cols-3 gap-3">
              {[
                { id: 'PRIME', icon: <Flame size={18} /> },
                { id: 'ARM', icon: <Zap size={18} /> },
                { id: 'IGNITE', icon: <Power size={18} /> },
              ].map((btn) => {
                const done = ignSteps.includes(btn.id);
                const expected = ['PRIME', 'ARM', 'IGNITE'][ignSteps.length];
                return (
                  <button
                    key={btn.id}
                    type="button"
                    disabled={done}
                    onClick={() => {
                      if (btn.id === expected) {
                        arcadeAudio.playSfx('engineRev');
                        const next = [...ignSteps, btn.id];
                        setIgnSteps(next);
                        if (next.length === 3) completeStage(460);
                      } else {
                        arcadeAudio.playSfx('wrong');
                        setMistakes((m) => m + 1);
                      }
                    }}
                    className={`min-h-[84px] rounded-2xl border-2 font-heading text-lg font-bold cursor-pointer flex flex-col items-center justify-center gap-1 ${
                      done
                        ? 'bg-emerald-950 border-emerald-400 text-emerald-300'
                        : btn.id === 'IGNITE'
                        ? 'bg-rose-900/70 border-rose-400 text-white'
                        : 'bg-[var(--studio-surface-2)] border-[var(--studio-border-strong)] text-[var(--studio-text)]'
                    }`}
                  >
                    {btn.icon}
                    <span>{btn.id}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </MiniGameShell>
  );
};

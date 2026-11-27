import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Cpu } from 'lucide-react';
import { getMiniGameDef } from '../../../../shared/progression.ts';
import { arcadeAudio } from '../../../audio/arcadeAudio.ts';
import { MiniGameShell } from '../shared/MiniGameShell.tsx';
import { UniversalResultScreen } from '../shared/UniversalResultScreen.tsx';
import { usePlaygroundSession } from '../shared/usePlaygroundSession.ts';
import type { MiniGameComponentProps } from './types.ts';

const PADS = [
  { id: 0, label: 'CH-1 POWER', color: '#06B6D4', keyHint: '1' },
  { id: 1, label: 'CH-2 CLOCK', color: '#10B981', keyHint: '2' },
  { id: 2, label: 'CH-3 BUS', color: '#F59E0B', keyHint: '3' },
  { id: 3, label: 'CH-4 RESET', color: '#EF4444', keyHint: '4' },
  { id: 4, label: 'CH-5 LOGIC', color: '#8B5CF6', keyHint: '5' },
  { id: 5, label: 'CH-6 DATA', color: '#3B82F6', keyHint: '6' },
];

const SEQUENCE_LENGTHS = [3, 4, 5, 6, 7];

export const MemoryCircuitGame: React.FC<MiniGameComponentProps> = ({
  onExit,
  onNextChallenge,
  onOpenLeaderboard,
  onGoHome,
}) => {
  const def = getMiniGameDef('memory-circuit')!;
  const pg = usePlaygroundSession('memory-circuit');

  const [roundIdx, setRoundIdx] = useState(0);
  const [sequence, setSequence] = useState<number[]>([]);
  const [playerInput, setPlayerInput] = useState<number[]>([]);
  const [phase, setPhase] = useState<'ready' | 'showing' | 'input' | 'failed'>('ready');
  const [litPad, setLitPad] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [correctSteps, setCorrectSteps] = useState(0);
  const [totalSteps, setTotalSteps] = useState(0);

  const timersRef = useRef<number[]>([]);

  const clearTimers = () => {
    for (const id of timersRef.current) window.clearTimeout(id);
    timersRef.current = [];
  };

  useEffect(() => () => clearTimers(), []);

  const playSequence = useCallback((seq: number[], tempoMs: number) => {
    clearTimers();
    setPhase('showing');
    setLitPad(null);
    seq.forEach((padId, stepIdx) => {
      const startAt = 320 + stepIdx * tempoMs;
      const t1 = window.setTimeout(() => {
        setLitPad(padId);
        arcadeAudio.playSfx('snap');
      }, startAt);
      const t2 = window.setTimeout(() => {
        setLitPad(null);
      }, startAt + Math.round(tempoMs * 0.62));
      timersRef.current.push(t1, t2);
    });
    const endAt = 340 + seq.length * tempoMs;
    const tDone = window.setTimeout(() => {
      setLitPad(null);
      setPhase('input');
    }, endAt);
    timersRef.current.push(tDone);
  }, []);

  const startRound = useCallback(
    (idx: number) => {
      const len = SEQUENCE_LENGTHS[idx] || 7;
      const nextSeq = Array.from({ length: len }, () => Math.floor(Math.random() * PADS.length));
      setSequence(nextSeq);
      setPlayerInput([]);
      const tempo = Math.max(360, 620 - idx * 55);
      playSequence(nextSeq, tempo);
    },
    [playSequence]
  );

  useEffect(() => {
    if (phase === 'ready' && !pg.isPaused && !pg.result) {
      const t = window.setTimeout(() => startRound(0), 450);
      timersRef.current.push(t);
      return () => window.clearTimeout(t);
    }
  }, [phase, pg.isPaused, pg.result, startRound]);

  const handlePadPress = useCallback(
    (padId: number) => {
      if (phase !== 'input' || pg.isPaused || pg.result || pg.submitting) return;
      setLitPad(padId);
      const t = window.setTimeout(() => setLitPad(null), 160);
      timersRef.current.push(t);

      const stepPos = playerInput.length;
      const expected = sequence[stepPos];
      setTotalSteps((n) => n + 1);

      if (padId !== expected) {
        arcadeAudio.playSfx('wrong');
        setPhase('failed');
        const finalScore = Math.max(100, score);
        const acc = totalSteps + 1 > 0 ? Math.round((correctSteps / (totalSteps + 1)) * 100) : 50;
        window.setTimeout(() => {
          void pg.finishRun({
            score: finalScore,
            rawMetric: roundIdx,
            accuracy: acc,
            won: roundIdx >= 2,
            meta: { roundsCleared: roundIdx, failedAtStep: stepPos + 1 },
          });
        }, 700);
        return;
      }

      arcadeAudio.playSfx('correct');
      const nextInput = [...playerInput, padId];
      setPlayerInput(nextInput);
      setCorrectSteps((c) => c + 1);
      const nextScore = score + 50 + roundIdx * 20;
      setScore(nextScore);

      if (nextInput.length >= sequence.length) {
        const roundBonus = 140 + roundIdx * 40;
        const updatedScore = nextScore + roundBonus;
        setScore(updatedScore);
        arcadeAudio.playSfx('coin');

        if (roundIdx + 1 >= SEQUENCE_LENGTHS.length) {
          const acc = Math.round(((correctSteps + 1) / (totalSteps + 1)) * 100);
          void pg.finishRun({
            score: updatedScore,
            rawMetric: SEQUENCE_LENGTHS.length,
            accuracy: acc,
            won: true,
            meta: { roundsCleared: SEQUENCE_LENGTHS.length },
          });
        } else {
          const nextRound = roundIdx + 1;
          setRoundIdx(nextRound);
          setPhase('showing');
          const tNext = window.setTimeout(() => startRound(nextRound), 700);
          timersRef.current.push(tNext);
        }
      }
    },
    [correctSteps, pg, phase, playerInput, roundIdx, score, sequence, startRound, totalSteps]
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const idx = ['1', '2', '3', '4', '5', '6'].indexOf(e.key);
      if (idx >= 0) {
        e.preventDefault();
        handlePadPress(idx);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handlePadPress]);

  const handleRestart = () => {
    clearTimers();
    setRoundIdx(0);
    setSequence([]);
    setPlayerInput([]);
    setScore(0);
    setCorrectSteps(0);
    setTotalSteps(0);
    setPhase('ready');
    void pg.restartSession();
  };

  if (pg.result) {
    return (
      <UniversalResultScreen
        title={def.title}
        result={pg.result}
        rankUnavailable={pg.rankUnavailable}
        statusNote={pg.statusNote}
        primaryMetricLabel="Sequences Cleared"
        primaryMetricValue={`${Math.min(SEQUENCE_LENGTHS.length, Math.round(pg.result.rawMetric))} / ${SEQUENCE_LENGTHS.length}`}
        onPlayAgain={handleRestart}
        onNextChallenge={() => onNextChallenge('tech-assembly')}
        nextChallengeLabel="Tech Assembly"
        onLeaderboard={() => onOpenLeaderboard('memory-circuit')}
        onHome={onGoHome}
      />
    );
  }

  return (
    <MiniGameShell
      title={def.title}
      subtitle={def.tagline}
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
      extraHudBadge={`ROUND ${roundIdx + 1}/${SEQUENCE_LENGTHS.length} · ${sequence.length} LEDS`}
    >
      <div className="studio-card-solid border-2 border-[var(--studio-border-strong)] p-5 sm:p-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="inline-flex items-center gap-2 font-mono-tech text-xs sm:text-sm font-bold text-[var(--studio-text)]">
            <Cpu size={16} className="text-[var(--studio-accent-text)]" />
            <span>
              {phase === 'showing' && 'WATCH MICROCONTROLLER LED BUS...'}
              {phase === 'input' && `YOUR TURN: Repeat ${playerInput.length} / ${sequence.length} signals`}
              {phase === 'failed' && 'SIGNAL MISMATCH! Logging run telemetry...'}
              {phase === 'ready' && 'INITIALIZING LED BUS...'}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            {sequence.map((_, i) => (
              <span
                key={i}
                className={`w-3 h-3 rounded-full border ${
                  i < playerInput.length
                    ? 'bg-emerald-400 border-emerald-200'
                    : 'bg-slate-800 border-slate-600'
                }`}
              />
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
          {PADS.map((pad) => {
            const isLit = litPad === pad.id;
            return (
              <button
                key={pad.id}
                type="button"
                disabled={phase !== 'input'}
                onClick={() => handlePadPress(pad.id)}
                className="min-h-[104px] sm:min-h-[120px] rounded-2xl border-2 p-4 flex flex-col items-center justify-center gap-2 cursor-pointer transition-transform active:scale-95 select-none"
                style={{
                  backgroundColor: isLit ? pad.color : '#0B1426',
                  borderColor: pad.color,
                  color: isLit ? '#04101D' : '#F8FAFC',
                  boxShadow: isLit ? `0 0 28px ${pad.color}` : 'none',
                }}
              >
                <span className="font-mono-tech text-xs font-bold opacity-80">KEY [{pad.keyHint}]</span>
                <span className="font-heading text-base sm:text-lg font-bold">{pad.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </MiniGameShell>
  );
};

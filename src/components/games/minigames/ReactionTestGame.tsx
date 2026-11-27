import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Zap } from 'lucide-react';
import { getMiniGameDef } from '../../../../shared/progression.ts';
import { arcadeAudio } from '../../../audio/arcadeAudio.ts';
import { MiniGameShell } from '../shared/MiniGameShell.tsx';
import { UniversalResultScreen } from '../shared/UniversalResultScreen.tsx';
import { usePlaygroundSession } from '../shared/usePlaygroundSession.ts';
import type { MiniGameComponentProps } from './types.ts';

type Phase = 'idle' | 'waiting' | 'ready' | 'too-soon' | 'recorded';

const TOTAL_ROUNDS = 5;

export const ReactionTestGame: React.FC<MiniGameComponentProps> = ({
  onExit,
  onNextChallenge,
  onOpenLeaderboard,
  onGoHome,
}) => {
  const def = getMiniGameDef('reaction-test')!;
  const pg = usePlaygroundSession('reaction-test');

  const [phase, setPhase] = useState<Phase>('idle');
  const [round, setRound] = useState(1);
  const [times, setTimes] = useState<number[]>([]);
  const [falseStarts, setFalseStarts] = useState(0);
  const [lastMs, setLastMs] = useState<number | null>(null);
  const [liveScore, setLiveScore] = useState(0);

  const timerRef = useRef<number | null>(null);
  const readyAtRef = useRef<number>(0);

  const clearTimer = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const startWaitingRound = useCallback(() => {
    clearTimer();
    setPhase('waiting');
    const delay = 1100 + Math.floor(Math.random() * 2300);
    timerRef.current = window.setTimeout(() => {
      readyAtRef.current = performance.now();
      setPhase('ready');
      arcadeAudio.playSfx('snap');
    }, delay);
  }, []);

  useEffect(() => {
    return () => clearTimer();
  }, []);

  useEffect(() => {
    if (pg.isPaused) {
      clearTimer();
      if (phase === 'waiting' || phase === 'ready') {
        setPhase('idle');
      }
    }
  }, [pg.isPaused, phase]);

  const handlePadTrigger = useCallback(() => {
    if (pg.isPaused || pg.result || pg.submitting) return;

    if (phase === 'idle' || phase === 'too-soon' || phase === 'recorded') {
      arcadeAudio.playSfx('click');
      startWaitingRound();
      return;
    }

    if (phase === 'waiting') {
      clearTimer();
      setFalseStarts((f) => f + 1);
      setPhase('too-soon');
      arcadeAudio.playSfx('wrong');
      return;
    }

    if (phase === 'ready') {
      const measured = Math.max(125, Math.round(performance.now() - readyAtRef.current));
      const nextTimes = [...times, measured];
      setTimes(nextTimes);
      setLastMs(measured);
      arcadeAudio.playSfx('correct');

      const avgSoFar = nextTimes.reduce((s, v) => s + v, 0) / nextTimes.length;
      const computedScore = Math.max(150, Math.min(1450, Math.round(1450 - avgSoFar * 2)));
      setLiveScore(computedScore);

      if (nextTimes.length >= TOTAL_ROUNDS) {
        setPhase('recorded');
        const accuracy = Math.max(40, 100 - falseStarts * 15);
        void pg.finishRun({
          score: computedScore,
          rawMetric: Math.round(avgSoFar),
          accuracy,
          won: true,
          meta: { rounds: nextTimes, avgMs: Math.round(avgSoFar) },
        });
      } else {
        setRound(nextTimes.length + 1);
        setPhase('recorded');
      }
    }
  }, [falseStarts, pg, phase, startWaitingRound, times]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'Enter') {
        if ((e.target as HTMLElement)?.tagName === 'BUTTON') return;
        e.preventDefault();
        handlePadTrigger();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handlePadTrigger]);

  const handleRestart = () => {
    clearTimer();
    setPhase('idle');
    setRound(1);
    setTimes([]);
    setFalseStarts(0);
    setLastMs(null);
    setLiveScore(0);
    void pg.restartSession();
  };

  if (pg.result) {
    return (
      <UniversalResultScreen
        title={def.title}
        result={pg.result}
        rankUnavailable={pg.rankUnavailable}
        statusNote={pg.statusNote}
        primaryMetricLabel="Avg Reaction"
        primaryMetricValue={`${Math.round(pg.result.rawMetric)} ms`}
        onPlayAgain={handleRestart}
        onNextChallenge={() => onNextChallenge('circuit-connect')}
        nextChallengeLabel="Circuit Connect"
        onLeaderboard={() => onOpenLeaderboard('reaction-test')}
        onHome={onGoHome}
      />
    );
  }

  const avgMs = times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : null;

  const padColors: Record<Phase, string> = {
    idle: 'bg-[#111C35] border-[#38BDF8] text-white',
    waiting: 'bg-[#7F1D1D] border-[#EF4444] text-white',
    ready: 'bg-[#059669] border-[#34D399] text-white',
    'too-soon': 'bg-[#92400E] border-[#F59E0B] text-white',
    recorded: 'bg-[#1E293B] border-[#38BDF8] text-white',
  };

  return (
    <MiniGameShell
      title={def.title}
      subtitle={def.tagline}
      howToPlay={def.howToPlay}
      controlsSummary={def.controlsSummary}
      elapsedSeconds={pg.elapsedSeconds}
      score={liveScore}
      personalBest={pg.session?.personalBest ?? null}
      globalRank={pg.session?.globalRank ?? null}
      rankUnavailable={pg.session?.unavailable}
      isPaused={pg.isPaused}
      onTogglePause={pg.togglePause}
      onRestart={handleRestart}
      onExit={onExit}
      accentColor={def.accentColor}
      extraHudBadge={`ROUND ${Math.min(round, TOTAL_ROUNDS)} / ${TOTAL_ROUNDS}`}
    >
      <div className="studio-card-solid border-2 border-[var(--studio-border-strong)] p-5 sm:p-8 space-y-5">
        <button
          type="button"
          onClick={handlePadTrigger}
          className={`w-full min-h-[260px] sm:min-h-[300px] rounded-2xl border-4 flex flex-col items-center justify-center gap-3 p-6 text-center cursor-pointer transition-colors select-none ${padColors[phase]}`}
        >
          <Zap size={44} className={phase === 'ready' ? 'text-yellow-300' : 'text-sky-300'} />
          <div className="font-heading text-2xl sm:text-4xl font-bold tracking-tight">
            {phase === 'idle' && `Round ${round}: Click or Press Space to Arm`}
            {phase === 'waiting' && 'WAIT FOR GREEN SIGNAL...'}
            {phase === 'ready' && 'TAP NOW!'}
            {phase === 'too-soon' && 'TOO EARLY! Click or Press Space to Retry'}
            {phase === 'recorded' && `${lastMs} ms! Click or Press Space for Round ${round}`}
          </div>
          <p className="font-mono-tech text-xs sm:text-sm opacity-90">
            {phase === 'waiting'
              ? 'Hold steady — false starts add an accuracy penalty.'
              : 'Minimum human validation threshold: 120 ms.'}
          </p>
        </button>

        {/* Round Telemetry Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-2.5">
          {Array.from({ length: TOTAL_ROUNDS }).map((_, idx) => {
            const val = times[idx];
            return (
              <div
                key={idx}
                className="studio-well p-3 rounded-xl text-center border border-[var(--studio-border)]"
              >
                <div className="font-mono-tech text-[10px] text-[var(--studio-text-muted)]">
                  R{idx + 1}
                </div>
                <div className="font-mono-tech text-sm font-bold text-[var(--studio-text)] tabular-nums mt-0.5">
                  {val ? `${val}ms` : '—'}
                </div>
              </div>
            );
          })}
          <div className="studio-well p-3 rounded-xl text-center border border-[var(--studio-border-strong)]">
            <div className="font-mono-tech text-[10px] text-[var(--studio-accent-text)]">AVG</div>
            <div className="font-mono-tech text-sm font-bold text-[var(--studio-accent-text)] tabular-nums mt-0.5">
              {avgMs ? `${avgMs}ms` : '—'}
            </div>
          </div>
        </div>
      </div>
    </MiniGameShell>
  );
};

import React, { useCallback, useEffect, useState } from 'react';
import { BatteryCharging, Cpu, Radio, Speaker } from 'lucide-react';
import { getMiniGameDef } from '../../../../shared/progression.ts';
import { arcadeAudio } from '../../../audio/arcadeAudio.ts';
import { MiniGameShell } from '../shared/MiniGameShell.tsx';
import { UniversalResultScreen } from '../shared/UniversalResultScreen.tsx';
import { usePlaygroundSession } from '../shared/usePlaygroundSession.ts';
import type { MiniGameComponentProps } from './types.ts';

type BinCategory = 'POWER' | 'CONTROL' | 'OUTPUT' | 'SENSORS';

interface HardwareCard {
  name: string;
  spec: string;
  bin: BinCategory;
}

const DECK: HardwareCard[] = [
  { name: 'Li-Ion 18650 Pack', spec: '3.7V 3200mAh DC Cell', bin: 'POWER' },
  { name: 'LM7805 Buck Regulator', spec: 'Step-Down Voltage Rail', bin: 'POWER' },
  { name: 'Solar MPPT Charger', spec: 'PV Array DC Harvester', bin: 'POWER' },
  { name: 'TOROIDAL Transformer', spec: 'AC Step-Down Isolation', bin: 'POWER' },
  { name: 'ARM Cortex-M4 MCU', spec: '168 MHz Logic Controller', bin: 'CONTROL' },
  { name: '555 Precision Timer', spec: 'PWM Clock Pulse IC', bin: 'CONTROL' },
  { name: 'FPGA Gate Matrix', spec: 'Programmable Logic Array', bin: 'CONTROL' },
  { name: 'MOSFET Gate Driver', spec: 'High-Speed PWM Switcher', bin: 'CONTROL' },
  { name: 'Brushless Servo Motor', spec: 'Closed-Loop Torque Actuator', bin: 'OUTPUT' },
  { name: 'OLED Matrix Panel', spec: '128x64 Pixel Emitter', bin: 'OUTPUT' },
  { name: 'Piezo Acoustic Buzzer', spec: '2.4 kHz Audio Transducer', bin: 'OUTPUT' },
  { name: 'High-Flux Solenoid', spec: 'Linear Magnetic Plunger', bin: 'OUTPUT' },
  { name: 'Ultrasonic HC-SR04', spec: '40 kHz Echo Rangefinder', bin: 'SENSORS' },
  { name: '6-Axis IMU Gyro', spec: 'MEMS Pitch/Roll Feedback', bin: 'SENSORS' },
  { name: 'NTC Thermistor Probe', spec: 'Thermal Resistance Reader', bin: 'SENSORS' },
  { name: 'Hall Effect Tachometer', spec: 'Magnetic RPM Detector', bin: 'SENSORS' },
];

const BINS: Array<{ id: BinCategory; keyNum: string; color: string; icon: React.ReactNode }> = [
  { id: 'POWER', keyNum: '1', color: '#F59E0B', icon: <BatteryCharging size={18} /> },
  { id: 'CONTROL', keyNum: '2', color: '#38BDF8', icon: <Cpu size={18} /> },
  { id: 'OUTPUT', keyNum: '3', color: '#10B981', icon: <Speaker size={18} /> },
  { id: 'SENSORS', keyNum: '4', color: '#A855F7', icon: <Radio size={18} /> },
];

function buildShuffledQueue(): HardwareCard[] {
  const copy = [...DECK];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export const SortTheCircuitGame: React.FC<MiniGameComponentProps> = ({
  onExit,
  onNextChallenge,
  onOpenLeaderboard,
  onGoHome,
}) => {
  const def = getMiniGameDef('sort-circuit')!;
  const pg = usePlaygroundSession('sort-circuit');

  const [queue, setQueue] = useState<HardwareCard[]>(buildShuffledQueue);
  const [idx, setIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [timeLeft, setTimeLeft] = useState(35);
  const [lastFeedback, setLastFeedback] = useState<string>('Route component quickly using keys 1-4 or tap a bin.');

  const finishGame = useCallback(
    (finalScore: number, hits: number, answered: number) => {
      const acc = answered > 0 ? Math.round((hits / answered) * 1000) / 10 : 0;
      void pg.finishRun({
        score: finalScore,
        rawMetric: hits,
        accuracy: acc,
        won: hits >= 8,
        meta: { sortedCorrect: hits, totalAttempted: answered },
      });
    },
    [pg]
  );

  useEffect(() => {
    if (pg.isPaused || pg.result) return;
    const t = window.setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(t);
          finishGame(score, correctCount, idx);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(t);
  }, [correctCount, finishGame, idx, pg.isPaused, pg.result, score]);

  const handleSort = useCallback(
    (bin: BinCategory) => {
      if (pg.isPaused || pg.result || pg.submitting || idx >= queue.length) return;
      const card = queue[idx];
      const isMatch = card.bin === bin;
      let nextScore = score;
      let nextHits = correctCount;

      if (isMatch) {
        arcadeAudio.playSfx('correct');
        const nextStreak = streak + 1;
        setStreak(nextStreak);
        nextHits += 1;
        setCorrectCount(nextHits);
        nextScore += 80 + Math.min(80, nextStreak * 12);
        setScore(nextScore);
        setLastFeedback(`✓ ${card.name} -> ${bin} (+${80 + Math.min(80, nextStreak * 12)} pts)`);
      } else {
        arcadeAudio.playSfx('wrong');
        setStreak(0);
        setLastFeedback(`✗ ${card.name} belongs in ${card.bin}!`);
      }

      const nextIdx = idx + 1;
      setIdx(nextIdx);

      if (nextIdx >= queue.length) {
        const speedBonus = timeLeft * 12;
        const total = nextScore + speedBonus;
        setScore(total);
        finishGame(total, nextHits, queue.length);
      }
    },
    [correctCount, finishGame, idx, pg.isPaused, pg.result, pg.submitting, queue, score, streak, timeLeft]
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === '1') handleSort('POWER');
      if (e.key === '2') handleSort('CONTROL');
      if (e.key === '3') handleSort('OUTPUT');
      if (e.key === '4') handleSort('SENSORS');
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleSort]);

  const handleRestart = () => {
    setQueue(buildShuffledQueue());
    setIdx(0);
    setScore(0);
    setStreak(0);
    setCorrectCount(0);
    setTimeLeft(35);
    setLastFeedback('Route component quickly using keys 1-4 or tap a bin.');
    void pg.restartSession();
  };

  if (pg.result) {
    return (
      <UniversalResultScreen
        title={def.title}
        result={pg.result}
        rankUnavailable={pg.rankUnavailable}
        statusNote={pg.statusNote}
        primaryMetricLabel="Sorted Correctly"
        primaryMetricValue={`${Math.round(pg.result.rawMetric)} / ${queue.length}`}
        onPlayAgain={handleRestart}
        onNextChallenge={() => onNextChallenge('rocket-balance')}
        nextChallengeLabel="Rocket Balance"
        onLeaderboard={() => onOpenLeaderboard('sort-circuit')}
        onHome={onGoHome}
      />
    );
  }

  const activeCard = queue[idx];

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
      extraHudBadge={`LEFT ${timeLeft}s · ${idx}/${queue.length} · STREAK x${streak}`}
    >
      <div className="studio-card-solid border-2 border-[var(--studio-border-strong)] p-5 sm:p-7 space-y-6">
        {/* Incoming Component Card */}
        {activeCard && (
          <div className="rounded-2xl bg-[#070E1E] border-2 border-[#38BDF8] p-6 text-center space-y-2">
            <div className="font-mono-tech text-xs font-bold text-sky-400">
              CONVEYOR ITEM {idx + 1} / {queue.length}
            </div>
            <h2 className="font-heading text-2xl sm:text-4xl font-bold text-white">
              {activeCard.name}
            </h2>
            <p className="font-mono-tech text-xs sm:text-sm text-slate-300">{activeCard.spec}</p>
          </div>
        )}

        {/* 4 Category Sort Bins */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {BINS.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => handleSort(b.id)}
              className="min-h-[82px] rounded-2xl border-2 p-4 flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-transform active:scale-95"
              style={{
                backgroundColor: '#0C162D',
                borderColor: b.color,
                color: '#F8FAFC',
              }}
            >
              <div className="flex items-center gap-1.5 font-mono-tech text-xs font-bold" style={{ color: b.color }}>
                {b.icon}
                <span>KEY [{b.keyNum}]</span>
              </div>
              <span className="font-heading text-base font-bold">{b.id}</span>
            </button>
          ))}
        </div>

        <div className="text-center font-mono-tech text-xs font-bold text-[var(--studio-text-secondary)]">
          {lastFeedback}
        </div>
      </div>
    </MiniGameShell>
  );
};

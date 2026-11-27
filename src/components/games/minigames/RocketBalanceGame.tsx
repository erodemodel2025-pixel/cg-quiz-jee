import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Flame } from 'lucide-react';
import { getMiniGameDef } from '../../../../shared/progression.ts';
import { arcadeAudio } from '../../../audio/arcadeAudio.ts';
import { MiniGameShell } from '../shared/MiniGameShell.tsx';
import { UniversalResultScreen } from '../shared/UniversalResultScreen.tsx';
import { usePlaygroundSession } from '../shared/usePlaygroundSession.ts';
import type { MiniGameComponentProps } from './types.ts';

export const RocketBalanceGame: React.FC<MiniGameComponentProps> = ({
  onExit,
  onNextChallenge,
  onOpenLeaderboard,
  onGoHome,
}) => {
  const def = getMiniGameDef('rocket-balance')!;
  const pg = usePlaygroundSession('rocket-balance');

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctrlRef = useRef({ left: false, right: false, boost: false });

  const [score, setScore] = useState(0);
  const [altitude, setAltitude] = useState(0);
  const [fuel, setFuel] = useState(100);
  const [integrity, setIntegrity] = useState(100);

  const simRef = useRef({
    rocketX: 300,
    vx: 0,
    scroll: 0,
    altitude: 0,
    fuel: 100,
    integrity: 100,
    score: 0,
    inCorridorFrames: 0,
    totalFrames: 0,
    done: false,
  });

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        ctrlRef.current.left = true;
      }
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        ctrlRef.current.right = true;
      }
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W' || e.code === 'Space') {
        e.preventDefault();
        ctrlRef.current.boost = true;
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') ctrlRef.current.left = false;
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') ctrlRef.current.right = false;
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W' || e.code === 'Space') ctrlRef.current.boost = false;
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  const pgRef = useRef(pg);
  pgRef.current = pg;

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      const s = simRef.current;
      const curPg = pgRef.current;

      if (canvas && ctx && !curPg.isPaused && !curPg.result && !s.done) {
        const c = ctrlRef.current;
        const speed = c.boost && s.fuel > 0 ? 0.175 : 0.095;
        if (c.boost && s.fuel > 0) {
          s.fuel = Math.max(0, s.fuel - 0.18);
        } else {
          s.fuel = Math.min(100, s.fuel + 0.03);
        }

        // Gentle atmospheric drift + gimbal steering
        const drift = Math.sin(s.scroll * 0.035) * 0.085;
        s.vx += drift;
        if (c.left) s.vx -= 0.24;
        if (c.right) s.vx += 0.24;
        s.vx *= 0.93;
        s.rocketX = Math.max(28, Math.min(572, s.rocketX + s.vx));

        s.scroll += 1;
        s.altitude = Math.min(100, s.altitude + speed);
        s.totalFrames += 1;

        const corridorCenter =
          300 + Math.sin(s.scroll * 0.025) * 125 + Math.cos(s.scroll * 0.014) * 55;
        const halfWidth = 68;
        const inZone = Math.abs(s.rocketX - corridorCenter) <= halfWidth;

        if (inZone) {
          s.inCorridorFrames += 1;
          s.score += c.boost ? 3 : 2;
        } else {
          s.integrity = Math.max(0, s.integrity - 0.35);
          if (s.totalFrames % 25 === 0) arcadeAudio.playSfx('wrong');
        }

        setAltitude(Math.round(s.altitude));
        setFuel(Math.round(s.fuel));
        setIntegrity(Math.round(s.integrity));
        setScore(Math.round(s.score));

        if (s.altitude >= 100 || s.integrity <= 0) {
          s.done = true;
          const acc = Math.round((s.inCorridorFrames / Math.max(1, s.totalFrames)) * 1000) / 10;
          const won = s.altitude >= 100 && s.integrity > 0;
          const bonus = won ? Math.round(s.integrity * 4 + 300) : 0;
          const finalScore = Math.min(2500, Math.round(s.score + bonus));
          setScore(finalScore);
          void curPg.finishRun({
            score: finalScore,
            rawMetric: Math.round(s.altitude),
            accuracy: acc,
            won,
            meta: { altitude: Math.round(s.altitude), integrity: Math.round(s.integrity) },
          });
        }

        // Draw ascent corridor
        ctx.fillStyle = '#060B18';
        ctx.fillRect(0, 0, 600, 320);

        for (let row = 0; row < 16; row++) {
          const y = 320 - row * 22;
          const sampleT = s.scroll + row * 3;
          const cx = 300 + Math.sin(sampleT * 0.025) * 125 + Math.cos(sampleT * 0.014) * 55;
          ctx.fillStyle = 'rgba(14,165,233,0.14)';
          ctx.fillRect(cx - halfWidth, y - 22, halfWidth * 2, 22);
          ctx.fillStyle = '#38BDF8';
          ctx.fillRect(cx - halfWidth, y - 22, 3, 22);
          ctx.fillRect(cx + halfWidth - 3, y - 22, 3, 22);
        }

        // Rocket sprite at y=250
        ctx.save();
        ctx.translate(s.rocketX, 250);
        ctx.rotate(Math.max(-0.32, Math.min(0.32, s.vx * 0.08)));
        ctx.fillStyle = inZone ? '#34D399' : '#FB7185';
        ctx.beginPath();
        ctx.moveTo(0, -22);
        ctx.lineTo(12, 12);
        ctx.lineTo(-12, 12);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = c.boost && s.fuel > 0 ? '#FACC15' : '#F97316';
        ctx.beginPath();
        ctx.moveTo(-6, 12);
        ctx.lineTo(0, c.boost ? 34 : 24);
        ctx.lineTo(6, 12);
        ctx.fill();
        ctx.restore();

        ctx.fillStyle = '#E2E8F0';
        ctx.font = 'bold 11px monospace';
        ctx.fillText(
          inZone ? 'CORRIDOR: LOCKED' : 'WARNING: OUTSIDE SAFE CORRIDOR!',
          14,
          22
        );
      }

      raf = window.requestAnimationFrame(tick);
    };
    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, []);

  const handleRestart = () => {
    simRef.current = {
      rocketX: 300,
      vx: 0,
      scroll: 0,
      altitude: 0,
      fuel: 100,
      integrity: 100,
      score: 0,
      inCorridorFrames: 0,
      totalFrames: 0,
      done: false,
    };
    setScore(0);
    setAltitude(0);
    setFuel(100);
    setIntegrity(100);
    void pg.restartSession();
  };

  if (pg.result) {
    return (
      <UniversalResultScreen
        title={def.title}
        result={pg.result}
        rankUnavailable={pg.rankUnavailable}
        statusNote={pg.statusNote}
        primaryMetricLabel="Peak Altitude"
        primaryMetricValue={`${Math.round(pg.result.rawMetric)}%`}
        onPlayAgain={handleRestart}
        onNextChallenge={() => onNextChallenge('engineering-speedrun')}
        nextChallengeLabel="Speed Run"
        onLeaderboard={() => onOpenLeaderboard('rocket-balance')}
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
      extraHudBadge={`ALT ${altitude}% · HULL ${integrity}% · FUEL ${fuel}%`}
    >
      <div className="studio-card-solid border-2 border-[var(--studio-border-strong)] p-4 sm:p-6 space-y-4">
        <div className="rounded-2xl overflow-hidden border-2 border-[#1E3A5F] bg-[#060B18]">
          <canvas ref={canvasRef} width={600} height={320} className="w-full h-auto block" />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="font-mono-tech text-xs text-[var(--studio-text-secondary)]">
            Keep nose inside the glowing blue flight corridor to reach 100% orbit!
          </div>
          <div className="flex items-center gap-2 select-none">
            <button
              type="button"
              onPointerDown={() => (ctrlRef.current.left = true)}
              onPointerUp={() => (ctrlRef.current.left = false)}
              onPointerLeave={() => (ctrlRef.current.left = false)}
              className="studio-btn studio-btn-ghost px-4 py-3 min-h-[48px]"
            >
              <ArrowLeft size={18} />
              <span>LEFT</span>
            </button>
            <button
              type="button"
              onPointerDown={() => (ctrlRef.current.boost = true)}
              onPointerUp={() => (ctrlRef.current.boost = false)}
              onPointerLeave={() => (ctrlRef.current.boost = false)}
              className="studio-btn studio-btn-primary px-5 py-3 min-h-[48px]"
            >
              <Flame size={18} />
              <span>BOOST</span>
            </button>
            <button
              type="button"
              onPointerDown={() => (ctrlRef.current.right = true)}
              onPointerUp={() => (ctrlRef.current.right = false)}
              onPointerLeave={() => (ctrlRef.current.right = false)}
              className="studio-btn studio-btn-ghost px-4 py-3 min-h-[48px]"
            >
              <span>RIGHT</span>
              <ArrowRight size={18} />
            </button>
          </div>
        </div>
      </div>
    </MiniGameShell>
  );
};

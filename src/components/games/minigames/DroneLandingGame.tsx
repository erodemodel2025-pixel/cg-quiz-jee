import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, ArrowUp } from 'lucide-react';
import { getMiniGameDef } from '../../../../shared/progression.ts';
import { arcadeAudio } from '../../../audio/arcadeAudio.ts';
import { MiniGameShell } from '../shared/MiniGameShell.tsx';
import { UniversalResultScreen } from '../shared/UniversalResultScreen.tsx';
import { usePlaygroundSession } from '../shared/usePlaygroundSession.ts';
import type { MiniGameComponentProps } from './types.ts';

interface ZoneConfig {
  label: string;
  windX: number;
  padX: number;
  padW: number;
  pylons: Array<{ x: number; h: number }>;
}

const ZONES: ZoneConfig[] = [
  {
    label: 'Zone 1 · Calm Helipad',
    windX: 0.025,
    padX: 390,
    padW: 110,
    pylons: [{ x: 250, h: 110 }],
  },
  {
    label: 'Zone 2 · Crosswind Ridge',
    windX: -0.055,
    padX: 110,
    padW: 95,
    pylons: [
      { x: 265, h: 150 },
      { x: 430, h: 120 },
    ],
  },
];

export const DroneLandingGame: React.FC<MiniGameComponentProps> = ({
  onExit,
  onNextChallenge,
  onOpenLeaderboard,
  onGoHome,
}) => {
  const def = getMiniGameDef('drone-landing')!;
  const pg = usePlaygroundSession('drone-landing');

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const controlsRef = useRef({ up: false, left: false, right: false });

  const [zoneIdx, setZoneIdx] = useState(0);
  const [fuel, setFuel] = useState(100);
  const [score, setScore] = useState(0);
  const [crashes, setCrashes] = useState(0);
  const [banner, setBanner] = useState('Touch down on the green pad under 3.6 m/s vertical speed!');

  const stateRef = useRef({
    x: 100,
    y: 55,
    vx: 0,
    vy: 0,
    fuel: 100,
    score: 0,
    crashes: 0,
    zoneIdx: 0,
    done: false,
    resetDelay: 0,
  });

  const resetDroneForZone = (zIdx: number) => {
    stateRef.current.x = zIdx === 0 ? 95 : 495;
    stateRef.current.y = 55;
    stateRef.current.vx = 0;
    stateRef.current.vy = 0;
    stateRef.current.fuel = 100;
    stateRef.current.zoneIdx = zIdx;
    stateRef.current.resetDelay = 0;
    setFuel(100);
    setZoneIdx(zIdx);
  };

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W' || e.code === 'Space') {
        e.preventDefault();
        controlsRef.current.up = true;
      }
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        controlsRef.current.left = true;
      }
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        controlsRef.current.right = true;
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W' || e.code === 'Space') {
        controlsRef.current.up = false;
      }
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        controlsRef.current.left = false;
      }
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        controlsRef.current.right = false;
      }
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
    const step = () => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      const st = stateRef.current;
      const curPg = pgRef.current;

      if (canvas && ctx && !curPg.isPaused && !curPg.result && !st.done) {
        const zone = ZONES[st.zoneIdx];

        if (st.resetDelay > 0) {
          st.resetDelay -= 1;
          if (st.resetDelay === 0) resetDroneForZone(st.zoneIdx);
        } else {
          const ctrl = controlsRef.current;
          st.vy += 0.085; // gravity
          st.vx += zone.windX * 0.45; // wind shear

          if (ctrl.up && st.fuel > 0) {
            st.vy -= 0.195;
            st.fuel = Math.max(0, st.fuel - 0.34);
          }
          if (ctrl.left && st.fuel > 0) {
            st.vx -= 0.11;
            st.fuel = Math.max(0, st.fuel - 0.14);
          }
          if (ctrl.right && st.fuel > 0) {
            st.vx += 0.11;
            st.fuel = Math.max(0, st.fuel - 0.14);
          }

          st.vx *= 0.985;
          st.x = Math.max(20, Math.min(580, st.x + st.vx));
          st.y = Math.max(18, st.y + st.vy);
          setFuel(Math.round(st.fuel));

          // Check pylon collisions
          const hitPylon = zone.pylons.some(
            (p) => Math.abs(st.x - p.x) < 18 && st.y + 12 > 320 - p.h
          );

          if (hitPylon) {
            arcadeAudio.playSfx('wrong');
            st.crashes += 1;
            setCrashes(st.crashes);
            setBanner('Pylon collision! Resetting drone...');
            st.resetDelay = 45;
          } else if (st.y + 12 >= 306) {
            const onPad = st.x >= zone.padX && st.x <= zone.padX + zone.padW;
            const softLanding = Math.abs(st.vy) <= 3.6 && Math.abs(st.vx) <= 2.8;
            if (onPad && softLanding) {
              arcadeAudio.playSfx('correct');
              const zonePts = Math.round(520 + st.fuel * 3);
              st.score += zonePts;
              setScore(st.score);

              if (st.zoneIdx + 1 >= ZONES.length) {
                st.done = true;
                const acc = Math.max(55, 100 - st.crashes * 15);
                void curPg.finishRun({
                  score: st.score,
                  rawMetric: Math.round(st.fuel),
                  accuracy: acc,
                  won: true,
                  meta: { crashes: st.crashes, remainingFuel: Math.round(st.fuel) },
                });
              } else {
                setBanner('Touchdown! Advancing to Zone 2 Crosswind Ridge...');
                resetDroneForZone(st.zoneIdx + 1);
              }
            } else {
              arcadeAudio.playSfx('wrong');
              st.crashes += 1;
              setCrashes(st.crashes);
              setBanner(
                onPad
                  ? `Too fast (${Math.abs(st.vy).toFixed(1)} m/s)! Keep vertical speed below 3.6.`
                  : 'Missed the landing pad! Steer onto the green deck.'
              );
              st.resetDelay = 45;
            }
          }
        }

        // Draw scene
        ctx.fillStyle = '#070E1E';
        ctx.fillRect(0, 0, 600, 340);

        // Ground
        ctx.fillStyle = '#1E293B';
        ctx.fillRect(0, 308, 600, 32);

        // Target Pad
        ctx.fillStyle = '#10B981';
        ctx.fillRect(zone.padX, 304, zone.padW, 8);
        ctx.fillStyle = '#A7F3D0';
        ctx.font = 'bold 10px monospace';
        ctx.fillText('LAND PAD', zone.padX + 20, 326);

        // Pylons
        for (const p of zone.pylons) {
          ctx.fillStyle = '#F97316';
          ctx.fillRect(p.x - 10, 308 - p.h, 20, p.h);
        }

        // Drone chassis
        ctx.save();
        ctx.translate(st.x, st.y);
        ctx.rotate(Math.max(-0.28, Math.min(0.28, st.vx * 0.08)));
        ctx.fillStyle = '#38BDF8';
        ctx.fillRect(-16, -6, 32, 12);
        ctx.fillStyle = '#E2E8F0';
        ctx.fillRect(-22, -10, 12, 3);
        ctx.fillRect(10, -10, 12, 3);
        if (controlsRef.current.up && st.fuel > 0) {
          ctx.fillStyle = '#FACC15';
          ctx.beginPath();
          ctx.moveTo(-6, 7);
          ctx.lineTo(0, 20);
          ctx.lineTo(6, 7);
          ctx.fill();
        }
        ctx.restore();

        // Telemetry overlay
        ctx.fillStyle = '#94A3B8';
        ctx.font = 'bold 11px monospace';
        ctx.fillText(
          `VY: ${Math.abs(st.vy).toFixed(1)} | WIND: ${zone.windX > 0 ? '-> EAST' : '<- WEST'}`,
          14,
          22
        );
      }

      raf = window.requestAnimationFrame(step);
    };

    raf = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(raf);
  }, []);

  const handleRestart = () => {
    stateRef.current = {
      x: 100,
      y: 55,
      vx: 0,
      vy: 0,
      fuel: 100,
      score: 0,
      crashes: 0,
      zoneIdx: 0,
      done: false,
      resetDelay: 0,
    };
    setFuel(100);
    setScore(0);
    setCrashes(0);
    setZoneIdx(0);
    setBanner('Touch down on the green pad under 3.6 m/s vertical speed!');
    void pg.restartSession();
  };

  if (pg.result) {
    return (
      <UniversalResultScreen
        title={def.title}
        result={pg.result}
        rankUnavailable={pg.rankUnavailable}
        statusNote={pg.statusNote}
        primaryMetricLabel="Fuel Remaining"
        primaryMetricValue={`${Math.round(pg.result.rawMetric)}%`}
        onPlayAgain={handleRestart}
        onNextChallenge={() => onNextChallenge('bridge-builder')}
        nextChallengeLabel="Bridge Builder"
        onLeaderboard={() => onOpenLeaderboard('drone-landing')}
        onHome={onGoHome}
      />
    );
  }

  return (
    <MiniGameShell
      title={def.title}
      subtitle={ZONES[zoneIdx].label}
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
      extraHudBadge={`FUEL ${fuel}% · ZONE ${zoneIdx + 1}/${ZONES.length}`}
    >
      <div className="studio-card-solid border-2 border-[var(--studio-border-strong)] p-4 sm:p-6 space-y-4">
        <div className="rounded-2xl overflow-hidden border-2 border-[#1E3A5F] bg-[#070E1E]">
          <canvas ref={canvasRef} width={600} height={340} className="w-full h-auto block" />
        </div>

        {/* Touch & Mouse Hold Thrusters */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs font-mono-tech text-[var(--studio-text-secondary)]">
            {banner} (Resets: {crashes})
          </div>
          <div className="flex items-center gap-2 select-none">
            <button
              type="button"
              onPointerDown={() => (controlsRef.current.left = true)}
              onPointerUp={() => (controlsRef.current.left = false)}
              onPointerLeave={() => (controlsRef.current.left = false)}
              className="studio-btn studio-btn-ghost px-4 py-3 min-h-[48px]"
            >
              <ArrowLeft size={18} />
              <span>LEFT</span>
            </button>
            <button
              type="button"
              onPointerDown={() => (controlsRef.current.up = true)}
              onPointerUp={() => (controlsRef.current.up = false)}
              onPointerLeave={() => (controlsRef.current.up = false)}
              className="studio-btn studio-btn-primary px-5 py-3 min-h-[48px]"
            >
              <ArrowUp size={18} />
              <span>THRUST</span>
            </button>
            <button
              type="button"
              onPointerDown={() => (controlsRef.current.right = true)}
              onPointerUp={() => (controlsRef.current.right = false)}
              onPointerLeave={() => (controlsRef.current.right = false)}
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

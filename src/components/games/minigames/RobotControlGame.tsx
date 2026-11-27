import React, { useCallback, useEffect, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, BatteryCharging, Bot, Target, Zap } from 'lucide-react';
import { getMiniGameDef } from '../../../../shared/progression.ts';
import { arcadeAudio } from '../../../audio/arcadeAudio.ts';
import { MiniGameShell } from '../shared/MiniGameShell.tsx';
import { UniversalResultScreen } from '../shared/UniversalResultScreen.tsx';
import { usePlaygroundSession } from '../shared/usePlaygroundSession.ts';
import type { MiniGameComponentProps } from './types.ts';

// 0=empty, 1=wall, 2=hazard, 3=battery, 4=dock
interface SectorDef {
  title: string;
  start: [number, number];
  grid: number[][];
}

const SECTORS: SectorDef[] = [
  {
    title: 'Sector 1 · Lab Floor',
    start: [0, 0],
    grid: [
      [0, 0, 1, 0, 0, 3, 0],
      [0, 1, 1, 0, 1, 1, 0],
      [0, 3, 0, 0, 2, 0, 0],
      [0, 1, 0, 1, 0, 0, 1],
      [0, 0, 0, 1, 0, 0, 4],
    ],
  },
  {
    title: 'Sector 2 · High-Voltage Bay',
    start: [0, 4],
    grid: [
      [0, 3, 0, 1, 0, 3, 4],
      [0, 1, 0, 2, 0, 1, 0],
      [0, 1, 0, 0, 0, 2, 0],
      [0, 2, 0, 1, 0, 0, 0],
      [0, 0, 0, 1, 3, 1, 0],
    ],
  },
  {
    title: 'Sector 3 · Cleanroom Maze',
    start: [0, 2],
    grid: [
      [3, 0, 1, 0, 2, 0, 3],
      [0, 1, 1, 0, 1, 0, 1],
      [0, 0, 0, 0, 0, 0, 0],
      [1, 2, 1, 0, 1, 2, 0],
      [3, 0, 0, 0, 1, 0, 4],
    ],
  },
  {
    title: 'Sector 4 · Turbine Deck',
    start: [0, 0],
    grid: [
      [0, 0, 2, 3, 0, 1, 4],
      [1, 0, 1, 1, 0, 1, 0],
      [3, 0, 0, 0, 0, 2, 0],
      [0, 1, 2, 1, 0, 0, 0],
      [0, 0, 0, 3, 0, 1, 0],
    ],
  },
  {
    title: 'Sector 5 · Core Telemetry Vault',
    start: [0, 4],
    grid: [
      [3, 0, 1, 0, 3, 0, 4],
      [0, 2, 1, 0, 1, 2, 0],
      [0, 0, 0, 0, 0, 0, 0],
      [1, 0, 2, 1, 2, 0, 1],
      [0, 0, 3, 1, 0, 0, 0],
    ],
  },
];

export const RobotControlGame: React.FC<MiniGameComponentProps> = ({
  onExit,
  onNextChallenge,
  onOpenLeaderboard,
  onGoHome,
}) => {
  const def = getMiniGameDef('robot-control')!;
  const pg = usePlaygroundSession('robot-control');

  const [sectorIdx, setSectorIdx] = useState(0);
  const [pos, setPos] = useState<[number, number]>(SECTORS[0].start);
  const [collected, setCollected] = useState<string[]>([]);
  const [moves, setMoves] = useState(0);
  const [hits, setHits] = useState(0);
  const [score, setScore] = useState(0);
  const [banner, setBanner] = useState('Collect all batteries to unlock the Docking Pad!');

  const sector = SECTORS[sectorIdx];
  const totalBatteries = sector.grid.flat().filter((c) => c === 3).length;
  const dockUnlocked = collected.length >= totalBatteries;

  const moveRobot = useCallback(
    (dx: number, dy: number) => {
      if (pg.isPaused || pg.result || pg.submitting) return;
      const nx = pos[0] + dx;
      const ny = pos[1] + dy;
      if (ny < 0 || ny >= sector.grid.length || nx < 0 || nx >= sector.grid[0].length) return;
      const cell = sector.grid[ny][nx];
      if (cell === 1) {
        arcadeAudio.playSfx('bounce');
        return;
      }

      setMoves((m) => m + 1);
      if (cell === 2) {
        arcadeAudio.playSfx('wrong');
        setHits((h) => h + 1);
        setPos(sector.start);
        setCollected([]);
        setBanner('Hazard hit! Rover reset to sector airlock.');
        return;
      }

      const key = `${nx},${ny}`;
      let nextCollected = collected;
      if (cell === 3 && !collected.includes(key)) {
        arcadeAudio.playSfx('coin');
        nextCollected = [...collected, key];
        setCollected(nextCollected);
        setScore((s) => s + 60);
      } else {
        arcadeAudio.playSfx('click');
      }

      setPos([nx, ny]);

      if (cell === 4) {
        if (nextCollected.length < totalBatteries) {
          setBanner(`Collect ${totalBatteries - nextCollected.length} more battery cell(s) first!`);
          return;
        }
        arcadeAudio.playSfx('correct');
        const bonus = Math.max(120, 300 - moves * 4);
        const nextScore = score + bonus;
        setScore(nextScore);

        if (sectorIdx + 1 >= SECTORS.length) {
          const acc = Math.max(55, 100 - hits * 10);
          void pg.finishRun({
            score: nextScore,
            accuracy: acc,
            won: true,
            meta: { sectorsCleared: SECTORS.length, moves, hits },
          });
        } else {
          const nextIdx = sectorIdx + 1;
          setSectorIdx(nextIdx);
          setPos(SECTORS[nextIdx].start);
          setCollected([]);
          setBanner('Sector cleared! Advancing rover to next floor.');
        }
      }
    },
    [collected, hits, moves, pg, pos, score, sector.grid, sector.start, sectorIdx, totalBatteries]
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        e.preventDefault();
        moveRobot(0, -1);
      } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        e.preventDefault();
        moveRobot(0, 1);
      } else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        moveRobot(-1, 0);
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        moveRobot(1, 0);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [moveRobot]);

  const handleRestart = () => {
    setSectorIdx(0);
    setPos(SECTORS[0].start);
    setCollected([]);
    setMoves(0);
    setHits(0);
    setScore(0);
    setBanner('Collect all batteries to unlock the Docking Pad!');
    void pg.restartSession();
  };

  if (pg.result) {
    return (
      <UniversalResultScreen
        title={def.title}
        result={pg.result}
        rankUnavailable={pg.rankUnavailable}
        statusNote={pg.statusNote}
        primaryMetricLabel="Sectors Cleared"
        primaryMetricValue={`${SECTORS.length} / ${SECTORS.length}`}
        onPlayAgain={handleRestart}
        onNextChallenge={() => onNextChallenge('memory-circuit')}
        nextChallengeLabel="Memory Circuit"
        onLeaderboard={() => onOpenLeaderboard('robot-control')}
        onHome={onGoHome}
      />
    );
  }

  return (
    <MiniGameShell
      title={def.title}
      subtitle={sector.title}
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
      extraHudBadge={`CELLS ${collected.length}/${totalBatteries} · SECTOR ${sectorIdx + 1}/${SECTORS.length}`}
    >
      <div className="studio-card-solid border-2 border-[var(--studio-border-strong)] p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-[1fr_240px] gap-6 items-center">
        {/* Rover Grid */}
        <div className="space-y-3">
          <div className="grid grid-cols-7 gap-1.5 sm:gap-2 max-w-[520px] mx-auto bg-[#070E1E] p-3 rounded-2xl border-2 border-[#1E3A5F]">
            {sector.grid.map((row, y) =>
              row.map((cell, x) => {
                const isBot = pos[0] === x && pos[1] === y;
                const key = `${x},${y}`;
                const hasBattery = cell === 3 && !collected.includes(key);
                return (
                  <div
                    key={key}
                    className={`aspect-square rounded-lg flex items-center justify-center border text-xs ${
                      cell === 1
                        ? 'bg-[#1E293B] border-[#334155]'
                        : cell === 2
                        ? 'bg-rose-950/70 border-rose-500/60'
                        : cell === 4
                        ? dockUnlocked
                          ? 'bg-emerald-950 border-emerald-400'
                          : 'bg-slate-900 border-amber-500/50'
                        : 'bg-[#0C162D] border-[#1E3A5F]'
                    }`}
                  >
                    {isBot ? (
                      <Bot size={22} className="text-sky-400" />
                    ) : hasBattery ? (
                      <BatteryCharging size={18} className="text-amber-400" />
                    ) : cell === 2 ? (
                      <Zap size={17} className="text-rose-400" />
                    ) : cell === 4 ? (
                      <Target size={19} className={dockUnlocked ? 'text-emerald-400' : 'text-amber-300'} />
                    ) : null}
                  </div>
                );
              })
            )}
          </div>

          <div className="text-center font-mono-tech text-xs text-[var(--studio-text-secondary)]">
            {dockUnlocked ? 'Docking Pad OPEN! Steer rover onto the green target.' : banner}
          </div>
        </div>

        {/* Big Touch-Friendly D-Pad */}
        <div className="flex flex-col items-center gap-3 studio-well p-4 rounded-2xl">
          <div className="font-mono-tech text-[11px] font-bold text-[var(--studio-text-muted)] uppercase">
            ROVER D-PAD
          </div>
          <div className="grid grid-cols-3 gap-2 w-44">
            <div />
            <button
              type="button"
              onClick={() => moveRobot(0, -1)}
              aria-label="Move Up"
              className="studio-btn studio-btn-primary h-12 min-h-[48px] flex items-center justify-center"
            >
              <ArrowUp size={20} />
            </button>
            <div />
            <button
              type="button"
              onClick={() => moveRobot(-1, 0)}
              aria-label="Move Left"
              className="studio-btn studio-btn-primary h-12 min-h-[48px] flex items-center justify-center"
            >
              <ArrowLeft size={20} />
            </button>
            <button
              type="button"
              onClick={() => moveRobot(0, 1)}
              aria-label="Move Down"
              className="studio-btn studio-btn-primary h-12 min-h-[48px] flex items-center justify-center"
            >
              <ArrowDown size={20} />
            </button>
            <button
              type="button"
              onClick={() => moveRobot(1, 0)}
              aria-label="Move Right"
              className="studio-btn studio-btn-primary h-12 min-h-[48px] flex items-center justify-center"
            >
              <ArrowRight size={20} />
            </button>
          </div>
          <div className="font-mono-tech text-[11px] text-[var(--studio-text-secondary)]">
            Moves: {moves} · Hazards: {hits}
          </div>
        </div>
      </div>
    </MiniGameShell>
  );
};

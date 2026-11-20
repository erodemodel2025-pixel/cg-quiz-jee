import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, CheckCircle2, RotateCcw, Zap } from 'lucide-react';
import { soundManager } from '../../audio/SoundManager.ts';
import { useArcade } from '../../context/ArcadeContext.tsx';
import { safeFetchJson } from '../../utils/apiClient.ts';
import type { CircuitStageDef, CircuitTileDef } from '../../../shared/minigameData.ts';

interface CircuitRushGameProps {
  onExit: () => void;
}

// Ports in [North, East, South, West]
function getOpenPorts(type: CircuitTileDef['type'], rot: number): [boolean, boolean, boolean, boolean] {
  const r = ((rot % 4) + 4) % 4;
  let base: [boolean, boolean, boolean, boolean] = [false, false, false, false];
  switch (type) {
    case 'source':
    case 'load':
      return [true, true, true, true];
    case 'straight':
      base = [true, false, true, false];
      break;
    case 'corner':
      base = [true, true, false, false];
      break;
    case 'tee':
      base = [true, true, false, true];
      break;
    case 'block':
      return [false, false, false, false];
  }
  const out: [boolean, boolean, boolean, boolean] = [false, false, false, false];
  for (let i = 0; i < 4; i++) {
    out[(i + r) % 4] = base[i];
  }
  return out;
}

function findPoweredCells(stage: CircuitStageDef, rotations: number[][]): {
  powered: Set<string>;
  reachedLoad: boolean;
} {
  const powered = new Set<string>();
  const queue: Array<[number, number]> = [stage.sourcePos];
  powered.add(`${stage.sourcePos[0]},${stage.sourcePos[1]}`);

  const dirs: Array<{ dr: number; dc: number; myPort: number; theirPort: number }> = [
    { dr: -1, dc: 0, myPort: 0, theirPort: 2 }, // N -> S
    { dr: 0, dc: 1, myPort: 1, theirPort: 3 },  // E -> W
    { dr: 1, dc: 0, myPort: 2, theirPort: 0 },  // S -> N
    { dr: 0, dc: -1, myPort: 3, theirPort: 1 }, // W -> E
  ];

  while (queue.length > 0) {
    const [r, c] = queue.shift()!;
    const cell = stage.cells[r][c];
    const ports = getOpenPorts(cell.type, rotations[r][c]);

    for (const d of dirs) {
      if (!ports[d.myPort]) continue;
      const nr = r + d.dr;
      const nc = c + d.dc;
      if (nr < 0 || nr >= stage.rows || nc < 0 || nc >= stage.cols) continue;
      const key = `${nr},${nc}`;
      if (powered.has(key)) continue;
      const neighbor = stage.cells[nr][nc];
      const nPorts = getOpenPorts(neighbor.type, rotations[nr][nc]);
      if (nPorts[d.theirPort]) {
        powered.add(key);
        queue.push([nr, nc]);
      }
    }
  }

  const loadKey = `${stage.loadPos[0]},${stage.loadPos[1]}`;
  return { powered, reachedLoad: powered.has(loadKey) };
}

export const CircuitRushGame: React.FC<CircuitRushGameProps> = ({ onExit }) => {
  const { player, setMusicMode, updateLocalPlayer, triggerCelebration, reportError } = useArcade();
  const [sessionId, setSessionId] = useState('');
  const [stages, setStages] = useState<CircuitStageDef[]>([]);
  const [stageIdx, setStageIdx] = useState(0);
  const [rotations, setRotations] = useState<number[][]>([]);
  const [moves, setMoves] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [stageCleared, setStageCleared] = useState(false);
  const [finished, setFinished] = useState(false);
  const [finalResult, setFinalResult] = useState<{ score: number; xpEarned: number } | null>(null);
  const startedRef = useRef(false);

  const loadStageRotations = useCallback((stage: CircuitStageDef) => {
    // Scramble rotatable tiles so player must solve the circuit
    const grid = stage.cells.map((row) =>
      row.map((cell) => {
        if (cell.locked || cell.type === 'block' || cell.type === 'source' || cell.type === 'load') {
          return cell.solutionRot;
        }
        return (cell.solutionRot + 1 + Math.floor(Math.random() * 2)) % 4;
      })
    );
    setRotations(grid);
    setStageCleared(false);
  }, []);

  const startGame = useCallback(async () => {
    try {
      const res = await safeFetchJson<{ sessionId: string; items: CircuitStageDef[] }>(
        '/api/minigame/start',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ gameType: 'circuit-rush', playerId: player?.id ?? null }),
        }
      );
      const items = res.data?.items;
      if (res.ok && res.data && Array.isArray(items) && items.length > 0) {
        const data = res.data;
        setSessionId(data.sessionId);
        setStages(items);
        setStageIdx(0);
        setMoves(0);
        setElapsed(0);
        setFinished(false);
        setFinalResult(null);
        loadStageRotations(items[0]);
        soundManager.playGameStart();
      }
    } catch (err) {
      reportError(String(err));
    }
  }, [loadStageRotations, player?.id, reportError]);

  useEffect(() => {
    setMusicMode(finished ? 'victory' : 'gameplay');
  }, [finished, setMusicMode]);

  useEffect(() => {
    if (!startedRef.current) {
      startedRef.current = true;
      void startGame();
    }
  }, [startGame]);

  useEffect(() => {
    if (finished || stages.length === 0) return;
    const t = window.setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => window.clearInterval(t);
  }, [finished, stages.length]);

  const currentStage = stages[stageIdx];

  const { powered, reachedLoad } = useMemo(() => {
    if (!currentStage || rotations.length === 0) {
      return { powered: new Set<string>(), reachedLoad: false };
    }
    return findPoweredCells(currentStage, rotations);
  }, [currentStage, rotations]);

  useEffect(() => {
    if (reachedLoad && !stageCleared && currentStage) {
      setStageCleared(true);
      soundManager.playCorrect();
    }
  }, [reachedLoad, stageCleared, currentStage]);

  const rotateCell = (r: number, c: number) => {
    if (!currentStage || stageCleared) return;
    const cell = currentStage.cells[r][c];
    if (cell.locked || cell.type === 'block' || cell.type === 'source' || cell.type === 'load') return;

    soundManager.playClick();
    setMoves((m) => m + 1);
    setRotations((prev) =>
      prev.map((row, ri) => (ri === r ? row.map((val, ci) => (ci === c ? (val + 1) % 4 : val)) : row))
    );
  };

  const handleNextStage = async () => {
    soundManager.playCoin();
    if (stageIdx + 1 < stages.length) {
      const next = stageIdx + 1;
      setStageIdx(next);
      loadStageRotations(stages[next]);
      return;
    }

    // All stages cleared -> validate & save server-side
    try {
      const res = await safeFetchJson<{
        score: number;
        xpEarned: number;
        leveledUp?: boolean;
        player?: NonNullable<typeof player>;
      }>('/api/minigame/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          playerId: player?.id ?? null,
          stagesCleared: stages.length,
          moves,
        }),
      });
      if (res.ok && res.data) {
        const data = res.data;
        setFinalResult({ score: data.score, xpEarned: data.xpEarned });
        if (data.player) updateLocalPlayer(data.player);
        if (data.leveledUp && data.player) {
          soundManager.playLevelUp();
          triggerCelebration('LEVEL UP!', `Level ${data.player.level} reached!`, '#22FF66');
        } else {
          soundManager.playVictory();
        }
        setFinished(true);
      }
    } catch (err) {
      reportError(String(err));
    }
  };

  if (!currentStage) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12 text-center font-pixel text-xs text-[#00F0FF]">
        INITIALIZING CIRCUIT GRID...
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <button
          type="button"
          onClick={() => {
            soundManager.playClick();
            onExit();
          }}
          className="pixel-btn pixel-btn-ghost px-3 py-2 text-[10px]"
        >
          <ArrowLeft size={14} /> Arcade Hub
        </button>

        <div className="pixel-panel px-4 py-2 flex items-center gap-4 font-code text-sm tabular-nums">
          <span className="text-[#FFE600]">
            STAGE {stageIdx + 1}/{stages.length}
          </span>
          <span className="text-[#00F0FF]">MOVES {moves}</span>
          <span className="text-[#22FF66]">TIME {elapsed}s</span>
        </div>
      </div>

      {finished && finalResult ? (
        <div className="pixel-panel p-8 text-center">
          <Zap size={40} className="mx-auto text-[#22FF66] mb-3" />
          <h2 className="font-pixel text-lg sm:text-xl text-[#FFE600] mb-2">
            ALL CIRCUITS ENERGIZED!
          </h2>
          <p className="text-base text-[var(--text-secondary)] mb-6">
            Final Score: <strong className="text-[#00F0FF]">{finalResult.score}</strong> · Moves:{' '}
            {moves} · Time: {elapsed}s · +{finalResult.xpEarned} XP
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={() => {
                soundManager.playClick();
                void startGame();
              }}
              className="pixel-btn pixel-btn-cyan px-5 py-3 text-xs"
            >
              <RotateCcw size={14} /> Play Again
            </button>
            <button
              type="button"
              onClick={() => {
                soundManager.playClick();
                onExit();
              }}
              className="pixel-btn pixel-btn-ghost px-5 py-3 text-xs"
            >
              Back to Arcade
            </button>
          </div>
        </div>
      ) : (
        <div className="grid lg:grid-cols-[1fr_320px] gap-6 items-start">
          <div className="pixel-panel p-5 sm:p-6">
            <div className="flex items-center justify-between gap-2 mb-4">
              <div>
                <h1 className="font-pixel text-sm sm:text-base text-[#00F0FF]">
                  {currentStage.title}
                </h1>
                <p className="text-sm text-[var(--text-secondary)] mt-1">{currentStage.subtitle}</p>
              </div>
              <span className="font-code text-xs px-2.5 py-1 bg-[var(--bg-deep)] border-2 border-[#FFE600] text-[#FFE600]">
                {currentStage.voltage}
              </span>
            </div>

            {/* Interactive Circuit Grid */}
            <div
              className="grid gap-2 mx-auto bg-[var(--bg-deep)] p-4 border-3 border-[var(--border-pixel)]"
              style={{
                gridTemplateColumns: `repeat(${currentStage.cols}, minmax(60px, 90px))`,
                maxWidth: `${currentStage.cols * 98 + 32}px`,
              }}
            >
              {currentStage.cells.map((row, r) =>
                row.map((cell, c) => {
                  const rot = rotations[r]?.[c] ?? 0;
                  const isPowered = powered.has(`${r},${c}`);
                  const ports = getOpenPorts(cell.type, rot);
                  const rotatable =
                    !cell.locked && cell.type !== 'block' && cell.type !== 'source' && cell.type !== 'load';

                  return (
                    <button
                      key={`${r}-${c}`}
                      type="button"
                      disabled={!rotatable}
                      onClick={() => rotateCell(r, c)}
                      aria-label={`Grid cell ${r + 1},${c + 1} ${cell.type}`}
                      className={`aspect-square relative border-2 flex items-center justify-center transition-colors ${
                        cell.type === 'block'
                          ? 'bg-[#090D1A] border-[#1D2645] cursor-default'
                          : isPowered
                            ? 'bg-[#0A2B26] border-[#22FF66] cursor-pointer'
                            : 'bg-[#121A36] border-[var(--border-pixel)] hover:border-[#00F0FF] cursor-pointer'
                      }`}
                    >
                      {/* Render pixel copper/neon traces */}
                      {cell.type !== 'block' && (
                        <>
                          {/* Center node */}
                          <span
                            className="w-4 h-4 block z-10"
                            style={{
                              backgroundColor:
                                cell.type === 'source'
                                  ? '#FFE600'
                                  : cell.type === 'load'
                                    ? reachedLoad
                                      ? '#22FF66'
                                      : '#FF6B00'
                                    : isPowered
                                      ? '#22FF66'
                                      : '#00F0FF',
                            }}
                          />
                          {ports[0] && (
                            <span
                              className="absolute top-0 left-1/2 -translate-x-1/2 w-3 h-1/2"
                              style={{ backgroundColor: isPowered ? '#22FF66' : '#00F0FF' }}
                            />
                          )}
                          {ports[1] && (
                            <span
                              className="absolute right-0 top-1/2 -translate-y-1/2 h-3 w-1/2"
                              style={{ backgroundColor: isPowered ? '#22FF66' : '#00F0FF' }}
                            />
                          )}
                          {ports[2] && (
                            <span
                              className="absolute bottom-0 left-1/2 -translate-x-1/2 w-3 h-1/2"
                              style={{ backgroundColor: isPowered ? '#22FF66' : '#00F0FF' }}
                            />
                          )}
                          {ports[3] && (
                            <span
                              className="absolute left-0 top-1/2 -translate-y-1/2 h-3 w-1/2"
                              style={{ backgroundColor: isPowered ? '#22FF66' : '#00F0FF' }}
                            />
                          )}
                        </>
                      )}

                      {cell.type === 'source' && (
                        <span className="absolute bottom-1 font-pixel text-[8px] text-[#FFE600] z-20 bg-black/80 px-1">
                          VCC
                        </span>
                      )}
                      {cell.type === 'load' && (
                        <span className="absolute bottom-1 font-pixel text-[8px] text-white z-20 bg-black/80 px-1">
                          LED
                        </span>
                      )}
                      {cell.type === 'block' && (
                        <span className="font-code text-[10px] text-[#3B4B7D]">###</span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Info & Controls Panel */}
          <div className="pixel-panel p-5 space-y-4">
            <div className="font-pixel text-[10px] text-[#FFE600]">CIRCUIT TELEMETRY</div>
            <div className="bg-[var(--bg-deep)] p-3 border-2 border-[var(--border-pixel)] font-code text-sm space-y-1">
              <div>
                STATUS:{' '}
                <span className={reachedLoad ? 'text-[#22FF66] font-bold' : 'text-[#FF6B00]'}>
                  {reachedLoad ? 'CLOSED LOOP (ENERGIZED)' : 'OPEN CIRCUIT'}
                </span>
              </div>
              <div>RAIL: {currentStage.voltage}</div>
              <div>TAP BLUE TILES TO ROTATE 90°</div>
            </div>

            {stageCleared && (
              <div className="p-3 bg-[#0B2E1A] border-2 border-[#22FF66] text-sm text-[#DCFFE8]">
                <div className="font-pixel text-[10px] text-[#22FF66] flex items-center gap-2 mb-1">
                  <CheckCircle2 size={14} /> CIRCUIT COMPLETE!
                </div>
                <p className="text-xs sm:text-sm mb-3">{currentStage.explanation}</p>
                <button
                  type="button"
                  onClick={() => void handleNextStage()}
                  className="pixel-btn pixel-btn-green w-full py-3 text-[10px]"
                >
                  {stageIdx + 1 < stages.length ? 'Next Stage' : 'Finish & Claim XP'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

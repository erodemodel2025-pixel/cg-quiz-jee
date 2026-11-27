import React, { useMemo, useState } from 'react';
import { Lightbulb, RotateCcw, Zap } from 'lucide-react';
import { getMiniGameDef } from '../../../../shared/progression.ts';
import { arcadeAudio } from '../../../audio/arcadeAudio.ts';
import { MiniGameShell } from '../shared/MiniGameShell.tsx';
import { UniversalResultScreen } from '../shared/UniversalResultScreen.tsx';
import { usePlaygroundSession } from '../shared/usePlaygroundSession.ts';
import type { MiniGameComponentProps } from './types.ts';

interface CircuitNode {
  id: string;
  label: string;
  kind: 'battery_pos' | 'battery_neg' | 'switch' | 'resistor' | 'bulb' | 'motor' | 'junction';
  x: number;
  y: number;
  tA: string;
  tB: string;
}

interface LevelDef {
  level: number;
  title: string;
  hint: string;
  nodes: CircuitNode[];
  requiredLoadIds: string[];
  switchIds: string[];
}

const LEVELS: LevelDef[] = [
  {
    level: 1,
    title: 'Level 1 · Basic DC Lamp Loop',
    hint: 'Wire Battery (+ -> Bulb -> Battery -) to close the circuit.',
    nodes: [
      { id: 'bat', label: '9V BATTERY', kind: 'battery_pos', x: 95, y: 150, tA: 'bat_pos', tB: 'bat_neg' },
      { id: 'bulb', label: 'LED BULB', kind: 'bulb', x: 375, y: 150, tA: 'bulb_in', tB: 'bulb_out' },
    ],
    requiredLoadIds: ['bulb'],
    switchIds: [],
  },
  {
    level: 2,
    title: 'Level 2 · Switched Lighting Circuit',
    hint: 'Route + through Switch and Bulb back to -, then close the Switch!',
    nodes: [
      { id: 'bat', label: '12V SOURCE', kind: 'battery_pos', x: 90, y: 150, tA: 'bat_pos', tB: 'bat_neg' },
      { id: 'sw1', label: 'SWITCH S1', kind: 'switch', x: 245, y: 75, tA: 'sw1_a', tB: 'sw1_b' },
      { id: 'bulb', label: 'WORK LAMP', kind: 'bulb', x: 400, y: 150, tA: 'bulb_in', tB: 'bulb_out' },
    ],
    requiredLoadIds: ['bulb'],
    switchIds: ['sw1'],
  },
  {
    level: 3,
    title: 'Level 3 · Protected DC Motor Drive',
    hint: 'Connect Source + -> Resistor -> Switch -> Motor -> Source -.',
    nodes: [
      { id: 'bat', label: '12V PACK', kind: 'battery_pos', x: 80, y: 150, tA: 'bat_pos', tB: 'bat_neg' },
      { id: 'res', label: '100Ω RES', kind: 'resistor', x: 225, y: 70, tA: 'res_a', tB: 'res_b' },
      { id: 'sw1', label: 'IGNITION SW', kind: 'switch', x: 365, y: 70, tA: 'sw1_a', tB: 'sw1_b' },
      { id: 'mot', label: 'DC MOTOR', kind: 'motor', x: 410, y: 220, tA: 'mot_in', tB: 'mot_out' },
    ],
    requiredLoadIds: ['mot'],
    switchIds: ['sw1'],
  },
  {
    level: 4,
    title: 'Level 4 · Parallel Bulb + Cooling Fan',
    hint: 'Power BOTH the Bulb and Motor via parallel paths through the Switch!',
    nodes: [
      { id: 'bat', label: '24V BUS', kind: 'battery_pos', x: 75, y: 150, tA: 'bat_pos', tB: 'bat_neg' },
      { id: 'sw1', label: 'MASTER SW', kind: 'switch', x: 215, y: 80, tA: 'sw1_a', tB: 'sw1_b' },
      { id: 'bulb', label: 'PILOT BULB', kind: 'bulb', x: 385, y: 80, tA: 'bulb_in', tB: 'bulb_out' },
      { id: 'mot', label: 'COOLING FAN', kind: 'motor', x: 385, y: 220, tA: 'mot_in', tB: 'mot_out' },
    ],
    requiredLoadIds: ['bulb', 'mot'],
    switchIds: ['sw1'],
  },
  {
    level: 5,
    title: 'Level 5 · Interlocked Heavy Actuator',
    hint: 'Chain Battery + -> Switch 1 -> Resistor -> Switch 2 -> Bulb + Motor -> Battery -.',
    nodes: [
      { id: 'bat', label: '24V CELL', kind: 'battery_pos', x: 75, y: 150, tA: 'bat_pos', tB: 'bat_neg' },
      { id: 'sw1', label: 'SAFETY SW1', kind: 'switch', x: 195, y: 65, tA: 'sw1_a', tB: 'sw1_b' },
      { id: 'res', label: 'LIMIT RES', kind: 'resistor', x: 330, y: 65, tA: 'res_a', tB: 'res_b' },
      { id: 'sw2', label: 'ARM SW2', kind: 'switch', x: 430, y: 145, tA: 'sw2_a', tB: 'sw2_b' },
      { id: 'bulb', label: 'STATUS LAMP', kind: 'bulb', x: 325, y: 235, tA: 'bulb_in', tB: 'bulb_out' },
      { id: 'mot', label: 'SERVO MOTOR', kind: 'motor', x: 185, y: 235, tA: 'mot_in', tB: 'mot_out' },
    ],
    requiredLoadIds: ['bulb', 'mot'],
    switchIds: ['sw1', 'sw2'],
  },
];

interface Wire {
  a: string;
  b: string;
}

export const CircuitConnectGame: React.FC<MiniGameComponentProps> = ({
  onExit,
  onNextChallenge,
  onOpenLeaderboard,
  onGoHome,
}) => {
  const def = getMiniGameDef('circuit-connect')!;
  const pg = usePlaygroundSession('circuit-connect');

  const [levelIdx, setLevelIdx] = useState(0);
  const [wires, setWires] = useState<Wire[]>([]);
  const [selectedTerminal, setSelectedTerminal] = useState<string | null>(null);
  const [closedSwitches, setClosedSwitches] = useState<Record<string, boolean>>({ sw1: true, sw2: true });
  const [score, setScore] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [statusMessage, setStatusMessage] = useState<string>('Tap two terminals to snap a copper wire.');
  const [levelCleared, setLevelCleared] = useState(false);

  const current = LEVELS[levelIdx];

  const terminalCoords = useMemo(() => {
    const map = new Map<string, { x: number; y: number; nodeId: string; tag: string }>();
    for (const n of current.nodes) {
      map.set(n.tA, {
        x: n.x - 44,
        y: n.y,
        nodeId: n.id,
        tag: n.kind === 'battery_pos' ? '+' : 'A',
      });
      map.set(n.tB, {
        x: n.x + 44,
        y: n.y,
        nodeId: n.id,
        tag: n.kind === 'battery_pos' ? '-' : 'B',
      });
    }
    return map;
  }, [current]);

  // Real continuity graph solver
  const evaluation = useMemo(() => {
    const adj = new Map<string, string[]>();
    const link = (u: string, v: string) => {
      if (!adj.has(u)) adj.set(u, []);
      if (!adj.has(v)) adj.set(v, []);
      adj.get(u)!.push(v);
      adj.get(v)!.push(u);
    };

    for (const w of wires) {
      link(w.a, w.b);
    }

    // Check short circuit ignoring loads
    const shortAdj = new Map<string, string[]>();
    const shortLink = (u: string, v: string) => {
      if (!shortAdj.has(u)) shortAdj.set(u, []);
      if (!shortAdj.has(v)) shortAdj.set(v, []);
      shortAdj.get(u)!.push(v);
      shortAdj.get(v)!.push(u);
    };
    for (const w of wires) shortLink(w.a, w.b);
    for (const n of current.nodes) {
      if (n.kind === 'switch' && closedSwitches[n.id]) {
        shortLink(n.tA, n.tB);
      }
    }
    const shortVisited = new Set<string>(['bat_pos']);
    const sq = ['bat_pos'];
    while (sq.length) {
      const u = sq.shift()!;
      for (const v of shortAdj.get(u) || []) {
        if (!shortVisited.has(v)) {
          shortVisited.add(v);
          sq.push(v);
        }
      }
    }
    const hasShort = shortVisited.has('bat_neg');

    // Internal bridges for resistors, switches (when closed), bulbs, motors
    for (const n of current.nodes) {
      if (n.kind === 'battery_pos') continue;
      if (n.kind === 'switch' && !closedSwitches[n.id]) continue;
      link(n.tA, n.tB);
    }

    const bfsFrom = (start: string, bannedEdge?: [string, string]) => {
      const vis = new Set<string>([start]);
      const q = [start];
      while (q.length) {
        const u = q.shift()!;
        for (const v of adj.get(u) || []) {
          if (
            bannedEdge &&
            ((u === bannedEdge[0] && v === bannedEdge[1]) || (u === bannedEdge[1] && v === bannedEdge[0]))
          ) {
            continue;
          }
          if (!vis.has(v)) {
            vis.add(v);
            q.push(v);
          }
        }
      }
      return vis;
    };

    const fullReach = bfsFrom('bat_pos');
    const isClosedLoop = !hasShort && fullReach.has('bat_neg');

    const poweredLoads = new Set<string>();
    if (isClosedLoop) {
      for (const loadId of current.requiredLoadIds) {
        const node = current.nodes.find((n) => n.id === loadId);
        if (!node) continue;
        // Ensure bat_pos and bat_neg actually route through this load (or branch containing this load)
        if (fullReach.has(node.tA) && fullReach.has(node.tB)) {
          const withoutLoad = bfsFrom('bat_pos', [node.tA, node.tB]);
          // If load is series (removing it breaks circuit) OR both terminals connect directly to opposite poles
          if (!withoutLoad.has('bat_neg') || (withoutLoad.has(node.tA) && !withoutLoad.has(node.tB)) || (!withoutLoad.has(node.tA) && withoutLoad.has(node.tB)) || wires.length >= current.nodes.length) {
            poweredLoads.add(loadId);
          }
        }
      }
    }

    // Verify all required switches are part of active loop when present
    const allSwitchesIncluded = current.switchIds.every((swId) => {
      const sw = current.nodes.find((n) => n.id === swId);
      if (!sw) return true;
      return closedSwitches[swId] && fullReach.has(sw.tA);
    });

    const resistorOk = current.nodes
      .filter((n) => n.kind === 'resistor')
      .every((r) => fullReach.has(r.tA));

    const solved =
      isClosedLoop &&
      allSwitchesIncluded &&
      resistorOk &&
      current.requiredLoadIds.every((id) => poweredLoads.has(id));

    return { hasShort, isClosedLoop, poweredLoads, solved };
  }, [closedSwitches, current, wires]);

  const handleTerminalTap = (termId: string) => {
    if (pg.isPaused || levelCleared || pg.result) return;
    if (!selectedTerminal) {
      arcadeAudio.playSfx('click');
      setSelectedTerminal(termId);
      return;
    }
    if (selectedTerminal === termId) {
      setSelectedTerminal(null);
      return;
    }

    const existsIdx = wires.findIndex(
      (w) =>
        (w.a === selectedTerminal && w.b === termId) ||
        (w.a === termId && w.b === selectedTerminal)
    );

    if (existsIdx >= 0) {
      arcadeAudio.playSfx('click');
      setWires((prev) => prev.filter((_, i) => i !== existsIdx));
      setSelectedTerminal(null);
      return;
    }

    // Prevent connecting two terminals of the exact same node
    const nodeA = terminalCoords.get(selectedTerminal)?.nodeId;
    const nodeB = terminalCoords.get(termId)?.nodeId;
    if (nodeA && nodeA === nodeB) {
      arcadeAudio.playSfx('wrong');
      setMistakes((m) => m + 1);
      setStatusMessage('Cannot short-wire a component directly to itself!');
      setSelectedTerminal(null);
      return;
    }

    const nextWires = [...wires, { a: selectedTerminal, b: termId }];
    setWires(nextWires);
    setSelectedTerminal(null);
    arcadeAudio.playSfx('snap');
  };

  const handleVerifyAndAdvance = () => {
    if (evaluation.hasShort) {
      arcadeAudio.playSfx('wrong');
      setMistakes((m) => m + 1);
      setStatusMessage('SHORT CIRCUIT! Battery + and - are bridged without a load.');
      return;
    }
    if (!evaluation.solved) {
      arcadeAudio.playSfx('wrong');
      setMistakes((m) => m + 1);
      setStatusMessage('Open circuit or missing component! Ensure switches are ON and loads are wired.');
      return;
    }

    arcadeAudio.playSfx('correct');
    const levelPts = Math.max(180, 380 - mistakes * 20);
    const nextScore = score + levelPts;
    setScore(nextScore);
    setLevelCleared(true);
    setStatusMessage('Continuity verified! Current flowing cleanly.');

    window.setTimeout(() => {
      if (levelIdx + 1 >= LEVELS.length) {
        const acc = Math.max(50, Math.round((100 - mistakes * 6) * 10) / 10);
        void pg.finishRun({
          score: nextScore,
          accuracy: acc,
          won: true,
          meta: { levelsCleared: LEVELS.length, mistakes },
        });
      } else {
        setLevelIdx((i) => i + 1);
        setWires([]);
        setSelectedTerminal(null);
        setLevelCleared(false);
        setStatusMessage('Tap two terminals to snap a copper wire.');
      }
    }, 900);
  };

  const handleRestart = () => {
    setLevelIdx(0);
    setWires([]);
    setSelectedTerminal(null);
    setClosedSwitches({ sw1: true, sw2: true });
    setScore(0);
    setMistakes(0);
    setLevelCleared(false);
    setStatusMessage('Tap two terminals to snap a copper wire.');
    void pg.restartSession();
  };

  if (pg.result) {
    return (
      <UniversalResultScreen
        title={def.title}
        result={pg.result}
        rankUnavailable={pg.rankUnavailable}
        statusNote={pg.statusNote}
        primaryMetricLabel="Circuits Wired"
        primaryMetricValue={`${LEVELS.length} / ${LEVELS.length}`}
        onPlayAgain={handleRestart}
        onNextChallenge={() => onNextChallenge('engineering-balance')}
        nextChallengeLabel="Balance Beam"
        onLeaderboard={() => onOpenLeaderboard('circuit-connect')}
        onHome={onGoHome}
      />
    );
  }

  return (
    <MiniGameShell
      title={def.title}
      subtitle={current.title}
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
      extraHudBadge={`STAGE ${levelIdx + 1} / ${LEVELS.length}`}
    >
      <div className="studio-card-solid border-2 border-[var(--studio-border-strong)] p-4 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs sm:text-sm font-sora font-semibold text-[var(--studio-text)]">
            {current.hint}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                arcadeAudio.playSfx('click');
                setWires([]);
                setSelectedTerminal(null);
              }}
              className="studio-btn studio-btn-ghost px-3 py-2 min-h-[44px] text-xs"
            >
              <RotateCcw size={14} />
              <span>Clear Wires</span>
            </button>
            <button
              type="button"
              onClick={handleVerifyAndAdvance}
              className="studio-btn studio-btn-primary px-4 py-2 min-h-[44px] text-xs"
            >
              <Zap size={14} />
              <span>ENERGIZE CIRCUIT</span>
            </button>
          </div>
        </div>

        {/* Interactive SVG Breadboard Canvas */}
        <div className="rounded-2xl bg-[#070E1E] border-2 border-[#1E3A5F] overflow-hidden">
          <svg viewBox="0 0 500 300" className="w-full h-auto touch-manipulation">
            <defs>
              <pattern id="grid20" width="25" height="25" patternUnits="userSpaceOnUse">
                <path d="M 25 0 L 0 0 0 25" fill="none" stroke="rgba(56,189,248,0.12)" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width="500" height="300" fill="url(#grid20)" />

            {/* Drawn Copper Wires */}
            {wires.map((w, idx) => {
              const p1 = terminalCoords.get(w.a);
              const p2 = terminalCoords.get(w.b);
              if (!p1 || !p2) return null;
              const liveWire = evaluation.solved;
              const shortWire = evaluation.hasShort;
              return (
                <g
                  key={`${w.a}-${w.b}-${idx}`}
                  onClick={() => setWires((prev) => prev.filter((_, i) => i !== idx))}
                  className="cursor-pointer"
                >
                  <line
                    x1={p1.x}
                    y1={p1.y}
                    x2={p2.x}
                    y2={p2.y}
                    stroke={shortWire ? '#EF4444' : liveWire ? '#34D399' : '#F59E0B'}
                    strokeWidth="5"
                    strokeLinecap="round"
                  />
                  <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="transparent" strokeWidth="16" />
                </g>
              );
            })}

            {/* Component Blocks + Interactive Terminals */}
            {current.nodes.map((n) => {
              const powered = evaluation.poweredLoads.has(n.id);
              const swClosed = n.kind === 'switch' ? Boolean(closedSwitches[n.id]) : false;
              const tA = terminalCoords.get(n.tA)!;
              const tB = terminalCoords.get(n.tB)!;

              return (
                <g key={n.id}>
                  <rect
                    x={n.x - 38}
                    y={n.y - 26}
                    width="76"
                    height="52"
                    rx="10"
                    fill={powered ? '#064E3B' : '#111C35'}
                    stroke={powered ? '#34D399' : n.kind === 'battery_pos' ? '#38BDF8' : '#475569'}
                    strokeWidth="2.5"
                  />
                  <text
                    x={n.x}
                    y={n.y - 7}
                    textAnchor="middle"
                    fill="#F8FAFC"
                    fontSize="9"
                    fontWeight="700"
                    fontFamily="monospace"
                  >
                    {n.label}
                  </text>

                  {n.kind === 'switch' && (
                    <g
                      onClick={() => {
                        arcadeAudio.playSfx('snap');
                        setClosedSwitches((prev) => ({ ...prev, [n.id]: !prev[n.id] }));
                      }}
                      className="cursor-pointer"
                    >
                      <rect
                        x={n.x - 24}
                        y={n.y + 2}
                        width="48"
                        height="16"
                        rx="4"
                        fill={swClosed ? '#10B981' : '#EF4444'}
                      />
                      <text
                        x={n.x}
                        y={n.y + 13}
                        textAnchor="middle"
                        fill="#FFFFFF"
                        fontSize="8.5"
                        fontWeight="800"
                      >
                        {swClosed ? 'ON' : 'OFF'}
                      </text>
                    </g>
                  )}

                  {n.kind === 'bulb' && (
                    <circle
                      cx={n.x}
                      cy={n.y + 9}
                      r="9"
                      fill={powered ? '#FACC15' : '#334155'}
                      stroke="#FDE047"
                      strokeWidth="1.5"
                    />
                  )}

                  {n.kind === 'motor' && (
                    <text
                      x={n.x}
                      y={n.y + 14}
                      textAnchor="middle"
                      fill={powered ? '#34D399' : '#94A3B8'}
                      fontSize="11"
                      fontWeight="800"
                    >
                      {powered ? 'SPIN ↻' : 'IDLE'}
                    </text>
                  )}

                  {n.kind === 'battery_pos' && (
                    <text x={n.x} y={n.y + 13} textAnchor="middle" fill="#38BDF8" fontSize="10" fontWeight="800">
                      + DC -
                    </text>
                  )}

                  {n.kind === 'resistor' && (
                    <path
                      d={`M ${n.x - 22} ${n.y + 9} L ${n.x - 14} ${n.y + 3} L ${n.x - 6} ${n.y + 15} L ${n.x + 2} ${n.y + 3} L ${n.x + 10} ${n.y + 15} L ${n.x + 18} ${n.y + 9}`}
                      fill="none"
                      stroke="#F59E0B"
                      strokeWidth="2.5"
                    />
                  )}

                  {[
                    { id: n.tA, pt: tA },
                    { id: n.tB, pt: tB },
                  ].map(({ id, pt }) => {
                    const isSel = selectedTerminal === id;
                    return (
                      <g key={id} onClick={() => handleTerminalTap(id)} className="cursor-pointer">
                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r={isSel ? 12 : 9}
                          fill={isSel ? '#FACC15' : pt.tag === '+' ? '#EF4444' : '#38BDF8'}
                          stroke="#FFFFFF"
                          strokeWidth="2"
                        />
                        <text
                          x={pt.x}
                          y={pt.y + 3.5}
                          textAnchor="middle"
                          fill="#0F172A"
                          fontSize="9"
                          fontWeight="900"
                        >
                          {pt.tag}
                        </text>
                      </g>
                    );
                  })}
                </g>
              );
            })}
          </svg>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono-tech">
          <span
            className={
              evaluation.hasShort
                ? 'text-rose-400 font-bold'
                : evaluation.solved
                ? 'text-emerald-400 font-bold'
                : 'text-[var(--studio-text-secondary)]'
            }
          >
            {evaluation.hasShort
              ? 'ALERT: Direct short detected (+ connected straight to -).'
              : evaluation.solved
              ? 'READY: Closed loop active! Click ENERGIZE CIRCUIT.'
              : statusMessage}
          </span>
          <span className="text-[var(--studio-text-muted)]">
            <Lightbulb size={13} className="inline mr-1" />
            Click any wire to disconnect it.
          </span>
        </div>
      </div>
    </MiniGameShell>
  );
};

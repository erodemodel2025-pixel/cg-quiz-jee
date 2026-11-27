import React, { useState } from 'react';
import { Hammer, Play, RotateCcw, Truck } from 'lucide-react';
import { getMiniGameDef } from '../../../../shared/progression.ts';
import { arcadeAudio } from '../../../audio/arcadeAudio.ts';
import { MiniGameShell } from '../shared/MiniGameShell.tsx';
import { UniversalResultScreen } from '../shared/UniversalResultScreen.tsx';
import { usePlaygroundSession } from '../shared/usePlaygroundSession.ts';
import type { MiniGameComponentProps } from './types.ts';

interface TrussNode {
  id: string;
  x: number;
  y: number;
  fixedAnchor?: boolean;
  deckOrder?: number;
}

interface BridgeLevel {
  title: string;
  budget: number;
  nodes: TrussNode[];
  requiredDeckChain: string[];
  minTriangles: number;
}

const LEVELS: BridgeLevel[] = [
  {
    title: 'Span 1 · Creek Crossing',
    budget: 8,
    nodes: [
      { id: 'L', x: 60, y: 170, fixedAnchor: true, deckOrder: 0 },
      { id: 'D1', x: 190, y: 170, deckOrder: 1 },
      { id: 'D2', x: 310, y: 170, deckOrder: 2 },
      { id: 'R', x: 440, y: 170, fixedAnchor: true, deckOrder: 3 },
      { id: 'T1', x: 190, y: 95 },
      { id: 'T2', x: 310, y: 95 },
    ],
    requiredDeckChain: ['L', 'D1', 'D2', 'R'],
    minTriangles: 2,
  },
  {
    title: 'Span 2 · Canyon Viaduct',
    budget: 11,
    nodes: [
      { id: 'L', x: 50, y: 175, fixedAnchor: true, deckOrder: 0 },
      { id: 'D1', x: 155, y: 175, deckOrder: 1 },
      { id: 'D2', x: 250, y: 175, deckOrder: 2 },
      { id: 'D3', x: 345, y: 175, deckOrder: 3 },
      { id: 'R', x: 450, y: 175, fixedAnchor: true, deckOrder: 4 },
      { id: 'T1', x: 155, y: 95 },
      { id: 'T2', x: 250, y: 82 },
      { id: 'T3', x: 345, y: 95 },
    ],
    requiredDeckChain: ['L', 'D1', 'D2', 'D3', 'R'],
    minTriangles: 3,
  },
];

interface Beam {
  a: string;
  b: string;
}

function edgeKey(a: string, b: string): string {
  return a < b ? `${a}-${b}` : `${b}-${a}`;
}

export const BridgeBuilderGame: React.FC<MiniGameComponentProps> = ({
  onExit,
  onNextChallenge,
  onOpenLeaderboard,
  onGoHome,
}) => {
  const def = getMiniGameDef('bridge-builder')!;
  const pg = usePlaygroundSession('bridge-builder');

  const [levelIdx, setLevelIdx] = useState(0);
  const [beams, setBeams] = useState<Beam[]>([]);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [truckProgress, setTruckProgress] = useState<number>(0); // 0..100
  const [testing, setTesting] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [score, setScore] = useState(0);
  const [failures, setFailures] = useState(0);
  const [status, setStatus] = useState('Click node pairs to span deck + upper truss triangles, then press TEST BRIDGE.');

  const level = LEVELS[levelIdx];
  const nodeMap = new Map(level.nodes.map((n) => [n.id, n]));

  const hasBeam = (a: string, b: string) =>
    beams.some((m) => edgeKey(m.a, m.b) === edgeKey(a, b));

  const countTriangles = () => {
    const ids = level.nodes.map((n) => n.id);
    let tris = 0;
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        if (!hasBeam(ids[i], ids[j])) continue;
        for (let k = j + 1; k < ids.length; k++) {
          if (hasBeam(ids[i], ids[k]) && hasBeam(ids[j], ids[k])) tris += 1;
        }
      }
    }
    return tris;
  };

  const toggleNode = (id: string) => {
    if (testing || pg.isPaused || pg.result) return;
    setCollapsed(false);
    if (!selectedNode) {
      arcadeAudio.playSfx('click');
      setSelectedNode(id);
      return;
    }
    if (selectedNode === id) {
      setSelectedNode(null);
      return;
    }

    const existsIdx = beams.findIndex((b) => edgeKey(b.a, b.b) === edgeKey(selectedNode, id));
    if (existsIdx >= 0) {
      arcadeAudio.playSfx('click');
      setBeams((prev) => prev.filter((_, i) => i !== existsIdx));
      setSelectedNode(null);
      return;
    }

    if (beams.length >= level.budget) {
      arcadeAudio.playSfx('wrong');
      setStatus(`Beam budget reached (${level.budget} max)! Remove a beam or click TEST BRIDGE.`);
      setSelectedNode(null);
      return;
    }

    arcadeAudio.playSfx('snap');
    setBeams((prev) => [...prev, { a: selectedNode, b: id }]);
    setSelectedNode(null);
  };

  const runLoadTest = () => {
    if (testing || pg.isPaused || pg.result) return;
    // Check continuous road deck
    let deckConnected = true;
    for (let i = 0; i < level.requiredDeckChain.length - 1; i++) {
      if (!hasBeam(level.requiredDeckChain[i], level.requiredDeckChain[i + 1])) {
        deckConnected = false;
        break;
      }
    }
    const triangles = countTriangles();
    const passes = deckConnected && triangles >= level.minTriangles;

    setTesting(true);
    setCollapsed(false);
    setTruckProgress(0);

    let step = 0;
    const interval = window.setInterval(() => {
      step += passes ? 5 : 4;
      setTruckProgress(Math.min(100, step));

      if (!passes && step >= 48) {
        window.clearInterval(interval);
        arcadeAudio.playSfx('bonk');
        setCollapsed(true);
        setTesting(false);
        setFailures((f) => f + 1);
        setStatus(
          !deckConnected
            ? 'Road deck broken! Connect the continuous horizontal road span L -> R.'
            : `Not enough rigid triangles (${triangles}/${level.minTriangles}) — bridge buckled under load!`
        );
        return;
      }

      if (step >= 100) {
        window.clearInterval(interval);
        arcadeAudio.playSfx('correct');
        const efficiencyBonus = Math.max(0, (level.budget - beams.length) * 45);
        const spanPts = 460 + efficiencyBonus + triangles * 40;
        const nextScore = score + spanPts;
        setScore(nextScore);
        setTesting(false);
        setStatus('Load test PASSED! Heavy truck crossed safely.');

        window.setTimeout(() => {
          if (levelIdx + 1 >= LEVELS.length) {
            const acc = Math.max(55, 100 - failures * 12);
            void pg.finishRun({
              score: nextScore,
              rawMetric: beams.length,
              accuracy: acc,
              won: true,
              meta: { spansCleared: LEVELS.length, triangles, failures },
            });
          } else {
            setLevelIdx((i) => i + 1);
            setBeams([]);
            setSelectedNode(null);
            setTruckProgress(0);
            setStatus('Span 2 loaded! Build a triangulated viaduct and run TEST BRIDGE.');
          }
        }, 700);
      }
    }, 55);
  };

  const handleRestart = () => {
    setLevelIdx(0);
    setBeams([]);
    setSelectedNode(null);
    setTruckProgress(0);
    setTesting(false);
    setCollapsed(false);
    setScore(0);
    setFailures(0);
    setStatus('Click node pairs to span deck + upper truss triangles, then press TEST BRIDGE.');
    void pg.restartSession();
  };

  if (pg.result) {
    return (
      <UniversalResultScreen
        title={def.title}
        result={pg.result}
        rankUnavailable={pg.rankUnavailable}
        statusNote={pg.statusNote}
        primaryMetricLabel="Final Span Beams"
        primaryMetricValue={`${Math.round(pg.result.rawMetric)} beams`}
        onPlayAgain={handleRestart}
        onNextChallenge={() => onNextChallenge('gear-machine')}
        nextChallengeLabel="Gear Machine"
        onLeaderboard={() => onOpenLeaderboard('bridge-builder')}
        onHome={onGoHome}
      />
    );
  }

  const startX = level.nodes[0].x;
  const endX = level.nodes.find((n) => n.id === 'R')!.x;
  const truckX = startX + ((endX - startX) * truckProgress) / 100;

  return (
    <MiniGameShell
      title={def.title}
      subtitle={level.title}
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
      extraHudBadge={`BEAMS ${beams.length}/${level.budget} · TRIANGLES ${countTriangles()}/${level.minTriangles}`}
    >
      <div className="studio-card-solid border-2 border-[var(--studio-border-strong)] p-4 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs sm:text-sm font-sora font-semibold text-[var(--studio-text)]">
            <Hammer size={14} className="inline mr-1.5 text-[var(--studio-amber-text)]" />
            {status}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={testing}
              onClick={() => {
                arcadeAudio.playSfx('click');
                setBeams([]);
                setCollapsed(false);
                setTruckProgress(0);
              }}
              className="studio-btn studio-btn-ghost px-3 py-2 min-h-[44px] text-xs"
            >
              <RotateCcw size={14} />
              <span>Clear</span>
            </button>
            <button
              type="button"
              disabled={testing}
              onClick={runLoadTest}
              className="studio-btn studio-btn-primary px-4 py-2 min-h-[44px] text-xs sm:text-sm"
            >
              <Play size={15} />
              <span>TEST BRIDGE</span>
            </button>
          </div>
        </div>

        <div className="rounded-2xl bg-[#070E1E] border-2 border-[#1E3A5F] overflow-hidden">
          <svg viewBox="0 0 500 250" className="w-full h-auto touch-manipulation">
            {/* Gorge & Cliffs */}
            <rect x="0" y="175" width="75" height="75" fill="#1E293B" />
            <rect x="425" y="175" width="75" height="75" fill="#1E293B" />
            <rect x="75" y="218" width="350" height="32" fill="#0F294A" />

            {/* Beams */}
            {beams.map((b, idx) => {
              const p1 = nodeMap.get(b.a);
              const p2 = nodeMap.get(b.b);
              if (!p1 || !p2) return null;
              const sag = collapsed ? 22 : 0;
              return (
                <line
                  key={`${b.a}-${b.b}-${idx}`}
                  x1={p1.x}
                  y1={p1.y + (p1.fixedAnchor ? 0 : sag)}
                  x2={p2.x}
                  y2={p2.y + (p2.fixedAnchor ? 0 : sag)}
                  stroke={collapsed ? '#EF4444' : p1.deckOrder !== undefined && p2.deckOrder !== undefined ? '#F59E0B' : '#38BDF8'}
                  strokeWidth="6"
                  strokeLinecap="round"
                  onClick={() => toggleNode(b.a)}
                />
              );
            })}

            {/* Moving Truck */}
            {(testing || truckProgress > 0) && (
              <g transform={`translate(${truckX - 16}, ${collapsed ? 184 : 145})`}>
                <rect width="32" height="18" rx="4" fill="#10B981" stroke="#FFFFFF" strokeWidth="1.5" />
                <circle cx="8" cy="20" r="4" fill="#E2E8F0" />
                <circle cx="24" cy="20" r="4" fill="#E2E8F0" />
              </g>
            )}

            {/* Truss Anchor & Joint Nodes */}
            {level.nodes.map((n) => {
              const isSel = selectedNode === n.id;
              return (
                <g key={n.id} onClick={() => toggleNode(n.id)} className="cursor-pointer">
                  <circle
                    cx={n.x}
                    cy={n.y}
                    r={isSel ? 13 : 10}
                    fill={isSel ? '#FACC15' : n.fixedAnchor ? '#10B981' : '#0EA5E9'}
                    stroke="#FFFFFF"
                    strokeWidth="2.5"
                  />
                  <text x={n.x} y={n.y + 3.5} textAnchor="middle" fill="#04101D" fontSize="8.5" fontWeight="900">
                    {n.id}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        <div className="flex items-center justify-between text-xs font-mono-tech text-[var(--studio-text-muted)]">
          <span>
            <Truck size={13} className="inline mr-1" />
            Tip: Connect road deck nodes ({level.requiredDeckChain.join(' -> ')}) plus diagonal truss triangles above.
          </span>
        </div>
      </div>
    </MiniGameShell>
  );
};

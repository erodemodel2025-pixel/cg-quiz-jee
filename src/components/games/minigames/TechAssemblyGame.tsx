import React, { useState } from 'react';
import { CheckCircle2, Cpu, HardDrive, Layers, Monitor, Zap } from 'lucide-react';
import { getMiniGameDef } from '../../../../shared/progression.ts';
import { arcadeAudio } from '../../../audio/arcadeAudio.ts';
import { MiniGameShell } from '../shared/MiniGameShell.tsx';
import { UniversalResultScreen } from '../shared/UniversalResultScreen.tsx';
import { usePlaygroundSession } from '../shared/usePlaygroundSession.ts';
import type { MiniGameComponentProps } from './types.ts';

type PartId = 'motherboard' | 'cpu' | 'cooler' | 'ram' | 'gpu' | 'ssd';

interface HardwarePart {
  id: PartId;
  name: string;
  slotLabel: string;
  requires?: PartId;
  hint: string;
  accent: string;
}

const PARTS: HardwarePart[] = [
  {
    id: 'motherboard',
    name: 'ATX Motherboard',
    slotLabel: 'CHASSIS STANDOFFS',
    hint: 'Install the Motherboard into the chassis standoffs first!',
    accent: '#0EA5E9',
  },
  {
    id: 'cpu',
    name: '16-Core CPU',
    slotLabel: 'AM5 ZIF SOCKET',
    requires: 'motherboard',
    hint: 'Seat CPU into the Motherboard socket before mounting the cooler.',
    accent: '#22C55E',
  },
  {
    id: 'cooler',
    name: 'Tower CPU Cooler',
    slotLabel: 'THERMAL MOUNT',
    requires: 'cpu',
    hint: 'CPU must be seated under the cooler first!',
    accent: '#06B6D4',
  },
  {
    id: 'ram',
    name: '32GB DDR5 RAM',
    slotLabel: 'DIMM A2/B2 SLOTS',
    requires: 'motherboard',
    hint: 'Dual-channel DDR5 installs into the Motherboard DIMM slots.',
    accent: '#A855F7',
  },
  {
    id: 'gpu',
    name: 'Workstation GPU',
    slotLabel: 'PCIe x16 SLOT',
    requires: 'motherboard',
    hint: 'Lock the GPU into the Motherboard primary PCIe x16 slot.',
    accent: '#F59E0B',
  },
  {
    id: 'ssd',
    name: '2TB NVMe SSD',
    slotLabel: 'M.2 GEN5 BAY',
    requires: 'motherboard',
    hint: 'Slide the NVMe SSD into the Motherboard M.2 slot.',
    accent: '#EC4899',
  },
];

export const TechAssemblyGame: React.FC<MiniGameComponentProps> = ({
  onExit,
  onNextChallenge,
  onOpenLeaderboard,
  onGoHome,
}) => {
  const def = getMiniGameDef('tech-assembly')!;
  const pg = usePlaygroundSession('tech-assembly');

  const [installed, setInstalled] = useState<PartId[]>([]);
  const [selectedPart, setSelectedPart] = useState<PartId | null>('motherboard');
  const [draggingPart, setDraggingPart] = useState<PartId | null>(null);
  const [mistakes, setMistakes] = useState(0);
  const [score, setScore] = useState(0);
  const [feedback, setFeedback] = useState('Drag a hardware part to its matching socket — or tap Part then tap Slot.');

  const tryInstall = (partId: PartId, slotTarget: PartId) => {
    if (pg.isPaused || pg.result || pg.submitting) return;
    if (installed.includes(slotTarget)) return;

    if (partId !== slotTarget) {
      arcadeAudio.playSfx('wrong');
      setMistakes((m) => m + 1);
      const targetPart = PARTS.find((p) => p.id === partId);
      setFeedback(`Wrong socket! ${targetPart?.name} belongs in ${targetPart?.slotLabel}.`);
      return;
    }

    const part = PARTS.find((p) => p.id === partId)!;
    if (part.requires && !installed.includes(part.requires)) {
      arcadeAudio.playSfx('wrong');
      setMistakes((m) => m + 1);
      setFeedback(`Mechanical Order Error: ${part.hint}`);
      return;
    }

    arcadeAudio.playSfx('snap');
    const nextInstalled = [...installed, partId];
    setInstalled(nextInstalled);
    const stepPoints = 220;
    const nextScore = score + stepPoints;
    setScore(nextScore);
    setSelectedPart(PARTS.find((p) => !nextInstalled.includes(p.id))?.id ?? null);
    setFeedback(`${part.name} seated & torqued cleanly!`);

    if (nextInstalled.length >= PARTS.length) {
      const timeBonus = Math.max(80, 500 - pg.elapsedSeconds * 10);
      const totalScore = nextScore + timeBonus;
      setScore(totalScore);
      const acc = Math.max(50, 100 - mistakes * 10);
      void pg.finishRun({
        score: totalScore,
        rawMetric: nextInstalled.length,
        accuracy: acc,
        won: true,
        meta: { mistakes, elapsedSeconds: pg.elapsedSeconds },
      });
    }
  };

  const handleRestart = () => {
    setInstalled([]);
    setSelectedPart('motherboard');
    setDraggingPart(null);
    setMistakes(0);
    setScore(0);
    setFeedback('Drag a hardware part to its matching socket — or tap Part then tap Slot.');
    void pg.restartSession();
  };

  if (pg.result) {
    return (
      <UniversalResultScreen
        title={def.title}
        result={pg.result}
        rankUnavailable={pg.rankUnavailable}
        statusNote={pg.statusNote}
        primaryMetricLabel="Parts Seated"
        primaryMetricValue={`${PARTS.length} / ${PARTS.length}`}
        onPlayAgain={handleRestart}
        onNextChallenge={() => onNextChallenge('drone-landing')}
        nextChallengeLabel="Drone Landing"
        onLeaderboard={() => onOpenLeaderboard('tech-assembly')}
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
      extraHudBadge={`INSTALLED ${installed.length} / ${PARTS.length}`}
    >
      <div className="studio-card-solid border-2 border-[var(--studio-border-strong)] p-4 sm:p-6 space-y-5">
        <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-5">
          {/* Tray of Parts */}
          <div className="studio-well p-4 rounded-2xl space-y-2.5">
            <div className="font-mono-tech text-xs font-bold text-[var(--studio-accent-text)] uppercase">
              HARDWARE TRAY (DRAG OR TAP)
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-1 gap-2">
              {PARTS.map((p) => {
                const done = installed.includes(p.id);
                const active = selectedPart === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    draggable={!done}
                    onDragStart={() => setDraggingPart(p.id)}
                    onDragEnd={() => setDraggingPart(null)}
                    disabled={done}
                    onClick={() => {
                      arcadeAudio.playSfx('click');
                      setSelectedPart(p.id);
                    }}
                    className={`w-full text-left px-3 py-2.5 min-h-[44px] rounded-xl border-2 font-sora text-xs font-bold flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                      done
                        ? 'opacity-40 bg-[var(--studio-surface-2)] border-emerald-500/40 cursor-not-allowed'
                        : active
                        ? 'bg-[#2563EB] border-[#60A5FA] text-white'
                        : 'bg-[var(--studio-surface-2)] border-[var(--studio-border)] text-[var(--studio-text)] hover:border-[var(--studio-accent-text)]'
                    }`}
                  >
                    <span className="truncate">{p.name}</span>
                    {done && <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Workstation Motherboard Chassis Bay */}
          <div className="rounded-2xl bg-[#070E1E] border-2 border-[#1E3A5F] p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between text-xs font-mono-tech text-sky-300">
              <span>WORKSTATION CHASSIS BAY</span>
              <span>Rule: Motherboard -&gt; CPU -&gt; Cooler · Plus RAM/GPU/SSD</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {PARTS.map((slot) => {
                const isDone = installed.includes(slot.id);
                return (
                  <button
                    key={slot.id}
                    type="button"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => {
                      const activeId = draggingPart || selectedPart;
                      if (activeId) tryInstall(activeId, slot.id);
                      setDraggingPart(null);
                    }}
                    onClick={() => {
                      if (selectedPart) tryInstall(selectedPart, slot.id);
                    }}
                    className={`min-h-[82px] p-3.5 rounded-xl border-2 text-left flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                      isDone
                        ? 'bg-emerald-950/60 border-emerald-400 text-white'
                        : 'bg-[#0D182F] border-dashed border-sky-500/45 text-slate-200 hover:border-sky-300'
                    }`}
                  >
                    <div>
                      <div className="font-mono-tech text-[10px] font-bold uppercase text-sky-300">
                        {slot.slotLabel}
                      </div>
                      <div className="font-heading text-sm sm:text-base font-bold mt-0.5">
                        {isDone ? `${slot.name} [LOCKED]` : `Drop ${slot.name}`}
                      </div>
                    </div>
                    <div className="shrink-0">
                      {slot.id === 'cpu' || slot.id === 'motherboard' ? (
                        <Cpu size={22} className={isDone ? 'text-emerald-400' : 'text-sky-400'} />
                      ) : slot.id === 'ssd' ? (
                        <HardDrive size={22} className={isDone ? 'text-emerald-400' : 'text-pink-400'} />
                      ) : slot.id === 'gpu' ? (
                        <Monitor size={22} className={isDone ? 'text-emerald-400' : 'text-amber-400'} />
                      ) : slot.id === 'ram' ? (
                        <Layers size={22} className={isDone ? 'text-emerald-400' : 'text-purple-400'} />
                      ) : (
                        <Zap size={22} className={isDone ? 'text-emerald-400' : 'text-cyan-400'} />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="text-xs font-mono-tech font-bold text-[var(--studio-accent-text)]">
          {feedback}
        </div>
      </div>
    </MiniGameShell>
  );
};

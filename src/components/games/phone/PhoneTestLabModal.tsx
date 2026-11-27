import React, { useMemo, useState } from 'react';
import {
  Activity,
  ArrowLeft,
  BatteryCharging,
  Camera,
  CheckCircle2,
  Cpu,
  Monitor,
  ShieldAlert,
  Thermometer,
  Trophy,
} from 'lucide-react';
import { getMiniGameDef } from '../../../../shared/progression.ts';
import type { GameModeId, PlaygroundResultPayload } from '../../../../shared/types.ts';
import { arcadeAudio } from '../../../audio/arcadeAudio.ts';
import { useArcade } from '../../../context/ArcadeContext.tsx';
import { startPlaygroundSession, submitPlaygroundScore } from '../../../utils/playgroundClient.ts';
import { UniversalResultScreen } from '../shared/UniversalResultScreen.tsx';
import { evaluatePhoneEngineering, type PhoneDesignState } from './phoneCatalog.ts';

interface PhoneTestLabModalProps {
  state: PhoneDesignState;
  onExit: () => void;
  onOpenLeaderboard?: (gameId: GameModeId) => void;
  onGoHome?: () => void;
}

type TestLabModule =
  | 'battery'
  | 'display'
  | 'camera'
  | 'benchmark'
  | 'thermal'
  | 'charge'
  | 'drop'
  | 'budget';

export const PhoneTestLabModal: React.FC<PhoneTestLabModalProps> = ({
  state,
  onExit,
  onOpenLeaderboard,
  onGoHome,
}) => {
  const { player, updateLocalPlayer } = useArcade();
  const telemetry = useMemo(() => evaluatePhoneEngineering(state), [state]);

  const [tab, setTab] = useState<TestLabModule>('battery');

  // Battery Drain Sim controls
  const [brightnessPct, setBrightnessPct] = useState(65);
  const [refresh120, setRefresh120] = useState(state.bays.display === 'disp-amoled-120');
  const [radio5g, setRadio5g] = useState(state.bays.connectivity === 'conn-5g-wifi7');

  // Camera Zoom Sim
  const [zoomLevel, setZoomLevel] = useState<1 | 2 | 5>(1);

  // Playful Drop Test Sim Only
  const [dropSurface, setDropSurface] = useState<'wood' | 'carpet' | 'rubber'>('wood');
  const [dropRunCount, setDropRunCount] = useState(0);
  const [dropBouncing, setDropBouncing] = useState(false);

  // 200-pt Budget Design Challenge
  const [ptsSoc, setPtsSoc] = useState(60);
  const [ptsBattery, setPtsBattery] = useState(50);
  const [ptsCamera, setPtsCamera] = useState(45);
  const [ptsDurability, setPtsDurability] = useState(45);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<PlaygroundResultPayload | null>(null);
  const [rankUnavailable, setRankUnavailable] = useState(false);
  const [statusNote, setStatusNote] = useState<string | null>(null);

  const totalBudgetUsed = ptsSoc + ptsBattery + ptsCamera + ptsDurability;
  const budgetRemaining = 200 - totalBudgetUsed;

  // Battery hours based on sliders
  const simulatedHours = useMemo(() => {
    const base = telemetry.estimatedBatteryHours;
    const brightFactor = 1.25 - (brightnessPct / 100) * 0.45;
    const hzFactor = refresh120 ? 0.91 : 1.04;
    const rfFactor = radio5g ? 0.89 : 1.02;
    return Number((base * brightFactor * hzFactor * rfFactor).toFixed(1));
  }, [telemetry.estimatedBatteryHours, brightnessPct, refresh120, radio5g]);

  // Thermal curve over 10 min stress
  const thermalPoints = useMemo(() => {
    const cap = state.bays.cooling === 'vapor-graphite' ? 0.55 : state.bays.cooling === 'graphite-only' ? 0.82 : 1.15;
    const pts: Array<{ min: number; temp: number }> = [];
    for (let m = 0; m <= 10; m++) {
      const rise = (telemetry.peakJunctionTempC - 32) * (1 - Math.exp(-0.38 * m * cap));
      pts.push({ min: m, temp: Math.round(32 + rise) });
    }
    return pts;
  }, [state.bays.cooling, telemetry.peakJunctionTempC]);

  // Drop bounce sim metrics
  const dropResult = useMemo(() => {
    const surfaceDamp = dropSurface === 'carpet' ? 0.45 : dropSurface === 'rubber' ? 0.62 : 0.92;
    const caseBonus = state.caseStyle === 'rugged' ? 0.65 : state.caseStyle === 'silicone' ? 0.78 : state.caseStyle === 'carbon' ? 0.82 : 1.0;
    const peakG = Math.round(115 * surfaceDamp * caseBonus * (telemetry.weightGrams / 185));
    const impactSurvivalScore = Math.max(40, Math.min(99, Math.round(108 - peakG * 0.42)));
    return { peakG, impactSurvivalScore };
  }, [dropSurface, state.caseStyle, telemetry.weightGrams]);

  const handleSubmitBudgetChallenge = async () => {
    if (budgetRemaining < 0 || submitting) return;
    setSubmitting(true);
    const startTs = performance.now();
    const sess = await startPlaygroundSession('phone-test-lab', player);
    // Compute harmonic engineering score balancing all 4 pillars + live build hardware synergy
    const balanceBonus =
      Math.min(ptsSoc, ptsBattery, ptsCamera, ptsDurability) * 10 +
      Math.round(telemetry.overallEngineeringScore * 7);
    const totalPts = Math.min(2000, Math.round(totalBudgetUsed * 4.5 + balanceBonus));
    const acc = Math.min(100, Math.round((Math.min(ptsSoc, ptsBattery, ptsCamera, ptsDurability) / 50) * 100));

    // Ensure non-instant server duration
    const elapsed = performance.now() - startTs;
    if (elapsed < 1200) {
      await new Promise((r) => setTimeout(r, Math.round(1200 - elapsed)));
    }

    const res = await submitPlaygroundScore({
      session: sess,
      player,
      gameId: 'phone-test-lab',
      score: totalPts,
      rawMetric: telemetry.overallEngineeringScore,
      completionTimeMs: Math.max(1500, Math.round(performance.now() - startTs + 1500)),
      accuracy: acc,
      won: totalPts >= 1000,
      meta: { ptsSoc, ptsBattery, ptsCamera, ptsDurability, deviceName: state.deviceName },
      onUpdatePlayer: updateLocalPlayer,
    });
    setSubmitting(false);
    arcadeAudio.playSfx(res.payload.won ? 'levelUp' : 'correct');
    setResult(res.payload);
    setRankUnavailable(res.rankUnavailable);
    setStatusNote(res.error || null);
  };

  if (result) {
    const def = getMiniGameDef('phone-test-lab');
    return (
      <div className="max-w-4xl mx-auto px-4 py-6">
        <UniversalResultScreen
          title={def?.title || 'Smartphone Test Lab'}
          result={result}
          rankUnavailable={rankUnavailable}
          statusNote={statusNote}
          primaryMetricLabel="Device Engineering Score"
          primaryMetricValue={`${result.rawMetric}/100`}
          onPlayAgain={() => setResult(null)}
          onNextChallenge={onExit}
          nextChallengeLabel="Back to Phone CAD"
          onLeaderboard={() => (onOpenLeaderboard ? onOpenLeaderboard('phone-test-lab') : onExit())}
          onHome={onGoHome || onExit}
        />
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#040914] text-slate-100 p-4 sm:p-6">
      <div className="max-w-5xl mx-auto space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <button
              type="button"
              onClick={onExit}
              className="studio-btn studio-btn-ghost text-xs px-3 py-1.5 min-h-[34px] mb-2"
            >
              <ArrowLeft size={14} />
              <span>Return to 3D Phone Studio</span>
            </button>
            <div className="flex items-center gap-2">
              <h1 className="font-heading font-bold text-2xl sm:text-3xl text-white">
                {state.deviceName} · Test Lab
              </h1>
              <span className="font-mono-tech text-[10px] font-bold px-2.5 py-0.5 rounded bg-amber-500/20 border border-amber-400/50 text-amber-200">
                SIMULATION
              </span>
            </div>
          </div>

          <div className="px-4 py-2 rounded-xl bg-[#09152E] border border-cyan-500/35 font-mono-tech text-xs">
            Score {telemetry.overallEngineeringScore}/100 · {telemetry.weightGrams}g · ${telemetry.totalCostUsd}
          </div>
        </div>

        {/* Module Selector */}
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              { id: 'battery', label: 'Battery Drain', icon: BatteryCharging },
              { id: 'display', label: 'Display Hz/Gamma', icon: Monitor },
              { id: 'camera', label: 'Camera Zoom', icon: Camera },
              { id: 'benchmark', label: 'Processor Bench', icon: Cpu },
              { id: 'thermal', label: 'Thermal Graph', icon: Thermometer },
              { id: 'charge', label: 'Fast Charge', icon: Activity },
              { id: 'drop', label: 'Drop Sim', icon: ShieldAlert },
              { id: 'budget', label: '200-Pt Challenge', icon: Trophy },
            ] as const
          ).map((m) => {
            const Icon = m.icon;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  arcadeAudio.playSfx('click');
                  setTab(m.id);
                }}
                className={`px-3 py-2 rounded-xl text-xs font-sora font-semibold border cursor-pointer flex items-center gap-1.5 ${
                  tab === m.id
                    ? 'bg-cyan-500 text-slate-950 border-cyan-300 font-bold'
                    : 'bg-[#09152E] border-white/10 text-slate-300 hover:border-cyan-400/50'
                }`}
              >
                <Icon size={13} />
                <span>{m.label}</span>
              </button>
            );
          })}
        </div>

        <div className="studio-card-solid border-2 border-[var(--studio-border-strong)] p-5 sm:p-6 space-y-5">
          {tab === 'battery' && (
            <div className="space-y-4">
              <h2 className="font-heading font-bold text-lg text-white">Battery Endurance Load Simulation</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-3 rounded-xl bg-[#070E1F] border border-white/10">
                  <div className="flex justify-between font-mono-tech text-xs mb-1">
                    <span>Screen Brightness</span>
                    <span className="text-cyan-300">{brightnessPct}%</span>
                  </div>
                  <input
                    type="range"
                    min={15}
                    max={100}
                    value={brightnessPct}
                    onChange={(e) => setBrightnessPct(Number(e.target.value))}
                    className="w-full accent-cyan-400"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setRefresh120((v) => !v)}
                  className={`p-3 rounded-xl border text-left cursor-pointer ${
                    refresh120 ? 'bg-cyan-500/20 border-cyan-400' : 'bg-[#070E1F] border-white/10'
                  }`}
                >
                  <div className="font-mono-tech text-[10px] text-slate-400">REFRESH RATE</div>
                  <div className="font-sora font-bold text-sm">{refresh120 ? '120Hz Adaptive' : '60Hz Power Saver'}</div>
                </button>
                <button
                  type="button"
                  onClick={() => setRadio5g((v) => !v)}
                  className={`p-3 rounded-xl border text-left cursor-pointer ${
                    radio5g ? 'bg-purple-500/20 border-purple-400' : 'bg-[#070E1F] border-white/10'
                  }`}
                >
                  <div className="font-mono-tech text-[10px] text-slate-400">CELLULAR MODEM</div>
                  <div className="font-sora font-bold text-sm">{radio5g ? '5G mmWave Active' : 'LTE / Wi-Fi Mode'}</div>
                </button>
              </div>
              <div className="p-4 rounded-xl bg-[#050A18] border border-emerald-500/35 flex items-center justify-between">
                <div>
                  <div className="font-mono-tech text-xs text-emerald-300">SIMULATED SCREEN-ON RUNTIME</div>
                  <div className="text-3xl font-heading font-bold text-white">{simulatedHours} Hours</div>
                </div>
                <div className="text-xs font-mono-tech text-slate-400">Efficiency Score: {telemetry.powerEfficiencyScore}/100</div>
              </div>
            </div>
          )}

          {tab === 'display' && (
            <div className="space-y-4">
              <h2 className="font-heading font-bold text-lg text-white">Display Frequency &amp; Contrast Calibration</h2>
              <p className="text-xs text-slate-300">
                Installed Panel: <strong className="text-cyan-300">{state.bays.display.toUpperCase()}</strong>
              </p>
              <div className="p-4 rounded-xl bg-[#050A18] border border-white/10 space-y-3">
                <div className="flex justify-between text-xs font-mono-tech">
                  <span>Simulated Gamma Response</span>
                  <span className="text-cyan-300">{(1.8 + (brightnessPct / 100) * 0.6).toFixed(2)} γ</span>
                </div>
                <div
                  className="h-10 rounded-lg border border-white/20"
                  style={{
                    background: 'linear-gradient(90deg, #020617 0%, #1E3A8A 35%, #22D3EE 70%, #FFFFFF 100%)',
                    opacity: 0.4 + (brightnessPct / 100) * 0.6,
                  }}
                />
              </div>
            </div>
          )}

          {tab === 'camera' && (
            <div className="space-y-4">
              <h2 className="font-heading font-bold text-lg text-white">Optical Focal Length Simulator</h2>
              <div className="flex gap-2">
                {([1, 2, 5] as const).map((z) => (
                  <button
                    key={z}
                    type="button"
                    onClick={() => setZoomLevel(z)}
                    className={`studio-btn px-4 py-2 text-xs ${zoomLevel === z ? 'studio-btn-primary' : 'studio-btn-ghost'}`}
                  >
                    {z}x Optical
                  </button>
                ))}
              </div>
              <div className="h-44 rounded-2xl bg-[#050A18] border border-cyan-500/35 flex items-center justify-center overflow-hidden">
                <div
                  className="transition-transform duration-300 text-center"
                  style={{ transform: `scale(${zoomLevel === 1 ? 1 : zoomLevel === 2 ? 1.55 : 2.35})` }}
                >
                  <div className="w-16 h-16 rounded-2xl mx-auto border-2 border-cyan-400 bg-cyan-500/15 flex items-center justify-center font-mono-tech text-xs font-bold text-cyan-200">
                    {zoomLevel}x
                  </div>
                  <div className="font-mono-tech text-[10px] text-slate-400 mt-1">
                    {state.bays.camera === 'cam-pro-ois' ? '5x Periscope + OIS Sharp' : state.bays.camera === 'cam-dual-ois' ? 'Digital Crop Above 2x' : 'Single Sensor Digital Crop'}
                  </div>
                </div>
              </div>
            </div>
          )}

          {tab === 'benchmark' && (
            <div className="space-y-4">
              <h2 className="font-heading font-bold text-lg text-white">Synthetic Processor &amp; Memory Benchmark</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono-tech">
                <div className="p-4 rounded-xl bg-[#070E1F] border border-white/10">
                  <div className="text-[10px] text-slate-400">SINGLE-CORE SIM</div>
                  <div className="text-2xl font-bold text-cyan-300">{telemetry.performanceScore * 32}</div>
                </div>
                <div className="p-4 rounded-xl bg-[#070E1F] border border-white/10">
                  <div className="text-[10px] text-slate-400">MULTI-CORE SIM</div>
                  <div className="text-2xl font-bold text-purple-300">{telemetry.performanceScore * 108}</div>
                </div>
                <div className="p-4 rounded-xl bg-[#070E1F] border border-white/10">
                  <div className="text-[10px] text-slate-400">NAND SEQ READ</div>
                  <div className="text-2xl font-bold text-emerald-300">
                    {state.bays.memory === 'ram-lpddr5x-storage' ? '4,200 MB/s' : '2,100 MB/s'}
                  </div>
                </div>
              </div>
            </div>
          )}

          {tab === 'thermal' && (
            <div className="space-y-4">
              <h2 className="font-heading font-bold text-lg text-white">10-Minute Sustained Thermal Load Curve</h2>
              <svg viewBox="0 0 560 150" className="w-full h-40 rounded-xl bg-[#050A18] border border-white/10">
                <polyline
                  fill="none"
                  stroke="#F59E0B"
                  strokeWidth="3.5"
                  points={thermalPoints
                    .map((p) => {
                      const x = 30 + (p.min / 10) * 500;
                      const y = 135 - Math.min(115, ((p.temp - 25) / 75) * 115);
                      return `${x},${y}`;
                    })
                    .join(' ')}
                />
                <text x="30" y="20" fill="#FDE68A" fontSize="11" fontFamily="monospace">
                  Peak Junction Temperature: {telemetry.peakJunctionTempC}°C ({state.bays.cooling})
                </text>
              </svg>
            </div>
          )}

          {tab === 'charge' && (
            <div className="space-y-4">
              <h2 className="font-heading font-bold text-lg text-white">0–100% Fast Charge Curve (SIMULATION)</h2>
              <div className="p-4 rounded-xl bg-[#070E1F] border border-white/10 space-y-2 font-mono-tech text-xs">
                <div className="flex justify-between">
                  <span>Hardware Spec:</span>
                  <span className="text-cyan-300">
                    {state.bays.charging === 'chg-65w-qi2' ? '65W GaN Charge Pump + Qi2' : '30W Wired USB-C'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Estimated 0 → 80% Time:</span>
                  <span className="text-emerald-300">
                    {state.bays.charging === 'chg-65w-qi2' ? '24 min (Sim)' : '46 min (Sim)'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {tab === 'drop' && (
            <div className="space-y-4">
              <div className="p-3 rounded-xl bg-amber-950/70 border border-amber-400 text-amber-100 text-xs font-mono-tech font-bold">
                GAME SIMULATION — NOT A REAL DROP-TEST RESULT. Playful comparative surface test only.
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {(['wood', 'carpet', 'rubber'] as const).map((surf) => (
                  <button
                    key={surf}
                    type="button"
                    onClick={() => {
                      setDropSurface(surf);
                      setDropBouncing(true);
                      setDropRunCount((c) => c + 1);
                      arcadeAudio.playSfx('bounce');
                      window.setTimeout(() => setDropBouncing(false), 600);
                    }}
                    className={`studio-btn px-4 py-2 text-xs uppercase ${
                      dropSurface === surf ? 'studio-btn-primary' : 'studio-btn-ghost'
                    }`}
                  >
                    DROP ON {surf}
                  </button>
                ))}
              </div>
              <div className="p-4 rounded-xl bg-[#050A18] border border-white/10 flex items-center justify-between">
                <div className="space-y-1 font-mono-tech">
                  <div className="text-xs text-slate-400">
                    Surface: {dropSurface.toUpperCase()} · Case: {(state.caseStyle || 'none').toUpperCase()} · Drops Run: {dropRunCount}
                  </div>
                  <div className="text-2xl font-bold text-cyan-300">
                    Sim Impact Attenuation: {dropResult.impactSurvivalScore}/100 ({dropResult.peakG}G Sim)
                  </div>
                </div>
                <div
                  className={`w-10 h-16 rounded-lg border-2 border-cyan-400 bg-slate-800 transition-transform duration-300 ${
                    dropBouncing ? 'translate-y-4 scale-y-90' : '-translate-y-2'
                  }`}
                />
              </div>
            </div>
          )}

          {tab === 'budget' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="font-heading font-bold text-lg text-white">200-Point Budget Engineering Challenge</h2>
                  <p className="text-xs text-slate-300">
                    Allocate 200 engineering resource points across 4 subsystems and submit your verified device score!
                  </p>
                </div>
                <div
                  className={`font-mono-tech text-sm font-bold px-3 py-1.5 rounded-xl border ${
                    budgetRemaining < 0
                      ? 'bg-rose-950 border-rose-400 text-rose-200'
                      : 'bg-emerald-950 border-emerald-400 text-emerald-200'
                  }`}
                >
                  Budget Left: {budgetRemaining} / 200 pts
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { label: 'Processor Speed Budget', val: ptsSoc, set: setPtsSoc },
                  { label: 'Battery Capacity Budget', val: ptsBattery, set: setPtsBattery },
                  { label: 'Camera Optics Budget', val: ptsCamera, set: setPtsCamera },
                  { label: 'Structural Durability Budget', val: ptsDurability, set: setPtsDurability },
                ].map((item) => (
                  <div key={item.label} className="p-3 rounded-xl bg-[#070E1F] border border-white/10 space-y-1">
                    <div className="flex justify-between text-xs font-mono-tech">
                      <span>{item.label}</span>
                      <span className="text-cyan-300 font-bold">{item.val} pts</span>
                    </div>
                    <input
                      type="range"
                      min={10}
                      max={90}
                      step={5}
                      value={item.val}
                      onChange={(e) => item.set(Number(e.target.value))}
                      className="w-full accent-cyan-400"
                    />
                  </div>
                ))}
              </div>

              <button
                type="button"
                disabled={budgetRemaining < 0 || submitting}
                onClick={() => void handleSubmitBudgetChallenge()}
                className="studio-btn studio-btn-primary px-6 py-3 text-sm"
              >
                <CheckCircle2 size={16} />
                <span>{submitting ? 'Submitting to Leaderboard...' : 'Run Benchmark & Submit Verified Score'}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

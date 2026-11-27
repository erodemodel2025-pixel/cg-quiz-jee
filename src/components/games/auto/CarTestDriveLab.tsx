import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Camera,
  Flag,
  Flame,
  Gauge,
  RotateCcw,
  Trophy,
} from 'lucide-react';
import * as THREE from 'three';
import { getMiniGameDef } from '../../../../shared/progression.ts';
import type { GameModeId, PlaygroundResultPayload } from '../../../../shared/types.ts';
import { arcadeAudio } from '../../../audio/arcadeAudio.ts';
import { useArcade } from '../../../context/ArcadeContext.tsx';
import { startPlaygroundSession, submitPlaygroundScore, type PlaygroundSessionInfo } from '../../../utils/playgroundClient.ts';
import { UniversalResultScreen } from '../shared/UniversalResultScreen.tsx';
import { buildVehicleGroup } from './carBuilder3d.ts';
import { createInitialBuild, evaluateCarTelemetry, type CarBuildConfig } from './carCatalog.ts';
import { buildTestTrackScene } from './carTrack3d.ts';

export type TrackLabMode =
  | 'free'
  | '0-100'
  | 'top-speed'
  | 'braking'
  | 'cornering'
  | 'slalom'
  | 'drag'
  | 'dyno';

interface CarTestDriveLabProps {
  config: CarBuildConfig;
  carName: string;
  initialMode?: TrackLabMode;
  onExit: () => void;
  onOpenLeaderboard?: (gameId: GameModeId) => void;
  onGoHome?: () => void;
}

const MODE_TABS: Array<{ id: TrackLabMode; label: string; gameId?: GameModeId }> = [
  { id: 'free', label: 'Free Track' },
  { id: '0-100', label: '0–100 km/h', gameId: 'car-test-0-100' },
  { id: 'top-speed', label: 'Top Speed', gameId: 'car-test-topspeed' },
  { id: 'braking', label: '100–0 Braking', gameId: 'car-test-braking' },
  { id: 'slalom', label: 'Cone Slalom', gameId: 'car-test-slalom' },
  { id: 'cornering', label: 'Cornering Grip' },
  { id: 'drag', label: 'Drag vs AI', gameId: 'car-test-drag' },
  { id: 'dyno', label: 'Dyno Curve' },
];

export const CarTestDriveLab: React.FC<CarTestDriveLabProps> = ({
  config,
  carName,
  initialMode = '0-100',
  onExit,
  onOpenLeaderboard,
  onGoHome,
}) => {
  const { player, graphicsQuality, updateLocalPlayer } = useArcade();
  const telemetry = useMemo(() => evaluateCarTelemetry(config), [config]);

  const [mode, setMode] = useState<TrackLabMode>(initialMode);
  const [aiDifficulty, setAiDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [camView, setCamView] = useState<'chase' | 'hood' | 'orbit'>('chase');

  const [speedKmh, setSpeedKmh] = useState(0);
  const [rpm, setRpm] = useState(900);
  const [gear, setGear] = useState(1);
  const [distanceM, setDistanceM] = useState(0);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [statusBanner, setStatusBanner] = useState('Hold GAS / W / ↑ to launch on track!');
  const [brakeChartData, setBrakeChartData] = useState<Array<{ t: number; speed: number }>>([]);
  const [dynoRpmSweep, setDynoRpmSweep] = useState(900);
  const [dynoRunning, setDynoRunning] = useState(false);

  const [session, setSession] = useState<PlaygroundSessionInfo | null>(null);
  const [runResult, setRunResult] = useState<PlaygroundResultPayload | null>(null);
  const [rankUnavailable, setRankUnavailable] = useState(false);
  const [statusNote, setStatusNote] = useState<string | null>(null);

  const mountRef = useRef<HTMLDivElement>(null);
  const keysRef = useRef({ gas: false, brake: false, left: false, right: false });
  const simRef = useRef({
    x: 0,
    z: 0,
    vx: 0,
    vz: 0,
    heading: 0,
    steerAngle: 0,
    speedMs: 0,
    aiZ: 0,
    aiSpeedMs: 0,
    elapsed: 0,
    startedRun: false,
    brakingTriggered: false,
    brakeStartZ: 0,
    lastSampleT: 0,
    finished: false,
    conesCleared: 0,
    conesHit: 0,
    cornerScore: 0,
    passedCones: new Set<number>(),
    brakeLog: [] as Array<{ t: number; speed: number }>,
  });
  const camViewRef = useRef(camView);
  camViewRef.current = camView;
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const aiDiffRef = useRef(aiDifficulty);
  aiDiffRef.current = aiDifficulty;

  const activeGameId: GameModeId =
    MODE_TABS.find((t) => t.id === mode)?.gameId || 'car-test-0-100';

  const startSessionForMode = useCallback(
    async (targetMode: TrackLabMode) => {
      const gid = MODE_TABS.find((t) => t.id === targetMode)?.gameId;
      setRunResult(null);
      setRankUnavailable(false);
      setStatusNote(null);
      if (!gid) {
        setSession(null);
        return;
      }
      const s = await startPlaygroundSession(gid, player);
      setSession(s);
    },
    [player]
  );

  const resetTrackRun = useCallback(
    (nextMode?: TrackLabMode) => {
      const m = nextMode || modeRef.current;
      simRef.current = {
        x: m === 'drag' ? -3.4 : 0,
        z: 0,
        vx: 0,
        vz: 0,
        heading: 0,
        steerAngle: 0,
        speedMs: 0,
        aiZ: 0,
        aiSpeedMs: 0,
        elapsed: 0,
        startedRun: false,
        brakingTriggered: false,
        brakeStartZ: 0,
        lastSampleT: 0,
        finished: false,
        conesCleared: 0,
        conesHit: 0,
        cornerScore: 0,
        passedCones: new Set<number>(),
        brakeLog: [],
      };
      setSpeedKmh(0);
      setRpm(900);
      setGear(1);
      setDistanceM(0);
      setElapsedSec(0);
      setBrakeChartData([]);
      setStatusBanner(
        m === 'braking'
          ? 'Accelerate past 100 km/h, then SLAM BRAKE (S / ↓ / Space)!'
          : m === 'slalom'
            ? 'Weave cleanly between the orange cones to 320m!'
            : m === 'drag'
              ? `Launch at full throttle for the 402m quarter-mile vs ${aiDiffRef.current.toUpperCase()} AI!`
              : 'Hold GAS (W / ↑) to accelerate down the proving grounds!'
      );
      void startSessionForMode(m);
    },
    [startSessionForMode]
  );

  useEffect(() => {
    resetTrackRun(mode);
  }, [mode, resetTrackRun]);

  // Dyno Sweep Timer
  useEffect(() => {
    if (mode !== 'dyno' || !dynoRunning) return;
    let raf = 0;
    let curRpm = 1200;
    const step = () => {
      curRpm += 65;
      if (curRpm >= config.redlineRpm) {
        setDynoRpmSweep(config.redlineRpm);
        setDynoRunning(false);
        arcadeAudio.playSfx('wow');
        return;
      }
      setDynoRpmSweep(curRpm);
      raf = window.requestAnimationFrame(step);
    };
    raf = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(raf);
  }, [mode, dynoRunning, config.redlineRpm]);

  // Keyboard handlers
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT') return;
      const k = e.key.toLowerCase();
      if (k === 'w' || e.key === 'ArrowUp') {
        e.preventDefault();
        keysRef.current.gas = true;
      } else if (k === 's' || e.key === 'ArrowDown' || e.code === 'Space') {
        e.preventDefault();
        keysRef.current.brake = true;
      } else if (k === 'a' || e.key === 'ArrowLeft') {
        e.preventDefault();
        keysRef.current.left = true;
      } else if (k === 'd' || e.key === 'ArrowRight') {
        e.preventDefault();
        keysRef.current.right = true;
      } else if (k === 'c') {
        setCamView((prev) => (prev === 'chase' ? 'hood' : prev === 'hood' ? 'orbit' : 'chase'));
      } else if (k === 'r') {
        resetTrackRun();
      }
    };
    const up = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === 'w' || e.key === 'ArrowUp') keysRef.current.gas = false;
      else if (k === 's' || e.key === 'ArrowDown' || e.code === 'Space') keysRef.current.brake = false;
      else if (k === 'a' || e.key === 'ArrowLeft') keysRef.current.left = false;
      else if (k === 'd' || e.key === 'ArrowRight') keysRef.current.right = false;
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [resetTrackRun]);

  const finishTrackMode = useCallback(
    async (payload: { gameId: GameModeId; score: number; rawMetric: number; accuracy: number; won: boolean; meta: Record<string, unknown> }) => {
      arcadeAudio.playSfx(payload.won ? 'levelUp' : 'wrong');
      const res = await submitPlaygroundScore({
        session,
        player,
        gameId: payload.gameId,
        score: payload.score,
        rawMetric: payload.rawMetric,
        completionTimeMs: Math.max(1200, Math.round(simRef.current.elapsed * 1000)),
        accuracy: payload.accuracy,
        won: payload.won,
        meta: payload.meta,
        onUpdatePlayer: updateLocalPlayer,
      });
      setRunResult(res.payload);
      setRankUnavailable(res.rankUnavailable);
      setStatusNote(res.error || null);
    },
    [player, session, updateLocalPlayer]
  );

  const finishRef = useRef(finishTrackMode);
  finishRef.current = finishTrackMode;

  // 3D Track WebGL Scene
  useEffect(() => {
    if (mode === 'dyno') return;
    const container = mountRef.current;
    if (!container) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: graphicsQuality !== 'low',
        powerPreference: 'high-performance',
      });
    } catch {
      return;
    }

    const dpr = graphicsQuality === 'low' ? 1 : graphicsQuality === 'medium' ? Math.min(1.5, window.devicePixelRatio || 1) : Math.min(2, window.devicePixelRatio || 1);
    renderer.setPixelRatio(dpr);
    renderer.setSize(container.clientWidth || 800, container.clientHeight || 420);
    renderer.shadowMap.enabled = graphicsQuality !== 'low';
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#050A18');
    scene.fog = new THREE.Fog('#050A18', 45, 220);

    const camera = new THREE.PerspectiveCamera(
      52,
      (container.clientWidth || 800) / (container.clientHeight || 420),
      0.1,
      400
    );

    const hemi = new THREE.HemisphereLight('#E0F2FE', '#0F172A', 1.25);
    const sun = new THREE.DirectionalLight('#FFFFFF', 2.0);
    sun.position.set(16, 28, 12);
    scene.add(hemi, sun);

    const track = buildTestTrackScene(mode);
    scene.add(track.root);

    const playerCar = buildVehicleGroup({ ...config, viewMode: 'exterior', engineBayOpen: false });
    scene.add(playerCar);

    let aiCar: THREE.Group | null = null;
    if (mode === 'drag') {
      const rivalBuild = createInitialBuild('supercar');
      rivalBuild.bodyColor = '#EF4444';
      aiCar = buildVehicleGroup(rivalBuild);
      aiCar.position.set(track.aiLaneX, 0, 0);
      scene.add(aiCar);
    }

    const onResize = () => {
      if (!container) return;
      const w = container.clientWidth || 800;
      const h = container.clientHeight || 420;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(container);

    let raf = 0;
    let lastTs = performance.now();
    let hudTick = 0;

    // Physics integration tied directly to player's CarTelemetryResult
    const maxSpeedMs = telemetry.topSpeedKmh / 3.6;
    const avgAccelMs2 = (100 / 3.6) / telemetry.accel0to100Sec;
    const brakeDecelMs2 = Math.pow(100 / 3.6, 2) / (2 * telemetry.braking100to0M);
    const steerLimit = Math.min(2.6, 1.35 * telemetry.lateralGripG);

    const tick = (now: number) => {
      const dt = Math.min(0.05, Math.max(0.004, (now - lastTs) / 1000));
      lastTs = now;

      const s = simRef.current;
      const curMode = modeRef.current;
      const ctrl = keysRef.current;

      if (!s.finished) {
        if (ctrl.gas || ctrl.brake || s.speedMs > 0.2) {
          s.startedRun = true;
          s.elapsed += dt;
        }

        // Longitudinal dynamics
        if (ctrl.gas && !(curMode === 'braking' && s.brakingTriggered)) {
          const dragLoss = Math.pow(s.speedMs / Math.max(20, maxSpeedMs), 2) * avgAccelMs2;
          s.speedMs = Math.min(maxSpeedMs, s.speedMs + Math.max(0.4, avgAccelMs2 - dragLoss) * dt);
        } else if (ctrl.brake) {
          if (curMode === 'braking' && s.speedMs * 3.6 >= 96 && !s.brakingTriggered) {
            s.brakingTriggered = true;
            s.brakeStartZ = s.z;
            s.brakeLog = [{ t: 0, speed: Math.round(s.speedMs * 3.6) }];
            s.lastSampleT = s.elapsed;
            setStatusBanner('BRAKING ACTIVE — Measuring 100–0 stopping distance!');
            arcadeAudio.playSfx('brake');
          }
          s.speedMs = Math.max(0, s.speedMs - brakeDecelMs2 * dt);
        } else {
          s.speedMs = Math.max(0, s.speedMs - (1.8 + s.speedMs * 0.04) * dt);
        }

        // Steering
        const turnInput = (ctrl.left ? 1 : 0) - (ctrl.right ? 1 : 0);
        const speedTurnFactor = Math.min(1, s.speedMs / 8) * steerLimit;
        s.heading += turnInput * speedTurnFactor * dt * 0.95;
        s.heading *= 0.96;

        s.x = Math.max(-9.5, Math.min(9.5, s.x + Math.sin(s.heading) * s.speedMs * dt));
        s.z += Math.cos(s.heading) * s.speedMs * dt;

        // Braking test telemetry capture
        if (curMode === 'braking' && s.brakingTriggered) {
          if (s.elapsed - s.lastSampleT >= 0.15) {
            s.lastSampleT = s.elapsed;
            s.brakeLog.push({
              t: Number((s.brakeLog.length * 0.15).toFixed(2)),
              speed: Math.round(s.speedMs * 3.6),
            });
          }
          if (s.speedMs <= 0.25) {
            s.finished = true;
            const stopDist = Math.max(20, Number((s.z - s.brakeStartZ).toFixed(1)));
            setBrakeChartData([
              ...s.brakeLog,
              { t: Number((s.brakeLog.length * 0.15).toFixed(2)), speed: 0 },
            ]);
            const pts = Math.max(250, Math.round(1600 - stopDist * 22));
            void finishRef.current({
              gameId: 'car-test-braking',
              score: pts,
              rawMetric: stopDist,
              accuracy: telemetry.braking100to0M <= 34 ? 98 : 85,
              won: stopDist <= 42,
              meta: { stopDistanceM: stopDist, carName },
            });
          }
        }

        // 0-100 km/h test
        if (curMode === '0-100' && s.speedMs * 3.6 >= 100) {
          s.finished = true;
          const runT = Number(s.elapsed.toFixed(2));
          const pts = Math.max(300, Math.round(1600 - runT * 110));
          void finishRef.current({
            gameId: 'car-test-0-100',
            score: pts,
            rawMetric: runT,
            accuracy: 96,
            won: true,
            meta: { accelSec: runT, hp: telemetry.horsepower, carName },
          });
        }

        // Top speed test (500m marker or speed peak near theoretical top speed)
        if (curMode === 'top-speed' && (s.z >= 500 || s.speedMs * 3.6 >= telemetry.topSpeedKmh - 4)) {
          s.finished = true;
          const peakKmh = Math.round(s.speedMs * 3.6);
          const pts = Math.min(2000, Math.round(peakKmh * 5.2));
          void finishRef.current({
            gameId: 'car-test-topspeed',
            score: pts,
            rawMetric: peakKmh,
            accuracy: 95,
            won: true,
            meta: { topSpeedKmh: peakKmh, cd: telemetry.dragCoefficient },
          });
        }

        // Slalom cones check
        if (curMode === 'slalom') {
          for (let i = 0; i < track.cones.length; i++) {
            const c = track.cones[i];
            const d = Math.hypot(s.x - c.x, s.z - c.z);
            if (!c.hit && d < 1.35) {
              c.hit = true;
              c.mesh.rotation.x = 1.25;
              s.conesHit += 1;
              arcadeAudio.playSfx('wrong');
            }
            if (s.z > c.z + 2 && !s.passedCones.has(i)) {
              s.passedCones.add(i);
              if (!c.hit) {
                s.conesCleared += 1;
                arcadeAudio.playSfx('snap');
              }
            }
          }
          if (s.z >= 320) {
            s.finished = true;
            const acc = Math.round((s.conesCleared / track.cones.length) * 100);
            const pts = Math.max(200, s.conesCleared * 160 - Math.round(s.elapsed * 12));
            void finishRef.current({
              gameId: 'car-test-slalom',
              score: pts,
              rawMetric: Number(s.elapsed.toFixed(2)),
              accuracy: acc,
              won: s.conesCleared >= 6,
              meta: { conesCleared: s.conesCleared, conesHit: s.conesHit },
            });
          }
        }

        // Cornering line feedback
        if (curMode === 'cornering') {
          const idealX = Math.sin(s.z * 0.024) * 5.2;
          if (Math.abs(s.x - idealX) < 2.2 && s.speedMs > 10) {
            s.cornerScore += dt * 40;
          }
          if (s.z >= 500) {
            setStatusBanner(
              `Cornering Line Complete! Lateral Grip ${telemetry.lateralGripG}g · Stability ${Math.min(99, Math.round(s.cornerScore))}`
            );
          }
        }

        // Drag race AI opponent
        if (curMode === 'drag' && aiCar) {
          if (s.startedRun) {
            const aiTargetMax = aiDiffRef.current === 'hard' ? 88 : aiDiffRef.current === 'medium' ? 76 : 64;
            const aiAccel = aiDiffRef.current === 'hard' ? 11.2 : aiDiffRef.current === 'medium' ? 9.2 : 7.4;
            s.aiSpeedMs = Math.min(aiTargetMax, s.aiSpeedMs + aiAccel * dt);
            s.aiZ += s.aiSpeedMs * dt;
            aiCar.position.set(track.aiLaneX, 0, s.aiZ);
          }
          if (s.z >= track.finishGateZ || s.aiZ >= track.finishGateZ) {
            s.finished = true;
            const playerWon = s.z >= s.aiZ;
            const et = Number(s.elapsed.toFixed(2));
            const pts = playerWon
              ? Math.max(500, Math.round(1800 - et * 55))
              : Math.max(250, Math.round(900 - et * 25));
            void finishRef.current({
              gameId: 'car-test-drag',
              score: pts,
              rawMetric: et,
              accuracy: playerWon ? 100 : 72,
              won: playerWon,
              meta: { dragTimeSec: et, aiDifficulty: aiDiffRef.current, playerWon },
            });
          }
        }

        // Loop back gracefully on free mode
        if (s.z >= 900 && (curMode === 'free' || curMode === 'cornering')) {
          s.z = 0;
        }
      }

      playerCar.position.set(s.x, 0, s.z);
      playerCar.rotation.y = s.heading;

      // Camera modes
      const cv = camViewRef.current;
      if (cv === 'chase') {
        camera.position.lerp(
          new THREE.Vector3(s.x - Math.sin(s.heading) * 6.5, 2.35, s.z - Math.cos(s.heading) * 6.5),
          0.14
        );
        camera.lookAt(s.x, 0.75, s.z + 6);
      } else if (cv === 'hood') {
        camera.position.set(s.x, 1.18, s.z + 0.55);
        camera.lookAt(s.x + Math.sin(s.heading) * 14, 0.95, s.z + Math.cos(s.heading) * 14);
      } else {
        camera.position.set(s.x + 7.5, 4.4, s.z - 5.5);
        camera.lookAt(s.x, 0.5, s.z + 1.5);
      }

      renderer.render(scene, camera);

      hudTick += 1;
      if (hudTick % 4 === 0) {
        const kmh = Math.round(s.speedMs * 3.6);
        const speedRatio = kmh / Math.max(180, telemetry.topSpeedKmh);
        const g = Math.min(6, Math.max(1, Math.floor(speedRatio * 6) + 1));
        const gearBand = (speedRatio * 6) % 1;
        const calcRpm = Math.round(950 + gearBand * (config.redlineRpm - 1800) + (kmh > 10 ? 900 : 0));
        setSpeedKmh(kmh);
        setGear(g);
        setRpm(Math.min(config.redlineRpm, calcRpm));
        setDistanceM(Math.round(s.z));
        setElapsedSec(Number(s.elapsed.toFixed(1)));
      }

      raf = window.requestAnimationFrame(tick);
    };
    raf = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(raf);
      ro.disconnect();
      track.dispose();
      renderer.dispose();
    };
  }, [mode, config, graphicsQuality, telemetry, carName]);

  // Dyno Curve Points (calculated from engine/turbo stats)
  const dynoPoints = useMemo(() => {
    const pts: Array<{ rpm: number; hp: number; tq: number }> = [];
    for (let r = 1500; r <= config.redlineRpm; r += 500) {
      const n = (r - 1500) / Math.max(1000, config.redlineRpm - 1500);
      const tqRatio = 0.58 + 0.42 * Math.sin(Math.min(1, n * 1.15) * Math.PI * 0.85);
      const tq = Math.round(telemetry.torqueNm * tqRatio);
      const hp = Math.round((tq * r) / 7127);
      pts.push({ rpm: r, hp: Math.min(telemetry.horsepower, hp), tq });
    }
    return pts;
  }, [config.redlineRpm, telemetry.horsepower, telemetry.torqueNm]);

  if (runResult) {
    const def = getMiniGameDef(activeGameId);
    const metricLabel =
      mode === '0-100'
        ? '0–100 km/h Time'
        : mode === 'top-speed'
          ? 'Peak Speed'
          : mode === 'braking'
            ? '100–0 Stop Distance'
            : mode === 'drag'
              ? '1/4 Mile ET'
              : 'Course Time';
    const metricVal =
      mode === 'top-speed'
        ? `${Math.round(runResult.rawMetric)} km/h`
        : mode === 'braking'
          ? `${runResult.rawMetric.toFixed(1)} m`
          : `${runResult.rawMetric.toFixed(2)} s`;

    return (
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-4">
        <UniversalResultScreen
          title={def?.title || `Track Lab: ${mode.toUpperCase()}`}
          result={runResult}
          rankUnavailable={rankUnavailable}
          statusNote={statusNote}
          primaryMetricLabel={metricLabel}
          primaryMetricValue={metricVal}
          onPlayAgain={() => resetTrackRun(mode)}
          onNextChallenge={() => {
            const next: TrackLabMode =
              mode === '0-100' ? 'top-speed' : mode === 'top-speed' ? 'braking' : mode === 'braking' ? 'slalom' : 'drag';
            setMode(next);
          }}
          nextChallengeLabel="Next Track Test"
          onLeaderboard={() => (onOpenLeaderboard ? onOpenLeaderboard(activeGameId) : onExit())}
          onHome={onGoHome || onExit}
        />

        {brakeChartData.length > 1 && (
          <div className="studio-card-solid p-5 border border-cyan-500/35 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-heading font-bold text-sm text-cyan-300">
                100–0 Braking Deceleration Curve
              </h3>
              <span className="font-mono-tech text-[10px] px-2 py-0.5 rounded bg-cyan-500/15 text-cyan-200 border border-cyan-400/35">
                SIMULATION
              </span>
            </div>
            <svg viewBox="0 0 420 110" className="w-full h-28 bg-[#050A18] rounded-xl border border-white/10">
              <polyline
                fill="none"
                stroke="#22D3EE"
                strokeWidth="3"
                points={brakeChartData
                  .map((pt, i) => {
                    const x = 16 + (i / Math.max(1, brakeChartData.length - 1)) * 388;
                    const y = 96 - (Math.min(120, pt.speed) / 120) * 80;
                    return `${x},${y}`;
                  })
                  .join(' ')}
              />
            </svg>
          </div>
        )}
      </div>
    );
  }

  const modeLabel = MODE_TABS.find((t) => t.id === mode)?.label || 'Track Lab';

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#040914] text-slate-100 flex flex-col">
      {/* Track Top Bar */}
      <div className="border-b border-cyan-500/25 bg-[#070E20] px-4 py-2.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onExit}
            className="studio-btn studio-btn-ghost text-xs px-3 py-1.5 min-h-[36px]"
          >
            <ArrowLeft size={14} />
            <span>Back to Car CAD</span>
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-heading font-bold text-sm sm:text-base text-white">{carName}</span>
              <span className="font-mono-tech text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/20 border border-amber-400/50 text-amber-200">
                SIMULATION
              </span>
            </div>
            <div className="font-mono-tech text-[10px] text-cyan-300">
              {telemetry.horsepower} HP · {telemetry.effectiveWeightKg} kg · {telemetry.accel0to100Sec}s 0-100 · {telemetry.braking100to0M}m stop
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {mode === 'drag' && (
            <select
              value={aiDifficulty}
              onChange={(e) => {
                setAiDifficulty(e.target.value as 'easy' | 'medium' | 'hard');
                resetTrackRun('drag');
              }}
              className="studio-input text-xs px-2 py-1 bg-[#0B152C]"
            >
              <option value="easy">AI Rival: Easy</option>
              <option value="medium">AI Rival: Medium</option>
              <option value="hard">AI Rival: Hard</option>
            </select>
          )}
          <button
            type="button"
            onClick={() =>
              setCamView((prev) => (prev === 'chase' ? 'hood' : prev === 'hood' ? 'orbit' : 'chase'))
            }
            className="studio-btn studio-btn-ghost text-xs px-2.5 py-1.5 min-h-[34px]"
          >
            <Camera size={13} />
            <span>Cam: {camView.toUpperCase()} (C)</span>
          </button>
          <button
            type="button"
            onClick={() => resetTrackRun()}
            className="studio-btn studio-btn-ghost text-xs px-2.5 py-1.5 min-h-[34px]"
          >
            <RotateCcw size={13} />
            <span>Reset (R)</span>
          </button>
        </div>
      </div>

      {/* Mode Switcher Tabs */}
      <div className="bg-[#060C1C] border-b border-white/10 px-4 py-2 flex flex-wrap gap-1.5">
        {MODE_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              arcadeAudio.playSfx('click');
              setMode(t.id);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-sora font-semibold border cursor-pointer flex items-center gap-1.5 ${
              mode === t.id
                ? 'bg-cyan-500 text-slate-950 border-cyan-300 font-bold'
                : 'bg-[#0C1730] border-white/10 text-slate-300 hover:border-cyan-400/50'
            }`}
          >
            {t.gameId && <Trophy size={11} />}
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {mode === 'dyno' ? (
        <div className="max-w-4xl mx-auto w-full p-5 space-y-5">
          <div className="studio-card-solid p-5 border-2 border-cyan-500/35 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="font-mono-tech text-[10px] uppercase text-cyan-300">
                  ANIMATED CHASSIS DYNAMOMETER · SIMULATION
                </div>
                <h2 className="font-heading font-bold text-xl text-white">
                  Horsepower &amp; Torque vs RPM Sweep
                </h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  arcadeAudio.playSfx('engineRev');
                  setDynoRpmSweep(1200);
                  setDynoRunning(true);
                }}
                className="studio-btn studio-btn-primary px-5 py-2.5 text-sm"
              >
                <Flame size={16} />
                <span>{dynoRunning ? `PULLING ${dynoRpmSweep} RPM...` : 'START DYNO PULL'}</span>
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3 font-mono-tech">
              <div className="p-3 rounded-xl bg-[#070E1F] border border-white/10">
                <div className="text-[10px] text-slate-400">LIVE RPM</div>
                <div className="text-xl font-bold text-amber-300">{dynoRpmSweep}</div>
              </div>
              <div className="p-3 rounded-xl bg-[#070E1F] border border-white/10">
                <div className="text-[10px] text-slate-400">PEAK POWER</div>
                <div className="text-xl font-bold text-cyan-300">{telemetry.horsepower} HP</div>
              </div>
              <div className="p-3 rounded-xl bg-[#070E1F] border border-white/10">
                <div className="text-[10px] text-slate-400">PEAK TORQUE</div>
                <div className="text-xl font-bold text-emerald-300">{telemetry.torqueNm} Nm</div>
              </div>
            </div>

            <svg viewBox="0 0 600 220" className="w-full h-56 rounded-xl bg-[#050A18] border border-white/10">
              {/* HP Curve */}
              <polyline
                fill="none"
                stroke="#22D3EE"
                strokeWidth="3.5"
                points={dynoPoints
                  .filter((p) => p.rpm <= dynoRpmSweep + 500)
                  .map((p) => {
                    const x = 35 + ((p.rpm - 1500) / Math.max(1000, config.redlineRpm - 1500)) * 535;
                    const y = 195 - (p.hp / Math.max(telemetry.horsepower, telemetry.torqueNm, 250)) * 165;
                    return `${x},${y}`;
                  })
                  .join(' ')}
              />
              {/* Torque Curve */}
              <polyline
                fill="none"
                stroke="#10B981"
                strokeWidth="3"
                strokeDasharray="6 4"
                points={dynoPoints
                  .filter((p) => p.rpm <= dynoRpmSweep + 500)
                  .map((p) => {
                    const x = 35 + ((p.rpm - 1500) / Math.max(1000, config.redlineRpm - 1500)) * 535;
                    const y = 195 - (p.tq / Math.max(telemetry.horsepower, telemetry.torqueNm, 250)) * 165;
                    return `${x},${y}`;
                  })
                  .join(' ')}
              />
              <text x="40" y="22" fill="#22D3EE" fontSize="11" fontFamily="monospace">
                SOLID CYAN: Horsepower (HP) · DASHED EMERALD: Torque (Nm)
              </text>
            </svg>
          </div>
        </div>
      ) : (
        <div className="relative flex-1 flex flex-col">
          {/* Top Floating Track HUD */}
          <div className="px-4 py-2 bg-[#070E1F] border-b border-white/10 flex flex-wrap items-center justify-between gap-3 font-mono-tech tabular-nums">
            <div className="flex flex-wrap items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <Gauge size={14} className="text-cyan-400" />
                <span className="text-xl font-bold text-white">{speedKmh}</span>
                <span className="text-slate-400">km/h</span>
              </div>
              <div className="px-2 py-0.5 rounded bg-blue-500/20 border border-blue-400/40 text-blue-200 font-bold">
                GEAR {gear}
              </div>
              <div className="text-amber-300 font-bold">{rpm} RPM</div>
              <div className="text-emerald-300">DIST: {distanceM} m</div>
              <div className="text-cyan-300">TIME: {elapsedSec.toFixed(1)} s</div>
            </div>
            <div className="text-xs text-slate-300 flex items-center gap-1.5">
              <Flag size={13} className="text-cyan-400" />
              <span>{statusBanner}</span>
            </div>
          </div>

          {/* 3D Proving Grounds Viewport */}
          <div ref={mountRef} className="flex-1 min-h-[360px] w-full bg-[#050A18]" />

          {/* Bottom Pedals & Steering Bar (Mobile Touch + Desktop Indicator) */}
          <div className="bg-[#070E20] border-t border-cyan-500/25 px-4 py-3 flex flex-wrap items-center justify-between gap-3 select-none">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onPointerDown={() => (keysRef.current.left = true)}
                onPointerUp={() => (keysRef.current.left = false)}
                onPointerLeave={() => (keysRef.current.left = false)}
                className="studio-btn studio-btn-ghost px-4 py-3 min-h-[48px]"
              >
                <ArrowLeft size={18} />
                <span>STEER L</span>
              </button>
              <button
                type="button"
                onPointerDown={() => (keysRef.current.right = true)}
                onPointerUp={() => (keysRef.current.right = false)}
                onPointerLeave={() => (keysRef.current.right = false)}
                className="studio-btn studio-btn-ghost px-4 py-3 min-h-[48px]"
              >
                <span>STEER R</span>
                <ArrowRight size={18} />
              </button>
            </div>

            <div className="hidden md:flex items-center gap-2 text-xs font-mono-tech text-slate-400">
              <Activity size={13} className="text-cyan-400" />
              <span>W/↑ Gas · S/↓/Space Brake · A/D Steer · C Camera · R Reset</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onPointerDown={() => (keysRef.current.brake = true)}
                onPointerUp={() => (keysRef.current.brake = false)}
                onPointerLeave={() => (keysRef.current.brake = false)}
                className="px-5 py-3 min-h-[48px] rounded-xl font-heading font-bold text-sm bg-rose-600 hover:bg-rose-500 text-white cursor-pointer"
              >
                BRAKE
              </button>
              <button
                type="button"
                onPointerDown={() => (keysRef.current.gas = true)}
                onPointerUp={() => (keysRef.current.gas = false)}
                onPointerLeave={() => (keysRef.current.gas = false)}
                className="studio-btn studio-btn-primary px-6 py-3 min-h-[48px] text-sm"
              >
                <ArrowUp size={18} />
                <span>THROTTLE</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

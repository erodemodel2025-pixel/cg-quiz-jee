import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  Camera,
  Check,
  CheckCircle2,
  Cpu,
  Eye,
  EyeOff,
  FolderOpen,
  Gauge,
  HelpCircle,
  Layers,
  RotateCcw,
  Save,
  Shuffle,
  Sliders,
  Target,
  Trash2,
  Trophy,
  Wrench,
  X,
} from 'lucide-react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { SavedCreation } from '../../../../shared/types.ts';
import { arcadeAudio } from '../../../audio/arcadeAudio.ts';
import { useArcade } from '../../../context/ArcadeContext.tsx';
import {
  getGuestOrUserId,
  listCreations,
  removeCreation,
  saveCreation,
} from '../../../utils/creationsStore.ts';
import type { EngineeringComponentSpec, SimulatorProgressSummary } from '../shared/engineeringTypes.ts';
import { LearningInspectorModal } from '../shared/LearningInspectorModal.tsx';
import {
  loadLocalSimulatorProgress,
  recordExploredComponentLocal,
  submitSimulatorMissionScore,
} from '../shared/simulatorLeaderboardClient.ts';
import { buildVehicleGroup, type VehicleRigHandles } from './carBuilder3d.ts';
import {
  CAR_MISSIONS,
  createInitialBuild,
  createRandomBuild,
  ENVIRONMENT_OPTIONS,
  evaluateCarTelemetry,
  PAINT_COLORS,
  RIM_COLORS,
  VEHICLE_PRESETS,
  type BodyKitStyle,
  type BrakeSystemType,
  type CarBuildConfig,
  type CarInspectionViewMode,
  type DifferentialType,
  type EngineConfig,
  type ForcedInduction,
  type FrontBumperStyle,
  type GearRatioProfile,
  type PaintFinish,
  type PowertrainType,
  type RearBumperStyle,
  type RimDesign,
  type SpoilerStyle,
  type StudioEnvironment,
  type SuspensionType,
  type TireCompound,
  type TransmissionType,
  type VehicleTypeId,
  type WeightConcept,
} from './carCatalog.ts';
import {
  CAR_COMPONENT_MAP,
  CAR_ENGINEERING_COMPONENTS,
  CAR_SUBSYSTEMS,
  type CarSubsystemId,
} from './carEngineeringData.ts';

interface AutoEngineerGameProps {
  onExit: () => void;
  initialBuild?: Partial<CarBuildConfig> | null;
  initialTitle?: string | null;
  initialCreationId?: string | null;
}

type StudioStage = 'garage' | 'studio';
type WorkstationTab = 'powertrain' | 'chassis' | 'telemetry' | 'missions' | 'components' | 'saved';
type CameraPresetId = 'hero' | 'front' | 'side' | 'rear' | 'top' | 'engine' | 'wheel';

const CAMERA_PRESETS: Record<CameraPresetId, { pos: [number, number, number]; target: [number, number, number] }> = {
  hero: { pos: [4.25, 1.9, 4.65], target: [0, 0.55, 0] },
  front: { pos: [0.05, 1.25, 5.2], target: [0, 0.55, 0] },
  side: { pos: [5.5, 1.15, 0.05], target: [0, 0.55, 0] },
  rear: { pos: [-0.05, 1.35, -5.2], target: [0, 0.55, 0] },
  top: { pos: [0.01, 6.2, 0.2], target: [0, 0.45, 0] },
  engine: { pos: [1.55, 1.85, 2.55], target: [0, 0.65, 1.1] },
  wheel: { pos: [2.1, 0.8, 1.8], target: [0.75, 0.36, 1.35] },
};

function detectSoftwareGl(): boolean {
  try {
    const probe = document.createElement('canvas');
    const gl = probe.getContext('webgl2') || probe.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    if (ext) {
      const r = String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || '');
      if (/SwiftShader|LLVMpipe|Software|ANGLE \(Google/i.test(r)) return true;
    }
    return false;
  } catch {
    return true;
  }
}

export const AutoEngineerGame: React.FC<AutoEngineerGameProps> = ({
  onExit,
  initialBuild,
  initialTitle,
  initialCreationId,
}) => {
  const { player, updateLocalPlayer } = useArcade();
  const isAuthenticated = Boolean(player?.id);
  const userId = getGuestOrUserId(player?.id);

  const [stage, setStage] = useState<StudioStage>(initialBuild ? 'studio' : 'garage');
  const [config, setConfig] = useState<CarBuildConfig>(() => {
    const base = createInitialBuild((initialBuild?.vehicleId as VehicleTypeId) || 'sports-coupe');
    return initialBuild ? { ...base, ...initialBuild } : base;
  });
  const [carName, setCarName] = useState<string>(
    initialTitle || VEHICLE_PRESETS.find((v) => v.id === (initialBuild?.vehicleId || 'sports-coupe'))?.name || 'Custom Build'
  );
  const [editingCreationId, setEditingCreationId] = useState<string | undefined>(initialCreationId || undefined);

  const [activeTab, setActiveTab] = useState<WorkstationTab>('powertrain');
  const [subsystemFilter, setSubsystemFilter] = useState<CarSubsystemId>('engine');
  const [learningMode, setLearningMode] = useState(true);
  const [hideHud, setHideHud] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [inspectedComp, setInspectedComp] = useState<EngineeringComponentSpec | null>(null);
  const [exploredIds, setExploredIds] = useState<Set<string>>(() => new Set());
  const [simProgress, setSimProgress] = useState<SimulatorProgressSummary>(() =>
    loadLocalSimulatorProgress(player?.id)
  );
  const [submittedMissionIds, setSubmittedMissionIds] = useState<Set<string>>(() => new Set());
  const [submittingMission, setSubmittingMission] = useState(false);

  const [webglFailed, setWebglFailed] = useState(false);
  const [savedCars, setSavedCars] = useState<SavedCreation[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const telemetry = useMemo(() => evaluateCarTelemetry(config), [config]);
  const activeMission = useMemo(
    () => (config.activeMissionId ? CAR_MISSIONS.find((m) => m.id === config.activeMissionId) || null : null),
    [config.activeMissionId]
  );
  const missionEval = useMemo(
    () => (activeMission ? activeMission.evaluate(config, telemetry) : null),
    [activeMission, config, telemetry]
  );

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => {
      setToast((curr) => (curr === msg ? null : curr));
    }, 3600);
  }, []);

  const refreshSavedCars = useCallback(async () => {
    const items = await listCreations(userId, 'car');
    setSavedCars(items);
  }, [userId]);

  useEffect(() => {
    void refreshSavedCars();
  }, [refreshSavedCars]);

  useEffect(() => {
    setSimProgress(loadLocalSimulatorProgress(player?.id));
  }, [player?.id]);

  // Open Learning Mode + track Exploration XP
  const openComponentLearning = useCallback(
    (compId: string) => {
      const comp = CAR_COMPONENT_MAP.get(compId);
      if (!comp) return;
      arcadeAudio.playSfx('click');
      setInspectedComp(comp);
      setExploredIds((prev) => {
        if (prev.has(compId)) return prev;
        const next = new Set(prev);
        next.add(compId);
        const prog = recordExploredComponentLocal(player?.id, next.size);
        setSimProgress(prog);
        return next;
      });
    },
    [player?.id]
  );

  // Three.js Refs
  const mountRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const vehicleGroupRef = useRef<THREE.Group | null>(null);
  const stageGroupRef = useRef<THREE.Group | null>(null);
  const keyLightRef = useRef<THREE.DirectionalLight | null>(null);
  const rimLightRef = useRef<THREE.DirectionalLight | null>(null);
  const fillLightRef = useRef<THREE.HemisphereLight | null>(null);
  const requestRenderRef = useRef<() => void>(() => {});
  const configRef = useRef(config);
  configRef.current = config;
  const openLearningRef = useRef(openComponentLearning);
  openLearningRef.current = openComponentLearning;

  const camTargetGoalRef = useRef<{
    active: boolean;
    pos: THREE.Vector3;
    target: THREE.Vector3;
  }>({
    active: false,
    pos: new THREE.Vector3(...CAMERA_PRESETS.hero.pos),
    target: new THREE.Vector3(...CAMERA_PRESETS.hero.target),
  });

  const explodeFactorRef = useRef(0);
  const hoodAngleRef = useRef(0);

  const setCameraView = useCallback((preset: CameraPresetId) => {
    arcadeAudio.playSfx('click');
    const p = CAMERA_PRESETS[preset];
    camTargetGoalRef.current.pos.set(...p.pos);
    camTargetGoalRef.current.target.set(...p.target);
    camTargetGoalRef.current.active = true;
    requestRenderRef.current();
  }, []);

  // Build / Update Stage Environment & Lighting
  const applyEnvironmentToScene = useCallback((env: StudioEnvironment) => {
    const scene = sceneRef.current;
    const stageGroup = stageGroupRef.current;
    const key = keyLightRef.current;
    const rim = rimLightRef.current;
    const fill = fillLightRef.current;
    if (!scene || !stageGroup || !key || !rim || !fill) return;

    while (stageGroup.children.length > 0) {
      const child = stageGroup.children.pop()!;
      child.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry?.dispose();
          const ms = Array.isArray(o.material) ? o.material : [o.material];
          ms.forEach((m) => m?.dispose());
        }
      });
    }

    if (env === 'modern-studio') {
      scene.background = new THREE.Color('#070E1F');
      scene.fog = new THREE.Fog('#070E1F', 12, 34);
      fill.color.set('#E0F2FE');
      fill.groundColor.set('#0F172A');
      fill.intensity = 1.15;
      key.color.set('#FFFFFF');
      key.intensity = 2.1;
      rim.color.set('#38BDF8');
      rim.intensity = 1.15;
    } else if (env === 'night-city') {
      scene.background = new THREE.Color('#050816');
      scene.fog = new THREE.Fog('#050816', 10, 30);
      fill.color.set('#38BDF8');
      fill.groundColor.set('#1E1B4B');
      fill.intensity = 0.85;
      key.color.set('#E2E8F0');
      key.intensity = 1.75;
      rim.color.set('#A855F7');
      rim.intensity = 1.65;
    } else if (env === 'mountain-road') {
      scene.background = new THREE.Color('#141E33');
      scene.fog = new THREE.Fog('#1E293B', 11, 32);
      fill.color.set('#FDE68A');
      fill.groundColor.set('#1E293B');
      fill.intensity = 0.95;
      key.color.set('#FFFBEB');
      key.intensity = 2.0;
      rim.color.set('#F59E0B');
      rim.intensity = 1.3;
    } else if (env === 'futuristic-showroom') {
      scene.background = new THREE.Color('#060B1A');
      scene.fog = new THREE.Fog('#060B1A', 11, 32);
      fill.color.set('#67E8F9');
      fill.groundColor.set('#1E1B4B');
      fill.intensity = 1.05;
      key.color.set('#F0F9FF');
      key.intensity = 2.0;
      rim.color.set('#22D3EE');
      rim.intensity = 1.8;
    } else {
      scene.background = new THREE.Color('#03050C');
      scene.fog = new THREE.Fog('#03050C', 9, 25);
      fill.color.set('#64748B');
      fill.groundColor.set('#020617');
      fill.intensity = 0.55;
      key.color.set('#F8FAFC');
      key.intensity = 2.4;
      rim.color.set('#3B82F6');
      rim.intensity = 1.35;
    }

    const floorMat = new THREE.MeshStandardMaterial({
      color: env === 'modern-studio' ? '#0C152B' : '#080E1E',
      roughness: 0.55,
      metalness: 0.25,
    });
    const floor = new THREE.Mesh(new THREE.CircleGeometry(22, 64), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    stageGroup.add(floor);

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(2.85, 2.93, 64),
      new THREE.MeshBasicMaterial({ color: '#22D3EE', side: THREE.DoubleSide })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.004;
    stageGroup.add(ring);

    const grid = new THREE.GridHelper(24, 24, 0x0284c7, 0x16223d);
    grid.position.y = 0.002;
    stageGroup.add(grid);

    requestRenderRef.current();
  }, []);

  // Keyboard Shortcuts: R Reset, F Front, T Top, E Exploded, I Component Info, H Hide UI, ESC Close
  useEffect(() => {
    if (stage !== 'studio') return;
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA')) {
        return;
      }
      const k = e.key.toLowerCase();
      if (e.key === 'Escape') {
        if (inspectedComp) setInspectedComp(null);
        else if (shortcutsOpen) setShortcutsOpen(false);
        else if (hideHud) setHideHud(false);
        return;
      }
      if (k === 'r') {
        setCameraView('hero');
      } else if (k === 'f') {
        setCameraView('front');
      } else if (k === 't') {
        setCameraView('top');
      } else if (k === 'e') {
        arcadeAudio.playSfx('click');
        setConfig((p) => ({
          ...p,
          viewMode: p.viewMode === 'exploded' ? 'exterior' : 'exploded',
        }));
      } else if (k === 'i') {
        if (inspectedComp) {
          setInspectedComp(null);
        } else {
          openComponentLearning(
            configRef.current.engineConfig === 'ev-dual' ? 'eng-ev-dual' : `eng-${configRef.current.engineConfig}`
          );
        }
      } else if (k === 'h') {
        setHideHud((v) => !v);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [stage, inspectedComp, shortcutsOpen, hideHud, setCameraView, openComponentLearning]);

  // Initialize WebGL Viewport once for studio stage
  useEffect(() => {
    if (stage !== 'studio') return;
    const container = mountRef.current;
    if (!container) return;

    const softwareGl = detectSoftwareGl();
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !softwareGl,
        powerPreference: 'high-performance',
        preserveDrawingBuffer: true,
      });
    } catch {
      setWebglFailed(true);
      return;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, softwareGl ? 1.5 : 2));
    renderer.setSize(container.clientWidth || 800, container.clientHeight || 520);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.shadowMap.enabled = !softwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const pmrem = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    const envTarget = pmrem.fromScene(roomEnv, 0.04);
    scene.environment = envTarget.texture;
    roomEnv.dispose();
    pmrem.dispose();

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 520;
    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
    camera.position.set(...CAMERA_PRESETS.hero.pos);
    cameraRef.current = camera;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = true;
    controls.minDistance = 2.0;
    controls.maxDistance = 11.0;
    controls.minPolarAngle = 0.08;
    controls.maxPolarAngle = Math.PI * 0.485;
    controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
    controls.target.set(...CAMERA_PRESETS.hero.target);
    controls.update();
    controlsRef.current = controls;

    const fillLight = new THREE.HemisphereLight('#E0F2FE', '#0F172A', 1.15);
    scene.add(fillLight);
    fillLightRef.current = fillLight;

    const keyLight = new THREE.DirectionalLight('#FFFFFF', 2.1);
    keyLight.position.set(5.5, 8.5, 6.5);
    keyLight.castShadow = !softwareGl;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.near = 1;
    keyLight.shadow.camera.far = 26;
    keyLight.shadow.camera.left = -4;
    keyLight.shadow.camera.right = 4;
    keyLight.shadow.camera.top = 4;
    keyLight.shadow.camera.bottom = -4;
    keyLight.shadow.bias = -0.0005;
    scene.add(keyLight);
    keyLightRef.current = keyLight;

    const rimLight = new THREE.DirectionalLight('#38BDF8', 1.25);
    rimLight.position.set(-5.5, 4.0, -5.0);
    scene.add(rimLight);
    rimLightRef.current = rimLight;

    const stageGroup = new THREE.Group();
    scene.add(stageGroup);
    stageGroupRef.current = stageGroup;

    const vehicleGroup = new THREE.Group();
    scene.add(vehicleGroup);
    vehicleGroupRef.current = vehicleGroup;

    // Pre-allocated raycaster helpers
    const raycaster = new THREE.Raycaster();
    const pointerNdc = new THREE.Vector2();
    let pointerDownPos = { x: 0, y: 0 };

    let rafId = 0;
    let needsRender = true;
    let lastTs = performance.now();

    const renderFrame = (ts: number) => {
      rafId = 0;
      const dt = Math.min(0.05, (ts - lastTs) / 1000);
      lastTs = ts;

      const cfg = configRef.current;
      const rig = vehicleGroup.userData.rig as VehicleRigHandles | undefined;

      // Smoothly animate Hood & Exploded View & Cooling Fan
      if (rig) {
        const targetHood = cfg.engineBayOpen ? rig.hoodOpenAngle : rig.hoodClosedAngle;
        if (Math.abs(hoodAngleRef.current - targetHood) > 0.004) {
          hoodAngleRef.current = THREE.MathUtils.damp(hoodAngleRef.current, targetHood, 8, dt);
          needsRender = true;
        } else {
          hoodAngleRef.current = targetHood;
        }
        rig.hoodPivot.rotation.x = hoodAngleRef.current;

        const targetExplode = cfg.viewMode === 'exploded' ? 1 : 0;
        if (Math.abs(explodeFactorRef.current - targetExplode) > 0.004) {
          explodeFactorRef.current = THREE.MathUtils.damp(explodeFactorRef.current, targetExplode, 7, dt);
          needsRender = true;
        } else {
          explodeFactorRef.current = targetExplode;
        }
        for (const entry of rig.explodables) {
          entry.obj.position
            .copy(entry.basePos)
            .addScaledVector(entry.explodeOffset, explodeFactorRef.current);
        }

        if (rig.coolingFan && (cfg.engineBayOpen || cfg.viewMode !== 'exterior')) {
          rig.coolingFan.rotation.z += dt * 4.5;
          needsRender = true;
        }
      }

      // Smooth camera transition to presets
      const goal = camTargetGoalRef.current;
      if (goal.active) {
        camera.position.x = THREE.MathUtils.damp(camera.position.x, goal.pos.x, 7, dt);
        camera.position.y = THREE.MathUtils.damp(camera.position.y, goal.pos.y, 7, dt);
        camera.position.z = THREE.MathUtils.damp(camera.position.z, goal.pos.z, 7, dt);
        controls.target.x = THREE.MathUtils.damp(controls.target.x, goal.target.x, 7, dt);
        controls.target.y = THREE.MathUtils.damp(controls.target.y, goal.target.y, 7, dt);
        controls.target.z = THREE.MathUtils.damp(controls.target.z, goal.target.z, 7, dt);
        if (camera.position.distanceTo(goal.pos) < 0.02) {
          goal.active = false;
        } else {
          needsRender = true;
        }
      }

      const moved = controls.update();
      if (moved) needsRender = true;

      renderer.render(scene, camera);

      if (needsRender) {
        needsRender = false;
        schedule();
      }
    };

    const schedule = () => {
      if (!rafId) {
        rafId = window.requestAnimationFrame(renderFrame);
      }
    };

    requestRenderRef.current = () => {
      needsRender = true;
      schedule();
    };

    const onControlStart = () => {
      camTargetGoalRef.current.active = false;
    };
    const onControlChange = () => {
      requestRenderRef.current();
    };
    controls.addEventListener('start', onControlStart);
    controls.addEventListener('change', onControlChange);

    const canvas = renderer.domElement;

    const onPointerDown = (e: PointerEvent) => {
      pointerDownPos = { x: e.clientX, y: e.clientY };
    };
    const onPointerUp = (e: PointerEvent) => {
      const dist = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
      if (dist > 5) return; // Ignore orbit drags
      const rect = canvas.getBoundingClientRect();
      pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointerNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointerNdc, camera);
      const hits = raycaster.intersectObjects(vehicleGroup.children, true);
      const tagged = hits.find((h) => typeof h.object.userData?.componentId === 'string');
      if (tagged) {
        const compId = String(tagged.object.userData.componentId);
        openLearningRef.current(compId);
      }
    };
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointerup', onPointerUp);

    const onResize = () => {
      if (!container) return;
      const w = container.clientWidth || 800;
      const h = container.clientHeight || 520;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      requestRenderRef.current();
    };
    const resizeObs = new ResizeObserver(onResize);
    resizeObs.observe(container);

    const onLost = (e: Event) => {
      e.preventDefault();
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = 0;
      }
    };
    const onRestored = () => {
      requestRenderRef.current();
    };
    canvas.addEventListener('webglcontextlost', onLost);
    canvas.addEventListener('webglcontextrestored', onRestored);

    applyEnvironmentToScene(configRef.current.environment);
    buildVehicleGroup(configRef.current, vehicleGroup);
    requestRenderRef.current();

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      resizeObs.disconnect();
      controls.removeEventListener('start', onControlStart);
      controls.removeEventListener('change', onControlChange);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('webglcontextlost', onLost);
      canvas.removeEventListener('webglcontextrestored', onRestored);
      controls.dispose();
      envTarget.dispose();
      renderer.dispose();
      if (container.contains(canvas)) container.removeChild(canvas);
      rendererRef.current = null;
      sceneRef.current = null;
      vehicleGroupRef.current = null;
    };
  }, [stage, applyEnvironmentToScene]);

  // Rebuild vehicle mesh whenever hardware/config changes (and trigger animation loop for hood/explode)
  useEffect(() => {
    if (stage !== 'studio' || !vehicleGroupRef.current) return;
    buildVehicleGroup(config, vehicleGroupRef.current);
    requestRenderRef.current();
  }, [stage, config]);

  useEffect(() => {
    if (stage !== 'studio') return;
    applyEnvironmentToScene(config.environment);
  }, [stage, config.environment, applyEnvironmentToScene]);

  const selectVehicle = (vehicleId: VehicleTypeId) => {
    arcadeAudio.playSfx('click');
    const preset = VEHICLE_PRESETS.find((v) => v.id === vehicleId) || VEHICLE_PRESETS[0];
    setConfig(createInitialBuild(vehicleId));
    setCarName(preset.name);
    setEditingCreationId(undefined);
    setStage('studio');
  };

  const handleExportPng = () => {
    arcadeAudio.playSfx('click');
    if (rendererRef.current && sceneRef.current && cameraRef.current) {
      rendererRef.current.render(sceneRef.current, cameraRef.current);
      const url = rendererRef.current.domElement.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = `${carName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-cad.png`;
      a.click();
      showToast('Exported high-resolution CAD PNG snapshot!');
    }
  };

  const handleSaveCar = async () => {
    arcadeAudio.playSfx('click');
    setSaving(true);
    let previewDataUrl: string | null = null;
    if (rendererRef.current && sceneRef.current && cameraRef.current) {
      try {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
        previewDataUrl = rendererRef.current.domElement.toDataURL('image/jpeg', 0.65);
      } catch {
        previewDataUrl = null;
      }
    }

    const res = await saveCreation({
      id: editingCreationId,
      userId,
      type: 'car',
      title: carName.trim() || telemetry.preset.name,
      subtitle: `${telemetry.horsepower} HP · ${telemetry.accel0to100Sec}s 0-100 · Cd ${telemetry.dragCoefficient}`,
      designRating: telemetry.designRating,
      estimatedCost: telemetry.totalEstimatedValue,
      payload: config as unknown as Record<string, unknown>,
      previewDataUrl,
    });
    setSaving(false);
    setEditingCreationId(res.creation.id);
    if (res.player) updateLocalPlayer(res.player);
    await refreshSavedCars();
    arcadeAudio.playSfx(res.leveledUp ? 'levelUp' : 'correct');
    showToast(`Saved "${res.creation.title}" (+${res.xpEarned} XP)`);
  };

  const handleLoadSavedCar = (item: SavedCreation) => {
    arcadeAudio.playSfx('click');
    const payload = item.payload as Partial<CarBuildConfig>;
    const base = createInitialBuild((payload.vehicleId as VehicleTypeId) || 'sports-coupe');
    setConfig({ ...base, ...payload });
    setCarName(item.title);
    setEditingCreationId(item.id);
    setStage('studio');
    showToast(`Loaded "${item.title}" into CAD Studio`);
  };

  const handleSubmitMissionScore = async () => {
    if (!activeMission || !missionEval) return;
    if (!missionEval.passed) {
      arcadeAudio.playSfx('bonk');
      showToast('Complete all mission targets before submitting score.');
      return;
    }
    if (submittedMissionIds.has(activeMission.id)) {
      showToast('This mission score is already recorded for this session.');
      return;
    }
    setSubmittingMission(true);
    const result = await submitSimulatorMissionScore(
      {
        userId: player?.id || '',
        simulator: 'car',
        missionId: activeMission.id,
        missionTitle: activeMission.title,
        score: missionEval.score,
        accuracy: missionEval.accuracy,
        componentsExplored: exploredIds.size,
        buildTitle: carName,
        detailsSummary: `${telemetry.horsepower}HP / ${telemetry.effectiveWeightKg}kg / Cd ${telemetry.dragCoefficient}`,
      },
      isAuthenticated
    );
    setSubmittingMission(false);
    setSimProgress(result.progress);
    if (result.savedToLeaderboard) {
      if (result.player) updateLocalPlayer(result.player);
      setSubmittedMissionIds((prev) => new Set(prev).add(activeMission.id));
      arcadeAudio.playSfx(result.leveledUp ? 'levelUp' : 'wow');
      showToast(`Mission verified on Leaderboard! +${result.xpEarned} Engineering XP`);
    } else {
      showToast(result.error || 'Sign in to submit mission scores to the leaderboard.');
    }
  };

  /* ============================================================
     STAGE 1: CHASSIS PLATFORM SELECTOR
     ============================================================ */
  if (stage === 'garage') {
    return (
      <div className="min-h-[calc(100vh-4rem)] max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <button
              type="button"
              onClick={() => {
                arcadeAudio.playSfx('click');
                onExit();
              }}
              className="studio-btn studio-btn-ghost text-xs px-3 py-1.5 min-h-[34px] mb-3"
            >
              <ArrowLeft size={14} />
              <span>Back to Game Arena</span>
            </button>
            <div className="font-mono-tech text-xs font-bold uppercase tracking-widest text-[var(--studio-cyan-text)]">
              Automotive CAD · Physics Simulation · 7 Engineering Missions
            </div>
            <h1 className="font-heading font-bold text-2xl sm:text-4xl text-[var(--studio-text)] mt-1">
              Car Tuning <span className="text-[var(--studio-accent-text)]">Engineering Simulator</span>
            </h1>
            <p className="text-sm sm:text-base text-[var(--studio-text-secondary)] mt-1 max-w-2xl">
              Select a chassis platform to launch the 3D CAD workstation. Inspect engine bays, suspension geometry, brakes, transmissions, and aerodynamics with deterministic engineering physics.
            </p>
          </div>
          {savedCars.length > 0 && (
            <div className="studio-card px-4 py-3 flex items-center gap-3">
              <FolderOpen size={18} className="text-[var(--studio-accent-text)]" />
              <div>
                <div className="font-mono-tech text-xs font-bold text-[var(--studio-accent-text)]">MY GARAGE</div>
                <div className="text-xs text-[var(--studio-text-secondary)]">{savedCars.length} saved builds</div>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {VEHICLE_PRESETS.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => selectVehicle(v.id)}
              className="studio-card-interactive p-5 text-left flex flex-col justify-between gap-4 cursor-pointer group"
            >
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono-tech text-[11px] font-bold px-2.5 py-0.5 rounded-md bg-[var(--studio-surface-2)] border border-[var(--studio-border)] text-[var(--studio-accent-text)]">
                    {v.category}
                  </span>
                  <span
                    className="w-4 h-4 rounded-full border border-white/40 shrink-0"
                    style={{ backgroundColor: v.defaultColor }}
                  />
                </div>
                <h2 className="font-heading font-bold text-lg text-[var(--studio-text)] group-hover:text-[var(--studio-accent-text)] transition-colors">
                  {v.name}
                </h2>
                <p className="text-xs text-[var(--studio-text-secondary)] leading-relaxed">{v.description}</p>
              </div>
              <div className="pt-3 border-t border-[var(--studio-border)] flex items-center justify-between font-mono-tech text-xs">
                <span className="text-[var(--studio-text-muted)]">{v.baseWeightKg} kg · Cd {v.baseDragCd}</span>
                <span className="font-bold text-cyan-300">Open CAD →</span>
              </div>
            </button>
          ))}
        </div>

        {savedCars.length > 0 && (
          <section className="studio-card-solid p-5 sm:p-6 space-y-4">
            <h2 className="font-heading font-bold text-lg text-[var(--studio-text)] flex items-center gap-2">
              <FolderOpen size={18} className="text-[var(--studio-accent-text)]" />
              Saved Garage Projects
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {savedCars.map((c) => (
                <div key={c.id} className="p-4 rounded-xl studio-well flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-sora font-bold text-sm text-[var(--studio-text)] truncate">{c.title}</div>
                    <div className="font-mono-tech text-[11px] text-[var(--studio-text-muted)] truncate">{c.subtitle}</div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleLoadSavedCar(c)}
                      className="studio-btn studio-btn-primary text-xs px-3 py-1.5 min-h-[34px]"
                    >
                      Open
                    </button>
                    <button
                      type="button"
                      onClick={() => void removeCreation(c.id, userId).then(refreshSavedCars)}
                      aria-label="Delete car build"
                      className="p-2 rounded-lg bg-slate-900 border border-white/10 text-rose-400 hover:border-rose-400 cursor-pointer"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    );
  }

  /* ============================================================
     STAGE 2: FULL-SCREEN 3D ENGINEERING CAD WORKSTATION
     ============================================================ */
  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col bg-[#040914] text-slate-100">
      {/* Top CAD Toolbar */}
      <div className="border-b border-cyan-500/25 bg-[#070E20] px-3 sm:px-5 py-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={() => {
              arcadeAudio.playSfx('click');
              setStage('garage');
            }}
            className="studio-btn studio-btn-ghost text-xs px-2.5 py-1.5 min-h-[34px]"
          >
            <ArrowLeft size={14} />
            <span className="hidden sm:inline">Platforms</span>
          </button>

          <input
            type="text"
            value={carName}
            onChange={(e) => setCarName(e.target.value)}
            maxLength={44}
            aria-label="Vehicle project name"
            className="studio-input px-2.5 py-1 text-xs sm:text-sm font-heading font-bold w-36 sm:w-52 bg-[#0B152C]"
          />

          <span className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#0B152C] border border-cyan-500/30 font-mono-tech text-[11px] text-cyan-300 tabular-nums">
            <Gauge size={12} /> {telemetry.horsepower} HP · {telemetry.accel0to100Sec}s 0-100 · Cd {telemetry.dragCoefficient}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              arcadeAudio.playSfx('click');
              setLearningMode((v) => !v);
            }}
            className={`studio-btn text-xs px-2.5 py-1.5 min-h-[34px] ${
              learningMode ? 'studio-btn-cyan' : 'studio-btn-ghost'
            }`}
            title="Toggle click-to-inspect Engineering Learning Mode (I)"
          >
            <BookOpen size={13} />
            <span className="hidden sm:inline">Learning {learningMode ? 'ON' : 'OFF'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              arcadeAudio.playSfx('click');
              setConfig(createRandomBuild(config.vehicleId));
            }}
            className="studio-btn studio-btn-ghost text-xs px-2.5 py-1.5 min-h-[34px]"
            title="Random engineering setup"
          >
            <Shuffle size={13} />
          </button>

          <button
            type="button"
            onClick={handleExportPng}
            className="studio-btn studio-btn-ghost text-xs px-2.5 py-1.5 min-h-[34px]"
            title="Export CAD PNG Snapshot"
          >
            <Camera size={13} />
          </button>

          <button
            type="button"
            disabled={saving}
            onClick={() => void handleSaveCar()}
            className="studio-btn studio-btn-primary text-xs px-3 py-1.5 min-h-[34px]"
          >
            <Save size={13} />
            <span>{saving ? 'Saving...' : 'Save Build'}</span>
          </button>
        </div>
      </div>

      {/* Main CAD Workspace Grid */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 min-h-[620px]">
        {/* Left/Center Unobstructed 3D CAD Viewport */}
        <div
          className={`${
            hideHud ? 'lg:col-span-12' : 'lg:col-span-8'
          } relative flex flex-col min-h-[420px] lg:min-h-[640px] bg-[#040914]`}
        >
          {/* Floating Minimal Telemetry Corner Readout (No backdrop-blur over WebGL) */}
          <div className="absolute top-3 left-3 z-10 pointer-events-none flex flex-col gap-1.5 max-w-[260px]">
            <div className="px-3 py-2 rounded-xl bg-[#070E1F]/90 border border-cyan-500/35 font-mono-tech text-[11px] space-y-0.5 tabular-nums">
              <div className="text-cyan-300 font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Activity size={12} /> Live Physics Telemetry
              </div>
              <div className="text-slate-200">
                {telemetry.horsepower} HP · {telemetry.torqueNm} Nm · {telemetry.effectiveWeightKg} kg
              </div>
              <div className="text-emerald-300">
                0-100: {telemetry.accel0to100Sec}s · Top: {telemetry.topSpeedKmh} km/h · Stop: {telemetry.braking100to0M}m
              </div>
              <div className="text-amber-300">
                {telemetry.powerToWeightHpPerTon} HP/t · {telemetry.rangeOrEfficiencyNote.split('·')[0]}
              </div>
            </div>

            {telemetry.engineeringWarnings.length > 0 && (
              <div className="px-3 py-2 rounded-xl bg-amber-950/90 border border-amber-500/50 text-amber-100 font-mono-tech text-[10px] flex items-start gap-1.5">
                <AlertTriangle size={13} className="text-amber-300 shrink-0 mt-0.5" />
                <span>{telemetry.engineeringWarnings[0]}</span>
              </div>
            )}
          </div>

          {/* Click Hint & Hide UI button */}
          <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setShortcutsOpen((v) => !v)}
              className="px-2.5 py-1.5 rounded-lg bg-[#070E1F]/90 border border-white/15 hover:border-cyan-400 text-xs font-mono-tech text-slate-200 flex items-center gap-1 cursor-pointer"
              title="Keyboard Shortcuts"
            >
              <HelpCircle size={13} className="text-cyan-300" />
              <span className="hidden sm:inline">Keys</span>
            </button>
            <button
              type="button"
              onClick={() => setHideHud((v) => !v)}
              className="px-2.5 py-1.5 rounded-lg bg-[#070E1F]/90 border border-white/15 hover:border-cyan-400 text-xs font-mono-tech text-slate-200 flex items-center gap-1 cursor-pointer"
              title="Toggle Side Panel (H)"
            >
              {hideHud ? <Eye size={13} /> : <EyeOff size={13} />}
              <span>{hideHud ? 'Show CAD (H)' : 'Cinema (H)'}</span>
            </button>
          </div>

          {toast && (
            <div className="absolute top-14 left-1/2 -translate-x-1/2 z-20 px-4 py-2 rounded-xl bg-emerald-950 border border-emerald-400 text-emerald-100 text-xs font-sora flex items-center gap-2 shadow-xl">
              <Check size={14} className="text-emerald-400" />
              <span>{toast}</span>
            </div>
          )}

          {/* Three.js Canvas OR Graceful 2D Engineering Blueprint Fallback */}
          {!webglFailed ? (
            <div ref={mountRef} className="w-full h-full flex-1 min-h-[420px]" />
          ) : (
            <div className="w-full h-full flex-1 flex flex-col items-center justify-center p-6 text-center bg-[#060E20]">
              <div className="max-w-lg w-full p-5 rounded-2xl border border-cyan-500/35 bg-[#09152E] space-y-4">
                <div className="font-mono-tech text-xs text-cyan-300 uppercase">
                  2D Engineering Blueprint Mode (Software Graphics Fallback)
                </div>
                <svg viewBox="0 0 420 170" className="w-full h-44 bg-[#040914] rounded-xl border border-white/10">
                  <path
                    d="M55 115 L75 72 L155 68 L225 46 L315 56 L365 82 L370 115 Z"
                    fill="rgba(37,99,235,0.22)"
                    stroke="#38BDF8"
                    strokeWidth="2"
                  />
                  <circle cx="115" cy="120" r="24" fill="#0F172A" stroke="#CBD5E1" strokeWidth="3" />
                  <circle cx="310" cy="120" r="24" fill="#0F172A" stroke="#CBD5E1" strokeWidth="3" />
                  <rect x="275" y="76" width="52" height="24" fill="rgba(245,158,11,0.35)" stroke="#F59E0B" />
                  <text x="210" y="25" fill="#BAE6FD" fontSize="10" fontFamily="monospace" textAnchor="middle">
                    {carName} · {telemetry.horsepower} HP · {telemetry.effectiveWeightKg} kg · Cd {telemetry.dragCoefficient}
                  </text>
                </svg>
                <p className="text-xs text-slate-300">
                  All tuning parameters, physics formulas, Learning Mode schematics, and 7 Engineering Missions work identically in 2D Blueprint Mode.
                </p>
              </div>
            </div>
          )}

          {/* Collapsible Bottom Quick CAD Control Bar */}
          <div className="border-t border-cyan-500/20 bg-[#070E20] px-3 py-2 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1">
              {(
                [
                  { id: 'hero', label: 'Reset (R)' },
                  { id: 'front', label: 'Front (F)' },
                  { id: 'side', label: 'Side' },
                  { id: 'rear', label: 'Rear' },
                  { id: 'top', label: 'Top (T)' },
                  { id: 'engine', label: 'Engine Bay' },
                  { id: 'wheel', label: 'Brakes & Susp.' },
                ] as const
              ).map((cam) => (
                <button
                  key={cam.id}
                  type="button"
                  onClick={() => setCameraView(cam.id)}
                  className="px-2 py-1 rounded-lg bg-[#0C1730] border border-white/10 hover:border-cyan-400 text-[11px] font-mono-tech text-slate-200 cursor-pointer"
                >
                  {cam.label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  arcadeAudio.playSfx('click');
                  setConfig((p) => {
                    const nextOpen = !p.engineBayOpen;
                    if (nextOpen) setCameraView('engine');
                    return { ...p, engineBayOpen: nextOpen };
                  });
                }}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-mono-tech font-bold border cursor-pointer ${
                  config.engineBayOpen
                    ? 'bg-cyan-500/25 border-cyan-400 text-cyan-200'
                    : 'bg-[#0C1730] border-white/10 text-slate-200 hover:border-cyan-400'
                }`}
              >
                {config.engineBayOpen ? 'Close Hood' : 'Open Hood'}
              </button>

              {(
                [
                  { id: 'exterior', label: 'Exterior' },
                  { id: 'technical', label: 'Tech X-Ray' },
                  { id: 'exploded', label: 'Exploded (E)' },
                ] as Array<{ id: CarInspectionViewMode; label: string }>
              ).map((vm) => (
                <button
                  key={vm.id}
                  type="button"
                  onClick={() => {
                    arcadeAudio.playSfx('click');
                    setConfig((p) => ({ ...p, viewMode: vm.id }));
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-mono-tech font-bold border cursor-pointer ${
                    config.viewMode === vm.id
                      ? 'bg-blue-600 border-cyan-300 text-white'
                      : 'bg-[#0C1730] border-white/10 text-slate-300 hover:border-cyan-400'
                  }`}
                >
                  {vm.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Engineering Workstation Inspector Drawer */}
        {!hideHud && (
          <aside className="lg:col-span-4 border-t lg:border-t-0 lg:border-l border-cyan-500/25 bg-[#070E20] flex flex-col max-h-[600px] lg:max-h-[calc(100vh-7.5rem)]">
            {/* Workstation Tabs */}
            <div className="grid grid-cols-3 sm:grid-cols-6 lg:grid-cols-3 gap-1 p-1.5 border-b border-white/10 bg-[#050A17]">
              {(
                [
                  { id: 'powertrain', label: 'Engine/Aero', icon: Cpu },
                  { id: 'chassis', label: 'Chassis/Body', icon: Sliders },
                  { id: 'telemetry', label: 'Physics/Math', icon: Gauge },
                  { id: 'missions', label: '7 Missions', icon: Target },
                  { id: 'components', label: 'Learn Parts', icon: BookOpen },
                  { id: 'saved', label: `Garage (${savedCars.length})`, icon: FolderOpen },
                ] as const
              ).map((t) => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      arcadeAudio.playSfx('click');
                      setActiveTab(t.id);
                    }}
                    className={`py-1.5 px-2 rounded-lg text-[11px] font-sora font-semibold flex items-center justify-center gap-1 cursor-pointer border transition-colors ${
                      activeTab === t.id
                        ? 'bg-blue-600/35 border-cyan-400 text-cyan-100'
                        : 'bg-[#0B1328] border-white/5 text-slate-400 hover:text-white'
                    }`}
                  >
                    <Icon size={12} />
                    <span>{t.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="flex-1 overflow-y-auto studio-scroll p-4 space-y-4">
              {/* TAB 1: POWERTRAIN & AERODYNAMICS */}
              {activeTab === 'powertrain' && (
                <div className="space-y-4">
                  <div className="p-3 rounded-xl bg-[#0B152C] border border-cyan-500/25 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="font-mono-tech text-[11px] font-bold text-cyan-300 uppercase">
                        1. Engine Architecture
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          openComponentLearning(
                            config.engineConfig === 'ev-dual' ? 'eng-ev-dual' : `eng-${config.engineConfig}`
                          )
                        }
                        className="text-[10px] font-mono-tech text-cyan-300 hover:underline cursor-pointer"
                      >
                        Inspect Theory →
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {(
                        [
                          { id: 'i4', label: 'Inline-4 (2.0L)', sub: 'Eco & Light' },
                          { id: 'v6', label: 'V6 Twin-Bank', sub: 'Balanced GT' },
                          { id: 'v8', label: 'V8 5.0L', sub: 'High Torque' },
                          { id: 'ev-dual', label: 'EV Dual-Motor', sub: '800V Electric' },
                        ] as Array<{ id: EngineConfig; label: string; sub: string }>
                      ).map((e) => (
                        <button
                          key={e.id}
                          type="button"
                          onClick={() => {
                            arcadeAudio.playSfx('click');
                            setConfig((p) => ({
                              ...p,
                              engineConfig: e.id,
                              powertrain: e.id === 'ev-dual' ? 'ev' : p.powertrain === 'ev' ? 'petrol-v8' : p.powertrain,
                              transmissionType: e.id === 'ev-dual' ? 'ev-single' : p.transmissionType === 'ev-single' ? 'dct' : p.transmissionType,
                              forcedInduction: e.id === 'ev-dual' ? 'none' : p.forcedInduction,
                            }));
                          }}
                          className={`p-2 rounded-lg text-left border cursor-pointer ${
                            config.engineConfig === e.id
                              ? 'bg-cyan-500/20 border-cyan-400 text-white'
                              : 'bg-[#070E1F] border-white/10 text-slate-300'
                          }`}
                        >
                          <div className="font-sora font-bold text-xs">{e.label}</div>
                          <div className="font-mono-tech text-[10px] text-slate-400">{e.sub}</div>
                        </button>
                      ))}
                    </div>

                    {config.engineConfig !== 'ev-dual' && (
                      <>
                        <div className="pt-1">
                          <div className="font-mono-tech text-[10px] text-slate-400 mb-1">POWERTRAIN HYBRIDIZATION</div>
                          <div className="grid grid-cols-2 gap-1.5">
                            {(['petrol-v8', 'hybrid'] as PowertrainType[]).map((pt) => (
                              <button
                                key={pt}
                                type="button"
                                onClick={() => setConfig((p) => ({ ...p, powertrain: pt }))}
                                className={`py-1.5 px-2 rounded-lg text-xs font-mono-tech border cursor-pointer ${
                                  config.powertrain === pt
                                    ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200'
                                    : 'bg-[#070E1F] border-white/10 text-slate-300'
                                }`}
                              >
                                {pt === 'hybrid' ? 'Hybrid +65HP/Regen' : 'Pure Combustion'}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="pt-1">
                          <div className="font-mono-tech text-[10px] text-slate-400 mb-1">FORCED INDUCTION</div>
                          <div className="grid grid-cols-3 gap-1.5">
                            {(
                              [
                                { id: 'none', label: 'Naturally Asp.' },
                                { id: 'turbo', label: 'Turbo (+36%)' },
                                { id: 'supercharger', label: 'Supercharger' },
                              ] as Array<{ id: ForcedInduction; label: string }>
                            ).map((fi) => (
                              <button
                                key={fi.id}
                                type="button"
                                onClick={() => setConfig((p) => ({ ...p, forcedInduction: fi.id }))}
                                className={`py-1.5 px-2 rounded-lg text-[11px] font-sora font-semibold border cursor-pointer ${
                                  config.forcedInduction === fi.id
                                    ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                                    : 'bg-[#070E1F] border-white/10 text-slate-300'
                                }`}
                              >
                                {fi.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-1.5 pt-1">
                          <label className="flex items-center gap-2 p-2 rounded-lg bg-[#070E1F] border border-white/10 text-xs cursor-pointer">
                            <input
                              type="checkbox"
                              checked={config.intercooler}
                              onChange={(e) => setConfig((p) => ({ ...p, intercooler: e.target.checked }))}
                            />
                            <span>Intercooler Core</span>
                          </label>
                          <label className="flex items-center gap-2 p-2 rounded-lg bg-[#070E1F] border border-white/10 text-xs cursor-pointer">
                            <input
                              type="checkbox"
                              checked={config.coolingUpgrade === 'high-flow-alu'}
                              onChange={(e) =>
                                setConfig((p) => ({
                                  ...p,
                                  coolingUpgrade: e.target.checked ? 'high-flow-alu' : 'standard',
                                }))
                              }
                            />
                            <span>Dual-Pass Radiator</span>
                          </label>
                          <label className="flex items-center gap-2 p-2 rounded-lg bg-[#070E1F] border border-white/10 text-xs cursor-pointer">
                            <input
                              type="checkbox"
                              checked={config.intakeUpgrade === 'cold-air'}
                              onChange={(e) =>
                                setConfig((p) => ({ ...p, intakeUpgrade: e.target.checked ? 'cold-air' : 'stock' }))
                              }
                            />
                            <span>Cold Air Intake</span>
                          </label>
                          <label className="flex items-center gap-2 p-2 rounded-lg bg-[#070E1F] border border-white/10 text-xs cursor-pointer">
                            <input
                              type="checkbox"
                              checked={config.exhaustUpgrade === 'headers-titanium'}
                              onChange={(e) =>
                                setConfig((p) => ({
                                  ...p,
                                  exhaustUpgrade: e.target.checked ? 'headers-titanium' : 'stock',
                                }))
                              }
                            />
                            <span>Titanium Headers</span>
                          </label>
                        </div>

                        <div>
                          <div className="flex justify-between font-mono-tech text-[11px] text-slate-300 mb-1">
                            <span>RPM REDLINE CEILING</span>
                            <span className="text-cyan-300 font-bold">{config.redlineRpm} RPM</span>
                          </div>
                          <input
                            type="range"
                            min={5500}
                            max={9000}
                            step={250}
                            value={config.redlineRpm}
                            onChange={(e) => setConfig((p) => ({ ...p, redlineRpm: Number(e.target.value) }))}
                            className="w-full accent-cyan-400"
                          />
                        </div>
                      </>
                    )}
                  </div>

                  {/* Transmission & Differential */}
                  <div className="p-3 rounded-xl bg-[#0B152C] border border-white/10 space-y-2.5">
                    <div className="font-mono-tech text-[11px] font-bold text-cyan-300 uppercase">
                      2. Transmission &amp; Gearing
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {(
                        [
                          { id: 'manual', label: '6-Spd Manual' },
                          { id: 'auto', label: '8-Spd Auto' },
                          { id: 'dct', label: '7-Spd DCT (45ms)' },
                          { id: 'ev-single', label: 'EV Direct Drive' },
                        ] as Array<{ id: TransmissionType; label: string }>
                      ).map((tr) => (
                        <button
                          key={tr.id}
                          type="button"
                          onClick={() => setConfig((p) => ({ ...p, transmissionType: tr.id }))}
                          className={`py-1.5 px-2 rounded-lg text-xs font-sora font-semibold border cursor-pointer ${
                            config.transmissionType === tr.id
                              ? 'bg-blue-600/35 border-cyan-400 text-white'
                              : 'bg-[#070E1F] border-white/10 text-slate-300'
                          }`}
                        >
                          {tr.label}
                        </button>
                      ))}
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(['short', 'balanced', 'tall'] as GearRatioProfile[]).map((gr) => (
                        <button
                          key={gr}
                          type="button"
                          onClick={() => setConfig((p) => ({ ...p, gearRatioProfile: gr }))}
                          className={`py-1.5 px-2 rounded-lg text-[11px] font-mono-tech uppercase border cursor-pointer ${
                            config.gearRatioProfile === gr
                              ? 'bg-cyan-500/25 border-cyan-400 text-cyan-200'
                              : 'bg-[#070E1F] border-white/10 text-slate-300'
                          }`}
                        >
                          {gr} Gear
                        </button>
                      ))}
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {(['open', 'lsd'] as DifferentialType[]).map((d) => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => setConfig((p) => ({ ...p, differentialType: d }))}
                          className={`py-1.5 px-2 rounded-lg text-xs font-mono-tech border cursor-pointer ${
                            config.differentialType === d
                              ? 'bg-purple-500/25 border-purple-400 text-purple-200'
                              : 'bg-[#070E1F] border-white/10 text-slate-300'
                          }`}
                        >
                          {d === 'lsd' ? 'Helical LSD Traction' : 'Open Differential'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Aerodynamics */}
                  <div className="p-3 rounded-xl bg-[#0B152C] border border-white/10 space-y-2.5">
                    <div className="font-mono-tech text-[11px] font-bold text-cyan-300 uppercase">
                      3. Aerodynamics &amp; Downforce
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block font-mono-tech text-[10px] text-slate-400 mb-1">FRONT SPLITTER</label>
                        <select
                          value={config.frontBumper}
                          onChange={(e) => setConfig((p) => ({ ...p, frontBumper: e.target.value as FrontBumperStyle }))}
                          className="studio-input w-full px-2 py-1.5 text-xs bg-[#070E1F]"
                        >
                          <option value="stock">Stock Bumper</option>
                          <option value="sport-splitter">Carbon Splitter (-0.015 Cd)</option>
                          <option value="track-canards">Track Canards (+240N DF)</option>
                          <option value="bullbar">Heavy Bullbar (+0.048 Cd)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block font-mono-tech text-[10px] text-slate-400 mb-1">REAR DIFFUSER</label>
                        <select
                          value={config.rearBumper}
                          onChange={(e) => setConfig((p) => ({ ...p, rearBumper: e.target.value as RearBumperStyle }))}
                          className="studio-input w-full px-2 py-1.5 text-xs bg-[#070E1F]"
                        >
                          <option value="stock">Stock Rear</option>
                          <option value="quad-diffuser">Venturi Diffuser (-0.02 Cd)</option>
                          <option value="twin-exhaust">Twin Exhaust</option>
                          <option value="skid-plate">Offroad Skid Plate</option>
                        </select>
                      </div>
                      <div>
                        <label className="block font-mono-tech text-[10px] text-slate-400 mb-1">REAR WING</label>
                        <select
                          value={config.spoiler}
                          onChange={(e) => setConfig((p) => ({ ...p, spoiler: e.target.value as SpoilerStyle }))}
                          className="studio-input w-full px-2 py-1.5 text-xs bg-[#070E1F]"
                        >
                          <option value="none">Wingless Clean</option>
                          <option value="lip">Aero Lip (-0.01 Cd)</option>
                          <option value="ducktail">Ducktail (+140N)</option>
                          <option value="gt-wing">GT Wing (+440N, +Drag)</option>
                          <option value="twin-swan">Swan-Neck Wing (+420N)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block font-mono-tech text-[10px] text-slate-400 mb-1">BODY KIT</label>
                        <select
                          value={config.bodyKit}
                          onChange={(e) => setConfig((p) => ({ ...p, bodyKit: e.target.value as BodyKitStyle }))}
                          className="studio-input w-full px-2 py-1.5 text-xs bg-[#070E1F]"
                        >
                          <option value="factory">Factory Sill</option>
                          <option value="street-skirts">Side Skirts (-0.008 Cd)</option>
                          <option value="widebody-flares">Widebody (+0.018 Cd)</option>
                          <option value="aero-gt">Aero GT Ground-Effect</option>
                        </select>
                      </div>
                    </div>
                    <label className="flex items-center gap-2 p-2 rounded-lg bg-[#070E1F] border border-white/10 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        checked={config.airDucts}
                        onChange={(e) => setConfig((p) => ({ ...p, airDucts: e.target.checked }))}
                      />
                      <span>Brake Cooling &amp; Wheel-Curtain Air Ducts (-0.012 Cd)</span>
                    </label>
                  </div>
                </div>
              )}

              {/* TAB 2: CHASSIS, SUSPENSION, BRAKES & EXTERIOR */}
              {activeTab === 'chassis' && (
                <div className="space-y-4">
                  <div className="p-3 rounded-xl bg-[#0B152C] border border-cyan-500/25 space-y-2.5">
                    <div className="font-mono-tech text-[11px] font-bold text-cyan-300 uppercase">
                      Suspension &amp; Tires
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {(
                        [
                          { id: 'macpherson', label: 'MacPherson Strut' },
                          { id: 'double-wishbone', label: 'Double Wishbone' },
                        ] as Array<{ id: SuspensionType; label: string }>
                      ).map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => setConfig((p) => ({ ...p, suspensionType: s.id }))}
                          className={`py-2 px-2 rounded-lg text-xs font-sora font-semibold border cursor-pointer ${
                            config.suspensionType === s.id
                              ? 'bg-cyan-500/20 border-cyan-400 text-white'
                              : 'bg-[#070E1F] border-white/10 text-slate-300'
                          }`}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>

                    <div>
                      <div className="flex justify-between font-mono-tech text-[11px] text-slate-300 mb-1">
                        <span>SPRING STIFFNESS</span>
                        <span className="text-cyan-300 font-bold">
                          {config.springStiffnessNmm} N/mm ({telemetry.rideFrequencyHz} Hz)
                        </span>
                      </div>
                      <input
                        type="range"
                        min={25}
                        max={110}
                        step={5}
                        value={config.springStiffnessNmm}
                        onChange={(e) => setConfig((p) => ({ ...p, springStiffnessNmm: Number(e.target.value) }))}
                        className="w-full accent-cyan-400"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between font-mono-tech text-[11px] text-slate-300 mb-1">
                        <span>RIDE HEIGHT OFFSET</span>
                        <span className="text-cyan-300 font-bold">{config.suspensionOffsetMm} mm</span>
                      </div>
                      <input
                        type="range"
                        min={-25}
                        max={35}
                        step={1}
                        value={config.suspensionOffsetMm}
                        onChange={(e) => setConfig((p) => ({ ...p, suspensionOffsetMm: Number(e.target.value) }))}
                        className="w-full accent-cyan-400"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-1.5">
                      {(['standard', 'stiff-track'] as const).map((arb) => (
                        <button
                          key={arb}
                          type="button"
                          onClick={() => setConfig((p) => ({ ...p, antiRollBars: arb }))}
                          className={`py-1.5 px-2 rounded-lg text-xs font-mono-tech border cursor-pointer ${
                            config.antiRollBars === arb
                              ? 'bg-blue-600/35 border-cyan-400 text-white'
                              : 'bg-[#070E1F] border-white/10 text-slate-300'
                          }`}
                        >
                          {arb === 'stiff-track' ? 'Track Anti-Roll Bars' : 'Standard Sway Bars'}
                        </button>
                      ))}
                    </div>

                    <div>
                      <div className="font-mono-tech text-[10px] text-slate-400 mb-1">TIRE COMPOUND</div>
                      <div className="grid grid-cols-3 gap-1.5">
                        {(['eco', 'sport', 'semi-slick'] as TireCompound[]).map((tc) => (
                          <button
                            key={tc}
                            type="button"
                            onClick={() => setConfig((p) => ({ ...p, tireCompound: tc }))}
                            className={`py-1.5 px-2 rounded-lg text-xs font-sora font-semibold border cursor-pointer capitalize ${
                              config.tireCompound === tc
                                ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200'
                                : 'bg-[#070E1F] border-white/10 text-slate-300'
                            }`}
                          >
                            {tc}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Braking & Weight Material */}
                  <div className="p-3 rounded-xl bg-[#0B152C] border border-white/10 space-y-2.5">
                    <div className="font-mono-tech text-[11px] font-bold text-cyan-300 uppercase">
                      Braking System &amp; Chassis Material
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(
                        [
                          { id: 'drum', label: 'Drum Brakes' },
                          { id: 'disc', label: 'Vent. Discs' },
                          { id: 'disc-abs', label: 'Discs + ABS' },
                        ] as Array<{ id: BrakeSystemType; label: string }>
                      ).map((b) => (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => setConfig((p) => ({ ...p, brakeSystem: b.id }))}
                          className={`py-1.5 px-2 rounded-lg text-xs font-sora font-semibold border cursor-pointer ${
                            config.brakeSystem === b.id
                              ? 'bg-rose-500/25 border-rose-400 text-rose-100'
                              : 'bg-[#070E1F] border-white/10 text-slate-300'
                          }`}
                        >
                          {b.label}
                        </button>
                      ))}
                    </div>

                    <div className="grid grid-cols-3 gap-1.5">
                      {(
                        [
                          { id: 'lightweight-carbon', label: 'Carbon (-155kg)' },
                          { id: 'balanced-alloy', label: 'Alloy Std' },
                          { id: 'heavy-duty', label: 'Steel (+145kg)' },
                        ] as Array<{ id: WeightConcept; label: string }>
                      ).map((w) => (
                        <button
                          key={w.id}
                          type="button"
                          onClick={() => setConfig((p) => ({ ...p, weightConcept: w.id }))}
                          className={`py-1.5 px-2 rounded-lg text-[11px] font-mono-tech border cursor-pointer ${
                            config.weightConcept === w.id
                              ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200'
                              : 'bg-[#070E1F] border-white/10 text-slate-300'
                          }`}
                        >
                          {w.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Finish, Wheels & Stage */}
                  <div className="p-3 rounded-xl bg-[#0B152C] border border-white/10 space-y-2.5">
                    <div className="font-mono-tech text-[11px] font-bold text-slate-300 uppercase">
                      Aero Wheels, Paint &amp; Environment
                    </div>
                    <div className="grid grid-cols-5 gap-1.5">
                      {PAINT_COLORS.map((c) => (
                        <button
                          key={c.hex}
                          type="button"
                          onClick={() => setConfig((p) => ({ ...p, bodyColor: c.hex }))}
                          title={c.name}
                          className={`h-7 rounded-lg border-2 cursor-pointer ${
                            config.bodyColor === c.hex ? 'border-cyan-300 scale-105' : 'border-white/20'
                          }`}
                          style={{ backgroundColor: c.hex }}
                        />
                      ))}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={config.paintFinish}
                        onChange={(e) => setConfig((p) => ({ ...p, paintFinish: e.target.value as PaintFinish }))}
                        className="studio-input px-2 py-1.5 text-xs bg-[#070E1F]"
                      >
                        <option value="gloss">Gloss Clearcoat</option>
                        <option value="metallic">Metallic Flake</option>
                        <option value="pearl">Pearl Iridescent</option>
                        <option value="matte">Satin Matte</option>
                      </select>
                      <select
                        value={config.rimDesign}
                        onChange={(e) => setConfig((p) => ({ ...p, rimDesign: e.target.value as RimDesign }))}
                        className="studio-input px-2 py-1.5 text-xs bg-[#070E1F]"
                      >
                        <option value="twin-5">Twin-5 Forged</option>
                        <option value="turbofan">Aero Turbofan (-0.014 Cd)</option>
                        <option value="multi-10">Multi-10 Mesh</option>
                        <option value="deep-mesh">Deep-Dish Track</option>
                        <option value="offroad-bead">Beadlock 4x4</option>
                      </select>
                    </div>
                    <div className="flex gap-1.5">
                      {RIM_COLORS.map((rc) => (
                        <button
                          key={rc.hex}
                          type="button"
                          onClick={() => setConfig((p) => ({ ...p, rimColor: rc.hex }))}
                          title={rc.name}
                          className={`flex-1 h-6 rounded border cursor-pointer ${
                            config.rimColor === rc.hex ? 'border-cyan-300' : 'border-white/15'
                          }`}
                          style={{ backgroundColor: rc.hex }}
                        />
                      ))}
                    </div>
                    <select
                      value={config.environment}
                      onChange={(e) => setConfig((p) => ({ ...p, environment: e.target.value as StudioEnvironment }))}
                      className="studio-input w-full px-2 py-1.5 text-xs bg-[#070E1F]"
                    >
                      {ENVIRONMENT_OPTIONS.map((env) => (
                        <option key={env.id} value={env.id}>
                          Stage: {env.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* TAB 3: LIVE TELEMETRY & PHYSICS FORMULAS */}
              {activeTab === 'telemetry' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2 font-mono-tech tabular-nums">
                    {[
                      { k: 'Horsepower', v: `${telemetry.horsepower} HP`, c: 'text-cyan-300' },
                      { k: 'Torque Output', v: `${telemetry.torqueNm} Nm`, c: 'text-amber-300' },
                      { k: 'Vehicle Mass', v: `${telemetry.effectiveWeightKg} kg`, c: 'text-slate-100' },
                      { k: 'Power / Weight', v: `${telemetry.powerToWeightHpPerTon} HP/t`, c: 'text-emerald-300' },
                      { k: '0–100 km/h', v: `${telemetry.accel0to100Sec} s`, c: 'text-cyan-300' },
                      { k: 'Top Speed', v: `${telemetry.topSpeedKmh} km/h`, c: 'text-purple-300' },
                      { k: '100–0 Braking', v: `${telemetry.braking100to0M} m`, c: 'text-rose-300' },
                      { k: 'Fuel / Energy', v: telemetry.evWhPerKm > 0 ? `${telemetry.evWhPerKm} Wh/km` : `${telemetry.fuelEfficiencyKmL} km/L (${telemetry.fuelConsumptionL100Km} L/100)`, c: 'text-emerald-300' },
                      { k: 'Drag Coeff. Cd', v: `${telemetry.dragCoefficient}`, c: 'text-cyan-300' },
                      { k: 'Downforce @160', v: `${telemetry.downforceN160Kmh} N`, c: 'text-amber-300' },
                      { k: 'Corner Grip', v: `${telemetry.lateralGripG} g`, c: 'text-emerald-300' },
                      { k: 'Cooling Margin', v: `${telemetry.thermalHeadroomPct}%`, c: 'text-cyan-300' },
                    ].map((m) => (
                      <div key={m.k} className="p-2.5 rounded-xl bg-[#0B152C] border border-white/10">
                        <div className="text-[10px] text-slate-400 uppercase">{m.k}</div>
                        <div className={`text-xs sm:text-sm font-bold ${m.c}`}>{m.v}</div>
                      </div>
                    ))}
                  </div>

                  <div className="p-3 rounded-xl bg-[#040914] border border-cyan-500/30 space-y-2">
                    <div className="font-mono-tech text-[10px] uppercase tracking-wider text-cyan-300">
                      Deterministic Simulation Equations
                    </div>
                    {telemetry.formulaNotes.map((f) => (
                      <div key={f} className="font-mono-tech text-[11px] text-slate-300 bg-[#0A1328] p-2 rounded-lg border border-white/5">
                        {f}
                      </div>
                    ))}
                    <div className="text-[11px] text-slate-400 italic pt-1">
                      Note: All figures are computed deterministically from physics equations for educational engineering comparison.
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: 7 ENGINEERING MISSIONS */}
              {activeTab === 'missions' && (
                <div className="space-y-3">
                  <div className="p-3 rounded-xl bg-[#0B152C] border border-cyan-500/30 flex items-center justify-between text-xs font-mono-tech">
                    <span className="text-cyan-300 font-bold">
                      XP: {simProgress.engineeringXp} · Completed: {simProgress.missionsCompleted}
                    </span>
                    <span className="text-amber-300 font-bold">Total Score: {simProgress.totalScore}</span>
                  </div>

                  <div className="space-y-2">
                    {CAR_MISSIONS.map((m) => {
                      const ev = m.evaluate(config, telemetry);
                      const isActive = config.activeMissionId === m.id;
                      const isSubmitted = submittedMissionIds.has(m.id);
                      return (
                        <div
                          key={m.id}
                          className={`p-3 rounded-xl border transition-colors ${
                            isActive
                              ? 'bg-blue-950/45 border-cyan-400'
                              : ev.passed
                                ? 'bg-emerald-950/25 border-emerald-500/40'
                                : 'bg-[#0B152C] border-white/10'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                arcadeAudio.playSfx('click');
                                setConfig((p) => ({
                                  ...p,
                                  activeMissionId: p.activeMissionId === m.id ? null : m.id,
                                }));
                              }}
                              className="text-left flex-1 cursor-pointer"
                            >
                              <div className="font-sora font-bold text-xs text-white flex items-center gap-1.5">
                                {ev.passed && <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />}
                                <span>{m.title}</span>
                              </div>
                              <p className="text-[11px] text-slate-300 mt-0.5">{m.objective}</p>
                            </button>
                            <span className="font-mono-tech text-[10px] font-bold px-2 py-0.5 rounded bg-[#040914] text-cyan-300 shrink-0">
                              {ev.accuracy}%
                            </span>
                          </div>

                          {isActive && (
                            <div className="mt-3 pt-2.5 border-t border-white/10 space-y-2">
                              {ev.checklist.map((c) => (
                                <div key={c.label} className="flex items-center gap-2 text-xs">
                                  <span
                                    className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                                      c.ok ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-400'
                                    }`}
                                  >
                                    {c.ok ? '✓' : '·'}
                                  </span>
                                  <span className={c.ok ? 'text-emerald-200' : 'text-slate-300'}>{c.label}</span>
                                </div>
                              ))}

                              <div className="p-2.5 rounded-lg bg-[#040914] border border-cyan-500/25 text-[11px] text-slate-200">
                                <div className="font-mono-tech text-[10px] text-cyan-300 uppercase mb-0.5">
                                  Engineering Evaluation
                                </div>
                                {ev.tradeoffFeedback}
                              </div>

                              <button
                                type="button"
                                disabled={!ev.passed || isSubmitted || submittingMission}
                                onClick={() => void handleSubmitMissionScore()}
                                className={`w-full studio-btn text-xs py-2 ${
                                  isSubmitted
                                    ? 'studio-btn-emerald'
                                    : ev.passed
                                      ? 'studio-btn-primary'
                                      : 'studio-btn-ghost opacity-60'
                                }`}
                              >
                                <Trophy size={13} />
                                <span>
                                  {isSubmitted
                                    ? 'Score Verified on Leaderboard'
                                    : ev.passed
                                      ? isAuthenticated
                                        ? `Submit Mission Score (${ev.score} pts)`
                                        : `Sign In to Save (${ev.score} pts)`
                                      : 'Meet All Targets to Submit'}
                                </span>
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* TAB 5: ENGINEERING COMPONENT LEARNING DIRECTORY */}
              {activeTab === 'components' && (
                <div className="space-y-3">
                  <div className="p-2.5 rounded-xl bg-[#0B152C] border border-cyan-500/25 text-xs text-slate-300">
                    Click any 3D part on the car OR choose from the 6 subsystems below to study materials, operation, failure modes, and CAD schematics ({exploredIds.size}/{CAR_ENGINEERING_COMPONENTS.length} explored).
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {CAR_SUBSYSTEMS.map((sub) => (
                      <button
                        key={sub.id}
                        type="button"
                        onClick={() => setSubsystemFilter(sub.id)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-mono-tech border cursor-pointer ${
                          subsystemFilter === sub.id
                            ? 'bg-cyan-500/25 border-cyan-400 text-cyan-200'
                            : 'bg-[#0B152C] border-white/10 text-slate-400'
                        }`}
                      >
                        {sub.label}
                      </button>
                    ))}
                  </div>

                  <div className="space-y-2">
                    {CAR_ENGINEERING_COMPONENTS.filter((c) => {
                      const prefix =
                        subsystemFilter === 'engine'
                          ? 'eng-'
                          : subsystemFilter === 'transmission'
                            ? 'trn-'
                            : subsystemFilter === 'suspension'
                              ? 'sus-'
                              : subsystemFilter === 'brakes'
                                ? 'brk-'
                                : subsystemFilter === 'electrical'
                                  ? 'elc-'
                                  : 'aer-';
                      return c.id.startsWith(prefix);
                    }).map((comp) => (
                      <button
                        key={comp.id}
                        type="button"
                        onClick={() => openComponentLearning(comp.id)}
                        className="w-full p-3 rounded-xl bg-[#0B152C] border border-white/10 hover:border-cyan-400 text-left flex items-center justify-between gap-2 cursor-pointer transition-colors"
                      >
                        <div className="min-w-0">
                          <div className="font-sora font-bold text-xs text-white truncate">{comp.name}</div>
                          <div className="font-mono-tech text-[10px] text-cyan-300 truncate">{comp.performanceImpact}</div>
                        </div>
                        <span className="text-[10px] font-mono-tech px-2 py-1 rounded bg-[#040914] text-cyan-200 shrink-0">
                          {exploredIds.has(comp.id) ? '✓ Studied' : 'Inspect'}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 6: SAVED BUILDS */}
              {activeTab === 'saved' && (
                <div className="space-y-3">
                  {savedCars.length === 0 ? (
                    <div className="p-6 text-center rounded-xl bg-[#0B152C] border border-white/10 text-xs text-slate-400">
                      No saved vehicle configurations yet. Click Save Build above to store your engineering setup.
                    </div>
                  ) : (
                    savedCars.map((c) => (
                      <div key={c.id} className="p-3 rounded-xl bg-[#0B152C] border border-white/10 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-sora font-bold text-xs text-white truncate">{c.title}</div>
                          <div className="font-mono-tech text-[10px] text-slate-400 truncate">{c.subtitle}</div>
                        </div>
                        <div className="flex gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleLoadSavedCar(c)}
                            className="px-2.5 py-1 rounded-lg bg-blue-600 text-white text-xs font-sora cursor-pointer"
                          >
                            Load
                          </button>
                          <button
                            type="button"
                            onClick={() => void removeCreation(c.id, userId).then(refreshSavedCars)}
                            className="p-1.5 rounded-lg bg-slate-900 text-rose-400 cursor-pointer"
                            aria-label="Delete saved build"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </aside>
        )}
      </div>

      {/* Keyboard Shortcuts Help Overlay */}
      {shortcutsOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setShortcutsOpen(false)}
        >
          <div
            className="max-w-md w-full rounded-2xl bg-[#070E20] border border-cyan-500/40 p-5 space-y-3 text-slate-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-heading font-bold text-lg text-white">CAD Workstation Controls</h3>
              <button
                type="button"
                onClick={() => setShortcutsOpen(false)}
                className="p-1.5 rounded-lg bg-slate-900 text-slate-300 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs font-mono-tech">
              {[
                ['Left Drag / 1-Finger', '360° Orbit Rotate'],
                ['Scroll / Pinch', 'Zoom In & Out'],
                ['Right Drag / 2-Finger', 'Pan Camera'],
                ['Click 3D Part', 'Inspect Component Info'],
                ['Key R', 'Reset Camera'],
                ['Key F / T', 'Front / Top View'],
                ['Key E', 'Exploded View Toggle'],
                ['Key I', 'Component Learning Panel'],
                ['Key H', 'Hide / Show Interface'],
                ['Key ESC', 'Close Open Panel'],
              ].map(([k, v]) => (
                <div key={k} className="p-2 rounded-lg bg-[#0C1730] border border-white/10">
                  <div className="text-cyan-300 font-bold">{k}</div>
                  <div className="text-slate-300">{v}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Engineering Learning Mode Modal */}
      <LearningInspectorModal
        component={inspectedComp}
        exploredCount={exploredIds.size}
        totalComponents={CAR_ENGINEERING_COMPONENTS.length}
        onClose={() => setInspectedComp(null)}
      />
    </div>
  );
};

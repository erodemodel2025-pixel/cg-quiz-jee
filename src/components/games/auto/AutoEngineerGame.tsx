import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Camera,
  Check,
  Columns2,
  Cpu,
  FolderOpen,
  Gauge,
  RotateCcw,
  Save,
  Shuffle,
  Sliders,
  Sparkles,
  Sun,
  Trash2,
  Wrench,
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
import { buildVehicleGroup } from './carBuilder3d.ts';
import {
  createInitialBuild,
  createRandomBuild,
  CUSTOMIZATION_CATEGORIES,
  ENVIRONMENT_OPTIONS,
  evaluateCarTelemetry,
  PAINT_COLORS,
  RIM_COLORS,
  VEHICLE_PRESETS,
  type BodyKitStyle,
  type CarBuildConfig,
  type CustomizerTabId,
  type DecalStyle,
  type FrontBumperStyle,
  type HeadlightStyle,
  type InteriorTheme,
  type PaintFinish,
  type PowertrainType,
  type RearBumperStyle,
  type RimDesign,
  type SpoilerStyle,
  type StudioEnvironment,
  type TaillightStyle,
  type VehicleTypeId,
  type WeightConcept,
  type WindowTintStyle,
} from './carCatalog.ts';

interface AutoEngineerGameProps {
  onExit: () => void;
  initialBuild?: Partial<CarBuildConfig> | null;
  initialTitle?: string | null;
  initialCreationId?: string | null;
}

type StudioStage = 'garage' | 'studio';
type StudioPanelMode = 'customize' | 'engineering' | 'environment' | 'saved';
type CameraPresetId = 'hero' | 'front' | 'side' | 'rear' | 'top';

const CAMERA_PRESETS: Record<CameraPresetId, { pos: [number, number, number]; target: [number, number, number] }> = {
  hero: { pos: [4.3, 1.95, 4.7], target: [0, 0.55, 0] },
  front: { pos: [0.05, 1.25, 5.4], target: [0, 0.58, 0] },
  side: { pos: [5.6, 1.15, 0.05], target: [0, 0.58, 0] },
  rear: { pos: [-0.05, 1.35, -5.4], target: [0, 0.58, 0] },
  top: { pos: [3.2, 4.3, 3.3], target: [0, 0.45, 0] },
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

  const [panelMode, setPanelMode] = useState<StudioPanelMode>('customize');
  const [activeTab, setActiveTab] = useState<CustomizerTabId>('color');
  const [compareBefore, setCompareBefore] = useState(false);
  const [autoSpin, setAutoSpin] = useState(false);
  const [webglFailed, setWebglFailed] = useState(false);
  const [savedCars, setSavedCars] = useState<SavedCreation[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const displayConfig = useMemo(
    () => (compareBefore ? createInitialBuild(config.vehicleId) : config),
    [compareBefore, config]
  );

  const telemetry = useMemo(() => evaluateCarTelemetry(displayConfig), [displayConfig]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => {
      setToast((curr) => (curr === msg ? null : curr));
    }, 3400);
  }, []);

  const refreshSavedCars = useCallback(async () => {
    const items = await listCreations(userId, 'car');
    setSavedCars(items);
  }, [userId]);

  useEffect(() => {
    void refreshSavedCars();
  }, [refreshSavedCars]);

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
  const camTargetGoalRef = useRef<{
    active: boolean;
    pos: THREE.Vector3;
    target: THREE.Vector3;
  }>({
    active: false,
    pos: new THREE.Vector3(...CAMERA_PRESETS.hero.pos),
    target: new THREE.Vector3(...CAMERA_PRESETS.hero.target),
  });
  const autoSpinRef = useRef(false);
  autoSpinRef.current = autoSpin;

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
      scene.background = new THREE.Color('#0B1328');
      scene.fog = new THREE.Fog('#0B1328', 12, 34);
      fill.color.set('#E0F2FE');
      fill.groundColor.set('#0F172A');
      fill.intensity = 1.1;
      key.color.set('#FFFFFF');
      key.intensity = 2.1;
      rim.color.set('#38BDF8');
      rim.intensity = 1.1;
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
      scene.background = new THREE.Color('#070A1F');
      scene.fog = new THREE.Fog('#070A1F', 11, 32);
      fill.color.set('#67E8F9');
      fill.groundColor.set('#1E1B4B');
      fill.intensity = 1.0;
      key.color.set('#F0F9FF');
      key.intensity = 2.0;
      rim.color.set('#22D3EE');
      rim.intensity = 1.8;
    } else {
      // dark-cinematic
      scene.background = new THREE.Color('#03050C');
      scene.fog = new THREE.Fog('#03050C', 9, 25);
      fill.color.set('#64748B');
      fill.groundColor.set('#020617');
      fill.intensity = 0.45;
      key.color.set('#F8FAFC');
      key.intensity = 2.4;
      rim.color.set('#3B82F6');
      rim.intensity = 1.35;
    }

    // Main Floor
    const floorMat = new THREE.MeshStandardMaterial({
      color: env === 'modern-studio' ? '#131D38' : env === 'mountain-road' ? '#1E2430' : '#090F1F',
      roughness: env === 'dark-cinematic' ? 0.35 : 0.65,
      metalness: 0.25,
    });
    const floor = new THREE.Mesh(new THREE.CircleGeometry(22, 64), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    stageGroup.add(floor);

    if (env === 'modern-studio' || env === 'futuristic-showroom' || env === 'dark-cinematic') {
      const ringColor = env === 'futuristic-showroom' ? '#22D3EE' : env === 'dark-cinematic' ? '#3B82F6' : '#38BDF8';
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(2.85, 2.94, 64),
        new THREE.MeshBasicMaterial({ color: ringColor, side: THREE.DoubleSide })
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.004;
      stageGroup.add(ring);

      const grid = new THREE.GridHelper(24, 24, env === 'futuristic-showroom' ? 0x22d3ee : 0x1e293b, 0x16223d);
      grid.position.y = 0.002;
      stageGroup.add(grid);
    } else if (env === 'night-city') {
      const roadMat = new THREE.MeshStandardMaterial({ color: '#0F172A', roughness: 0.5 });
      const road = new THREE.Mesh(new THREE.PlaneGeometry(7, 36), roadMat);
      road.rotation.x = -Math.PI / 2;
      road.position.y = 0.003;
      stageGroup.add(road);

      // Skyline blocks in far background
      const bldgMat = new THREE.MeshStandardMaterial({ color: '#0B1120', roughness: 0.9 });
      const winMat = new THREE.MeshBasicMaterial({ color: '#38BDF8' });
      for (let i = -5; i <= 5; i++) {
        if (Math.abs(i) <= 1) continue;
        const h = 3 + ((Math.abs(i) * 1.7) % 4);
        const b = new THREE.Mesh(new THREE.BoxGeometry(2.1, h, 2.1), bldgMat);
        b.position.set(i * 2.8, h / 2, -13 - (Math.abs(i) % 2) * 2);
        stageGroup.add(b);
        const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.12, 0.1), winMat);
        stripe.position.set(i * 2.8, h * 0.72, b.position.z + 1.06);
        stageGroup.add(stripe);
      }
    } else if (env === 'mountain-road') {
      const road = new THREE.Mesh(
        new THREE.PlaneGeometry(6.5, 36),
        new THREE.MeshStandardMaterial({ color: '#1F2937', roughness: 0.75 })
      );
      road.rotation.x = -Math.PI / 2;
      road.position.y = 0.003;
      stageGroup.add(road);
      // Dashed yellow center line
      for (let z = -12; z <= 12; z += 2.6) {
        const dash = new THREE.Mesh(
          new THREE.PlaneGeometry(0.14, 1.1),
          new THREE.MeshBasicMaterial({ color: '#FACC15' })
        );
        dash.rotation.x = -Math.PI / 2;
        dash.position.set(0, 0.005, z);
        stageGroup.add(dash);
      }
      // Alpine peaks in background
      const peakMat = new THREE.MeshStandardMaterial({ color: '#1E293B', roughness: 0.9 });
      for (let pIdx = -3; pIdx <= 3; pIdx++) {
        const cone = new THREE.Mesh(new THREE.ConeGeometry(4.2, 5.5 + Math.abs(pIdx), 4), peakMat);
        cone.position.set(pIdx * 5.2, 2.5, -16);
        cone.rotation.y = Math.PI / 4;
        stageGroup.add(cone);
      }
    }

    requestRenderRef.current();
  }, []);

  // Initialize Three.js WebGL Viewport once when stage === 'studio'
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
        preserveDrawingBuffer: true, // Reliable screenshot export
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

    // RoomEnvironment PMREM for crisp glossy & metallic clearcoat car paint reflections
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
    controls.minDistance = 2.6;
    controls.maxDistance = 10.5;
    controls.minPolarAngle = 0.18;
    controls.maxPolarAngle = Math.PI * 0.485;
    controls.target.set(...CAMERA_PRESETS.hero.target);
    controls.update();
    controlsRef.current = controls;

    // Lights
    const fillLight = new THREE.HemisphereLight('#E0F2FE', '#0F172A', 1.1);
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

    const rimLight = new THREE.DirectionalLight('#38BDF8', 1.2);
    rimLight.position.set(-5.5, 4.0, -5.0);
    scene.add(rimLight);
    rimLightRef.current = rimLight;

    const stageGroup = new THREE.Group();
    scene.add(stageGroup);
    stageGroupRef.current = stageGroup;

    const vehicleGroup = new THREE.Group();
    scene.add(vehicleGroup);
    vehicleGroupRef.current = vehicleGroup;

    // Render scheduling (coalesced for GPU friendliness + instant interaction)
    let rafId = 0;
    let needsRender = true;
    let lastTs = performance.now();

    const renderFrame = (ts: number) => {
      rafId = 0;
      const dt = Math.min(0.05, (ts - lastTs) / 1000);
      lastTs = ts;

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

      if (autoSpinRef.current) {
        vehicleGroup.rotation.y += dt * 0.45;
        needsRender = true;
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

    const onControlChange = () => {
      // Cancel preset tween if user grabs camera manually
      camTargetGoalRef.current.active = false;
      requestRenderRef.current();
    };
    controls.addEventListener('change', onControlChange);

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

    const canvas = renderer.domElement;
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

    // Initial scene population
    applyEnvironmentToScene(displayConfig.environment);
    buildVehicleGroup(displayConfig, vehicleGroup);
    requestRenderRef.current();

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      resizeObs.disconnect();
      controls.removeEventListener('change', onControlChange);
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
  }, [stage]); // Only rebuild WebGL context when entering/exiting studio stage

  // Live update car mesh whenever build config changes
  useEffect(() => {
    if (stage !== 'studio' || !vehicleGroupRef.current) return;
    buildVehicleGroup(displayConfig, vehicleGroupRef.current);
    requestRenderRef.current();
  }, [stage, displayConfig]);

  // Live update environment & lights
  useEffect(() => {
    if (stage !== 'studio') return;
    applyEnvironmentToScene(displayConfig.environment);
  }, [stage, displayConfig.environment, applyEnvironmentToScene]);

  // Trigger loop when autoSpin toggles on
  useEffect(() => {
    if (autoSpin) requestRenderRef.current();
  }, [autoSpin]);

  const selectVehicle = (vehicleId: VehicleTypeId) => {
    arcadeAudio.playSfx('click');
    const preset = VEHICLE_PRESETS.find((v) => v.id === vehicleId) || VEHICLE_PRESETS[0];
    setConfig(createInitialBuild(vehicleId));
    setCarName(preset.name);
    setEditingCreationId(undefined);
    setCompareBefore(false);
    setStage('studio');
  };

  const handleExportPng = () => {
    arcadeAudio.playSfx('click');
    if (rendererRef.current && sceneRef.current && cameraRef.current) {
      rendererRef.current.render(sceneRef.current, cameraRef.current);
      const url = rendererRef.current.domElement.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = `${carName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-cgstudio.png`;
      a.click();
      showToast('Exported high-resolution PNG snapshot!');
    } else {
      showToast('PNG export requires active 3D viewport.');
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
      subtitle: `${telemetry.preset.category} · ${config.paintFinish.toUpperCase()} · ${config.powertrain.toUpperCase()}`,
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
    setCompareBefore(false);
    setStage('studio');
    setPanelMode('customize');
    showToast(`Loaded "${item.title}" into 3D Studio`);
  };

  const handleDeleteSavedCar = async (id: string) => {
    arcadeAudio.playSfx('click');
    await removeCreation(id, userId);
    if (editingCreationId === id) setEditingCreationId(undefined);
    await refreshSavedCars();
    showToast('Removed build from My Garage');
  };

  /* ============================================================
     STAGE 1: CAR SELECTION GARAGE
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
            <h1 className="font-heading font-bold text-2xl sm:text-4xl text-[var(--studio-text)]">
              Become an <span className="text-[var(--studio-accent-text)]">Automobile Engineer</span>
            </h1>
            <p className="text-sm sm:text-base text-[var(--studio-text-secondary)] mt-1 max-w-2xl">
              Choose a chassis platform below to enter the real-time 3D customization lab. Modify bodywork, rims, aero wings, lighting, suspension geometry, and powertrains.
            </p>
          </div>
          {savedCars.length > 0 && (
            <div className="studio-card px-4 py-3 flex items-center gap-3">
              <FolderOpen size={18} className="text-[var(--studio-accent-text)]" />
              <div>
                <div className="font-mono-tech text-xs font-bold text-[var(--studio-accent-text)]">MY GARAGE</div>
                <div className="font-sora text-sm font-bold text-[var(--studio-text)]">
                  {savedCars.length} Saved Vehicle{savedCars.length === 1 ? '' : 's'}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 8 Vehicle Platform Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {VEHICLE_PRESETS.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => selectVehicle(v.id)}
              className="studio-card-interactive text-left p-5 flex flex-col justify-between gap-4 cursor-pointer group"
            >
              <div>
                {/* Crisp Vector Silhouette Preview */}
                <div className="h-28 rounded-xl bg-[#0F172A] border border-[var(--studio-border-strong)] mb-4 flex items-center justify-center relative overflow-hidden">
                  <div
                    className="w-24 h-24 rounded-full blur-2xl opacity-35 absolute"
                    style={{ backgroundColor: v.defaultColor }}
                  />
                  <svg viewBox="0 0 180 76" className="w-40 h-20 relative z-10 drop-shadow-lg group-hover:scale-105 transition-transform">
                    <ellipse cx="90" cy="64" rx="68" ry="6" fill="rgba(0,0,0,0.55)" />
                    <path
                      d={
                        v.id === 'suv' || v.id === 'offroad'
                          ? 'M22 50 L28 32 L54 28 L72 16 L128 16 L146 32 L162 36 L160 52 Z'
                          : v.id === 'hatchback'
                            ? 'M24 52 L28 32 L58 28 L80 18 L130 18 L148 36 L156 52 Z'
                            : 'M18 52 L26 36 L60 32 L82 19 L126 19 L146 35 L164 42 L162 52 Z'
                      }
                      fill={v.defaultColor}
                      stroke="rgba(255,255,255,0.45)"
                      strokeWidth="1.5"
                    />
                    <path
                      d="M66 30 L84 21 L122 21 L136 33 Z"
                      fill="#0F172A"
                      opacity="0.82"
                    />
                    <circle cx="48" cy="54" r="11" fill="#0F172A" stroke="#94A3B8" strokeWidth="2.5" />
                    <circle cx="48" cy="54" r="5" fill="#E2E8F0" />
                    <circle cx="134" cy="54" r="11" fill="#0F172A" stroke="#94A3B8" strokeWidth="2.5" />
                    <circle cx="134" cy="54" r="5" fill="#E2E8F0" />
                  </svg>
                </div>

                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="font-mono-tech text-xs font-bold uppercase tracking-wider text-[var(--studio-accent-text)]">
                    {v.category}
                  </span>
                  <span className="font-mono-tech text-xs font-bold text-[var(--studio-text-muted)] tabular-nums">
                    ${v.startingBudget.toLocaleString()}
                  </span>
                </div>
                <h3 className="font-heading font-bold text-lg text-[var(--studio-text)] group-hover:text-[var(--studio-accent-text)] transition-colors">
                  {v.name}
                </h3>
                <p className="text-xs text-[var(--studio-text-secondary)] mt-1 leading-relaxed">
                  {v.description}
                </p>
              </div>

              <div className="pt-3 border-t border-[var(--studio-border)] flex items-center justify-between text-xs font-sora font-bold text-[var(--studio-accent-text)]">
                <span>Launch 3D Studio</span>
                <span className="group-hover:translate-x-1 transition-transform">→</span>
              </div>
            </button>
          ))}
        </div>

        {/* Saved Garage Strip */}
        {savedCars.length > 0 && (
          <div className="studio-card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-heading font-bold text-lg text-[var(--studio-text)]">
                My Garage Creations
              </h2>
              <span className="font-mono-tech text-xs font-bold text-[var(--studio-text-muted)]">
                {savedCars.length} saved
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {savedCars.map((c) => (
                <div
                  key={c.id}
                  className="p-3.5 studio-well flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {c.previewDataUrl ? (
                      <img
                        src={c.previewDataUrl}
                        alt={c.title}
                        className="w-16 h-12 rounded-lg object-cover border border-[var(--studio-border-strong)] shrink-0"
                      />
                    ) : (
                      <div className="w-16 h-12 rounded-lg bg-[#2563EB] text-white flex items-center justify-center shrink-0 font-mono-tech text-xs font-bold">
                        3D
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="font-sora font-bold text-sm text-[var(--studio-text)] truncate">
                        {c.title}
                      </div>
                      <div className="font-mono-tech text-[11px] font-bold text-[var(--studio-accent-text)]">
                        Rating {c.designRating}/100 · ${c.estimatedCost.toLocaleString()}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleLoadSavedCar(c)}
                      className="studio-btn studio-btn-primary text-xs px-2.5 py-1.5 min-h-[32px]"
                    >
                      Open
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDeleteSavedCar(c.id)}
                      aria-label={`Delete ${c.title}`}
                      className="studio-btn studio-btn-ghost text-xs p-2 min-h-[32px] text-[var(--studio-rose-text)]"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  /* ============================================================
     STAGE 2: FULL-SCREEN 3D CUSTOMIZATION STUDIO
     ============================================================ */
  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col bg-[#050813] text-slate-100">
      {/* Top Studio Control Toolbar */}
      <div className="border-b border-cyan-500/20 bg-[#080E20] px-3 sm:px-5 py-2.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={() => {
              arcadeAudio.playSfx('click');
              setStage('garage');
            }}
            className="studio-btn studio-btn-ghost text-xs px-2.5 py-1.5 min-h-[36px]"
          >
            <ArrowLeft size={14} />
            <span className="hidden sm:inline">Garage</span>
          </button>

          <input
            type="text"
            value={carName}
            onChange={(e) => setCarName(e.target.value)}
            maxLength={48}
            aria-label="Vehicle project name"
            className="studio-input px-2.5 py-1.5 text-sm font-heading font-bold w-36 sm:w-52 bg-[#0D162D]"
          />

          <select
            aria-label="Switch base vehicle"
            value={config.vehicleId}
            onChange={(e) => selectVehicle(e.target.value as VehicleTypeId)}
            className="hidden md:block studio-input px-2.5 py-1.5 text-xs bg-[#0D162D]"
          >
            {VEHICLE_PRESETS.map((v) => (
              <option key={v.id} value={v.id}>
                {v.category}: {v.name}
              </option>
            ))}
          </select>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={() => {
              arcadeAudio.playSfx('click');
              setCompareBefore((v) => !v);
            }}
            className={`studio-btn text-xs px-2.5 py-1.5 min-h-[36px] ${
              compareBefore ? 'bg-amber-500/25 border-amber-400 text-amber-200' : 'studio-btn-ghost'
            }`}
          >
            <Columns2 size={14} />
            <span>{compareBefore ? 'Showing Stock' : 'Before / After'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              arcadeAudio.playSfx('click');
              setConfig(createRandomBuild(config.vehicleId));
              setCompareBefore(false);
            }}
            className="studio-btn studio-btn-ghost text-xs px-2.5 py-1.5 min-h-[36px]"
          >
            <Shuffle size={14} />
            <span className="hidden sm:inline">Random</span>
          </button>

          <button
            type="button"
            onClick={() => {
              arcadeAudio.playSfx('click');
              setConfig(createInitialBuild(config.vehicleId));
              setCompareBefore(false);
            }}
            className="studio-btn studio-btn-ghost text-xs px-2.5 py-1.5 min-h-[36px]"
          >
            <RotateCcw size={14} />
            <span className="hidden sm:inline">Reset</span>
          </button>

          <button
            type="button"
            onClick={handleExportPng}
            className="studio-btn studio-btn-ghost text-xs px-2.5 py-1.5 min-h-[36px]"
          >
            <Camera size={14} />
            <span className="hidden md:inline">Export PNG</span>
          </button>

          <button
            type="button"
            disabled={saving}
            onClick={() => void handleSaveCar()}
            className="studio-btn studio-btn-primary text-xs px-3 py-1.5 min-h-[36px]"
          >
            <Save size={14} />
            <span>{saving ? 'Saving...' : 'Save My Car'}</span>
          </button>
        </div>
      </div>

      {/* Main Split Studio Workspace */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 min-h-[600px]">
        {/* Left/Center: 3D WebGL Viewport + Live Specs HUD (NO backdrop-blur over WebGL canvas) */}
        <div className="lg:col-span-8 relative min-h-[380px] sm:min-h-[480px] lg:min-h-full bg-[#060A17] flex flex-col">
          {webglFailed ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-4">
              <div className="font-heading text-xl font-bold text-cyan-300">2D Precision Blueprint View</div>
              <p className="text-xs text-slate-400 max-w-md">
                WebGL is unavailable on this browser session. Live 2D engineering preview & full telemetry remain active.
              </p>
              <svg viewBox="0 0 360 150" className="w-full max-w-lg">
                <rect width="360" height="150" rx="16" fill="#0B1328" stroke="#1E293B" />
                <line x1="20" y1="122" x2="340" y2="122" stroke="#334155" strokeWidth="2" />
                <path
                  d="M44 102 L58 70 L118 60 L158 38 L244 38 L280 68 L314 82 L310 104 Z"
                  fill={displayConfig.bodyColor}
                  stroke="#FFFFFF"
                  strokeWidth="2"
                />
                <circle cx="102" cy="106" r="21" fill="#0F172A" stroke={displayConfig.rimColor} strokeWidth="4" />
                <circle cx="262" cy="106" r="21" fill="#0F172A" stroke={displayConfig.rimColor} strokeWidth="4" />
              </svg>
            </div>
          ) : (
            <div
              ref={mountRef}
              className="w-full h-full min-h-[380px] sm:min-h-[480px] flex-1 touch-none cursor-grab active:cursor-grabbing"
              aria-label="Interactive 3D car viewport. Drag to rotate and scroll to zoom."
            />
          )}

          {/* Top-Left Live Vehicle Telemetry Overlay (Solid dark surface — zero backdrop-blur) */}
          <div className="absolute top-3 left-3 bg-[#080E20]/92 border border-cyan-500/30 rounded-xl px-3.5 py-2.5 max-w-[290px] pointer-events-none">
            <div className="flex items-center justify-between gap-3">
              <span className="font-mono-tech text-[10px] uppercase tracking-wider text-cyan-300">
                {telemetry.preset.category}
              </span>
              <span className="font-mono-tech text-xs font-bold text-emerald-300 tabular-nums">
                RATING {telemetry.designRating}/100
              </span>
            </div>
            <div className="font-heading font-bold text-base text-white truncate">
              {carName || telemetry.preset.name}
            </div>
            <div className="grid grid-cols-3 gap-2 mt-2 pt-2 border-t border-white/10 font-mono-tech text-[10px] text-slate-300 tabular-nums">
              <div>
                <div className="text-slate-400">BUDGET</div>
                <div className="text-white font-bold">${telemetry.totalEstimatedValue.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-slate-400">MODS</div>
                <div className="text-cyan-300 font-bold">{telemetry.modCount} parts</div>
              </div>
              <div>
                <div className="text-slate-400">DRAG Cd</div>
                <div className="text-purple-300 font-bold">{telemetry.dragCoefficient}</div>
              </div>
            </div>
          </div>

          {/* Toast Feedback Banner */}
          {toast && (
            <div className="absolute top-3 right-3 bg-emerald-950/95 border border-emerald-400/60 text-emerald-100 px-3.5 py-2 rounded-xl text-xs font-sora flex items-center gap-2 shadow-xl">
              <Check size={14} className="text-emerald-400" />
              <span>{toast}</span>
            </div>
          )}

          {/* Bottom Camera Presets & Turntable Bar */}
          <div className="absolute bottom-3 left-3 right-3 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
            <div className="flex flex-wrap items-center gap-1.5 bg-[#080E20]/92 border border-white/15 rounded-xl p-1.5 pointer-events-auto">
              {(
                [
                  { id: 'hero', label: '3/4 View' },
                  { id: 'front', label: 'Front' },
                  { id: 'side', label: 'Side' },
                  { id: 'rear', label: 'Rear' },
                  { id: 'top', label: 'Top' },
                ] as const
              ).map((cam) => (
                <button
                  key={cam.id}
                  type="button"
                  onClick={() => setCameraView(cam.id)}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-mono-tech text-slate-200 hover:bg-cyan-500/20 hover:text-cyan-200 cursor-pointer transition-colors"
                >
                  {cam.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => {
                arcadeAudio.playSfx('click');
                setAutoSpin((v) => !v);
              }}
              className={`pointer-events-auto px-3 py-1.5 rounded-xl border text-xs font-mono-tech cursor-pointer transition-colors ${
                autoSpin
                  ? 'bg-cyan-500/25 border-cyan-400 text-cyan-200'
                  : 'bg-[#080E20]/92 border-white/15 text-slate-300 hover:border-cyan-400/40'
              }`}
            >
              {autoSpin ? 'Turntable: ON' : 'Turntable: OFF'}
            </button>
          </div>
        </div>

        {/* Right Panel: 13 Customization Categories, Engineering Lab, Environments, Garage */}
        <aside className="lg:col-span-4 border-t lg:border-t-0 lg:border-l border-cyan-500/20 bg-[#080E20] flex flex-col max-h-[580px] lg:max-h-[calc(100vh-8rem)]">
          {/* Primary Studio Panel Switcher */}
          <div className="grid grid-cols-4 border-b border-white/10 p-1.5 gap-1 bg-[#060A17]">
            {(
              [
                { id: 'customize', label: 'Customize', icon: <Wrench size={14} /> },
                { id: 'engineering', label: 'Eng. Lab', icon: <Cpu size={14} /> },
                { id: 'environment', label: 'Scene', icon: <Sun size={14} /> },
                { id: 'saved', label: `Garage (${savedCars.length})`, icon: <FolderOpen size={14} /> },
              ] as const
            ).map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  arcadeAudio.playSfx('click');
                  setPanelMode(m.id);
                }}
                className={`py-2 px-1.5 rounded-lg text-[11px] font-sora font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                  panelMode === m.id
                    ? 'bg-gradient-to-r from-blue-600/30 to-cyan-500/25 text-cyan-200 border border-cyan-400/40'
                    : 'text-slate-400 hover:text-white border border-transparent'
                }`}
              >
                {m.icon}
                <span className="truncate">{m.label}</span>
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto studio-scroll p-4 space-y-4">
            {/* PANEL 1: 13 LIVE CUSTOMIZATION CATEGORIES */}
            {panelMode === 'customize' && (
              <>
                <div className="flex gap-1.5 overflow-x-auto pb-2 studio-scroll">
                  {CUSTOMIZATION_CATEGORIES.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => {
                        arcadeAudio.playSfx('click');
                        setActiveTab(cat.id);
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-sora font-medium whitespace-nowrap cursor-pointer border transition-colors ${
                        activeTab === cat.id
                          ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200'
                          : 'bg-slate-900/80 border-white/10 text-slate-300 hover:border-cyan-400/40'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>

                {activeTab === 'color' && (
                  <div className="space-y-4">
                    <div className="font-mono-tech text-xs text-cyan-300 uppercase">Body Paint Color</div>
                    <div className="grid grid-cols-5 gap-2.5">
                      {PAINT_COLORS.map((c) => (
                        <button
                          key={c.hex}
                          type="button"
                          onClick={() => {
                            arcadeAudio.playSfx('click');
                            setConfig((p) => ({ ...p, bodyColor: c.hex }));
                          }}
                          title={c.name}
                          className={`h-11 rounded-xl border-2 cursor-pointer transition-transform hover:scale-105 ${
                            config.bodyColor.toLowerCase() === c.hex.toLowerCase()
                              ? 'border-white ring-2 ring-cyan-400'
                              : 'border-white/20'
                          }`}
                          style={{ backgroundColor: c.hex }}
                        />
                      ))}
                    </div>
                    <div className="p-3 rounded-xl bg-slate-900/70 border border-white/10 flex items-center justify-between">
                      <span className="text-xs font-sora text-slate-300">Custom Studio Color Picker</span>
                      <input
                        type="color"
                        value={config.bodyColor}
                        onChange={(e) => setConfig((p) => ({ ...p, bodyColor: e.target.value }))}
                        aria-label="Custom body paint color"
                        className="w-10 h-8 rounded cursor-pointer bg-transparent border-0"
                      />
                    </div>
                  </div>
                )}

                {activeTab === 'finish' && (
                  <div className="grid grid-cols-2 gap-2.5">
                    {(
                      [
                        { id: 'gloss', name: 'Deep Gloss', desc: 'Mirror clearcoat reflection' },
                        { id: 'matte', name: 'Satin Matte', desc: 'Stealth low-sheen finish' },
                        { id: 'metallic', name: 'Liquid Metallic', desc: 'High flake metallic depth' },
                        { id: 'pearl', name: 'Iridescent Pearl', desc: 'Dual-tone spectral shift' },
                      ] as Array<{ id: PaintFinish; name: string; desc: string }>
                    ).map((opt) => (
                      <OptionButton
                        key={opt.id}
                        active={config.paintFinish === opt.id}
                        title={opt.name}
                        subtitle={opt.desc}
                        onClick={() => setConfig((p) => ({ ...p, paintFinish: opt.id }))}
                      />
                    ))}
                  </div>
                )}

                {activeTab === 'wheels' && (
                  <div className="space-y-4">
                    <div className="p-3.5 rounded-xl bg-slate-900/70 border border-white/10 space-y-2">
                      <div className="flex justify-between text-xs font-mono-tech">
                        <span className="text-slate-300">WHEEL SIZE</span>
                        <span className="text-cyan-300">{Math.round(config.wheelScale * 19)} in</span>
                      </div>
                      <input
                        type="range"
                        min={0.9}
                        max={1.18}
                        step={0.02}
                        value={config.wheelScale}
                        onChange={(e) => setConfig((p) => ({ ...p, wheelScale: Number(e.target.value) }))}
                        className="w-full accent-cyan-400"
                      />
                    </div>
                    <div className="font-mono-tech text-xs text-cyan-300 uppercase">Rim Alloy Finish</div>
                    <div className="grid grid-cols-3 gap-2">
                      {RIM_COLORS.map((rc) => (
                        <button
                          key={rc.hex}
                          type="button"
                          onClick={() => {
                            arcadeAudio.playSfx('click');
                            setConfig((p) => ({ ...p, rimColor: rc.hex }));
                          }}
                          className={`p-2 rounded-xl border text-xs font-sora flex items-center gap-2 cursor-pointer ${
                            config.rimColor === rc.hex
                              ? 'border-cyan-400 bg-cyan-500/15 text-white'
                              : 'border-white/10 bg-slate-900/70 text-slate-300'
                          }`}
                        >
                          <span className="w-4 h-4 rounded-full border border-white/30 shrink-0" style={{ backgroundColor: rc.hex }} />
                          <span className="truncate">{rc.name.split(' ')[0]}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {activeTab === 'rims' && (
                  <div className="grid grid-cols-1 gap-2.5">
                    {(
                      [
                        { id: 'twin-5', name: 'Twin 5-Spoke Forged', desc: 'Balanced lightweight street alloy' },
                        { id: 'multi-10', name: 'Multi-10 Touring', desc: 'Executive precision multi-spoke' },
                        { id: 'turbofan', name: 'Aero Turbofan Disc', desc: 'Closed vane vortex drag reduction' },
                        { id: 'deep-mesh', name: 'Deep-Dish Mesh', desc: 'Wide staggered muscle stance' },
                        { id: 'offroad-bead', name: 'Beadlock Trail 6', desc: 'Heavy-duty reinforced outer bolts' },
                      ] as Array<{ id: RimDesign; name: string; desc: string }>
                    ).map((opt) => (
                      <OptionButton
                        key={opt.id}
                        active={config.rimDesign === opt.id}
                        title={opt.name}
                        subtitle={opt.desc}
                        onClick={() => setConfig((p) => ({ ...p, rimDesign: opt.id }))}
                      />
                    ))}
                  </div>
                )}

                {activeTab === 'spoilers' && (
                  <div className="grid grid-cols-1 gap-2.5">
                    {(
                      [
                        { id: 'none', name: 'Clean Decklid', desc: 'Minimalist smooth airflow' },
                        { id: 'lip', name: 'Carbon Trunk Lip', desc: 'Subtle clean boundary separation' },
                        { id: 'ducktail', name: 'Integrated Ducktail', desc: 'Classic sculpted rear kick-up' },
                        { id: 'gt-wing', name: 'Track GT Wing', desc: 'High rear axle downforce foil' },
                        { id: 'twin-swan', name: 'Swan-Neck Aero Wing', desc: 'Motorsport top-mount efficiency' },
                      ] as Array<{ id: SpoilerStyle; name: string; desc: string }>
                    ).map((opt) => (
                      <OptionButton
                        key={opt.id}
                        active={config.spoiler === opt.id}
                        title={opt.name}
                        subtitle={opt.desc}
                        onClick={() => setConfig((p) => ({ ...p, spoiler: opt.id }))}
                      />
                    ))}
                  </div>
                )}

                {activeTab === 'front-bumper' && (
                  <div className="grid grid-cols-1 gap-2.5">
                    {(
                      [
                        { id: 'stock', name: 'Factory Clean Fascia', desc: 'Standard production cooling intake' },
                        { id: 'sport-splitter', name: 'Carbon Front Splitter', desc: 'Reduces front lift at speed' },
                        { id: 'track-canards', name: 'Track Splitter + Canards', desc: 'Twin dive-plane cornering grip' },
                        { id: 'bullbar', name: 'Off-Road Armor Bar', desc: 'High clearance protection guard' },
                      ] as Array<{ id: FrontBumperStyle; name: string; desc: string }>
                    ).map((opt) => (
                      <OptionButton
                        key={opt.id}
                        active={config.frontBumper === opt.id}
                        title={opt.name}
                        subtitle={opt.desc}
                        onClick={() => setConfig((p) => ({ ...p, frontBumper: opt.id }))}
                      />
                    ))}
                  </div>
                )}

                {activeTab === 'rear-bumper' && (
                  <div className="grid grid-cols-1 gap-2.5">
                    {(
                      [
                        { id: 'stock', name: 'Clean Rear Valance', desc: 'Simple factory bumper silhouette' },
                        { id: 'twin-exhaust', name: 'Twin Chrome Exhaust', desc: 'Balanced dual outlet diffuser' },
                        { id: 'quad-diffuser', name: 'Quad Strake Diffuser', desc: 'Underbody venturi channels + 4 pipes' },
                        { id: 'skid-plate', name: 'Steel Trail Skid Plate', desc: 'Angled departure clearance plate' },
                      ] as Array<{ id: RearBumperStyle; name: string; desc: string }>
                    ).map((opt) => (
                      <OptionButton
                        key={opt.id}
                        active={config.rearBumper === opt.id}
                        title={opt.name}
                        subtitle={opt.desc}
                        onClick={() => setConfig((p) => ({ ...p, rearBumper: opt.id }))}
                      />
                    ))}
                  </div>
                )}

                {activeTab === 'headlights' && (
                  <div className="grid grid-cols-2 gap-2.5">
                    {(
                      [
                        { id: 'halos', name: 'Twin Halo Rings', desc: 'Signature circular DRLs' },
                        { id: 'matrix-led', name: 'Matrix LED Cubes', desc: 'Triple adaptive projector array' },
                        { id: 'laser-blade', name: 'Cyan Laser Blades', desc: 'Sharp futuristic light bars' },
                        { id: 'amber-rally', name: 'Amber Rally Pods', desc: 'Fog-piercing auxiliary lamps' },
                      ] as Array<{ id: HeadlightStyle; name: string; desc: string }>
                    ).map((opt) => (
                      <OptionButton
                        key={opt.id}
                        active={config.headlights === opt.id}
                        title={opt.name}
                        subtitle={opt.desc}
                        onClick={() => setConfig((p) => ({ ...p, headlights: opt.id }))}
                      />
                    ))}
                  </div>
                )}

                {activeTab === 'taillights' && (
                  <div className="grid grid-cols-2 gap-2.5">
                    {(
                      [
                        { id: 'classic-red', name: 'Classic Ruby Block', desc: 'Bold traditional housing' },
                        { id: 'full-lightbar', name: 'Coast-to-Coast Bar', desc: 'Continuous horizon LED strip' },
                        { id: 'oled-blade', name: 'OLED 3D Fins', desc: 'Layered vertical blades' },
                        { id: 'smoked-sport', name: 'Smoked Stealth', desc: 'Dark-tinted housing' },
                      ] as Array<{ id: TaillightStyle; name: string; desc: string }>
                    ).map((opt) => (
                      <OptionButton
                        key={opt.id}
                        active={config.taillights === opt.id}
                        title={opt.name}
                        subtitle={opt.desc}
                        onClick={() => setConfig((p) => ({ ...p, taillights: opt.id }))}
                      />
                    ))}
                  </div>
                )}

                {activeTab === 'windows' && (
                  <div className="grid grid-cols-2 gap-2.5">
                    {(
                      [
                        { id: 'clear', name: 'Crystal Clear', desc: 'Full view of interior cabin' },
                        { id: 'light-smoke', name: 'Solar Smoke', desc: 'Subtle UV studio tint' },
                        { id: 'midnight-tint', name: 'Limo Privacy', desc: 'Deep dark blackout glass' },
                        { id: 'iridescent-blue', name: 'Glacier Blue Coat', desc: 'Acoustic reflective tint' },
                      ] as Array<{ id: WindowTintStyle; name: string; desc: string }>
                    ).map((opt) => (
                      <OptionButton
                        key={opt.id}
                        active={config.windowTint === opt.id}
                        title={opt.name}
                        subtitle={opt.desc}
                        onClick={() => setConfig((p) => ({ ...p, windowTint: opt.id }))}
                      />
                    ))}
                  </div>
                )}

                {activeTab === 'decals' && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 gap-2">
                      {(
                        [
                          { id: 'none', name: 'No Graphics', desc: 'Pure uninterrupted bodywork' },
                          { id: 'racing-stripes', name: 'Twin Center Stripes', desc: 'Classic motorsport over-the-top stripes' },
                          { id: 'side-livery', name: 'Side Belt Stripe', desc: 'Horizontal dynamic speed band' },
                          { id: 'aero-number', name: 'Track Hood Roundel', desc: 'Motorsport competition bonnet circle' },
                          { id: 'cyber-circuit', name: 'Cyber Vector Slash', desc: 'Angular concept studio graphics' },
                        ] as Array<{ id: DecalStyle; name: string; desc: string }>
                      ).map((opt) => (
                        <OptionButton
                          key={opt.id}
                          active={config.decal === opt.id}
                          title={opt.name}
                          subtitle={opt.desc}
                          onClick={() => setConfig((p) => ({ ...p, decal: opt.id }))}
                        />
                      ))}
                    </div>
                    {config.decal !== 'none' && (
                      <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900/70 border border-white/10">
                        <span className="text-xs font-sora text-slate-300">Decal Accent Color</span>
                        <input
                          type="color"
                          value={config.decalColor}
                          onChange={(e) => setConfig((p) => ({ ...p, decalColor: e.target.value }))}
                          className="w-9 h-7 rounded cursor-pointer bg-transparent border-0"
                        />
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'body-kits' && (
                  <div className="grid grid-cols-1 gap-2.5">
                    {(
                      [
                        { id: 'factory', name: 'Factory Body', desc: 'Original clean fender arches' },
                        { id: 'street-skirts', name: 'Sport Side Skirts', desc: 'Color-matched lower aero sills' },
                        { id: 'widebody-flares', name: 'Widebody Overfenders', desc: 'Bolted arch flares + wider stance' },
                        { id: 'aero-gt', name: 'Carbon Aero GT Package', desc: 'Paint-matched flares + carbon sills' },
                      ] as Array<{ id: BodyKitStyle; name: string; desc: string }>
                    ).map((opt) => (
                      <OptionButton
                        key={opt.id}
                        active={config.bodyKit === opt.id}
                        title={opt.name}
                        subtitle={opt.desc}
                        onClick={() => setConfig((p) => ({ ...p, bodyKit: opt.id }))}
                      />
                    ))}
                  </div>
                )}

                {activeTab === 'interior' && (
                  <div className="space-y-3">
                    <p className="text-xs text-slate-400">
                      Tip: Set Windows to Crystal Clear or Solar Smoke and zoom in to inspect your cabin seats, dash, and steering wheel.
                    </p>
                    <div className="grid grid-cols-2 gap-2.5">
                      {(
                        [
                          { id: 'obsidian', name: 'Obsidian Cloth', desc: 'Graphite sport cabin' },
                          { id: 'crimson-sport', name: 'Crimson Bucket', desc: 'Race-inspired red bolsters' },
                          { id: 'tan-luxury', name: 'Cognac Leather', desc: 'Grand tourer warm tan trim' },
                          { id: 'cyber-cyan', name: 'Neon Concept', desc: 'Cyan stitched bolsters' },
                        ] as Array<{ id: InteriorTheme; name: string; desc: string }>
                      ).map((opt) => (
                        <OptionButton
                          key={opt.id}
                          active={config.interior === opt.id}
                          title={opt.name}
                          subtitle={opt.desc}
                          onClick={() => setConfig((p) => ({ ...p, interior: opt.id }))}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* PANEL 2: SUSPENSION & ENGINEERING LAB */}
            {panelMode === 'engineering' && (
              <div className="space-y-4">
                <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-400/25 text-xs text-cyan-100 leading-relaxed">
                  <strong>Educational Engineering Lab:</strong> Simulated physics parameters illustrate how ride height, wheel diameter, mass, and powertrain packaging trade off in automotive design.
                </div>

                {/* Suspension Height Slider */}
                <div className="p-3.5 rounded-xl bg-slate-900/70 border border-white/10 space-y-2">
                  <div className="flex justify-between text-xs font-mono-tech">
                    <span className="text-slate-300 flex items-center gap-1.5">
                      <Sliders size={13} className="text-cyan-400" /> RIDE HEIGHT
                    </span>
                    <span className="text-cyan-300">
                      {config.suspensionOffsetMm > 0 ? `+${config.suspensionOffsetMm}` : config.suspensionOffsetMm} mm
                    </span>
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
                  <div className="text-[11px] text-slate-400">
                    Lowering cuts underbody turbulence; raising improves off-road breakover clearance.
                  </div>
                </div>

                {/* Powertrain Comparison + Engine Bay X-Ray */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono-tech text-xs text-cyan-300 uppercase">Powertrain Architecture</span>
                    <button
                      type="button"
                      onClick={() => {
                        arcadeAudio.playSfx('click');
                        setConfig((p) => ({ ...p, engineBayOpen: !p.engineBayOpen }));
                      }}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-mono-tech border cursor-pointer ${
                        config.engineBayOpen
                          ? 'bg-cyan-500/25 border-cyan-400 text-cyan-200'
                          : 'bg-slate-900 border-white/15 text-slate-300'
                      }`}
                    >
                      {config.engineBayOpen ? 'X-Ray Bay: ON' : 'Inspect Engine/EV Bay'}
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {(
                      [
                        { id: 'ev', label: 'Dual-Motor EV' },
                        { id: 'hybrid', label: 'Perf. Hybrid' },
                        { id: 'petrol-v8', label: 'Petrol V8' },
                      ] as Array<{ id: PowertrainType; label: string }>
                    ).map((pt) => (
                      <button
                        key={pt.id}
                        type="button"
                        onClick={() => {
                          arcadeAudio.playSfx('click');
                          setConfig((p) => ({ ...p, powertrain: pt.id }));
                        }}
                        className={`p-2.5 rounded-xl border text-xs font-sora font-semibold cursor-pointer ${
                          config.powertrain === pt.id
                            ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200'
                            : 'bg-slate-900/70 border-white/10 text-slate-300'
                        }`}
                      >
                        {pt.label}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400">{telemetry.rangeOrEfficiencyNote}</p>
                </div>

                {/* Chassis Weight Concept */}
                <div className="space-y-2">
                  <span className="font-mono-tech text-xs text-cyan-300 uppercase">Chassis Material Concept</span>
                  <div className="grid grid-cols-1 gap-2">
                    {(
                      [
                        { id: 'lightweight-carbon', name: 'Carbon Monocoque (-145 kg)', desc: 'Higher agility & faster transient response' },
                        { id: 'balanced-alloy', name: 'Aluminum Alloy (Balanced)', desc: 'Ideal daily stiffness-to-cost ratio' },
                        { id: 'heavy-duty', name: 'Reinforced Steel (+165 kg)', desc: 'Rugged utility durability' },
                      ] as Array<{ id: WeightConcept; name: string; desc: string }>
                    ).map((w) => (
                      <OptionButton
                        key={w.id}
                        active={config.weightConcept === w.id}
                        title={w.name}
                        subtitle={w.desc}
                        onClick={() => setConfig((p) => ({ ...p, weightConcept: w.id }))}
                      />
                    ))}
                  </div>
                </div>

                {/* Engineering Summary Metrics */}
                <div className="grid grid-cols-3 gap-2 p-3 rounded-xl bg-slate-900/90 border border-white/10 font-mono-tech text-xs tabular-nums">
                  <div>
                    <div className="text-[10px] text-slate-400">AERO INDEX</div>
                    <div className="text-cyan-300 font-bold">{telemetry.aeroScore}/100</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400">STANCE</div>
                    <div className="text-purple-300 font-bold">{telemetry.stanceScore}/100</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400">EST. MASS</div>
                    <div className="text-white font-bold">{telemetry.effectiveWeightKg} kg</div>
                  </div>
                </div>
              </div>
            )}

            {/* PANEL 3: ENVIRONMENTS */}
            {panelMode === 'environment' && (
              <div className="space-y-3">
                <div className="font-mono-tech text-xs text-cyan-300 uppercase">3D Showcase Lighting & Backdrop</div>
                {ENVIRONMENT_OPTIONS.map((env) => (
                  <OptionButton
                    key={env.id}
                    active={config.environment === env.id}
                    title={env.name}
                    subtitle={env.desc}
                    onClick={() => setConfig((p) => ({ ...p, environment: env.id }))}
                  />
                ))}
              </div>
            )}

            {/* PANEL 4: SAVED GARAGE */}
            {panelMode === 'saved' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono-tech text-xs text-cyan-300 uppercase">Saved Builds</span>
                  <button
                    type="button"
                    onClick={() => void handleSaveCar()}
                    className="text-xs font-sora text-cyan-300 hover:underline cursor-pointer flex items-center gap-1"
                  >
                    <Sparkles size={12} /> Save Current
                  </button>
                </div>
                {savedCars.length === 0 ? (
                  <div className="p-6 text-center rounded-xl bg-slate-900/60 border border-white/10 text-xs text-slate-400">
                    No saved builds yet. Click <strong>Save My Car</strong> above to keep your designs!
                  </div>
                ) : (
                  savedCars.map((c) => (
                    <div
                      key={c.id}
                      className="p-3 rounded-xl bg-slate-900/75 border border-white/10 flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="font-sora font-semibold text-sm text-white truncate">{c.title}</div>
                        <div className="font-mono-tech text-[10px] text-cyan-300">
                          Rating {c.designRating}/100 · ${c.estimatedCost.toLocaleString()}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleLoadSavedCar(c)}
                          className="studio-btn studio-btn-primary text-[11px] px-2.5 py-1 min-h-[30px]"
                        >
                          Load
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDeleteSavedCar(c.id)}
                          aria-label={`Delete ${c.title}`}
                          className="studio-btn studio-btn-ghost p-1.5 min-h-[30px] text-rose-400"
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

          {/* Persistent Bottom Spec Footer */}
          <div className="border-t border-white/10 bg-[#060A17] px-4 py-2.5 flex items-center justify-between text-xs font-mono-tech">
            <span className="flex items-center gap-1.5 text-slate-300">
              <Gauge size={14} className="text-cyan-400" />
              Rating <strong className="text-emerald-300">{telemetry.designRating}</strong>/100
            </span>
            <span className="text-cyan-300 font-bold tabular-nums">
              ${telemetry.totalEstimatedValue.toLocaleString()}
            </span>
          </div>
        </aside>
      </div>
    </div>
  );
};

interface OptionButtonProps {
  active: boolean;
  title: string;
  subtitle: string;
  onClick: () => void;
}

const OptionButton: React.FC<OptionButtonProps> = ({ active, title, subtitle, onClick }) => (
  <button
    type="button"
    onClick={() => {
      arcadeAudio.playSfx('click');
      onClick();
    }}
    className={`w-full text-left p-3 rounded-xl border cursor-pointer transition-all ${
      active
        ? 'bg-cyan-500/18 border-cyan-400 text-white shadow-[0_0_20px_-8px_rgba(34,211,238,0.5)]'
        : 'bg-slate-900/65 border-white/10 text-slate-200 hover:border-cyan-400/40'
    }`}
  >
    <div className="font-sora font-semibold text-xs sm:text-sm flex items-center justify-between gap-2">
      <span>{title}</span>
      {active && <Check size={14} className="text-cyan-300 shrink-0" />}
    </div>
    <div className="text-[11px] text-slate-400 mt-0.5">{subtitle}</div>
  </button>
);

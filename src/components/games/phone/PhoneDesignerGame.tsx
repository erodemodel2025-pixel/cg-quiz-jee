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
  HelpCircle,
  Layers,
  Lock,
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
import type { GameModeId, SavedCreation } from '../../../../shared/types.ts';
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
import { buildPhoneGroup, type PhoneRigHandles } from './phoneBuilder3d.ts';
import {
  ASSEMBLY_SEQUENCE,
  createInitialPhoneState,
  createRandomPhoneState,
  evaluatePhoneEngineering,
  normalizePhoneState,
  PHONE_BAY_OPTIONS,
  PHONE_CHALLENGES,
  PHONE_COLORS,
  PHONE_WALLPAPERS,
  type PhoneBayConfig,
  type PhoneBayId,
  type PhoneCaseStyle,
  type PhoneDesignState,
  type PhoneInspectionViewMode,
  type PhoneSizePreset,
} from './phoneCatalog.ts';
import {
  PHONE_COMPONENT_MAP,
  PHONE_ENGINEERING_COMPONENTS,
  PHONE_SUBSYSTEMS,
  type PhoneSubsystemId,
} from './phoneEngineeringData.ts';
import { PhoneTestLabModal } from './PhoneTestLabModal.tsx';

interface PhoneDesignerGameProps {
  onExit: () => void;
  initialDesign?: Partial<PhoneDesignState> | null;
  initialCreationId?: string | null;
  initialOpenTestLab?: boolean;
  onOpenLeaderboard?: (gameId: GameModeId) => void;
  onGoHome?: () => void;
}

type WorkstationTab = 'assemble' | 'telemetry' | 'challenges' | 'components' | 'saved';
type PhoneCameraPreset = 'hero' | 'front' | 'rear' | 'side' | 'top' | 'internals';

const CAMERA_PRESETS: Record<
  PhoneCameraPreset,
  { pos: [number, number, number]; target: [number, number, number] }
> = {
  hero: { pos: [1.45, 0.55, -1.85], target: [0, 0, -0.1] },
  front: { pos: [0.0, 0.05, 2.15], target: [0, 0, 0] },
  rear: { pos: [0.0, 0.05, -2.2], target: [0, 0, -0.15] },
  side: { pos: [2.15, 0.08, 0.05], target: [0, 0, -0.12] },
  top: { pos: [0.01, 2.25, 0.25], target: [0, 0, -0.1] },
  internals: { pos: [0.85, 0.35, -1.45], target: [0, 0.04, -0.12] },
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

export const PhoneDesignerGame: React.FC<PhoneDesignerGameProps> = ({
  onExit,
  initialDesign,
  initialCreationId,
  initialOpenTestLab = false,
  onOpenLeaderboard,
  onGoHome,
}) => {
  const { player, graphicsQuality, updateLocalPlayer } = useArcade();
  const isAuthenticated = Boolean(player?.id);
  const userId = getGuestOrUserId(player?.id);

  const [state, setState] = useState<PhoneDesignState>(() => normalizePhoneState(initialDesign));
  const [editingId, setEditingId] = useState<string | undefined>(initialCreationId || undefined);
  const [testLabOpen, setTestLabOpen] = useState(initialOpenTestLab);
  const [flashPulse, setFlashPulse] = useState(false);
  const [chargingActive, setChargingActive] = useState(false);

  const [activeTab, setActiveTab] = useState<WorkstationTab>('assemble');
  const [selectedBay, setSelectedBay] = useState<PhoneBayId>('soc');
  const [guidedAssembly, setGuidedAssembly] = useState(false);
  const [subsystemFilter, setSubsystemFilter] = useState<PhoneSubsystemId>('processing');
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
  const [savedPhones, setSavedPhones] = useState<SavedCreation[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [compatibilityAlert, setCompatibilityAlert] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const telemetry = useMemo(() => evaluatePhoneEngineering(state), [state]);
  const activeChallenge = useMemo(
    () =>
      state.activeChallengeId
        ? PHONE_CHALLENGES.find((c) => c.id === state.activeChallengeId) || null
        : null,
    [state.activeChallengeId]
  );
  const challengeResult = useMemo(
    () => (activeChallenge ? activeChallenge.check(state, telemetry) : null),
    [activeChallenge, state, telemetry]
  );

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => {
      setToast((curr) => (curr === msg ? null : curr));
    }, 3600);
  }, []);

  const refreshSaved = useCallback(async () => {
    const list = await listCreations(userId, 'phone');
    setSavedPhones(list);
  }, [userId]);

  useEffect(() => {
    void refreshSaved();
  }, [refreshSaved]);

  useEffect(() => {
    setSimProgress(loadLocalSimulatorProgress(player?.id));
  }, [player?.id]);

  const openComponentLearning = useCallback(
    (compId: string) => {
      const comp = PHONE_COMPONENT_MAP.get(compId);
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
  const phoneRigRef = useRef<PhoneRigHandles | null>(null);
  const requestRenderRef = useRef<() => void>(() => {});
  const stateRef = useRef(state);
  stateRef.current = state;
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

  const explodeProgressRef = useRef(0);
  const rearRemovedProgressRef = useRef(1);
  const snapPulseRef = useRef<{ bayId: PhoneBayId | null; amp: number }>({ bayId: null, amp: 0 });

  const setCameraView = useCallback((preset: PhoneCameraPreset) => {
    arcadeAudio.playSfx('click');
    const p = CAMERA_PRESETS[preset];
    camTargetGoalRef.current.pos.set(...p.pos);
    camTargetGoalRef.current.target.set(...p.target);
    camTargetGoalRef.current.active = true;
    requestRenderRef.current();
  }, []);

  // Initialize Three.js WebGL CAD Viewport once
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let renderer: THREE.WebGLRenderer;
    let isSoftwareGl = false;
    try {
      isSoftwareGl = detectSoftwareGl();
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        powerPreference: 'high-performance',
        preserveDrawingBuffer: true,
      });
    } catch {
      setWebglFailed(true);
      return;
    }

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    const maxDpr = graphicsQuality === 'low' ? 1 : graphicsQuality === 'medium' ? 1.5 : 2;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, maxDpr));
    renderer.shadowMap.enabled = !isSoftwareGl && graphicsQuality !== 'low';
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const w = Math.max(320, container.clientWidth);
    const h = Math.max(320, container.clientHeight);
    renderer.setSize(w, h);
    container.innerHTML = '';
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#050A18');
    scene.fog = new THREE.Fog('#050A18', 5, 16);
    sceneRef.current = scene;

    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    const camera = new THREE.PerspectiveCamera(40, w / h, 0.1, 40);
    camera.position.set(...CAMERA_PRESETS.hero.pos);
    cameraRef.current = camera;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(...CAMERA_PRESETS.hero.target);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.08;
    controls.minDistance = 0.95;
    controls.maxDistance = 4.6;
    controls.enablePan = true;
    controlsRef.current = controls;

    // 3-Point Studio CAD Lighting
    const hemi = new THREE.HemisphereLight('#E0F2FE', '#0F172A', 1.1);
    scene.add(hemi);
    const keyLight = new THREE.DirectionalLight('#FFFFFF', 2.0);
    keyLight.position.set(2.5, 4.2, 3.0);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.bias = -0.0005;
    scene.add(keyLight);
    const rimLight = new THREE.DirectionalLight('#38BDF8', 1.25);
    rimLight.position.set(-2.5, 1.5, -3.2);
    scene.add(rimLight);

    // Subtle workbench grid floor
    const grid = new THREE.GridHelper(6, 24, '#1E3A8A', '#0F172A');
    grid.position.y = -1.05;
    scene.add(grid);

    // Build initial phone rig
    const maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    const rig = buildPhoneGroup(stateRef.current, { isSoftwareGl, maxAnisotropy: maxAniso });
    phoneRigRef.current = rig;
    scene.add(rig.root);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // Coalesced On-Demand Render Loop with Software WebGL pacing
    let frameId = 0;
    let renderBusy = false;
    let renderDirty = false;
    let lastTs = performance.now();
    let disposed = false;

    const afterDraw = (cb: () => void) => {
      try {
        const gl = renderer.getContext() as WebGL2RenderingContext;
        const sync = gl.fenceSync ? gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0) : null;
        if (sync && gl.flush) {
          gl.flush();
          const poll = () => {
            if (disposed) return;
            const st = gl.getSyncParameter(sync, gl.SYNC_STATUS);
            if (st === gl.UNSIGNALED) {
              frameId = window.setTimeout(poll, 5);
            } else {
              gl.deleteSync(sync);
              frameId = window.setTimeout(cb, 80);
            }
          };
          frameId = window.setTimeout(poll, 5);
          return;
        }
      } catch {
        // fallback below
      }
      frameId = window.setTimeout(cb, 80);
    };

    const requestRender = () => {
      if (disposed) return;
      if (renderBusy) {
        renderDirty = true;
        return;
      }
      renderBusy = true;
      frameId = requestAnimationFrame((now) => {
        if (disposed) return;
        const dt = Math.min(0.05, Math.max(0.001, (now - lastTs) / 1000));
        lastTs = now;
        renderDirty = false;

        let keepAnimating = false;

        // Smooth camera glide
        const goal = camTargetGoalRef.current;
        if (goal.active) {
          const alpha = 1 - Math.exp(-9 * dt);
          camera.position.lerp(goal.pos, alpha);
          controls.target.lerp(goal.target, alpha);
          if (
            camera.position.distanceTo(goal.pos) < 0.01 &&
            controls.target.distanceTo(goal.target) < 0.01
          ) {
            camera.position.copy(goal.pos);
            controls.target.copy(goal.target);
            goal.active = false;
          } else {
            keepAnimating = true;
          }
        }

        // Smooth Exploded & Rear-Panel Removal kinematics
        const st = stateRef.current;
        const targetExplode = st.viewMode === 'exploded' ? 1 : 0;
        const targetRearRemoved = st.viewMode === 'back-removed' ? 1 : 0;

        explodeProgressRef.current = THREE.MathUtils.damp(
          explodeProgressRef.current,
          targetExplode,
          8,
          dt
        );
        rearRemovedProgressRef.current = THREE.MathUtils.damp(
          rearRemovedProgressRef.current,
          targetRearRemoved,
          8,
          dt
        );

        if (
          Math.abs(explodeProgressRef.current - targetExplode) > 0.004 ||
          Math.abs(rearRemovedProgressRef.current - targetRearRemoved) > 0.004
        ) {
          keepAnimating = true;
        }

        // Animated Snap-in pulse feedback
        if (snapPulseRef.current.amp > 0.004) {
          snapPulseRef.current.amp = THREE.MathUtils.damp(snapPulseRef.current.amp, 0, 7, dt);
          keepAnimating = true;
        } else {
          snapPulseRef.current.amp = 0;
          snapPulseRef.current.bayId = null;
        }

        const curRig = phoneRigRef.current;
        if (curRig) {
          const ex = explodeProgressRef.current;
          const rem = rearRemovedProgressRef.current;
          for (const item of curRig.explodables) {
            if (item.isRearPanel) {
              const explZ = THREE.MathUtils.lerp(item.baseZ, item.explodeZ, ex);
              item.obj.position.z = explZ - rem * 0.62;
              item.obj.position.x = rem * 0.56;
              item.obj.rotation.y = rem * 0.28;
            } else {
              item.obj.position.z = THREE.MathUtils.lerp(item.baseZ, item.explodeZ, ex);
            }
          }
          if (snapPulseRef.current.bayId && curRig.bayGroups[snapPulseRef.current.bayId]) {
            const grp = curRig.bayGroups[snapPulseRef.current.bayId]!;
            grp.position.z -= snapPulseRef.current.amp * 0.14;
          }
        }

        controls.update();
        renderer.render(scene, camera);

        const done = () => {
          renderBusy = false;
          if ((renderDirty || keepAnimating) && !disposed) {
            requestRender();
          }
        };
        if (isSoftwareGl) afterDraw(done);
        else done();
      });
    };

    requestRenderRef.current = requestRender;

    const onControlsStart = () => {
      camTargetGoalRef.current.active = false;
      requestRender();
    };
    const onControlsChange = () => {
      requestRender();
    };
    controls.addEventListener('start', onControlsStart);
    controls.addEventListener('change', onControlsChange);

    // Raycast click to inspect internal/external phone hardware components
    const raycaster = new THREE.Raycaster();
    const pointerNdc = new THREE.Vector2();
    let downX = 0;
    let downY = 0;

    const onPointerDown = (e: PointerEvent) => {
      downX = e.clientX;
      downY = e.clientY;
    };
    const onPointerUp = (e: PointerEvent) => {
      const dist = Math.hypot(e.clientX - downX, e.clientY - downY);
      if (dist > 6 || !phoneRigRef.current) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointerNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointerNdc, camera);
      const hits = raycaster.intersectObjects(phoneRigRef.current.clickableObjects, true);
      if (hits.length > 0) {
        const hitObj = hits[0].object;
        const compId = hitObj.userData?.componentId as string | undefined;
        const bayId = hitObj.userData?.bayId as PhoneBayId | undefined;
        if (bayId) setSelectedBay(bayId);
        if (compId) openLearningRef.current(compId);
      }
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointerup', onPointerUp);

    const onResize = () => {
      if (!container || disposed) return;
      const nw = Math.max(320, container.clientWidth);
      const nh = Math.max(320, container.clientHeight);
      camera.aspect = nw / nh;
      camera.updateProjectionMatrix();
      renderer.setSize(nw, nh);
      requestRender();
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(container);

    const onContextLost = (ev: Event) => {
      ev.preventDefault();
      setWebglFailed(true);
    };
    renderer.domElement.addEventListener('webglcontextlost', onContextLost);

    requestRender();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      ro.disconnect();
      controls.removeEventListener('start', onControlsStart);
      controls.removeEventListener('change', onControlsChange);
      controls.dispose();
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);

      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry?.dispose();
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          for (const m of mats) {
            if (!m) continue;
            if ('map' in m && m.map instanceof THREE.Texture) m.map.dispose();
            m.dispose();
          }
        }
      });
      renderer.dispose();
    };
  }, []);

  // Rebuild 3D Phone Geometry whenever hardware bays/dimensions/color change
  useEffect(() => {
    const scene = sceneRef.current;
    const renderer = rendererRef.current;
    if (!scene || !renderer) return;

    if (phoneRigRef.current) {
      const old = phoneRigRef.current.root;
      scene.remove(old);
      old.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry?.dispose();
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          for (const m of mats) {
            if (!m) continue;
            if ('map' in m && m.map instanceof THREE.Texture) m.map.dispose();
            m.dispose();
          }
        }
      });
    }

    const isSw = detectSoftwareGl();
    const maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    const rig = buildPhoneGroup(state, {
      isSoftwareGl: isSw,
      maxAnisotropy: maxAniso,
      flashPulse,
      chargingActive,
    });
    phoneRigRef.current = rig;
    scene.add(rig.root);
    requestRenderRef.current();
  }, [
    state.bays,
    state.sizePreset,
    state.thicknessMm,
    state.bodyColor,
    state.wallpaperId,
    state.deviceName,
    state.installedBays,
    state.caseStyle,
    state.screenAwake,
    flashPulse,
    chargingActive,
  ]);

  // Trigger smooth Z transition when viewMode toggles
  useEffect(() => {
    requestRenderRef.current();
  }, [state.viewMode]);

  // CAD Keyboard Shortcuts (R, F, T, E, I, H, ESC)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
        return;
      }
      const k = e.key.toUpperCase();
      if (k === 'R') {
        setCameraView('hero');
      } else if (k === 'F') {
        setCameraView('front');
      } else if (k === 'T') {
        setCameraView('top');
      } else if (k === 'E') {
        setState((prev) => ({
          ...prev,
          viewMode: prev.viewMode === 'exploded' ? 'back-removed' : 'exploded',
        }));
      } else if (k === 'I') {
        setLearningMode((v) => !v);
      } else if (k === 'H') {
        setHideHud((v) => !v);
      } else if (k === 'ESCAPE') {
        setInspectedComp(null);
        setShortcutsOpen(false);
        setHideHud(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [setCameraView]);

  // Install / Replace Bay Component with Animated Snap + Compatibility Notice
  const installBayOption = <K extends PhoneBayId>(bayId: K, value: PhoneBayConfig[K], learnId?: string) => {
    arcadeAudio.playSfx('click');
    snapPulseRef.current = { bayId, amp: 1.0 };
    const nextState: PhoneDesignState = {
      ...state,
      bays: { ...state.bays, [bayId]: value },
      installedBays: state.installedBays.includes(bayId)
        ? state.installedBays
        : [...state.installedBays, bayId],
    };
    const nextTelemetry = evaluatePhoneEngineering(nextState);
    setState(nextState);

    const bayIssue = nextTelemetry.issues.find((i) => i.bay === bayId && i.severity === 'error');
    if (bayIssue) {
      setCompatibilityAlert(`${bayIssue.title} — ${bayIssue.detail}`);
    } else if (nextTelemetry.errorCount > 0) {
      setCompatibilityAlert(`${nextTelemetry.issues[0].title} — ${nextTelemetry.issues[0].detail}`);
    } else {
      setCompatibilityAlert(null);
    }

    if (learningMode && learnId) {
      openComponentLearning(learnId);
    }
    requestRenderRef.current();
  };

  const toggleRemoveBay = (bayId: PhoneBayId) => {
    if (bayId === 'frame') {
      showToast('Structural Mid-Frame cannot be stripped during chassis assembly.');
      return;
    }
    arcadeAudio.playSfx('click');
    setState((prev) => {
      const exists = prev.installedBays.includes(bayId);
      const nextInstalled = exists
        ? prev.installedBays.filter((b) => b !== bayId)
        : [...prev.installedBays, bayId];
      return { ...prev, installedBays: nextInstalled };
    });
    snapPulseRef.current = { bayId, amp: 1.0 };
    requestRenderRef.current();
  };

  const handleSaveDesign = async () => {
    arcadeAudio.playSfx('click');
    setSaving(true);
    let preview: string | null = null;
    try {
      const renderer = rendererRef.current;
      const scene = sceneRef.current;
      const camera = cameraRef.current;
      if (renderer && scene && camera) {
        renderer.render(scene, camera);
        preview = renderer.domElement.toDataURL('image/png');
      }
    } catch {
      preview = null;
    }

    const res = await saveCreation({
      id: editingId,
      userId,
      type: 'phone',
      title: state.deviceName.trim() || 'Horizon Hardware Lab',
      subtitle: `${state.sizePreset.toUpperCase()} · ${state.thicknessMm.toFixed(1)}mm · ${telemetry.weightGrams}g · ${telemetry.installedRatio} bays`,
      designRating: telemetry.overallEngineeringScore,
      estimatedCost: telemetry.totalCostUsd,
      payload: state as unknown as Record<string, unknown>,
      previewDataUrl: preview,
    });
    setSaving(false);
    setEditingId(res.creation.id);
    if (res.player) updateLocalPlayer(res.player);
    await refreshSaved();
    arcadeAudio.playSfx(res.leveledUp ? 'levelUp' : 'correct');
    showToast(`Saved "${res.creation.title}" (+${res.xpEarned} XP)`);
  };

  const handleExportPng = () => {
    arcadeAudio.playSfx('click');
    const renderer = rendererRef.current;
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    if (!renderer || !scene || !camera) {
      showToast('3D viewport unavailable for snapshot.');
      return;
    }
    renderer.render(scene, camera);
    const url = renderer.domElement.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `${state.deviceName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-lab.png`;
    a.click();
    showToast('Exported 3D Hardware CAD PNG snapshot!');
  };

  const handleSubmitMission = async () => {
    if (!activeChallenge || !challengeResult?.passed) return;
    setSubmittingMission(true);
    const res = await submitSimulatorMissionScore(
      {
        userId: player?.id || '',
        simulator: 'phone',
        missionId: activeChallenge.id,
        missionTitle: activeChallenge.title,
        score: activeChallenge.rewardScore,
        accuracy: telemetry.overallEngineeringScore,
        componentsExplored: exploredIds.size,
        buildTitle: state.deviceName,
        detailsSummary: `${telemetry.weightGrams}g · $${telemetry.totalCostUsd} · ${telemetry.estimatedBatteryHours}h · ${telemetry.peakJunctionTempC}°C`,
      },
      isAuthenticated
    );
    setSubmittingMission(false);
    setSimProgress(res.progress);
    if (res.player) updateLocalPlayer(res.player);
    if (res.savedToLeaderboard) {
      arcadeAudio.playSfx('levelUp');
      setSubmittedMissionIds((prev) => new Set(prev).add(activeChallenge.id));
      showToast(`Mission logged to Leaderboard! +${res.xpEarned} XP`);
    } else {
      showToast(res.error || 'Sign in to save engineering scores to leaderboard.');
    }
  };

  const currentBayMeta = PHONE_BAY_OPTIONS[selectedBay];
  const currentStepIdx = Math.max(
    0,
    Math.min(ASSEMBLY_SEQUENCE.length - 1, state.assemblyStepIndex)
  );
  const guidedBayId = ASSEMBLY_SEQUENCE[currentStepIdx];

  if (testLabOpen) {
    return (
      <PhoneTestLabModal
        state={state}
        onExit={() => setTestLabOpen(false)}
        onOpenLeaderboard={onOpenLeaderboard}
        onGoHome={onGoHome}
      />
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col bg-[#040814] text-slate-100 select-none">
      {/* TOP ENGINEERING WORKSTATION BAR */}
      <div className="border-b border-cyan-500/20 bg-[#080F22] px-3 sm:px-5 py-2.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={() => {
              arcadeAudio.playSfx('click');
              onExit();
            }}
            className="studio-btn studio-btn-ghost text-xs px-2.5 py-1.5 min-h-[36px]"
          >
            <ArrowLeft size={14} />
            <span className="hidden sm:inline">Arena</span>
          </button>

          <div className="hidden md:flex items-center gap-2 px-2.5 py-1 rounded-lg bg-purple-500/15 border border-purple-400/35">
            <Cpu size={14} className="text-purple-300" />
            <span className="font-mono-tech text-[11px] font-bold text-purple-200 uppercase">
              Smartphone Engineering Lab
            </span>
          </div>

          <input
            type="text"
            value={state.deviceName}
            onChange={(e) => setState((p) => ({ ...p, deviceName: e.target.value }))}
            maxLength={42}
            aria-label="Smartphone prototype name"
            className="studio-input px-2.5 py-1.5 text-sm font-heading font-bold w-36 sm:w-48 bg-[#0C162F]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={() => {
              arcadeAudio.playSfx('click');
              setLearningMode((v) => !v);
            }}
            className={`studio-btn text-xs px-2.5 py-1.5 min-h-[36px] ${
              learningMode ? 'studio-btn-cyan' : 'studio-btn-ghost'
            }`}
            title="Toggle Learning Mode on component click (Shortcut: I)"
          >
            <BookOpen size={14} />
            <span className="hidden sm:inline">Learn {learningMode ? 'ON' : 'OFF'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              arcadeAudio.playSfx('click');
              setState(createRandomPhoneState());
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
              setState(createInitialPhoneState());
              setCompatibilityAlert(null);
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
            title="Export 3D CAD Snapshot PNG"
          >
            <Camera size={14} />
          </button>

          <button
            type="button"
            onClick={() => {
              arcadeAudio.playSfx('click');
              setTestLabOpen(true);
            }}
            className="studio-btn studio-btn-emerald text-xs px-3 py-1.5 min-h-[36px]"
          >
            <Activity size={14} />
            <span>Open Test Lab</span>
          </button>

          <button
            type="button"
            disabled={saving}
            onClick={() => void handleSaveDesign()}
            className="studio-btn studio-btn-primary text-xs px-3 py-1.5 min-h-[36px]"
          >
            <Save size={14} />
            <span>{saving ? 'Saving...' : 'Save Lab'}</span>
          </button>
        </div>
      </div>

      {/* MAIN WORKSPACE: 3D CAD VIEWPORT + RIGHT ENGINEERING PANEL */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 min-h-[640px]">
        {/* 3D HARDWARE CAD VIEWPORT */}
        <div
          className={`relative bg-[#050A18] flex flex-col ${
            hideHud ? 'lg:col-span-12' : 'lg:col-span-7'
          } min-h-[460px] lg:min-h-[calc(100vh-8rem)]`}
        >
          {/* WebGL Canvas Container (no backdrop-blur over it!) */}
          {!webglFailed ? (
            <div ref={mountRef} className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing" />
          ) : (
            /* Clean Interactive 2D Cross-Section Blueprint Fallback if WebGL disabled */
            <div className="absolute inset-0 p-6 flex flex-col items-center justify-center bg-[#060C1D] overflow-y-auto">
              <div className="font-mono-tech text-xs text-cyan-300 uppercase mb-3">
                2D Internal Hardware Cutaway Schematic (WebGL Fallback)
              </div>
              <div className="w-full max-w-md rounded-3xl border-2 border-cyan-500/40 bg-[#0A1328] p-4 grid grid-cols-2 gap-2.5">
                {ASSEMBLY_SEQUENCE.map((bay) => {
                  const meta = PHONE_BAY_OPTIONS[bay];
                  const activeVal = state.bays[bay];
                  const opt = meta.options.find((o) => o.value === activeVal);
                  const mounted = state.installedBays.includes(bay);
                  return (
                    <button
                      key={bay}
                      type="button"
                      onClick={() => {
                        setSelectedBay(bay);
                        if (opt) openComponentLearning(opt.learnComponentId);
                      }}
                      className={`p-2.5 rounded-xl border text-left cursor-pointer ${
                        selectedBay === bay
                          ? 'border-cyan-400 bg-cyan-950/60'
                          : 'border-white/10 bg-slate-900/80'
                      }`}
                    >
                      <div className="font-mono-tech text-[10px] text-cyan-300">{meta.title}</div>
                      <div className="font-sora text-xs font-semibold text-white truncate">
                        {mounted ? opt?.label : 'BAY EMPTY'}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Top-Left Compact Simulated Telemetry Badge */}
          {!hideHud && (
            <div className="relative z-10 pointer-events-none p-3 sm:p-4 flex flex-wrap items-start justify-between gap-2">
              <div className="pointer-events-auto rounded-xl bg-[#070E20]/95 border border-cyan-500/35 px-3 py-2 flex flex-wrap items-center gap-3 text-xs font-mono-tech tabular-nums shadow-lg">
                <div>
                  <span className="text-slate-400 text-[10px] block">SIM RATING</span>
                  <span className="text-cyan-300 font-bold">{telemetry.overallEngineeringScore}/100</span>
                </div>
                <div className="h-6 w-px bg-white/10" />
                <div>
                  <span className="text-slate-400 text-[10px] block">MASS / COST</span>
                  <span className="text-white font-bold">
                    {telemetry.weightGrams}g · ${telemetry.totalCostUsd}
                  </span>
                </div>
                <div className="h-6 w-px bg-white/10" />
                <div>
                  <span className="text-slate-400 text-[10px] block">THERMAL</span>
                  <span
                    className={`font-bold ${
                      telemetry.peakJunctionTempC > 78 ? 'text-rose-400' : 'text-emerald-300'
                    }`}
                  >
                    {telemetry.peakJunctionTempC}°C ({telemetry.thermalScore})
                  </span>
                </div>
                <div className="h-6 w-px bg-white/10" />
                <div>
                  <span className="text-slate-400 text-[10px] block">EXPLORED</span>
                  <span className="text-purple-300 font-bold">
                    {Math.max(exploredIds.size, simProgress.componentsExplored)}/{PHONE_ENGINEERING_COMPONENTS.length}
                  </span>
                </div>
              </div>

              <div className="pointer-events-auto flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setShortcutsOpen((v) => !v)}
                  className="p-2 rounded-lg bg-[#070E20]/95 border border-white/15 text-slate-200 hover:border-cyan-400 cursor-pointer"
                  title="CAD Keyboard & Mouse Controls (?)"
                >
                  <HelpCircle size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => setHideHud(true)}
                  className="p-2 rounded-lg bg-[#070E20]/95 border border-white/15 text-slate-200 hover:border-cyan-400 cursor-pointer"
                  title="Hide HUD Overlay (H)"
                >
                  <EyeOff size={15} />
                </button>
              </div>
            </div>
          )}

          {hideHud && (
            <button
              type="button"
              onClick={() => setHideHud(false)}
              className="absolute top-3 right-3 z-20 px-3 py-1.5 rounded-lg bg-[#070E20]/95 border border-cyan-400/50 text-xs font-mono-tech text-cyan-200 flex items-center gap-1.5 cursor-pointer"
            >
              <Eye size={14} /> Show Workstation (H / ESC)
            </button>
          )}

          {/* Toast & Compatibility Alerts */}
          <div className="relative z-10 pointer-events-none px-4 space-y-2 max-w-md">
            {toast && (
              <div className="pointer-events-auto px-3.5 py-2 rounded-xl bg-emerald-950/95 border border-emerald-400/60 text-emerald-100 text-xs font-sora flex items-center gap-2 shadow-lg">
                <Check size={14} className="text-emerald-400 shrink-0" />
                <span>{toast}</span>
              </div>
            )}
            {compatibilityAlert && (
              <div className="pointer-events-auto px-3.5 py-2.5 rounded-xl bg-rose-950/95 border border-rose-400/70 text-rose-100 text-xs font-sora flex items-start gap-2 shadow-lg">
                <AlertTriangle size={15} className="text-rose-400 shrink-0 mt-0.5" />
                <div className="flex-1">{compatibilityAlert}</div>
                <button
                  type="button"
                  onClick={() => setCompatibilityAlert(null)}
                  className="text-rose-300 hover:text-white cursor-pointer"
                >
                  <X size={13} />
                </button>
              </div>
            )}
          </div>

          {shortcutsOpen && (
            <div className="absolute top-16 right-4 z-30 w-72 rounded-xl bg-[#070E20] border border-cyan-400/40 p-3.5 shadow-2xl text-xs space-y-2">
              <div className="flex items-center justify-between font-mono-tech text-cyan-300 font-bold">
                <span>CAD CONTROLS &amp; SHORTCUTS</span>
                <button type="button" onClick={() => setShortcutsOpen(false)} className="cursor-pointer">
                  <X size={14} />
                </button>
              </div>
              <div className="space-y-1 text-slate-300 font-mono-tech text-[11px]">
                <div>• Left Drag / 1-Finger: 360° Rotate</div>
                <div>• Scroll / Pinch: Zoom In/Out</div>
                <div>• Right Drag / 2-Finger: Pan View</div>
                <div>• Click Internal Part: Inspect &amp; Learn</div>
                <div>• R: Reset · F: Front · T: Top</div>
                <div>• E: Explode 7 Layers · I: Learn · H: Hide HUD</div>
              </div>
            </div>
          )}

          {/* Bottom Camera & Inspection Mode Toolbar */}
          {!hideHud && (
            <div className="mt-auto relative z-10 p-3 flex flex-wrap items-center justify-between gap-2 bg-[#070E20]/95 border-t border-white/10">
              {/* View Mode Switcher */}
              <div className="flex items-center gap-1">
                {(
                  [
                    { id: 'assembled', label: 'Assembled' },
                    { id: 'back-removed', label: 'Back Removed' },
                    { id: 'exploded', label: 'Exploded (E)' },
                  ] as Array<{ id: PhoneInspectionViewMode; label: string }>
                ).map((vm) => (
                  <button
                    key={vm.id}
                    type="button"
                    onClick={() => {
                      arcadeAudio.playSfx('click');
                      setState((p) => ({ ...p, viewMode: vm.id }));
                    }}
                    className={`px-2.5 py-1.5 rounded-lg text-[11px] font-mono-tech font-bold border cursor-pointer transition-colors ${
                      state.viewMode === vm.id
                        ? 'bg-cyan-500 text-slate-950 border-cyan-300'
                        : 'bg-slate-900 border-white/15 text-slate-200 hover:border-cyan-400/50'
                    }`}
                  >
                    {vm.label}
                  </button>
                ))}
              </div>

              {/* Camera Angle Presets */}
              <div className="flex flex-wrap items-center gap-1">
                {(
                  [
                    { id: 'hero', label: 'Reset (R)' },
                    { id: 'front', label: 'Front (F)' },
                    { id: 'rear', label: 'Rear' },
                    { id: 'side', label: 'Side' },
                    { id: 'top', label: 'Top (T)' },
                    { id: 'internals', label: 'PCB Zoom' },
                  ] as Array<{ id: PhoneCameraPreset; label: string }>
                ).map((cam) => (
                  <button
                    key={cam.id}
                    type="button"
                    onClick={() => setCameraView(cam.id)}
                    className="px-2 py-1 rounded-md bg-slate-900 border border-white/10 hover:border-cyan-400 text-[10px] font-mono-tech text-slate-300 cursor-pointer"
                  >
                    {cam.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT ENGINEERING WORKSTATION PANEL */}
        {!hideHud && (
          <aside className="lg:col-span-5 border-t lg:border-t-0 lg:border-l border-white/10 bg-[#080F22] flex flex-col max-h-[640px] lg:max-h-[calc(100vh-8rem)]">
            {/* 5 Workstation Tabs */}
            <div className="grid grid-cols-5 border-b border-white/10 p-1.5 gap-1 bg-[#050A18]">
              {(
                [
                  { id: 'assemble', label: 'Assemble', icon: <Wrench size={13} /> },
                  { id: 'telemetry', label: 'Specs', icon: <Activity size={13} /> },
                  { id: 'challenges', label: '7 Missions', icon: <Target size={13} /> },
                  { id: 'components', label: 'Learn', icon: <Layers size={13} /> },
                  { id: 'saved', label: `Saved (${savedPhones.length})`, icon: <FolderOpen size={13} /> },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    arcadeAudio.playSfx('click');
                    setActiveTab(tab.id);
                  }}
                  className={`py-2 px-1.5 rounded-lg text-[11px] font-sora font-semibold flex items-center justify-center gap-1 cursor-pointer transition-colors ${
                    activeTab === tab.id
                      ? 'bg-cyan-500 text-slate-950 font-bold'
                      : 'text-slate-300 hover:text-white bg-slate-900/60 border border-white/5'
                  }`}
                >
                  {tab.icon}
                  <span className="truncate">{tab.label}</span>
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto studio-scroll p-4 space-y-4">
              {/* TAB 1: ASSEMBLE HARDWARE BAYS + STEP-BY-STEP + COMPATIBILITY */}
              {activeTab === 'assemble' && (
                <>
                  {/* Step-by-Step Guided Assembly Banner */}
                  <div className="p-3.5 rounded-xl bg-slate-900/90 border border-cyan-500/30 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="font-mono-tech text-[10px] uppercase text-cyan-300 font-bold">
                          Interactive Hardware Assembly ({telemetry.installedRatio} Bays Mounted)
                        </div>
                        <div className="font-sora text-xs text-slate-300 mt-0.5">
                          Click any 3D part in the phone or pick a hardware bay below to install, inspect, or strip.
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          arcadeAudio.playSfx('click');
                          setGuidedAssembly((v) => !v);
                          if (!guidedAssembly) setSelectedBay(guidedBayId);
                        }}
                        className={`px-2.5 py-1.5 rounded-lg text-[11px] font-mono-tech font-bold border shrink-0 cursor-pointer ${
                          guidedAssembly
                            ? 'bg-emerald-500 text-slate-950 border-emerald-300'
                            : 'bg-slate-800 text-slate-200 border-white/15'
                        }`}
                      >
                        {guidedAssembly ? 'Guided ON' : 'Guided Steps'}
                      </button>
                    </div>

                    {guidedAssembly && (
                      <div className="p-2.5 rounded-lg bg-[#050A18] border border-emerald-500/35 space-y-2">
                        <div className="flex items-center justify-between text-xs font-mono-tech">
                          <span className="text-emerald-300 font-bold">
                            STEP {currentStepIdx + 1} / {ASSEMBLY_SEQUENCE.length}: {PHONE_BAY_OPTIONS[guidedBayId].title}
                          </span>
                          <div className="flex gap-1">
                            <button
                              type="button"
                              disabled={currentStepIdx === 0}
                              onClick={() => {
                                const prevIdx = Math.max(0, currentStepIdx - 1);
                                setState((p) => ({ ...p, assemblyStepIndex: prevIdx }));
                                setSelectedBay(ASSEMBLY_SEQUENCE[prevIdx]);
                              }}
                              className="px-2 py-0.5 rounded bg-slate-800 text-slate-200 disabled:opacity-40 cursor-pointer"
                            >
                              Prev
                            </button>
                            <button
                              type="button"
                              disabled={currentStepIdx >= ASSEMBLY_SEQUENCE.length - 1}
                              onClick={() => {
                                const nextIdx = Math.min(ASSEMBLY_SEQUENCE.length - 1, currentStepIdx + 1);
                                setState((p) => ({ ...p, assemblyStepIndex: nextIdx }));
                                setSelectedBay(ASSEMBLY_SEQUENCE[nextIdx]);
                              }}
                              className="px-2 py-0.5 rounded bg-emerald-600 text-white disabled:opacity-40 cursor-pointer"
                            >
                              Next
                            </button>
                          </div>
                        </div>
                        <p className="text-[11px] text-slate-300">
                          {PHONE_BAY_OPTIONS[guidedBayId].instruction}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Compatibility Diagnostic Summary */}
                  {telemetry.issues.length > 0 ? (
                    <div className="space-y-1.5">
                      {telemetry.issues.map((issue) => (
                        <div
                          key={issue.id}
                          className={`p-2.5 rounded-xl border text-xs flex items-start gap-2 ${
                            issue.severity === 'error'
                              ? 'bg-rose-950/70 border-rose-500/50 text-rose-100'
                              : 'bg-amber-950/70 border-amber-500/50 text-amber-100'
                          }`}
                        >
                          <AlertTriangle
                            size={14}
                            className={`shrink-0 mt-0.5 ${
                              issue.severity === 'error' ? 'text-rose-400' : 'text-amber-400'
                            }`}
                          />
                          <div>
                            <div className="font-sora font-bold">{issue.title}</div>
                            <div className="text-[11px] opacity-90 mt-0.5">{issue.detail}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-2.5 rounded-xl bg-emerald-950/50 border border-emerald-500/35 text-emerald-200 text-xs flex items-center gap-2">
                      <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
                      <span>All thermal, mechanical clearance, and electrical compatibility checks passed.</span>
                    </div>
                  )}

                  {/* 11-Bay Selector Chips */}
                  <div>
                    <div className="font-mono-tech text-[10px] uppercase text-slate-400 mb-1.5">
                      Select Hardware Bay
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                      {ASSEMBLY_SEQUENCE.map((bay) => {
                        const meta = PHONE_BAY_OPTIONS[bay];
                        const mounted = state.installedBays.includes(bay);
                        const hasErr = telemetry.issues.some((i) => i.bay === bay && i.severity === 'error');
                        return (
                          <button
                            key={bay}
                            type="button"
                            onClick={() => {
                              arcadeAudio.playSfx('click');
                              setSelectedBay(bay);
                            }}
                            className={`px-2 py-1.5 rounded-lg text-[11px] font-sora font-semibold text-left border cursor-pointer flex items-center justify-between gap-1 ${
                              selectedBay === bay
                                ? 'bg-cyan-500/20 border-cyan-400 text-cyan-100'
                                : hasErr
                                  ? 'bg-rose-950/50 border-rose-500/45 text-rose-200'
                                  : 'bg-slate-900/75 border-white/10 text-slate-300 hover:border-cyan-400/40'
                            }`}
                          >
                            <span className="truncate">{meta.title.replace(/^\d+\.\s*/, '')}</span>
                            <span
                              className={`w-2 h-2 rounded-full shrink-0 ${
                                hasErr ? 'bg-rose-400' : mounted ? 'bg-emerald-400' : 'bg-slate-600'
                              }`}
                            />
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Selected Bay Component Options */}
                  <div className="p-3.5 rounded-xl bg-slate-900/80 border border-white/15 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="font-mono-tech text-[10px] text-cyan-300 uppercase">
                          {currentBayMeta.title}
                        </div>
                        <div className="text-[11px] text-slate-400">{currentBayMeta.instruction}</div>
                      </div>
                      {selectedBay !== 'frame' && (
                        <button
                          type="button"
                          onClick={() => toggleRemoveBay(selectedBay)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-mono-tech font-bold border cursor-pointer shrink-0 ${
                            state.installedBays.includes(selectedBay)
                              ? 'bg-rose-500/15 border-rose-400/40 text-rose-200 hover:bg-rose-500/25'
                              : 'bg-emerald-500/20 border-emerald-400/50 text-emerald-200'
                          }`}
                        >
                          {state.installedBays.includes(selectedBay) ? 'Remove Bay' : 'Mount Bay'}
                        </button>
                      )}
                    </div>

                    <div className="space-y-2">
                      {currentBayMeta.options.map((opt) => {
                        const isSelected =
                          state.bays[selectedBay] === opt.value &&
                          state.installedBays.includes(selectedBay);
                        return (
                          <div
                            key={opt.value}
                            onClick={() =>
                              installBayOption(
                                selectedBay,
                                opt.value as PhoneBayConfig[typeof selectedBay],
                                opt.learnComponentId
                              )
                            }
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                installBayOption(
                                  selectedBay,
                                  opt.value as PhoneBayConfig[typeof selectedBay],
                                  opt.learnComponentId
                                );
                              }
                            }}
                            className={`p-2.5 rounded-xl border cursor-pointer transition-all flex items-center justify-between gap-2 ${
                              isSelected
                                ? 'bg-cyan-500/20 border-cyan-400 text-white'
                                : 'bg-[#060C1D] border-white/10 text-slate-300 hover:border-cyan-400/45'
                            }`}
                          >
                            <div className="min-w-0">
                              <div className="font-sora font-bold text-xs text-white">{opt.label}</div>
                              <div className="font-mono-tech text-[10px] text-slate-400 mt-0.5">
                                {opt.shortSpec} · +${opt.costDelta} · {opt.weightGrams}g
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openComponentLearning(opt.learnComponentId);
                                }}
                                title="Inspect engineering sheet"
                                className="p-1.5 rounded-lg bg-slate-900 border border-white/15 text-cyan-300 hover:border-cyan-400 cursor-pointer"
                              >
                                <BookOpen size={13} />
                              </button>
                              <span
                                className={`px-2 py-1 rounded-md font-mono-tech text-[10px] font-bold ${
                                  isSelected
                                    ? 'bg-cyan-400 text-slate-950'
                                    : 'bg-slate-800 text-slate-300'
                                }`}
                              >
                                {isSelected ? 'MOUNTED' : 'SNAP IN'}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Chassis Dimensions, Thickness & Finish */}
                  <div className="p-3.5 rounded-xl bg-slate-900/75 border border-white/10 space-y-3">
                    <div className="font-mono-tech text-[10px] uppercase text-cyan-300 flex items-center gap-1.5">
                      <Sliders size={12} /> Chassis Envelope &amp; Finish
                    </div>

                    <div className="grid grid-cols-3 gap-1.5">
                      {(
                        [
                          { id: 'compact', label: 'Compact 5.9"' },
                          { id: 'standard', label: 'Studio 6.3"' },
                          { id: 'pro-max', label: 'Max 6.9"' },
                        ] as Array<{ id: PhoneSizePreset; label: string }>
                      ).map((sz) => (
                        <button
                          key={sz.id}
                          type="button"
                          onClick={() => {
                            arcadeAudio.playSfx('click');
                            setState((p) => ({ ...p, sizePreset: sz.id }));
                          }}
                          className={`py-1.5 px-2 rounded-lg text-[11px] font-sora font-semibold border cursor-pointer ${
                            state.sizePreset === sz.id
                              ? 'bg-cyan-500/25 border-cyan-400 text-cyan-100'
                              : 'bg-slate-950/60 border-white/10 text-slate-300'
                          }`}
                        >
                          {sz.label}
                        </button>
                      ))}
                    </div>

                    <div>
                      <div className="flex justify-between text-[11px] font-mono-tech text-slate-300 mb-1">
                        <span>CHASSIS THICKNESS</span>
                        <span className="text-cyan-300">{state.thicknessMm.toFixed(1)} mm</span>
                      </div>
                      <input
                        type="range"
                        min={5.5}
                        max={9.2}
                        step={0.1}
                        value={state.thicknessMm}
                        onChange={(e) =>
                          setState((p) => ({ ...p, thicknessMm: Number(e.target.value) }))
                        }
                        className="w-full accent-cyan-400"
                      />
                    </div>

                    <div className="grid grid-cols-5 gap-1.5">
                      {PHONE_COLORS.map((c) => (
                        <button
                          key={c.hex}
                          type="button"
                          onClick={() => {
                            arcadeAudio.playSfx('click');
                            setState((p) => ({ ...p, bodyColor: c.hex }));
                          }}
                          title={c.name}
                          className={`h-7 rounded-lg border-2 cursor-pointer ${
                            state.bodyColor.toLowerCase() === c.hex.toLowerCase()
                              ? 'border-white ring-2 ring-cyan-400'
                              : 'border-white/15'
                          }`}
                          style={{ backgroundColor: c.hex }}
                        />
                      ))}
                    </div>

                    <div className="grid grid-cols-4 gap-1.5 pt-1">
                      {PHONE_WALLPAPERS.map((wp) => (
                        <button
                          key={wp.id}
                          type="button"
                          onClick={() => {
                            arcadeAudio.playSfx('click');
                            setState((p) => ({ ...p, wallpaperId: wp.id }));
                          }}
                          className={`h-8 rounded-lg border text-[10px] font-mono-tech text-white px-1 truncate cursor-pointer ${
                            state.wallpaperId === wp.id
                              ? 'border-cyan-300 ring-1 ring-cyan-400'
                              : 'border-white/15'
                          }`}
                          style={{ background: wp.gradient }}
                        >
                          {wp.name.split(' ')[0]}
                        </button>
                      ))}
                    </div>

                    {/* Protective Case & Interactive Device States */}
                    <div className="pt-2 border-t border-white/10 space-y-2">
                      <div className="font-mono-tech text-[10px] text-slate-400 uppercase">Protective Case &amp; Interactive Hardware</div>
                      <select
                        value={state.caseStyle || 'none'}
                        onChange={(e) => setState((p) => ({ ...p, caseStyle: e.target.value as PhoneCaseStyle }))}
                        className="studio-input w-full px-2.5 py-1.5 text-xs bg-[#070E1F]"
                      >
                        <option value="none">No Case (Bare Chassis)</option>
                        <option value="clear">Clear Polycarbonate Case</option>
                        <option value="silicone">Silicone Cyan Bumper</option>
                        <option value="rugged">Rugged Impact Case</option>
                        <option value="carbon">Aramid Carbon Shell</option>
                      </select>

                      <div className="grid grid-cols-4 gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            arcadeAudio.playSfx('snap');
                            setState((p) => ({ ...p, screenAwake: p.screenAwake === false }));
                          }}
                          className={`py-1.5 rounded-lg text-[10px] font-mono-tech border cursor-pointer ${
                            state.screenAwake !== false ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200' : 'bg-slate-950 border-white/15 text-slate-400'
                          }`}
                        >
                          {state.screenAwake !== false ? 'Wake ON' : 'Locked'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            arcadeAudio.playSfx('click');
                            setFlashPulse(true);
                            window.setTimeout(() => setFlashPulse(false), 750);
                          }}
                          className="py-1.5 rounded-lg text-[10px] font-mono-tech border bg-amber-500/15 border-amber-400/40 text-amber-200 cursor-pointer"
                        >
                          Flash LED
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            arcadeAudio.playSfx('correct');
                            setChargingActive((v) => !v);
                          }}
                          className={`py-1.5 rounded-lg text-[10px] font-mono-tech border cursor-pointer ${
                            chargingActive ? 'bg-emerald-500/25 border-emerald-400 text-emerald-200' : 'bg-slate-950 border-white/15 text-slate-300'
                          }`}
                        >
                          {chargingActive ? 'Charging' : 'Plug USB'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            arcadeAudio.playSfx('bounce');
                            showToast('Acoustic LRA Taptic & stereo speaker test tone fired.');
                          }}
                          className="py-1.5 rounded-lg text-[10px] font-mono-tech border bg-purple-500/15 border-purple-400/40 text-purple-200 cursor-pointer"
                        >
                          Speaker
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* TAB 2: SIMULATED ENGINEERING SPECS & 6 PERFORMANCE INDICES */}
              {activeTab === 'telemetry' && (
                <div className="space-y-4">
                  <div className="p-3 rounded-xl bg-amber-950/45 border border-amber-500/35 text-[11px] text-amber-100 font-sora">
                    <strong>Simulated Engineering Specs:</strong> All BOM costs ($), junction temperatures, power efficiency, and battery hours below are educational engineering simulations, not commercial product figures.
                  </div>

                  {/* 6 Core Metrics Grid */}
                  <div className="grid grid-cols-2 gap-2.5 font-mono-tech tabular-nums">
                    <div className="p-3 rounded-xl bg-slate-900/80 border border-white/10">
                      <div className="text-[10px] text-slate-400">EST. BOM COST (SIM)</div>
                      <div className="text-lg font-bold text-emerald-300">${telemetry.totalCostUsd}</div>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-900/80 border border-white/10">
                      <div className="text-[10px] text-slate-400">TOTAL MASS</div>
                      <div className="text-lg font-bold text-cyan-300">{telemetry.weightGrams} g</div>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-900/80 border border-white/10">
                      <div className="text-[10px] text-slate-400">BATTERY ENDURANCE</div>
                      <div className="text-lg font-bold text-white">{telemetry.estimatedBatteryHours} hrs</div>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-900/80 border border-white/10">
                      <div className="text-[10px] text-slate-400">PEAK JUNCTION TEMP</div>
                      <div
                        className={`text-lg font-bold ${
                          telemetry.peakJunctionTempC > 78 ? 'text-rose-400' : 'text-emerald-300'
                        }`}
                      >
                        {telemetry.peakJunctionTempC}°C
                      </div>
                    </div>
                  </div>

                  {/* Performance Bars */}
                  <div className="p-3.5 rounded-xl bg-slate-900/80 border border-white/10 space-y-2.5">
                    <div className="font-mono-tech text-[10px] uppercase text-cyan-300">
                      6-Axis Hardware Evaluation
                    </div>
                    {[
                      { label: 'Compute Performance', val: telemetry.performanceScore, color: 'bg-cyan-400' },
                      { label: 'Power Efficiency', val: telemetry.powerEfficiencyScore, color: 'bg-emerald-400' },
                      { label: 'Thermal Management', val: telemetry.thermalScore, color: 'bg-amber-400' },
                      { label: 'Structural Durability', val: telemetry.durabilityScore, color: 'bg-indigo-400' },
                      { label: 'Optical Camera System', val: telemetry.cameraScore, color: 'bg-purple-400' },
                      { label: 'Overall Engineering Rating', val: telemetry.overallEngineeringScore, color: 'bg-blue-400' },
                    ].map((bar) => (
                      <div key={bar.label} className="space-y-1">
                        <div className="flex justify-between text-xs font-mono-tech">
                          <span className="text-slate-300">{bar.label}</span>
                          <span className="text-white font-bold">{bar.val}/100</span>
                        </div>
                        <div className="h-2 rounded-full bg-slate-950 overflow-hidden">
                          <div
                            className={`h-full ${bar.color} transition-all duration-300`}
                            style={{ width: `${bar.val}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Engineering Equations */}
                  <div className="p-3.5 rounded-xl bg-[#050A18] border border-cyan-500/25 space-y-2">
                    <div className="font-mono-tech text-[10px] uppercase text-cyan-300">
                      Active Physics &amp; Power Equations
                    </div>
                    {telemetry.formulas.map((f) => (
                      <div key={f.label} className="text-xs font-mono-tech flex flex-col gap-0.5 border-b border-white/5 pb-1.5 last:border-0 last:pb-0">
                        <span className="text-slate-400 text-[10px]">{f.label}</span>
                        <span className="text-cyan-200">{f.equation}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 3: 7 ENGINEERING MISSIONS & LEADERBOARD SUBMISSION */}
              {activeTab === 'challenges' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono-tech text-xs text-purple-300 uppercase font-bold">
                      7 Smartphone Engineering Missions
                    </span>
                    <span className="font-mono-tech text-[10px] text-slate-400">
                      XP: {simProgress.engineeringXp} · Done: {simProgress.missionsCompleted}
                    </span>
                  </div>

                  {activeChallenge && challengeResult && (
                    <div
                      className={`p-3.5 rounded-xl border space-y-2 ${
                        challengeResult.passed
                          ? 'bg-emerald-950/60 border-emerald-400'
                          : 'bg-purple-950/50 border-purple-400/50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-sora font-bold text-xs text-white">
                          Active: {activeChallenge.title}
                        </div>
                        <span className="font-mono-tech text-[10px] px-2 py-0.5 rounded bg-slate-900 text-cyan-300">
                          +{activeChallenge.rewardScore} pts
                        </span>
                      </div>

                      {challengeResult.passed && (
                        <div className="pt-1">
                          {isAuthenticated ? (
                            <button
                              type="button"
                              disabled={submittingMission || submittedMissionIds.has(activeChallenge.id)}
                              onClick={() => void handleSubmitMission()}
                              className="studio-btn studio-btn-emerald w-full py-2 text-xs"
                            >
                              <Trophy size={14} />
                              <span>
                                {submittedMissionIds.has(activeChallenge.id)
                                  ? 'Mission Score Saved to Leaderboard!'
                                  : submittingMission
                                    ? 'Submitting Score...'
                                    : `Submit Verified Score (+${activeChallenge.rewardScore} pts)`}
                              </span>
                            </button>
                          ) : (
                            <div className="p-2 rounded-lg bg-slate-900/90 border border-amber-400/40 text-[11px] text-amber-200 flex items-center gap-2">
                              <Lock size={14} className="shrink-0 text-amber-400" />
                              <span>Mission passed! Sign in from the top bar to save your score to the leaderboard.</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {PHONE_CHALLENGES.map((ch) => {
                    const res = ch.check(state, telemetry);
                    const isActive = state.activeChallengeId === ch.id;
                    return (
                      <div
                        key={ch.id}
                        onClick={() => {
                          arcadeAudio.playSfx('click');
                          setState((p) => ({ ...p, activeChallengeId: isActive ? null : ch.id }));
                        }}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setState((p) => ({ ...p, activeChallengeId: isActive ? null : ch.id }));
                          }
                        }}
                        className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                          res.passed
                            ? 'bg-emerald-500/15 border-emerald-400/50'
                            : isActive
                              ? 'bg-cyan-500/15 border-cyan-400'
                              : 'bg-slate-900/75 border-white/10 hover:border-cyan-400/40'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="font-sora font-bold text-xs sm:text-sm text-white">
                            {ch.title}
                          </div>
                          <span
                            className={`font-mono-tech text-[10px] px-2 py-0.5 rounded ${
                              res.passed
                                ? 'bg-emerald-500 text-slate-950 font-bold'
                                : isActive
                                  ? 'bg-cyan-500 text-slate-950 font-bold'
                                  : 'bg-slate-800 text-slate-300'
                            }`}
                          >
                            {res.passed ? 'PASSED' : isActive ? 'ACTIVE' : 'SELECT'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">{ch.description}</p>
                        <div className="mt-2 space-y-1">
                          {res.checklist.map((item) => (
                            <div key={item.label} className="text-[11px] flex items-center gap-1.5">
                              <span className={item.ok ? 'text-emerald-400' : 'text-slate-500'}>
                                {item.ok ? '✓' : '○'}
                              </span>
                              <span className={item.ok ? 'text-emerald-200' : 'text-slate-400'}>
                                {item.label}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* TAB 4: LEARN ALL 38 SMARTPHONE HARDWARE COMPONENTS */}
              {activeTab === 'components' && (
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-1.5">
                    {PHONE_SUBSYSTEMS.map((sub) => (
                      <button
                        key={sub.id}
                        type="button"
                        onClick={() => {
                          arcadeAudio.playSfx('click');
                          setSubsystemFilter(sub.id);
                        }}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-sora font-semibold border cursor-pointer ${
                          subsystemFilter === sub.id
                            ? 'bg-cyan-500 text-slate-950 border-cyan-300 font-bold'
                            : 'bg-slate-900 border-white/10 text-slate-300'
                        }`}
                      >
                        {sub.label}
                      </button>
                    ))}
                  </div>

                  <div className="space-y-2">
                    {PHONE_ENGINEERING_COMPONENTS.filter((c) => {
                      if (subsystemFilter === 'processing') return c.subsystem === 'Processing System';
                      if (subsystemFilter === 'display') return c.subsystem === 'Display System';
                      if (subsystemFilter === 'battery') return c.subsystem === 'Battery & Power';
                      if (subsystemFilter === 'camera') return c.subsystem === 'Camera System';
                      if (subsystemFilter === 'connectivity') return c.subsystem === 'Connectivity';
                      return c.subsystem === 'Physical Engineering';
                    }).map((comp) => {
                      const explored = exploredIds.has(comp.id);
                      return (
                        <button
                          key={comp.id}
                          type="button"
                          onClick={() => openComponentLearning(comp.id)}
                          className="w-full p-3 rounded-xl bg-slate-900/80 border border-white/10 hover:border-cyan-400 text-left flex items-center justify-between gap-2 cursor-pointer"
                        >
                          <div className="min-w-0">
                            <div className="font-sora font-bold text-xs text-white flex items-center gap-1.5">
                              <span className="truncate">{comp.name}</span>
                              {explored && (
                                <CheckCircle2 size={12} className="text-emerald-400 shrink-0" />
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400 truncate mt-0.5">
                              {comp.whatDoesItDo}
                            </div>
                          </div>
                          <span className="px-2 py-1 rounded-md bg-cyan-500/15 border border-cyan-400/30 font-mono-tech text-[10px] text-cyan-300 shrink-0">
                            Inspect
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* TAB 5: SAVED HARDWARE PROTOTYPES */}
              {activeTab === 'saved' && (
                <div className="space-y-3">
                  {savedPhones.length === 0 ? (
                    <div className="p-6 text-center rounded-xl bg-slate-900/60 border border-white/10 text-xs text-slate-400">
                      No saved smartphones yet. Click <strong>Save Lab</strong> above!
                    </div>
                  ) : (
                    savedPhones.map((item) => (
                      <div
                        key={item.id}
                        className="p-3 rounded-xl bg-slate-900/75 border border-white/10 flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <div className="font-sora font-semibold text-sm text-white truncate">
                            {item.title}
                          </div>
                          <div className="font-mono-tech text-[10px] text-cyan-300">
                            Est. ${item.estimatedCost} · Rating {item.designRating}/100
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              arcadeAudio.playSfx('click');
                              setState(normalizePhoneState(item.payload as Partial<PhoneDesignState>));
                              setEditingId(item.id);
                              showToast(`Loaded "${item.title}"`);
                            }}
                            className="px-2.5 py-1.5 rounded-lg bg-cyan-500/20 border border-cyan-400/40 text-cyan-200 text-xs font-sora cursor-pointer"
                          >
                            Load
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              arcadeAudio.playSfx('click');
                              void removeCreation(item.id, userId).then(refreshSaved);
                            }}
                            className="p-1.5 rounded-lg bg-slate-950 border border-white/10 text-rose-400 hover:border-rose-400 cursor-pointer"
                            title="Delete prototype"
                          >
                            <Trash2 size={14} />
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

      {/* LEARNING MODE INSPECTOR MODAL */}
      <LearningInspectorModal
        component={inspectedComp}
        exploredCount={exploredIds.size}
        totalComponents={PHONE_ENGINEERING_COMPONENTS.length}
        onClose={() => setInspectedComp(null)}
      />
    </div>
  );
};

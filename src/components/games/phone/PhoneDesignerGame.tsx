import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Camera,
  Check,
  Copy,
  Eye,
  FolderOpen,
  ImagePlus,
  Layers,
  Palette,
  Plus,
  RotateCcw,
  RotateCw,
  Save,
  Shuffle,
  Smartphone,
  Sparkles,
  Target,
  Trash2,
  X,
} from 'lucide-react';
import type { SavedCreation } from '../../../../shared/types.ts';
import { arcadeAudio } from '../../../audio/arcadeAudio.ts';
import { useArcade } from '../../../context/ArcadeContext.tsx';
import {
  getGuestOrUserId,
  listCreations,
  removeCreation,
  saveCreation,
} from '../../../utils/creationsStore.ts';
import {
  createInitialPhoneState,
  createRandomPhoneState,
  evaluatePhoneDesign,
  nextPhoneUid,
  PHONE_CHALLENGES,
  PHONE_COLORS,
  PHONE_COMPONENT_GROUPS,
  PHONE_COMPONENTS,
  PHONE_WALLPAPERS,
  type PhoneComponentDef,
  type PhoneComponentGroup,
  type PhoneDesignState,
  type PhoneFace,
  type PhoneSizePreset,
  type PlacedPhoneComponent,
} from './phoneCatalog.ts';

interface PhoneDesignerGameProps {
  onExit: () => void;
  initialDesign?: Partial<PhoneDesignState> | null;
  initialCreationId?: string | null;
}

const DEF_MAP = new Map(PHONE_COMPONENTS.map((d) => [d.id, d]));

export const PhoneDesignerGame: React.FC<PhoneDesignerGameProps> = ({
  onExit,
  initialDesign,
  initialCreationId,
}) => {
  const { player, updateLocalPlayer } = useArcade();
  const userId = getGuestOrUserId(player?.id);

  const [state, setState] = useState<PhoneDesignState>(() => {
    const base = createInitialPhoneState();
    return initialDesign ? { ...base, ...initialDesign } : base;
  });
  const [editingId, setEditingId] = useState<string | undefined>(initialCreationId || undefined);
  const [activeFace, setActiveFace] = useState<PhoneFace>('rear');
  const [activeGroup, setActiveGroup] = useState<PhoneComponentGroup>('camera');
  const [selectedUid, setSelectedUid] = useState<string | null>(null);
  const [rightTab, setRightTab] = useState<'studio' | 'challenges' | 'saved'>('studio');
  const [showcaseOpen, setShowcaseOpen] = useState(false);
  const [savedPhones, setSavedPhones] = useState<SavedCreation[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [snapGuides, setSnapGuides] = useState<{ x: boolean; y: boolean }>({ x: false, y: false });

  const canvasRef = useRef<HTMLDivElement>(null);
  const dragInfoRef = useRef<{
    uid: string;
    startClientX: number;
    startClientY: number;
    origX: number;
    origY: number;
  } | null>(null);

  const metrics = useMemo(() => evaluatePhoneDesign(state), [state]);
  const selectedComp = useMemo(
    () => state.components.find((c) => c.uid === selectedUid) || null,
    [state.components, selectedUid]
  );
  const selectedDef = selectedComp ? DEF_MAP.get(selectedComp.defId) || null : null;

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => {
      setToast((curr) => (curr === msg ? null : curr));
    }, 3400);
  }, []);

  const refreshSaved = useCallback(async () => {
    const list = await listCreations(userId, 'phone');
    setSavedPhones(list);
  }, [userId]);

  useEffect(() => {
    void refreshSaved();
  }, [refreshSaved]);

  const addComponentToCanvas = useCallback(
    (def: PhoneComponentDef, dropX?: number, dropY?: number, forceFace?: PhoneFace) => {
      arcadeAudio.playSfx('click');
      const targetFace = forceFace || (def.allowBothFaces ? activeFace : def.defaultFace);
      if (targetFace !== activeFace) setActiveFace(targetFace);
      const newComp: PlacedPhoneComponent = {
        uid: nextPhoneUid(),
        defId: def.id,
        face: targetFace,
        x: dropX ?? def.defaultX,
        y: dropY ?? def.defaultY,
        scale: 1,
        rotation: 0,
        color: def.defaultColor,
      };
      setState((prev) => ({
        ...prev,
        components: [...prev.components, newComp],
      }));
      setSelectedUid(newComp.uid);
    },
    [activeFace]
  );

  // Pointer drag inside Phone Canvas
  useEffect(() => {
    const onPointerMove = (e: PointerEvent) => {
      const drag = dragInfoRef.current;
      const box = canvasRef.current?.getBoundingClientRect();
      if (!drag || !box || box.width === 0 || box.height === 0) return;

      const dxPct = ((e.clientX - drag.startClientX) / box.width) * 100;
      const dyPct = ((e.clientY - drag.startClientY) / box.height) * 100;
      let nextX = Math.max(2, Math.min(98, drag.origX + dxPct));
      let nextY = Math.max(2, Math.min(98, drag.origY + dyPct));

      // Gentle magnetic center & grid snapping
      const snapX = Math.abs(nextX - 50) < 2.6;
      const snapY = Math.abs(nextY - 50) < 2.6;
      if (snapX) nextX = 50;
      if (snapY) nextY = 50;
      setSnapGuides({ x: snapX, y: snapY });

      setState((prev) => ({
        ...prev,
        components: prev.components.map((c) =>
          c.uid === drag.uid ? { ...c, x: Number(nextX.toFixed(1)), y: Number(nextY.toFixed(1)) } : c
        ),
      }));
    };

    const onPointerUp = () => {
      if (dragInfoRef.current) {
        dragInfoRef.current = null;
        setSnapGuides({ x: false, y: false });
      }
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    };
  }, []);

  const handlePaletteDragEnd = (def: PhoneComponentDef, e: React.DragEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    if (
      e.clientX >= rect.left &&
      e.clientX <= rect.right &&
      e.clientY >= rect.top &&
      e.clientY <= rect.bottom
    ) {
      const x = Math.max(5, Math.min(95, ((e.clientX - rect.left) / rect.width) * 100));
      const y = Math.max(4, Math.min(96, ((e.clientY - rect.top) / rect.height) * 100));
      addComponentToCanvas(def, Number(x.toFixed(1)), Number(y.toFixed(1)), activeFace);
    }
  };

  const handleWallpaperUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setState((prev) => ({ ...prev, customWallpaperDataUrl: reader.result as string }));
        showToast('Custom wallpaper applied!');
      }
    };
    reader.readAsDataURL(file);
  };

  const generateCompositePngDataUrl = useCallback((): string | null => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 760;
      canvas.height = 540;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      ctx.fillStyle = '#060A17';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Header text
      ctx.fillStyle = '#22D3EE';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText(state.deviceName || 'Next Smartphone', 36, 44);
      ctx.fillStyle = '#94A3B8';
      ctx.font = '14px monospace';
      ctx.fillText(
        `CG QUIZ STUDIO · Est. $${metrics.estimatedPrice} (Simulated) · Rating ${metrics.designRating}/100`,
        36,
        68
      );

      const drawPhone = (face: PhoneFace, px: number, py: number, pw: number, ph: number) => {
        ctx.save();
        ctx.fillStyle = face === 'front' ? '#090D16' : state.bodyColor;
        ctx.strokeStyle = '#94A3B8';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.roundRect(px, py, pw, ph, 34);
        ctx.fill();
        ctx.stroke();

        if (face === 'front') {
          const grad = ctx.createLinearGradient(px, py, px + pw, py + ph);
          grad.addColorStop(0, '#0F172A');
          grad.addColorStop(0.5, '#2563EB');
          grad.addColorStop(1, '#06B6D4');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.roundRect(px + 10, py + 10, pw - 20, ph - 20, 26);
          ctx.fill();
        }

        const comps = state.components.filter((c) => c.face === face);
        for (const comp of comps) {
          const def = DEF_MAP.get(comp.defId);
          if (!def) continue;
          const cx = px + (comp.x / 100) * pw;
          const cy = py + (comp.y / 100) * ph;
          const cw = (def.defaultW / 100) * pw * comp.scale;
          const ch = (def.defaultH / 100) * ph * comp.scale;
          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate((comp.rotation * Math.PI) / 180);
          ctx.fillStyle = comp.color;
          ctx.strokeStyle = 'rgba(255,255,255,0.45)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.roundRect(-cw / 2, -ch / 2, cw, ch, 10);
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        }

        ctx.fillStyle = '#CBD5E1';
        ctx.font = 'bold 13px monospace';
        ctx.fillText(face === 'front' ? 'FRONT VIEW' : 'REAR VIEW', px + pw / 2 - 42, py + ph + 26);
        ctx.restore();
      };

      drawPhone('front', 95, 102, 220, 395);
      drawPhone('rear', 435, 102, 220, 395);
      return canvas.toDataURL('image/png');
    } catch {
      return null;
    }
  }, [state, metrics]);

  const handleExportPng = () => {
    arcadeAudio.playSfx('click');
    const url = generateCompositePngDataUrl();
    if (!url) {
      showToast('Unable to export PNG.');
      return;
    }
    const a = document.createElement('a');
    a.href = url;
    a.download = `${state.deviceName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-cgstudio.png`;
    a.click();
    showToast('Exported Front + Rear concept PNG!');
  };

  const handleSaveDesign = async () => {
    arcadeAudio.playSfx('click');
    setSaving(true);
    const preview = generateCompositePngDataUrl();
    const res = await saveCreation({
      id: editingId,
      userId,
      type: 'phone',
      title: state.deviceName.trim() || 'Next Smartphone',
      subtitle: `${state.sizePreset.toUpperCase()} · ${state.thicknessMm.toFixed(1)}mm · ${metrics.partCount} parts`,
      designRating: metrics.designRating,
      estimatedCost: metrics.estimatedPrice,
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

  const activeWallpaper =
    PHONE_WALLPAPERS.find((w) => w.id === state.wallpaperId) || PHONE_WALLPAPERS[0];
  const phoneDimensions =
    state.sizePreset === 'compact'
      ? 'w-[248px] sm:w-[270px] h-[488px] sm:h-[528px]'
      : state.sizePreset === 'pro-max'
        ? 'w-[280px] sm:w-[312px] h-[550px] sm:h-[600px]'
        : 'w-[264px] sm:w-[290px] h-[520px] sm:h-[566px]';

  const activeChallenge = state.activeChallengeId
    ? PHONE_CHALLENGES.find((c) => c.id === state.activeChallengeId) || null
    : null;
  const challengeResult = activeChallenge ? activeChallenge.check(state, metrics.estimatedPrice) : null;

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col bg-[#050813] text-slate-100">
      {/* Top Studio Header Toolbar */}
      <div className="border-b border-purple-500/20 bg-[#080E20] px-3 sm:px-5 py-2.5 flex flex-wrap items-center justify-between gap-2">
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

          <input
            type="text"
            value={state.deviceName}
            onChange={(e) => setState((p) => ({ ...p, deviceName: e.target.value }))}
            maxLength={42}
            aria-label="Smartphone model name"
            className="studio-input px-2.5 py-1.5 text-sm font-heading font-bold w-36 sm:w-52 bg-[#0D162D]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={() => {
              arcadeAudio.playSfx('click');
              setState(createRandomPhoneState());
              setSelectedUid(null);
            }}
            className="studio-btn studio-btn-ghost text-xs px-2.5 py-1.5 min-h-[36px]"
          >
            <Shuffle size={14} />
            <span className="hidden sm:inline">Random Design</span>
          </button>

          <button
            type="button"
            onClick={() => {
              arcadeAudio.playSfx('click');
              setState(createInitialPhoneState());
              setSelectedUid(null);
            }}
            className="studio-btn studio-btn-ghost text-xs px-2.5 py-1.5 min-h-[36px]"
          >
            <RotateCcw size={14} />
            <span className="hidden sm:inline">Reset</span>
          </button>

          <button
            type="button"
            onClick={() => {
              arcadeAudio.playSfx('click');
              setShowcaseOpen(true);
            }}
            className="studio-btn studio-btn-purple text-xs px-3 py-1.5 min-h-[36px]"
          >
            <Eye size={14} />
            <span>Final Showcase</span>
          </button>

          <button
            type="button"
            disabled={saving}
            onClick={() => void handleSaveDesign()}
            className="studio-btn studio-btn-primary text-xs px-3 py-1.5 min-h-[36px]"
          >
            <Save size={14} />
            <span>{saving ? 'Saving...' : 'Save Design'}</span>
          </button>
        </div>
      </div>

      {/* Main 3-Column Interactive Studio */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 min-h-[640px]">
        {/* Left Sidebar: 5 Component Library Groups */}
        <aside className="lg:col-span-3 border-b lg:border-b-0 lg:border-r border-white/10 bg-[#080E20] flex flex-col max-h-[320px] lg:max-h-[calc(100vh-8rem)]">
          <div className="p-3 border-b border-white/10 flex gap-1.5 overflow-x-auto studio-scroll">
            {PHONE_COMPONENT_GROUPS.map((grp) => (
              <button
                key={grp.id}
                type="button"
                onClick={() => {
                  arcadeAudio.playSfx('click');
                  setActiveGroup(grp.id);
                }}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-sora font-semibold whitespace-nowrap cursor-pointer border transition-colors ${
                  activeGroup === grp.id
                    ? 'bg-purple-500/25 border-purple-400 text-purple-100'
                    : 'bg-slate-900/70 border-white/10 text-slate-300 hover:border-purple-400/40'
                }`}
              >
                {grp.label}
              </button>
            ))}
          </div>

          <div className="p-3 flex-1 overflow-y-auto studio-scroll space-y-2">
            <div className="font-mono-tech text-[10px] uppercase tracking-wider text-slate-400 px-1">
              Click or Drag Onto Phone Canvas
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-1 gap-2">
              {PHONE_COMPONENTS.filter((c) => c.group === activeGroup).map((def) => (
                <div
                  key={def.id}
                  draggable
                  onDragEnd={(e) => handlePaletteDragEnd(def, e)}
                  onClick={() => addComponentToCanvas(def)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      addComponentToCanvas(def);
                    }
                  }}
                  className="p-2.5 rounded-xl bg-slate-900/75 border border-white/10 hover:border-cyan-400/50 flex items-center justify-between gap-2 cursor-pointer transition-all group"
                >
                  <div className="min-w-0">
                    <div className="font-sora font-semibold text-xs text-white truncate">
                      {def.name}
                    </div>
                    <div className="font-mono-tech text-[10px] text-slate-400">
                      {def.allowBothFaces ? 'Front / Rear' : def.defaultFace === 'front' ? 'Front View' : 'Rear View'} · +${def.priceDelta}
                    </div>
                  </div>
                  <div className="w-7 h-7 rounded-lg bg-cyan-500/15 border border-cyan-400/30 text-cyan-300 flex items-center justify-center shrink-0 group-hover:bg-cyan-400 group-hover:text-[#060A17] transition-colors">
                    <Plus size={14} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* Center Canvas: Realistic Phone Hardware Front & Rear Workbench */}
        <main className="lg:col-span-5 relative flex flex-col items-center justify-center p-4 sm:p-6 bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.12)_0%,rgba(6,10,23,0.95)_70%)]">
          {/* Front / Rear Switcher + Simulated Price HUD */}
          <div className="w-full max-w-md flex flex-wrap items-center justify-between gap-2 mb-4">
            <div className="inline-flex rounded-xl bg-slate-900/90 border border-white/15 p-1">
              {(['rear', 'front'] as const).map((face) => (
                <button
                  key={face}
                  type="button"
                  onClick={() => {
                    arcadeAudio.playSfx('click');
                    setActiveFace(face);
                    setSelectedUid(null);
                  }}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-sora font-semibold cursor-pointer transition-colors ${
                    activeFace === face
                      ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {face === 'front' ? 'Front Display' : 'Rear Chassis'}
                </button>
              ))}
            </div>

            <div
              className="px-3 py-1.5 rounded-xl bg-slate-900/90 border border-cyan-400/30 font-mono-tech text-xs tabular-nums flex items-center gap-2"
              title="Simulated fictional engineering cost estimate"
            >
              <span className="text-slate-400 text-[10px]">EST. COST</span>
              <span className="text-emerald-300 font-bold">${metrics.estimatedPrice}</span>
            </div>
          </div>

          {toast && (
            <div className="mb-3 px-3.5 py-2 rounded-xl bg-emerald-950/90 border border-emerald-400/50 text-emerald-100 text-xs font-sora flex items-center gap-2">
              <Check size={14} className="text-emerald-400" />
              <span>{toast}</span>
            </div>
          )}

          {/* Interactive Phone Frame */}
          <div
            ref={canvasRef}
            onClick={(e) => {
              if (e.target === e.currentTarget) setSelectedUid(null);
            }}
            className={`relative rounded-[44px] shadow-[0_30px_70px_-15px_rgba(0,0,0,0.85)] select-none touch-none transition-all duration-300 ${phoneDimensions}`}
            style={{
              backgroundColor: activeFace === 'front' ? '#070B14' : state.bodyColor,
              border:
                state.frameFinish === 'polished-steel'
                  ? '5px solid #E2E8F0'
                  : state.frameFinish === 'titanium'
                    ? '5px solid #94A3B8'
                    : state.frameFinish === 'carbon'
                      ? '5px solid #334155'
                      : '5px solid #64748B',
              boxShadow: `0 0 0 2px rgba(255,255,255,0.12), 0 32px 64px -18px rgba(0,0,0,0.9)`,
            }}
          >
            {/* Front Screen Wallpaper Layer */}
            {activeFace === 'front' && (
              <div
                className="absolute inset-[9px] rounded-[34px] overflow-hidden pointer-events-none"
                style={
                  state.customWallpaperDataUrl
                    ? {
                        backgroundImage: `url(${state.customWallpaperDataUrl})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                      }
                    : { background: activeWallpaper.gradient }
                }
              >
                {/* Realistic glass reflection sheen & clock */}
                <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/[0.06] to-white/[0.14]" />
                <div className="mt-12 text-center text-white/90 drop-shadow">
                  <div className="font-heading font-bold text-3xl tracking-tight tabular-nums">09:41</div>
                  <div className="font-mono-tech text-[10px] tracking-widest uppercase text-white/75 mt-0.5">
                    {state.deviceName}
                  </div>
                </div>
              </div>
            )}

            {/* Rear Glass Sheen Layer */}
            {activeFace === 'rear' && (
              <div className="absolute inset-[4px] rounded-[38px] overflow-hidden pointer-events-none bg-gradient-to-br from-white/15 via-transparent to-black/35" />
            )}

            {/* Magnetic Center Snap Guides */}
            {snapGuides.x && (
              <div className="absolute top-2 bottom-2 left-1/2 w-[1px] bg-cyan-400/80 pointer-events-none z-20" />
            )}
            {snapGuides.y && (
              <div className="absolute left-2 right-2 top-1/2 h-[1px] bg-cyan-400/80 pointer-events-none z-20" />
            )}

            {/* Placed Draggable Components */}
            {state.components
              .filter((c) => c.face === activeFace)
              .map((comp) => {
                const def = DEF_MAP.get(comp.defId);
                if (!def) return null;
                const isSelected = comp.uid === selectedUid;
                return (
                  <div
                    key={comp.uid}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      setSelectedUid(comp.uid);
                      dragInfoRef.current = {
                        uid: comp.uid,
                        startClientX: e.clientX,
                        startClientY: e.clientY,
                        origX: comp.x,
                        origY: comp.y,
                      };
                    }}
                    style={{
                      left: `${comp.x}%`,
                      top: `${comp.y}%`,
                      width: `${def.defaultW * comp.scale}%`,
                      height: `${def.defaultH * comp.scale}%`,
                      transform: `translate(-50%, -50%) rotate(${comp.rotation}deg)`,
                    }}
                    className={`absolute cursor-move z-10 touch-none flex items-center justify-center ${
                      isSelected ? 'ring-2 ring-cyan-400 ring-offset-2 ring-offset-transparent rounded-xl z-20' : ''
                    }`}
                  >
                    <PhoneComponentGraphic def={def} color={comp.color} />
                  </div>
                );
              })}
          </div>

          <div className="mt-3 font-mono-tech text-[11px] text-slate-400 flex items-center gap-4">
            <span>{state.thicknessMm.toFixed(1)} mm profile</span>
            <span>·</span>
            <span>Simulated fictional cost & rating ({metrics.designRating}/100)</span>
          </div>
        </main>

        {/* Right Sidebar: Selected Part Controls, Color & Wallpaper Studio, Challenges, Saved */}
        <aside className="lg:col-span-4 border-t lg:border-t-0 lg:border-l border-white/10 bg-[#080E20] flex flex-col max-h-[540px] lg:max-h-[calc(100vh-8rem)]">
          <div className="grid grid-cols-3 border-b border-white/10 p-1.5 gap-1 bg-[#060A17]">
            {(
              [
                { id: 'studio', label: 'Inspector', icon: <Palette size={14} /> },
                { id: 'challenges', label: 'Challenges', icon: <Target size={14} /> },
                { id: 'saved', label: `Saved (${savedPhones.length})`, icon: <FolderOpen size={14} /> },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  arcadeAudio.playSfx('click');
                  setRightTab(tab.id);
                }}
                className={`py-2 px-2 rounded-lg text-xs font-sora font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                  rightTab === tab.id
                    ? 'bg-gradient-to-r from-indigo-600/35 to-purple-500/25 text-purple-100 border border-purple-400/40'
                    : 'text-slate-400 hover:text-white border border-transparent'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto studio-scroll p-4 space-y-5">
            {rightTab === 'studio' && (
              <>
                {/* Selected Component Properties */}
                {selectedComp && selectedDef ? (
                  <div className="p-3.5 rounded-2xl bg-purple-500/10 border border-purple-400/35 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="font-mono-tech text-[10px] uppercase text-purple-300">Selected Part</div>
                        <div className="font-sora font-bold text-sm text-white">{selectedDef.name}</div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            arcadeAudio.playSfx('click');
                            const clone: PlacedPhoneComponent = {
                              ...selectedComp,
                              uid: nextPhoneUid(),
                              x: Math.min(94, selectedComp.x + 6),
                              y: Math.min(94, selectedComp.y + 6),
                            };
                            setState((p) => ({ ...p, components: [...p.components, clone] }));
                            setSelectedUid(clone.uid);
                          }}
                          title="Duplicate part"
                          className="p-1.5 rounded-lg bg-slate-900 border border-white/10 hover:border-cyan-400 text-cyan-300 cursor-pointer"
                        >
                          <Copy size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            arcadeAudio.playSfx('click');
                            setState((p) => ({
                              ...p,
                              components: p.components.filter((c) => c.uid !== selectedComp.uid),
                            }));
                            setSelectedUid(null);
                          }}
                          title="Remove part"
                          className="p-1.5 rounded-lg bg-slate-900 border border-white/10 hover:border-rose-400 text-rose-400 cursor-pointer"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    {/* Resize Scale */}
                    <div>
                      <div className="flex justify-between text-[11px] font-mono-tech text-slate-300 mb-1">
                        <span>SIZE SCALE</span>
                        <span className="text-cyan-300">{selectedComp.scale.toFixed(2)}x</span>
                      </div>
                      <input
                        type="range"
                        min={0.6}
                        max={1.75}
                        step={0.05}
                        value={selectedComp.scale}
                        onChange={(e) => {
                          const scale = Number(e.target.value);
                          setState((p) => ({
                            ...p,
                            components: p.components.map((c) => (c.uid === selectedComp.uid ? { ...c, scale } : c)),
                          }));
                        }}
                        className="w-full accent-purple-400"
                      />
                    </div>

                    {/* Rotate */}
                    <div>
                      <div className="flex justify-between text-[11px] font-mono-tech text-slate-300 mb-1">
                        <span>ROTATION</span>
                        <span className="text-cyan-300">{selectedComp.rotation}°</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="range"
                          min={-180}
                          max={180}
                          step={5}
                          value={selectedComp.rotation}
                          onChange={(e) => {
                            const rotation = Number(e.target.value);
                            setState((p) => ({
                              ...p,
                              components: p.components.map((c) =>
                                c.uid === selectedComp.uid ? { ...c, rotation } : c
                              ),
                            }));
                          }}
                          className="flex-1 accent-purple-400"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setState((p) => ({
                              ...p,
                              components: p.components.map((c) =>
                                c.uid === selectedComp.uid ? { ...c, rotation: (c.rotation + 90) % 360 } : c
                              ),
                            }));
                          }}
                          title="Rotate 90 degrees"
                          className="p-1.5 rounded-lg bg-slate-900 border border-white/10 text-slate-200 cursor-pointer"
                        >
                          <RotateCw size={13} />
                        </button>
                      </div>
                    </div>

                    {/* Part Accent Color */}
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-xs font-sora text-slate-300">Part Tint / Finish</span>
                      <input
                        type="color"
                        value={selectedComp.color}
                        onChange={(e) => {
                          const color = e.target.value;
                          setState((p) => ({
                            ...p,
                            components: p.components.map((c) => (c.uid === selectedComp.uid ? { ...c, color } : c)),
                          }));
                        }}
                        className="w-9 h-7 rounded cursor-pointer bg-transparent border-0"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-slate-900/60 border border-white/10 text-xs text-slate-400 flex items-center gap-2">
                    <Layers size={15} className="text-cyan-400 shrink-0" />
                    <span>Tap any component on the phone canvas to move, resize, rotate, or tint it.</span>
                  </div>
                )}

                {/* Chassis Color Studio (10 Colors + Custom) */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-mono-tech text-xs text-cyan-300 uppercase">Chassis Color Studio</span>
                    <input
                      type="color"
                      value={state.bodyColor}
                      onChange={(e) => setState((p) => ({ ...p, bodyColor: e.target.value }))}
                      aria-label="Custom smartphone color"
                      className="w-8 h-6 rounded cursor-pointer bg-transparent border-0"
                    />
                  </div>
                  <div className="grid grid-cols-5 gap-2">
                    {PHONE_COLORS.map((c) => (
                      <button
                        key={c.hex}
                        type="button"
                        onClick={() => {
                          arcadeAudio.playSfx('click');
                          setState((p) => ({ ...p, bodyColor: c.hex }));
                        }}
                        title={c.name}
                        className={`h-9 rounded-xl border-2 cursor-pointer transition-transform hover:scale-105 ${
                          state.bodyColor.toLowerCase() === c.hex.toLowerCase()
                            ? 'border-white ring-2 ring-cyan-400'
                            : 'border-white/15'
                        }`}
                        style={{ backgroundColor: c.hex }}
                      />
                    ))}
                  </div>
                </div>

                {/* Form Factor & Thinness */}
                <div className="space-y-3 p-3.5 rounded-xl bg-slate-900/70 border border-white/10">
                  <div className="font-mono-tech text-xs text-cyan-300 uppercase">Form Factor & Thinness</div>
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
                            ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200'
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
                      min={5.2}
                      max={9.2}
                      step={0.1}
                      value={state.thicknessMm}
                      onChange={(e) => setState((p) => ({ ...p, thicknessMm: Number(e.target.value) }))}
                      className="w-full accent-cyan-400"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-1.5">
                    {(
                      [
                        { id: 'titanium', label: 'Brushed Titanium' },
                        { id: 'polished-steel', label: 'Polished Steel' },
                        { id: 'matte-aluminum', label: 'Matte Aluminum' },
                        { id: 'carbon', label: 'Forged Carbon' },
                      ] as const
                    ).map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => {
                          arcadeAudio.playSfx('click');
                          setState((p) => ({ ...p, frameFinish: f.id }));
                        }}
                        className={`py-1.5 px-2 rounded-lg text-[11px] font-sora border cursor-pointer ${
                          state.frameFinish === f.id
                            ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200'
                            : 'bg-slate-950/60 border-white/10 text-slate-300'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Screen Wallpaper Studio */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-mono-tech text-xs text-cyan-300 uppercase">Screen Wallpaper</span>
                    <label className="text-[11px] font-sora text-cyan-300 hover:underline cursor-pointer flex items-center gap-1">
                      <ImagePlus size={13} /> Upload Image
                      <input type="file" accept="image/*" onChange={handleWallpaperUpload} className="hidden" />
                    </label>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {PHONE_WALLPAPERS.map((wp) => (
                      <button
                        key={wp.id}
                        type="button"
                        onClick={() => {
                          arcadeAudio.playSfx('click');
                          setState((p) => ({ ...p, wallpaperId: wp.id, customWallpaperDataUrl: null }));
                          if (activeFace !== 'front') setActiveFace('front');
                        }}
                        className={`h-12 rounded-xl border-2 p-1 flex items-end text-[10px] font-sora text-white cursor-pointer ${
                          !state.customWallpaperDataUrl && state.wallpaperId === wp.id
                            ? 'border-white ring-2 ring-cyan-400'
                            : 'border-white/15'
                        }`}
                        style={{ background: wp.gradient }}
                      >
                        <span className="truncate drop-shadow font-semibold">{wp.name.split(' ')[0]}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* TAB 2: 5 DESIGN CHALLENGES */}
            {rightTab === 'challenges' && (
              <div className="space-y-3">
                <div className="font-mono-tech text-xs text-purple-300 uppercase">Engineering Briefs</div>
                {PHONE_CHALLENGES.map((ch) => {
                  const res = ch.check(state, metrics.estimatedPrice);
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
                      className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                        res.passed
                          ? 'bg-emerald-500/15 border-emerald-400/50'
                          : isActive
                            ? 'bg-purple-500/15 border-purple-400'
                            : 'bg-slate-900/70 border-white/10 hover:border-purple-400/40'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-sora font-bold text-sm text-white">{ch.title}</div>
                        <span
                          className={`font-mono-tech text-[10px] px-2 py-0.5 rounded-md ${
                            res.passed
                              ? 'bg-emerald-500/25 text-emerald-200 border border-emerald-400/40'
                              : 'bg-slate-800 text-slate-300'
                          }`}
                        >
                          {res.passed ? 'PASSED' : 'ACTIVE'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">{ch.description}</p>
                      <div className="mt-2.5 space-y-1">
                        {res.checklist.map((item) => (
                          <div key={item.label} className="text-[11px] flex items-center gap-1.5">
                            <span className={item.ok ? 'text-emerald-400' : 'text-slate-500'}>
                              {item.ok ? '✓' : '○'}
                            </span>
                            <span className={item.ok ? 'text-emerald-200' : 'text-slate-400'}>{item.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* TAB 3: SAVED SMARTPHONES */}
            {rightTab === 'saved' && (
              <div className="space-y-3">
                {savedPhones.length === 0 ? (
                  <div className="p-6 text-center rounded-xl bg-slate-900/60 border border-white/10 text-xs text-slate-400">
                    No saved smartphones yet. Click <strong>Save Design</strong> in the top bar!
                  </div>
                ) : (
                  savedPhones.map((item) => (
                    <div
                      key={item.id}
                      className="p-3 rounded-xl bg-slate-900/75 border border-white/10 flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="font-sora font-semibold text-sm text-white truncate">{item.title}</div>
                        <div className="font-mono-tech text-[10px] text-cyan-300">
                          Est. ${item.estimatedCost} · Rating {item.designRating}/100
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            arcadeAudio.playSfx('click');
                            const payload = item.payload as Partial<PhoneDesignState>;
                            setState({ ...createInitialPhoneState(), ...payload });
                            setEditingId(item.id);
                            setRightTab('studio');
                          }}
                          className="studio-btn studio-btn-primary text-[11px] px-2.5 py-1 min-h-[30px]"
                        >
                          Open
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            arcadeAudio.playSfx('click');
                            await removeCreation(item.id, userId);
                            await refreshSaved();
                          }}
                          aria-label={`Delete ${item.title}`}
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

          {/* Active Challenge Live Mini Banner */}
          {activeChallenge && challengeResult && (
            <div className="border-t border-white/10 bg-[#060A17] px-4 py-2.5 text-xs flex items-center justify-between">
              <span className="font-sora text-purple-200 truncate">{activeChallenge.title}</span>
              <span className={`font-mono-tech font-bold ${challengeResult.passed ? 'text-emerald-400' : 'text-amber-300'}`}>
                {challengeResult.passed ? 'CHALLENGE COMPLETE!' : `${challengeResult.checklist.filter((c) => c.ok).length}/${challengeResult.checklist.length}`}
              </span>
            </div>
          )}
        </aside>
      </div>

      {/* FINAL PRODUCT SHOWCASE MODAL */}
      {showcaseOpen && (
        <div
          className="fixed inset-0 z-50 bg-[#020617]/88 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setShowcaseOpen(false)}
        >
          <div
            className="studio-card-solid max-w-4xl w-full p-6 sm:p-8 border border-cyan-400/35 space-y-6 my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="font-mono-tech text-xs uppercase tracking-widest text-cyan-300 flex items-center gap-1.5">
                  <Sparkles size={14} /> Final Product Reveal
                </div>
                <h2 className="font-heading font-bold text-2xl sm:text-3xl text-white mt-1">
                  {state.deviceName}
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Simulated Est. Price: <strong className="text-emerald-300 font-mono-tech">${metrics.estimatedPrice}</strong> (fictional educational calculation) · Design Rating: <strong className="text-cyan-300 font-mono-tech">{metrics.designRating}/100</strong> · {state.thicknessMm.toFixed(1)}mm
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowcaseOpen(false)}
                className="studio-btn studio-btn-ghost p-2 min-h-[36px]"
              >
                <X size={16} />
              </button>
            </div>

            {/* Dual Side-by-Side Front + Rear Render */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 place-items-center bg-slate-950/70 rounded-2xl p-6 border border-white/10">
              {(['front', 'rear'] as const).map((face) => (
                <div key={face} className="flex flex-col items-center gap-3">
                  <div
                    className="relative w-[200px] h-[390px] rounded-[34px] border-4 border-slate-400 shadow-2xl overflow-hidden"
                    style={{
                      backgroundColor: face === 'front' ? '#070B14' : state.bodyColor,
                    }}
                  >
                    {face === 'front' && (
                      <div
                        className="absolute inset-[6px] rounded-[26px]"
                        style={
                          state.customWallpaperDataUrl
                            ? {
                                backgroundImage: `url(${state.customWallpaperDataUrl})`,
                                backgroundSize: 'cover',
                                backgroundPosition: 'center',
                              }
                            : { background: activeWallpaper.gradient }
                        }
                      />
                    )}
                    {state.components
                      .filter((c) => c.face === face)
                      .map((comp) => {
                        const def = DEF_MAP.get(comp.defId);
                        if (!def) return null;
                        return (
                          <div
                            key={comp.uid}
                            style={{
                              left: `${comp.x}%`,
                              top: `${comp.y}%`,
                              width: `${def.defaultW * comp.scale}%`,
                              height: `${def.defaultH * comp.scale}%`,
                              transform: `translate(-50%, -50%) rotate(${comp.rotation}deg)`,
                            }}
                            className="absolute flex items-center justify-center"
                          >
                            <PhoneComponentGraphic def={def} color={comp.color} />
                          </div>
                        );
                      })}
                  </div>
                  <span className="font-mono-tech text-xs uppercase text-slate-300">
                    {face === 'front' ? 'Front Display' : 'Rear Hardware'}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowcaseOpen(false);
                  }}
                  className="studio-btn studio-btn-ghost text-xs sm:text-sm"
                >
                  Edit Again
                </button>
                <button
                  type="button"
                  onClick={() => {
                    arcadeAudio.playSfx('click');
                    setState(createRandomPhoneState());
                  }}
                  className="studio-btn studio-btn-ghost text-xs sm:text-sm"
                >
                  <Shuffle size={14} /> Random Design
                </button>
                <button
                  type="button"
                  onClick={handleExportPng}
                  className="studio-btn studio-btn-ghost text-xs sm:text-sm"
                >
                  <Camera size={14} /> Export PNG
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={onExit}
                  className="studio-btn studio-btn-ghost text-xs sm:text-sm"
                >
                  Back to Arena
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void handleSaveDesign()}
                  className="studio-btn studio-btn-primary text-xs sm:text-sm"
                >
                  <Save size={14} /> {saving ? 'Saving...' : 'Save Design'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* Crisp Vector Hardware Renderer for Every Component Kind */
const PhoneComponentGraphic: React.FC<{ def: PhoneComponentDef; color: string }> = ({ def, color }) => {
  const Lens = ({ className = '' }: { className?: string }) => (
    <div className={`rounded-full bg-slate-950 border-2 border-slate-500 flex items-center justify-center shadow-inner ${className}`}>
      <div className="w-[48%] h-[48%] rounded-full bg-gradient-to-tr from-blue-900 via-cyan-500/60 to-slate-900 border border-cyan-300/40" />
    </div>
  );

  switch (def.kind) {
    case 'cam-single':
      return <Lens className="w-full h-full" />;
    case 'cam-dual':
      return (
        <div
          className="w-full h-full rounded-2xl border border-white/25 p-1.5 flex flex-col justify-between items-center shadow-lg"
          style={{ backgroundColor: color }}
        >
          <Lens className="w-7 h-7" />
          <Lens className="w-7 h-7" />
        </div>
      );
    case 'cam-triple':
      return (
        <div
          className="w-full h-full rounded-3xl border border-white/25 p-2 grid grid-cols-2 grid-rows-2 gap-1.5 place-items-center shadow-xl"
          style={{ backgroundColor: color }}
        >
          <Lens className="w-7 h-7" />
          <div className="row-span-2 flex items-center">
            <Lens className="w-7 h-7" />
          </div>
          <Lens className="w-7 h-7" />
        </div>
      );
    case 'cam-quad':
      return (
        <div
          className="w-full h-full rounded-3xl border border-white/25 p-2 grid grid-cols-2 grid-rows-2 gap-1.5 place-items-center shadow-xl"
          style={{ backgroundColor: color }}
        >
          <Lens className="w-7 h-7" />
          <Lens className="w-7 h-7" />
          <Lens className="w-7 h-7" />
          <Lens className="w-7 h-7" />
        </div>
      );
    case 'cam-giant':
      return (
        <div
          className="w-full h-full rounded-full border-2 border-cyan-400/50 p-2 grid grid-cols-2 grid-rows-2 gap-1 place-items-center shadow-2xl"
          style={{ backgroundColor: color }}
        >
          <Lens className="w-7 h-7" />
          <Lens className="w-7 h-7" />
          <Lens className="w-6 h-6" />
          <div className="w-4 h-4 rounded-full bg-amber-200 border border-white" />
        </div>
      );
    case 'cam-periscope':
      return (
        <div
          className="w-full h-full rounded-2xl border border-white/25 px-2 py-1.5 flex items-center justify-between shadow-lg"
          style={{ backgroundColor: color }}
        >
          <Lens className="w-6 h-6" />
          <div className="w-7 h-5 rounded-md bg-slate-950 border border-cyan-400/50 flex items-center justify-center">
            <div className="w-3.5 h-3.5 rounded-sm bg-cyan-900 border border-cyan-300/60" />
          </div>
        </div>
      );
    case 'disp-island':
      return (
        <div
          className="w-full h-full rounded-full border border-white/15 flex items-center justify-between px-2.5"
          style={{ backgroundColor: color }}
        >
          <div className="w-2.5 h-2.5 rounded-full bg-blue-950 border border-cyan-400/40" />
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400/80" />
        </div>
      );
    case 'disp-notch':
      return (
        <div
          className="w-full h-full rounded-b-2xl border-b border-x border-white/15 flex items-center justify-center gap-2"
          style={{ backgroundColor: color }}
        >
          <div className="w-6 h-1 rounded-full bg-slate-700" />
          <div className="w-2 h-2 rounded-full bg-blue-900" />
        </div>
      );
    case 'disp-punch':
      return <div className="w-4 h-4 rounded-full border border-cyan-300/40" style={{ backgroundColor: color }} />;
    case 'disp-clean':
      return (
        <div className="w-full h-full rounded-xl border border-cyan-400/35 bg-cyan-500/10 flex items-center justify-center font-mono-tech text-[9px] text-cyan-200">
          EDGE-TO-EDGE OLED
        </div>
      );
    case 'disp-foldable':
      return (
        <div
          className="w-full h-full rounded-md border-x border-white/30 bg-gradient-to-r from-slate-700 via-slate-300 to-slate-700 opacity-85"
          style={{ borderColor: color }}
        />
      );
    case 'btn-power':
    case 'btn-volume':
    case 'btn-action':
    case 'btn-custom':
      return (
        <div
          className="w-full h-full rounded-full border border-white/40 shadow"
          style={{ backgroundColor: color }}
        />
      );
    case 'hw-usbc':
      return (
        <div className="w-full h-full rounded-full bg-slate-950 border-2 flex items-center justify-center" style={{ borderColor: color }}>
          <div className="w-[70%] h-[35%] rounded-full bg-slate-500" />
        </div>
      );
    case 'hw-speaker':
      return (
        <div className="w-full h-full flex items-center justify-center gap-1">
          {[0, 1, 2, 3, 4].map((d) => (
            <span key={d} className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
          ))}
        </div>
      );
    case 'hw-coil':
      return (
        <div
          className="w-full h-full rounded-full border-4 flex flex-col items-center justify-center"
          style={{ borderColor: color }}
        >
          <div className="w-2 h-4 rounded-full mt-14" style={{ backgroundColor: color }} />
        </div>
      );
    case 'hw-fingerprint':
      return (
        <div
          className="w-full h-full rounded-full border-2 border-dashed flex items-center justify-center bg-cyan-500/10"
          style={{ borderColor: color }}
        >
          <Smartphone size={12} style={{ color }} />
        </div>
      );
    case 'des-logo':
      return (
        <div
          className="w-full h-full rounded-xl border border-white/25 flex items-center justify-center font-heading font-bold text-xs tracking-tight bg-white/5"
          style={{ color }}
        >
          CG
        </div>
      );
    case 'des-ring':
      return (
        <div
          className="w-full h-full rounded-full border-[3px]"
          style={{ borderColor: color }}
        />
      );
    case 'des-flash':
      return (
        <div
          className="w-full h-full rounded-full border border-white/60 shadow-[0_0_12px_rgba(254,240,138,0.65)]"
          style={{ backgroundColor: color }}
        />
      );
    case 'des-frame':
      return (
        <div
          className="w-full h-full rounded-2xl border-2 bg-white/5"
          style={{ borderColor: color }}
        />
      );
    default:
      return (
        <div
          className="w-full h-full rounded-full opacity-85 shadow-md"
          style={{ backgroundColor: color }}
        />
      );
  }
};

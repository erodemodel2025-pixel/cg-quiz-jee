export type PhoneComponentGroup = 'camera' | 'display' | 'buttons' | 'hardware' | 'design';
export type PhoneFace = 'front' | 'rear';

export interface PhoneComponentDef {
  id: string;
  group: PhoneComponentGroup;
  name: string;
  defaultFace: PhoneFace;
  allowBothFaces?: boolean;
  priceDelta: number;
  defaultW: number; // % of phone width
  defaultH: number; // % of phone height
  defaultX: number; // % center X
  defaultY: number; // % center Y
  defaultColor: string;
  kind:
    | 'cam-single'
    | 'cam-dual'
    | 'cam-triple'
    | 'cam-quad'
    | 'cam-giant'
    | 'cam-periscope'
    | 'disp-island'
    | 'disp-notch'
    | 'disp-punch'
    | 'disp-clean'
    | 'disp-foldable'
    | 'btn-power'
    | 'btn-volume'
    | 'btn-action'
    | 'btn-custom'
    | 'hw-usbc'
    | 'hw-speaker'
    | 'hw-coil'
    | 'hw-fingerprint'
    | 'des-logo'
    | 'des-ring'
    | 'des-flash'
    | 'des-frame'
    | 'des-strip';
}

export interface PlacedPhoneComponent {
  uid: string;
  defId: string;
  face: PhoneFace;
  x: number; // 0..100 %
  y: number; // 0..100 %
  scale: number; // 0.6..1.8
  rotation: number; // -180..180
  color: string;
}

export type PhoneSizePreset = 'compact' | 'standard' | 'pro-max';

export interface PhoneDesignState {
  deviceName: string;
  sizePreset: PhoneSizePreset;
  thicknessMm: number;
  bodyColor: string;
  frameFinish: 'titanium' | 'polished-steel' | 'matte-aluminum' | 'carbon';
  wallpaperId: string;
  customWallpaperDataUrl?: string | null;
  components: PlacedPhoneComponent[];
  activeChallengeId: string | null;
}

export const PHONE_COMPONENT_GROUPS: Array<{ id: PhoneComponentGroup; label: string }> = [
  { id: 'camera', label: 'Camera' },
  { id: 'display', label: 'Display' },
  { id: 'buttons', label: 'Buttons' },
  { id: 'hardware', label: 'Hardware' },
  { id: 'design', label: 'Design Elements' },
];

export const PHONE_COMPONENTS: PhoneComponentDef[] = [
  // Camera
  { id: 'cam-single', group: 'camera', name: 'Single Lens', defaultFace: 'rear', priceDelta: 35, defaultW: 16, defaultH: 10, defaultX: 25, defaultY: 16, defaultColor: '#1E293B', kind: 'cam-single' },
  { id: 'cam-dual', group: 'camera', name: 'Dual Matrix', defaultFace: 'rear', priceDelta: 65, defaultW: 22, defaultH: 18, defaultX: 28, defaultY: 18, defaultColor: '#0F172A', kind: 'cam-dual' },
  { id: 'cam-triple', group: 'camera', name: 'Triple Pro Array', defaultFace: 'rear', priceDelta: 115, defaultW: 34, defaultH: 21, defaultX: 31, defaultY: 19, defaultColor: '#111827', kind: 'cam-triple' },
  { id: 'cam-quad', group: 'camera', name: 'Quad Cinema', defaultFace: 'rear', priceDelta: 150, defaultW: 36, defaultH: 23, defaultX: 32, defaultY: 20, defaultColor: '#090D16', kind: 'cam-quad' },
  { id: 'cam-giant', group: 'camera', name: 'Giant Halo Island', defaultFace: 'rear', priceDelta: 175, defaultW: 44, defaultH: 25, defaultX: 50, defaultY: 22, defaultColor: '#172033', kind: 'cam-giant' },
  { id: 'cam-periscope', group: 'camera', name: 'Periscope 10x Zoom', defaultFace: 'rear', priceDelta: 130, defaultW: 26, defaultH: 13, defaultX: 32, defaultY: 18, defaultColor: '#1E293B', kind: 'cam-periscope' },

  // Display
  { id: 'disp-island', group: 'display', name: 'Dynamic Capsule', defaultFace: 'front', priceDelta: 45, defaultW: 34, defaultH: 6, defaultX: 50, defaultY: 7, defaultColor: '#020617', kind: 'disp-island' },
  { id: 'disp-notch', group: 'display', name: 'Compact Notch', defaultFace: 'front', priceDelta: 25, defaultW: 40, defaultH: 6, defaultX: 50, defaultY: 4, defaultColor: '#020617', kind: 'disp-notch' },
  { id: 'disp-punch', group: 'display', name: 'Micro Punch-Hole', defaultFace: 'front', priceDelta: 30, defaultW: 9, defaultH: 5.5, defaultX: 50, defaultY: 6.5, defaultColor: '#020617', kind: 'disp-punch' },
  { id: 'disp-clean', group: 'display', name: 'Under-Display Full Screen', defaultFace: 'front', priceDelta: 95, defaultW: 66, defaultH: 10, defaultX: 50, defaultY: 16, defaultColor: '#22D3EE', kind: 'disp-clean' },
  { id: 'disp-foldable', group: 'display', name: 'Foldable Hinge Spine', defaultFace: 'front', allowBothFaces: true, priceDelta: 220, defaultW: 10, defaultH: 92, defaultX: 50, defaultY: 50, defaultColor: '#94A3B8', kind: 'disp-foldable' },

  // Buttons
  { id: 'btn-power', group: 'buttons', name: 'Power Button', defaultFace: 'front', allowBothFaces: true, priceDelta: 10, defaultW: 5, defaultH: 12, defaultX: 98, defaultY: 34, defaultColor: '#CBD5E1', kind: 'btn-power' },
  { id: 'btn-volume', group: 'buttons', name: 'Volume Rocker', defaultFace: 'front', allowBothFaces: true, priceDelta: 12, defaultW: 5, defaultH: 18, defaultX: 2, defaultY: 32, defaultColor: '#CBD5E1', kind: 'btn-volume' },
  { id: 'btn-action', group: 'buttons', name: 'Action Trigger', defaultFace: 'front', allowBothFaces: true, priceDelta: 22, defaultW: 5.5, defaultH: 8, defaultX: 2, defaultY: 19, defaultColor: '#F59E0B', kind: 'btn-action' },
  { id: 'btn-custom', group: 'buttons', name: 'Custom Side Key', defaultFace: 'front', allowBothFaces: true, priceDelta: 28, defaultW: 5.5, defaultH: 10, defaultX: 98, defaultY: 56, defaultColor: '#22D3EE', kind: 'btn-custom' },

  // Hardware
  { id: 'hw-usbc', group: 'hardware', name: 'USB-C Port', defaultFace: 'front', allowBothFaces: true, priceDelta: 15, defaultW: 16, defaultH: 4.5, defaultX: 50, defaultY: 96, defaultColor: '#94A3B8', kind: 'hw-usbc' },
  { id: 'hw-speaker', group: 'hardware', name: 'Stereo Grille', defaultFace: 'front', allowBothFaces: true, priceDelta: 24, defaultW: 28, defaultH: 4, defaultX: 50, defaultY: 2.5, defaultColor: '#475569', kind: 'hw-speaker' },
  { id: 'hw-coil', group: 'hardware', name: 'Magnetic Coil Ring', defaultFace: 'rear', priceDelta: 40, defaultW: 36, defaultH: 22, defaultX: 50, defaultY: 54, defaultColor: '#38BDF8', kind: 'hw-coil' },
  { id: 'hw-fingerprint', group: 'hardware', name: 'Ultrasonic Sensor', defaultFace: 'front', allowBothFaces: true, priceDelta: 35, defaultW: 15, defaultH: 9, defaultX: 50, defaultY: 82, defaultColor: '#22D3EE', kind: 'hw-fingerprint' },

  // Design Elements
  { id: 'des-logo', group: 'design', name: 'Studio Emblem', defaultFace: 'rear', allowBothFaces: true, priceDelta: 18, defaultW: 18, defaultH: 11, defaultX: 50, defaultY: 48, defaultColor: '#E2E8F0', kind: 'des-logo' },
  { id: 'des-ring', group: 'design', name: 'Titanium Accent Ring', defaultFace: 'rear', allowBothFaces: true, priceDelta: 25, defaultW: 28, defaultH: 17, defaultX: 50, defaultY: 52, defaultColor: '#A855F7', kind: 'des-ring' },
  { id: 'des-flash', group: 'design', name: 'Quad-LED Flash', defaultFace: 'rear', priceDelta: 18, defaultW: 9, defaultH: 5.5, defaultX: 56, defaultY: 16, defaultColor: '#FEF08A', kind: 'des-flash' },
  { id: 'des-frame', group: 'design', name: 'Custom Trim Plate', defaultFace: 'rear', allowBothFaces: true, priceDelta: 32, defaultW: 78, defaultH: 14, defaultX: 50, defaultY: 78, defaultColor: '#3B82F6', kind: 'des-frame' },
  { id: 'des-strip', group: 'design', name: 'Racing Glow Strip', defaultFace: 'rear', allowBothFaces: true, priceDelta: 30, defaultW: 10, defaultH: 60, defaultX: 50, defaultY: 56, defaultColor: '#22D3EE', kind: 'des-strip' },
];

export const PHONE_COLORS = [
  { name: 'Midnight Titanium', hex: '#1E293B' },
  { name: 'Cosmic Indigo', hex: '#1E1B4B' },
  { name: 'Electric Blue', hex: '#2563EB' },
  { name: 'Cyber Cyan', hex: '#0891B2' },
  { name: 'Natural Titanium', hex: '#94A3B8' },
  { name: 'Glacier Frost', hex: '#E2E8F0' },
  { name: 'Crimson Studio', hex: '#DC2626' },
  { name: 'Emerald Jade', hex: '#059669' },
  { name: 'Solar Gold', hex: '#D97706' },
  { name: 'Ultraviolet', hex: '#7C3AED' },
];

export const PHONE_WALLPAPERS = [
  { id: 'midnight-wave', name: 'Midnight Wave', gradient: 'linear-gradient(155deg, #020617 0%, #1D4ED8 48%, #06B6D4 100%)' },
  { id: 'aurora-prism', name: 'Aurora Prism', gradient: 'linear-gradient(150deg, #0F172A 0%, #7C3AED 50%, #22D3EE 100%)' },
  { id: 'solar-horizon', name: 'Solar Horizon', gradient: 'linear-gradient(160deg, #1E1B4B 0%, #DB2777 52%, #F59E0B 100%)' },
  { id: 'emerald-circuit', name: 'Emerald Core', gradient: 'linear-gradient(155deg, #022C22 0%, #059669 55%, #38BDF8 100%)' },
  { id: 'obsidian-grid', name: 'Obsidian Minimal', gradient: 'linear-gradient(160deg, #030712 0%, #1E293B 60%, #334155 100%)' },
  { id: 'titanium-mesh', name: 'Titanium Satin', gradient: 'linear-gradient(150deg, #0F172A 0%, #475569 50%, #94A3B8 100%)' },
];

export interface PhoneChallenge {
  id: string;
  title: string;
  description: string;
  check: (state: PhoneDesignState, estPrice: number) => { passed: boolean; checklist: Array<{ label: string; ok: boolean }> };
}

export const PHONE_CHALLENGES: PhoneChallenge[] = [
  {
    id: 'thinnest',
    title: "World's Thinnest Phone",
    description: 'Engineer a sleek ultra-slim flagship at 5.8mm or thinner.',
    check: (state) => {
      const thin = state.thicknessMm <= 5.8;
      const rearCount = state.components.filter((c) => c.face === 'rear').length;
      const sleekRear = rearCount <= 3;
      const hasFront = state.components.some((c) => c.face === 'front');
      return {
        passed: thin && sleekRear && hasFront,
        checklist: [
          { label: `Thickness <= 5.8 mm (now ${state.thicknessMm.toFixed(1)} mm)`, ok: thin },
          { label: `Minimalist rear (<= 3 parts, now ${rearCount})`, ok: sleekRear },
          { label: 'Includes at least 1 front display/port element', ok: hasFront },
        ],
      };
    },
  },
  {
    id: 'gaming',
    title: 'Futuristic Gaming Phone',
    description: 'Build an esports handheld with trigger keys, full-screen edge display, and stereo cooling.',
    check: (state) => {
      const hasCleanScreen = state.components.some((c) => c.defId === 'disp-clean' || c.defId === 'disp-punch');
      const hasTrigger = state.components.some((c) => c.defId === 'btn-action' || c.defId === 'btn-custom');
      const hasSpeaker = state.components.some((c) => c.defId === 'hw-speaker');
      const hasGlow = state.components.some((c) => c.defId === 'des-strip' || c.defId === 'des-ring');
      return {
        passed: hasCleanScreen && hasTrigger && hasSpeaker && hasGlow,
        checklist: [
          { label: 'Clean Full-Screen or Micro Punch-Hole display', ok: hasCleanScreen },
          { label: 'Action Trigger or Custom Side Key', ok: hasTrigger },
          { label: 'Stereo Grille hardware', ok: hasSpeaker },
          { label: 'Glow Strip or Titanium Accent Ring', ok: hasGlow },
        ],
      };
    },
  },
  {
    id: 'photography',
    title: 'Pro Photography Flagship',
    description: 'Equip an optical powerhouse with pro camera optics, LED flash, and magnetic charging.',
    check: (state) => {
      const hasProCam = state.components.some((c) =>
        ['cam-triple', 'cam-quad', 'cam-giant', 'cam-periscope'].includes(c.defId)
      );
      const hasFlash = state.components.some((c) => c.defId === 'des-flash');
      const hasCoil = state.components.some((c) => c.defId === 'hw-coil');
      return {
        passed: hasProCam && hasFlash && hasCoil,
        checklist: [
          { label: 'Triple, Quad, Giant Halo, or Periscope camera', ok: hasProCam },
          { label: 'Quad-LED Flash module', ok: hasFlash },
          { label: 'Magnetic Wireless Charging Coil', ok: hasCoil },
        ],
      };
    },
  },
  {
    id: 'foldable',
    title: 'Next-Gen Foldable Device',
    description: 'Create a dual-panel foldable silhouette with hinge spine and multi-cam rear.',
    check: (state) => {
      const hasHinge = state.components.some((c) => c.defId === 'disp-foldable');
      const hasCam = state.components.some((c) => c.defId.startsWith('cam-'));
      const total = state.components.length >= 4;
      return {
        passed: hasHinge && hasCam && total,
        checklist: [
          { label: 'Foldable Hinge Spine installed', ok: hasHinge },
          { label: 'Rear camera system included', ok: hasCam },
          { label: `At least 4 total parts (now ${state.components.length})`, ok: total },
        ],
      };
    },
  },
  {
    id: 'budget',
    title: 'Budget-Friendly Champion',
    description: 'Deliver an accessible everyday device under $575 without sacrificing essentials.',
    check: (state, estPrice) => {
      const underBudget = estPrice <= 575;
      const hasCam = state.components.some((c) => c.defId.startsWith('cam-'));
      const hasUsbc = state.components.some((c) => c.defId === 'hw-usbc');
      const hasDisplay = state.components.some((c) => c.defId.startsWith('disp-'));
      return {
        passed: underBudget && hasCam && hasUsbc && hasDisplay,
        checklist: [
          { label: `Simulated cost <= $575 (now $${estPrice})`, ok: underBudget },
          { label: 'Camera module included', ok: hasCam },
          { label: 'Display module included', ok: hasDisplay },
          { label: 'USB-C Port included', ok: hasUsbc },
        ],
      };
    },
  },
];

let uidCounter = 1;
export function nextPhoneUid(): string {
  uidCounter += 1;
  return `pc_${Date.now()}_${uidCounter}_${Math.random().toString(36).slice(2, 5)}`;
}

export function createInitialPhoneState(): PhoneDesignState {
  return {
    deviceName: 'CG Horizon 17',
    sizePreset: 'standard',
    thicknessMm: 7.4,
    bodyColor: '#1E293B',
    frameFinish: 'titanium',
    wallpaperId: 'midnight-wave',
    customWallpaperDataUrl: null,
    activeChallengeId: null,
    components: [
      { uid: nextPhoneUid(), defId: 'disp-island', face: 'front', x: 50, y: 7, scale: 1, rotation: 0, color: '#020617' },
      { uid: nextPhoneUid(), defId: 'btn-power', face: 'front', x: 98, y: 34, scale: 1, rotation: 0, color: '#CBD5E1' },
      { uid: nextPhoneUid(), defId: 'btn-volume', face: 'front', x: 2, y: 32, scale: 1, rotation: 0, color: '#CBD5E1' },
      { uid: nextPhoneUid(), defId: 'hw-usbc', face: 'front', x: 50, y: 96, scale: 1, rotation: 0, color: '#94A3B8' },
      { uid: nextPhoneUid(), defId: 'cam-triple', face: 'rear', x: 31, y: 19, scale: 1, rotation: 0, color: '#111827' },
      { uid: nextPhoneUid(), defId: 'des-flash', face: 'rear', x: 54, y: 16, scale: 1, rotation: 0, color: '#FEF08A' },
      { uid: nextPhoneUid(), defId: 'hw-coil', face: 'rear', x: 50, y: 54, scale: 1, rotation: 0, color: '#38BDF8' },
      { uid: nextPhoneUid(), defId: 'des-logo', face: 'rear', x: 50, y: 54, scale: 0.9, rotation: 0, color: '#E2E8F0' },
    ],
  };
}

export function createRandomPhoneState(): PhoneDesignState {
  const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];
  const cams = PHONE_COMPONENTS.filter((c) => c.group === 'camera');
  const disps = PHONE_COMPONENTS.filter((c) => c.group === 'display');
  const cam = pick(cams);
  const disp = pick(disps);
  const body = pick(PHONE_COLORS).hex;
  const wp = pick(PHONE_WALLPAPERS).id;
  const comps: PlacedPhoneComponent[] = [
    { uid: nextPhoneUid(), defId: disp.id, face: 'front', x: disp.defaultX, y: disp.defaultY, scale: 1, rotation: 0, color: disp.defaultColor },
    { uid: nextPhoneUid(), defId: 'btn-power', face: 'front', x: 98, y: 34, scale: 1, rotation: 0, color: '#CBD5E1' },
    { uid: nextPhoneUid(), defId: 'btn-action', face: 'front', x: 2, y: 20, scale: 1, rotation: 0, color: '#22D3EE' },
    { uid: nextPhoneUid(), defId: 'hw-usbc', face: 'front', x: 50, y: 96, scale: 1, rotation: 0, color: '#94A3B8' },
    { uid: nextPhoneUid(), defId: cam.id, face: 'rear', x: cam.defaultX, y: cam.defaultY, scale: 1, rotation: 0, color: cam.defaultColor },
    { uid: nextPhoneUid(), defId: 'des-flash', face: 'rear', x: 58, y: 17, scale: 1, rotation: 0, color: '#FEF08A' },
    { uid: nextPhoneUid(), defId: 'des-ring', face: 'rear', x: 50, y: 54, scale: 1, rotation: 0, color: '#22D3EE' },
    { uid: nextPhoneUid(), defId: 'des-logo', face: 'rear', x: 50, y: 54, scale: 0.95, rotation: 0, color: '#F8FAFC' },
  ];
  return {
    deviceName: `Studio Phone ${Math.floor(16 + Math.random() * 14)}`,
    sizePreset: pick(['compact', 'standard', 'pro-max'] as const),
    thicknessMm: Number((5.6 + Math.random() * 2.8).toFixed(1)),
    bodyColor: body,
    frameFinish: pick(['titanium', 'polished-steel', 'matte-aluminum', 'carbon'] as const),
    wallpaperId: wp,
    customWallpaperDataUrl: null,
    activeChallengeId: null,
    components: comps,
  };
}

export function evaluatePhoneDesign(state: PhoneDesignState): {
  estimatedPrice: number;
  designRating: number;
  hasFrontDisplay: boolean;
  hasCamera: boolean;
  hasPort: boolean;
  partCount: number;
} {
  const defMap = new Map(PHONE_COMPONENTS.map((d) => [d.id, d]));
  const sizeMult = state.sizePreset === 'compact' ? -25 : state.sizePreset === 'pro-max' ? 75 : 0;
  const finishCost =
    state.frameFinish === 'titanium'
      ? 50
      : state.frameFinish === 'carbon'
        ? 65
        : state.frameFinish === 'polished-steel'
          ? 35
          : 0;
  const thinnessBonus = state.thicknessMm < 6.4 ? Math.round((6.4 - state.thicknessMm) * 45) : 0;

  let partsCost = 0;
  for (const c of state.components) {
    const def = defMap.get(c.defId);
    if (def) partsCost += def.priceDelta;
  }

  const estimatedPrice = Math.max(400, 400 + sizeMult + finishCost + thinnessBonus + partsCost);
  const hasFrontDisplay = state.components.some((c) => c.face === 'front' && c.defId.startsWith('disp-'));
  const hasCamera = state.components.some((c) => c.face === 'rear' && c.defId.startsWith('cam-'));
  const hasPort = state.components.some((c) => c.defId === 'hw-usbc' || c.defId === 'hw-coil');
  const partCount = state.components.length;

  const completeness = (hasFrontDisplay ? 10 : 0) + (hasCamera ? 10 : 0) + (hasPort ? 8 : 0);
  const balanceBonus = Math.min(12, partCount * 1.5);
  const designRating = Math.min(99, Math.max(55, Math.round(62 + completeness + balanceBonus)));

  return {
    estimatedPrice,
    designRating,
    hasFrontDisplay,
    hasCamera,
    hasPort,
    partCount,
  };
}

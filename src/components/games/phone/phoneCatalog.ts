export type PhoneComponentGroup = 'camera' | 'display' | 'buttons' | 'hardware' | 'design';
export type PhoneFace = 'front' | 'rear';

export interface PhoneComponentDef {
  id: string;
  group: PhoneComponentGroup;
  name: string;
  defaultFace: PhoneFace;
  allowBothFaces?: boolean;
  priceDelta: number;
  defaultW: number;
  defaultH: number;
  defaultX: number;
  defaultY: number;
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
  x: number;
  y: number;
  scale: number;
  rotation: number;
  color: string;
}

export type PhoneSizePreset = 'compact' | 'standard' | 'pro-max';
export type PhoneInspectionViewMode = 'assembled' | 'back-removed' | 'exploded';

export type PhoneBayId =
  | 'frame'
  | 'backPanel'
  | 'display'
  | 'soc'
  | 'memory'
  | 'cooling'
  | 'battery'
  | 'charging'
  | 'camera'
  | 'connectivity'
  | 'peripherals';

export interface PhoneBayConfig {
  frame: 'frame-alu' | 'frame-titanium' | 'frame-steel';
  backPanel: 'back-glass' | 'back-alu';
  display: 'disp-amoled-120' | 'disp-oled' | 'disp-lcd';
  soc: 'soc-flagship' | 'soc-mid';
  memory: 'ram-lpddr5x-storage' | 'ram-lpddr5-base';
  cooling: 'vapor-graphite' | 'graphite-only' | 'none';
  battery: 'bat-3400' | 'bat-4600' | 'bat-5500';
  charging: 'chg-65w-qi2' | 'chg-30w-usbc-only';
  camera: 'cam-pro-ois' | 'cam-dual-ois' | 'cam-single-basic';
  connectivity: 'conn-5g-wifi7' | 'conn-lte-wifi6';
  peripherals: 'full-ip68-taptic' | 'basic-seals';
}

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
  // Engineering Lab fields (optional on legacy saved creations)
  bays: PhoneBayConfig;
  viewMode: PhoneInspectionViewMode;
  assemblyStepIndex: number;
  installedBays: PhoneBayId[];
}

export interface BayOptionDef<K extends PhoneBayId = PhoneBayId> {
  value: PhoneBayConfig[K];
  label: string;
  shortSpec: string;
  costDelta: number;
  weightGrams: number;
  learnComponentId: string;
}

export const PHONE_BAY_OPTIONS: {
  [K in PhoneBayId]: {
    title: string;
    stepOrder: number;
    instruction: string;
    options: Array<BayOptionDef<K>>;
  };
} = {
  frame: {
    title: '1. Structural Mid-Frame',
    stepOrder: 1,
    instruction: 'Select perimeter chassis alloy before mounting internal logic modules.',
    options: [
      { value: 'frame-alu', label: '7000 Aluminum Chassis', shortSpec: '26g · High Thermal Conductivity', costDelta: 22, weightGrams: 26, learnComponentId: 'frame-alu' },
      { value: 'frame-titanium', label: 'Grade-5 Titanium + Al Core', shortSpec: '32g · High Yield Strength', costDelta: 68, weightGrams: 32, learnComponentId: 'frame-titanium' },
      { value: 'frame-steel', label: '316L Stainless Steel', shortSpec: '52g · Max Crush Stiffness', costDelta: 42, weightGrams: 52, learnComponentId: 'frame-steel' },
    ],
  },
  soc: {
    title: '2. SoC Silicon Die & PMIC',
    stepOrder: 2,
    instruction: 'Install the main System-on-Chip & multi-rail PMIC onto the logic PCB.',
    options: [
      { value: 'soc-flagship', label: 'Flagship 3nm Neural SoC + PMIC', shortSpec: '3.85 GHz · 9.8W Peak TDP (Sim)', costDelta: 165, weightGrams: 6, learnComponentId: 'soc-flagship' },
      { value: 'soc-mid', label: 'Balanced 6nm Efficiency SoC + PMIC', shortSpec: '2.65 GHz · 5.2W Peak TDP (Sim)', costDelta: 72, weightGrams: 6, learnComponentId: 'soc-mid' },
    ],
  },
  memory: {
    title: '3. Stacked Memory & NAND',
    stepOrder: 3,
    instruction: 'Mount PoP RAM and UFS flash storage alongside the SoC.',
    options: [
      { value: 'ram-lpddr5x-storage', label: '16GB LPDDR5X + 512GB UFS 4.0', shortSpec: '8,533 MT/s · 4,200 MB/s I/O (Sim)', costDelta: 81, weightGrams: 5, learnComponentId: 'ram-lpddr5x' },
      { value: 'ram-lpddr5-base', label: '8GB LPDDR5 + 128GB UFS 3.1', shortSpec: '6,400 MT/s · 2,100 MB/s I/O (Sim)', costDelta: 38, weightGrams: 5, learnComponentId: 'storage-ufs4' },
    ],
  },
  cooling: {
    title: '4. Thermal Dissipation Stack',
    stepOrder: 4,
    instruction: 'Bond vapor chamber and pyrolytic graphite over the SoC cavity.',
    options: [
      { value: 'vapor-graphite', label: 'Copper Vapor Chamber + Graphite', shortSpec: 'Two-phase ~8,500 W/m·K (Sim)', costDelta: 28, weightGrams: 11, learnComponentId: 'therm-vapor' },
      { value: 'graphite-only', label: 'Pyrolytic Graphite Sheet Only', shortSpec: 'X-Y Plane 1,500 W/m·K', costDelta: 6, weightGrams: 2, learnComponentId: 'therm-graphite' },
      { value: 'none', label: 'Bare PCB (No Thermal Spreader)', shortSpec: '0g · Severe Throttle Risk', costDelta: 0, weightGrams: 0, learnComponentId: 'therm-graphite' },
    ],
  },
  battery: {
    title: '5. Lithium-Ion Cell & BMS',
    stepOrder: 5,
    instruction: 'Seat battery pouch and weld BMS protection ribbon into battery bay.',
    options: [
      { value: 'bat-3400', label: '3,400 mAh Compact Li-Ion + BMS', shortSpec: '46g · Fits Compact / >=5.5mm', costDelta: 24, weightGrams: 46, learnComponentId: 'bat-3400' },
      { value: 'bat-4600', label: '4,600 mAh Standard Li-Ion + BMS', shortSpec: '62g · Requires >=6.3mm', costDelta: 34, weightGrams: 62, learnComponentId: 'bat-4600' },
      { value: 'bat-5500', label: '5,500 mAh Si-C High-Cap + BMS', shortSpec: '76g · Standard/Max & >=7.4mm', costDelta: 48, weightGrams: 76, learnComponentId: 'bat-5500' },
    ],
  },
  charging: {
    title: '6. Charging & Wireless Coil',
    stepOrder: 6,
    instruction: 'Connect USB-C 3.2 port, PMIC charge pump, and optional Qi2 coil.',
    options: [
      { value: 'chg-65w-qi2', label: '65W Charge-Pump + Qi2 Magnetic Coil', shortSpec: 'Needs Glass Back · USB-C 3.2', costDelta: 34, weightGrams: 12, learnComponentId: 'hw-coil' },
      { value: 'chg-30w-usbc-only', label: '30W Wired USB-C 3.2 Only', shortSpec: 'Cooler Charge · Metal-Back Safe', costDelta: 14, weightGrams: 5, learnComponentId: 'hw-usbc' },
    ],
  },
  camera: {
    title: '7. Camera Optics & OIS Array',
    stepOrder: 7,
    instruction: 'Seat stacked CMOS sensors, 7-element lens barrel, and OIS actuators.',
    options: [
      { value: 'cam-pro-ois', label: 'Triple 50MP + UW + 5x Periscope + OIS', shortSpec: 'Needs >=6.8mm · 5,000Hz VCM', costDelta: 158, weightGrams: 22, learnComponentId: 'cam-telephoto' },
      { value: 'cam-dual-ois', label: 'Dual 50MP Main + Ultrawide + OIS', shortSpec: 'Needs >=6.4mm · 7G Lens', costDelta: 102, weightGrams: 14, learnComponentId: 'cam-ois' },
      { value: 'cam-single-basic', label: 'Single 50MP Compact Optics', shortSpec: 'Ultra-slim compatible', costDelta: 48, weightGrams: 8, learnComponentId: 'cam-main' },
    ],
  },
  connectivity: {
    title: '8. RF Modem & Phased Antennas',
    stepOrder: 8,
    instruction: 'Clip LDS frame antennas, GPS L1+L5 receiver, Wi-Fi/BT & NFC loop.',
    options: [
      { value: 'conn-5g-wifi7', label: '5G mmWave + Wi-Fi 7 + BT 5.4 + L1/L5 + NFC', shortSpec: '5.5 Gbps RF Array (Sim)', costDelta: 74, weightGrams: 9, learnComponentId: 'conn-5g' },
      { value: 'conn-lte-wifi6', label: '4G/5G Sub-6 + Wi-Fi 6 + BT 5.3 + NFC', shortSpec: 'Low RF Power · Value BOM', costDelta: 36, weightGrams: 7, learnComponentId: 'conn-wifi' },
    ],
  },
  display: {
    title: '9. Display Panel & Digitizer',
    stepOrder: 9,
    instruction: 'Laminate OLED/LCD panel with 240Hz touch digitizer and DDIC controller.',
    options: [
      { value: 'disp-amoled-120', label: 'AMOLED 1–120Hz LTPO + Digitizer + DDIC', shortSpec: '0.9mm thin · 2,200 nits (Sim)', costDelta: 115, weightGrams: 27, learnComponentId: 'disp-amoled-120' },
      { value: 'disp-oled', label: '60Hz OLED + Digitizer + DDIC', shortSpec: '1.0mm thin · Low cost OLED', costDelta: 72, weightGrams: 28, learnComponentId: 'disp-oled' },
      { value: 'disp-lcd', label: '90Hz IPS Backlit LCD + Digitizer', shortSpec: '2.1mm thick · Needs >=7.2mm body', costDelta: 34, weightGrams: 36, learnComponentId: 'disp-lcd' },
    ],
  },
  peripherals: {
    title: '10. Acoustics, Taptic, Screws & IP68',
    stepOrder: 10,
    instruction: 'Lock 24 micro-screws, stereo speakers, MEMS mics, LRA haptics & IP68 gaskets.',
    options: [
      { value: 'full-ip68-taptic', label: 'Stereo + 3×MEMS + Taptic LRA + 24 Screws + IP68', shortSpec: '+17g · Full Rugged Seal', costDelta: 32, weightGrams: 17, learnComponentId: 'hw-seals' },
      { value: 'basic-seals', label: 'Mono Speaker + Splash Seals + Micro-Screws', shortSpec: '+10g · Economy Pack', costDelta: 14, weightGrams: 10, learnComponentId: 'hw-screws' },
    ],
  },
  backPanel: {
    title: '11. Rear Enclosure Panel',
    stepOrder: 11,
    instruction: 'Close assembly with RF/Qi-transparent ceramic glass or solid aluminum shell.',
    options: [
      { value: 'back-glass', label: 'Ceramic-Shield Glass Back', shortSpec: '19g · Qi2 Wireless Compatible', costDelta: 26, weightGrams: 19, learnComponentId: 'back-glass' },
      { value: 'back-alu', label: 'Anodized Aluminum Back Plate', shortSpec: '22g · Shatterproof · No Qi Coil', costDelta: 12, weightGrams: 22, learnComponentId: 'back-alu' },
    ],
  },
};

export const ASSEMBLY_SEQUENCE: PhoneBayId[] = [
  'frame',
  'soc',
  'memory',
  'cooling',
  'battery',
  'charging',
  'camera',
  'connectivity',
  'display',
  'peripherals',
  'backPanel',
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
];

// Preserved UI palette groups for backward compatibility
export const PHONE_COMPONENT_GROUPS: Array<{ id: PhoneComponentGroup; label: string }> = [
  { id: 'camera', label: 'Camera' },
  { id: 'display', label: 'Display' },
  { id: 'buttons', label: 'Buttons' },
  { id: 'hardware', label: 'Hardware' },
  { id: 'design', label: 'Design Elements' },
];

export const PHONE_COMPONENTS: PhoneComponentDef[] = [
  { id: 'cam-single', group: 'camera', name: 'Single Lens', defaultFace: 'rear', priceDelta: 35, defaultW: 16, defaultH: 10, defaultX: 25, defaultY: 16, defaultColor: '#1E293B', kind: 'cam-single' },
  { id: 'cam-triple', group: 'camera', name: 'Triple Pro Array', defaultFace: 'rear', priceDelta: 115, defaultW: 34, defaultH: 21, defaultX: 31, defaultY: 19, defaultColor: '#111827', kind: 'cam-triple' },
  { id: 'disp-island', group: 'display', name: 'Dynamic Capsule', defaultFace: 'front', priceDelta: 45, defaultW: 34, defaultH: 6, defaultX: 50, defaultY: 7, defaultColor: '#020617', kind: 'disp-island' },
  { id: 'hw-usbc', group: 'hardware', name: 'USB-C Port', defaultFace: 'front', allowBothFaces: true, priceDelta: 15, defaultW: 16, defaultH: 4.5, defaultX: 50, defaultY: 96, defaultColor: '#94A3B8', kind: 'hw-usbc' },
  { id: 'hw-coil', group: 'hardware', name: 'Magnetic Coil Ring', defaultFace: 'rear', priceDelta: 40, defaultW: 36, defaultH: 22, defaultX: 50, defaultY: 54, defaultColor: '#38BDF8', kind: 'hw-coil' },
];

export interface CompatibilityIssue {
  id: string;
  severity: 'error' | 'warning';
  bay: PhoneBayId | 'dimensions';
  title: string;
  detail: string;
}

export interface PhoneEngineeringTelemetry {
  totalCostUsd: number;
  weightGrams: number;
  performanceScore: number;
  powerEfficiencyScore: number;
  thermalScore: number;
  durabilityScore: number;
  cameraScore: number;
  overallEngineeringScore: number;
  estimatedBatteryHours: number;
  peakJunctionTempC: number;
  installedRatio: string;
  issues: CompatibilityIssue[];
  errorCount: number;
  warningCount: number;
  formulas: Array<{ label: string; equation: string }>;
}

export function normalizePhoneState(raw?: Partial<PhoneDesignState> | null): PhoneDesignState {
  const base = createInitialPhoneState();
  if (!raw) return base;
  return {
    ...base,
    ...raw,
    bays: {
      ...base.bays,
      ...(raw.bays || {}),
    },
    installedBays:
      Array.isArray(raw.installedBays) && raw.installedBays.length > 0
        ? raw.installedBays
        : base.installedBays,
    viewMode: raw.viewMode || base.viewMode,
    assemblyStepIndex: typeof raw.assemblyStepIndex === 'number' ? raw.assemblyStepIndex : base.assemblyStepIndex,
  };
}

export function validatePhoneCompatibility(rawState: PhoneDesignState): CompatibilityIssue[] {
  const state = normalizePhoneState(rawState);
  const b = state.bays;
  const issues: CompatibilityIssue[] = [];

  // 1. Battery volume fit against chassis form factor & thickness
  if (b.battery === 'bat-5500' && state.sizePreset === 'compact') {
    issues.push({
      id: 'bat-5500-compact',
      severity: 'error',
      bay: 'battery',
      title: '5,500 mAh Si-C Cell Exceeds Compact Cavity Volume',
      detail: 'Compact 5.9" frame lacks internal cavity length for the 5,500 mAh dual-tab cell. Upgrade chassis to Studio 6.3" / Pro Max or install 3,400 / 4,600 mAh cell.',
    });
  }
  if (b.battery === 'bat-5500' && state.thicknessMm < 7.4) {
    issues.push({
      id: 'bat-5500-thin',
      severity: 'error',
      bay: 'battery',
      title: `Thickness ${state.thicknessMm.toFixed(1)}mm Too Slim for 5,500 mAh Pack`,
      detail: 'High-capacity Si-C pouch swell margin requires >= 7.4 mm chassis thickness.',
    });
  }
  if (b.battery === 'bat-4600' && state.thicknessMm < 6.3) {
    issues.push({
      id: 'bat-4600-thin',
      severity: 'error',
      bay: 'battery',
      title: `Thickness ${state.thicknessMm.toFixed(1)}mm Pinch Hazard on 4,600 mAh Cell`,
      detail: 'Raise chassis thickness >= 6.3 mm or switch to the slim 3,400 mAh pouch cell.',
    });
  }

  // 2. Wireless inductive charging coil vs conductive aluminum back
  if (b.charging === 'chg-65w-qi2' && b.backPanel === 'back-alu') {
    issues.push({
      id: 'qi-metal-back',
      severity: 'error',
      bay: 'charging',
      title: 'Eddy-Current Block: Aluminum Back Shields Qi2 Wireless Coil',
      detail: 'A solid conductive aluminum back blocks alternating magnetic flux and heats rapidly under Qi induction. Install Ceramic-Shield Glass Back or use wired USB-C only.',
    });
  }

  // 3. IPS LCD backlight diffuser Z-stack height
  if (b.display === 'disp-lcd' && state.thicknessMm < 7.2) {
    issues.push({
      id: 'lcd-thin',
      severity: 'error',
      bay: 'display',
      title: 'IPS LCD Backlight Stack Requires >= 7.2 mm Profile',
      detail: 'LCD requires a 2.1 mm waveguide + LED array. Switch to self-emissive OLED/AMOLED or raise chassis thickness to >= 7.2 mm.',
    });
  }

  // 4. Thermal dissipation check for Flagship 3nm SoC + 5G + 65W charging
  const thermalLoad =
    (b.soc === 'soc-flagship' ? 9.8 : 5.2) +
    (b.connectivity === 'conn-5g-wifi7' ? 2.1 : 1.0) +
    (b.charging === 'chg-65w-qi2' ? 1.4 : 0.6);
  if (b.cooling === 'none') {
    issues.push({
      id: 'no-cooling',
      severity: 'error',
      bay: 'cooling',
      title: 'Missing Thermal Spreader Over High-Density SoC',
      detail: `Simulated TDP (${thermalLoad.toFixed(1)}W) causes rapid CPU/PMIC hotspot throttling above 98°C without at least Graphite or a Vapor Chamber.`,
    });
  } else if (b.soc === 'soc-flagship' && b.cooling === 'graphite-only') {
    issues.push({
      id: 'flagship-throttle',
      severity: 'warning',
      bay: 'cooling',
      title: 'Sustained Throttling Risk on 3nm Flagship SoC',
      detail: 'Graphite foil alone saturates under 9.8W Flagship + 5G load. Upgrade to Copper Vapor Chamber + Graphite for full sustained clocks.',
    });
  }

  // 5. Folded periscope / OIS mechanical Z-clearance
  if (b.camera === 'cam-pro-ois' && state.thicknessMm < 6.8) {
    issues.push({
      id: 'periscope-z',
      severity: 'error',
      bay: 'camera',
      title: 'Periscope 5x Prism Exceeds Thinness Budget (< 6.8 mm)',
      detail: '90° folded optical prism & VCM OIS suspension require >= 6.8 mm chassis depth to seat flush inside the rear bezel.',
    });
  } else if (b.camera === 'cam-dual-ois' && state.thicknessMm < 6.4) {
    issues.push({
      id: 'ois-z',
      severity: 'warning',
      bay: 'camera',
      title: 'Excessive Camera Island Protrusion (< 6.4 mm)',
      detail: '7-element lens + OIS spring cage protrudes noticeably beyond ultra-slim 6.4 mm walls.',
    });
  }

  // 6. Stainless Steel thermal bottleneck warning with Flagship SoC
  if (b.frame === 'frame-steel' && b.soc === 'soc-flagship' && b.cooling !== 'vapor-graphite') {
    issues.push({
      id: 'steel-heat-trap',
      severity: 'warning',
      bay: 'frame',
      title: '316L Stainless Steel Conducts 8x Less Heat Than Aluminum',
      detail: 'Pair with a Copper Vapor Chamber or choose Aluminum / Titanium+Al Core to avoid corner hotspots.',
    });
  }

  return issues;
}

export function evaluatePhoneEngineering(rawState: PhoneDesignState): PhoneEngineeringTelemetry {
  const state = normalizePhoneState(rawState);
  const b = state.bays;
  const issues = validatePhoneCompatibility(state);
  const errorCount = issues.filter((i) => i.severity === 'error').length;
  const warningCount = issues.filter((i) => i.severity === 'warning').length;

  // Base chassis mass + BOM cost scaling with size preset
  const sizeMassDelta = state.sizePreset === 'compact' ? -14 : state.sizePreset === 'pro-max' ? 22 : 0;
  const sizeCostDelta = state.sizePreset === 'compact' ? -20 : state.sizePreset === 'pro-max' ? 55 : 0;

  let partsCost = 95 + sizeCostDelta; // PCB, screws base, assembly
  let weightGrams = 22 + sizeMassDelta; // PCB + copper shields + adhesive base

  for (const bayId of ASSEMBLY_SEQUENCE) {
    const opt = PHONE_BAY_OPTIONS[bayId].options.find((o) => o.value === b[bayId]);
    if (opt) {
      partsCost += opt.costDelta;
      weightGrams += opt.weightGrams;
    }
  }
  if (state.thicknessMm > 7.6) weightGrams += Math.round((state.thicknessMm - 7.6) * 5);

  // Performance (Simulated compute, memory speed, GPU & sustained headroom)
  const rawCompute =
    (b.soc === 'soc-flagship' ? 46 : 28) +
    (b.memory === 'ram-lpddr5x-storage' ? 28 : 16) +
    (b.display === 'disp-amoled-120' ? 14 : b.display === 'disp-lcd' ? 10 : 7) +
    (b.connectivity === 'conn-5g-wifi7' ? 12 : 6);
  const throttlePenalty =
    b.cooling === 'none' ? 24 : b.soc === 'soc-flagship' && b.cooling === 'graphite-only' ? 10 : 0;
  const performanceScore = Math.max(30, Math.min(99, Math.round(rawCompute - throttlePenalty)));

  // Power Efficiency (LTPO 1Hz, 6nm vs 3nm efficiency, low-heat cooling, battery Wh)
  const mah = b.battery === 'bat-5500' ? 5500 : b.battery === 'bat-4600' ? 4600 : 3400;
  const dispSave = b.display === 'disp-amoled-120' ? 14 : b.display === 'disp-oled' ? 8 : -4;
  const socEff = b.soc === 'soc-mid' ? 12 : 8;
  const rfDraw = b.connectivity === 'conn-5g-wifi7' ? -4 : 3;
  const rawEff = 54 + dispSave + socEff + rfDraw + (mah >= 4600 ? 12 : 5);
  const powerEfficiencyScore = Math.max(35, Math.min(99, Math.round(rawEff - errorCount * 8)));

  // Estimated mixed Screen-On Hours (Simulated formula: Wh / Avg System Watts)
  const wh = (mah * 3.87) / 1000;
  const avgDrawW =
    1.18 +
    (b.soc === 'soc-flagship' ? 0.16 : 0.04) +
    (b.display === 'disp-amoled-120' ? -0.14 : b.display === 'disp-lcd' ? 0.22 : 0) +
    (b.connectivity === 'conn-5g-wifi7' ? 0.12 : 0.03);
  const estimatedBatteryHours = Number((wh / Math.max(0.85, avgDrawW)).toFixed(1));

  // Thermal Management & Simulated Peak Junction Temp (°C)
  const tdp =
    (b.soc === 'soc-flagship' ? 9.8 : 5.2) +
    (b.connectivity === 'conn-5g-wifi7' ? 2.1 : 1.0) +
    (b.charging === 'chg-65w-qi2' ? 1.4 : 0.6);
  const coolingCapacity =
    (b.cooling === 'vapor-graphite' ? 38 : b.cooling === 'graphite-only' ? 18 : 2) +
    (b.frame === 'frame-alu' ? 16 : b.frame === 'frame-titanium' ? 11 : 5) +
    (b.backPanel === 'back-alu' ? 10 : 3);
  const thermalScore = Math.max(
    25,
    Math.min(99, Math.round(52 + coolingCapacity - tdp * 2.1 - (b.charging === 'chg-65w-qi2' && b.backPanel === 'back-alu' ? 18 : 0)))
  );
  const peakJunctionTempC = Math.round(48 + tdp * 4.4 - coolingCapacity * 0.55);

  // Durability Index
  const durabilityScore = Math.max(
    35,
    Math.min(
      99,
      Math.round(
        50 +
          (b.frame === 'frame-titanium' ? 18 : b.frame === 'frame-steel' ? 17 : 12) +
          (b.backPanel === 'back-alu' ? 14 : 7) +
          (b.peripherals === 'full-ip68-taptic' ? 16 : 6) -
          (state.thicknessMm < 6.0 ? 8 : 0) -
          errorCount * 6
      )
    )
  );

  const cameraScore = Math.round(
    b.camera === 'cam-pro-ois' ? 95 : b.camera === 'cam-dual-ois' ? 84 : 64
  );

  const installedCount = state.installedBays.length;
  const overallEngineeringScore = Math.max(
    30,
    Math.min(
      99,
      Math.round(
        (performanceScore + powerEfficiencyScore + thermalScore + durabilityScore + cameraScore) / 5 -
          errorCount * 10 -
          Math.max(0, 11 - installedCount) * 2
      )
    )
  );

  return {
    totalCostUsd: Math.max(320, Math.round(partsCost)),
    weightGrams: Math.round(weightGrams),
    performanceScore,
    powerEfficiencyScore,
    thermalScore,
    durabilityScore,
    cameraScore,
    overallEngineeringScore,
    estimatedBatteryHours,
    peakJunctionTempC,
    installedRatio: `${installedCount}/${ASSEMBLY_SEQUENCE.length}`,
    issues,
    errorCount,
    warningCount,
    formulas: [
      { label: 'Energy Storage', equation: `E = (${mah} mAh × 3.87V) / 1000 = ${wh.toFixed(1)} Wh (Sim)` },
      { label: 'Runtime Est.', equation: `t ≈ ${wh.toFixed(1)} Wh / ${avgDrawW.toFixed(2)} W ≈ ${estimatedBatteryHours} hrs` },
      { label: 'Junction Temp', equation: `T_j ≈ 48°C + 4.4·(${tdp.toFixed(1)}W) - ΔQ_cool ≈ ${peakJunctionTempC}°C` },
    ],
  };
}

// Preserved backward-compatible API used by App.tsx / ProfilePage / Creations
export function evaluatePhoneDesign(state: PhoneDesignState): {
  estimatedPrice: number;
  designRating: number;
  hasFrontDisplay: boolean;
  hasCamera: boolean;
  hasPort: boolean;
  partCount: number;
} {
  const norm = normalizePhoneState(state);
  const eng = evaluatePhoneEngineering(norm);
  return {
    estimatedPrice: eng.totalCostUsd,
    designRating: eng.overallEngineeringScore,
    hasFrontDisplay: norm.installedBays.includes('display'),
    hasCamera: norm.installedBays.includes('camera'),
    hasPort: norm.installedBays.includes('charging'),
    partCount: norm.installedBays.length,
  };
}

export interface PhoneChallenge {
  id: string;
  title: string;
  description: string;
  rewardScore: number;
  check: (
    state: PhoneDesignState,
    metrics: PhoneEngineeringTelemetry
  ) => { passed: boolean; checklist: Array<{ label: string; ok: boolean }> };
}

// 7 Required Smartphone Engineering Challenges
export const PHONE_CHALLENGES: PhoneChallenge[] = [
  {
    id: 'battery-efficiency',
    title: 'Mission 1: Long-Endurance Battery Efficiency',
    description: 'Engineer a multi-day power system (>= 15.5 simulated hrs) with LTPO 1Hz scaling and zero compatibility faults.',
    rewardScore: 1000,
    check: (state, m) => {
      const s = normalizePhoneState(state);
      const hasBigCell = s.bays.battery === 'bat-4600' || s.bays.battery === 'bat-5500';
      const hasLtpo = s.bays.display === 'disp-amoled-120';
      const effOk = m.powerEfficiencyScore >= 84;
      const hrsOk = m.estimatedBatteryHours >= 15.5;
      const clean = m.errorCount === 0;
      return {
        passed: hasBigCell && hasLtpo && effOk && hrsOk && clean,
        checklist: [
          { label: `4,600+ mAh battery pack installed (${s.bays.battery})`, ok: hasBigCell },
          { label: 'AMOLED 1–120Hz LTPO variable refresh panel', ok: hasLtpo },
          { label: `Power Efficiency >= 84 (now ${m.powerEfficiencyScore})`, ok: effOk },
          { label: `Sim Endurance >= 15.5 hrs (now ${m.estimatedBatteryHours} hrs)`, ok: hrsOk },
          { label: 'Zero hardware compatibility errors', ok: clean },
        ],
      };
    },
  },
  {
    id: 'lightweight-chassis',
    title: 'Mission 2: Lightweight Structural Chassis',
    description: 'Deliver an ergonomic sub-168g build with strong aluminum or titanium structural frame and zero faults.',
    rewardScore: 980,
    check: (state, m) => {
      const s = normalizePhoneState(state);
      const lightWeight = m.weightGrams <= 168;
      const alloyOk = s.bays.frame === 'frame-alu' || s.bays.frame === 'frame-titanium';
      const durableOk = m.durabilityScore >= 72;
      const clean = m.errorCount === 0;
      return {
        passed: lightWeight && alloyOk && durableOk && clean,
        checklist: [
          { label: `Total Mass <= 168g (now ${m.weightGrams}g)`, ok: lightWeight },
          { label: 'Aluminum or Titanium structural frame', ok: alloyOk },
          { label: `Durability Index >= 72 (now ${m.durabilityScore})`, ok: durableOk },
          { label: 'Zero hardware compatibility errors', ok: clean },
        ],
      };
    },
  },
  {
    id: 'thermal-management',
    title: 'Mission 3: Sustained Thermal Management',
    description: 'Keep a 3nm Flagship SoC + 5G modem cool under sustained load with a Copper Vapor Chamber + Graphite Stack.',
    rewardScore: 1100,
    check: (state, m) => {
      const s = normalizePhoneState(state);
      const flagshipSoc = s.bays.soc === 'soc-flagship';
      const vaporOk = s.bays.cooling === 'vapor-graphite';
      const tempOk = m.peakJunctionTempC <= 74;
      const thermalOk = m.thermalScore >= 82;
      const clean = m.errorCount === 0;
      return {
        passed: flagshipSoc && vaporOk && tempOk && thermalOk && clean,
        checklist: [
          { label: 'Flagship 3nm Neural SoC mounted', ok: flagshipSoc },
          { label: 'Copper Vapor Chamber + Graphite Stack installed', ok: vaporOk },
          { label: `Peak Junction Temp <= 74°C (now ${m.peakJunctionTempC}°C)`, ok: tempOk },
          { label: `Thermal Score >= 82 (now ${m.thermalScore})`, ok: thermalOk },
          { label: 'Zero hardware compatibility errors', ok: clean },
        ],
      };
    },
  },
  {
    id: 'processor-memory',
    title: 'Mission 4: Processor & Memory Architecture',
    description: 'Pair high-bandwidth LPDDR5X PoP RAM & UFS 4.0 NAND with Flagship silicon for 90+ compute performance.',
    rewardScore: 1050,
    check: (state, m) => {
      const s = normalizePhoneState(state);
      const socOk = s.bays.soc === 'soc-flagship';
      const memOk = s.bays.memory === 'ram-lpddr5x-storage';
      const perfOk = m.performanceScore >= 90;
      const clean = m.errorCount === 0 && m.warningCount === 0;
      return {
        passed: socOk && memOk && perfOk && clean,
        checklist: [
          { label: 'Flagship 3nm Neural SoC + PMIC installed', ok: socOk },
          { label: '16GB LPDDR5X + UFS 4.0 Dual-Lane Storage', ok: memOk },
          { label: `Performance Index >= 90 (now ${m.performanceScore})`, ok: perfOk },
          { label: 'Zero compatibility errors or thermal warnings', ok: clean },
        ],
      };
    },
  },
  {
    id: 'balanced-camera',
    title: 'Mission 5: Balanced Optical Camera System',
    description: 'Integrate triple-array optics with Sensor-Shift OIS and 5x periscope zoom cleanly inside the Z-depth budget.',
    rewardScore: 1040,
    check: (state, m) => {
      const s = normalizePhoneState(state);
      const camOk = s.bays.camera === 'cam-pro-ois';
      const depthOk = s.thicknessMm >= 6.8 && s.thicknessMm <= 8.2;
      const memOk = s.bays.memory === 'ram-lpddr5x-storage';
      const clean = m.errorCount === 0;
      return {
        passed: camOk && depthOk && memOk && clean,
        checklist: [
          { label: 'Triple 50MP + UW + 5x Periscope + OIS mounted', ok: camOk },
          { label: `Balanced profile 6.8–8.2 mm (now ${s.thicknessMm.toFixed(1)} mm)`, ok: depthOk },
          { label: 'High-bandwidth UFS 4.0 + LPDDR5X for 4K buffer', ok: memOk },
          { label: 'Zero hardware compatibility errors', ok: clean },
        ],
      };
    },
  },
  {
    id: 'cost-effective',
    title: 'Mission 6: Cost-Effective Everyday Phone',
    description: 'Engineer a reliable everyday smartphone under $530 simulated BOM cost while preserving >=70 efficiency and durability.',
    rewardScore: 950,
    check: (_state, m) => {
      const costOk = m.totalCostUsd <= 530;
      const effOk = m.powerEfficiencyScore >= 70;
      const durOk = m.durabilityScore >= 72;
      const clean = m.errorCount === 0;
      return {
        passed: costOk && effOk && durOk && clean,
        checklist: [
          { label: `Simulated BOM Cost <= $530 (now $${m.totalCostUsd})`, ok: costOk },
          { label: `Power Efficiency >= 70 (now ${m.powerEfficiencyScore})`, ok: effOk },
          { label: `Durability Index >= 72 (now ${m.durabilityScore})`, ok: durOk },
          { label: 'Zero hardware compatibility errors', ok: clean },
        ],
      };
    },
  },
  {
    id: 'internal-packaging',
    title: 'Mission 7: Optimize Internal Component Arrangement',
    description: 'Populate all 11 hardware bays including IP68 seals, micro-screws, Qi2 coil & vapor chamber within <=7.8mm with 0 faults.',
    rewardScore: 1200,
    check: (state, m) => {
      const s = normalizePhoneState(state);
      const allBays = s.installedBays.length >= ASSEMBLY_SEQUENCE.length;
      const sealsOk = s.bays.peripherals === 'full-ip68-taptic';
      const qiOk = s.bays.charging === 'chg-65w-qi2';
      const thinOk = s.thicknessMm <= 7.8;
      const scoreOk = m.overallEngineeringScore >= 85;
      const clean = m.errorCount === 0 && m.warningCount === 0;
      return {
        passed: allBays && sealsOk && qiOk && thinOk && scoreOk && clean,
        checklist: [
          { label: `All 11 internal bays mounted (${s.installedBays.length}/11)`, ok: allBays },
          { label: 'Full IP68 gaskets, 24 micro-screws & Taptic LRA installed', ok: sealsOk },
          { label: 'Qi2 magnetic wireless coil + Ceramic Glass Back compatible', ok: qiOk },
          { label: `Compact thickness <= 7.8 mm (now ${s.thicknessMm.toFixed(1)} mm)`, ok: thinOk },
          { label: `Overall Rating >= 85 & zero warnings (now ${m.overallEngineeringScore})`, ok: scoreOk && clean },
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
    deviceName: 'CG Horizon Lab X1',
    sizePreset: 'standard',
    thicknessMm: 7.4,
    bodyColor: '#1E293B',
    frameFinish: 'titanium',
    wallpaperId: 'midnight-wave',
    customWallpaperDataUrl: null,
    activeChallengeId: null,
    bays: {
      frame: 'frame-titanium',
      backPanel: 'back-glass',
      display: 'disp-amoled-120',
      soc: 'soc-flagship',
      memory: 'ram-lpddr5x-storage',
      cooling: 'vapor-graphite',
      battery: 'bat-4600',
      charging: 'chg-65w-qi2',
      camera: 'cam-pro-ois',
      connectivity: 'conn-5g-wifi7',
      peripherals: 'full-ip68-taptic',
    },
    viewMode: 'back-removed',
    assemblyStepIndex: 0,
    installedBays: [...ASSEMBLY_SEQUENCE],
    components: [
      { uid: nextPhoneUid(), defId: 'disp-island', face: 'front', x: 50, y: 7, scale: 1, rotation: 0, color: '#020617' },
      { uid: nextPhoneUid(), defId: 'cam-triple', face: 'rear', x: 31, y: 19, scale: 1, rotation: 0, color: '#111827' },
      { uid: nextPhoneUid(), defId: 'hw-coil', face: 'rear', x: 50, y: 54, scale: 1, rotation: 0, color: '#38BDF8' },
    ],
  };
}

export function createRandomPhoneState(): PhoneDesignState {
  const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];
  const backPanel = pick(['back-glass', 'back-alu'] as const);
  const thickness = Number((6.8 + Math.random() * 1.4).toFixed(1));
  return {
    ...createInitialPhoneState(),
    deviceName: `Proto-Phone E${Math.floor(10 + Math.random() * 89)}`,
    sizePreset: pick(['standard', 'pro-max'] as const),
    thicknessMm: thickness,
    bodyColor: pick(PHONE_COLORS).hex,
    frameFinish: pick(['titanium', 'matte-aluminum', 'polished-steel'] as const),
    bays: {
      frame: pick(['frame-alu', 'frame-titanium', 'frame-steel'] as const),
      backPanel,
      display: pick(['disp-amoled-120', 'disp-oled'] as const),
      soc: pick(['soc-flagship', 'soc-mid'] as const),
      memory: pick(['ram-lpddr5x-storage', 'ram-lpddr5-base'] as const),
      cooling: pick(['vapor-graphite', 'graphite-only'] as const),
      battery: thickness >= 7.4 ? 'bat-5500' : 'bat-4600',
      charging: backPanel === 'back-glass' ? 'chg-65w-qi2' : 'chg-30w-usbc-only',
      camera: pick(['cam-pro-ois', 'cam-dual-ois'] as const),
      connectivity: pick(['conn-5g-wifi7', 'conn-lte-wifi6'] as const),
      peripherals: 'full-ip68-taptic',
    },
    viewMode: 'back-removed',
    installedBays: [...ASSEMBLY_SEQUENCE],
  };
}

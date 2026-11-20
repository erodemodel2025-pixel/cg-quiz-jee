export type VehicleTypeId =
  | 'sports-coupe'
  | 'luxury-sedan'
  | 'supercar'
  | 'suv'
  | 'offroad'
  | 'electric'
  | 'muscle'
  | 'hatchback';

export type PaintFinish = 'gloss' | 'matte' | 'metallic' | 'pearl';
export type RimDesign = 'twin-5' | 'multi-10' | 'turbofan' | 'deep-mesh' | 'offroad-bead';
export type SpoilerStyle = 'none' | 'lip' | 'gt-wing' | 'ducktail' | 'twin-swan';
export type FrontBumperStyle = 'stock' | 'sport-splitter' | 'track-canards' | 'bullbar';
export type RearBumperStyle = 'stock' | 'quad-diffuser' | 'twin-exhaust' | 'skid-plate';
export type HeadlightStyle = 'halos' | 'matrix-led' | 'laser-blade' | 'amber-rally';
export type TaillightStyle = 'classic-red' | 'full-lightbar' | 'oled-blade' | 'smoked-sport';
export type WindowTintStyle = 'clear' | 'light-smoke' | 'midnight-tint' | 'iridescent-blue';
export type DecalStyle = 'none' | 'racing-stripes' | 'side-livery' | 'aero-number' | 'cyber-circuit';
export type BodyKitStyle = 'factory' | 'street-skirts' | 'widebody-flares' | 'aero-gt';
export type InteriorTheme = 'obsidian' | 'crimson-sport' | 'tan-luxury' | 'cyber-cyan';
export type PowertrainType = 'ev' | 'hybrid' | 'petrol-v8';
export type WeightConcept = 'lightweight-carbon' | 'balanced-alloy' | 'heavy-duty';
export type EngineConfig = 'i4' | 'v6' | 'v8' | 'ev-dual';
export type ForcedInduction = 'none' | 'turbo' | 'supercharger';
export type TransmissionType = 'manual' | 'auto' | 'dct' | 'ev-single';
export type GearRatioProfile = 'short' | 'balanced' | 'tall';
export type DifferentialType = 'open' | 'lsd';
export type SuspensionType = 'macpherson' | 'double-wishbone';
export type TireCompound = 'eco' | 'sport' | 'semi-slick';
export type BrakeSystemType = 'drum' | 'disc' | 'disc-abs';
export type CarInspectionViewMode = 'exterior' | 'technical' | 'exploded';
export type StudioEnvironment =
  | 'modern-studio'
  | 'night-city'
  | 'mountain-road'
  | 'futuristic-showroom'
  | 'dark-cinematic';

export interface VehiclePreset {
  id: VehicleTypeId;
  name: string;
  category: string;
  description: string;
  startingBudget: number;
  baseWeightKg: number;
  baseDragCd: number;
  defaultColor: string;
  defaultPowertrain: PowertrainType;
  proportions: {
    length: number;
    width: number;
    bodyHeight: number;
    cabinHeight: number;
    cabinLength: number;
    cabinOffsetZ: number;
    hoodSlope: number;
    trunkSlope: number;
    wheelRadius: number;
    wheelWidth: number;
    wheelbaseHalf: number;
    baseClearance: number;
    wedgeFactor: number;
  };
  defaultBuild: Partial<CarBuildConfig>;
}

export interface CarBuildConfig {
  vehicleId: VehicleTypeId;
  bodyColor: string;
  paintFinish: PaintFinish;
  rimDesign: RimDesign;
  rimColor: string;
  wheelScale: number;
  suspensionOffsetMm: number; // -25 to +35
  spoiler: SpoilerStyle;
  frontBumper: FrontBumperStyle;
  rearBumper: RearBumperStyle;
  headlights: HeadlightStyle;
  taillights: TaillightStyle;
  windowTint: WindowTintStyle;
  decal: DecalStyle;
  decalColor: string;
  bodyKit: BodyKitStyle;
  interior: InteriorTheme;
  powertrain: PowertrainType;
  weightConcept: WeightConcept;
  environment: StudioEnvironment;
  engineBayOpen: boolean;

  // Engineering CAD Simulator Parameters
  engineConfig: EngineConfig;
  forcedInduction: ForcedInduction;
  intercooler: boolean;
  intakeUpgrade: 'stock' | 'cold-air';
  exhaustUpgrade: 'stock' | 'headers-titanium';
  fuelSystem: 'efi' | 'direct-injection';
  coolingUpgrade: 'standard' | 'high-flow-alu';
  transmissionType: TransmissionType;
  differentialType: DifferentialType;
  gearRatioProfile: GearRatioProfile;
  redlineRpm: number; // 5500 .. 9000
  suspensionType: SuspensionType;
  springStiffnessNmm: number; // 25 .. 110 N/mm
  antiRollBars: 'standard' | 'stiff-track';
  tireCompound: TireCompound;
  brakeSystem: BrakeSystemType;
  airDucts: boolean;
  viewMode: CarInspectionViewMode;
  activeMissionId: string | null;
}

export const VEHICLE_PRESETS: VehiclePreset[] = [
  {
    id: 'sports-coupe',
    name: 'Apex GT Coupe',
    category: 'Sports Coupe',
    description: 'Balanced front-engine silhouette with fastback roofline and crisp track proportions.',
    startingBudget: 48000,
    baseWeightKg: 1460,
    baseDragCd: 0.30,
    defaultColor: '#2563EB',
    defaultPowertrain: 'petrol-v8',
    proportions: {
      length: 4.38,
      width: 1.88,
      bodyHeight: 0.56,
      cabinHeight: 0.44,
      cabinLength: 1.98,
      cabinOffsetZ: -0.18,
      hoodSlope: 0.14,
      trunkSlope: 0.24,
      wheelRadius: 0.34,
      wheelWidth: 0.25,
      wheelbaseHalf: 1.38,
      baseClearance: 0.16,
      wedgeFactor: 0.06,
    },
    defaultBuild: {
      bodyColor: '#2563EB',
      paintFinish: 'metallic',
      spoiler: 'lip',
      frontBumper: 'sport-splitter',
      rearBumper: 'twin-exhaust',
      rimDesign: 'twin-5',
      decal: 'none',
      bodyKit: 'street-skirts',
    },
  },
  {
    id: 'luxury-sedan',
    name: 'Sovereign S8',
    category: 'Luxury Sedan',
    description: 'Long wheelbase executive tourer built for smooth laminar flow and cabin comfort.',
    startingBudget: 56000,
    baseWeightKg: 1790,
    baseDragCd: 0.26,
    defaultColor: '#CBD5E1',
    defaultPowertrain: 'hybrid',
    proportions: {
      length: 4.86,
      width: 1.90,
      bodyHeight: 0.60,
      cabinHeight: 0.48,
      cabinLength: 2.38,
      cabinOffsetZ: -0.08,
      hoodSlope: 0.08,
      trunkSlope: 0.12,
      wheelRadius: 0.35,
      wheelWidth: 0.24,
      wheelbaseHalf: 1.54,
      baseClearance: 0.18,
      wedgeFactor: 0.02,
    },
    defaultBuild: {
      bodyColor: '#64748B',
      paintFinish: 'pearl',
      spoiler: 'none',
      frontBumper: 'stock',
      rearBumper: 'twin-exhaust',
      rimDesign: 'multi-10',
      interior: 'tan-luxury',
      windowTint: 'light-smoke',
    },
  },
  {
    id: 'supercar',
    name: 'Valkyrie R12',
    category: 'Supercar',
    description: 'Cab-forward mid-engine wedge sculpted for maximum downforce and dramatic aero.',
    startingBudget: 95000,
    baseWeightKg: 1320,
    baseDragCd: 0.28,
    defaultColor: '#EF4444',
    defaultPowertrain: 'hybrid',
    proportions: {
      length: 4.52,
      width: 2.02,
      bodyHeight: 0.48,
      cabinHeight: 0.38,
      cabinLength: 1.88,
      cabinOffsetZ: 0.16,
      hoodSlope: 0.26,
      trunkSlope: 0.18,
      wheelRadius: 0.35,
      wheelWidth: 0.29,
      wheelbaseHalf: 1.42,
      baseClearance: 0.12,
      wedgeFactor: 0.12,
    },
    defaultBuild: {
      bodyColor: '#EF4444',
      paintFinish: 'gloss',
      spoiler: 'gt-wing',
      frontBumper: 'track-canards',
      rearBumper: 'quad-diffuser',
      rimDesign: 'turbofan',
      headlights: 'laser-blade',
      taillights: 'oled-blade',
      bodyKit: 'aero-gt',
      interior: 'crimson-sport',
    },
  },
  {
    id: 'suv',
    name: 'Atlas X5',
    category: 'SUV',
    description: 'Elevated utility cruiser combining commanding visibility with family aero stability.',
    startingBudget: 52000,
    baseWeightKg: 2040,
    baseDragCd: 0.35,
    defaultColor: '#0F766E',
    defaultPowertrain: 'hybrid',
    proportions: {
      length: 4.68,
      width: 1.98,
      bodyHeight: 0.72,
      cabinHeight: 0.56,
      cabinLength: 2.52,
      cabinOffsetZ: -0.22,
      hoodSlope: 0.08,
      trunkSlope: 0.08,
      wheelRadius: 0.40,
      wheelWidth: 0.27,
      wheelbaseHalf: 1.48,
      baseClearance: 0.25,
      wedgeFactor: 0.01,
    },
    defaultBuild: {
      bodyColor: '#0EA5E9',
      paintFinish: 'metallic',
      spoiler: 'lip',
      frontBumper: 'stock',
      rearBumper: 'skid-plate',
      rimDesign: 'multi-10',
      headlights: 'matrix-led',
      taillights: 'full-lightbar',
    },
  },
  {
    id: 'offroad',
    name: 'Terra 4x4',
    category: 'Off-Road Vehicle',
    description: 'High-clearance trail rig engineered for steep approach angles and rugged terrain.',
    startingBudget: 54000,
    baseWeightKg: 2180,
    baseDragCd: 0.42,
    defaultColor: '#D97706',
    defaultPowertrain: 'petrol-v8',
    proportions: {
      length: 4.55,
      width: 2.00,
      bodyHeight: 0.74,
      cabinHeight: 0.58,
      cabinLength: 2.35,
      cabinOffsetZ: -0.24,
      hoodSlope: 0.04,
      trunkSlope: 0.04,
      wheelRadius: 0.44,
      wheelWidth: 0.31,
      wheelbaseHalf: 1.44,
      baseClearance: 0.33,
      wedgeFactor: 0,
    },
    defaultBuild: {
      bodyColor: '#D97706',
      paintFinish: 'matte',
      rimDesign: 'offroad-bead',
      frontBumper: 'bullbar',
      rearBumper: 'skid-plate',
      headlights: 'amber-rally',
      bodyKit: 'widebody-flares',
      suspensionOffsetMm: 18,
    },
  },
  {
    id: 'electric',
    name: 'Volt Concept E',
    category: 'Electric Car',
    description: 'Flat-floor battery skateboard EV sculpted for ultra-low drag and futuristic poise.',
    startingBudget: 62000,
    baseWeightKg: 1710,
    baseDragCd: 0.22,
    defaultColor: '#06B6D4',
    defaultPowertrain: 'ev',
    proportions: {
      length: 4.62,
      width: 1.92,
      bodyHeight: 0.54,
      cabinHeight: 0.45,
      cabinLength: 2.48,
      cabinOffsetZ: 0.06,
      hoodSlope: 0.18,
      trunkSlope: 0.20,
      wheelRadius: 0.35,
      wheelWidth: 0.24,
      wheelbaseHalf: 1.50,
      baseClearance: 0.16,
      wedgeFactor: 0.04,
    },
    defaultBuild: {
      bodyColor: '#06B6D4',
      paintFinish: 'pearl',
      rimDesign: 'turbofan',
      headlights: 'laser-blade',
      taillights: 'full-lightbar',
      decal: 'cyber-circuit',
      interior: 'cyber-cyan',
      powertrain: 'ev',
    },
  },
  {
    id: 'muscle',
    name: 'Ironhide V8',
    category: 'Muscle Car',
    description: 'Long sculpted hood and wide rear haunches inspired by classic American pony machines.',
    startingBudget: 49000,
    baseWeightKg: 1680,
    baseDragCd: 0.34,
    defaultColor: '#F59E0B',
    defaultPowertrain: 'petrol-v8',
    proportions: {
      length: 4.64,
      width: 1.94,
      bodyHeight: 0.62,
      cabinHeight: 0.43,
      cabinLength: 1.90,
      cabinOffsetZ: -0.30,
      hoodSlope: 0.07,
      trunkSlope: 0.14,
      wheelRadius: 0.36,
      wheelWidth: 0.28,
      wheelbaseHalf: 1.44,
      baseClearance: 0.17,
      wedgeFactor: 0.02,
    },
    defaultBuild: {
      bodyColor: '#F59E0B',
      paintFinish: 'gloss',
      spoiler: 'ducktail',
      frontBumper: 'sport-splitter',
      rearBumper: 'quad-diffuser',
      rimDesign: 'deep-mesh',
      decal: 'racing-stripes',
      decalColor: '#0F172A',
      powertrain: 'petrol-v8',
    },
  },
  {
    id: 'hatchback',
    name: 'Pulse RS Hatch',
    category: 'Hatchback',
    description: 'Nimble short-overhang hot hatch engineered for cornering agility and lightweight balance.',
    startingBudget: 36000,
    baseWeightKg: 1240,
    baseDragCd: 0.31,
    defaultColor: '#8B5CF6',
    defaultPowertrain: 'hybrid',
    proportions: {
      length: 4.02,
      width: 1.84,
      bodyHeight: 0.58,
      cabinHeight: 0.48,
      cabinLength: 2.15,
      cabinOffsetZ: -0.26,
      hoodSlope: 0.14,
      trunkSlope: 0.06,
      wheelRadius: 0.33,
      wheelWidth: 0.23,
      wheelbaseHalf: 1.28,
      baseClearance: 0.16,
      wedgeFactor: 0.03,
    },
    defaultBuild: {
      bodyColor: '#8B5CF6',
      paintFinish: 'metallic',
      spoiler: 'twin-swan',
      frontBumper: 'sport-splitter',
      rearBumper: 'twin-exhaust',
      rimDesign: 'twin-5',
      decal: 'aero-number',
    },
  },
];

export const PAINT_COLORS = [
  { name: 'Cobalt Pulse', hex: '#2563EB' },
  { name: 'Cyan Ion', hex: '#06B6D4' },
  { name: 'Inferno Red', hex: '#EF4444' },
  { name: 'Solar Amber', hex: '#F59E0B' },
  { name: 'Hyper Violet', hex: '#8B5CF6' },
  { name: 'Emerald Track', hex: '#10B981' },
  { name: 'Obsidian Night', hex: '#1E293B' },
  { name: 'Titanium Silver', hex: '#94A3B8' },
  { name: 'Glacier White', hex: '#F8FAFC' },
  { name: 'Magenta Drift', hex: '#EC4899' },
];

export const RIM_COLORS = [
  { name: 'Alloy Silver', hex: '#E2E8F0' },
  { name: 'Gunmetal', hex: '#475569' },
  { name: 'Satin Black', hex: '#111827' },
  { name: 'Championship Gold', hex: '#EAB308' },
  { name: 'Bronze Forged', hex: '#B45309' },
  { name: 'Electric Cyan', hex: '#22D3EE' },
];

export const CUSTOMIZATION_CATEGORIES = [
  { id: 'color', label: 'Body Color' },
  { id: 'finish', label: 'Paint Finish' },
  { id: 'wheels', label: 'Wheels' },
  { id: 'rims', label: 'Rims' },
  { id: 'spoilers', label: 'Spoilers' },
  { id: 'front-bumper', label: 'Front Bumper' },
  { id: 'rear-bumper', label: 'Rear Bumper' },
  { id: 'headlights', label: 'Headlights' },
  { id: 'taillights', label: 'Taillights' },
  { id: 'windows', label: 'Windows' },
  { id: 'decals', label: 'Decals' },
  { id: 'body-kits', label: 'Body Kits' },
  { id: 'interior', label: 'Interior' },
] as const;

export type CustomizerTabId = (typeof CUSTOMIZATION_CATEGORIES)[number]['id'];

export const OPTION_COSTS = {
  paintFinish: { gloss: 0, matte: 950, metallic: 1200, pearl: 1850 } as Record<PaintFinish, number>,
  rimDesign: { 'twin-5': 0, 'multi-10': 1100, turbofan: 1800, 'deep-mesh': 1400, 'offroad-bead': 1600 } as Record<RimDesign, number>,
  spoiler: { none: 0, lip: 650, 'gt-wing': 2200, ducktail: 950, 'twin-swan': 2600 } as Record<SpoilerStyle, number>,
  frontBumper: { stock: 0, 'sport-splitter': 1100, 'track-canards': 1750, bullbar: 1500 } as Record<FrontBumperStyle, number>,
  rearBumper: { stock: 0, 'quad-diffuser': 1450, 'twin-exhaust': 900, 'skid-plate': 1200 } as Record<RearBumperStyle, number>,
  headlights: { halos: 0, 'matrix-led': 1100, 'laser-blade': 1750, 'amber-rally': 950 } as Record<HeadlightStyle, number>,
  taillights: { 'classic-red': 0, 'full-lightbar': 1200, 'oled-blade': 1550, 'smoked-sport': 800 } as Record<TaillightStyle, number>,
  windowTint: { clear: 0, 'light-smoke': 350, 'midnight-tint': 650, 'iridescent-blue': 950 } as Record<WindowTintStyle, number>,
  decal: { none: 0, 'racing-stripes': 600, 'side-livery': 950, 'aero-number': 750, 'cyber-circuit': 1150 } as Record<DecalStyle, number>,
  bodyKit: { factory: 0, 'street-skirts': 1400, 'widebody-flares': 2900, 'aero-gt': 3600 } as Record<BodyKitStyle, number>,
  interior: { obsidian: 0, 'crimson-sport': 1200, 'tan-luxury': 1500, 'cyber-cyan': 1400 } as Record<InteriorTheme, number>,
  weightConcept: { 'balanced-alloy': 0, 'heavy-duty': 1100, 'lightweight-carbon': 4200 } as Record<WeightConcept, number>,
  powertrain: { 'petrol-v8': 0, hybrid: 2800, ev: 4500 } as Record<PowertrainType, number>,
};

export const ENVIRONMENT_OPTIONS: Array<{
  id: StudioEnvironment;
  name: string;
  desc: string;
}> = [
  { id: 'modern-studio', name: 'Modern Studio', desc: 'Clean bright key light & cyclorama turntable' },
  { id: 'night-city', name: 'Night City', desc: 'Midnight skyline silhouettes with cyan neon reflections' },
  { id: 'mountain-road', name: 'Mountain Road', desc: 'Alpine twilight highway with golden horizon light' },
  { id: 'futuristic-showroom', name: 'Futuristic Showroom', desc: 'Holographic grid floor & dual cyan/purple rims' },
  { id: 'dark-cinematic', name: 'Dark Cinematic', desc: 'Dramatic overhead spotlight on obsidian floor' },
];

export function createInitialBuild(vehicleId: VehicleTypeId): CarBuildConfig {
  const preset = VEHICLE_PRESETS.find((v) => v.id === vehicleId) || VEHICLE_PRESETS[0];
  const isEv = preset.defaultPowertrain === 'ev' || preset.id === 'electric';
  const defaultEngine: EngineConfig = isEv
    ? 'ev-dual'
    : preset.id === 'hatchback'
      ? 'i4'
      : preset.id === 'supercar' || preset.id === 'muscle'
        ? 'v8'
        : 'v6';
  return {
    vehicleId: preset.id,
    bodyColor: preset.defaultColor,
    paintFinish: 'metallic',
    rimDesign: 'twin-5',
    rimColor: '#E2E8F0',
    wheelScale: 1.0,
    suspensionOffsetMm: 0,
    spoiler: 'lip',
    frontBumper: 'stock',
    rearBumper: 'stock',
    headlights: 'matrix-led',
    taillights: 'full-lightbar',
    windowTint: 'light-smoke',
    decal: 'none',
    decalColor: '#22D3EE',
    bodyKit: 'factory',
    interior: 'obsidian',
    powertrain: preset.defaultPowertrain,
    weightConcept: 'balanced-alloy',
    environment: 'modern-studio',
    engineBayOpen: false,

    engineConfig: defaultEngine,
    forcedInduction: defaultEngine === 'v6' ? 'turbo' : 'none',
    intercooler: defaultEngine === 'v6',
    intakeUpgrade: 'stock',
    exhaustUpgrade: 'stock',
    fuelSystem: 'direct-injection',
    coolingUpgrade: 'standard',
    transmissionType: isEv ? 'ev-single' : preset.id === 'supercar' ? 'dct' : 'manual',
    differentialType: preset.id === 'supercar' || preset.id === 'sports-coupe' ? 'lsd' : 'open',
    gearRatioProfile: 'balanced',
    redlineRpm: isEv ? 8500 : defaultEngine === 'v8' ? 7200 : 7000,
    suspensionType: preset.id === 'supercar' || preset.id === 'sports-coupe' ? 'double-wishbone' : 'macpherson',
    springStiffnessNmm: preset.id === 'supercar' ? 68 : preset.id === 'offroad' ? 38 : 52,
    antiRollBars: preset.id === 'supercar' ? 'stiff-track' : 'standard',
    tireCompound: preset.id === 'electric' || preset.id === 'luxury-sedan' ? 'eco' : 'sport',
    brakeSystem: 'disc-abs',
    airDucts: preset.id === 'supercar',
    viewMode: 'exterior',
    activeMissionId: null,
    ...preset.defaultBuild,
  };
}

export function createRandomBuild(vehicleId: VehicleTypeId): CarBuildConfig {
  const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];
  const base = createInitialBuild(vehicleId);
  const paint = pick(PAINT_COLORS).hex;
  const rimC = pick(RIM_COLORS).hex;
  const eng = pick(['i4', 'v6', 'v8', 'ev-dual'] as const);
  const isEv = eng === 'ev-dual';
  return {
    ...base,
    bodyColor: paint,
    paintFinish: pick(['gloss', 'matte', 'metallic', 'pearl'] as const),
    rimDesign: pick(['twin-5', 'multi-10', 'turbofan', 'deep-mesh', 'offroad-bead'] as const),
    rimColor: rimC,
    wheelScale: Number((0.94 + Math.random() * 0.16).toFixed(2)),
    suspensionOffsetMm: Math.round(-18 + Math.random() * 38),
    spoiler: pick(['none', 'lip', 'gt-wing', 'ducktail', 'twin-swan'] as const),
    frontBumper: pick(['stock', 'sport-splitter', 'track-canards', 'bullbar'] as const),
    rearBumper: pick(['stock', 'quad-diffuser', 'twin-exhaust', 'skid-plate'] as const),
    headlights: pick(['halos', 'matrix-led', 'laser-blade', 'amber-rally'] as const),
    taillights: pick(['classic-red', 'full-lightbar', 'oled-blade', 'smoked-sport'] as const),
    windowTint: pick(['clear', 'light-smoke', 'midnight-tint', 'iridescent-blue'] as const),
    decal: pick(['none', 'racing-stripes', 'side-livery', 'aero-number', 'cyber-circuit'] as const),
    decalColor: pick(['#22D3EE', '#FACC15', '#FFFFFF', '#0F172A', '#F43F5E']),
    bodyKit: pick(['factory', 'street-skirts', 'widebody-flares', 'aero-gt'] as const),
    interior: pick(['obsidian', 'crimson-sport', 'tan-luxury', 'cyber-cyan'] as const),
    powertrain: isEv ? 'ev' : pick(['hybrid', 'petrol-v8'] as const),
    weightConcept: pick(['lightweight-carbon', 'balanced-alloy', 'heavy-duty'] as const),
    engineConfig: eng,
    forcedInduction: isEv ? 'none' : pick(['none', 'turbo', 'supercharger'] as const),
    intercooler: !isEv && Math.random() > 0.35,
    transmissionType: isEv ? 'ev-single' : pick(['manual', 'auto', 'dct'] as const),
    suspensionType: pick(['macpherson', 'double-wishbone'] as const),
    tireCompound: pick(['eco', 'sport', 'semi-slick'] as const),
    brakeSystem: pick(['disc', 'disc-abs'] as const),
    airDucts: Math.random() > 0.4,
  };
}

export interface CarTelemetryResult {
  preset: VehiclePreset;
  modCount: number;
  modCost: number;
  totalEstimatedValue: number;
  designRating: number;
  aeroScore: number;
  stanceScore: number;
  effectiveWeightKg: number;
  dragCoefficient: number;
  frontalAreaM2: number;
  horsepower: number;
  torqueNm: number;
  powerToWeightHpPerTon: number;
  accel0to100Sec: number;
  topSpeedKmh: number;
  braking100to0M: number;
  fuelEfficiencyKmL: number;
  fuelConsumptionL100Km: number;
  evWhPerKm: number;
  downforceN160Kmh: number;
  lateralGripG: number;
  rideFrequencyHz: number;
  thermalHeadroomPct: number;
  engineeringWarnings: string[];
  formulaNotes: string[];
  rangeOrEfficiencyNote: string;
}

export function evaluateCarTelemetry(rawConfig: CarBuildConfig): CarTelemetryResult {
  const preset = VEHICLE_PRESETS.find((v) => v.id === rawConfig.vehicleId) || VEHICLE_PRESETS[0];
  const base = createInitialBuild(rawConfig.vehicleId);
  // Ensure legacy saved builds cleanly populate missing engineering fields
  const config: CarBuildConfig = { ...base, ...rawConfig };

  const isEv = config.engineConfig === 'ev-dual' || config.powertrain === 'ev';
  const effectiveEngine: EngineConfig = isEv ? 'ev-dual' : config.engineConfig;

  const modCost =
    (OPTION_COSTS.paintFinish[config.paintFinish] || 0) +
    (OPTION_COSTS.rimDesign[config.rimDesign] || 0) +
    (OPTION_COSTS.spoiler[config.spoiler] || 0) +
    (OPTION_COSTS.frontBumper[config.frontBumper] || 0) +
    (OPTION_COSTS.rearBumper[config.rearBumper] || 0) +
    (OPTION_COSTS.headlights[config.headlights] || 0) +
    (OPTION_COSTS.taillights[config.taillights] || 0) +
    (OPTION_COSTS.windowTint[config.windowTint] || 0) +
    (OPTION_COSTS.decal[config.decal] || 0) +
    (OPTION_COSTS.bodyKit[config.bodyKit] || 0) +
    (OPTION_COSTS.interior[config.interior] || 0) +
    (OPTION_COSTS.weightConcept[config.weightConcept] || 0) +
    (OPTION_COSTS.powertrain[config.powertrain] || 0) +
    (effectiveEngine === 'v8' ? 6500 : effectiveEngine === 'v6' ? 3200 : effectiveEngine === 'ev-dual' ? 8500 : 0) +
    (config.forcedInduction === 'turbo' ? 4200 : config.forcedInduction === 'supercharger' ? 4600 : 0) +
    (config.intercooler ? 1100 : 0) +
    (config.transmissionType === 'dct' ? 3500 : config.transmissionType === 'auto' ? 2100 : 0) +
    (config.suspensionType === 'double-wishbone' ? 2800 : 0) +
    (config.brakeSystem === 'disc-abs' ? 1600 : config.brakeSystem === 'disc' ? 750 : 0);

  let modCount = 0;
  if (config.bodyColor !== base.bodyColor) modCount++;
  if (config.engineConfig !== base.engineConfig) modCount++;
  if (config.forcedInduction !== base.forcedInduction) modCount++;
  if (config.transmissionType !== base.transmissionType) modCount++;
  if (config.suspensionType !== base.suspensionType) modCount++;
  if (config.brakeSystem !== base.brakeSystem) modCount++;
  if (config.tireCompound !== base.tireCompound) modCount++;
  if (Math.abs(config.suspensionOffsetMm) >= 4) modCount++;
  if (config.spoiler !== base.spoiler) modCount++;
  if (config.frontBumper !== base.frontBumper) modCount++;
  if (config.rearBumper !== base.rearBumper) modCount++;
  if (config.bodyKit !== base.bodyKit) modCount++;

  // 1. MASS CALCULATION (kg)
  const chassisMassDelta =
    config.weightConcept === 'lightweight-carbon'
      ? -155
      : config.weightConcept === 'heavy-duty'
        ? 145
        : 0;
  const engineMassDelta =
    effectiveEngine === 'i4'
      ? -55
      : effectiveEngine === 'v6'
        ? 0
        : effectiveEngine === 'v8'
          ? 65
          : 155; // EV skateboard battery pack
  const hybridPackMass = !isEv && config.powertrain === 'hybrid' ? 65 : 0;
  const fiMass =
    (config.forcedInduction === 'turbo' ? 18 : config.forcedInduction === 'supercharger' ? 26 : 0) +
    (config.intercooler ? 9 : 0);
  const transMass =
    config.transmissionType === 'manual' ? -14 : config.transmissionType === 'auto' ? 14 : 6;
  const aeroMass =
    (config.spoiler === 'gt-wing' || config.spoiler === 'twin-swan' ? 11 : config.spoiler !== 'none' ? 3 : 0) +
    (config.frontBumper === 'bullbar' ? 24 : config.frontBumper !== 'stock' ? 5 : 0);
  const effectiveWeightKg = Math.max(
    980,
    Math.round(preset.baseWeightKg + chassisMassDelta + engineMassDelta + hybridPackMass + fiMass + transMass + aeroMass)
  );

  // 2. AERODYNAMICS (Cd, Frontal Area, Downforce)
  let cd = preset.baseDragCd;
  if (config.spoiler === 'lip') cd -= 0.010;
  if (config.spoiler === 'ducktail') cd -= 0.004;
  if (config.spoiler === 'gt-wing') cd += 0.030;
  if (config.spoiler === 'twin-swan') cd += 0.024;
  if (config.frontBumper === 'sport-splitter') cd -= 0.015;
  if (config.frontBumper === 'track-canards') cd += 0.008;
  if (config.frontBumper === 'bullbar') cd += 0.048;
  if (config.rearBumper === 'quad-diffuser') cd -= 0.020;
  if (config.rimDesign === 'turbofan') cd -= 0.014;
  if (config.bodyKit === 'street-skirts' || config.bodyKit === 'aero-gt') cd -= 0.008;
  if (config.bodyKit === 'widebody-flares') cd += 0.018;
  if (config.airDucts) cd -= 0.012;
  if (config.suspensionOffsetMm < -8) cd -= 0.012;
  if (config.suspensionOffsetMm > 12) cd += 0.024;
  cd = Number(Math.max(0.185, Math.min(0.49, cd)).toFixed(3));

  const frontalAreaM2 = Number(
    (preset.proportions.width * (preset.proportions.bodyHeight + preset.proportions.cabinHeight) * 1.15).toFixed(2)
  );

  const downforceN160Kmh = Math.round(
    (config.frontBumper === 'sport-splitter' ? 180 : config.frontBumper === 'track-canards' ? 240 : 40) +
      (config.rearBumper === 'quad-diffuser' ? 240 : 30) +
      (config.spoiler === 'gt-wing'
        ? 440
        : config.spoiler === 'twin-swan'
          ? 420
          : config.spoiler === 'ducktail'
            ? 140
            : config.spoiler === 'lip'
              ? 80
              : 0) +
      (config.bodyKit === 'aero-gt' ? 110 : 0)
  );

  // 3. ENGINE & POWERTRAIN OUTPUT (HP & Torque Nm)
  let baseHp =
    effectiveEngine === 'i4' ? 190 : effectiveEngine === 'v6' ? 315 : effectiveEngine === 'v8' ? 455 : 495;
  let baseTorque =
    effectiveEngine === 'i4' ? 250 : effectiveEngine === 'v6' ? 380 : effectiveEngine === 'v8' ? 560 : 690;

  if (!isEv) {
    if (config.forcedInduction === 'turbo') {
      baseHp *= 1.36;
      baseTorque *= 1.40;
      if (!config.intercooler) {
        // Thermal charge density penalty without intercooler
        baseHp *= 0.90;
        baseTorque *= 0.92;
      } else {
        baseHp *= 1.05;
      }
    } else if (config.forcedInduction === 'supercharger') {
      baseHp *= 1.28;
      baseTorque *= 1.34;
    }
    if (config.intakeUpgrade === 'cold-air') {
      baseHp *= 1.045;
      baseTorque *= 1.03;
    }
    if (config.exhaustUpgrade === 'headers-titanium') {
      baseHp *= 1.055;
      baseTorque *= 1.04;
    }
    if (config.fuelSystem === 'direct-injection') {
      baseHp *= 1.04;
      baseTorque *= 1.04;
    }
    if (config.powertrain === 'hybrid') {
      baseHp += 65;
      baseTorque += 110;
    }
    // Redline scaling around 7,000 RPM baseline
    const rpmFactor = 0.88 + ((config.redlineRpm - 5500) / 3500) * 0.22;
    baseHp *= rpmFactor;
  }

  const transEff =
    config.transmissionType === 'ev-single'
      ? 0.94
      : config.transmissionType === 'manual'
        ? 0.96
        : config.transmissionType === 'dct'
          ? 0.95
          : 0.91;
  const horsepower = Math.round(baseHp);
  const torqueNm = Math.round(baseTorque);
  const wheelHp = horsepower * transEff;
  const powerToWeightHpPerTon = Math.round((horsepower / (effectiveWeightKg / 1000)) * 10) / 10;

  // 4. 0-100 KM/H ACCELERATION (Physics-calibrated launch + power/weight model)
  const tireLaunchGrip =
    config.tireCompound === 'semi-slick' ? 1.18 : config.tireCompound === 'sport' ? 1.04 : 0.88;
  const lsdFactor = config.differentialType === 'lsd' ? 0.94 : 1.0;
  const shiftPenalty =
    config.transmissionType === 'ev-single'
      ? 0.86
      : config.transmissionType === 'dct'
        ? 0.92
        : config.transmissionType === 'auto'
          ? 0.98
          : 1.03;
  const gearLaunchMult =
    config.gearRatioProfile === 'short' ? 0.93 : config.gearRatioProfile === 'tall' ? 1.07 : 1.0;
  const raw0to100 =
    (960 / Math.max(85, (wheelHp / (effectiveWeightKg / 1000)) * 1.18 * tireLaunchGrip)) *
      shiftPenalty *
      lsdFactor *
      gearLaunchMult +
    0.85;
  const accel0to100Sec = Number(Math.max(2.1, Math.min(11.8, raw0to100)).toFixed(2));

  // 5. TOP SPEED (Aerodynamic drag equilibrium: P_wheel = 0.5 * rho * Cd * A * v^3 + Crr * m * g * v)
  const airDensity = 1.225;
  const wheelWatts = wheelHp * 745.7;
  // Iterative cubic root approximation around road load
  let vMs = Math.cbrt(wheelWatts / (0.5 * airDensity * cd * frontalAreaM2));
  const rollingDragFactor = config.tireCompound === 'eco' ? 0.99 : config.tireCompound === 'semi-slick' ? 0.96 : 0.98;
  const gearTopMult =
    config.gearRatioProfile === 'tall' ? 1.04 : config.gearRatioProfile === 'short' ? 0.92 : 1.0;
  const topSpeedKmh = Math.round(
    Math.max(165, Math.min(395, vMs * 3.6 * 0.92 * rollingDragFactor * gearTopMult))
  );

  // 6. BRAKING PERFORMANCE (100 - 0 km/h stopping distance d = v^2 / (2 * mu * g))
  const v100Ms = 100 / 3.6; // 27.78 m/s
  let brakeDecelG =
    config.brakeSystem === 'disc-abs' ? 1.10 : config.brakeSystem === 'disc' ? 0.96 : 0.78;
  if (config.tireCompound === 'semi-slick') brakeDecelG += 0.14;
  else if (config.tireCompound === 'sport') brakeDecelG += 0.06;
  else brakeDecelG -= 0.06;
  if (config.airDucts) brakeDecelG += 0.03;
  if (downforceN160Kmh > 350) brakeDecelG += 0.04;
  // Heavy chassis slightly penalizes thermal inertia
  brakeDecelG -= Math.max(0, (effectiveWeightKg - 1500) / 5000);
  const braking100to0M = Number(
    Math.max(26.5, Math.min(54.0, (v100Ms * v100Ms) / (2 * Math.max(0.65, brakeDecelG) * 9.81))).toFixed(1)
  );

  // 7. FUEL / ENERGY EFFICIENCY
  let fuelConsumptionL100Km = 0;
  let fuelEfficiencyKmL = 0;
  let evWhPerKm = 0;
  if (isEv) {
    // EV Wh/km driven by aerodynamic drag, mass, and eco tires
    const aeroWattsAt100 = 0.5 * airDensity * cd * frontalAreaM2 * Math.pow(27.78, 3);
    const rollingWatts = 0.009 * (config.tireCompound === 'eco' ? 0.85 : 1.08) * effectiveWeightKg * 9.81 * 27.78;
    evWhPerKm = Math.round(((aeroWattsAt100 + rollingWatts) / 0.88) / 100);
    fuelEfficiencyKmL = Number((8900 / Math.max(115, evWhPerKm)).toFixed(1)); // MPGe / km/L equivalent
    fuelConsumptionL100Km = Number((evWhPerKm / 89).toFixed(1));
  } else {
    const engFuelBase = effectiveEngine === 'i4' ? 5.1 : effectiveEngine === 'v6' ? 7.6 : 10.6;
    const fiPenalty =
      config.forcedInduction === 'supercharger' ? 1.18 : config.forcedInduction === 'turbo' ? 1.07 : 1.0;
    const hybridSave = config.powertrain === 'hybrid' ? 0.72 : 1.0;
    const gdiSave = config.fuelSystem === 'direct-injection' ? 0.91 : 1.0;
    const tireFactor = config.tireCompound === 'eco' ? 0.92 : config.tireCompound === 'semi-slick' ? 1.09 : 1.0;
    const gearEcon = config.gearRatioProfile === 'tall' ? 0.91 : config.gearRatioProfile === 'short' ? 1.12 : 1.0;
    const aeroFactor = 0.85 + cd * 0.62;
    const massFactor = effectiveWeightKg / 1450;
    fuelConsumptionL100Km = Number(
      Math.max(
        3.2,
        Math.min(22.5, engFuelBase * fiPenalty * hybridSave * gdiSave * tireFactor * gearEcon * aeroFactor * massFactor)
      ).toFixed(1)
    );
    fuelEfficiencyKmL = Number((100 / fuelConsumptionL100Km).toFixed(1));
  }

  // 8. SUSPENSION & CORNERING GRIP
  const cornerMassKg = effectiveWeightKg / 4;
  // f = (1 / 2pi) * sqrt(k / m)
  const rideFrequencyHz = Number(
    ((1 / (2 * Math.PI)) * Math.sqrt((config.springStiffnessNmm * 1000) / cornerMassKg)).toFixed(2)
  );
  const lateralGripG = Number(
    Math.max(
      0.72,
      Math.min(
        1.52,
        (config.tireCompound === 'semi-slick' ? 1.14 : config.tireCompound === 'sport' ? 0.98 : 0.84) +
          (config.suspensionType === 'double-wishbone' ? 0.11 : 0.02) +
          (config.antiRollBars === 'stiff-track' ? 0.05 : 0.01) +
          (config.suspensionOffsetMm < -4 ? 0.04 : config.suspensionOffsetMm > 15 ? -0.08 : 0) +
          downforceN160Kmh / 5500
      )
    ).toFixed(2)
  );

  // 9. THERMAL HEADROOM & ENGINEERING WARNINGS
  const heatLoad = horsepower * (config.forcedInduction !== 'none' ? 1.25 : 1.0);
  const coolingCapacity =
    (config.coolingUpgrade === 'high-flow-alu' ? 680 : 480) +
    (config.intercooler ? 130 : 0) +
    (config.airDucts ? 80 : 0);
  const thermalHeadroomPct = Math.round(Math.max(35, Math.min(99, (coolingCapacity / Math.max(250, heatLoad)) * 82)));

  const engineeringWarnings: string[] = [];
  if (config.forcedInduction === 'turbo' && !config.intercooler && !isEv) {
    engineeringWarnings.push('Turbocharger running without Intercooler: intake air >120°C costs ~10% HP.');
  }
  if (horsepower >= 460 && config.brakeSystem === 'drum') {
    engineeringWarnings.push('Critical Safety Mismatch: 460+ HP with Drum Brakes causes severe thermal brake fade.');
  }
  if (config.suspensionOffsetMm < -20 && config.wheelScale > 1.08) {
    engineeringWarnings.push('Fender Clearance Alert: Extreme lowering with oversized wheels risks arch rubbing.');
  }
  if (thermalHeadroomPct < 65 && !isEv) {
    engineeringWarnings.push('Cooling Capacity Tight: Upgrade to Dual-Pass Aluminum Radiator + Air Ducts.');
  }

  const aeroScore = Math.round(
    Math.max(45, Math.min(99, 84 - (cd - 0.23) * 145 + (downforceN160Kmh > 300 ? 7 : 0) + (config.airDucts ? 4 : 0)))
  );
  const stanceScore = Math.round(
    Math.max(55, Math.min(99, 70 + lateralGripG * 18 + (config.suspensionType === 'double-wishbone' ? 6 : 0)))
  );
  const designRating = Math.round(
    Math.max(
      58,
      Math.min(
        99,
        62 + powerToWeightHpPerTon * 0.045 + (aeroScore - 65) * 0.25 + (38 - braking100to0M) * 0.9
      )
    )
  );

  const formulaNotes = [
    `Power-to-Weight = ${horsepower} HP ÷ ${(effectiveWeightKg / 1000).toFixed(2)} t = ${powerToWeightHpPerTon} HP/t`,
    `Aero Drag Power @ 160 km/h = 0.5 × 1.225 × ${cd} × ${frontalAreaM2} m² × (44.4 m/s)³`,
    `Stopping Dist. = v² ÷ (2 × μg) → 100–0 km/h in ${braking100to0M} m`,
    `Ride Freq. = (1/2π) × √(${config.springStiffnessNmm * 1000} N/m ÷ ${Math.round(cornerMassKg)} kg) = ${rideFrequencyHz} Hz`,
  ];

  const rangeOrEfficiencyNote = isEv
    ? `${evWhPerKm} Wh/km EV draw · Instant 0-RPM inverter torque & regenerative braking.`
    : `${fuelEfficiencyKmL} km/L (${fuelConsumptionL100Km} L/100km) · ${
        config.powertrain === 'hybrid'
          ? 'Hybrid regenerative recovery cuts urban fuel burn.'
          : 'Combustion map tuned for thermal stability.'
      }`;

  return {
    preset,
    modCount,
    modCost,
    totalEstimatedValue: preset.startingBudget + modCost,
    designRating,
    aeroScore,
    stanceScore,
    effectiveWeightKg,
    dragCoefficient: cd,
    frontalAreaM2,
    horsepower,
    torqueNm,
    powerToWeightHpPerTon,
    accel0to100Sec,
    topSpeedKmh,
    braking100to0M,
    fuelEfficiencyKmL,
    fuelConsumptionL100Km,
    evWhPerKm,
    downforceN160Kmh,
    lateralGripG,
    rideFrequencyHz,
    thermalHeadroomPct,
    engineeringWarnings,
    formulaNotes,
    rangeOrEfficiencyNote,
  };
}

export interface CarEngineeringMission {
  id: string;
  number: number;
  title: string;
  objective: string;
  engineeringLesson: string;
  evaluate: (
    config: CarBuildConfig,
    telemetry: CarTelemetryResult
  ) => {
    passed: boolean;
    score: number;
    accuracy: number;
    checklist: Array<{ label: string; ok: boolean }>;
    tradeoffFeedback: string;
  };
}

export const CAR_MISSIONS: CarEngineeringMission[] = [
  {
    id: 'mission-fuel-efficiency',
    number: 1,
    title: 'Mission 1: Build a Fuel-Efficient Car',
    objective: 'Minimize aerodynamic drag, rolling resistance, and vehicle mass without hurting highway efficiency.',
    engineeringLesson: 'Fuel consumption scales directly with mass, rolling resistance, and Cd·A aerodynamic drag.',
    evaluate: (cfg, t) => {
      const checks = [
        { label: `Fuel burn ≤ 6.0 L/100km (now ${t.fuelConsumptionL100Km} L/100km)`, ok: t.fuelConsumptionL100Km <= 6.0 },
        { label: `Drag Cd ≤ 0.275 (now ${t.dragCoefficient})`, ok: t.dragCoefficient <= 0.275 },
        { label: `Vehicle mass ≤ 1,550 kg (now ${t.effectiveWeightKg} kg)`, ok: t.effectiveWeightKg <= 1550 },
        { label: 'Low-rolling-resistance Eco tires installed', ok: cfg.tireCompound === 'eco' },
      ];
      const okCount = checks.filter((c) => c.ok).length;
      const passed = okCount === checks.length;
      return {
        passed,
        score: passed ? Math.round(350 + (6.5 - t.fuelConsumptionL100Km) * 45) : okCount * 60,
        accuracy: Math.round((okCount / checks.length) * 100),
        checklist: checks,
        tradeoffFeedback: passed
          ? `Optimal cruise aerodynamics (Cd ${t.dragCoefficient}) with Eco tires cuts parasitic road load, yielding ${t.fuelEfficiencyKmL} km/L.`
          : 'Trade-off Tip: Try Hatchback or Sedan + I4/Hybrid, Lightweight Carbon, Tall gear ratios, Diffuser, and Eco tires.',
      };
    },
  },
  {
    id: 'mission-lightweight-accel',
    number: 2,
    title: 'Mission 2: High Acceleration Without Excess Mass',
    objective: 'Maximize power-to-weight ratio (≥ 270 HP/tonne) and sprint 0–100 km/h in ≤ 3.8 s while keeping weight ≤ 1,480 kg.',
    engineeringLesson: 'Reducing mass improves acceleration AND braking & cornering simultaneously—unlike adding heavy displacement alone.',
    evaluate: (cfg, t) => {
      const checks = [
        { label: `0–100 km/h ≤ 3.80 s (now ${t.accel0to100Sec} s)`, ok: t.accel0to100Sec <= 3.8 },
        { label: `Curb mass ≤ 1,480 kg (now ${t.effectiveWeightKg} kg)`, ok: t.effectiveWeightKg <= 1480 },
        { label: `Power-to-Weight ≥ 270 HP/t (now ${t.powerToWeightHpPerTon} HP/t)`, ok: t.powerToWeightHpPerTon >= 270 },
        { label: 'DCT or EV fast-shift drivetrain + LSD traction', ok: (cfg.transmissionType === 'dct' || cfg.transmissionType === 'ev-single') && cfg.differentialType === 'lsd' },
      ];
      const okCount = checks.filter((c) => c.ok).length;
      const passed = okCount === checks.length;
      return {
        passed,
        score: passed ? Math.round(420 + (4.2 - t.accel0to100Sec) * 80) : okCount * 65,
        accuracy: Math.round((okCount / checks.length) * 100),
        checklist: checks,
        tradeoffFeedback: passed
          ? `Achieved ${t.powerToWeightHpPerTon} HP/tonne at just ${t.effectiveWeightKg} kg — crisp DCT/LSD launch reaches 100 km/h in ${t.accel0to100Sec}s.`
          : 'Trade-off Tip: Pair Lightweight Carbon body with Turbo V6/V8, Short gears, DCT, Helical LSD, and Sport/Semi-slick tires.',
      };
    },
  },
  {
    id: 'mission-balanced-suspension',
    number: 3,
    title: 'Mission 3: Balanced Handling Suspension',
    objective: 'Configure camber-controlling Double Wishbone geometry, 1.8–2.3 Hz ride frequency, and ≥ 1.08g lateral cornering grip.',
    engineeringLesson: 'Too-stiff springs bounce tires over bumps; Double Wishbone kinematics keep the tire flat without harsh ride rates.',
    evaluate: (cfg, t) => {
      const freqOk = t.rideFrequencyHz >= 1.65 && t.rideFrequencyHz <= 2.45;
      const heightOk = cfg.suspensionOffsetMm >= -18 && cfg.suspensionOffsetMm <= 4;
      const checks = [
        { label: 'Double Wishbone suspension installed', ok: cfg.suspensionType === 'double-wishbone' },
        { label: `Balanced ride freq. 1.65–2.45 Hz (now ${t.rideFrequencyHz} Hz)`, ok: freqOk },
        { label: `Lateral Grip ≥ 1.08g (now ${t.lateralGripG}g)`, ok: t.lateralGripG >= 1.08 },
        { label: `Track-tuned anti-roll bars & ride height (-18..+4mm, now ${cfg.suspensionOffsetMm}mm)`, ok: cfg.antiRollBars === 'stiff-track' && heightOk },
      ];
      const okCount = checks.filter((c) => c.ok).length;
      const passed = okCount === checks.length;
      return {
        passed,
        score: passed ? Math.round(380 + t.lateralGripG * 100) : okCount * 65,
        accuracy: Math.round((okCount / checks.length) * 100),
        checklist: checks,
        tradeoffFeedback: passed
          ? `Ride frequency sits in the sweet spot (${t.rideFrequencyHz} Hz) with ${t.lateralGripG}g cornering grip and balanced camber control.`
          : 'Trade-off Tip: Select Double Wishbone, set stiffness ~55–75 N/mm, equip Stiff-Track anti-roll bars and Sport/Semi-slick tires.',
      };
    },
  },
  {
    id: 'mission-low-drag-aero',
    number: 4,
    title: 'Mission 4: Reduce Aerodynamic Drag',
    objective: 'Slice drag coefficient to Cd ≤ 0.235 while preserving stable underbody airflow with no high-drag rear wings.',
    engineeringLesson: 'High wings create drag (∝ v²); ground-effect splitters, Venturi diffusers, and air curtains cut drag AND lift.',
    evaluate: (cfg, t) => {
      const noHighDragWing = cfg.spoiler !== 'gt-wing' && cfg.spoiler !== 'twin-swan' && cfg.frontBumper !== 'bullbar';
      const checks = [
        { label: `Drag coefficient Cd ≤ 0.235 (now ${t.dragCoefficient})`, ok: t.dragCoefficient <= 0.235 },
        { label: 'Front Splitter + Venturi Quad-Diffuser fitted', ok: cfg.frontBumper === 'sport-splitter' && cfg.rearBumper === 'quad-diffuser' },
        { label: 'Brake/Wheel Air Ducts + Turbofan aero wheels', ok: cfg.airDucts && cfg.rimDesign === 'turbofan' },
        { label: 'No high-drag GT Wing or Bullbar', ok: noHighDragWing },
      ];
      const okCount = checks.filter((c) => c.ok).length;
      const passed = okCount === checks.length;
      return {
        passed,
        score: passed ? Math.round(400 + (0.26 - t.dragCoefficient) * 2000) : okCount * 65,
        accuracy: Math.round((okCount / checks.length) * 100),
        checklist: checks,
        tradeoffFeedback: passed
          ? `Wind-tunnel slipperiness achieved (Cd ${t.dragCoefficient})! Top speed climbs to ${t.topSpeedKmh} km/h cleanly without a draggy rear wing.`
          : 'Trade-off Tip: Use Sport Splitter, Quad-Diffuser, Air Ducts, Turbofan rims, and lowered ride height (-10mm).',
      };
    },
  },
  {
    id: 'mission-braking-safety',
    number: 5,
    title: 'Mission 5: Improve Braking Performance',
    objective: 'Engineer emergency stopping distance ≤ 32.5 m (100–0 km/h) with ABS modulation, rotor cooling ducts, and high-μ tires.',
    engineeringLesson: 'Braking distance drops quadratically only up to tire adhesion limits—ABS + thermal cooling keeps friction consistent.',
    evaluate: (cfg, t) => {
      const checks = [
        { label: `100–0 km/h Stopping Distance ≤ 32.5 m (now ${t.braking100to0M} m)`, ok: t.braking100to0M <= 32.5 },
        { label: 'Ventilated Discs + 4-Channel ABS active', ok: cfg.brakeSystem === 'disc-abs' },
        { label: 'Rotor cooling Air Ducts installed', ok: cfg.airDucts },
        { label: 'High-grip Sport or Semi-Slick tires fitted', ok: cfg.tireCompound !== 'eco' },
      ];
      const okCount = checks.filter((c) => c.ok).length;
      const passed = okCount === checks.length;
      return {
        passed,
        score: passed ? Math.round(410 + (36 - t.braking100to0M) * 35) : okCount * 65,
        accuracy: Math.round((okCount / checks.length) * 100),
        checklist: checks,
        tradeoffFeedback: passed
          ? `Stops from 100 km/h in ${t.braking100to0M} m! ABS holds optimal 15% tire slip while cooling ducts prevent pad fade.`
          : 'Trade-off Tip: Equip Disc + ABS, enable Air Ducts, reduce vehicle mass, and switch to Semi-Slick tires.',
      };
    },
  },
  {
    id: 'mission-turbo-engine',
    number: 6,
    title: 'Mission 6: High-Performance Turbocharged Engine',
    objective: 'Build a thermally stable turbocharged ICE producing ≥ 480 HP and ≥ 560 Nm torque with zero cooling deficits.',
    engineeringLesson: 'Forced induction multiplies power, but compressed charge air and extra heat require an Intercooler + High-Flow Radiator.',
    evaluate: (cfg, t) => {
      const isIce = cfg.engineConfig !== 'ev-dual' && cfg.powertrain !== 'ev';
      const checks = [
        { label: 'Combustion Engine + Turbocharger installed', ok: isIce && cfg.forcedInduction === 'turbo' },
        { label: 'Air-to-Air Intercooler + High-Flow Aluminum Cooling', ok: cfg.intercooler && cfg.coolingUpgrade === 'high-flow-alu' },
        { label: `Output ≥ 480 HP & ≥ 560 Nm (now ${t.horsepower} HP / ${t.torqueNm} Nm)`, ok: t.horsepower >= 480 && t.torqueNm >= 560 },
        { label: `Thermal Headroom ≥ 70% (now ${t.thermalHeadroomPct}%)`, ok: t.thermalHeadroomPct >= 70 },
      ];
      const okCount = checks.filter((c) => c.ok).length;
      const passed = okCount === checks.length;
      return {
        passed,
        score: passed ? Math.round(450 + (t.horsepower - 480) * 1.2) : okCount * 70,
        accuracy: Math.round((okCount / checks.length) * 100),
        checklist: checks,
        tradeoffFeedback: passed
          ? `Boosted ${t.horsepower} HP / ${t.torqueNm} Nm with ${t.thermalHeadroomPct}% cooling margin — cold dense intake charge avoids detonation.`
          : 'Trade-off Tip: Select V6 or V8 + Turbocharger + Intercooler + High-Flow Radiator + Direct Injection.',
      };
    },
  },
  {
    id: 'mission-ev-powertrain',
    number: 7,
    title: 'Mission 7: Electric Vehicle Powertrain',
    objective: 'Engineer a zero-emission 800V Dual-Motor EV hitting 0–100 km/h ≤ 3.5 s while keeping energy draw ≤ 185 Wh/km.',
    engineeringLesson: 'EVs overcome battery weight with instant motor torque and ultra-low drag (Cd) + eco rolling resistance.',
    evaluate: (cfg, t) => {
      const isEv = cfg.powertrain === 'ev' && cfg.engineConfig === 'ev-dual';
      const checks = [
        { label: 'EV Dual-Motor Powertrain configured', ok: isEv },
        { label: `Energy Draw ≤ 185 Wh/km (now ${t.evWhPerKm || '--'} Wh/km)`, ok: isEv && t.evWhPerKm <= 185 },
        { label: `0–100 km/h ≤ 3.50 s (now ${t.accel0to100Sec} s)`, ok: t.accel0to100Sec <= 3.5 },
        { label: 'Regenerative braking paired with Disc + ABS', ok: cfg.brakeSystem === 'disc-abs' },
      ];
      const okCount = checks.filter((c) => c.ok).length;
      const passed = okCount === checks.length;
      return {
        passed,
        score: passed ? Math.round(460 + (200 - t.evWhPerKm) * 2.5) : okCount * 70,
        accuracy: Math.round((okCount / checks.length) * 100),
        checklist: checks,
        tradeoffFeedback: passed
          ? `800V Dual-Motor EV hits 100 km/h in ${t.accel0to100Sec}s at an ultra-clean ${t.evWhPerKm} Wh/km!`
          : 'Trade-off Tip: Select EV Powertrain + EV Dual Motor, Lightweight Carbon, Aero Diffuser/Splitter + Turbofans to cut Wh/km.',
      };
    },
  },
];


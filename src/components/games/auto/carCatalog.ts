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
    ...preset.defaultBuild,
  };
}

export function createRandomBuild(vehicleId: VehicleTypeId): CarBuildConfig {
  const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];
  const paint = pick(PAINT_COLORS).hex;
  const rimC = pick(RIM_COLORS).hex;
  return {
    vehicleId,
    bodyColor: paint,
    paintFinish: pick(['gloss', 'matte', 'metallic', 'pearl'] as const),
    rimDesign: pick(['twin-5', 'multi-10', 'turbofan', 'deep-mesh', 'offroad-bead'] as const),
    rimColor: rimC,
    wheelScale: Number((0.94 + Math.random() * 0.2).toFixed(2)),
    suspensionOffsetMm: Math.round(-20 + Math.random() * 48),
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
    powertrain: pick(['ev', 'hybrid', 'petrol-v8'] as const),
    weightConcept: pick(['lightweight-carbon', 'balanced-alloy', 'heavy-duty'] as const),
    environment: pick(['modern-studio', 'night-city', 'mountain-road', 'futuristic-showroom', 'dark-cinematic'] as const),
    engineBayOpen: false,
  };
}

export function evaluateCarTelemetry(config: CarBuildConfig): {
  preset: VehiclePreset;
  modCount: number;
  modCost: number;
  totalEstimatedValue: number;
  designRating: number;
  aeroScore: number;
  stanceScore: number;
  effectiveWeightKg: number;
  dragCoefficient: number;
  rangeOrEfficiencyNote: string;
} {
  const preset = VEHICLE_PRESETS.find((v) => v.id === config.vehicleId) || VEHICLE_PRESETS[0];
  const base = createInitialBuild(config.vehicleId);

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
    (OPTION_COSTS.powertrain[config.powertrain] || 0);

  let modCount = 0;
  if (config.bodyColor !== base.bodyColor) modCount++;
  if (config.paintFinish !== base.paintFinish) modCount++;
  if (config.rimDesign !== base.rimDesign || config.rimColor !== base.rimColor) modCount++;
  if (Math.abs(config.wheelScale - 1) >= 0.03) modCount++;
  if (Math.abs(config.suspensionOffsetMm) >= 4) modCount++;
  if (config.spoiler !== base.spoiler) modCount++;
  if (config.frontBumper !== base.frontBumper) modCount++;
  if (config.rearBumper !== base.rearBumper) modCount++;
  if (config.headlights !== base.headlights) modCount++;
  if (config.taillights !== base.taillights) modCount++;
  if (config.windowTint !== base.windowTint) modCount++;
  if (config.decal !== base.decal) modCount++;
  if (config.bodyKit !== base.bodyKit) modCount++;
  if (config.interior !== base.interior) modCount++;

  // Conceptual aero & stance scoring (explicitly educational simulation)
  let cd = preset.baseDragCd;
  if (config.spoiler === 'lip') cd -= 0.01;
  if (config.spoiler === 'gt-wing') cd += 0.03; // Downforce trade-off
  if (config.frontBumper === 'sport-splitter') cd -= 0.015;
  if (config.frontBumper === 'bullbar') cd += 0.045;
  if (config.rearBumper === 'quad-diffuser') cd -= 0.02;
  if (config.rimDesign === 'turbofan') cd -= 0.012;
  if (config.bodyKit === 'widebody-flares') cd += 0.018;
  if (config.suspensionOffsetMm < -10) cd -= 0.012;
  if (config.suspensionOffsetMm > 15) cd += 0.025;
  cd = Number(Math.max(0.19, Math.min(0.49, cd)).toFixed(3));

  const aeroScore = Math.round(
    Math.max(
      45,
      Math.min(
        99,
        82 -
          (cd - 0.24) * 140 +
          (config.rearBumper === 'quad-diffuser' ? 8 : 0) +
          (config.frontBumper !== 'stock' ? 5 : 0) +
          (config.spoiler !== 'none' ? 6 : 0)
      )
    )
  );

  const stanceScore = Math.round(
    Math.max(
      55,
      Math.min(
        99,
        74 +
          (config.bodyKit !== 'factory' ? 10 : 0) +
          (config.rimDesign !== 'twin-5' ? 6 : 3) +
          (preset.id === 'offroad' && config.suspensionOffsetMm > 5 ? 8 : config.suspensionOffsetMm < 0 ? 7 : 2)
      )
    )
  );

  const weightDelta =
    config.weightConcept === 'lightweight-carbon'
      ? -145
      : config.weightConcept === 'heavy-duty'
        ? 165
        : 0;
  const powertrainWeight = config.powertrain === 'ev' ? 140 : config.powertrain === 'hybrid' ? 75 : 0;
  const effectiveWeightKg = preset.baseWeightKg + weightDelta + powertrainWeight;

  const harmonyBonus =
    (config.paintFinish === 'metallic' || config.paintFinish === 'pearl' ? 6 : 4) +
    (config.interior !== 'obsidian' ? 4 : 1) +
    (config.headlights !== 'halos' ? 3 : 1);

  const designRating = Math.round(
    Math.max(60, Math.min(99, 64 + Math.min(18, modCount * 2.5) + harmonyBonus + (aeroScore - 70) * 0.2))
  );

  const rangeOrEfficiencyNote =
    config.powertrain === 'ev'
      ? 'Zero tailpipe emissions; flat floor lowers center of gravity.'
      : config.powertrain === 'hybrid'
        ? 'Regenerative braking pairs electric torque with extended range.'
        : 'High-revving combustion layout favors mechanical sound & cooling airflow.';

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
    rangeOrEfficiencyNote,
  };
}

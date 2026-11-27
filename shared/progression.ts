import type {
  DailyChallengeInfo,
  DailyTripleStatus,
  GameModeId,
  PixelThemeId,
  PlaygroundMiniGameDef,
  WeeklyEventInfo,
} from './types.ts';

export interface LevelThreshold {
  level: number;
  minXp: number;
  title: string;
}

export const LEVEL_THRESHOLDS: LevelThreshold[] = [
  { level: 1, minXp: 0, title: 'Rookie Engineer' },
  { level: 2, minXp: 200, title: 'Solder Apprentice' },
  { level: 3, minXp: 480, title: 'Circuit Technician' },
  { level: 4, minXp: 820, title: 'Systems Explorer' },
  { level: 5, minXp: 1200, title: 'Junior Engineer' },
  { level: 6, minXp: 1650, title: 'Prototype Specialist' },
  { level: 7, minXp: 2150, title: 'Logic Strategist' },
  { level: 8, minXp: 2700, title: 'Hardware Tuner' },
  { level: 9, minXp: 3300, title: 'Control Architect' },
  { level: 10, minXp: 4000, title: 'Builder' },
  { level: 15, minXp: 7500, title: 'Senior Builder' },
  { level: 20, minXp: 12000, title: 'Advanced Engineer' },
  { level: 25, minXp: 17500, title: 'Lead Systems Designer' },
  { level: 30, minXp: 24000, title: 'Engineering Pro' },
  { level: 40, minXp: 38000, title: 'Principal Innovator' },
  { level: 50, minXp: 55000, title: 'Master Engineer' },
];

export const PROGRESSION_MILESTONES: Array<{ level: number; title: string; minXp: number; reward: string }> = [
  { level: 1, title: 'Rookie Engineer', minXp: 0, reward: 'Cyber Midnight theme & Playground access' },
  { level: 5, title: 'Junior Engineer', minXp: 1200, reward: 'Emerald Matrix & Junior Badge' },
  { level: 10, title: 'Builder', minXp: 4000, reward: 'Volcanic Forge & Master Builder eligibility' },
  { level: 20, title: 'Advanced Engineer', minXp: 12000, reward: 'Synthwave Grid & Pro Telemetry tier' },
  { level: 30, title: 'Engineering Pro', minXp: 24000, reward: 'Pro Crest & Ranked Elite tier' },
  { level: 50, title: 'Master Engineer', minXp: 55000, reward: 'Grand Master Crown & All Honors' },
];

export interface PixelThemeDef {
  id: PixelThemeId;
  name: string;
  unlockLevel: number;
  description: string;
  swatches: [string, string, string];
}

export const PIXEL_THEMES: PixelThemeDef[] = [
  {
    id: 'cyber-midnight',
    name: 'Cyber Midnight',
    unlockLevel: 1,
    description: 'Deep navy void with electric cyan & arcade yellow.',
    swatches: ['#080C1E', '#00F0FF', '#FFE600'],
  },
  {
    id: 'emerald-matrix',
    name: 'Emerald Matrix',
    unlockLevel: 2,
    description: 'Classic phosphor CRT green terminal palette.',
    swatches: ['#05130C', '#22FF66', '#FFE600'],
  },
  {
    id: 'volcanic-forge',
    name: 'Volcanic Forge',
    unlockLevel: 4,
    description: 'Superheated obsidian with pixel orange plasma.',
    swatches: ['#160A08', '#FF6B00', '#FFE600'],
  },
  {
    id: 'synthwave-grid',
    name: 'Synthwave Grid',
    unlockLevel: 6,
    description: 'High-voltage arcade purple and neon horizon.',
    swatches: ['#120824', '#D946EF', '#00F0FF'],
  },
];

export interface AchievementDef {
  id: string;
  name: string;
  description: string;
  xpBonus: number;
  category: 'gameplay' | 'mastery' | 'secret';
}

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    id: 'first_run',
    name: 'BOOT SEQUENCE',
    description: 'Complete your first engineering challenge.',
    xpBonus: 50,
    category: 'gameplay',
  },
  {
    id: 'first_quiz',
    name: 'FIRST QUIZ',
    description: 'Complete your first scored engineering quiz.',
    xpBonus: 50,
    category: 'gameplay',
  },
  {
    id: 'first_minigame',
    name: 'FIRST MINI GAME',
    description: 'Complete any interactive engineering mini-game.',
    xpBonus: 60,
    category: 'gameplay',
  },
  {
    id: 'first_build',
    name: 'FIRST BUILD',
    description: 'Save or test a custom machine in a 3D Builder.',
    xpBonus: 75,
    category: 'gameplay',
  },
  {
    id: 'questions_100',
    name: 'CENTURY SCHOLAR',
    description: 'Answer 100 quiz questions across sessions.',
    xpBonus: 200,
    category: 'mastery',
  },
  {
    id: 'streak_master',
    name: 'STREAK MASTER',
    description: 'Hit a 5-answer combo streak without missing.',
    xpBonus: 100,
    category: 'mastery',
  },
  {
    id: 'streak_10',
    name: '10 WIN STREAK',
    description: 'Reach a 10-answer streak or 10 consecutive wins.',
    xpBonus: 220,
    category: 'mastery',
  },
  {
    id: 'perfect_run',
    name: 'FLAWLESS CIRCUIT',
    description: 'Score 100% accuracy in a full quiz or mini-game.',
    xpBonus: 150,
    category: 'mastery',
  },
  {
    id: 'new_pb',
    name: 'PERSONAL BEST',
    description: 'Beat your own verified record on a game or track test.',
    xpBonus: 80,
    category: 'gameplay',
  },
  {
    id: 'top_100',
    name: 'TOP 100 ENGINEER',
    description: 'Break into the Top 100 on a verified leaderboard.',
    xpBonus: 80,
    category: 'gameplay',
  },
  {
    id: 'top_50',
    name: 'TOP 50 ENGINEER',
    description: 'Climb into the Top 50 on a verified leaderboard.',
    xpBonus: 100,
    category: 'gameplay',
  },
  {
    id: 'top_10',
    name: 'TOP 10 CONTENDER',
    description: 'Reach Top 10 on a verified leaderboard.',
    xpBonus: 160,
    category: 'mastery',
  },
  {
    id: 'top_3',
    name: 'PODIUM FINISHER',
    description: 'Claim a Gold, Silver, or Bronze Top 3 podium spot.',
    xpBonus: 220,
    category: 'mastery',
  },
  {
    id: 'first_place',
    name: 'GRAND CHAMPION #1',
    description: 'Reach #1 overall on a verified leaderboard.',
    xpBonus: 350,
    category: 'mastery',
  },
  {
    id: 'speed_demon',
    name: 'SPEED DEMON',
    description: 'Clock a sub-230ms average reaction or finish Speed Run under 35s.',
    xpBonus: 150,
    category: 'mastery',
  },
  {
    id: 'test_driver',
    name: 'TEST DRIVER',
    description: 'Complete track telemetry runs in the 3D Car Simulator.',
    xpBonus: 120,
    category: 'gameplay',
  },
  {
    id: 'car_engineer',
    name: 'CAR ENGINEER',
    description: 'Tune and save custom 3D builds in Car Engineering Studio.',
    xpBonus: 120,
    category: 'gameplay',
  },
  {
    id: 'phone_designer',
    name: 'PHONE DESIGNER',
    description: 'Create and test a device in the Smartphone Lab.',
    xpBonus: 120,
    category: 'gameplay',
  },
  {
    id: 'master_builder',
    name: 'MASTER BUILDER',
    description: 'Build and test across both 3D Builders and Bridge/Gear labs.',
    xpBonus: 240,
    category: 'mastery',
  },
  {
    id: 'scholar',
    name: 'SYSTEMS SCHOLAR',
    description: 'Inspect 10+ engineering subsystems in CAD Learning Mode.',
    xpBonus: 120,
    category: 'mastery',
  },
  {
    id: 'boss_slayer',
    name: 'ENTROPY SLAYER',
    description: 'Defeat an Engineering Boss in Boss Battle.',
    xpBonus: 175,
    category: 'gameplay',
  },
  {
    id: 'circuit_architect',
    name: 'CIRCUIT ARCHITECT',
    description: 'Clear 4+ stages in Circuit Rush or Circuit Connect.',
    xpBonus: 120,
    category: 'gameplay',
  },
  {
    id: 'code_ninja',
    name: 'DEBUG NINJA',
    description: 'Solve 5+ puzzles in Code Breaker.',
    xpBonus: 120,
    category: 'gameplay',
  },
  {
    id: 'competitor',
    name: 'ARENA CONTENDER',
    description: 'Submit an official Competitive mode run.',
    xpBonus: 100,
    category: 'gameplay',
  },
  {
    id: 'easy_scholar',
    name: 'KNOWLEDGE SPARK',
    description: 'Complete an Easy Quiz Zone round with 80%+ accuracy.',
    xpBonus: 80,
    category: 'gameplay',
  },
  {
    id: 'car_designer',
    name: 'CHASSIS ARCHITECT',
    description: 'Build and save your first custom 3D car design.',
    xpBonus: 120,
    category: 'gameplay',
  },
  {
    id: 'phone_architect',
    name: 'DEVICE CREATOR',
    description: 'Design and save your first next-gen smartphone.',
    xpBonus: 120,
    category: 'gameplay',
  },
  {
    id: 'studio_master',
    name: 'STUDIO INNOVATOR',
    description: 'Create both a custom car and a custom smartphone.',
    xpBonus: 180,
    category: 'mastery',
  },
  {
    id: 'konami',
    name: 'LEGACY OVERRIDE',
    description: 'Entered the classic arcade code.',
    xpBonus: 75,
    category: 'secret',
  },
  {
    id: 'logo_poke',
    name: 'CORE OVERHEAT',
    description: 'Poked the CG QUIZ logo 5 times in a row.',
    xpBonus: 50,
    category: 'secret',
  },
  {
    id: 'cpu_key',
    name: 'SILICON WHISPER',
    description: 'Typed "CG" on the keyboard outside inputs.',
    xpBonus: 50,
    category: 'secret',
  },
  {
    id: 'night_owl',
    name: 'MIDNIGHT LAB',
    description: 'Trained in the engineering studio after midnight.',
    xpBonus: 60,
    category: 'secret',
  },
];

export const PLAYGROUND_MINIGAMES: PlaygroundMiniGameDef[] = [
  {
    id: 'reaction-test',
    title: 'Reaction Test',
    tagline: 'Wait for signal flash -> Strike fast across 5 rounds',
    category: 'Reaction',
    difficulty: 'Easy',
    controlsSummary: 'Click / Tap Pad or press Spacebar',
    howToPlay: 'Wait calmly while the signal arms. The instant it turns bright green, tap or hit Spacebar! False starts reset the round.',
    scoreUnit: 'pts',
    higherIsBetter: true,
    minValidSeconds: 2,
    maxValidScore: 1500,
    leaderboardLabel: 'Fastest Avg Reaction (ms)',
    funFacts: [
      'Human visual reaction averages 220-270ms; Formula 1 drivers react to start lights in ~180-210ms.',
      'Neural signals travel along myelinated motor axons at roughly 70 to 120 meters per second.',
    ],
    accentColor: '#10B981',
  },
  {
    id: 'circuit-connect',
    title: 'Circuit Connect',
    tagline: 'Drag & wire Battery, Switch, Resistor, Bulb & Motor',
    category: 'Engineering',
    difficulty: 'Medium',
    controlsSummary: 'Tap/Drag terminals to wire closed loops',
    howToPlay: 'Connect terminals from the DC source through switches and components back to ground across 5 progressive circuit schematics.',
    scoreUnit: 'pts',
    higherIsBetter: true,
    minValidSeconds: 5,
    maxValidScore: 2200,
    leaderboardLabel: 'Circuit Master Score',
    funFacts: [
      'Current only flows through a closed loop—any break creates an open circuit with zero continuous current.',
      'Series loads share current, whereas parallel branches share the same terminal voltage.',
    ],
    accentColor: '#F59E0B',
  },
  {
    id: 'engineering-balance',
    title: 'Engineering Balance',
    tagline: 'Stack & balance uneven mass blocks on a live fulcrum',
    category: 'Physics',
    difficulty: 'Medium',
    controlsSummary: 'Tap slot or Drag mass blocks + Balance button',
    howToPlay: 'Place weighted engineering blocks onto beam stations so torque stays near zero (m1*d1 = m2*d2) and clear 5 stability levels.',
    scoreUnit: 'pts',
    higherIsBetter: true,
    minValidSeconds: 5,
    maxValidScore: 2000,
    leaderboardLabel: 'Torque Equilibrium Score',
    funFacts: [
      'A beam balances when clockwise and counter-clockwise torques cancel: Sum(Force × Lever Arm) = 0.',
      'Moving a heavy battery pack closer to the center cuts rotational inertia dramatically.',
    ],
    accentColor: '#06B6D4',
  },
  {
    id: 'robot-control',
    title: 'Robot Control',
    tagline: 'Pilot rover through barriers, batteries & recharge pads',
    category: 'Tech',
    difficulty: 'Medium',
    controlsSummary: 'WASD / Arrow Keys or Mobile D-Pad',
    howToPlay: 'Steer the autonomous rover around hazard barriers, collect lithium power cells, and dock onto the target pad across 5 sectors.',
    scoreUnit: 'pts',
    higherIsBetter: true,
    minValidSeconds: 4,
    maxValidScore: 2200,
    leaderboardLabel: 'Autonomous Navigation Score',
    funFacts: [
      'Warehouse AGVs combine wheel odometry with SLAM pathfinding to dodge dynamic obstacles in milliseconds.',
      'Minimizing sharp 90-degree turns saves battery energy and reduces tire slip.',
    ],
    accentColor: '#3B82F6',
  },
  {
    id: 'memory-circuit',
    title: 'Memory Circuit',
    tagline: 'Watch the LED pulse sequence, then replay without errors',
    category: 'Memory',
    difficulty: 'Easy',
    controlsSummary: 'Tap colored LED pads or keys 1-6',
    howToPlay: 'Observe the microcontroller LED flash sequence carefully, then repeat the exact order as sequence length and tempo climb.',
    scoreUnit: 'pts',
    higherIsBetter: true,
    minValidSeconds: 4,
    maxValidScore: 2500,
    leaderboardLabel: 'Longest Signal Sequence',
    funFacts: [
      'Microcontroller shift registers clock serial bits one pulse at a time into parallel output latches.',
      'Chunking patterns into pairs boosts working-memory recall from ~4 items to 8+ items.',
    ],
    accentColor: '#8B5CF6',
  },
  {
    id: 'tech-assembly',
    title: 'Tech Assembly',
    tagline: 'Snap Motherboard, CPU, Cooler, RAM, GPU & SSD into place',
    category: 'Building',
    difficulty: 'Easy',
    controlsSummary: 'Drag parts or Tap Part -> Tap Socket',
    howToPlay: 'Assemble a full workstation in correct mechanical order—install the CPU before its cooler, seat DDR5 RAM, GPU, and NVMe SSD fast!',
    scoreUnit: 'pts',
    higherIsBetter: true,
    minValidSeconds: 4,
    maxValidScore: 2000,
    leaderboardLabel: 'Fastest Clean PC Build',
    funFacts: [
      'CPUs must lock cleanly into zero-insertion-force LGA/AM5 pins before thermal paste and heatsinks go on.',
      'Dual-channel DDR5 sticks belong in matched slots (typically A2/B2) to double memory bandwidth.',
    ],
    accentColor: '#0EA5E9',
  },
  {
    id: 'drone-landing',
    title: 'Drone Landing',
    tagline: 'Tame wind, gravity & battery to touch down smoothly',
    category: 'Physics',
    difficulty: 'Hard',
    controlsSummary: 'Arrow Keys / WASD or On-Screen Thrusters',
    howToPlay: 'Fire main upward and lateral thrusters to counter wind shear, dodge pylons, and land gently on the target pad under safe touchdown speed.',
    scoreUnit: 'pts',
    higherIsBetter: true,
    minValidSeconds: 4,
    maxValidScore: 2400,
    leaderboardLabel: 'Precision Touchdown Score',
    funFacts: [
      'Quadcopters balance downward thrust against gravity while tilting pitch/roll vectors for horizontal motion.',
      'PID flight controllers adjust motor PWM hundreds of times per second to fight wind gusts.',
    ],
    accentColor: '#14B8A6',
  },
  {
    id: 'bridge-builder',
    title: 'Bridge Builder',
    tagline: 'Span cliff trusses & run a live load test vehicle across',
    category: 'Building',
    difficulty: 'Hard',
    controlsSummary: 'Click nodes to build steel trusses + Test Load',
    howToPlay: 'Link anchor nodes with tension/compression truss beams within your beam budget, then press TEST BRIDGE to drive the truck across!',
    scoreUnit: 'pts',
    higherIsBetter: true,
    minValidSeconds: 5,
    maxValidScore: 2400,
    leaderboardLabel: 'Structural Efficiency Score',
    funFacts: [
      'Triangles are the fundamental rigid polygon in truss bridges because loads distribute directly along axial members.',
      'Under load, upper bridge chords undergo compression while lower chords experience tension.',
    ],
    accentColor: '#F97316',
  },
  {
    id: 'gear-machine',
    title: 'Gear Machine',
    tagline: 'Mesh 8T, 12T, 16T & 24T gears to hit target output speed',
    category: 'Engineering',
    difficulty: 'Medium',
    controlsSummary: 'Pick a gear tooth size -> Tap axle peg',
    howToPlay: 'Mount meshing spur gears from the powered input shaft to the output shaft so adjacent gears lock teeth and hit the exact target ratio.',
    scoreUnit: 'pts',
    higherIsBetter: true,
    minValidSeconds: 4,
    maxValidScore: 2100,
    leaderboardLabel: 'Mechanical Ratio Score',
    funFacts: [
      'Each pair of external spur gears reverses rotation direction and scales speed by Driver Teeth / Driven Teeth.',
      'Higher gear reduction trades top RPM for multiplied wheel torque.',
    ],
    accentColor: '#EAB308',
  },
  {
    id: 'sort-circuit',
    title: 'Sort the Circuit',
    tagline: 'Rapid-sort components into Power, Control, Output & Sensors',
    category: 'Tech',
    difficulty: 'Easy',
    controlsSummary: 'Keys 1-4 or Tap Category Bins',
    howToPlay: 'Identify each incoming hardware component rapidly and route it into POWER, CONTROL, OUTPUT, or SENSORS before the timer expires.',
    scoreUnit: 'pts',
    higherIsBetter: true,
    minValidSeconds: 5,
    maxValidScore: 2200,
    leaderboardLabel: 'High-Speed Triage Score',
    funFacts: [
      'Embedded systems separate cleanly into input sensing, MCU logic control, power regulation, and actuation.',
      'Regulators convert noisy battery voltage into clean 3.3V/5V rails for sensitive processors.',
    ],
    accentColor: '#22C55E',
  },
  {
    id: 'rocket-balance',
    title: 'Rocket Balance',
    tagline: 'Steer & boost inside the safe telemetry corridor',
    category: 'Physics',
    difficulty: 'Hard',
    controlsSummary: 'LEFT / RIGHT / BOOST Buttons or Arrow Keys',
    howToPlay: 'Use gentle Left/Right gimbal steering and Boost pulses to keep the rocket inside the shifting safe flight corridor while managing fuel.',
    scoreUnit: 'pts',
    higherIsBetter: true,
    minValidSeconds: 5,
    maxValidScore: 2500,
    leaderboardLabel: 'Orbital Ascent Score',
    funFacts: [
      'Orbital rockets tilt gradually via a gravity turn so thrust builds horizontal orbital velocity efficiently.',
      'Thrust-vectoring gimbals pivot engine nozzles by just a few degrees to keep massive boosters upright.',
    ],
    accentColor: '#EC4899',
  },
  {
    id: 'engineering-speedrun',
    title: 'Engineering Speed Run',
    tagline: '5 chained mini-challenges in one nonstop timed sprint',
    category: 'Engineering',
    difficulty: 'Hard',
    controlsSummary: 'Mouse / Touch + Spacebar across 5 stages',
    howToPlay: 'Race the clock through 5 back-to-back tasks: Wire Connection -> Component Snap -> Switch Sequence -> Target Lock -> Machine Start!',
    scoreUnit: 'pts',
    higherIsBetter: true,
    minValidSeconds: 5,
    maxValidScore: 3000,
    leaderboardLabel: 'Fastest Sprint Completion',
    funFacts: [
      'Real factory commissioning follows sequential pre-flight checklists: Continuity -> Mounting -> Switchgear -> Calibration -> Ignition.',
      'Cutting handoffs between sub-tasks saves more cycle time than speeding up any single motion.',
    ],
    accentColor: '#EF4444',
  },
];

export const PLAYGROUND_MINIGAME_MAP = new Map<GameModeId, PlaygroundMiniGameDef>(
  PLAYGROUND_MINIGAMES.map((g) => [g.id, g])
);

export function getMiniGameDef(gameId: GameModeId): PlaygroundMiniGameDef | undefined {
  return PLAYGROUND_MINIGAME_MAP.get(gameId);
}

export function computeLevelFromXp(xp: number): {
  level: number;
  title: string;
  currentLevelXp: number;
  nextLevelXp: number | null;
  progressPercent: number;
} {
  let current = LEVEL_THRESHOLDS[0];
  let next: LevelThreshold | null = LEVEL_THRESHOLDS[1];

  for (let i = 0; i < LEVEL_THRESHOLDS.length; i++) {
    if (xp >= LEVEL_THRESHOLDS[i].minXp) {
      current = LEVEL_THRESHOLDS[i];
      next = LEVEL_THRESHOLDS[i + 1] ?? null;
    }
  }

  if (!next) {
    return {
      level: current.level,
      title: current.title,
      currentLevelXp: current.minXp,
      nextLevelXp: null,
      progressPercent: 100,
    };
  }

  const span = next.minXp - current.minXp;
  const gained = xp - current.minXp;
  return {
    level: current.level,
    title: current.title,
    currentLevelXp: current.minXp,
    nextLevelXp: next.minXp,
    progressPercent: Math.min(100, Math.max(0, Math.round((gained / span) * 100))),
  };
}

export function getUnlockedThemesForLevel(level: number): PixelThemeId[] {
  return PIXEL_THEMES.filter((t) => level >= t.unlockLevel).map((t) => t.id);
}

const DAILY_TEMPLATES: Array<{
  title: string;
  description: string;
  gameType: GameModeId;
  categoryId: string;
  targetScore: number;
  xpReward: number;
}> = [
  {
    title: 'Reaction Calibration',
    description: 'Complete Reaction Test with 750+ pts today.',
    gameType: 'reaction-test',
    categoryId: 'electronics',
    targetScore: 750,
    xpReward: 150,
  },
  {
    title: 'Circuit Connect Sprint',
    description: 'Wire all 5 loops cleanly in Circuit Connect.',
    gameType: 'circuit-connect',
    categoryId: 'electronics',
    targetScore: 800,
    xpReward: 170,
  },
  {
    title: 'Autonomous Rover Drill',
    description: 'Clear Robot Control sectors with 850+ pts.',
    gameType: 'robot-control',
    categoryId: 'cs',
    targetScore: 850,
    xpReward: 180,
  },
  {
    title: 'Precision Truss Challenge',
    description: 'Pass Bridge Builder load tests with 800+ pts.',
    gameType: 'bridge-builder',
    categoryId: 'mechanical',
    targetScore: 800,
    xpReward: 180,
  },
  {
    title: 'PC Assembly Blitz',
    description: 'Snap every workstation component under target time.',
    gameType: 'tech-assembly',
    categoryId: 'programming',
    targetScore: 800,
    xpReward: 160,
  },
  {
    title: 'Engineering Speed Sprint',
    description: 'Complete all 5 Engineering Speed Run stages.',
    gameType: 'engineering-speedrun',
    categoryId: 'mechanical',
    targetScore: 1000,
    xpReward: 200,
  },
];

export function getDailyChallengeForDate(dateStr: string, completed = false): DailyChallengeInfo {
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    hash = (hash * 31 + dateStr.charCodeAt(i)) >>> 0;
  }
  const tpl = DAILY_TEMPLATES[hash % DAILY_TEMPLATES.length];
  return {
    date: dateStr,
    ...tpl,
    completed,
  };
}

export function getDailyTripleForDate(
  dateStr: string,
  completedFlags: { quiz?: boolean; miniGame?: boolean; builder?: boolean } = {}
): DailyTripleStatus {
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    hash = (hash * 33 + dateStr.charCodeAt(i)) >>> 0;
  }
  const quizCategories = [
    { id: 'physics', label: 'Physics & Motion' },
    { id: 'computer-science', label: 'Computer Science' },
    { id: 'engineering', label: 'Core Engineering' },
    { id: 'automobile', label: 'Automotive Systems' },
  ];
  const qc = quizCategories[hash % quizCategories.length];
  const mg = PLAYGROUND_MINIGAMES[hash % PLAYGROUND_MINIGAMES.length];
  const isCarDay = hash % 2 === 0;

  return {
    date: dateStr,
    quiz: {
      title: `Daily Quiz · ${qc.label}`,
      description: `Finish a 10-question ${qc.label} sprint with 70%+ accuracy.`,
      categoryId: qc.id,
      targetCount: 10,
      completed: Boolean(completedFlags.quiz),
      xpReward: 140,
    },
    miniGame: {
      gameId: mg.id,
      title: `Daily Mini-Game · ${mg.title}`,
      description: mg.tagline,
      targetScore: 700,
      completed: Boolean(completedFlags.miniGame),
      xpReward: 160,
    },
    builder: {
      studio: isCarDay ? 'auto-engineer' : 'phone-designer',
      title: isCarDay ? 'Daily 3D Car Challenge' : 'Daily Phone Lab Challenge',
      description: isCarDay
        ? 'Tune a car and clock a 0-100 km/h run on the 3D Test Track.'
        : 'Assemble a custom smartphone within 200 pts and run a Test Lab check.',
      completed: Boolean(completedFlags.builder),
      xpReward: 180,
    },
  };
}

const WEEKLY_EVENT_ROTATION: Array<Omit<WeeklyEventInfo, 'weekId' | 'endsInLabel'>> = [
  {
    title: 'Fastest Driver Week',
    subtitle: '0-100 km/h & Slalom Track Leaderboard Sprint',
    featuredGameId: 'car-test-0-100',
    ruleSummary: 'Tune your chassis, hit the 3D track, and clock your quickest verified launch & slalom run.',
    bonusXp: 250,
  },
  {
    title: 'Circuit Champion Week',
    subtitle: 'Circuit Connect & Speed Run Mastery',
    featuredGameId: 'circuit-connect',
    ruleSummary: 'Zero open-circuit errors across 5 wiring challenges climbs the Weekly Event ladder.',
    bonusXp: 250,
  },
  {
    title: 'Reaction & Precision Week',
    subtitle: 'Sub-230ms Neural Reflex Championship',
    featuredGameId: 'reaction-test',
    ruleSummary: 'Server checks human reaction bounds (120ms+ floor). Beat your PB to rank top 10.',
    bonusXp: 220,
  },
  {
    title: 'Master Builder Week',
    subtitle: 'Bridge Load Tests, Tech Assembly & 3D Studios',
    featuredGameId: 'bridge-builder',
    ruleSummary: 'Build stiff low-beam bridges and balanced 3D designs to maximize efficiency points.',
    bonusXp: 280,
  },
];

export function getWeeklyEventForDate(dateStr: string): WeeklyEventInfo {
  const dt = new Date(`${dateStr}T00:00:00Z`);
  const dayOfYear = Math.floor(
    (dt.getTime() - Date.UTC(dt.getUTCFullYear(), 0, 1)) / (24 * 60 * 60 * 1000)
  );
  const weekNum = Math.max(1, Math.ceil((dayOfYear + 1) / 7));
  const weekId = `${dt.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`;
  const idx = weekNum % WEEKLY_EVENT_ROTATION.length;
  const daysLeft = 7 - ((dt.getUTCDay() + 6) % 7);

  return {
    weekId,
    ...WEEKLY_EVENT_ROTATION[idx],
    endsInLabel: `${daysLeft}d left`,
  };
}

export const ENGINEERING_JOKES: string[] = [
  'Why do programmers prefer dark mode? Because light attracts bugs!',
  'A resistor walks into a bar... wait, there was too much impedance.',
  'There are 10 types of engineers: those who read binary and those who do not.',
  'Mechanical engineers build weapons. Civil engineers build targets.',
  'Why was the capacitor promoted? It had tremendous potential.',
  'Debugging: being the detective in a crime movie where you are also the culprit.',
  'An infinite loop walks into a bar. An infinite loop walks into a bar...',
  'Hardware is the part of a computer you can kick when software freezes.',
  'Ohm my goodness, current events are shocking today!',
  'Why did the neural network fail art class? Overfitting to the training canvas.',
];

export const FUNNY_GAME_OVER_MESSAGES: string[] = [
  'Magic smoke escaped! Check polarity and reboot.',
  'Segmentation fault in brain cache. Insert coin to retry!',
  'Even Nikola Tesla tripped over a wire once. Probably.',
  'Your solder joint went cold. Grab the iron and go again!',
  'Stack overflow! Time to pop some knowledge back onto the heap.',
];

export const EXAM_LEVEL_THRESHOLDS: Array<{ minXp: number; title: 'Beginner' | 'Learner' | 'Explorer' | 'Advanced' | 'Expert' | 'Master' }> = [
  { minXp: 0, title: 'Beginner' },
  { minXp: 200, title: 'Learner' },
  { minXp: 550, title: 'Explorer' },
  { minXp: 1100, title: 'Advanced' },
  { minXp: 1900, title: 'Expert' },
  { minXp: 3000, title: 'Master' },
];

export function computeExamLevel(xp: number): {
  title: 'Beginner' | 'Learner' | 'Explorer' | 'Advanced' | 'Expert' | 'Master';
  nextMinXp: number | null;
  progressPercent: number;
} {
  let current = EXAM_LEVEL_THRESHOLDS[0];
  let next: typeof EXAM_LEVEL_THRESHOLDS[number] | null = EXAM_LEVEL_THRESHOLDS[1];
  for (let i = 0; i < EXAM_LEVEL_THRESHOLDS.length; i++) {
    if (xp >= EXAM_LEVEL_THRESHOLDS[i].minXp) {
      current = EXAM_LEVEL_THRESHOLDS[i];
      next = EXAM_LEVEL_THRESHOLDS[i + 1] ?? null;
    }
  }
  if (!next) {
    return { title: current.title, nextMinXp: null, progressPercent: 100 };
  }
  const span = next.minXp - current.minXp;
  const gained = xp - current.minXp;
  return {
    title: current.title,
    nextMinXp: next.minXp,
    progressPercent: Math.min(100, Math.max(0, Math.round((gained / span) * 100))),
  };
}


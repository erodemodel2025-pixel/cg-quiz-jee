export interface CodePuzzle {
  id: string;
  language: 'C' | 'C++' | 'Python' | 'Java' | 'HTML' | 'CSS' | 'JavaScript' | 'Algorithms';
  kind: 'output' | 'debug' | 'complexity';
  title: string;
  prompt: string;
  code: string;
  options: [string, string, string, string];
  correctIndex: 0 | 1 | 2 | 3;
  explanation: string;
}

export interface LogicPuzzle {
  id: string;
  topic: 'Logic Gate' | 'Binary & Hex' | 'Sequence' | 'Spatial & Gear' | 'Probability';
  title: string;
  prompt: string;
  diagramLines?: string[];
  gateChallenge?: {
    gate: 'AND' | 'OR' | 'XOR' | 'NAND' | 'NOR';
    inputA: 0 | 1;
    inputB: 0 | 1;
  };
  options: [string, string, string, string];
  correctIndex: 0 | 1 | 2 | 3;
  explanation: string;
}

export interface ComponentCardDef {
  id: string;
  name: string;
  symbol: string;
  functionText: string;
  color: string;
}

export interface CircuitTileDef {
  type: 'source' | 'load' | 'straight' | 'corner' | 'tee' | 'block';
  /** Base connections at rotation=0 in [N, E, S, W] */
  fixedRotation?: number;
  label?: string;
}

export interface CircuitStageDef {
  id: string;
  level: number;
  title: string;
  subtitle: string;
  voltage: string;
  explanation: string;
  rows: number;
  cols: number;
  sourcePos: [number, number];
  loadPos: [number, number];
  /** Solution grid: each cell has type and target rotation (0,1,2,3 = 0,90,180,270 deg) */
  cells: Array<Array<{ type: CircuitTileDef['type']; solutionRot: number; locked?: boolean }>>;
}

export const CODE_PUZZLES: CodePuzzle[] = [
  {
    id: 'cb-c-1',
    language: 'C',
    kind: 'output',
    title: 'Pointer Arithmetic',
    prompt: 'What does this C snippet print?',
    code: `int arr[] = {10, 20, 30, 40};\nint *p = arr + 1;\nprintf("%d", *(p + 2));`,
    options: ['20', '30', '40', 'Garbage address'],
    correctIndex: 2,
    explanation: 'p points to arr[1] (20). Advancing p + 2 moves to arr[3], whose value is 40.',
  },
  {
    id: 'cb-py-1',
    language: 'Python',
    kind: 'output',
    title: 'List Slicing Step',
    prompt: 'What is the output of this Python expression?',
    code: `nums = [1, 2, 3, 4, 5, 6]\nprint(nums[::-2])`,
    options: ['[6, 4, 2]', '[5, 3, 1]', '[1, 3, 5]', '[6, 5, 4]'],
    correctIndex: 0,
    explanation: 'Step -2 traverses from the end backward every 2 elements: index -1 (6), -3 (4), -5 (2).',
  },
  {
    id: 'cb-js-1',
    language: 'JavaScript',
    kind: 'debug',
    title: 'Async Loop Closure Bug',
    prompt: 'Why does this JS loop print 3, 3, 3 instead of 0, 1, 2?',
    code: `for (var i = 0; i < 3; i++) {\n  setTimeout(() => console.log(i), 10);\n}`,
    options: [
      'setTimeout ignores arrow functions',
      'var is function-scoped so all callbacks share the final i = 3',
      'i++ executes after console.log',
      'JavaScript loops always execute backward',
    ],
    correctIndex: 1,
    explanation: 'Using var shares one binding across iterations. Changing var to let creates a fresh block-scoped i per iteration.',
  },
  {
    id: 'cb-cpp-1',
    language: 'C++',
    kind: 'debug',
    title: 'Integer Division Trap',
    prompt: 'What does avg evaluate to in C++?',
    code: `int a = 5, b = 2;\ndouble avg = a / b;\ncout << avg;`,
    options: ['2.5', '2', '3', 'Compilation error'],
    correctIndex: 1,
    explanation: 'Both a and b are int, so a / b performs integer division (2) before converting to double.',
  },
  {
    id: 'cb-java-1',
    language: 'Java',
    kind: 'debug',
    title: 'String Equality Pitfall',
    prompt: 'Why can s1 == s2 return false in Java even when contents match?',
    code: `String s1 = new String("CG");\nString s2 = new String("CG");\nSystem.out.println(s1 == s2);`,
    options: [
      'Strings are mutable in Java',
      '== compares object references, not character values',
      'new String() converts to lowercase',
      'System.out.println coerces booleans',
    ],
    correctIndex: 1,
    explanation: 'Use s1.equals(s2) to compare String contents; == checks whether both references point to the exact same heap object.',
  },
  {
    id: 'cb-html-1',
    language: 'HTML',
    kind: 'debug',
    title: 'Accessible Form Input',
    prompt: 'Which attribute pairs a <label> directly with an <input id="pilot">?',
    code: `<label ???="pilot">Pilot Name</label>\n<input id="pilot" type="text" />`,
    options: ['name', 'for', 'target', 'bind'],
    correctIndex: 1,
    explanation: 'In HTML, <label for="pilot"> binds to the element with id="pilot", improving click area and screen-reader accessibility.',
  },
  {
    id: 'cb-css-1',
    language: 'CSS',
    kind: 'output',
    title: 'Specificity Showdown',
    prompt: 'Which color wins on <p id="hero" class="note">Hi</p>?',
    code: `#hero { color: cyan; }\n.note { color: yellow !important; }\np { color: lime; }`,
    options: ['cyan', 'yellow', 'lime', 'default black'],
    correctIndex: 1,
    explanation: 'An !important declaration overrides higher-specificity normal author rules.',
  },
  {
    id: 'cb-algo-1',
    language: 'Algorithms',
    kind: 'complexity',
    title: 'Nested Halving Loop',
    prompt: 'What is the time complexity of this algorithm?',
    code: `for (int i = 0; i < n; i++) {\n  for (int j = n; j > 1; j /= 2) {\n    sum += i + j;\n  }\n}`,
    options: ['O(n)', 'O(log n)', 'O(n log n)', 'O(n²)'],
    correctIndex: 2,
    explanation: 'The outer loop runs n times and the inner loop halves j (log₂ n steps), giving O(n log n).',
  },
];

export const LOGIC_PUZZLES: LogicPuzzle[] = [
  {
    id: 'll-gate-1',
    topic: 'Logic Gate',
    title: 'XOR Gate Output',
    prompt: 'Given inputs A = 1 and B = 1 entering an XOR gate, what is output Q?',
    gateChallenge: { gate: 'XOR', inputA: 1, inputB: 1 },
    options: ['0 (LOW)', '1 (HIGH)', 'High-Z', 'Oscillating'],
    correctIndex: 0,
    explanation: 'XOR outputs 1 only when inputs differ. Since A = 1 and B = 1 are identical, Q = 0.',
  },
  {
    id: 'll-gate-2',
    topic: 'Logic Gate',
    title: 'NAND Gate Output',
    prompt: 'Inputs A = 0 and B = 1 enter a NAND gate. What is output Q?',
    gateChallenge: { gate: 'NAND', inputA: 0, inputB: 1 },
    options: ['0 (LOW)', '1 (HIGH)', 'Undefined', 'Equal to A'],
    correctIndex: 1,
    explanation: '0 AND 1 = 0, and NAND inverts that result to 1 (HIGH).',
  },
  {
    id: 'll-bin-1',
    topic: 'Binary & Hex',
    title: 'Hexadecimal Byte Decode',
    prompt: 'Convert the hexadecimal value 0x2F to decimal:',
    diagramLines: ['0x2F = (2 × 16¹) + (15 × 16⁰)'],
    options: ['35', '42', '47', '51'],
    correctIndex: 2,
    explanation: 'In hex, F = 15. So 2 × 16 + 15 = 32 + 15 = 47.',
  },
  {
    id: 'll-seq-1',
    topic: 'Sequence',
    title: 'Fibonacci-Shift Pattern',
    prompt: 'Find the missing value: 3, 5, 9, 17, 33, ?',
    diagramLines: ['Differences: +2, +4, +8, +16, +?'],
    options: ['49', '57', '65', '66'],
    correctIndex: 2,
    explanation: 'Each step adds double the previous difference (or 2x − 1): 33 + 32 = 65.',
  },
  {
    id: 'll-gear-1',
    topic: 'Spatial & Gear',
    title: 'Compound Gear Train',
    prompt: 'Gear 1 (20 teeth) drives Gear 2 (40 teeth) at 120 RPM. What is Gear 2’s RPM?',
    diagramLines: ['[Gear 1: 20T @ 120 RPM] ⚙⚙ [Gear 2: 40T @ ? RPM]'],
    options: ['40 RPM', '60 RPM', '120 RPM', '240 RPM'],
    correctIndex: 1,
    explanation: 'RPM₂ = RPM₁ × (T₁ / T₂) = 120 × (20 / 40) = 60 RPM.',
  },
  {
    id: 'll-prob-1',
    topic: 'Probability',
    title: 'Redundant Server Uptime',
    prompt: 'Two independent power supplies each have 90% reliability (0.9). What is the probability at least ONE works?',
    diagramLines: ['P(at least one) = 1 − P(both fail)'],
    options: ['0.81 (81%)', '0.90 (90%)', '0.95 (95%)', '0.99 (99%)'],
    correctIndex: 3,
    explanation: 'Each fails with probability 0.1. Both fail with 0.1 × 0.1 = 0.01, so system reliability is 1 − 0.01 = 0.99 (99%).',
  },
];

export const COMPONENT_CARDS: ComponentCardDef[] = [
  {
    id: 'resistor',
    name: 'Resistor',
    symbol: '──/\\/\\/──',
    functionText: 'Limits electric current and divides voltage (V = IR)',
    color: '#FFE600',
  },
  {
    id: 'capacitor',
    name: 'Capacitor',
    symbol: '──| |──',
    functionText: 'Stores energy in an electric field; blocks steady DC',
    color: '#00F0FF',
  },
  {
    id: 'diode',
    name: 'Diode',
    symbol: '──▶|──',
    functionText: 'Allows current flow in one forward direction only',
    color: '#22FF66',
  },
  {
    id: 'inductor',
    name: 'Inductor',
    symbol: '──◠◠◠──',
    functionText: 'Stores energy in a magnetic field; opposes current change',
    color: '#A855F7',
  },
  {
    id: 'transistor',
    name: 'MOSFET',
    symbol: 'G ⊣[D/S]',
    functionText: 'Voltage-controlled electronic switch and amplifier',
    color: '#FF6B00',
  },
  {
    id: 'mcu',
    name: 'Microcontroller',
    symbol: '[MCU CPU]',
    functionText: 'Compact IC with CPU, RAM, and GPIO for embedded control',
    color: '#00F0FF',
  },
  {
    id: 'opamp',
    name: 'Op-Amp',
    symbol: '─|+ −▷─',
    functionText: 'High-gain differential voltage amplifier for analog signals',
    color: '#FFE600',
  },
  {
    id: 'ultrasonic',
    name: 'Ultrasonic Sensor',
    symbol: '(( ○ ○ ))',
    functionText: 'Measures distance using 40 kHz sound echo time-of-flight',
    color: '#22FF66',
  },
];

export const CIRCUIT_STAGES: CircuitStageDef[] = [
  {
    id: 'circ-1',
    level: 1,
    title: 'Stage 1: Direct LED Rail',
    subtitle: 'Route 5V VCC to the LED Load.',
    voltage: '5.0V DC',
    explanation: 'A complete closed loop from VCC through the conductor trace powers the LED load.',
    rows: 3,
    cols: 3,
    sourcePos: [0, 0],
    loadPos: [2, 2],
    cells: [
      [
        { type: 'source', solutionRot: 1, locked: true },
        { type: 'straight', solutionRot: 1 },
        { type: 'corner', solutionRot: 2 },
      ],
      [
        { type: 'block', solutionRot: 0, locked: true },
        { type: 'block', solutionRot: 0, locked: true },
        { type: 'straight', solutionRot: 0 },
      ],
      [
        { type: 'block', solutionRot: 0, locked: true },
        { type: 'block', solutionRot: 0, locked: true },
        { type: 'load', solutionRot: 0, locked: true },
      ],
    ],
  },
  {
    id: 'circ-2',
    level: 2,
    title: 'Stage 2: Bypass Bus',
    subtitle: 'Navigate around the heatsink block.',
    voltage: '9.0V DC',
    explanation: 'Series traces carry identical current through every connected segment to reach the load.',
    rows: 3,
    cols: 4,
    sourcePos: [1, 0],
    loadPos: [1, 3],
    cells: [
      [
        { type: 'corner', solutionRot: 1 },
        { type: 'straight', solutionRot: 1 },
        { type: 'straight', solutionRot: 1 },
        { type: 'corner', solutionRot: 2 },
      ],
      [
        { type: 'source', solutionRot: 0, locked: true },
        { type: 'block', solutionRot: 0, locked: true },
        { type: 'block', solutionRot: 0, locked: true },
        { type: 'load', solutionRot: 0, locked: true },
      ],
      [
        { type: 'block', solutionRot: 0, locked: true },
        { type: 'block', solutionRot: 0, locked: true },
        { type: 'block', solutionRot: 0, locked: true },
        { type: 'block', solutionRot: 0, locked: true },
      ],
    ],
  },
  {
    id: 'circ-3',
    level: 3,
    title: 'Stage 3: Zig-Zag PCB Trace',
    subtitle: 'Align all corners to route 12V to the actuator.',
    voltage: '12.0V DC',
    explanation: 'PCB routing avoids dead-end stubs and EMI loops by maintaining continuous controlled trace paths.',
    rows: 4,
    cols: 4,
    sourcePos: [0, 0],
    loadPos: [3, 3],
    cells: [
      [
        { type: 'source', solutionRot: 1, locked: true },
        { type: 'corner', solutionRot: 2 },
        { type: 'block', solutionRot: 0, locked: true },
        { type: 'block', solutionRot: 0, locked: true },
      ],
      [
        { type: 'block', solutionRot: 0, locked: true },
        { type: 'corner', solutionRot: 0 },
        { type: 'straight', solutionRot: 1 },
        { type: 'corner', solutionRot: 2 },
      ],
      [
        { type: 'block', solutionRot: 0, locked: true },
        { type: 'block', solutionRot: 0, locked: true },
        { type: 'block', solutionRot: 0, locked: true },
        { type: 'straight', solutionRot: 0 },
      ],
      [
        { type: 'block', solutionRot: 0, locked: true },
        { type: 'block', solutionRot: 0, locked: true },
        { type: 'block', solutionRot: 0, locked: true },
        { type: 'load', solutionRot: 0, locked: true },
      ],
    ],
  },
  {
    id: 'circ-4',
    level: 4,
    title: 'Stage 4: Split Junction',
    subtitle: 'Route around dual capacitors using the T-junction.',
    voltage: '3.3V Logic',
    explanation: 'A T-junction splits current across parallel nodes; only valid closed paths energize the target MCU rail.',
    rows: 4,
    cols: 4,
    sourcePos: [0, 1],
    loadPos: [3, 0],
    cells: [
      [
        { type: 'block', solutionRot: 0, locked: true },
        { type: 'source', solutionRot: 2, locked: true },
        { type: 'block', solutionRot: 0, locked: true },
        { type: 'block', solutionRot: 0, locked: true },
      ],
      [
        { type: 'corner', solutionRot: 1 },
        { type: 'tee', solutionRot: 3 },
        { type: 'straight', solutionRot: 1 },
        { type: 'corner', solutionRot: 2 },
      ],
      [
        { type: 'straight', solutionRot: 0 },
        { type: 'block', solutionRot: 0, locked: true },
        { type: 'block', solutionRot: 0, locked: true },
        { type: 'straight', solutionRot: 0 },
      ],
      [
        { type: 'load', solutionRot: 0, locked: true },
        { type: 'block', solutionRot: 0, locked: true },
        { type: 'block', solutionRot: 0, locked: true },
        { type: 'corner', solutionRot: 3 },
      ],
    ],
  },
];

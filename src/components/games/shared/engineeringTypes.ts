export type EngineeringDiagramKind =
  | 'engine-block'
  | 'forced-induction'
  | 'cooling'
  | 'transmission'
  | 'differential'
  | 'suspension'
  | 'brakes'
  | 'ecu-electrical'
  | 'aero'
  | 'soc-silicon'
  | 'display-stack'
  | 'battery-bms'
  | 'camera-ois'
  | 'connectivity-rf'
  | 'thermal-chassis';

export interface EngineeringComponentSpec {
  id: string;
  name: string;
  subsystem: string;
  simulator: 'car' | 'phone';
  whatIsIt: string;
  whatDoesItDo: string;
  howItWorks: string;
  engineeringField: string;
  materials: string[];
  advantages: string[];
  disadvantages: string[];
  whatHappensIfItFails: string;
  realLifeUses: string[];
  performanceImpact: string;
  specs: Array<{ label: string; value: string }>;
  diagramKind: EngineeringDiagramKind;
}

export interface SimulatorProgressSummary {
  engineeringXp: number;
  missionsCompleted: number;
  componentsExplored: number;
  engineeringAccuracy: number;
  totalScore: number;
}

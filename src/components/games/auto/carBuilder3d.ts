import * as THREE from 'three';
import type { CarBuildConfig, InteriorTheme } from './carCatalog.ts';
import { createInitialBuild, VEHICLE_PRESETS } from './carCatalog.ts';

export interface ExplodableEntry {
  obj: THREE.Object3D;
  basePos: THREE.Vector3;
  explodeOffset: THREE.Vector3;
}

export interface VehicleRigHandles {
  hoodPivot: THREE.Group;
  hoodClosedAngle: number;
  hoodOpenAngle: number;
  coolingFan: THREE.Object3D | null;
  explodables: ExplodableEntry[];
}

function disposeObject3D(root: THREE.Object3D): void {
  root.traverse((obj) => {
    if (obj instanceof THREE.Mesh || obj instanceof THREE.Line || obj instanceof THREE.Points) {
      obj.geometry?.dispose();
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const m of mats) {
        if (m) {
          const matAny = m as unknown as Record<string, unknown>;
          for (const key of ['map', 'roughnessMap', 'metalnessMap', 'normalMap']) {
            const tex = matAny[key];
            if (tex && tex instanceof THREE.Texture) tex.dispose();
          }
          m.dispose();
        }
      }
    }
  });
}

function tagComponent<T extends THREE.Object3D>(obj: T, componentId: string): T {
  obj.userData.componentId = componentId;
  obj.traverse((child) => {
    if (!child.userData.componentId) {
      child.userData.componentId = componentId;
    }
  });
  return obj;
}

function getInteriorColors(theme: InteriorTheme): { seat: string; accent: string; dash: string } {
  switch (theme) {
    case 'crimson-sport':
      return { seat: '#991B1B', accent: '#EF4444', dash: '#111827' };
    case 'tan-luxury':
      return { seat: '#B45309', accent: '#F59E0B', dash: '#292524' };
    case 'cyber-cyan':
      return { seat: '#0F172A', accent: '#22D3EE', dash: '#020617' };
    default:
      return { seat: '#1E293B', accent: '#475569', dash: '#0F172A' };
  }
}

function makeBodyPaintMaterial(config: CarBuildConfig, isTechMode: boolean): THREE.MeshPhysicalMaterial {
  const baseColor = new THREE.Color(config.bodyColor);
  const opacity = isTechMode ? 0.24 : 1.0;
  const common = isTechMode ? { transparent: true, opacity, depthWrite: false } : {};
  switch (config.paintFinish) {
    case 'matte':
      return new THREE.MeshPhysicalMaterial({
        color: baseColor,
        metalness: 0.25,
        roughness: 0.72,
        clearcoat: 0.08,
        clearcoatRoughness: 0.65,
        ...common,
      });
    case 'metallic':
      return new THREE.MeshPhysicalMaterial({
        color: baseColor,
        metalness: 0.72,
        roughness: 0.24,
        clearcoat: 0.9,
        clearcoatRoughness: 0.08,
        envMapIntensity: 1.35,
        ...common,
      });
    case 'pearl':
      return new THREE.MeshPhysicalMaterial({
        color: baseColor,
        metalness: 0.48,
        roughness: 0.16,
        clearcoat: 1.0,
        clearcoatRoughness: 0.05,
        iridescence: 0.55,
        iridescenceIOR: 1.35,
        envMapIntensity: 1.4,
        ...common,
      });
    default:
      return new THREE.MeshPhysicalMaterial({
        color: baseColor,
        metalness: 0.3,
        roughness: 0.14,
        clearcoat: 1.0,
        clearcoatRoughness: 0.04,
        envMapIntensity: 1.3,
        ...common,
      });
  }
}

function makeSideProfileGeometry(params: {
  length: number;
  width: number;
  bodyHeight: number;
  hoodSlope: number;
  trunkSlope: number;
  wedgeFactor: number;
  isHatch: boolean;
}): THREE.ExtrudeGeometry {
  const halfL = params.length / 2;
  const h = params.bodyHeight;
  const hoodY = h * (1 - params.hoodSlope) - params.wedgeFactor;
  const beltFrontY = h + 0.02;
  const beltRearY = h + 0.08 + params.wedgeFactor * 0.5;
  const tailY = h * (1 - params.trunkSlope * 0.5) + params.wedgeFactor * 0.3;

  const shape = new THREE.Shape();
  shape.moveTo(-halfL, 0.04);
  shape.lineTo(-halfL + 0.08, 0);
  shape.lineTo(halfL - 0.1, 0);
  shape.lineTo(halfL, 0.08);
  shape.lineTo(halfL - 0.05, hoodY * 0.85);
  shape.quadraticCurveTo(halfL * 0.65, beltFrontY, halfL * 0.34, beltFrontY);
  shape.lineTo(-halfL * 0.42, beltRearY);
  shape.quadraticCurveTo(-halfL * 0.85, tailY + 0.06, -halfL, tailY * (params.isHatch ? 0.95 : 0.82));
  shape.closePath();

  const extrude = new THREE.ExtrudeGeometry(shape, {
    depth: params.width,
    bevelEnabled: true,
    bevelThickness: 0.07,
    bevelSize: 0.05,
    bevelSegments: 3,
    curveSegments: 10,
  });
  extrude.translate(0, 0, -params.width / 2);
  extrude.rotateY(Math.PI / 2);
  extrude.computeVertexNormals();
  return extrude;
}

function makeHelixSpringMesh(
  radius: number,
  height: number,
  turns: number,
  color: string
): THREE.Mesh {
  const pts: THREE.Vector3[] = [];
  const steps = turns * 10;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const angle = t * turns * Math.PI * 2;
    pts.push(new THREE.Vector3(Math.cos(angle) * radius, t * height, Math.sin(angle) * radius));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  const geo = new THREE.TubeGeometry(curve, steps, radius * 0.18, 6, false);
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.25, metalness: 0.7 });
  return new THREE.Mesh(geo, mat);
}

function buildWheelMesh(params: {
  radius: number;
  width: number;
  rimDesign: CarBuildConfig['rimDesign'];
  rimColor: string;
  caliperColor: string;
  brakeSystem: CarBuildConfig['brakeSystem'];
  isLeft: boolean;
  isTechMode: boolean;
}): THREE.Group {
  const g = new THREE.Group();
  const tireMat = new THREE.MeshStandardMaterial({
    color: '#14171F',
    roughness: 0.84,
    metalness: 0.06,
    transparent: params.isTechMode,
    opacity: params.isTechMode ? 0.35 : 1.0,
    depthWrite: !params.isTechMode,
  });
  const rimMat = new THREE.MeshStandardMaterial({
    color: params.rimColor,
    roughness: 0.22,
    metalness: 0.86,
    transparent: params.isTechMode,
    opacity: params.isTechMode ? 0.45 : 1.0,
  });
  const darkMetal = new THREE.MeshStandardMaterial({
    color: '#27303F',
    roughness: 0.35,
    metalness: 0.8,
  });
  const caliperMat = new THREE.MeshStandardMaterial({
    color: params.caliperColor,
    roughness: 0.28,
    metalness: 0.55,
  });

  const sign = params.isLeft ? 1 : -1;
  const rimRadius = params.radius * 0.68;

  // Tire cylinder
  const tireGeo = new THREE.CylinderGeometry(params.radius, params.radius, params.width, 30);
  tireGeo.rotateZ(Math.PI / 2);
  const tire = new THREE.Mesh(tireGeo, tireMat);
  tire.castShadow = !params.isTechMode;
  tire.receiveShadow = true;
  g.add(tire);

  const sideGeo = new THREE.TorusGeometry(params.radius * 0.82, params.radius * 0.14, 10, 24);
  sideGeo.rotateY(Math.PI / 2);
  const sideRing = new THREE.Mesh(sideGeo, tireMat);
  sideRing.position.x = sign * (params.width * 0.42);
  g.add(sideRing);

  const barrelGeo = new THREE.CylinderGeometry(rimRadius, rimRadius, params.width * 0.94, 24);
  barrelGeo.rotateZ(Math.PI / 2);
  g.add(new THREE.Mesh(barrelGeo, darkMetal));

  // Brake assembly (Disc+Calipers vs Drum)
  if (params.brakeSystem === 'drum') {
    const drumGeo = new THREE.CylinderGeometry(rimRadius * 0.7, rimRadius * 0.7, 0.08, 22);
    drumGeo.rotateZ(Math.PI / 2);
    const drum = tagComponent(
      new THREE.Mesh(
        drumGeo,
        new THREE.MeshStandardMaterial({ color: '#475569', metalness: 0.65, roughness: 0.55 })
      ),
      'brk-drum'
    );
    drum.position.x = sign * 0.01;
    g.add(drum);
  } else {
    const rotorGeo = new THREE.CylinderGeometry(rimRadius * 0.8, rimRadius * 0.8, 0.032, 24);
    rotorGeo.rotateZ(Math.PI / 2);
    const rotor = tagComponent(
      new THREE.Mesh(
        rotorGeo,
        new THREE.MeshStandardMaterial({ color: '#CBD5E1', metalness: 0.92, roughness: 0.24 })
      ),
      'brk-rotors'
    );
    rotor.position.x = sign * 0.015;
    g.add(rotor);

    const caliperGeo = new THREE.BoxGeometry(0.065, rimRadius * 0.48, rimRadius * 0.3);
    const caliper = tagComponent(new THREE.Mesh(caliperGeo, caliperMat), 'brk-calipers');
    caliper.position.set(sign * 0.025, rimRadius * 0.36, -rimRadius * 0.38);
    g.add(caliper);
  }

  // Rim face
  const lipGeo = new THREE.TorusGeometry(rimRadius * 0.96, 0.018, 8, 24);
  lipGeo.rotateY(Math.PI / 2);
  const lip = new THREE.Mesh(lipGeo, rimMat);
  lip.position.x = sign * (params.width * 0.47);
  g.add(lip);

  const spokeX = sign * (params.width * 0.45);
  const hubGeo = new THREE.CylinderGeometry(rimRadius * 0.24, rimRadius * 0.24, 0.05, 16);
  hubGeo.rotateZ(Math.PI / 2);
  const hub = new THREE.Mesh(hubGeo, rimMat);
  hub.position.x = spokeX;
  g.add(hub);

  if (params.rimDesign === 'turbofan') {
    const discGeo = new THREE.CylinderGeometry(rimRadius * 0.9, rimRadius * 0.9, 0.02, 22);
    discGeo.rotateZ(Math.PI / 2);
    const disc = new THREE.Mesh(discGeo, rimMat);
    disc.position.x = spokeX * 0.95;
    g.add(disc);
    for (let i = 0; i < 12; i++) {
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.022, rimRadius * 0.28, 0.016), darkMetal);
      const a = (i / 12) * Math.PI * 2;
      fin.position.set(spokeX, Math.cos(a) * rimRadius * 0.62, Math.sin(a) * rimRadius * 0.62);
      fin.rotation.x = a + 0.35;
      g.add(fin);
    }
  } else {
    const spokeCount =
      params.rimDesign === 'multi-10'
        ? 10
        : params.rimDesign === 'deep-mesh'
          ? 8
          : params.rimDesign === 'offroad-bead'
            ? 6
            : 5;
    for (let i = 0; i < spokeCount; i++) {
      const angle = (i / spokeCount) * Math.PI * 2;
      if (params.rimDesign === 'twin-5') {
        for (const offset of [-0.14, 0.14]) {
          const sp = new THREE.Mesh(
            new THREE.BoxGeometry(0.025, rimRadius * 0.78, 0.024),
            rimMat
          );
          const a = angle + offset;
          sp.position.set(spokeX, Math.cos(a) * rimRadius * 0.48, Math.sin(a) * rimRadius * 0.48);
          sp.rotation.x = a;
          g.add(sp);
        }
      } else {
        const thickness = params.rimDesign === 'offroad-bead' ? 0.055 : 0.026;
        const sp = new THREE.Mesh(
          new THREE.BoxGeometry(0.028, rimRadius * 0.8, thickness),
          rimMat
        );
        sp.position.set(spokeX, Math.cos(angle) * rimRadius * 0.48, Math.sin(angle) * rimRadius * 0.48);
        sp.rotation.x = angle;
        g.add(sp);
      }
    }
  }

  return g;
}

export function buildVehicleGroup(rawConfig: CarBuildConfig, existing?: THREE.Group): THREE.Group {
  const base = createInitialBuild(rawConfig.vehicleId);
  const config: CarBuildConfig = { ...base, ...rawConfig };
  const preset = VEHICLE_PRESETS.find((v) => v.id === config.vehicleId) || VEHICLE_PRESETS[0];
  const p = preset.proportions;

  if (existing) {
    disposeObject3D(existing);
    existing.clear();
  }
  const root = existing ?? new THREE.Group();
  root.name = `vehicle_${preset.id}`;

  const isTechMode = config.viewMode === 'technical' || config.viewMode === 'exploded';
  const isEv = config.engineConfig === 'ev-dual' || config.powertrain === 'ev';
  const wheelRadius = p.wheelRadius * config.wheelScale;
  const wheelWidth = p.wheelWidth * (config.bodyKit === 'widebody-flares' ? 1.12 : 1.0);
  const trackHalf = p.width * 0.49 + (config.bodyKit === 'widebody-flares' ? 0.07 : 0);
  const suspLift = config.suspensionOffsetMm / 1000;
  const bodyBottomY = Math.max(0.08, p.baseClearance + suspLift);

  const paintMat = makeBodyPaintMaterial(config, isTechMode);
  const trimMat = new THREE.MeshStandardMaterial({ color: '#0F172A', roughness: 0.42, metalness: 0.35 });
  const carbonMat = new THREE.MeshStandardMaterial({ color: '#1E293B', roughness: 0.25, metalness: 0.65 });
  const chromeMat = new THREE.MeshStandardMaterial({ color: '#E2E8F0', roughness: 0.14, metalness: 0.92 });
  const aluMat = new THREE.MeshStandardMaterial({ color: '#94A3B8', roughness: 0.24, metalness: 0.85 });
  const copperMat = new THREE.MeshStandardMaterial({ color: '#D97706', roughness: 0.28, metalness: 0.8 });

  const explodables: ExplodableEntry[] = [];
  const registerExplode = (obj: THREE.Object3D, offset: THREE.Vector3) => {
    explodables.push({ obj, basePos: obj.position.clone(), explodeOffset: offset });
  };

  const chassis = new THREE.Group();
  chassis.position.y = bodyBottomY;
  root.add(chassis);

  // Structural Underbody Ladder/Monocoque Floor
  const floorTray = new THREE.Mesh(new THREE.BoxGeometry(p.width * 0.88, 0.045, p.length * 0.88), trimMat);
  floorTray.position.y = 0.025;
  chassis.add(floorTray);

  // 1. Main Body Shell (separates upward in Exploded View, transparent in Tech View)
  const shellGroup = new THREE.Group();
  chassis.add(shellGroup);
  registerExplode(shellGroup, new THREE.Vector3(0, 0.78, 0));

  const mainGeo = makeSideProfileGeometry({
    length: p.length,
    width: p.width,
    bodyHeight: p.bodyHeight,
    hoodSlope: p.hoodSlope,
    trunkSlope: p.trunkSlope,
    wedgeFactor: p.wedgeFactor,
    isHatch: preset.id === 'hatchback' || preset.id === 'suv' || preset.id === 'offroad',
  });
  const mainBody = new THREE.Mesh(mainGeo, paintMat);
  mainBody.castShadow = !isTechMode;
  mainBody.receiveShadow = true;
  shellGroup.add(mainBody);

  // 1B. Articulated Hinged Hood (rotates open around windshield cowl line!)
  const hoodZStart = p.cabinOffsetZ + p.cabinLength * 0.42;
  const hoodLength = p.length * 0.5 - hoodZStart - 0.12;
  const hoodPivot = new THREE.Group();
  hoodPivot.position.set(0, p.bodyHeight * 0.95, hoodZStart);
  shellGroup.add(hoodPivot);

  const hoodPanel = new THREE.Mesh(
    new THREE.BoxGeometry(p.width * 0.86, 0.036, Math.max(0.75, hoodLength)),
    paintMat
  );
  hoodPanel.position.set(0, 0.02, Math.max(0.75, hoodLength) * 0.48);
  hoodPanel.rotation.x = p.hoodSlope * 0.35;
  hoodPanel.castShadow = !isTechMode;
  hoodPivot.add(hoodPanel);

  // Hood vents for turbo/performance builds
  if (config.forcedInduction !== 'none' && !isEv) {
    const vent = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.02, 0.24), carbonMat);
    vent.position.set(0, 0.045, Math.max(0.75, hoodLength) * 0.55);
    hoodPivot.add(vent);
  }
  const hoodClosedAngle = 0;
  const hoodOpenAngle = -0.78; // Opens ~45 degrees toward windshield
  if (config.engineBayOpen) {
    hoodPivot.rotation.x = hoodOpenAngle;
  }

  // 2. Cabin Greenhouse + Interior
  const glassTintColor =
    config.windowTint === 'clear'
      ? '#BAE6FD'
      : config.windowTint === 'light-smoke'
        ? '#334155'
        : config.windowTint === 'iridescent-blue'
          ? '#0284C7'
          : '#090D16';
  const glassOpacity = isTechMode
    ? 0.16
    : config.windowTint === 'clear'
      ? 0.32
      : config.windowTint === 'light-smoke'
        ? 0.55
        : config.windowTint === 'iridescent-blue'
          ? 0.64
          : 0.84;

  const glassMat = new THREE.MeshPhysicalMaterial({
    color: glassTintColor,
    transparent: true,
    opacity: glassOpacity,
    roughness: 0.08,
    metalness: 0.15,
    reflectivity: 0.95,
    clearcoat: 1.0,
    depthWrite: false,
  });

  const cabinTopWidth = p.width * 0.76;
  const cabinLen = p.cabinLength;
  const cabinZ = p.cabinOffsetZ;

  const cabinGeo = new THREE.CylinderGeometry(cabinTopWidth * 0.64, p.width * 0.64, p.cabinHeight, 4);
  cabinGeo.rotateY(Math.PI / 4);
  cabinGeo.scale(1.0, 1.0, cabinLen / (p.width * 0.9));
  const cabinGlass = new THREE.Mesh(cabinGeo, glassMat);
  cabinGlass.position.set(0, p.bodyHeight + p.cabinHeight * 0.45, cabinZ);
  shellGroup.add(cabinGlass);

  const roofCap = new THREE.Mesh(new THREE.BoxGeometry(cabinTopWidth * 0.92, 0.045, cabinLen * 0.68), paintMat);
  roofCap.position.set(0, p.bodyHeight + p.cabinHeight * 0.91, cabinZ - 0.04);
  roofCap.castShadow = !isTechMode;
  shellGroup.add(roofCap);

  for (const side of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.03, 0.04), trimMat);
    arm.position.set(side * (p.width * 0.52), p.bodyHeight + 0.04, cabinZ + cabinLen * 0.25);
    shellGroup.add(arm);
    const housing = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.07, 0.11), paintMat);
    housing.position.set(side * (p.width * 0.58), p.bodyHeight + 0.06, cabinZ + cabinLen * 0.22);
    shellGroup.add(housing);
  }

  // Interior
  const intColors = getInteriorColors(config.interior);
  const seatMat = new THREE.MeshStandardMaterial({ color: intColors.seat, roughness: 0.7 });
  const accentIntMat = new THREE.MeshStandardMaterial({ color: intColors.accent, roughness: 0.45 });
  const dashMat = new THREE.MeshStandardMaterial({ color: intColors.dash, roughness: 0.6 });

  const dash = new THREE.Mesh(new THREE.BoxGeometry(p.width * 0.74, 0.14, 0.34), dashMat);
  dash.position.set(0, p.bodyHeight + 0.04, cabinZ + cabinLen * 0.28);
  chassis.add(dash);

  const steeringWheel = tagComponent(
    new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.016, 8, 20), accentIntMat),
    'sus-steering'
  );
  steeringWheel.position.set(p.width * 0.19, p.bodyHeight + 0.14, cabinZ + cabinLen * 0.16);
  steeringWheel.rotation.x = 0.35;
  chassis.add(steeringWheel);

  for (const sx of [-p.width * 0.2, p.width * 0.2]) {
    const baseSeat = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.08, 0.36), seatMat);
    baseSeat.position.set(sx, p.bodyHeight - 0.02, cabinZ - 0.06);
    chassis.add(baseSeat);
    const backSeat = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.36, 0.09), seatMat);
    backSeat.position.set(sx, p.bodyHeight + 0.14, cabinZ - 0.22);
    backSeat.rotation.x = -0.22;
    chassis.add(backSeat);
  }

  // 3. DETAILED ENGINE BAY, TRANSMISSION, DRIVETRAIN & ELECTRICAL SYSTEMS (Always built for hood/tech/exploded inspection!)
  const bayZ = preset.id === 'supercar' ? cabinZ - cabinLen * 0.52 : p.length * 0.28;
  const engineGroup = new THREE.Group();
  engineGroup.position.set(0, p.bodyHeight * 0.48, bayZ);
  chassis.add(engineGroup);
  registerExplode(engineGroup, new THREE.Vector3(0, 0.46, 0.32));

  let coolingFan: THREE.Object3D | null = null;

  if (isEv) {
    // Dual-motor EV architecture + Skateboard Battery Pack
    const pack = tagComponent(
      new THREE.Mesh(
        new THREE.BoxGeometry(p.width * 0.66, 0.075, p.length * 0.44),
        new THREE.MeshStandardMaterial({
          color: '#0891B2',
          emissive: '#06B6D4',
          emissiveIntensity: 0.45,
          roughness: 0.26,
          metalness: 0.6,
        })
      ),
      'eng-ev-dual'
    );
    pack.position.set(0, -p.bodyHeight * 0.32, -bayZ);
    engineGroup.add(pack);

    for (const mz of [0, -bayZ * 1.9]) {
      const motor = tagComponent(
        new THREE.Mesh(
          new THREE.CylinderGeometry(0.14, 0.14, 0.56, 18),
          new THREE.MeshStandardMaterial({ color: '#38BDF8', metalness: 0.85, roughness: 0.2 })
        ),
        'eng-ev-dual'
      );
      motor.rotation.z = Math.PI / 2;
      motor.position.set(0, 0, mz);
      engineGroup.add(motor);
    }
    const inverter = tagComponent(
      new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.09, 0.32), aluMat),
      'elc-ecu'
    );
    inverter.position.set(0, 0.15, 0);
    engineGroup.add(inverter);
  } else {
    const cylTag =
      config.engineConfig === 'i4' ? 'eng-i4' : config.engineConfig === 'v8' ? 'eng-v8' : 'eng-v6';
    // Engine Block Core
    const block = tagComponent(
      new THREE.Mesh(
        new THREE.BoxGeometry(config.engineConfig === 'i4' ? 0.28 : 0.46, 0.24, config.engineConfig === 'v8' ? 0.62 : 0.48),
        aluMat
      ),
      cylTag
    );
    engineGroup.add(block);

    if (config.engineConfig === 'i4') {
      // 4 inline valve cover coils
      const vc = tagComponent(
        new THREE.Mesh(
          new THREE.BoxGeometry(0.24, 0.08, 0.46),
          new THREE.MeshStandardMaterial({ color: '#0EA5E9', roughness: 0.28, metalness: 0.7 })
        ),
        'eng-i4'
      );
      vc.position.y = 0.15;
      engineGroup.add(vc);
      for (let i = 0; i < 4; i++) {
        const coil = tagComponent(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.05, 10), copperMat), 'eng-fuel-inj');
        coil.position.set(0, 0.2, -0.15 + i * 0.1);
        engineGroup.add(coil);
      }
    } else {
      // V6 or V8 Twin Angled Banks
      const pairs = config.engineConfig === 'v8' ? 4 : 3;
      const bankColor = config.engineConfig === 'v8' ? '#EF4444' : '#3B82F6';
      const bankMat = new THREE.MeshStandardMaterial({ color: bankColor, roughness: 0.25, metalness: 0.68 });
      for (const side of [-1, 1]) {
        const head = tagComponent(
          new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, pairs * 0.13), bankMat),
          cylTag
        );
        head.position.set(side * 0.18, 0.13, 0);
        head.rotation.z = side * -0.45;
        engineGroup.add(head);

        // Exhaust manifold runners
        const header = tagComponent(
          new THREE.Mesh(
            new THREE.CylinderGeometry(0.028, 0.028, pairs * 0.11, 10),
            config.exhaustUpgrade === 'headers-titanium' ? copperMat : chromeMat
          ),
          'eng-exhaust'
        );
        header.rotation.x = Math.PI / 2;
        header.position.set(side * 0.28, 0.02, 0);
        engineGroup.add(header);
      }
      // Fuel Rail / Direct Injection plenum
      const rail = tagComponent(new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.07, 0.4), chromeMat), 'eng-fuel-inj');
      rail.position.set(0, 0.19, 0);
      engineGroup.add(rail);
    }

    // Forced Induction: Turbocharger Snail or Supercharger Blower
    if (config.forcedInduction === 'turbo') {
      const snail = tagComponent(
        new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.036, 10, 20), chromeMat),
        'eng-turbo'
      );
      snail.position.set(0.29, 0.16, 0.18);
      engineGroup.add(snail);
      const hotSide = tagComponent(
        new THREE.Mesh(
          new THREE.TorusGeometry(0.075, 0.032, 10, 18),
          new THREE.MeshStandardMaterial({ color: '#EA580C', metalness: 0.75, roughness: 0.35 })
        ),
        'eng-turbo'
      );
      hotSide.position.set(0.29, 0.16, 0.11);
      engineGroup.add(hotSide);
    } else if (config.forcedInduction === 'supercharger') {
      const blower = tagComponent(
        new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.14, 0.38), aluMat),
        'eng-supercharger'
      );
      blower.position.set(0, 0.25, 0);
      engineGroup.add(blower);
      const pulley = tagComponent(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.05, 16), copperMat), 'eng-supercharger');
      pulley.rotation.x = Math.PI / 2;
      pulley.position.set(0, 0.25, 0.22);
      engineGroup.add(pulley);
    }

    // Cold Air Intake
    const intake = tagComponent(
      new THREE.Mesh(
        new THREE.ConeGeometry(0.075, 0.16, 14),
        new THREE.MeshStandardMaterial({
          color: config.intakeUpgrade === 'cold-air' ? '#DC2626' : '#334155',
          roughness: 0.55,
        })
      ),
      'eng-intake'
    );
    intake.rotation.x = Math.PI / 2;
    intake.position.set(-0.28, 0.14, 0.24);
    engineGroup.add(intake);

    // 12V Battery + Alternator + ECU in engine bay corners
    const batt = tagComponent(
      new THREE.Mesh(
        new THREE.BoxGeometry(0.18, 0.14, 0.16),
        new THREE.MeshStandardMaterial({ color: '#10B981', roughness: 0.4 })
      ),
      'elc-battery'
    );
    batt.position.set(-0.44, 0.05, -0.14);
    engineGroup.add(batt);

    const ecu = tagComponent(
      new THREE.Mesh(
        new THREE.BoxGeometry(0.16, 0.04, 0.18),
        new THREE.MeshStandardMaterial({ color: '#0284C7', metalness: 0.7, roughness: 0.25 })
      ),
      'elc-ecu'
    );
    ecu.position.set(0.44, 0.06, -0.16);
    engineGroup.add(ecu);

    const alt = tagComponent(new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.11, 14), aluMat), 'elc-alternator');
    alt.rotation.x = Math.PI / 2;
    alt.position.set(-0.2, 0.08, 0.26);
    engineGroup.add(alt);
  }

  // Front Radiator + Electric Fan + Intercooler (mounted at nose behind grille)
  const radiatorMat = new THREE.MeshStandardMaterial({
    color: config.coolingUpgrade === 'high-flow-alu' ? '#E2E8F0' : '#475569',
    metalness: 0.85,
    roughness: 0.25,
  });
  const radiator = tagComponent(new THREE.Mesh(new THREE.BoxGeometry(p.width * 0.5, 0.24, 0.05), radiatorMat), 'eng-radiator');
  radiator.position.set(0, p.bodyHeight * 0.42, p.length * 0.44);
  chassis.add(radiator);

  const fanGroup = tagComponent(new THREE.Group(), 'eng-cooling');
  fanGroup.position.set(0, p.bodyHeight * 0.42, p.length * 0.41);
  const fanShroud = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.014, 8, 20), trimMat);
  fanGroup.add(fanShroud);
  for (let b = 0; b < 5; b++) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.18, 0.01), aluMat);
    blade.rotation.z = (b / 5) * Math.PI;
    fanGroup.add(blade);
  }
  chassis.add(fanGroup);
  coolingFan = fanGroup;

  if (config.intercooler && !isEv) {
    const ic = tagComponent(new THREE.Mesh(new THREE.BoxGeometry(p.width * 0.44, 0.14, 0.06), chromeMat), 'eng-intercooler');
    ic.position.set(0, p.bodyHeight * 0.22, p.length * 0.47);
    chassis.add(ic);
  }

  // 4. TRANSMISSION, DRIVESHAFT & REAR DIFFERENTIAL (Visible in Tech / Exploded views!)
  const transTag =
    config.transmissionType === 'dct'
      ? 'trn-dct'
      : config.transmissionType === 'auto'
        ? 'trn-auto'
        : 'trn-manual';
  const drivetrainGroup = new THREE.Group();
  chassis.add(drivetrainGroup);
  registerExplode(drivetrainGroup, new THREE.Vector3(0, -0.32, 0));

  const gearbox = tagComponent(
    new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 0.52, 16), aluMat),
    transTag
  );
  gearbox.rotation.x = Math.PI / 2;
  gearbox.position.set(0, 0.14, cabinZ + 0.4);
  drivetrainGroup.add(gearbox);

  const driveshaft = tagComponent(
    new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, p.wheelbaseHalf * 1.4, 12), carbonMat),
    'trn-driveshaft'
  );
  driveshaft.rotation.x = Math.PI / 2;
  driveshaft.position.set(0, 0.12, -0.15);
  drivetrainGroup.add(driveshaft);

  const rearDiff = tagComponent(
    new THREE.Mesh(
      new THREE.SphereGeometry(0.15, 14, 14),
      config.differentialType === 'lsd' ? copperMat : aluMat
    ),
    'trn-diff'
  );
  rearDiff.position.set(0, 0.14, -p.wheelbaseHalf);
  drivetrainGroup.add(rearDiff);

  // ABS Hydraulic Modulator Block + ECU brake lines
  if (config.brakeSystem === 'disc-abs') {
    const absBlock = tagComponent(
      new THREE.Mesh(
        new THREE.BoxGeometry(0.14, 0.12, 0.14),
        new THREE.MeshStandardMaterial({ color: '#38BDF8', metalness: 0.75, roughness: 0.25 })
      ),
      'brk-abs'
    );
    absBlock.position.set(0.42, p.bodyHeight * 0.56, p.length * 0.14);
    drivetrainGroup.add(absBlock);
  }

  // 5. SUSPENSION & STEERING ARMS AT ALL 4 CORNERS
  const suspTag = config.suspensionType === 'double-wishbone' ? 'sus-double-wishbone' : 'sus-macpherson';
  const springColor =
    config.springStiffnessNmm > 70 ? '#EF4444' : config.springStiffnessNmm < 42 ? '#10B981' : '#F59E0B';

  const steeringRack = tagComponent(
    new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, p.width * 0.76, 12), aluMat),
    'sus-steering'
  );
  steeringRack.rotation.z = Math.PI / 2;
  steeringRack.position.set(0, 0.08, p.wheelbaseHalf - 0.12);
  drivetrainGroup.add(steeringRack);

  for (const wz of [p.wheelbaseHalf, -p.wheelbaseHalf]) {
    const arb = tagComponent(
      new THREE.Mesh(
        new THREE.CylinderGeometry(0.018, 0.018, p.width * 0.72, 10),
        config.antiRollBars === 'stiff-track' ? copperMat : trimMat
      ),
      'sus-arb'
    );
    arb.rotation.z = Math.PI / 2;
    arb.position.set(0, 0.12, wz + 0.08);
    drivetrainGroup.add(arb);

    for (const side of [-1, 1]) {
      // Lower Control Arm
      const lowerArm = tagComponent(new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.03, 0.14), aluMat), suspTag);
      lowerArm.position.set(side * (p.width * 0.34), 0.08, wz);
      drivetrainGroup.add(lowerArm);

      if (config.suspensionType === 'double-wishbone') {
        const upperArm = tagComponent(
          new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.026, 0.12), carbonMat),
          'sus-double-wishbone'
        );
        upperArm.position.set(side * (p.width * 0.34), 0.24, wz);
        drivetrainGroup.add(upperArm);
      }

      // Helical Coil Spring + Damper strut
      const coil = tagComponent(makeHelixSpringMesh(0.048, 0.22, 5, springColor), 'sus-springs');
      coil.position.set(side * (p.width * 0.39), 0.09, wz);
      coil.rotation.z = side * 0.14;
      drivetrainGroup.add(coil);

      const damper = tagComponent(new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.26, 10), chromeMat), 'sus-dampers');
      damper.position.set(side * (p.width * 0.39), 0.2, wz);
      damper.rotation.z = side * 0.14;
      drivetrainGroup.add(damper);
    }
  }

  // 6. HEADLIGHTS, GRILLE, TAILLIGHTS & AERODYNAMICS
  const frontZ = p.length / 2 + 0.01;
  const grille = new THREE.Mesh(new THREE.BoxGeometry(p.width * 0.52, p.bodyHeight * 0.32, 0.08), trimMat);
  grille.position.set(0, p.bodyHeight * 0.34, frontZ);
  shellGroup.add(grille);

  const hlColor =
    config.headlights === 'amber-rally'
      ? '#FBBF24'
      : config.headlights === 'laser-blade'
        ? '#38BDF8'
        : '#F8FAFC';
  const hlEmissive = new THREE.MeshStandardMaterial({
    color: hlColor,
    emissive: hlColor,
    emissiveIntensity: 2.0,
    roughness: 0.1,
  });

  for (const side of [-1, 1]) {
    const xPos = side * (p.width * 0.34);
    const hlY = p.bodyHeight * 0.58;
    if (config.headlights === 'halos') {
      for (const ox of [-0.06, 0.06]) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.012, 8, 18), hlEmissive);
        ring.position.set(xPos + ox, hlY, frontZ + 0.02);
        shellGroup.add(ring);
      }
    } else if (config.headlights === 'laser-blade') {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.045, 0.06), hlEmissive);
      blade.position.set(xPos, hlY, frontZ + 0.01);
      blade.rotation.z = side * -0.18;
      shellGroup.add(blade);
    } else {
      for (let c = 0; c < 3; c++) {
        const cube = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.055, 0.05), hlEmissive);
        cube.position.set(xPos + (c - 1) * 0.09, hlY, frontZ + 0.015);
        shellGroup.add(cube);
      }
    }
  }

  const rearZ = -p.length / 2 - 0.01;
  const tlColor = config.taillights === 'smoked-sport' ? '#991B1B' : '#FF1E38';
  const tlMat = new THREE.MeshStandardMaterial({
    color: tlColor,
    emissive: '#EF4444',
    emissiveIntensity: config.taillights === 'smoked-sport' ? 1.1 : 2.1,
    roughness: 0.15,
  });
  if (config.taillights === 'full-lightbar') {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(p.width * 0.86, 0.055, 0.05), tlMat);
    bar.position.set(0, p.bodyHeight * 0.62, rearZ);
    shellGroup.add(bar);
  } else {
    for (const side of [-1, 1]) {
      const block = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.09, 0.05), tlMat);
      block.position.set(side * (p.width * 0.34), p.bodyHeight * 0.62, rearZ);
      shellGroup.add(block);
    }
  }

  // Front Splitter / Air Ducts
  if (config.frontBumper === 'sport-splitter' || config.frontBumper === 'track-canards') {
    const lip = tagComponent(
      new THREE.Mesh(new THREE.BoxGeometry(p.width + 0.08, 0.04, 0.24), carbonMat),
      'aer-splitter'
    );
    lip.position.set(0, 0.015, frontZ + 0.05);
    shellGroup.add(lip);
  } else if (config.frontBumper === 'bullbar') {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(p.width * 0.78, 0.26, 0.12), trimMat);
    bar.position.set(0, 0.2, frontZ + 0.08);
    shellGroup.add(bar);
  }

  if (config.airDucts) {
    for (const side of [-1, 1]) {
      const duct = tagComponent(
        new THREE.Mesh(
          new THREE.BoxGeometry(0.16, 0.12, 0.12),
          new THREE.MeshStandardMaterial({ color: '#0EA5E9', roughness: 0.3, metalness: 0.6 })
        ),
        'aer-ducts'
      );
      duct.position.set(side * (p.width * 0.38), 0.18, frontZ + 0.02);
      shellGroup.add(duct);
    }
  }

  // Rear Diffuser
  if (config.rearBumper === 'quad-diffuser') {
    const diffGroup = tagComponent(new THREE.Group(), 'aer-diffuser');
    const diff = new THREE.Mesh(new THREE.BoxGeometry(p.width * 0.88, 0.12, 0.16), carbonMat);
    diff.position.set(0, 0.06, rearZ - 0.02);
    diffGroup.add(diff);
    for (let f = -2; f <= 2; f++) {
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.14, 0.2), trimMat);
      fin.position.set(f * 0.2, 0.05, rearZ - 0.04);
      diffGroup.add(fin);
    }
    shellGroup.add(diffGroup);
  }

  // Rear Wing / Spoiler
  const wingZ = -p.length * 0.45;
  const deckY = p.bodyHeight * (1 - p.trunkSlope * 0.45) + 0.03;
  if (config.spoiler === 'lip') {
    const blade = tagComponent(new THREE.Mesh(new THREE.BoxGeometry(p.width * 0.84, 0.045, 0.12), carbonMat), 'aer-wing');
    blade.position.set(0, deckY + 0.02, wingZ);
    blade.rotation.x = -0.18;
    shellGroup.add(blade);
  } else if (config.spoiler === 'ducktail') {
    const duck = tagComponent(new THREE.Mesh(new THREE.BoxGeometry(p.width * 0.88, 0.13, 0.16), paintMat), 'aer-wing');
    duck.position.set(0, deckY + 0.05, wingZ - 0.02);
    duck.rotation.x = -0.45;
    shellGroup.add(duck);
  } else if (config.spoiler === 'gt-wing' || config.spoiler === 'twin-swan') {
    const wingGroup = tagComponent(new THREE.Group(), 'aer-wing');
    const wingY = deckY + (config.spoiler === 'twin-swan' ? 0.34 : 0.26);
    const foil = new THREE.Mesh(new THREE.BoxGeometry(p.width * 0.98, 0.035, 0.24), carbonMat);
    foil.position.set(0, wingY, wingZ - 0.04);
    foil.rotation.x = -0.12;
    wingGroup.add(foil);
    for (const side of [-1, 1]) {
      const pylon = new THREE.Mesh(new THREE.BoxGeometry(0.03, wingY - deckY + 0.04, 0.12), trimMat);
      pylon.position.set(side * (p.width * 0.26), deckY + (wingY - deckY) * 0.5, wingZ - 0.02);
      wingGroup.add(pylon);
      const endplate = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.16, 0.28), paintMat);
      endplate.position.set(side * (p.width * 0.49), wingY, wingZ - 0.04);
      wingGroup.add(endplate);
    }
    shellGroup.add(wingGroup);
  }

  // Side Skirts & Body Kits
  if (config.bodyKit !== 'factory') {
    for (const side of [-1, 1]) {
      const skirt = tagComponent(
        new THREE.Mesh(
          new THREE.BoxGeometry(0.11, 0.055, p.wheelbaseHalf * 1.35),
          config.bodyKit === 'aero-gt' ? carbonMat : paintMat
        ),
        'aer-skirts'
      );
      skirt.position.set(side * (p.width * 0.5 + 0.03), 0.03, 0);
      shellGroup.add(skirt);
    }
  }

  // 7. Wheels Grounded at y = 0 (Expand radially in Exploded mode to reveal rotors/suspension!)
  const caliperColor = config.brakeSystem === 'disc-abs' ? '#EF4444' : '#F59E0B';
  const wheelPositions: Array<[number, number, boolean]> = [
    [-trackHalf, p.wheelbaseHalf, false],
    [trackHalf, p.wheelbaseHalf, true],
    [-trackHalf, -p.wheelbaseHalf, false],
    [trackHalf, -p.wheelbaseHalf, true],
  ];

  for (const [wx, wz, isLeft] of wheelPositions) {
    const wheel = buildWheelMesh({
      radius: wheelRadius,
      width: wheelWidth,
      rimDesign: config.rimDesign,
      rimColor: config.rimColor,
      caliperColor,
      brakeSystem: config.brakeSystem,
      isLeft,
      isTechMode,
    });
    wheel.position.set(wx, wheelRadius, wz);
    root.add(wheel);
    registerExplode(wheel, new THREE.Vector3(wx > 0 ? 0.55 : -0.55, 0, wz > 0 ? 0.16 : -0.16));
  }

  // Contact shadow
  const shadowGeo = new THREE.PlaneGeometry(p.width * 1.45, p.length * 1.18);
  shadowGeo.rotateX(-Math.PI / 2);
  const shadowMat = new THREE.MeshBasicMaterial({
    color: '#020617',
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
  });
  const contactShadow = new THREE.Mesh(shadowGeo, shadowMat);
  contactShadow.position.y = 0.006;
  root.add(contactShadow);

  const rig: VehicleRigHandles = {
    hoodPivot,
    hoodClosedAngle,
    hoodOpenAngle,
    coolingFan,
    explodables,
  };
  root.userData.rig = rig;

  return root;
}

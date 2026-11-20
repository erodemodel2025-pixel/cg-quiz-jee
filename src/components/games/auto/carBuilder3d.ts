import * as THREE from 'three';
import type { CarBuildConfig, InteriorTheme } from './carCatalog.ts';
import { VEHICLE_PRESETS } from './carCatalog.ts';

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

function makeBodyPaintMaterial(config: CarBuildConfig): THREE.MeshPhysicalMaterial {
  const baseColor = new THREE.Color(config.bodyColor);
  switch (config.paintFinish) {
    case 'matte':
      return new THREE.MeshPhysicalMaterial({
        color: baseColor,
        metalness: 0.25,
        roughness: 0.72,
        clearcoat: 0.08,
        clearcoatRoughness: 0.65,
      });
    case 'metallic':
      return new THREE.MeshPhysicalMaterial({
        color: baseColor,
        metalness: 0.72,
        roughness: 0.24,
        clearcoat: 0.9,
        clearcoatRoughness: 0.08,
        envMapIntensity: 1.35,
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
      });
    default:
      return new THREE.MeshPhysicalMaterial({
        color: baseColor,
        metalness: 0.3,
        roughness: 0.14,
        clearcoat: 1.0,
        clearcoatRoughness: 0.04,
        envMapIntensity: 1.3,
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
  // Profile in XY where X = z-axis (front = +halfL, rear = -halfL), Y = height above sill
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
  // Center Z depth along X axis so car faces +Z
  extrude.translate(0, 0, -params.width / 2);
  // Rotate so X->Z (front = +Z), depth along X
  extrude.rotateY(Math.PI / 2);
  extrude.computeVertexNormals();
  return extrude;
}

function buildWheelMesh(params: {
  radius: number;
  width: number;
  rimDesign: CarBuildConfig['rimDesign'];
  rimColor: string;
  caliperColor: string;
  isLeft: boolean;
}): THREE.Group {
  const g = new THREE.Group();
  const tireMat = new THREE.MeshStandardMaterial({
    color: '#14171F',
    roughness: 0.84,
    metalness: 0.06,
  });
  const rimMat = new THREE.MeshStandardMaterial({
    color: params.rimColor,
    roughness: 0.22,
    metalness: 0.86,
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

  // Tire cylinder (axis along X)
  const tireGeo = new THREE.CylinderGeometry(params.radius, params.radius, params.width, 32);
  tireGeo.rotateZ(Math.PI / 2);
  const tire = new THREE.Mesh(tireGeo, tireMat);
  tire.castShadow = true;
  tire.receiveShadow = true;
  g.add(tire);

  // Sidewall chamfer ring
  const sideGeo = new THREE.TorusGeometry(params.radius * 0.82, params.radius * 0.14, 10, 28);
  sideGeo.rotateY(Math.PI / 2);
  const sign = params.isLeft ? 1 : -1;
  const sideRing = new THREE.Mesh(sideGeo, tireMat);
  sideRing.position.x = sign * (params.width * 0.42);
  g.add(sideRing);

  // Outer rim barrel
  const rimRadius = params.radius * 0.68;
  const barrelGeo = new THREE.CylinderGeometry(rimRadius, rimRadius, params.width * 0.94, 28);
  barrelGeo.rotateZ(Math.PI / 2);
  const barrel = new THREE.Mesh(barrelGeo, darkMetal);
  g.add(barrel);

  // Brake rotor disc + caliper inside wheel
  const rotorGeo = new THREE.CylinderGeometry(rimRadius * 0.78, rimRadius * 0.78, 0.03, 24);
  rotorGeo.rotateZ(Math.PI / 2);
  const rotor = new THREE.Mesh(rotorGeo, new THREE.MeshStandardMaterial({ color: '#94A3B8', metalness: 0.9, roughness: 0.28 }));
  rotor.position.x = sign * 0.02;
  g.add(rotor);

  const caliperGeo = new THREE.BoxGeometry(0.06, rimRadius * 0.45, rimRadius * 0.28);
  const caliper = new THREE.Mesh(caliperGeo, caliperMat);
  caliper.position.set(sign * 0.035, rimRadius * 0.35, -rimRadius * 0.38);
  g.add(caliper);

  // Outer lip ring
  const lipGeo = new THREE.TorusGeometry(rimRadius * 0.96, 0.018, 10, 28);
  lipGeo.rotateY(Math.PI / 2);
  const lip = new THREE.Mesh(lipGeo, rimMat);
  lip.position.x = sign * (params.width * 0.47);
  g.add(lip);

  // Spokes by design
  const spokeX = sign * (params.width * 0.45);
  const hubGeo = new THREE.CylinderGeometry(rimRadius * 0.24, rimRadius * 0.24, 0.05, 18);
  hubGeo.rotateZ(Math.PI / 2);
  const hub = new THREE.Mesh(hubGeo, rimMat);
  hub.position.x = spokeX;
  g.add(hub);

  if (params.rimDesign === 'turbofan') {
    const discGeo = new THREE.CylinderGeometry(rimRadius * 0.9, rimRadius * 0.9, 0.02, 24);
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
    if (params.rimDesign === 'offroad-bead') {
      for (let b = 0; b < 12; b++) {
        const bolt = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.018, 0.018), rimMat);
        const a = (b / 12) * Math.PI * 2;
        bolt.position.set(spokeX * 1.03, Math.cos(a) * rimRadius * 0.94, Math.sin(a) * rimRadius * 0.94);
        g.add(bolt);
      }
    }
  }

  return g;
}

export function buildVehicleGroup(config: CarBuildConfig, existing?: THREE.Group): THREE.Group {
  const preset = VEHICLE_PRESETS.find((v) => v.id === config.vehicleId) || VEHICLE_PRESETS[0];
  const p = preset.proportions;

  if (existing) {
    disposeObject3D(existing);
    existing.clear();
  }
  const root = existing ?? new THREE.Group();
  root.name = `vehicle_${preset.id}`;

  const wheelRadius = p.wheelRadius * config.wheelScale;
  const wheelWidth = p.wheelWidth * (config.bodyKit === 'widebody-flares' ? 1.12 : 1.0);
  const trackHalf = p.width * 0.49 + (config.bodyKit === 'widebody-flares' ? 0.07 : 0);
  const suspLift = config.suspensionOffsetMm / 1000;
  const bodyBottomY = Math.max(0.08, p.baseClearance + suspLift);

  const paintMat = makeBodyPaintMaterial(config);
  if (config.engineBayOpen) {
    paintMat.transparent = true;
    paintMat.opacity = 0.88;
  }

  const trimMat = new THREE.MeshStandardMaterial({
    color: '#0F172A',
    roughness: 0.42,
    metalness: 0.35,
  });
  const carbonMat = new THREE.MeshStandardMaterial({
    color: '#1E293B',
    roughness: 0.25,
    metalness: 0.65,
  });
  const chromeMat = new THREE.MeshStandardMaterial({
    color: '#E2E8F0',
    roughness: 0.14,
    metalness: 0.92,
  });

  const chassis = new THREE.Group();
  chassis.position.y = bodyBottomY;
  root.add(chassis);

  // 1. Main sculpted body
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
  mainBody.castShadow = true;
  mainBody.receiveShadow = true;
  chassis.add(mainBody);

  // Side sculpted character crease & underbody skid floor
  const floorTray = new THREE.Mesh(
    new THREE.BoxGeometry(p.width * 0.94, 0.05, p.length * 0.94),
    trimMat
  );
  floorTray.position.y = 0.025;
  chassis.add(floorTray);

  // 2. Cabin Greenhouse + Interior Visible Through Glass
  const glassTintColor =
    config.windowTint === 'clear'
      ? '#BAE6FD'
      : config.windowTint === 'light-smoke'
        ? '#334155'
        : config.windowTint === 'iridescent-blue'
          ? '#0284C7'
          : '#090D16';
  const glassOpacity =
    config.windowTint === 'clear'
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

  // Tapered cabin using Extrude or scaled tapered box
  const cabinGeo = new THREE.CylinderGeometry(
    cabinTopWidth * 0.64,
    p.width * 0.64,
    p.cabinHeight,
    4
  );
  cabinGeo.rotateY(Math.PI / 4);
  cabinGeo.scale(1.0, 1.0, cabinLen / (p.width * 0.9));
  const cabinGlass = new THREE.Mesh(cabinGeo, glassMat);
  cabinGlass.position.set(0, p.bodyHeight + p.cabinHeight * 0.45, cabinZ);
  chassis.add(cabinGlass);

  // Painted Roof Cap
  const roofCap = new THREE.Mesh(
    new THREE.BoxGeometry(cabinTopWidth * 0.92, 0.045, cabinLen * 0.68),
    paintMat
  );
  roofCap.position.set(0, p.bodyHeight + p.cabinHeight * 0.91, cabinZ - 0.04);
  roofCap.castShadow = true;
  chassis.add(roofCap);

  // Side Mirrors
  for (const side of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.03, 0.04), trimMat);
    arm.position.set(side * (p.width * 0.52), p.bodyHeight + 0.04, cabinZ + cabinLen * 0.25);
    chassis.add(arm);
    const housing = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.07, 0.11), paintMat);
    housing.position.set(side * (p.width * 0.58), p.bodyHeight + 0.06, cabinZ + cabinLen * 0.22);
    chassis.add(housing);
  }

  // 3. Detailed Interior (Seats, Dashboard, Steering Wheel)
  const intColors = getInteriorColors(config.interior);
  const seatMat = new THREE.MeshStandardMaterial({ color: intColors.seat, roughness: 0.7 });
  const accentIntMat = new THREE.MeshStandardMaterial({ color: intColors.accent, roughness: 0.45 });
  const dashMat = new THREE.MeshStandardMaterial({ color: intColors.dash, roughness: 0.6 });

  const dash = new THREE.Mesh(new THREE.BoxGeometry(p.width * 0.74, 0.14, 0.34), dashMat);
  dash.position.set(0, p.bodyHeight + 0.04, cabinZ + cabinLen * 0.28);
  chassis.add(dash);

  const steeringWheel = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.016, 8, 20), accentIntMat);
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
    const headrest = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.09, 0.07), accentIntMat);
    headrest.position.set(sx, p.bodyHeight + 0.33, cabinZ - 0.26);
    chassis.add(headrest);
  }

  // 4. Engine / Powertrain Bay Demo (When toggled on!)
  if (config.engineBayOpen) {
    const bayZ = preset.id === 'supercar' ? cabinZ - cabinLen * 0.55 : p.length * 0.28;
    const bayGroup = new THREE.Group();
    bayGroup.position.set(0, p.bodyHeight * 0.72, bayZ);

    if (config.powertrain === 'ev') {
      // Glowing cyan skateboard battery pack + dual e-axles
      const pack = new THREE.Mesh(
        new THREE.BoxGeometry(p.width * 0.62, 0.08, p.length * 0.42),
        new THREE.MeshStandardMaterial({
          color: '#06B6D4',
          emissive: '#0891B2',
          emissiveIntensity: 0.75,
          roughness: 0.25,
        })
      );
      pack.position.set(0, -p.bodyHeight * 0.45, -bayZ);
      bayGroup.add(pack);
      const motor = new THREE.Mesh(
        new THREE.CylinderGeometry(0.16, 0.16, 0.56, 16),
        new THREE.MeshStandardMaterial({ color: '#38BDF8', emissive: '#0284C7', emissiveIntensity: 0.6, metalness: 0.8 })
      );
      motor.rotation.z = Math.PI / 2;
      bayGroup.add(motor);
    } else if (config.powertrain === 'hybrid') {
      const engineBlock = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.22, 0.5), chromeMat);
      bayGroup.add(engineBlock);
      const eModule = new THREE.Mesh(
        new THREE.BoxGeometry(0.56, 0.09, 0.34),
        new THREE.MeshStandardMaterial({ color: '#10B981', emissive: '#059669', emissiveIntensity: 0.7 })
      );
      eModule.position.set(0, -0.05, -0.45);
      bayGroup.add(eModule);
    } else {
      // V8 Engine Block with Twin Intake & Headers
      const block = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.24, 0.62), trimMat);
      bayGroup.add(block);
      const plenum = new THREE.Mesh(
        new THREE.BoxGeometry(0.36, 0.1, 0.52),
        new THREE.MeshStandardMaterial({ color: '#EF4444', emissive: '#991B1B', emissiveIntensity: 0.4, metalness: 0.7 })
      );
      plenum.position.y = 0.16;
      bayGroup.add(plenum);
    }
    chassis.add(bayGroup);
  }

  // 5. Headlights & Front Grille
  const frontZ = p.length / 2 + 0.01;
  const grille = new THREE.Mesh(
    new THREE.BoxGeometry(p.width * 0.52, p.bodyHeight * 0.32, 0.08),
    trimMat
  );
  grille.position.set(0, p.bodyHeight * 0.34, frontZ);
  chassis.add(grille);

  const hlColor =
    config.headlights === 'amber-rally'
      ? '#FBBF24'
      : config.headlights === 'laser-blade'
        ? '#38BDF8'
        : '#F8FAFC';
  const hlEmissive = new THREE.MeshStandardMaterial({
    color: hlColor,
    emissive: hlColor,
    emissiveIntensity: 2.2,
    roughness: 0.1,
  });

  for (const side of [-1, 1]) {
    const xPos = side * (p.width * 0.34);
    const hlY = p.bodyHeight * 0.58;
    if (config.headlights === 'halos') {
      for (const ox of [-0.06, 0.06]) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.012, 8, 20), hlEmissive);
        ring.position.set(xPos + ox, hlY, frontZ + 0.02);
        chassis.add(ring);
      }
    } else if (config.headlights === 'laser-blade') {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.045, 0.06), hlEmissive);
      blade.position.set(xPos, hlY, frontZ + 0.01);
      blade.rotation.z = side * -0.18;
      chassis.add(blade);
    } else if (config.headlights === 'amber-rally') {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.08, 0.06), hlEmissive);
      bar.position.set(xPos, hlY, frontZ + 0.01);
      chassis.add(bar);
      // Auxiliary rally fog pods
      const pod = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.06, 16), hlEmissive);
      pod.rotation.x = Math.PI / 2;
      pod.position.set(side * 0.18, p.bodyHeight * 0.38, frontZ + 0.06);
      chassis.add(pod);
    } else {
      // matrix-led cubes
      for (let c = 0; c < 3; c++) {
        const cube = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.055, 0.05), hlEmissive);
        cube.position.set(xPos + (c - 1) * 0.09, hlY, frontZ + 0.015);
        chassis.add(cube);
      }
    }
  }

  // 6. Taillights
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
    chassis.add(bar);
  } else {
    for (const side of [-1, 1]) {
      const xPos = side * (p.width * 0.34);
      if (config.taillights === 'oled-blade') {
        for (let f = 0; f < 3; f++) {
          const fin = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.05), tlMat);
          fin.position.set(xPos + (f - 1) * 0.095, p.bodyHeight * 0.62, rearZ);
          chassis.add(fin);
        }
      } else {
        const block = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.09, 0.05), tlMat);
        block.position.set(xPos, p.bodyHeight * 0.62, rearZ);
        chassis.add(block);
      }
    }
  }

  // 7. Front Bumper Mods
  if (config.frontBumper === 'sport-splitter' || config.frontBumper === 'track-canards') {
    const lip = new THREE.Mesh(
      new THREE.BoxGeometry(p.width + 0.08, 0.04, 0.24),
      carbonMat
    );
    lip.position.set(0, 0.015, frontZ + 0.05);
    chassis.add(lip);
    if (config.frontBumper === 'track-canards') {
      for (const side of [-1, 1]) {
        const canard = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.03, 0.18), carbonMat);
        canard.position.set(side * (p.width * 0.52), 0.18, frontZ - 0.1);
        canard.rotation.z = side * 0.35;
        chassis.add(canard);
      }
    }
  } else if (config.frontBumper === 'bullbar') {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(p.width * 0.78, 0.26, 0.12), trimMat);
    bar.position.set(0, 0.2, frontZ + 0.08);
    chassis.add(bar);
    const guard = new THREE.Mesh(new THREE.BoxGeometry(p.width * 0.48, 0.14, 0.05), chromeMat);
    guard.position.set(0, 0.06, frontZ + 0.09);
    chassis.add(guard);
  }

  // 8. Rear Bumper Mods
  if (config.rearBumper === 'quad-diffuser') {
    const diff = new THREE.Mesh(new THREE.BoxGeometry(p.width * 0.88, 0.12, 0.16), carbonMat);
    diff.position.set(0, 0.06, rearZ - 0.02);
    chassis.add(diff);
    for (let f = -2; f <= 2; f++) {
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.14, 0.2), trimMat);
      fin.position.set(f * 0.2, 0.05, rearZ - 0.04);
      chassis.add(fin);
    }
    for (const ex of [-0.52, -0.4, 0.4, 0.52]) {
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.12, 12), chromeMat);
      pipe.rotation.x = Math.PI / 2;
      pipe.position.set(ex, 0.08, rearZ - 0.05);
      chassis.add(pipe);
    }
  } else if (config.rearBumper === 'twin-exhaust') {
    for (const ex of [-0.46, 0.46]) {
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.048, 0.12, 14), chromeMat);
      pipe.rotation.x = Math.PI / 2;
      pipe.position.set(ex, 0.08, rearZ - 0.04);
      chassis.add(pipe);
    }
  } else if (config.rearBumper === 'skid-plate') {
    const skid = new THREE.Mesh(new THREE.BoxGeometry(p.width * 0.72, 0.16, 0.08), chromeMat);
    skid.position.set(0, 0.08, rearZ - 0.02);
    skid.rotation.x = 0.25;
    chassis.add(skid);
  }

  // 9. Spoilers & Wings
  const wingZ = -p.length * 0.45;
  const deckY = p.bodyHeight * (1 - p.trunkSlope * 0.45) + 0.03;
  if (config.spoiler === 'lip') {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(p.width * 0.84, 0.045, 0.12), carbonMat);
    blade.position.set(0, deckY + 0.02, wingZ);
    blade.rotation.x = -0.18;
    chassis.add(blade);
  } else if (config.spoiler === 'ducktail') {
    const duck = new THREE.Mesh(new THREE.BoxGeometry(p.width * 0.88, 0.13, 0.16), paintMat);
    duck.position.set(0, deckY + 0.05, wingZ - 0.02);
    duck.rotation.x = -0.45;
    chassis.add(duck);
  } else if (config.spoiler === 'gt-wing' || config.spoiler === 'twin-swan') {
    const wingY = deckY + (config.spoiler === 'twin-swan' ? 0.34 : 0.26);
    const foil = new THREE.Mesh(new THREE.BoxGeometry(p.width * 0.98, 0.035, 0.24), carbonMat);
    foil.position.set(0, wingY, wingZ - 0.04);
    foil.rotation.x = -0.12;
    foil.castShadow = true;
    chassis.add(foil);
    for (const side of [-1, 1]) {
      const pylon = new THREE.Mesh(new THREE.BoxGeometry(0.03, wingY - deckY + 0.04, 0.12), trimMat);
      pylon.position.set(side * (p.width * 0.26), deckY + (wingY - deckY) * 0.5, wingZ - 0.02);
      chassis.add(pylon);
      const endplate = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.16, 0.28), paintMat);
      endplate.position.set(side * (p.width * 0.49), wingY, wingZ - 0.04);
      chassis.add(endplate);
    }
  }

  // 10. Body Kits (Side Skirts, Widebody Flares, Aero GT)
  if (config.bodyKit !== 'factory') {
    for (const side of [-1, 1]) {
      const skirt = new THREE.Mesh(
        new THREE.BoxGeometry(0.11, 0.055, p.wheelbaseHalf * 1.35),
        config.bodyKit === 'aero-gt' ? carbonMat : paintMat
      );
      skirt.position.set(side * (p.width * 0.5 + 0.03), 0.03, 0);
      chassis.add(skirt);

      if (config.bodyKit === 'widebody-flares' || config.bodyKit === 'aero-gt') {
        for (const wz of [p.wheelbaseHalf, -p.wheelbaseHalf]) {
          const flare = new THREE.Mesh(
            new THREE.TorusGeometry(wheelRadius * 1.08, 0.065, 8, 18, Math.PI),
            config.bodyKit === 'aero-gt' ? paintMat : trimMat
          );
          flare.rotation.y = Math.PI / 2;
          flare.position.set(side * (p.width * 0.52), 0.1, wz);
          chassis.add(flare);
        }
      }
    }
  }

  // 11. Decals (PolygonOffset prevents Z-fighting)
  if (config.decal !== 'none') {
    const decalMat = new THREE.MeshStandardMaterial({
      color: config.decalColor,
      roughness: 0.35,
      metalness: 0.2,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    });
    if (config.decal === 'racing-stripes') {
      for (const sx of [-0.17, 0.17]) {
        const hoodStripe = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.015, p.length * 0.92), decalMat);
        hoodStripe.position.set(sx, p.bodyHeight + 0.01, 0);
        chassis.add(hoodStripe);
        const roofStripe = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.015, cabinLen * 0.66), decalMat);
        roofStripe.position.set(sx, p.bodyHeight + p.cabinHeight * 0.93, cabinZ - 0.04);
        chassis.add(roofStripe);
      }
    } else if (config.decal === 'side-livery' || config.decal === 'cyber-circuit') {
      for (const side of [-1, 1]) {
        const band = new THREE.Mesh(
          new THREE.BoxGeometry(0.015, 0.11, p.length * 0.72),
          decalMat
        );
        band.position.set(side * (p.width * 0.5 + 0.045), p.bodyHeight * 0.55, 0);
        chassis.add(band);
        if (config.decal === 'cyber-circuit') {
          const slash = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.06, 0.55), decalMat);
          slash.position.set(side * (p.width * 0.5 + 0.046), p.bodyHeight * 0.72, -0.65);
          slash.rotation.x = 0.45;
          chassis.add(slash);
        }
      }
    } else if (config.decal === 'aero-number') {
      const hoodPad = new THREE.Mesh(
        new THREE.CylinderGeometry(0.32, 0.32, 0.014, 24),
        new THREE.MeshStandardMaterial({ color: '#F8FAFC', polygonOffset: true, polygonOffsetFactor: -2 })
      );
      hoodPad.position.set(0, p.bodyHeight * 0.98, p.length * 0.25);
      chassis.add(hoodPad);
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.018, 0.32), decalMat);
      stripe.position.set(0, p.bodyHeight * 0.99, p.length * 0.25);
      chassis.add(stripe);
    }
  }

  // 12. Wheels Grounded at y = 0 (Tire radius = wheelRadius)
  const caliperColor =
    config.interior === 'crimson-sport'
      ? '#EF4444'
      : config.interior === 'cyber-cyan'
        ? '#22D3EE'
        : '#F59E0B';

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
      isLeft,
    });
    wheel.position.set(wx, wheelRadius, wz);
    root.add(wheel);
  }

  // Soft contact shadow decal directly beneath car on y = 0.005
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

  return root;
}

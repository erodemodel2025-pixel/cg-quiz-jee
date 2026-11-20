import * as THREE from 'three';
import {
  ASSEMBLY_SEQUENCE,
  normalizePhoneState,
  type PhoneBayId,
  type PhoneDesignState,
} from './phoneCatalog.ts';

export interface ExplodablePhoneLayer {
  obj: THREE.Object3D;
  baseZ: number;
  explodeZ: number;
  isRearPanel?: boolean;
}

export interface PhoneRigHandles {
  root: THREE.Group;
  rearPanelGroup: THREE.Group;
  explodables: ExplodablePhoneLayer[];
  bayGroups: Partial<Record<PhoneBayId, THREE.Group>>;
  clickableObjects: THREE.Object3D[];
}

function makeRoundedRectShape(w: number, h: number, r: number): THREE.Shape {
  const hw = w / 2;
  const hh = h / 2;
  const rad = Math.min(r, hw * 0.45, hh * 0.45);
  const s = new THREE.Shape();
  s.moveTo(-hw + rad, -hh);
  s.lineTo(hw - rad, -hh);
  s.quadraticCurveTo(hw, -hh, hw, -hh + rad);
  s.lineTo(hw, hh - rad);
  s.quadraticCurveTo(hw, hh, hw - rad, hh);
  s.lineTo(-hw + rad, hh);
  s.quadraticCurveTo(-hw, hh, -hw, hh - rad);
  s.lineTo(-hw, -hh + rad);
  s.quadraticCurveTo(-hw, -hh, -hw + rad, -hh);
  return s;
}

function makeHollowFrameShape(w: number, h: number, r: number, wall: number): THREE.Shape {
  const outer = makeRoundedRectShape(w, h, r);
  const iw = w - wall * 2;
  const ih = h - wall * 2;
  const ir = Math.max(0.02, r - wall * 0.65);
  const hole = new THREE.Path();
  const hw = iw / 2;
  const hh = ih / 2;
  hole.moveTo(-hw + ir, -hh);
  hole.lineTo(-hw + ir, -hh);
  hole.quadraticCurveTo(-hw, -hh, -hw, -hh + ir);
  hole.lineTo(-hw, hh - ir);
  hole.quadraticCurveTo(-hw, hh, -hw + ir, hh);
  hole.lineTo(hw - ir, hh);
  hole.quadraticCurveTo(hw, hh, hw, hh - ir);
  hole.lineTo(hw, -hh + ir);
  hole.quadraticCurveTo(hw, -hh, hw - ir, -hh);
  hole.lineTo(-hw + ir, -hh);
  outer.holes.push(hole);
  return outer;
}

function createScreenTexture(state: PhoneDesignState, maxAniso: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createLinearGradient(0, 0, 512, 1024);
    if (state.wallpaperId === 'aurora-prism') {
      grad.addColorStop(0, '#0F172A');
      grad.addColorStop(0.5, '#6D28D9');
      grad.addColorStop(1, '#06B6D4');
    } else if (state.wallpaperId === 'solar-horizon') {
      grad.addColorStop(0, '#1E1B4B');
      grad.addColorStop(0.52, '#BE185D');
      grad.addColorStop(1, '#D97706');
    } else if (state.wallpaperId === 'emerald-circuit') {
      grad.addColorStop(0, '#022C22');
      grad.addColorStop(0.55, '#059669');
      grad.addColorStop(1, '#38BDF8');
    } else {
      grad.addColorStop(0, '#020617');
      grad.addColorStop(0.5, '#1D4ED8');
      grad.addColorStop(1, '#0891B2');
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 1024);

    // Subtle CAD grid overlay on screen
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= 512; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 1024);
      ctx.stroke();
    }
    for (let y = 0; y <= 1024; y += 32) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(512, y);
      ctx.stroke();
    }

    // Dynamic Capsule
    ctx.fillStyle = '#020617';
    ctx.beginPath();
    ctx.roundRect(178, 36, 156, 36, 18);
    ctx.fill();
    ctx.fillStyle = '#0EA5E9';
    ctx.beginPath();
    ctx.arc(302, 54, 7, 0, Math.PI * 2);
    ctx.fill();

    // Clock & Hardware HUD on Lockscreen
    ctx.fillStyle = '#F8FAFC';
    ctx.font = 'bold 102px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('09:41', 256, 220);

    ctx.fillStyle = '#BAE6FD';
    ctx.font = 'bold 20px monospace';
    ctx.fillText(state.deviceName.toUpperCase().slice(0, 20), 256, 268);

    // Live Hardware Diagnostic Card on Screen
    ctx.fillStyle = 'rgba(6, 12, 28, 0.72)';
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(42, 340, 428, 250, 22);
    ctx.fill();
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.fillStyle = '#22D3EE';
    ctx.font = 'bold 18px monospace';
    ctx.fillText('HARDWARE BENCHMARK OS', 70, 386);

    const bayLines = [
      `SILICON : ${state.bays.soc === 'soc-flagship' ? '3nm NEURAL SoC' : '6nm EFF. SoC'}`,
      `PANEL   : ${state.bays.display === 'disp-amoled-120' ? 'LTPO AMOLED 120Hz' : state.bays.display === 'disp-oled' ? 'OLED 60Hz' : 'IPS LCD 90Hz'}`,
      `CELL    : ${state.bays.battery === 'bat-5500' ? '5500mAh Si-C' : state.bays.battery === 'bat-4600' ? '4600mAh Li-Ion' : '3400mAh Slim'}`,
      `COOLING : ${state.bays.cooling === 'vapor-graphite' ? 'COPPER VAPOR + GR' : state.bays.cooling === 'graphite-only' ? 'GRAPHITE ONLY' : 'NO SPREADER'}`,
      `RF LINK : ${state.bays.connectivity === 'conn-5g-wifi7' ? '5G mmW + Wi-Fi 7' : '4G/Sub6 + Wi-Fi 6'}`,
    ];
    ctx.fillStyle = '#E2E8F0';
    ctx.font = '18px monospace';
    bayLines.forEach((line, idx) => {
      ctx.fillText(line, 70, 430 + idx * 32);
    });
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAniso;
  return tex;
}

function createPcbTexture(maxAniso: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#07221B';
    ctx.fillRect(0, 0, 512, 512);
    // Copper differential PCB traces
    ctx.strokeStyle = '#14B8A6';
    ctx.lineWidth = 2;
    for (let i = 16; i < 512; i += 24) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(140, i);
      ctx.lineTo(170, i + 14);
      ctx.lineTo(512, i + 14);
      ctx.stroke();
    }
    ctx.strokeStyle = '#F59E0B';
    ctx.lineWidth = 2.5;
    for (let x = 40; x < 480; x += 64) {
      ctx.beginPath();
      ctx.moveTo(x, 20);
      ctx.lineTo(x, 492);
      ctx.stroke();
    }
    // Solder gold pads
    ctx.fillStyle = '#FBBF24';
    for (let y = 32; y < 480; y += 48) {
      for (let x = 32; x < 480; x += 48) {
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAniso;
  return tex;
}

function createBatteryLabelTexture(mah: string, maxAniso: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#111827';
    ctx.fillRect(0, 0, 256, 512);
    ctx.strokeStyle = '#10B981';
    ctx.lineWidth = 6;
    ctx.strokeRect(10, 10, 236, 492);

    ctx.fillStyle = '#34D399';
    ctx.font = 'bold 26px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('LI-ION CELL', 128, 120);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 42px sans-serif';
    ctx.fillText(mah, 128, 220);

    ctx.fillStyle = '#94A3B8';
    ctx.font = '18px monospace';
    ctx.fillText('3.87V NOMINAL', 128, 276);
    ctx.fillText('BMS PROTECTED', 128, 314);
    ctx.fillStyle = '#F59E0B';
    ctx.fillText('⚠ SIMULATED SPEC', 128, 430);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAniso;
  return tex;
}

function tagInteractive(
  obj: THREE.Object3D,
  componentId: string,
  bayId: PhoneBayId,
  clickableObjects: THREE.Object3D[]
): void {
  obj.traverse((child) => {
    child.userData.componentId = componentId;
    child.userData.bayId = bayId;
  });
  clickableObjects.push(obj);
}

export function buildPhoneGroup(
  rawState: PhoneDesignState,
  opts: { isSoftwareGl: boolean; maxAnisotropy: number }
): PhoneRigHandles {
  const state = normalizePhoneState(rawState);
  const installed = new Set<PhoneBayId>(state.installedBays?.length ? state.installedBays : ASSEMBLY_SEQUENCE);
  const b = state.bays;

  const scaleFactor =
    state.sizePreset === 'compact' ? 0.92 : state.sizePreset === 'pro-max' ? 1.09 : 1.0;
  const width = 0.78 * scaleFactor;
  const height = 1.62 * scaleFactor;
  const depth = Math.max(0.06, Math.min(0.14, state.thicknessMm * 0.0115));
  const cornerR = 0.115 * scaleFactor;

  const root = new THREE.Group();
  const rearPanelGroup = new THREE.Group();
  const explodables: ExplodablePhoneLayer[] = [];
  const bayGroups: Partial<Record<PhoneBayId, THREE.Group>> = {};
  const clickableObjects: THREE.Object3D[] = [];

  // Shared materials by physical finish
  const frameColor =
    b.frame === 'frame-steel'
      ? '#CBD5E1'
      : b.frame === 'frame-titanium'
        ? '#94A3B8'
        : '#64748B';
  const frameMat = new THREE.MeshPhysicalMaterial({
    color: frameColor,
    metalness: 0.92,
    roughness: b.frame === 'frame-steel' ? 0.14 : b.frame === 'frame-titanium' ? 0.28 : 0.34,
    anisotropy: 0.75,
  });

  // ==================== BAY 1: STRUCTURAL PERIMETER FRAME ====================
  const frameGroup = new THREE.Group();
  const frameShape = makeHollowFrameShape(width, height, cornerR, 0.036);
  const frameGeo = new THREE.ExtrudeGeometry(frameShape, {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.008,
    bevelSize: 0.006,
    bevelSegments: 2,
    curveSegments: 14,
  });
  frameGeo.translate(0, 0, -depth / 2);
  const frameMesh = new THREE.Mesh(frameGeo, frameMat);
  frameMesh.castShadow = true;
  frameMesh.receiveShadow = true;
  frameGroup.add(frameMesh);

  // Mid-plate CNC structural webbing inside frame
  const midPlateGeo = new THREE.BoxGeometry(width - 0.06, height - 0.07, 0.012);
  const midPlateMat = new THREE.MeshStandardMaterial({
    color: '#1E293B',
    metalness: 0.78,
    roughness: 0.38,
  });
  const midPlate = new THREE.Mesh(midPlateGeo, midPlateMat);
  midPlate.position.z = depth * 0.16;
  frameGroup.add(midPlate);

  // Side machined buttons (Power, Volume, Action)
  const btnGeo = new THREE.BoxGeometry(0.016, 0.14, depth * 0.42);
  const powerBtn = new THREE.Mesh(btnGeo, frameMat);
  powerBtn.position.set(width / 2 + 0.008, 0.14, 0);
  frameGroup.add(powerBtn);
  const volUp = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.11, depth * 0.4), frameMat);
  volUp.position.set(-width / 2 - 0.008, 0.22, 0);
  const volDn = volUp.clone();
  volDn.position.y = 0.07;
  frameGroup.add(volUp, volDn);

  tagInteractive(frameGroup, b.frame, 'frame', clickableObjects);
  bayGroups.frame = frameGroup;
  root.add(frameGroup);
  explodables.push({ obj: frameGroup, baseZ: 0, explodeZ: 0 });

  // ==================== BAY 9: DISPLAY STACK (FRONT z+) ====================
  const displayGroup = new THREE.Group();
  const dispZ = depth / 2 + 0.008;
  displayGroup.position.z = dispZ;
  if (installed.has('display')) {
    const scrShape = makeRoundedRectShape(width - 0.048, height - 0.048, cornerR * 0.85);
    const scrGeo = new THREE.ShapeGeometry(scrShape, 14);
    const screenTex = createScreenTexture(state, opts.maxAnisotropy);
    const screenMat = new THREE.MeshStandardMaterial({
      map: screenTex,
      roughness: 0.18,
      metalness: 0.08,
      emissive: new THREE.Color('#0B1D3A'),
      emissiveIntensity: 0.35,
    });
    // Adjust UVs to 0..1 across rounded screen shape
    const pos = scrGeo.attributes.position;
    const uv = scrGeo.attributes.uv;
    const sw = width - 0.048;
    const sh = height - 0.048;
    for (let i = 0; i < pos.count; i++) {
      uv.setXY(i, (pos.getX(i) + sw / 2) / sw, (pos.getY(i) + sh / 2) / sh);
    }
    const screenMesh = new THREE.Mesh(scrGeo, screenMat);
    screenMesh.position.z = 0.008;
    displayGroup.add(screenMesh);

    // Protective ceramic cover bezel glass
    const glassBezel = new THREE.Mesh(
      new THREE.BoxGeometry(width - 0.04, height - 0.04, 0.01),
      new THREE.MeshPhysicalMaterial({
        color: '#020617',
        roughness: 0.08,
        metalness: 0.15,
        clearcoat: 1.0,
      })
    );
    glassBezel.position.z = 0.001;
    displayGroup.add(glassBezel);

    // Capacitive digitizer & DDIC copper flex ribbon on back of display
    const ddicFlex = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.07, 0.008),
      new THREE.MeshStandardMaterial({ color: '#D97706', metalness: 0.7, roughness: 0.3 })
    );
    ddicFlex.position.set(0, -height * 0.39, -0.008);
    displayGroup.add(ddicFlex);
    tagInteractive(ddicFlex, 'disp-controller', 'display', clickableObjects);
    tagInteractive(screenMesh, b.display, 'display', clickableObjects);
  }
  bayGroups.display = displayGroup;
  root.add(displayGroup);
  explodables.push({ obj: displayGroup, baseZ: dispZ, explodeZ: dispZ + 0.56 });

  // ==================== BAY 2 & 3: LOGIC PCB, SoC, MEMORY & PMIC ====================
  const logicGroup = new THREE.Group();
  const logicZ = -depth * 0.06;
  logicGroup.position.z = logicZ;
  const pcbTex = createPcbTexture(opts.maxAnisotropy);
  const pcbMat = new THREE.MeshStandardMaterial({
    map: pcbTex,
    roughness: 0.42,
    metalness: 0.25,
  });
  // L-shaped upper motherboard
  const mainPcb = new THREE.Mesh(new THREE.BoxGeometry(width * 0.44, height * 0.42, 0.016), pcbMat);
  mainPcb.position.set(width * 0.16, height * 0.14, 0);
  logicGroup.add(mainPcb);

  if (installed.has('soc')) {
    const socColor = b.soc === 'soc-flagship' ? '#0EA5E9' : '#6366F1';
    const socPkg = new THREE.Mesh(
      new THREE.BoxGeometry(0.145, 0.145, 0.022),
      new THREE.MeshPhysicalMaterial({ color: '#1E293B', metalness: 0.55, roughness: 0.3 })
    );
    socPkg.position.set(width * 0.16, height * 0.16, -0.016);
    const dieCap = new THREE.Mesh(
      new THREE.BoxGeometry(0.095, 0.095, 0.008),
      new THREE.MeshStandardMaterial({
        color: socColor,
        metalness: 0.85,
        roughness: 0.2,
        emissive: new THREE.Color(socColor),
        emissiveIntensity: 0.22,
      })
    );
    dieCap.position.set(width * 0.16, height * 0.16, -0.028);
    logicGroup.add(socPkg, dieCap);
    tagInteractive(socPkg, b.soc, 'soc', clickableObjects);
    tagInteractive(dieCap, 'cpu-core', 'soc', clickableObjects);

    // PMIC Voltage Regulator Chip
    const pmic = new THREE.Mesh(
      new THREE.BoxGeometry(0.07, 0.06, 0.016),
      new THREE.MeshStandardMaterial({ color: '#334155', metalness: 0.6, roughness: 0.35 })
    );
    pmic.position.set(width * 0.27, height * 0.03, -0.015);
    logicGroup.add(pmic);
    tagInteractive(pmic, 'pmic-ic', 'soc', clickableObjects);
  }

  if (installed.has('memory')) {
    // Stacked PoP RAM + UFS 4.0 NAND Flash
    const ramMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.11, 0.09, 0.014),
      new THREE.MeshStandardMaterial({ color: '#0F172A', metalness: 0.45, roughness: 0.35 })
    );
    ramMesh.position.set(width * 0.16, height * 0.26, -0.015);
    const nandMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.11, 0.12, 0.018),
      new THREE.MeshStandardMaterial({
        color: b.memory === 'ram-lpddr5x-storage' ? '#38BDF8' : '#64748B',
        metalness: 0.65,
        roughness: 0.28,
      })
    );
    nandMesh.position.set(width * 0.06, height * 0.04, -0.015);
    logicGroup.add(ramMesh, nandMesh);
    tagInteractive(ramMesh, 'ram-lpddr5x', 'memory', clickableObjects);
    tagInteractive(nandMesh, 'storage-ufs4', 'memory', clickableObjects);
  }

  bayGroups.soc = logicGroup;
  bayGroups.memory = logicGroup;
  root.add(logicGroup);
  explodables.push({ obj: logicGroup, baseZ: logicZ, explodeZ: logicZ - 0.18 });

  // ==================== BAY 8: CONNECTIVITY RF & ANTENNAS ====================
  const rfGroup = new THREE.Group();
  const rfZ = -depth * 0.08;
  rfGroup.position.z = rfZ;
  if (installed.has('connectivity')) {
    const modemChip = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.08, 0.016),
      new THREE.MeshStandardMaterial({
        color: b.connectivity === 'conn-5g-wifi7' ? '#A855F7' : '#3B82F6',
        metalness: 0.72,
        roughness: 0.28,
      })
    );
    modemChip.position.set(width * 0.25, height * 0.24, -0.018);
    rfGroup.add(modemChip);
    tagInteractive(modemChip, b.connectivity === 'conn-5g-wifi7' ? 'conn-5g' : 'conn-wifi', 'connectivity', clickableObjects);

    // mmWave / LDS Antenna carrier strips along top & bottom frame edge
    const antMat = new THREE.MeshStandardMaterial({ color: '#F59E0B', metalness: 0.85, roughness: 0.22 });
    const topAnt = new THREE.Mesh(new THREE.BoxGeometry(width * 0.56, 0.035, 0.018), antMat);
    topAnt.position.set(0, height / 2 - 0.045, -0.01);
    const sideAnt = new THREE.Mesh(new THREE.BoxGeometry(0.032, height * 0.36, 0.018), antMat);
    sideAnt.position.set(width / 2 - 0.045, 0.1, -0.01);
    rfGroup.add(topAnt, sideAnt);
    tagInteractive(topAnt, 'conn-antenna', 'connectivity', clickableObjects);
    tagInteractive(sideAnt, 'conn-gps', 'connectivity', clickableObjects);

    // NFC Loop near upper rear camera bridge
    const nfcPad = new THREE.Mesh(
      new THREE.RingGeometry(0.06, 0.085, 24),
      new THREE.MeshStandardMaterial({ color: '#FBBF24', side: THREE.DoubleSide, metalness: 0.8, roughness: 0.3 })
    );
    nfcPad.position.set(0.08, height * 0.29, -0.025);
    rfGroup.add(nfcPad);
    tagInteractive(nfcPad, 'conn-nfc', 'connectivity', clickableObjects);
  }
  bayGroups.connectivity = rfGroup;
  root.add(rfGroup);
  explodables.push({ obj: rfGroup, baseZ: rfZ, explodeZ: rfZ - 0.26 });

  // ==================== BAY 5 & 6: BATTERY, BMS, USB-C & CHARGING ====================
  const powerGroup = new THREE.Group();
  const pwrZ = -depth * 0.05;
  powerGroup.position.z = pwrZ;
  if (installed.has('battery')) {
    const isBig = b.battery === 'bat-5500';
    const isSmall = b.battery === 'bat-3400';
    const batW = isBig ? width * 0.52 : isSmall ? width * 0.4 : width * 0.47;
    const batH = isBig ? height * 0.54 : isSmall ? height * 0.42 : height * 0.49;
    const batD = isBig ? Math.max(0.036, depth * 0.54) : isSmall ? depth * 0.36 : depth * 0.46;
    const mahLabel = isBig ? '5,500 mAh' : isSmall ? '3,400 mAh' : '4,600 mAh';

    const batTex = createBatteryLabelTexture(mahLabel, opts.maxAnisotropy);
    const batMat = new THREE.MeshStandardMaterial({
      map: batTex,
      roughness: 0.42,
      metalness: 0.35,
    });
    const batMesh = new THREE.Mesh(new THREE.BoxGeometry(batW, batH, batD), batMat);
    batMesh.position.set(-width * 0.14, -height * 0.04, -0.008);
    powerGroup.add(batMesh);
    tagInteractive(batMesh, b.battery, 'battery', clickableObjects);

    // BMS Protection PCB strip along top edge of battery
    const bmsBar = new THREE.Mesh(
      new THREE.BoxGeometry(batW * 0.9, 0.045, 0.016),
      new THREE.MeshStandardMaterial({ color: '#059669', metalness: 0.5, roughness: 0.35 })
    );
    bmsBar.position.set(-width * 0.14, -height * 0.04 + batH / 2 + 0.024, -0.01);
    powerGroup.add(bmsBar);
    tagInteractive(bmsBar, 'bms-module', 'battery', clickableObjects);
  }

  if (installed.has('charging')) {
    // Sub-PCB Charging Daughterboard + USB-C Receptacle
    const subPcb = new THREE.Mesh(
      new THREE.BoxGeometry(width * 0.65, 0.11, 0.014),
      pcbMat
    );
    subPcb.position.set(0, -height / 2 + 0.12, -0.008);
    const usbcPort = new THREE.Mesh(
      new THREE.BoxGeometry(0.11, 0.055, 0.034),
      new THREE.MeshStandardMaterial({ color: '#94A3B8', metalness: 0.9, roughness: 0.25 })
    );
    usbcPort.position.set(0, -height / 2 + 0.03, 0);
    powerGroup.add(subPcb, usbcPort);
    tagInteractive(subPcb, 'chg-65w', 'charging', clickableObjects);
    tagInteractive(usbcPort, 'hw-usbc', 'charging', clickableObjects);
  }
  bayGroups.battery = powerGroup;
  bayGroups.charging = powerGroup;
  root.add(powerGroup);
  explodables.push({ obj: powerGroup, baseZ: pwrZ, explodeZ: pwrZ - 0.35 });

  // ==================== BAY 10: ACOUSTICS, TAPTIC LRA, SEALS & 24 INSTANCED SCREWS ====================
  const periGroup = new THREE.Group();
  const periZ = -depth * 0.12;
  periGroup.position.z = periZ;
  if (installed.has('peripherals')) {
    // Bottom Acoustic Stereo Speaker Box
    const spkBox = new THREE.Mesh(
      new THREE.BoxGeometry(width * 0.28, 0.12, 0.028),
      new THREE.MeshStandardMaterial({ color: '#1E293B', roughness: 0.55, metalness: 0.2 })
    );
    spkBox.position.set(width * 0.22, -height / 2 + 0.12, -0.01);
    periGroup.add(spkBox);
    tagInteractive(spkBox, 'hw-speaker', 'peripherals', clickableObjects);

    // Taptic Linear Actuator (Tungsten Mass Engine)
    if (b.peripherals === 'full-ip68-taptic') {
      const taptic = new THREE.Mesh(
        new THREE.BoxGeometry(width * 0.24, 0.1, 0.026),
        new THREE.MeshStandardMaterial({ color: '#475569', metalness: 0.85, roughness: 0.28 })
      );
      taptic.position.set(-width * 0.23, -height / 2 + 0.12, -0.01);
      periGroup.add(taptic);
      tagInteractive(taptic, 'hw-taptic', 'peripherals', clickableObjects);
    }

    // IP68 Perimeter Sealing Gasket Ring
    const sealColor = b.peripherals === 'full-ip68-taptic' ? '#06B6D4' : '#64748B';
    const sealShape = makeHollowFrameShape(width - 0.024, height - 0.024, cornerR * 0.92, 0.012);
    const sealMesh = new THREE.Mesh(
      new THREE.ExtrudeGeometry(sealShape, { depth: 0.008, bevelEnabled: false, curveSegments: 12 }),
      new THREE.MeshStandardMaterial({ color: sealColor, roughness: 0.7, metalness: 0.05 })
    );
    sealMesh.position.z = -0.016;
    periGroup.add(sealMesh);
    tagInteractive(sealMesh, 'hw-seals', 'peripherals', clickableObjects);

    // 24 Precision Micro-Screws using InstancedMesh + computeBoundingSphere()
    const screwGeo = new THREE.CylinderGeometry(0.009, 0.009, 0.014, 8);
    screwGeo.rotateX(Math.PI / 2);
    const screwMat = new THREE.MeshStandardMaterial({
      color: '#E2E8F0',
      metalness: 0.95,
      roughness: 0.18,
    });
    const screwCount = 24;
    const screwsInst = new THREE.InstancedMesh(screwGeo, screwMat, screwCount);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < screwCount; i++) {
      const side = i < 10 ? -1 : i < 20 ? 1 : 0;
      const sx =
        side !== 0
          ? side * (width / 2 - 0.055)
          : -width * 0.28 + (i - 20) * (width * 0.18);
      const sy =
        side !== 0
          ? -height * 0.4 + ((i % 10) / 9) * (height * 0.8)
          : i % 2 === 0
            ? height / 2 - 0.055
            : -height / 2 + 0.055;
      dummy.position.set(sx, sy, -0.022);
      dummy.updateMatrix();
      screwsInst.setMatrixAt(i, dummy.matrix);
    }
    screwsInst.instanceMatrix.needsUpdate = true;
    screwsInst.computeBoundingSphere();
    periGroup.add(screwsInst);
    tagInteractive(screwsInst, 'hw-screws', 'peripherals', clickableObjects);
  }
  bayGroups.peripherals = periGroup;
  root.add(periGroup);
  explodables.push({ obj: periGroup, baseZ: periZ, explodeZ: periZ - 0.45 });

  // ==================== BAY 7: CAMERA OPTICS & OIS ARRAY ====================
  const camGroup = new THREE.Group();
  const camZ = -depth / 2 - 0.006;
  camGroup.position.z = camZ;
  if (installed.has('camera')) {
    const camW = b.camera === 'cam-single-basic' ? 0.18 : 0.31;
    const camH = b.camera === 'cam-single-basic' ? 0.18 : 0.34;
    const bumpMat = new THREE.MeshPhysicalMaterial({
      color: state.bodyColor,
      roughness: 0.24,
      metalness: 0.28,
      clearcoat: 0.9,
    });
    const bump = new THREE.Mesh(new THREE.BoxGeometry(camW, camH, 0.032), bumpMat);
    bump.position.set(-width * 0.21, height * 0.3, -0.01);
    camGroup.add(bump);

    const lensPositions: Array<{ x: number; y: number; compId: string; square?: boolean }> =
      b.camera === 'cam-pro-ois'
        ? [
            { x: -width * 0.27, y: height * 0.36, compId: 'cam-main' },
            { x: -width * 0.27, y: height * 0.24, compId: 'cam-ultrawide' },
            { x: -width * 0.14, y: height * 0.3, compId: 'cam-telephoto', square: true },
          ]
        : b.camera === 'cam-dual-ois'
          ? [
              { x: -width * 0.26, y: height * 0.35, compId: 'cam-main' },
              { x: -width * 0.15, y: height * 0.25, compId: 'cam-ultrawide' },
            ]
          : [{ x: -width * 0.21, y: height * 0.3, compId: 'cam-main' }];

    for (const lp of lensPositions) {
      const housing = new THREE.Mesh(
        lp.square ? new THREE.BoxGeometry(0.1, 0.1, 0.028) : new THREE.CylinderGeometry(0.055, 0.055, 0.028, 22),
        new THREE.MeshStandardMaterial({ color: '#0F172A', metalness: 0.85, roughness: 0.2 })
      );
      if (!lp.square) housing.rotation.x = Math.PI / 2;
      housing.position.set(lp.x, lp.y, -0.022);

      const glassElement = new THREE.Mesh(
        new THREE.CylinderGeometry(0.034, 0.034, 0.012, 20),
        new THREE.MeshPhysicalMaterial({
          color: '#0284C7',
          metalness: 0.2,
          roughness: 0.05,
          clearcoat: 1.0,
        })
      );
      glassElement.rotation.x = Math.PI / 2;
      glassElement.position.set(lp.x, lp.y, -0.034);
      camGroup.add(housing, glassElement);
      tagInteractive(housing, lp.compId, 'camera', clickableObjects);
      tagInteractive(glassElement, b.camera === 'cam-single-basic' ? 'cam-lens' : 'cam-ois', 'camera', clickableObjects);
    }
  }
  bayGroups.camera = camGroup;
  root.add(camGroup);
  explodables.push({ obj: camGroup, baseZ: camZ, explodeZ: camZ - 0.56 });

  // ==================== BAY 4 + WIRELESS COIL: THERMAL SPREADER & QI2 COIL ====================
  const thermalGroup = new THREE.Group();
  const thermZ = -depth * 0.28;
  thermalGroup.position.z = thermZ;
  if (installed.has('cooling') && b.cooling !== 'none') {
    if (b.cooling === 'vapor-graphite') {
      const vaporChamber = new THREE.Mesh(
        new THREE.BoxGeometry(width * 0.56, height * 0.44, 0.008),
        new THREE.MeshPhysicalMaterial({
          color: '#D97706',
          metalness: 0.92,
          roughness: 0.24,
        })
      );
      vaporChamber.position.set(0.02, height * 0.06, -0.008);
      thermalGroup.add(vaporChamber);
      tagInteractive(vaporChamber, 'therm-vapor', 'cooling', clickableObjects);
    }
    const graphiteSheet = new THREE.Mesh(
      new THREE.BoxGeometry(width * 0.66, height * 0.56, 0.004),
      new THREE.MeshStandardMaterial({ color: '#111827', metalness: 0.45, roughness: 0.55 })
    );
    graphiteSheet.position.set(0, -0.02, -0.004);
    thermalGroup.add(graphiteSheet);
    tagInteractive(graphiteSheet, 'therm-graphite', 'cooling', clickableObjects);
  }

  // Qi2 Magnetic Copper Coil (renders if 65W+Qi2 selected)
  if (installed.has('charging') && b.charging === 'chg-65w-qi2') {
    const coilMat = new THREE.MeshStandardMaterial({
      color: '#EA580C',
      metalness: 0.9,
      roughness: 0.22,
    });
    const outerCoil = new THREE.Mesh(new THREE.TorusGeometry(0.165, 0.012, 10, 32), coilMat);
    outerCoil.position.set(0, -height * 0.05, -0.018);
    const innerCoil = new THREE.Mesh(new THREE.TorusGeometry(0.125, 0.01, 10, 30), coilMat);
    innerCoil.position.set(0, -height * 0.05, -0.018);
    const magRing = new THREE.Mesh(
      new THREE.RingGeometry(0.185, 0.205, 32),
      new THREE.MeshStandardMaterial({ color: '#38BDF8', side: THREE.DoubleSide, metalness: 0.8, roughness: 0.2 })
    );
    magRing.position.set(0, -height * 0.05, -0.02);
    thermalGroup.add(outerCoil, innerCoil, magRing);
    tagInteractive(outerCoil, 'hw-coil', 'charging', clickableObjects);
    tagInteractive(magRing, 'hw-coil', 'charging', clickableObjects);
  }
  bayGroups.cooling = thermalGroup;
  root.add(thermalGroup);
  explodables.push({ obj: thermalGroup, baseZ: thermZ, explodeZ: thermZ - 0.7 });

  // ==================== BAY 11: REAR ENCLOSURE PANEL (SLIDES/REMOVES) ====================
  const rearZ = -depth / 2 - 0.004;
  rearPanelGroup.position.z = rearZ;
  if (installed.has('backPanel')) {
    const backShape = makeRoundedRectShape(width - 0.03, height - 0.03, cornerR * 0.9);
    const backGeo = new THREE.ExtrudeGeometry(backShape, {
      depth: 0.012,
      bevelEnabled: false,
      curveSegments: 14,
    });
    backGeo.translate(0, 0, -0.006);
    const isAlu = b.backPanel === 'back-alu';
    const backMat = new THREE.MeshPhysicalMaterial({
      color: state.bodyColor,
      metalness: isAlu ? 0.85 : 0.14,
      roughness: isAlu ? 0.34 : 0.12,
      clearcoat: isAlu ? 0.1 : 1.0,
      transparent: !isAlu,
      opacity: !isAlu ? (opts.isSoftwareGl ? 0.86 : 0.92) : 1.0,
    });
    const backMesh = new THREE.Mesh(backGeo, backMat);
    backMesh.receiveShadow = true;
    rearPanelGroup.add(backMesh);
    tagInteractive(backMesh, b.backPanel, 'backPanel', clickableObjects);
  }
  bayGroups.backPanel = rearPanelGroup;
  root.add(rearPanelGroup);
  explodables.push({ obj: rearPanelGroup, baseZ: rearZ, explodeZ: rearZ - 0.95, isRearPanel: true });

  return {
    root,
    rearPanelGroup,
    explodables,
    bayGroups,
    clickableObjects,
  };
}

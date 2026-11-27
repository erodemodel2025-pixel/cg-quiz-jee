import * as THREE from 'three';

export interface SlalomCone {
  x: number;
  z: number;
  hit: boolean;
  mesh: THREE.Group;
}

export interface TrackEnvironmentRig {
  root: THREE.Group;
  cones: SlalomCone[];
  finishGateZ: number;
  aiLaneX: number;
  playerLaneX: number;
  dispose: () => void;
}

export function buildTestTrackScene(mode: string): TrackEnvironmentRig {
  const root = new THREE.Group();
  const trackLength = 950;
  const trackWidth = mode === 'drag' || mode === 'braking' ? 16 : 22;

  // Ground apron
  const groundMat = new THREE.MeshStandardMaterial({
    color: '#0A1628',
    roughness: 0.92,
    metalness: 0.05,
  });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(360, trackLength + 240), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.02, trackLength * 0.42);
  ground.receiveShadow = true;
  root.add(ground);

  // Asphalt surface
  const roadMat = new THREE.MeshStandardMaterial({
    color: '#182132',
    roughness: 0.78,
    metalness: 0.1,
  });
  const road = new THREE.Mesh(new THREE.BoxGeometry(trackWidth, 0.04, trackLength + 120), roadMat);
  road.position.set(0, -0.015, trackLength * 0.44);
  road.receiveShadow = true;
  root.add(road);

  // Alternating red/white track kerbs & distance markers
  const kerbRed = new THREE.MeshStandardMaterial({ color: '#EF4444', roughness: 0.6 });
  const kerbWhite = new THREE.MeshStandardMaterial({ color: '#F8FAFC', roughness: 0.55 });
  const kerbGeo = new THREE.BoxGeometry(0.65, 0.06, 6);

  const stripeMat = new THREE.MeshBasicMaterial({ color: '#38BDF8' });
  const stripeGeo = new THREE.PlaneGeometry(0.28, 5);
  stripeGeo.rotateX(-Math.PI / 2);

  for (let z = -30; z <= trackLength; z += 12) {
    const isEven = Math.floor((z + 30) / 12) % 2 === 0;
    const mat = isEven ? kerbRed : kerbWhite;
    const leftK = new THREE.Mesh(kerbGeo, mat);
    leftK.position.set(-trackWidth / 2 - 0.25, 0.015, z);
    const rightK = new THREE.Mesh(kerbGeo, mat);
    rightK.position.set(trackWidth / 2 + 0.25, 0.015, z);
    root.add(leftK, rightK);

    const centerStripe = new THREE.Mesh(stripeGeo, stripeMat);
    centerStripe.position.set(0, 0.01, z);
    root.add(centerStripe);
  }

  // Distance gantries every 100m
  const poleMat = new THREE.MeshStandardMaterial({ color: '#334155', metalness: 0.7, roughness: 0.35 });
  const bannerMat = new THREE.MeshStandardMaterial({
    color: '#0284C7',
    emissive: '#0284C7',
    emissiveIntensity: 0.35,
  });
  const finishGateZ = mode === 'drag' ? 402.3 : mode === 'slalom' ? 320 : 500;

  for (let z = 100; z <= 600; z += 100) {
    const isFinish = Math.abs(z - finishGateZ) < 60 && mode === 'drag' ? false : z === 400 || z === 500;
    const leftPole = new THREE.Mesh(new THREE.BoxGeometry(0.35, 5.2, 0.35), poleMat);
    leftPole.position.set(-trackWidth / 2 - 1.2, 2.6, z);
    const rightPole = new THREE.Mesh(new THREE.BoxGeometry(0.35, 5.2, 0.35), poleMat);
    rightPole.position.set(trackWidth / 2 + 1.2, 2.6, z);
    const cross = new THREE.Mesh(
      new THREE.BoxGeometry(trackWidth + 2.8, 0.75, 0.3),
      isFinish
        ? new THREE.MeshStandardMaterial({ color: '#10B981', emissive: '#10B981', emissiveIntensity: 0.55 })
        : bannerMat
    );
    cross.position.set(0, 4.9, z);
    root.add(leftPole, rightPole, cross);
  }

  // Cornering chicane guides for cornering mode
  if (mode === 'cornering') {
    const archMat = new THREE.MeshStandardMaterial({
      color: '#F59E0B',
      emissive: '#F59E0B',
      emissiveIntensity: 0.4,
    });
    for (let z = 80; z <= 480; z += 80) {
      const targetX = Math.sin(z * 0.024) * 5.2;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.14, 8, 28, Math.PI), archMat);
      ring.position.set(targetX, 0.1, z);
      root.add(ring);
    }
  }

  // Slalom cones for slalom mode
  const cones: SlalomCone[] = [];
  if (mode === 'slalom') {
    const coneMat = new THREE.MeshStandardMaterial({
      color: '#F97316',
      emissive: '#EA580C',
      emissiveIntensity: 0.25,
      roughness: 0.4,
    });
    const baseMat = new THREE.MeshStandardMaterial({ color: '#0F172A', roughness: 0.8 });
    for (let i = 0; i < 9; i++) {
      const z = 45 + i * 32;
      const x = i % 2 === 0 ? -3.2 : 3.2;
      const coneGrp = new THREE.Group();
      const base = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.08, 0.65), baseMat);
      base.position.y = 0.04;
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.85, 14), coneMat);
      tip.position.y = 0.48;
      coneGrp.add(base, tip);
      coneGrp.position.set(x, 0, z);
      root.add(coneGrp);
      cones.push({ x, z, hit: false, mesh: coneGrp });
    }
  }

  const dispose = () => {
    root.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry?.dispose();
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach((m) => m?.dispose());
      }
    });
  };

  return {
    root,
    cones,
    finishGateZ,
    aiLaneX: 3.4,
    playerLaneX: mode === 'drag' ? -3.4 : 0,
    dispose,
  };
}

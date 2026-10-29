import * as THREE from 'three';
import { EnemyKind } from './torchRules';

/** Monsters of the Torchlight mode, built from simple solids: each has swinging limbs, a hit flash and an attack wind-up. */

export interface Monster3D {
  group: THREE.Group;
  /** Height of the head top in metres (before the group scale). */
  height: number;
  /** 0..1 white flash when hit. */
  flash(v: number): void;
  /** `walk` is the stride phase in radians, `moving` 0..1, `attack` is the swing progress 0..1 (or -1 when idle). */
  animate(walk: number, moving: number, attack: number, t: number): void;
  dispose(): void;
}

interface Look {
  skin: number;
  cloth: number;
  eye: number;
  torso: [number, number, number];
  head: number;
  arm: [number, number];
  leg: [number, number];
  emissive?: number;
}

const LOOKS: Record<EnemyKind, Look> = {
  grunt: { skin: 0x5f8a3c, cloth: 0x4a3524, eye: 0xffe14a, torso: [0.55, 0.62, 0.34], head: 0.27, arm: [0.1, 0.62], leg: [0.12, 0.62] },
  archer: { skin: 0xd8d2bd, cloth: 0x3a342c, eye: 0x6ad8ff, torso: [0.42, 0.62, 0.24], head: 0.25, arm: [0.07, 0.66], leg: [0.08, 0.7] },
  brute: { skin: 0x8a4b3a, cloth: 0x2f2622, eye: 0xff5a2a, torso: [0.8, 0.8, 0.5], head: 0.27, arm: [0.17, 0.72], leg: [0.19, 0.62] },
  boss: { skin: 0x3a1f4a, cloth: 0x1c1224, eye: 0xff9a2a, torso: [0.76, 0.84, 0.46], head: 0.27, arm: [0.16, 0.8], leg: [0.17, 0.7], emissive: 0x401408 }
};

/** `tint` recolours the skin (each zone has its own), so the same bodies look different from zone to zone. */
export function makeMonster(kind: EnemyKind, tint = 0): Monster3D {
  const L = tint ? { ...LOOKS[kind], skin: new THREE.Color(LOOKS[kind].skin).lerp(new THREE.Color(tint), kind === 'boss' ? 0.35 : 0.6).getHex() } : LOOKS[kind];
  const group = new THREE.Group();
  const geos: THREE.BufferGeometry[] = [];
  const mats: THREE.MeshStandardMaterial[] = [];
  const basics: THREE.Material[] = [];
  const mat = (color: number, emissive = 0) => {
    const m = new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0.05, emissive, emissiveIntensity: 1 });
    m.userData.baseEmissive = new THREE.Color(emissive);
    mats.push(m);
    return m;
  };
  const geo = <T extends THREE.BufferGeometry>(g: T) => (geos.push(g), g);
  const mesh = (g: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0) => {
    const o = new THREE.Mesh(g, m);
    o.position.set(x, y, z);
    o.castShadow = true;
    return o;
  };
  const skin = mat(L.skin, L.emissive ?? 0);
  const cloth = mat(L.cloth);
  const eyeMat = new THREE.MeshBasicMaterial({ color: L.eye });
  basics.push(eyeMat);

  const legH = L.leg[1];
  const [tw, th, td] = L.torso;
  const hipY = legH;
  const shoulderY = hipY + th * 0.92;
  const headY = hipY + th + L.head * 0.85;

  // torso (cloth over skin), pelvis
  const torso = mesh(geo(new THREE.BoxGeometry(tw, th, td)), skin, 0, hipY + th / 2, 0);
  group.add(torso);
  group.add(mesh(geo(new THREE.BoxGeometry(tw * 1.04, th * 0.45, td * 1.06)), cloth, 0, hipY + th * 0.22, 0));
  if (kind === 'brute' || kind === 'boss') group.add(mesh(geo(new THREE.SphereGeometry(tw * 0.5, 12, 8)), skin, 0, hipY + th * 0.35, td * 0.22));

  // head with eyes
  const head = new THREE.Group();
  head.position.set(0, headY, 0);
  head.add(mesh(geo(new THREE.SphereGeometry(L.head, 14, 12)), skin));
  for (const sx of [-1, 1]) head.add(mesh(geo(new THREE.SphereGeometry(L.head * 0.16, 8, 6)), eyeMat, sx * L.head * 0.36, L.head * 0.1, L.head * 0.82));
  group.add(head);
  if (kind === 'grunt') {
    for (const sx of [-1, 1]) {
      const ear = mesh(geo(new THREE.ConeGeometry(0.07, 0.34, 6)), skin, sx * (L.head + 0.08), 0.05, 0);
      ear.rotation.z = -sx * 1.25;
      head.add(ear);
    }
  }
  if (kind === 'brute' || kind === 'boss') {
    const hornMat = mat(0xd9ccb0);
    const n = kind === 'boss' ? 4 : 2;
    for (let i = 0; i < n; i++) {
      const sx = i % 2 ? 1 : -1;
      const big = i < 2 ? 1 : 0.65;
      const horn = mesh(geo(new THREE.ConeGeometry(0.075 * big, 0.5 * big, 7)), hornMat, sx * L.head * (0.65 + (i >> 1) * 0.15), L.head * (0.7 + (i >> 1) * 0.25), 0);
      horn.rotation.z = -sx * (0.7 + (i >> 1) * 0.3);
      head.add(horn);
    }
  }
  if (kind === 'archer') {
    for (const sx of [-1, 1]) head.add(mesh(geo(new THREE.SphereGeometry(L.head * 0.2, 8, 6)), mat(0x050505), sx * L.head * 0.36, L.head * 0.1, L.head * 0.78));
  }

  // limbs pivot at the shoulder / hip so rotating them swings the whole limb
  const limb = (r: number, len: number, m: THREE.Material, x: number, y: number) => {
    const g = new THREE.Group();
    g.position.set(x, y, 0);
    g.add(mesh(geo(new THREE.CylinderGeometry(r, r * 0.85, len, 8)), m, 0, -len / 2, 0));
    group.add(g);
    return g;
  };
  const legL = limb(L.leg[0], legH, kind === 'archer' ? skin : cloth, -tw * 0.28, hipY);
  const legR = limb(L.leg[0], legH, kind === 'archer' ? skin : cloth, tw * 0.28, hipY);
  const armL = limb(L.arm[0], L.arm[1], skin, -(tw / 2 + L.arm[0] * 1.1), shoulderY);
  const armR = limb(L.arm[0], L.arm[1], skin, tw / 2 + L.arm[0] * 1.1, shoulderY);

  // weapons
  if (kind === 'grunt') {
    const club = mesh(geo(new THREE.CylinderGeometry(0.06, 0.12, 0.7, 8)), mat(0x5b4330), 0, -L.arm[1] - 0.12, 0.14);
    club.rotation.x = Math.PI / 2.4;
    armR.add(club);
  } else if (kind === 'archer') {
    const bow = mesh(geo(new THREE.TorusGeometry(0.42, 0.025, 6, 16, Math.PI)), mat(0x6a4a2a), 0, -L.arm[1], 0.18);
    bow.rotation.z = Math.PI / 2;
    armL.add(bow);
  } else if (kind === 'brute') {
    const club = mesh(geo(new THREE.CylinderGeometry(0.12, 0.26, 1.3, 8)), mat(0x4a3524), 0, -L.arm[1] - 0.3, 0.2);
    club.rotation.x = Math.PI / 2.6;
    armR.add(club);
  } else {
    const blade = mesh(geo(new THREE.BoxGeometry(0.14, 1.7, 0.36)), mat(0x2a2030, 0x70200c), 0, -L.arm[1] - 0.45, 0.25);
    blade.rotation.x = Math.PI / 2.5;
    armR.add(blade);
    for (const sx of [-1, 1]) {
      const wing = mesh(geo(new THREE.BoxGeometry(0.9, 1.1, 0.05)), mat(0x3c2150, 0x200a28), sx * 0.7, hipY + th * 0.85, -td * 0.7);
      wing.rotation.set(0, sx * 0.55, sx * -0.3);
      group.add(wing);
    }
  }

  const height = headY + L.head;
  const white = new THREE.Color(0xffffff);
  return {
    group,
    height,
    flash(v) {
      for (const m of mats) m.emissive.copy(m.userData.baseEmissive).lerp(white, v);
    },
    animate(walk, moving, attack, t) {
      const sw = Math.sin(walk) * 0.75 * moving;
      legL.rotation.x = sw;
      legR.rotation.x = -sw;
      armL.rotation.x = -sw * 0.8;
      armR.rotation.x = sw * 0.8;
      torso.position.y = hipY + th / 2 + Math.abs(Math.sin(walk)) * 0.05 * moving;
      head.rotation.z = Math.sin(t * 2.2) * 0.04;
      if (attack >= 0) {
        // wind up (0..0.45), strike (0.45..0.7), recover
        const windUp = attack < 0.45 ? attack / 0.45 : attack < 0.7 ? 1 : Math.max(0, 1 - (attack - 0.7) / 0.3);
        const striking = attack >= 0.45 && attack < 0.7;
        if (kind === 'archer') {
          armL.rotation.x = -1.5;
          armR.rotation.x = -1.2 - windUp * 0.7;
        } else {
          armR.rotation.x = striking ? 1.1 : -2.5 * windUp;
          armL.rotation.x = -1.1 * windUp;
        }
        group.rotation.x = striking ? 0.2 : -0.12 * windUp;
      } else group.rotation.x = 0;
    },
    dispose() {
      geos.forEach((g) => g.dispose());
      mats.forEach((m) => m.dispose());
      basics.forEach((m) => m.dispose());
    }
  };
}

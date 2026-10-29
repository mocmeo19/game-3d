import * as THREE from 'three';
import { batchStatic } from '../staticBatch';
import { boxGeometry, groundPlane, Materials } from '../scenery';
import {
  BULWARK, BULWARK_HEIGHT, CONTAINER_HEIGHT, CONTAINER_WIDTH, CONTAINERS, ContainerColor, HULL, PropBox, PROPS, SHIP_BOW_Z, SHIP_STERN_Z,
} from './cargoShipLayout';
import { corrugatedTexture, deckTexture, waveNormalTexture } from './shipTextures';

export interface CargoShipScene {
  group: THREE.Group;
  update(t: number): void;
}

const CONTAINER_TINT: Record<ContainerColor, number> = {
  red: 0xa33b2e, blue: 0x2e5d8c, green: 0x3d7448, orange: 0xc4702c, grey: 0x868c92, yellow: 0xc7a233, white: 0xd9d8d0,
};
const SEA_LEVEL = -3.2;
const HULL_BOTTOM = -8;
/** Paint line between the dark topsides and the red bottom, just above the sea. */
const BOOT_TOP = -2.6;
const DECK_LEVELS = [0, 3.6, 7.2];

/** Draws the cargo ship of `cargoShipLayout.ts` at sea: hull, deck, bulwarks, containers, bridge tower, crane and deck props. */
export function buildCargoShipScene(): CargoShipScene {
  const group = new THREE.Group();
  group.name = 'cargo-ship';
  const mats = new Materials();
  const corrugated = corrugatedTexture();
  const deck = deckTexture();
  const waves = waveNormalTexture();
  const paint = new Map<number, THREE.MeshStandardMaterial>();
  const painted = (color: number, roughness = 0.7, metalness = 0.25) => {
    const key = color * 10 + Math.round(roughness * 9);
    let m = paint.get(key);
    if (!m) paint.set(key, (m = new THREE.MeshStandardMaterial({ color, roughness, metalness })));
    return m;
  };
  const containerMats = new Map<ContainerColor, THREE.MeshStandardMaterial>();
  const containerMat = (color: ContainerColor) => {
    let m = containerMats.get(color);
    if (!m) containerMats.set(color, (m = new THREE.MeshStandardMaterial({ map: corrugated, color: CONTAINER_TINT[color], roughness: 0.62, metalness: 0.35 })));
    return m;
  };
  const deckMat = new THREE.MeshStandardMaterial({ map: deck, roughness: 0.82, metalness: 0.2 });
  const hullDark = painted(0x26313d, 0.6);
  const hullRed = painted(0x7b2b22, 0.7);
  const white = painted(0xe6e4dc, 0.55, 0.1);
  const glass = painted(0x1c2a36, 0.15, 0.6);
  const steel = painted(0x4a5056, 0.5, 0.6);
  const safety = painted(0xd9b12c, 0.6, 0.2);

  const add = (geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number, shadows = true) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.castShadow = shadows;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  };
  /** Box resting on y0 at (x, z), UVs in metres / tile. */
  const block = (x: number, y0: number, z: number, w: number, h: number, d: number, material: THREE.Material, tile = 2) =>
    add(boxGeometry(w, h, d, tile), material, x, y0 + h / 2, z);

  buildSea();
  buildHull();
  CONTAINERS.forEach((c) => buildContainer(c.x, c.z, c.length, c.tiers, c.color));
  PROPS.forEach(buildProp);
  buildDeckMarkings();
  batchStatic(group);
  return {
    group,
    update(t: number) {
      waves.offset.set(t * 0.012, t * 0.007);
    },
  };

  function buildSea() {
    const sea = new THREE.Mesh(
      new THREE.PlaneGeometry(2400, 2400).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0x1e4e6c, roughness: 0.32, metalness: 0.1, normalMap: waves, normalScale: new THREE.Vector2(0.3, 0.3) }),
    );
    waves.repeat.set(60, 60);
    sea.position.y = SEA_LEVEL;
    sea.receiveShadow = true;
    sea.userData.dynamic = true;
    group.add(sea);
  }

  function buildHull() {
    for (const s of HULL) {
      const len = s.z1 - s.z0;
      const z = (s.z0 + s.z1) / 2;
      const w = s.halfWidth * 2;
      block(0, BOOT_TOP, z, w, -BOOT_TOP - 0.02, len, hullDark);
      block(0, HULL_BOTTOM, z, w - 0.6, BOOT_TOP - HULL_BOTTOM, len, hullRed);
      add(groundPlane(w - BULWARK * 2, len, 4), deckMat, 0, 0.005, z, false);
      for (const side of [-1, 1]) {
        const x = side * (s.halfWidth - BULWARK / 2);
        block(x, 0, z, BULWARK, BULWARK_HEIGHT, len, hullDark);
        block(x, BULWARK_HEIGHT, z, BULWARK + 0.08, 0.08, len, white);
      }
    }
    // steps where the bow narrows, and the bow and stern ends
    for (let i = 0; i + 1 < HULL.length; i++) {
      const [a, b] = [HULL[i], HULL[i + 1]];
      const span = b.halfWidth - a.halfWidth;
      for (const side of [-1, 1]) {
        const x = side * (a.halfWidth + span / 2 - BULWARK / 2);
        block(x, 0, a.z1, span + BULWARK, BULWARK_HEIGHT, BULWARK, hullDark);
        block(x, BOOT_TOP, a.z1 + 0.01, span + BULWARK, -BOOT_TOP - 0.02, 0.02, hullDark);
      }
    }
    const bow = HULL[0].halfWidth * 2;
    const stern = HULL[HULL.length - 1].halfWidth * 2;
    block(0, 0, SHIP_BOW_Z + BULWARK / 2, bow, BULWARK_HEIGHT, BULWARK, hullDark);
    block(0, 0, SHIP_STERN_Z - BULWARK / 2, stern, BULWARK_HEIGHT, BULWARK, hullDark);
    block(0, BULWARK_HEIGHT, SHIP_STERN_Z - BULWARK / 2, stern, 0.08, BULWARK + 0.08, white);
  }

  function buildContainer(x: number, z: number, length: number, tiers: number, color: ContainerColor) {
    const material = containerMat(color);
    for (let tier = 0; tier < tiers; tier++) {
      const y0 = tier * CONTAINER_HEIGHT;
      block(x, y0 + 0.015, z, CONTAINER_WIDTH, CONTAINER_HEIGHT - 0.03, length, material, CONTAINER_HEIGHT);
      // door end: locking bars over the doors
      const doorZ = z + (tier % 2 ? 1 : -1) * (length / 2 + 0.03);
      for (const bar of [-0.85, -0.3, 0.3, 0.85]) block(x + bar, y0 + 0.12, doorZ, 0.05, CONTAINER_HEIGHT - 0.24, 0.05, steel);
    }
  }

  function buildProp(p: PropBox) {
    switch (p.kind) {
      case 'superstructure':
        return buildSuperstructure(p);
      case 'hatch':
        block(p.x, 0, p.z, p.w, p.h, p.d, painted(0x3c5a46, 0.75));
        block(p.x, p.h, p.z, p.w + 0.06, 0.04, 0.25, safety);
        return;
      case 'crane':
        return buildCrane(p);
      case 'deckhouse':
        block(p.x, 0, p.z, p.w, p.h, p.d, mats.get('plaster', 0xe6e4dc), 3);
        block(p.x, 0, p.z + p.d / 2 + 0.02, 1.1, 2.1, 0.06, steel);
        return;
      case 'winch':
        block(p.x, 0, p.z, p.w, 0.4, p.d, steel);
        add(new THREE.CylinderGeometry(0.45, 0.45, p.w * 0.8, 16).rotateZ(Math.PI / 2), painted(0x2d4f3a), p.x, 0.85, p.z);
        return;
      case 'mast':
        block(p.x, 0, p.z, p.w, p.h, p.d, painted(0xd9b12c, 0.6));
        block(p.x, p.h * 0.75, p.z, 6, 0.25, 0.25, painted(0xd9b12c, 0.6));
        return;
      case 'bollard':
        for (const dz of [-0.18, 0.18]) add(new THREE.CylinderGeometry(0.16, 0.18, p.h, 12), painted(0x22272c), p.x, p.h / 2, p.z + dz);
        return;
      case 'crate':
        block(p.x, 0, p.z, p.w, p.h, p.d, mats.get('wood', 0xb08a5c), 1.3);
        return;
    }
  }

  function buildSuperstructure(p: PropBox) {
    const front = p.z - p.d / 2;
    const wall = mats.get('plaster', 0xeceae2);
    block(p.x, 0, p.z, p.w, p.h, p.d, wall, 3);
    // a window row on each deck of the front, doors at the bottom
    for (const level of DECK_LEVELS) {
      for (let i = 0; i < 7; i++) {
        const x = p.x - p.w / 2 + 2.2 + i * ((p.w - 4.4) / 6);
        if (level === 0 && (i === 1 || i === 5)) block(x, 0, front - 0.03, 1.1, 2.1, 0.06, steel);
        else block(x, level + 1.3, front - 0.03, 1.2, 1, 0.06, glass);
      }
    }
    // the bridge: a wider deck with a band of windows and wings over the walkways
    const bridgeZ = front + 2.5;
    block(p.x, p.h, bridgeZ, 31.6, 0.35, 5, white);
    block(p.x, p.h + 0.35, bridgeZ, 22, 2.6, 5, wall, 3);
    block(p.x, p.h + 1.15, bridgeZ - 2.53, 21, 1.2, 0.06, glass);
    for (const side of [-1, 1]) block(side * 14, p.h + 0.35, bridgeZ, 3.6, 1.1, 5, white);
    // funnel with a company band, radar mast
    const funnelZ = p.z + 2;
    block(p.x, p.h, funnelZ, 4, 7, 4, white, 3);
    block(p.x, p.h + 4.8, funnelZ, 4.04, 1.2, 4.04, painted(0xa33b2e, 0.6));
    block(p.x, p.h + 7, funnelZ, 4.04, 0.5, 4.04, painted(0x1d1f22, 0.8));
    block(p.x + 6, p.h + 2.95, bridgeZ + 1, 0.25, 5, 0.25, steel);
    block(p.x + 6, p.h + 7.4, bridgeZ + 1, 3, 0.2, 0.4, steel);
    // lifeboats hanging over the side walkways
    for (const side of [-1, 1]) {
      const x = side * 13.6;
      add(new THREE.CapsuleGeometry(0.9, 5, 4, 12).rotateX(Math.PI / 2).scale(1, 0.8, 1), painted(0xe5622a, 0.55, 0.05), x, 4.6, p.z + 1.5);
      for (const dz of [-2.4, 2.4]) block(side * 12.3, 3.2, p.z + 1.5 + dz, 0.2, 2.6, 0.2, steel);
    }
  }

  function buildCrane(p: PropBox) {
    const yellow = painted(0xd9b12c, 0.55, 0.3);
    block(p.x, 0, p.z, p.w, p.h, p.d, yellow);
    block(p.x, p.h, p.z, 3, 2.6, 3.4, yellow);
    block(p.x + 0.8, p.h + 0.9, p.z - 1.72, 1.2, 1, 0.05, glass);
    // the jib rises from the cab out over the starboard containers, a hook hanging from its tip
    const jibLength = 14;
    const jibAngle = 0.55;
    const pivotY = p.h + 2;
    const jib = block(0, 0, 0, jibLength, 0.7, 0.7, yellow);
    jib.position.set(p.x + Math.cos(jibAngle) * jibLength / 2, pivotY + Math.sin(jibAngle) * jibLength / 2, p.z);
    jib.rotation.z = jibAngle;
    const tipX = p.x + Math.cos(jibAngle) * jibLength;
    const tipY = pivotY + Math.sin(jibAngle) * jibLength;
    const hookY = p.h + 1;
    block(tipX, hookY, p.z, 0.04, tipY - hookY, 0.04, steel);
    block(tipX, hookY - 0.4, p.z, 0.5, 0.4, 0.5, painted(0x22272c));
  }

  /** Yellow lines along the walkways, as painted on real decks. */
  function buildDeckMarkings() {
    const length = 70;
    for (const x of [-11.5, 11.5]) add(groundPlane(0.12, length, 1), safety, x, 0.012, 1, false);
  }
}

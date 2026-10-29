import { batchStatic } from './staticBatch';
import * as THREE from 'three';
import { Solid, Team, WORLD_LIMIT } from './rules';
import { P2 } from './nav';
import { radialTexture, TEAM_COLOR } from './models';
import { boxGeometry, buildGround, buildSky, fbm, groundPlane, Materials, Surface, terrainHeight } from './scenery';
import { buildVegetation, TreeSpot } from './vegetation';

export interface Arena {
  scene: THREE.Scene;
  /** Axis-aligned boxes that block movement, bullets and sight. */
  solids: Solid[];
  sun: THREE.DirectionalLight;
  /** Sky dome; hidden where a thick haze ends the view (see viewDistance.ts). */
  sky: THREE.Object3D;
  /** Unit vector toward the sun (the shadow light is kept along it, around the camera). */
  sunDir: THREE.Vector3;
  /** The town's meshes, shown only while its mode is played (see maps/arenaMaps.ts). */
  land: THREE.Group;
  spawns: Record<Team, { x: number; z: number; yaw: number }[]>;
  /** Middle of each team's spawn: its buy zone. */
  spawnCenter: Record<Team, P2>;
  /** Bot destinations: where attackers push to and where each side holds. */
  points: { attack: P2[]; hold: Record<Team, P2[]> };
  /** Floor spots inside buildings and in the open where loot can lie. */
  lootSpots: THREE.Vector3[];
  /** Footprints of buildings. */
  buildings: { minX: number; maxX: number; minZ: number; maxZ: number }[];
  update(t: number, camera?: THREE.Vector3): void;
  dispose(): void;
}

export const SPAWN_CENTER: Record<Team, P2> = { CT: { x: 0, z: 36 }, T: { x: 0, z: -76 } };

type Side = 'n' | 's' | 'e' | 'w';
interface Opening {
  /** Centre along the wall, from the wall's middle. */
  at: number;
  width: number;
  bottom: number;
  top: number;
}

export function buildArena(renderer: THREE.WebGLRenderer | null = null): Arena {
  const scene = new THREE.Scene();
  /** Everything of the town (the battle royale map); hidden while another map is played. */
  const land = new THREE.Group();
  land.name = 'town';
  scene.add(land);
  const mats = new Materials();
  const solids: Solid[] = [];
  const lootSpots: THREE.Vector3[] = [];
  const buildings: Arena['buildings'] = [];
  let seed = 781;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };

  // ── sky and light ──
  const { sun: sunDir, sky, envTarget } = buildSky(scene, renderer);
  scene.add(new THREE.HemisphereLight(0xcfe3ff, 0x5b5a44, 0.9));
  const sun = new THREE.DirectionalLight(0xfff1dc, 3.4);
  sun.position.copy(sunDir).multiplyScalar(60);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = sun.shadow.camera.bottom = -40;
  sun.shadow.camera.right = sun.shadow.camera.top = 40;
  sun.shadow.camera.far = 160;
  sun.shadow.normalBias = 0.035;
  sun.shadow.bias = -0.0004;
  scene.add(sun, sun.target);

  /** Textured box centred at x/z with its bottom at y0; optionally solid. */
  const block = (x: number, y0: number, z: number, w: number, h: number, d: number, surface: Surface, tint = 0xffffff, solid = true) => {
    const mesh = new THREE.Mesh(boxGeometry(w, h, d, mats.tile(surface)), mats.get(surface, tint));
    mesh.position.set(x, y0 + h / 2, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    land.add(mesh);
    if (solid) solids.push({ min: { x: x - w / 2, y: y0, z: z - d / 2 }, max: { x: x + w / 2, y: y0 + h, z: z + d / 2 } });
    return mesh;
  };
  const flat = (x: number, y: number, z: number, w: number, d: number, surface: Surface, tint = 0xffffff) => {
    const mesh = new THREE.Mesh(groundPlane(w, d, mats.tile(surface)), mats.get(surface, tint, 0.95));
    mesh.position.set(x, y, z);
    mesh.receiveShadow = true;
    land.add(mesh);
    return mesh;
  };

  /**
   * A wall from (x0, z0) to (x1, z1) (axis-aligned) with door / window openings: full-height pieces between openings,
   * sills under and lintels over them. Openings are real gaps for movement, bullets and sight.
   */
  const wall = (x0: number, z0: number, x1: number, z1: number, t: number, h: number, ops: Opening[], surface: Surface, tint: number) => {
    const alongX = Math.abs(x1 - x0) > Math.abs(z1 - z0);
    const len = alongX ? x1 - x0 : z1 - z0;
    const start = alongX ? x0 : z0;
    const piece = (a: number, b: number, y0: number, y1: number) => {
      if (b - a < 0.02 || y1 - y0 < 0.02) return;
      const c = start + (a + b) / 2;
      if (alongX) block(c, y0, z0, b - a, y1 - y0, t, surface, tint);
      else block(x0, y0, c, t, y1 - y0, b - a, surface, tint);
    };
    let cursor = 0;
    for (const o of [...ops].sort((p, q) => p.at - q.at)) {
      const a = len / 2 + o.at - o.width / 2;
      const b = a + o.width;
      piece(cursor, a, 0, h);
      piece(a, b, 0, o.bottom);
      piece(a, b, o.top, h);
      // timber frame: lintel and sill
      const c = start + (a + b) / 2;
      const ft = t + 0.06;
      if (alongX) {
        block(c, o.top - 0.08, z0, o.width + 0.16, 0.08, ft, 'wood', 0x9a7a5a, false);
        if (o.bottom > 0) block(c, o.bottom, z0, o.width + 0.16, 0.06, ft + 0.1, 'wood', 0x9a7a5a, false);
      } else {
        block(x0, o.top - 0.08, c, ft, 0.08, o.width + 0.16, 'wood', 0x9a7a5a, false);
        if (o.bottom > 0) block(x0, o.bottom, c, ft + 0.1, 0.06, o.width + 0.16, 'wood', 0x9a7a5a, false);
      }
      cursor = b;
    }
    piece(cursor, len, 0, h);
  };

  /** A house or warehouse: textured walls with openings, a floor, a ceiling that stops bullets, a roof. */
  const building = (cx: number, cz: number, w: number, d: number, opt: { h?: number; surface: Surface; tint?: number; door: Side; roof: 'gable' | 'flat'; partition?: boolean; big?: boolean }) => {
    const h = opt.h ?? 3.2;
    const t = 0.25;
    const tint = opt.tint ?? 0xffffff;
    const doorW = opt.big ? 3.2 : 1.3;
    const doorTop = opt.big ? 3.4 : 2.25;
    const winTop = Math.min(h - 0.5, 2.2);
    const ops: Record<Side, Opening[]> = { n: [], s: [], e: [], w: [] };
    (['n', 's', 'e', 'w'] as Side[]).forEach((s) => {
      const L = s === 'n' || s === 's' ? w : d;
      if (s === opt.door) {
        ops[s].push({ at: 0, width: doorW, bottom: 0, top: doorTop });
        if (L > 9) ops[s].push({ at: L * 0.3, width: 1.4, bottom: 1.0, top: winTop }, { at: -L * 0.3, width: 1.4, bottom: 1.0, top: winTop });
      } else {
        const n = L > 9 ? 2 : 1;
        for (let i = 0; i < n; i++) ops[s].push({ at: n === 1 ? (rnd() - 0.5) * 2 : (i ? 1 : -1) * L * 0.25, width: 1.3, bottom: opt.big ? 2.2 : 1.0, top: opt.big ? h - 0.6 : winTop });
      }
    });
    const x0 = cx - w / 2;
    const x1 = cx + w / 2;
    const z0 = cz - d / 2;
    const z1 = cz + d / 2;
    wall(x0, z0 + t / 2, x1, z0 + t / 2, t, h, ops.n, opt.surface, tint);
    wall(x0, z1 - t / 2, x1, z1 - t / 2, t, h, ops.s, opt.surface, tint);
    wall(x0 + t / 2, z0 + t, x0 + t / 2, z1 - t, t, h, ops.w, opt.surface, tint);
    wall(x1 - t / 2, z0 + t, x1 - t / 2, z1 - t, t, h, ops.e, opt.surface, tint);
    flat(cx, 0.02, cz, w - t * 2, d - t * 2, opt.big ? 'asphalt' : 'wood', opt.big ? 0xb8b8b8 : 0xffffff);
    if (opt.partition) {
      // an inner wall with a doorway splits the house into two rooms
      const px = cx + w * 0.12;
      wall(px, z0 + t, px, z1 - t, 0.15, h, [{ at: d * 0.18, width: 1.1, bottom: 0, top: 2.15 }], 'plaster', 0xe9e2d6);
    }
    // ceiling: stops bullets and grenades
    block(cx, h, cz, w, 0.2, d, 'plaster', 0xd8d2c6);
    if (opt.roof === 'gable') {
      const rise = Math.min(2.2, d * 0.32);
      const run = d / 2 + 0.5;
      const ang = Math.atan2(rise, run);
      for (const side of [-1, 1]) {
        const r = new THREE.Mesh(boxGeometry(w + 0.8, 0.14, Math.hypot(run, rise), mats.tile('roof')), mats.get('roof'));
        r.rotation.x = side * ang;
        r.position.set(cx, h + 0.2 + rise / 2, cz + (side * run) / 2);
        r.castShadow = true;
        r.receiveShadow = true;
        land.add(r);
      }
      // gable ends
      const tri = new THREE.Shape([new THREE.Vector2(-d / 2, 0), new THREE.Vector2(d / 2, 0), new THREE.Vector2(0, rise)]);
      const gable = new THREE.ExtrudeGeometry(tri, { depth: t, bevelEnabled: false });
      const uv = gable.getAttribute('uv') as THREE.BufferAttribute;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / mats.tile(opt.surface), uv.getY(i) / mats.tile(opt.surface));
      for (const ex of [x0, x1 - t]) {
        const gm = new THREE.Mesh(gable, mats.get(opt.surface, tint));
        gm.rotation.y = Math.PI / 2;
        gm.position.set(ex + t, h + 0.2, cz);
        gm.castShadow = true;
        land.add(gm);
      }
    } else {
      // flat roof with a low parapet
      for (const [px, pz, pw, pd] of [[cx, z0, w, 0.25], [cx, z1, w, 0.25], [x0, cz, 0.25, d], [x1, cz, 0.25, d]]) block(px, h + 0.2, pz, pw, 0.5, pd, opt.surface, tint, false);
    }
    buildings.push({ minX: x0, maxX: x1, minZ: z0, maxZ: z1 });
    // loot lies in the room corners and the middle
    for (const [fx, fz] of [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75], [0.5, 0.5]]) lootSpots.push(new THREE.Vector3(x0 + w * fx, 0.05, z0 + d * fz));
  };

  // ── buildings ── (the first seven stand where the CS shelters were, doors toward +z)
  const houses: [number, number, Surface, number][] = [
    [-19, -12, 'brick', 0xffffff], [22, -17, 'plaster', 0xf0e6cf], [-27, -48, 'plaster', 0xdfe6e0], [32, 24, 'brick', 0xe8d8d0],
    [-35, 35, 'plaster', 0xf2dcc0], [40, -58, 'brick', 0xffffff], [60, 53, 'plaster', 0xe0e8f0]
  ];
  houses.forEach(([x, z, surface, tint]) => building(x, z, 12, 10, { surface, tint, door: 's', roof: 'gable', partition: true }));
  // Low spawn-front barriers with firing windows: openings are real gaps through
  // the wall, while the raised sills keep players from walking straight through.
  for (const [z, tint] of [[49, 0xd5d0c5], [-89, 0xb7b9b8]] as const) {
    wall(-13, z, 13, z, 0.6, 3.2, [
      { at: -8, width: 2.5, bottom: 1.05, top: 2.45 },
      { at: 0, width: 2.5, bottom: 1.05, top: 2.45 },
      { at: 8, width: 2.5, bottom: 1.05, top: 2.45 }
    ], 'plaster', tint);
  }
  building(-70, -80, 11, 9, { surface: 'brick', door: 'e', roof: 'gable', partition: true });
  building(72, -85, 11, 9, { surface: 'plaster', tint: 0xe8e0d0, door: 'w', roof: 'gable', partition: true });
  building(-78, 72, 11, 9, { surface: 'brick', tint: 0xe0d0c8, door: 'n', roof: 'gable', partition: true });
  building(86, 12, 10, 9, { surface: 'plaster', tint: 0xd8e4dc, door: 'w', roof: 'gable' });
  building(-88, -6, 10, 9, { surface: 'brick', door: 'e', roof: 'gable' });
  building(45, 88, 11, 9, { surface: 'plaster', tint: 0xf0dcc8, door: 'n', roof: 'gable', partition: true });
  building(-40, 90, 11, 9, { surface: 'brick', door: 'n', roof: 'gable', partition: true });
  building(68, -26, 18, 12, { h: 5, surface: 'plaster', tint: 0xb9bfc4, door: 'w', roof: 'flat', big: true });
  building(-66, -36, 18, 12, { h: 5, surface: 'plaster', tint: 0xc4b9a8, door: 'e', roof: 'flat', big: true });
  building(92, -52, 6, 5, { h: 2.8, surface: 'wood', tint: 0xb08c6a, door: 'w', roof: 'gable' });
  building(-93, 42, 6, 5, { h: 2.8, surface: 'wood', tint: 0xb08c6a, door: 'e', roof: 'gable' });
  building(22, -94, 6, 5, { h: 2.8, surface: 'wood', tint: 0xa88468, door: 'n', roof: 'gable' });

  // Eight small settlements give the expanded survival map landmarks and loot
  // beyond the original central arena.
  const districts = Array.from({ length: 8 }, (_, i) => {
    const angle = (i / 8) * Math.PI * 2 + Math.PI / 8;
    return { x: Math.cos(angle) * 220, z: Math.sin(angle) * 220, angle };
  });
  districts.forEach(({ x, z }, i) => {
    const surface: Surface = i % 2 ? 'brick' : 'plaster';
    for (const [dx, dz, door] of [[-13, -10, 's'], [12, -12, 'e'], [-14, 12, 'w'], [13, 13, 'n'] ] as [number, number, Side][]) {
      building(x + dx, z + dz, 10, 9, { surface, tint: i % 2 ? 0xd8c7b7 : 0xdfe6dc, door, roof: 'gable', partition: true });
    }
    building(x, z, 16, 12, { h: 4.5, surface: 'plaster', tint: 0xb9bfc4, door: 's', roof: 'flat', big: true });
  });

  // ── roads ──
  flat(0, 0.015, 0, 10, WORLD_LIMIT * 2 + 40, 'asphalt');
  flat(0, 0.018, -27, WORLD_LIMIT * 2 + 40, 8, 'asphalt');
  const lineMat = new THREE.MeshStandardMaterial({ color: 0xe8e2cc, roughness: 0.7 });
  const lineGeo = new THREE.PlaneGeometry(0.14, 3);
  for (let z = -WORLD_LIMIT; z < WORLD_LIMIT; z += 6) {
    if (Math.abs(z + 27) < 5) continue;
    const dash = new THREE.Mesh(lineGeo, lineMat);
    dash.rotation.x = -Math.PI / 2;
    dash.position.set(0, 0.025, z);
    land.add(dash);
  }
  const dirtRoads: [number, number, number, number][] = [
    [-5, 2, -60, 2], [-60, 2, -88, -6], [5, -60, 72, -85], [-5, -60, -70, -80], [5, 30, 60, 53], [60, 53, 86, 12], [-5, 60, -78, 72], [-35, 35, -40, 90],
    [5, 70, 45, 88], [-27, -48, -66, -36], [22, -17, 68, -26]
  ];
  const segDist = (x: number, z: number, [ax, az, bx, bz]: [number, number, number, number]) => {
    const dx = bx - ax;
    const dz = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
    return Math.hypot(x - (ax + dx * t), z - (az + dz * t));
  };
  const onRoad = (x: number, z: number) => Math.abs(x) < 6 || Math.abs(z + 27) < 5;
  const inBuilding = (x: number, z: number, pad: number) => buildings.some((b) => x > b.minX - pad && x < b.maxX + pad && z > b.minZ - pad && z < b.maxZ + pad);
  const dirtAt = (x: number, z: number) => {
    let d = 0;
    for (const r of dirtRoads) d = Math.max(d, 1 - segDist(x, z, r) / 2.6);
    for (const b of buildings) {
      const ex = Math.max(b.minX - x, 0, x - b.maxX);
      const ez = Math.max(b.minZ - z, 0, z - b.maxZ);
      d = Math.max(d, 0.85 - Math.hypot(ex, ez) / 3.5);
    }
    for (const s of Object.values(SPAWN_CENTER)) d = Math.max(d, 0.7 - Math.hypot(x - s.x, z - s.z) / 22);
    if (Math.abs(x) < 7.5 || Math.abs(z + 27) < 6.5) d = Math.max(d, 0.9);
    return Math.max(0, d);
  };
  land.add(buildGround(mats, WORLD_LIMIT, dirtAt));

  // ── mid cover: crates (1.2 m, jumpable), concrete walls to crouch behind, barriers on the road ──
  const crate = (x: number, z: number, stack = 1) => {
    for (let i = 0; i < stack; i++) block(x, i * 1.2, z, 1.2, 1.2, 1.2, 'wood', i % 2 ? 0xc8a070 : 0xb08860);
  };
  const concrete = (x: number, z: number, w: number, d: number, h = 1.1) => block(x, 0, z, w, h, d, 'plaster', 0xa9a9a2);
  [[5, -18, 2], [-7, -33, 1], [13, -36, 2], [-15, -24, 1], [-4, -8, 1], [9, 4, 1], [-11, 12, 2], [24, -40, 1], [-26, -30, 1], [3, -52, 2], [-12, -60, 1], [18, -6, 1]].forEach(([x, z, s]) => crate(x, z, s));
  concrete(-3, -20, 5, 0.5);
  concrete(8, -30, 0.5, 5);
  concrete(-20, 2, 6, 0.5);
  concrete(18, 8, 6, 0.5);
  concrete(-8, -46, 6, 0.5);
  concrete(14, -50, 0.5, 6);
  // break the straight spawn-to-spawn sight line down the road
  concrete(0, 19, 14, 0.6, 3);
  concrete(0, -60, 14, 0.6, 3);
  // shipping containers
  const container = (x: number, z: number, alongX: boolean, tint: number) => block(x, 0, z, alongX ? 6 : 2.4, 2.6, alongX ? 2.4 : 6, 'plaster', tint);
  container(0, -24, false, 0x8a5a44);
  container(30, -4, true, 0x4f6f86);
  container(-30, -14, true, 0x6d7a4c);
  block(0, 0, -40, 3, 2.2, 1.2, 'plaster', 0x9a9a92);

  // wrecked cars by the roads
  const tyreMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x1d2a33, roughness: 0.1, metalness: 0.6 });
  const car = (x: number, z: number, alongX: boolean, tint: number) => {
    const g = new THREE.Group();
    const paint = new THREE.MeshStandardMaterial({ color: tint, roughness: 0.55, metalness: 0.4 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.75, 1.8), paint);
    body.position.y = 0.65;
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.62, 1.62), paint);
    cabin.position.set(-0.2, 1.33, 0);
    const glass = new THREE.Mesh(new THREE.BoxGeometry(2.14, 0.42, 1.5), glassMat);
    glass.position.set(-0.2, 1.35, 0);
    const under = new THREE.Mesh(new THREE.BoxGeometry(4.0, 0.25, 1.7), mats.get('rock', 0x8a5a3a));
    under.position.y = 0.3;
    g.add(body, cabin, glass, under);
    for (const [wx, wz] of [[1.35, 0.85], [-1.35, 0.85], [1.35, -0.85], [-1.35, -0.85]]) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.26, 14), tyreMat);
      wheel.rotation.x = Math.PI / 2;
      wheel.position.set(wx, 0.36, wz);
      g.add(wheel);
    }
    g.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    g.position.set(x, 0, z);
    if (!alongX) g.rotation.y = Math.PI / 2;
    land.add(g);
    const hw = alongX ? 2.1 : 0.9;
    const hd = alongX ? 0.9 : 2.1;
    solids.push({ min: { x: x - hw, y: 0, z: z - hd }, max: { x: x + hw, y: 1.6, z: z + hd } });
  };
  car(7.5, -10, false, 0x7d2b24);
  car(-7.5, 52, false, 0x2f4d63);
  car(7, -92, false, 0xc9c2b0);
  car(32, -21.5, true, 0x4b5a3a);
  car(-52, -32.5, true, 0x8f8a7c);

  // fences around a few yards
  const fence = (ax: number, az: number, bx: number, bz: number) => {
    const len = Math.hypot(bx - ax, bz - az);
    const alongX = Math.abs(bx - ax) > Math.abs(bz - az);
    for (let s = 0; s <= len; s += 2.4) {
      const t = s / len;
      block(ax + (bx - ax) * t, 0, az + (bz - az) * t, 0.12, 1.15, 0.12, 'wood', 0x9a7e60, false);
    }
    for (const y of [0.45, 0.9]) block((ax + bx) / 2, y, (az + bz) / 2, alongX ? len : 0.06, 0.12, alongX ? 0.06 : len, 'wood', 0xa88a6a, false);
    solids.push({ min: { x: Math.min(ax, bx) - 0.06, y: 0, z: Math.min(az, bz) - 0.06 }, max: { x: Math.max(ax, bx) + 0.06, y: 1.1, z: Math.max(az, bz) + 0.06 } });
  };
  fence(-43, 26, -27, 26);
  fence(-43, 26, -43, 30);
  fence(52, 44, 52, 48);
  fence(52, 44, 68, 44);
  fence(-78, -88, -62, -88);
  fence(64, -93, 80, -93);

  // barrels
  const barrelMat = new THREE.MeshStandardMaterial({ color: 0x4d6a4a, roughness: 0.6, metalness: 0.5 });
  const barrelGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.9, 14);
  for (const [x, z] of [[-10, -17], [-9.2, -16.4], [27, -10], [26.4, -10.8], [-30, -40], [45, -50], [44.4, -50.7], [62, -18], [-60, -28], [-59.3, -28.8]]) {
    const b = new THREE.Mesh(barrelGeo, barrelMat);
    b.position.set(x, 0.45, z);
    b.castShadow = true;
    b.receiveShadow = true;
    land.add(b);
    solids.push({ min: { x: x - 0.3, y: 0, z: z - 0.3 }, max: { x: x + 0.3, y: 0.9, z: z + 0.3 } });
  }

  // boulders
  const nearSpawn = (x: number, z: number, r = 15) => Object.values(SPAWN_CENTER).some((s) => Math.hypot(x - s.x, z - s.z) < r);
  const blocked = (x: number, z: number, pad: number) => solids.some((s) => x > s.min.x - pad && x < s.max.x + pad && z > s.min.z - pad && z < s.max.z + pad);
  for (let i = 0, made = 0; i < 200 && made < 26; i++) {
    const x = (rnd() - 0.5) * 200;
    const z = (rnd() - 0.5) * 200;
    if (onRoad(x, z) || nearSpawn(x, z) || inBuilding(x, z, 4) || blocked(x, z, 4)) continue;
    const r = 0.7 + rnd() * 1.3;
    const geo = new THREE.IcosahedronGeometry(r, 2);
    const p = geo.getAttribute('position') as THREE.BufferAttribute;
    const v = new THREE.Vector3();
    for (let k = 0; k < p.count; k++) {
      v.set(p.getX(k), p.getY(k), p.getZ(k));
      v.multiplyScalar(0.78 + fbm(v.x * 1.7 + i, v.z * 1.7, v.y * 1.7) * 0.45);
      p.setXYZ(k, v.x, v.y * 0.65, v.z);
    }
    geo.computeVertexNormals();
    const rock = new THREE.Mesh(geo, mats.get('rock', 0xd0ccc4));
    rock.position.set(x, r * 0.25, z);
    rock.rotation.y = rnd() * 6;
    rock.castShadow = true;
    rock.receiveShadow = true;
    land.add(rock);
    const half = r * 0.72;
    solids.push({ min: { x: x - half, y: 0, z: z - half }, max: { x: x + half, y: r * 0.85, z: z + half } });
    made++;
  }

  // ── trees and grass ──
  const noise01 = () => rnd();
  const trees: TreeSpot[] = [];
  for (let i = 0; i < 420 && trees.length < 120; i++) {
    const x = (rnd() - 0.5) * 210;
    const z = (rnd() - 0.5) * 210;
    if (onRoad(x, z) || Math.abs(x) < 9 || nearSpawn(x, z) || inBuilding(x, z, 5) || blocked(x, z, 5) || dirtAt(x, z) > 0.4) continue;
    const kind = fbm(x * 0.02, z * 0.02, 5) > 0.55 ? 'pine' : 'oak';
    trees.push({ x, z, kind, scale: 0.8 + rnd() * 0.5, rot: rnd() * Math.PI * 2 });
    solids.push({ min: { x: x - 0.28, y: 0, z: z - 0.28 }, max: { x: x + 0.28, y: 4, z: z + 0.28 } });
  }
  // a forest on the hills beyond the fence, standing on the terrain
  for (let i = 0; i < 800; i++) {
    const a = rnd() * Math.PI * 2;
    const r = WORLD_LIMIT + 15 + rnd() * 65;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    if (Math.max(Math.abs(x), Math.abs(z)) < WORLD_LIMIT + 10) continue;
    trees.push({ x, z, y: terrainHeight(x, z, WORLD_LIMIT) - 0.3, kind: rnd() < 0.65 ? 'pine' : 'oak', scale: 1 + rnd() * 0.6, rot: rnd() * 6 });
  }
  const vegetation = buildVegetation(
    trees,
    { area: WORLD_LIMIT, count: 120000, accept: (x, z) => !onRoad(x, z) && !inBuilding(x, z, 0.6) && !blocked(x, z, 0.4) && dirtAt(x, z) < 0.45 && fbm(x * 0.05, z * 0.05, 3) > 0.22 + noise01() * 0.35 },
    mats.get('rock', 0x6e5a48)
  );
  land.add(vegetation.group);

  // perimeter fence along the play-area edge (the edge itself is enforced by WORLD_LIMIT)
  const fenceSteps = Math.ceil(WORLD_LIMIT * 2 / 4);
  const posts = new THREE.InstancedMesh(new THREE.BoxGeometry(0.14, 1.3, 0.14), mats.get('wood', 0x8a6e50), 4 * (fenceSteps + 1));
  let pi = 0;
  const m4 = new THREE.Matrix4();
  for (let k = 0; k <= fenceSteps; k++) {
    const v = -WORLD_LIMIT + (k / fenceSteps) * WORLD_LIMIT * 2;
    for (const [x, z] of [[v, -WORLD_LIMIT], [v, WORLD_LIMIT], [-WORLD_LIMIT, v], [WORLD_LIMIT, v]]) posts.setMatrixAt(pi++, m4.makeTranslation(x, 0.65, z));
  }
  posts.castShadow = true;
  land.add(posts);
  for (const [x, z, w, d] of [[0, -WORLD_LIMIT, WORLD_LIMIT * 2, 0.06], [0, WORLD_LIMIT, WORLD_LIMIT * 2, 0.06], [-WORLD_LIMIT, 0, 0.06, WORLD_LIMIT * 2], [WORLD_LIMIT, 0, 0.06, WORLD_LIMIT * 2]])
    for (const y of [0.5, 1.0]) block(x, y, z, w, 0.1, d, 'wood', 0x9a7e60, false);

  // outdoor loot along the roads and near cover
  for (let i = 0; i < 1200 && lootSpots.length < 420; i++) {
    const x = (rnd() * 2 - 1) * (WORLD_LIMIT - 10);
    const z = (rnd() * 2 - 1) * (WORLD_LIMIT - 10);
    if (inBuilding(x, z, 0.5) || blocked(x, z, 0.6) || nearSpawn(x, z, 10)) continue;
    lootSpots.push(new THREE.Vector3(x, 0.05, z));
  }

  // spawn pads mark the buy zones
  const spawns: Arena['spawns'] = { CT: [], T: [] };
  const ringTex = radialTexture([[0, 'rgba(255,255,255,0)'], [0.86, 'rgba(255,255,255,0.05)'], [0.97, 'rgba(255,255,255,0.35)'], [1, 'rgba(255,255,255,0)']], 256);
  (['CT', 'T'] as Team[]).forEach((team) => {
    const c = SPAWN_CENTER[team];
    const pad = new THREE.Mesh(new THREE.CircleGeometry(16, 48), new THREE.MeshBasicMaterial({ map: ringTex, color: TEAM_COLOR[team], transparent: true, depthWrite: false }));
    pad.rotation.x = -Math.PI / 2;
    pad.position.set(c.x, 0.04, c.z);
    land.add(pad);
    for (let i = 0; i < 5; i++) spawns[team].push({ x: c.x - 6 + i * 3, z: c.z + (i % 2) * 2 * (team === 'CT' ? 1 : -1), yaw: team === 'CT' ? 0 : Math.PI });
  });

  batchStatic(land);

  return {
    scene,
    land,
    solids,
    sun,
    sky,
    sunDir,
    spawns,
    spawnCenter: SPAWN_CENTER,
    lootSpots,
    buildings,
    points: {
      attack: [{ x: 0, z: -22 }, { x: -24, z: -20 }, { x: 26, z: -28 }, { x: -14, z: 4 }, { x: 14, z: 0 }, { x: -28, z: 18 }, { x: 24, z: 16 }, { x: 0, z: -50 }],
      hold: {
        CT: [{ x: -8, z: 14 }, { x: 10, z: 10 }, { x: -22, z: 4 }, { x: 22, z: 4 }, { x: 0, z: 2 }, { x: -11, z: 15 }],
        T: [{ x: -10, z: -56 }, { x: 12, z: -56 }, { x: 0, z: -44 }, { x: -24, z: -44 }, { x: 26, z: -46 }]
      }
    },
    update(t: number, camera?: THREE.Vector3) {
      vegetation.update(t, camera);
    },
    dispose() {
      envTarget?.dispose();
    }
  };
}

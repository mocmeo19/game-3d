import * as THREE from 'three';
import { naturePack, Prop } from './naturePack';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Camp, generateCamps, VILLAGE_R, WORLD_HALF, ZONES, ZONE_ORDER, zoneAt, ZoneId, zoneDistance } from './torchWorld';

/**
 * The open world of the Torchlight mode: a ground painted by zone, a village with a forge and a healing fountain, camps marked on
 * the ground, and trees, rocks and spires that differ from zone to zone. Scenery is instanced in map tiles so only what is near the
 * camera is drawn; trees and rocks are obstacles on a grid so collisions stay cheap.
 */

export interface Obstacle {
  x: number;
  z: number;
  r: number;
}

/** Where the hero uses the forge and the fountain. */
export const FORGE = { x: -9, z: -7 };
export const FOUNTAIN = { x: 8, z: -5 };
export const TOWN_REACH = 4.5;

/** The world edge: the hero cannot go past it. */
export const BOUND = WORLD_HALF - 1.5;

const EXTENT = WORLD_HALF + 20;
const TILE = 40;

const rng = (seed: number) => () => {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
};

/* ───────────────────────── obstacle grid ───────────────────────── */

class ObstacleGrid {
  private readonly cell = 8;
  private readonly cells = new Map<number, Obstacle[]>();
  readonly all: Obstacle[] = [];
  private key(i: number, j: number) {
    return (i + 100) * 1000 + (j + 100);
  }
  add(o: Obstacle) {
    this.all.push(o);
    const i0 = Math.floor((o.x - o.r) / this.cell);
    const i1 = Math.floor((o.x + o.r) / this.cell);
    const j0 = Math.floor((o.z - o.r) / this.cell);
    const j1 = Math.floor((o.z + o.r) / this.cell);
    for (let i = i0; i <= i1; i++)
      for (let j = j0; j <= j1; j++) {
        const k = this.key(i, j);
        const l = this.cells.get(k);
        if (l) l.push(o);
        else this.cells.set(k, [o]);
      }
  }
  /** Push `p` out of every obstacle nearer than its radius. */
  resolve(p: THREE.Vector3, radius: number) {
    const i0 = Math.floor((p.x - radius) / this.cell);
    const i1 = Math.floor((p.x + radius) / this.cell);
    const j0 = Math.floor((p.z - radius) / this.cell);
    const j1 = Math.floor((p.z + radius) / this.cell);
    for (let i = i0; i <= i1; i++)
      for (let j = j0; j <= j1; j++) {
        const l = this.cells.get(this.key(i, j));
        if (!l) continue;
        for (const o of l) {
          const dx = p.x - o.x;
          const dz = p.z - o.z;
          const min = o.r + radius;
          const d2 = dx * dx + dz * dz;
          if (d2 < min * min) {
            const d = Math.sqrt(d2) || 0.001;
            p.x = o.x + (dx / d) * min;
            p.z = o.z + (dz / d) * min;
          }
        }
      }
  }
  /** Is a point inside an obstacle (for projectiles and for choosing spawn spots)? */
  hits(x: number, z: number, shrink = 1): boolean {
    const l = this.cells.get(this.key(Math.floor(x / this.cell), Math.floor(z / this.cell)));
    if (!l) return false;
    for (const o of l) if (Math.hypot(o.x - x, o.z - z) < o.r * shrink) return true;
    return false;
  }
}

/* ───────────────────────── ground ───────────────────────── */

const hash = (x: number, y: number) => {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
};
const smooth = (t: number) => t * t * (3 - 2 * t);
const vnoise = (x: number, y: number) => {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = smooth(x - xi);
  const yf = smooth(y - yi);
  const a = hash(xi, yi);
  const b = hash(xi + 1, yi);
  const c = hash(xi, yi + 1);
  const d = hash(xi + 1, yi + 1);
  return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
};
const fbm = (x: number, y: number) => vnoise(x, y) * 0.55 + vnoise(x * 2.1, y * 2.1) * 0.3 + vnoise(x * 4.3, y * 4.3) * 0.15;

const parse = (hex: string): [number, number, number] => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
const GROUND = ZONE_ORDER.map((id) => parse(ZONES[id].ground));
const DIRT: [number, number, number] = [138, 112, 74];
const COBBLE: [number, number, number] = [150, 140, 122];
/** Roads leave the village in these directions and reach the swamp. */
const ROADS = [0.35, 1.9, 3.5, 5.1];

/** The ground colour of a spot: the zone's colour with blended borders, noise, roads and the village's cobbles. */
function groundColor(x: number, z: number, out: [number, number, number]) {
  const d = zoneDistance(x, z);
  let zi = ZONE_ORDER.length - 1;
  for (let i = 0; i < ZONE_ORDER.length; i++) {
    if (d < ZONES[ZONE_ORDER[i]].rOut) {
      zi = i;
      break;
    }
  }
  const c = GROUND[zi];
  // blend into the next zone across the last 7 m of this one, and from the previous one across the first 7 m
  const zone = ZONES[ZONE_ORDER[zi]];
  const toNext = zone.rOut - d;
  const fromPrev = d - zone.rIn;
  let r = c[0];
  let g = c[1];
  let b = c[2];
  if (zi < ZONE_ORDER.length - 1 && toNext < 7) {
    const k = 0.5 * (1 - toNext / 7);
    const n = GROUND[zi + 1];
    r += (n[0] - r) * k;
    g += (n[1] - g) * k;
    b += (n[2] - b) * k;
  } else if (zi > 0 && fromPrev < 7) {
    const k = 0.5 * (1 - fromPrev / 7);
    const n = GROUND[zi - 1];
    r += (n[0] - r) * k;
    g += (n[1] - g) * k;
    b += (n[2] - b) * k;
  }
  const big = fbm(x * 0.07 + 31, z * 0.07 + 7);
  const fine = vnoise(x * 1.1, z * 1.1);
  let shade = 0.82 + big * 0.32 + (fine - 0.5) * 0.1;
  // roads
  if (d > VILLAGE_R - 3 && d < 140) {
    const a = Math.atan2(z, x);
    for (const ra of ROADS) {
      let da = Math.atan2(Math.sin(a - ra), Math.cos(a - ra));
      // the road wobbles a little
      da += Math.sin(d * 0.07 + ra * 5) * 0.025;
      const lateral = Math.abs(da) * Math.hypot(x, z);
      if (lateral < 2.8) {
        const k = Math.max(0, 1 - lateral / 2.8);
        const t = Math.min(1, k * 2.2) * (d > 130 ? (140 - d) / 10 : 1);
        r += (DIRT[0] - r) * t * 0.85;
        g += (DIRT[1] - g) * t * 0.85;
        b += (DIRT[2] - b) * t * 0.85;
        shade *= 1 - t * 0.08;
      }
    }
  }
  // the village square: cobbles in a pattern
  if (d < VILLAGE_R) {
    const edge = Math.min(1, (VILLAGE_R - d) / 3);
    const stone = hash(Math.floor(x * 1.6), Math.floor(z * 1.6));
    const gap = (x * 1.6) % 1 < 0.08 || (z * 1.6) % 1 < 0.08 ? 0.72 : 1;
    r += (COBBLE[0] * (0.82 + stone * 0.3) * gap - r) * edge;
    g += (COBBLE[1] * (0.82 + stone * 0.3) * gap - g) * edge;
    b += (COBBLE[2] * (0.82 + stone * 0.3) * gap - b) * edge;
    shade = 1;
  }
  out[0] = Math.max(0, Math.min(255, r * shade));
  out[1] = Math.max(0, Math.min(255, g * shade));
  out[2] = Math.max(0, Math.min(255, b * shade));
}

/** The village square: real cobblestones (rounded stones with mortar, moss at the edge), fading into the ground around it. */
function villageTexture(size: number, radius: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  const px = size / (radius * 2); // pixels per metre
  const r = rng(1213);
  g.fillStyle = '#4a4034';
  g.fillRect(0, 0, size, size);
  const cell = 0.55;
  const n = Math.ceil((radius * 2) / cell) + 1;
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) {
      const x = (i + 0.5 + (r() - 0.5) * 0.35) * cell * px;
      const y = (j + 0.5 + (r() - 0.5) * 0.35) * cell * px;
      const w = cell * px * (0.9 + r() * 0.12);
      const h = cell * px * (0.86 + r() * 0.14);
      const rot = (r() - 0.5) * 0.5;
      const l = 44 + r() * 20;
      const hue = 34 + r() * 14;
      g.save();
      g.translate(x, y);
      g.rotate(rot);
      const rad = Math.min(w, h) * 0.3;
      const path = () => {
        g.beginPath();
        g.moveTo(-w / 2 + rad, -h / 2);
        g.arcTo(w / 2, -h / 2, w / 2, h / 2, rad);
        g.arcTo(w / 2, h / 2, -w / 2, h / 2, rad);
        g.arcTo(-w / 2, h / 2, -w / 2, -h / 2, rad);
        g.arcTo(-w / 2, -h / 2, w / 2, -h / 2, rad);
        g.closePath();
      };
      path();
      const grad = g.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2);
      grad.addColorStop(0, `hsl(${hue} 14% ${l + 9}%)`);
      grad.addColorStop(1, `hsl(${hue} 14% ${l - 7}%)`);
      g.fillStyle = grad;
      g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.28)';
      g.lineWidth = Math.max(1, px * 0.03);
      g.stroke();
      // a few specks of wear
      for (let k = 0; k < 5; k++) {
        g.fillStyle = `rgba(${r() < 0.5 ? '255,255,255' : '0,0,0'},${0.04 + r() * 0.06})`;
        g.fillRect((r() - 0.5) * w * 0.8, (r() - 0.5) * h * 0.8, 1 + r() * 3, 1 + r() * 3);
      }
      g.restore();
    }
  // moss in the cracks, thicker towards the edge
  for (let k = 0; k < 900; k++) {
    const a = r() * Math.PI * 2;
    const d = Math.sqrt(r()) * radius;
    if (d < radius * 0.55 && r() < 0.8) continue;
    g.fillStyle = `rgba(${70 + r() * 30},${100 + r() * 40},${50 + r() * 20},${0.12 + r() * 0.25})`;
    g.beginPath();
    g.arc(size / 2 + Math.cos(a) * d * px, size / 2 + Math.sin(a) * d * px, (0.08 + r() * 0.22) * px, 0, Math.PI * 2);
    g.fill();
  }
  // a darker ring of paving round the fountain and the forge's yard
  g.strokeStyle = 'rgba(30,24,18,0.5)';
  g.lineWidth = px * 0.16;
  for (const [cx, cz, rr] of [[8, -5, 3.6], [-10, -6.4, 4]] as const) {
    g.beginPath();
    g.arc(size / 2 + cx * px, size / 2 + cz * px, rr * px, 0, Math.PI * 2);
    g.stroke();
  }
  // fade into the ground at the edge: erase with a radial gradient
  g.globalCompositeOperation = 'destination-in';
  const fade = g.createRadialGradient(size / 2, size / 2, radius * px * 0.8, size / 2, size / 2, radius * px);
  fade.addColorStop(0, 'rgba(0,0,0,1)');
  fade.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = fade;
  g.fillRect(0, 0, size, size);
  g.globalCompositeOperation = 'source-over';
  return c;
}

/** The whole map painted into a canvas (also used, small, for the minimap). */
export function paintTerrain(size: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  const img = g.createImageData(size, size);
  const col: [number, number, number] = [0, 0, 0];
  for (let j = 0; j < size; j++)
    for (let i = 0; i < size; i++) {
      groundColor(((i + 0.5) / size) * EXTENT * 2 - EXTENT, ((j + 0.5) / size) * EXTENT * 2 - EXTENT, col);
      const k = (j * size + i) * 4;
      img.data[k] = col[0];
      img.data[k + 1] = col[1];
      img.data[k + 2] = col[2];
      img.data[k + 3] = 255;
    }
  g.putImageData(img, 0, 0);
  return c;
}
/** Map coordinates of the painted terrain: the world spans [-EXTENT, EXTENT] on both axes. */
export const TERRAIN_EXTENT = EXTENT;

/* ───────────────────────── atmosphere per zone ───────────────────────── */

interface Look {
  ambient: number;
  ambientI: number;
  sun: number;
  sunI: number;
  fogNear: number;
  fogFar: number;
}
const LOOK: Record<ZoneId, Look> = {
  village: { ambient: 0xcdd6ee, ambientI: 1.25, sun: 0xfff0d6, sunI: 2.5, fogNear: 38, fogFar: 150 },
  meadow: { ambient: 0xcfe0f0, ambientI: 1.2, sun: 0xfff3da, sunI: 2.5, fogNear: 34, fogFar: 135 },
  forest: { ambient: 0x9fb8ac, ambientI: 0.95, sun: 0xdde8d0, sunI: 1.7, fogNear: 22, fogFar: 95 },
  swamp: { ambient: 0xb2b090, ambientI: 0.95, sun: 0xe0dcae, sunI: 1.6, fogNear: 18, fogFar: 80 },
  volcano: { ambient: 0xb88a78, ambientI: 0.9, sun: 0xffa070, sunI: 1.9, fogNear: 20, fogFar: 95 }
};

/* ───────────────────────── scenery helpers ───────────────────────── */

interface Spot {
  m: THREE.Matrix4;
  c?: THREE.Color;
}

/** Instances grouped into map tiles (one InstancedMesh per tile) so the view frustum and the shadow camera skip far tiles. */
function scatter(parent: THREE.Group, geo: THREE.BufferGeometry, mat: THREE.Material, spots: Spot[], shadows: boolean) {
  const tiles = new Map<string, Spot[]>();
  for (const s of spots) {
    const key = `${Math.floor(s.m.elements[12] / TILE)}|${Math.floor(s.m.elements[14] / TILE)}`;
    const l = tiles.get(key);
    if (l) l.push(s);
    else tiles.set(key, [s]);
  }
  tiles.forEach((list) => {
    const mesh = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach((s, i) => {
      mesh.setMatrixAt(i, s.m);
      if (s.c) mesh.setColorAt(i, s.c);
    });
    mesh.castShadow = shadows;
    mesh.receiveShadow = true;
    mesh.computeBoundingSphere();
    parent.add(mesh);
  });
}

const spot = (x: number, y: number, z: number, scale: number | [number, number, number], rotY = 0, color?: THREE.Color): Spot => {
  const m = new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotY),
    typeof scale === 'number' ? new THREE.Vector3(scale, scale, scale) : new THREE.Vector3(scale[0], scale[1], scale[2])
  );
  return { m, c: color };
};

export interface World {
  scene: THREE.Scene;
  camps: Camp[];
  /** Walls and trees: push a position out of them. */
  resolve(p: THREE.Vector3, radius: number): void;
  hits(x: number, z: number, shrink?: number): boolean;
  /** Animate fires and water; the shadow light and the atmosphere follow `focus`. */
  update(t: number, dt: number, focus: THREE.Vector3): void;
  dispose(): void;
}

export function buildWorld(): World {
  const scene = new THREE.Scene();
  const r = rng(4417);
  const grid = new ObstacleGrid();
  const disposables: { dispose(): void }[] = [];
  const own = <T extends { dispose(): void }>(x: T) => (disposables.push(x), x);
  const camps = generateCamps();

  scene.background = new THREE.Color(ZONES.village.fog);
  scene.fog = new THREE.Fog(ZONES.village.fog, 38, 150);
  const ambient = new THREE.AmbientLight(0xcdd6ee, 1.25);
  const hemi = new THREE.HemisphereLight(0xbfd8ff, 0x4a4030, 0.7);
  const sun = new THREE.DirectionalLight(0xfff0d6, 2.5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera;
  sc.near = 1;
  sc.far = 90;
  sc.left = sc.bottom = -26;
  sc.right = sc.top = 26;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  scene.add(ambient, hemi, sun, sun.target);

  // ground
  const groundTex = own(new THREE.CanvasTexture(paintTerrain(1536)));
  groundTex.colorSpace = THREE.SRGBColorSpace;
  groundTex.anisotropy = 8;
  // a small tiling grain over the painted map, as a bump: the map alone is only a quarter of a metre per texel
  const grainCanvas = document.createElement('canvas');
  grainCanvas.width = grainCanvas.height = 128;
  {
    const g = grainCanvas.getContext('2d')!;
    const img = g.createImageData(128, 128);
    for (let i = 0; i < 128 * 128; i++) {
      const x = i % 128;
      const y = Math.floor(i / 128);
      // tileable: noise wrapped on the cell grid
      const v = 90 + vnoise((x / 128) * 16 % 16, (y / 128) * 16 % 16) * 90 + hash(x, y) * 60;
      img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
      img.data[i * 4 + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  }
  const grainTex = own(new THREE.CanvasTexture(grainCanvas));
  grainTex.wrapS = grainTex.wrapT = THREE.RepeatWrapping;
  grainTex.repeat.set((EXTENT * 2) / 3, (EXTENT * 2) / 3);
  const ground = new THREE.Mesh(
    own(new THREE.PlaneGeometry(EXTENT * 2, EXTENT * 2)),
    own(new THREE.MeshStandardMaterial({ map: groundTex, bumpMap: grainTex, bumpScale: 2.2, roughness: 0.96, metalness: 0 }))
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // the village square, laid over the ground
  const squareR = VILLAGE_R + 2;
  const squareTex = own(new THREE.CanvasTexture(villageTexture(2048, squareR)));
  squareTex.colorSpace = THREE.SRGBColorSpace;
  squareTex.anisotropy = 8;
  const square = new THREE.Mesh(
    own(new THREE.PlaneGeometry(squareR * 2, squareR * 2)),
    own(new THREE.MeshStandardMaterial({ map: squareTex, transparent: true, roughness: 0.92, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, depthWrite: false }))
  );
  square.rotation.x = -Math.PI / 2;
  square.position.y = 0.015;
  square.receiveShadow = true;
  scene.add(square);

  const scenery = new THREE.Group();
  scene.add(scenery);

  // where things may not stand
  const onRoad = (x: number, z: number) => {
    const d = zoneDistance(x, z);
    if (d < VILLAGE_R + 2) return true;
    if (d > 140) return false;
    const a = Math.atan2(z, x);
    return ROADS.some((ra) => Math.abs(Math.atan2(Math.sin(a - ra), Math.cos(a - ra))) * Math.hypot(x, z) < 4);
  };
  const nearCamp = (x: number, z: number, gap: number) => camps.some((c) => Math.hypot(c.x - x, c.z - z) < (c.boss ? 14 : gap));
  const free = (x: number, z: number, gap = 5.5) => !onRoad(x, z) && !nearCamp(x, z, gap);
  const pick = (zone: ZoneId, count: number, gap?: number) => {
    const out: { x: number; z: number }[] = [];
    for (let tries = 0; tries < count * 14 && out.length < count; tries++) {
      const x = (r() * 2 - 1) * (WORLD_HALF - 3);
      const z = (r() * 2 - 1) * (WORLD_HALF - 3);
      if (zoneAt(x, z).id === zone && free(x, z, gap) && !out.some((o) => Math.hypot(o.x - x, o.z - z) < 2.4)) out.push({ x, z });
    }
    return out;
  };
  const shade = (base: number, spread: number) => {
    const c = new THREE.Color(base).offsetHSL((r() - 0.5) * spread * 0.4, (r() - 0.5) * spread, (r() - 0.5) * spread);
    // never so dark that a crown or rock turns into a black silhouette
    const hsl = { h: 0, s: 0, l: 0 };
    c.getHSL(hsl);
    return c.setHSL(hsl.h, hsl.s, Math.max(0.2, hsl.l));
  };

  // props from the nature pack when it has loaded (the built-in shapes below are the fallback)
  const pack = naturePack();
  const scatterProp = (prop: Prop, spots: Spot[], shadows: boolean) =>
    prop.parts.forEach((part) => scatter(scenery, part.geo, part.mat, part.tint ? spots : spots.map((sp) => ({ m: sp.m })), shadows));
  const props = (list: (Prop | null | undefined)[]) => list.filter((x): x is Prop => !!x);

  /* trees, rocks and the like, by zone */
  const bark = own(new THREE.MeshStandardMaterial({ color: 0x5a4330, roughness: 0.95 }));
  const trunkGeo = own(new THREE.CylinderGeometry(0.17, 0.26, 1.7, 7).translate(0, 0.85, 0));
  const leafMat = own(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, flatShading: true }));
  const crownGeo = own(new THREE.IcosahedronGeometry(1.35, 1).scale(1, 0.85, 1).translate(0, 2.6, 0));
  const pineGeo = own(
    mergeGeometries([
      new THREE.ConeGeometry(1.5, 2.2, 7).translate(0, 2.2, 0),
      new THREE.ConeGeometry(1.15, 2, 7).translate(0, 3.5, 0),
      new THREE.ConeGeometry(0.78, 1.8, 7).translate(0, 4.7, 0)
    ])!
  );
  const rockGeo = own(new THREE.IcosahedronGeometry(1, 0));
  const rockMat = own(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true }));
  const deadGeo = own(
    mergeGeometries([
      new THREE.CylinderGeometry(0.13, 0.3, 3.4, 6).translate(0, 1.7, 0),
      new THREE.CylinderGeometry(0.05, 0.1, 1.5, 5).rotateZ(0.9).translate(0.55, 2.7, 0),
      new THREE.CylinderGeometry(0.05, 0.09, 1.2, 5).rotateZ(-1).translate(-0.45, 2.3, 0.1)
    ])!
  );
  const deadMat = own(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true }));
  const spireGeo = own(new THREE.ConeGeometry(1.1, 4.2, 5).translate(0, 2.1, 0));
  const spireMat = own(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, flatShading: true }));

  const addTrees = (zone: ZoneId, count: number, kind: 'oak' | 'pine' | 'dead' | 'spire', gap = 5.5) => {
    const real = !pack
      ? []
      : kind === 'oak'
        ? props([pack.prop('Tree 003', 5.2)])
        : kind === 'pine'
          ? props([pack.prop('Tree.001', 6.4), pack.prop('Tree 002', 7.6)])
          : kind === 'dead'
            ? props([pack.prop('Tree.004', 4.8)])
            : [];
    if (real.length) {
      const groups = real.map(() => [] as Spot[]);
      for (const p of pick(zone, count, gap)) {
        const s = 0.8 + r() * 0.6;
        const rot = r() * 6.28;
        const g = Math.floor(r() * real.length);
        groups[g].push(spot(p.x, 0, p.z, s, rot, kind === 'pine' ? shade(0x2f7040, 0.35) : undefined));
        grid.add({ x: p.x, z: p.z, r: kind === 'dead' ? 0.7 * s : 0.5 * s });
      }
      real.forEach((prop, i) => scatterProp(prop, groups[i], true));
      return;
    }
    const spots: Spot[] = [];
    const trunks: Spot[] = [];
    for (const p of pick(zone, count, gap)) {
      const s = 0.8 + r() * 0.7;
      const rot = r() * 6.28;
      if (kind === 'oak') {
        trunks.push(spot(p.x, 0, p.z, s, rot));
        spots.push(spot(p.x, 0, p.z, s, rot, shade(0x5f9a46, 0.5)));
      } else if (kind === 'pine') {
        trunks.push(spot(p.x, 0, p.z, s, rot));
        spots.push(spot(p.x, 0, p.z, s * 1.1, rot, shade(0x2c6a4c, 0.4)));
      } else if (kind === 'dead') spots.push(spot(p.x, 0, p.z, s, rot, shade(0x6a604a, 0.3)));
      else spots.push(spot(p.x, 0, p.z, s * 1.2, rot, shade(0x3a2e2a, 0.3)));
      grid.add({ x: p.x, z: p.z, r: kind === 'spire' ? 0.9 * s : 0.5 * s });
    }
    if (kind === 'oak') {
      scatter(scenery, trunkGeo, bark, trunks, true);
      scatter(scenery, crownGeo, leafMat, spots, true);
    } else if (kind === 'pine') {
      scatter(scenery, trunkGeo, bark, trunks, true);
      scatter(scenery, pineGeo, leafMat, spots, true);
    } else if (kind === 'dead') scatter(scenery, deadGeo, deadMat, spots, true);
    else scatter(scenery, spireGeo, spireMat, spots, true);
  };
  addTrees('meadow', 85, 'oak');
  addTrees('forest', 300, 'pine', 4.5);
  addTrees('swamp', 150, 'dead');
  addTrees('volcano', 190, 'spire');

  const addRocks = (zone: ZoneId, count: number, color: number) => {
    const stones = pack ? props([pack.prop('Stone 1', 2.2, { by: 'width' }), pack.prop('Stone 2', 2.4, { by: 'width' }), pack.prop('Stone 3', 2.6, { by: 'width' })]) : [];
    if (stones.length) {
      const groups = stones.map(() => [] as Spot[]);
      for (const p of pick(zone, count)) {
        const s = 0.7 + r() * 1.2;
        groups[Math.floor(r() * stones.length)].push(spot(p.x, -0.05, p.z, s, r() * 6, shade(color, 0.3)));
        grid.add({ x: p.x, z: p.z, r: s * 0.9 });
      }
      stones.forEach((prop, i) => scatterProp(prop, groups[i], true));
      return;
    }
    const spots: Spot[] = [];
    for (const p of pick(zone, count)) {
      const s = 0.7 + r() * 1.3;
      spots.push(spot(p.x, s * 0.3, p.z, [s, s * 0.7, s], r() * 6, shade(color, 0.3)));
      grid.add({ x: p.x, z: p.z, r: s * 0.85 });
    }
    scatter(scenery, rockGeo, rockMat, spots, true);
  };
  addRocks('meadow', 45, 0x8a8a84);
  addRocks('forest', 55, 0x6a7468);
  addRocks('swamp', 40, 0x6a6a58);
  addRocks('volcano', 70, 0x4a3c38);

  // bushes and flowers (no collision) and glowing mushrooms in the swamp
  const bushSpots: Spot[] = [];
  const bushProps = pack ? props([pack.prop('Bush 1', 1.7, { by: 'width' }), pack.prop('Bush 2', 1.4, { by: 'width' }), pack.prop('Plant 1', 1.1, { by: 'width' }), pack.prop('Plant 3', 1.0, { by: 'width' })]) : [];
  const bushGroups = bushProps.map(() => [] as Spot[]);
  for (const zone of ['meadow', 'forest'] as ZoneId[])
    for (const p of pick(zone, zone === 'meadow' ? 150 : 110, 3)) {
      const tint = shade(zone === 'meadow' ? 0x5a9a44 : 0x3c7a50, 0.5);
      if (bushProps.length) bushGroups[Math.floor(r() * bushProps.length)].push(spot(p.x, 0, p.z, 0.7 + r() * 0.6, r() * 6, tint));
      else bushSpots.push(spot(p.x, 0.25, p.z, [0.7 + r() * 0.5, 0.45 + r() * 0.3, 0.7 + r() * 0.5], r() * 6, tint));
    }
  if (bushProps.length) bushProps.forEach((prop, i) => scatterProp(prop, bushGroups[i], false));
  else scatter(scenery, own(new THREE.IcosahedronGeometry(0.7, 0)), leafMat, bushSpots, false);
  const shroomGeo = own(mergeGeometries([new THREE.CylinderGeometry(0.06, 0.09, 0.45, 6).translate(0, 0.22, 0), new THREE.ConeGeometry(0.34, 0.3, 8).translate(0, 0.55, 0)])!);
  const shroomMat = own(new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x7040a0, emissiveIntensity: 0.8, roughness: 0.6 }));
  const shrooms: Spot[] = [];
  const shroomProp = pack?.prop('Mushroom 2', 0.6, { glow: 0x7040a0 });
  for (const p of pick('swamp', 90, 3)) shrooms.push(spot(p.x, 0, p.z, 0.8 + r() * 1.2, r() * 6, shade(0xb070e8, 0.5)));
  if (shroomProp) scatterProp(shroomProp, shrooms, false);
  else scatter(scenery, shroomGeo, shroomMat, shrooms, false);

  // logs and stumps lying about the woods and the swamp
  const logProp = pack?.prop('Log', 3.2, { by: 'width' });
  const stumpProp = pack?.prop('Root', 2.3, { by: 'width' });
  if (logProp) {
    const logs: Spot[] = [];
    for (const zone of ['forest', 'swamp', 'meadow'] as ZoneId[]) for (const p of pick(zone, zone === 'forest' ? 26 : 12, 4)) logs.push(spot(p.x, 0, p.z, 0.8 + r() * 0.5, r() * 6.28));
    scatterProp(logProp, logs, true);
  }
  if (stumpProp) {
    const stumps: Spot[] = [];
    for (const zone of ['forest', 'meadow'] as ZoneId[])
      for (const p of pick(zone, zone === 'forest' ? 24 : 10, 4)) {
        const s = 0.7 + r() * 0.6;
        stumps.push(spot(p.x, 0, p.z, s, r() * 6.28));
        grid.add({ x: p.x, z: p.z, r: 0.8 * s });
      }
    scatterProp(stumpProp, stumps, true);
  }

  // lava pools in the volcano
  const lavaMat = own(new THREE.MeshStandardMaterial({ color: 0xff5a1a, emissive: 0xff4a10, emissiveIntensity: 1.6, roughness: 0.5 }));
  const lavaGeo = own(new THREE.CircleGeometry(1, 20).rotateX(-Math.PI / 2));
  const pools: Spot[] = [];
  for (const p of pick('volcano', 26, 8)) {
    const s = 2 + r() * 3;
    pools.push(spot(p.x, 0.04, p.z, [s, 1, s * (0.7 + r() * 0.5)], r() * 6));
    grid.add({ x: p.x, z: p.z, r: s * 0.8 });
  }
  scatter(scenery, lavaGeo, lavaMat, pools, false);

  // the edge of the world: a wall of tall peaks
  const peakGeo = own(new THREE.ConeGeometry(1, 1, 6).translate(0, 0.5, 0));
  const peakMat = own(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true }));
  const peaks: Spot[] = [];
  for (let i = -20; i <= 20; i++) {
    const v = (i / 20) * (WORLD_HALF + 8);
    for (const [x, z] of [[v, -WORLD_HALF - 6], [v, WORLD_HALF + 6], [-WORLD_HALF - 6, v], [WORLD_HALF + 6, v]]) {
      const h = 14 + r() * 22;
      const w = 9 + r() * 6;
      peaks.push(spot(x + (r() - 0.5) * 5, -1, z + (r() - 0.5) * 5, [w, h, w], r() * 6, shade(0x5a5648, 0.25)));
    }
  }
  scatter(scenery, peakGeo, peakMat, peaks, false);

  /* camps: a scorched patch, stakes and skulls and, for a boss, a ring of pillars with a glowing rune */
  const campMat = own(new THREE.MeshBasicMaterial({ color: 0x1c140e, transparent: true, opacity: 0.32, depthWrite: false }));
  const campGeo = own(new THREE.CircleGeometry(1, 28).rotateX(-Math.PI / 2));
  const stakeGeo = own(new THREE.CylinderGeometry(0.07, 0.11, 1.5, 5).translate(0, 0.75, 0));
  const stakeMat = own(new THREE.MeshStandardMaterial({ color: 0x4a3a28, roughness: 1 }));
  const skullMat = own(new THREE.MeshStandardMaterial({ color: 0xd8d0b8, roughness: 0.8 }));
  const skullGeo = own(new THREE.SphereGeometry(0.17, 8, 6));
  const patches: Spot[] = [];
  const stakes: Spot[] = [];
  const skulls: Spot[] = [];
  const pillarGeo = own(new THREE.CylinderGeometry(0.5, 0.7, 5, 8).translate(0, 2.5, 0));
  const pillarMat = own(new THREE.MeshStandardMaterial({ color: 0x3e3a46, roughness: 0.9, flatShading: true }));
  const pillars: Spot[] = [];
  const runeCanvas = document.createElement('canvas');
  runeCanvas.width = runeCanvas.height = 256;
  {
    const g = runeCanvas.getContext('2d')!;
    g.strokeStyle = 'rgba(255,120,50,0.95)';
    g.shadowColor = 'rgba(255,90,20,1)';
    g.shadowBlur = 10;
    for (const [rad, w] of [[0.94, 5], [0.72, 3], [0.46, 3]] as const) {
      g.lineWidth = w;
      g.beginPath();
      g.arc(128, 128, rad * 128, 0, Math.PI * 2);
      g.stroke();
    }
    g.lineWidth = 3;
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      g.beginPath();
      g.moveTo(128 + Math.cos(a) * 0.46 * 128, 128 + Math.sin(a) * 0.46 * 128);
      g.lineTo(128 + Math.cos(a) * 0.72 * 128, 128 + Math.sin(a) * 0.72 * 128);
      g.stroke();
    }
  }
  const runeTex = own(new THREE.CanvasTexture(runeCanvas));
  const runeMat = own(new THREE.MeshBasicMaterial({ map: runeTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.8 }));
  const runeGeo = own(new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2));
  const runes: THREE.Mesh[] = [];
  for (const c of camps) {
    const big = c.boss ? 9 : 4.2;
    patches.push(spot(c.x, 0.03, c.z, big, r() * 6));
    const n = c.boss ? 8 : 4;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + r();
      const rad = big * 0.8;
      stakes.push(spot(c.x + Math.cos(a) * rad, 0, c.z + Math.sin(a) * rad, 0.9 + r() * 0.5, r() * 6));
      if (i % 2 === 0) skulls.push(spot(c.x + Math.cos(a) * rad, 1.55, c.z + Math.sin(a) * rad, 1, r() * 6));
    }
    if (c.boss) {
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        pillars.push(spot(c.x + Math.cos(a) * 11, 0, c.z + Math.sin(a) * 11, 1 + r() * 0.3, r() * 6));
        grid.add({ x: c.x + Math.cos(a) * 11, z: c.z + Math.sin(a) * 11, r: 0.8 });
      }
      const rune = new THREE.Mesh(runeGeo, runeMat);
      rune.scale.setScalar(9.5);
      rune.position.set(c.x, 0.06, c.z);
      scenery.add(rune);
      runes.push(rune);
    }
  }
  scatter(scenery, campGeo, campMat, patches, false);
  scatter(scenery, stakeGeo, stakeMat, stakes, true);
  scatter(scenery, skullGeo, skullMat, skulls, false);
  scatter(scenery, pillarGeo, pillarMat, pillars, true);

  /* the village */
  const village = new THREE.Group();
  scene.add(village);
  const wallMat = own(new THREE.MeshStandardMaterial({ color: 0xe6d8b8, roughness: 0.95 }));
  const roofMat = own(new THREE.MeshStandardMaterial({ color: 0x9a3d2c, roughness: 0.9, flatShading: true }));
  const woodMat = own(new THREE.MeshStandardMaterial({ color: 0x5a3f2a, roughness: 0.95 }));
  const stoneMat = own(new THREE.MeshStandardMaterial({ color: 0x8c8678, roughness: 0.9, flatShading: true }));
  // the camera looks from the south: houses stand to the north and the sides so they do not hide the hero
  const houseSpots = [[15, -9, 5, 4.4], [6, -15.5, 4.4, 4.4], [-13, -14, 5, 4.6], [-17, 1, 4.2, 4.2], [17.2, 3, 4.6, 4.6]];
  const houseGeo = own(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0));
  const roofGeo = own(new THREE.ConeGeometry(0.78, 0.55, 4).rotateY(Math.PI / 4).translate(0, 0.28, 0));
  for (const [x, z, w, d] of houseSpots) {
    const h = 3 + r();
    const wall = new THREE.Mesh(houseGeo, wallMat);
    wall.scale.set(w, h, d);
    wall.position.set(x, 0, z);
    wall.castShadow = wall.receiveShadow = true;
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.scale.set(w * 1.35, h * 0.75, d * 1.35);
    roof.position.set(x, h, z);
    roof.castShadow = true;
    const door = new THREE.Mesh(houseGeo, woodMat);
    door.scale.set(1, 1.9, 0.15);
    door.position.set(x, 0, z + d / 2 + 0.05);
    village.add(wall, roof, door);
    grid.add({ x, z, r: Math.max(w, d) * 0.62 });
  }

  // fountain (heals) and its glowing crystal
  const basin = new THREE.Mesh(own(new THREE.CylinderGeometry(2.3, 2.5, 0.6, 20)), stoneMat);
  basin.position.set(FOUNTAIN.x, 0.3, FOUNTAIN.z);
  basin.castShadow = basin.receiveShadow = true;
  const water = new THREE.Mesh(own(new THREE.CircleGeometry(2.05, 24).rotateX(-Math.PI / 2)), own(new THREE.MeshStandardMaterial({ color: 0x4ab8e8, emissive: 0x1a78b8, emissiveIntensity: 0.9, roughness: 0.1, metalness: 0.2 })));
  water.position.set(FOUNTAIN.x, 0.62, FOUNTAIN.z);
  const crystalMat = own(new THREE.MeshStandardMaterial({ color: 0x9fe8ff, emissive: 0x5ac8ff, emissiveIntensity: 1.4, roughness: 0.2, flatShading: true }));
  const crystal = new THREE.Mesh(own(new THREE.OctahedronGeometry(0.55)), crystalMat);
  crystal.scale.y = 1.7;
  crystal.position.set(FOUNTAIN.x, 1.8, FOUNTAIN.z);
  const fountainLight = new THREE.PointLight(0x7ad8ff, 12, 12, 1.6);
  fountainLight.position.set(FOUNTAIN.x, 2, FOUNTAIN.z);
  village.add(basin, water, crystal, fountainLight);
  grid.add({ x: FOUNTAIN.x, z: FOUNTAIN.z, r: 2.4 });

  // forge: anvil, furnace and a roaring fire
  const furnace = new THREE.Mesh(houseGeo, stoneMat);
  furnace.scale.set(2.4, 1.7, 1.6);
  furnace.position.set(FORGE.x - 1.6, 0, FORGE.z - 0.6);
  furnace.castShadow = true;
  const chimney = new THREE.Mesh(houseGeo, stoneMat);
  chimney.scale.set(0.7, 3.2, 0.7);
  chimney.position.set(FORGE.x - 1.6, 1.7, FORGE.z - 0.8);
  const glowFront = new THREE.Mesh(own(new THREE.PlaneGeometry(1.2, 0.7)), own(new THREE.MeshBasicMaterial({ color: 0xff8a2a })));
  glowFront.position.set(FORGE.x - 1.6, 0.8, FORGE.z + 0.22);
  const anvil = new THREE.Mesh(houseGeo, own(new THREE.MeshStandardMaterial({ color: 0x2a2a30, roughness: 0.5, metalness: 0.8 })));
  anvil.scale.set(0.9, 0.8, 0.5);
  anvil.position.set(FORGE.x + 0.9, 0, FORGE.z + 0.6);
  anvil.castShadow = true;
  const forgeFlame = new THREE.Mesh(own(new THREE.ConeGeometry(0.4, 1.1, 8)), own(new THREE.MeshBasicMaterial({ color: 0xff7a1a, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false })));
  forgeFlame.position.set(FORGE.x - 1.6, 3.6, FORGE.z - 0.8);
  const forgeLight = new THREE.PointLight(0xff8a3a, 22, 14, 1.6);
  forgeLight.position.set(FORGE.x - 0.8, 1.6, FORGE.z + 1.2);
  village.add(furnace, chimney, glowFront, anvil, forgeFlame, forgeLight);
  grid.add({ x: FORGE.x - 1.6, z: FORGE.z - 0.6, r: 1.6 });
  grid.add({ x: FORGE.x + 0.9, z: FORGE.z + 0.6, r: 0.6 });

  const sign = (text: string, x: number, y: number, z: number) => {
    const c = document.createElement('canvas');
    c.width = 320;
    c.height = 72;
    const g = c.getContext('2d')!;
    g.font = 'bold 34px sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineWidth = 8;
    g.strokeStyle = 'rgba(0,0,0,0.85)';
    g.strokeText(text, 160, 36);
    g.fillStyle = '#ffe9b0';
    g.fillText(text, 160, 36);
    const tex = own(new THREE.CanvasTexture(c));
    tex.colorSpace = THREE.SRGBColorSpace;
    const s = new THREE.Sprite(own(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false })));
    s.scale.set(4, 0.9, 1);
    s.position.set(x, y, z);
    s.renderOrder = 28;
    village.add(s);
  };
  sign('Lò rèn', FORGE.x - 0.5, 4.8, FORGE.z);
  sign('Suối hồi phục', FOUNTAIN.x, 3.2, FOUNTAIN.z);

  // torches around the square
  const torchGeo = own(new THREE.CylinderGeometry(0.07, 0.1, 2.2, 6).translate(0, 1.1, 0));
  const flameGeo = own(new THREE.ConeGeometry(0.2, 0.55, 7));
  const flameMat = own(new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
  const flames: { cone: THREE.Mesh; phase: number }[] = [];
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + 0.3;
    const x = Math.cos(a) * (VILLAGE_R - 3);
    const z = Math.sin(a) * (VILLAGE_R - 3);
    const post = new THREE.Mesh(torchGeo, woodMat);
    post.position.set(x, 0, z);
    const cone = new THREE.Mesh(flameGeo, flameMat);
    cone.position.set(x, 2.45, z);
    village.add(post, cone);
    flames.push({ cone, phase: r() * 6 });
    grid.add({ x, z, r: 0.2 });
  }
  const torchLights: THREE.PointLight[] = [];
  for (const [x, z] of [[0, -16], [0, 16], [16, 0], [-16, 0]]) {
    const l = new THREE.PointLight(0xffa050, 10, 13, 1.6);
    l.position.set(x, 2.6, z);
    village.add(l);
    torchLights.push(l);
  }

  // current atmosphere (eases towards the zone the hero is in)
  const cur = { ambient: new THREE.Color(LOOK.village.ambient), sun: new THREE.Color(LOOK.village.sun), fog: new THREE.Color(ZONES.village.fog), ai: 1.25, si: 2.5, near: 38, far: 150 };
  const goal = { ambient: new THREE.Color(), sun: new THREE.Color(), fog: new THREE.Color() };

  return {
    scene,
    camps,
    resolve: (p, radius) => grid.resolve(p, radius),
    hits: (x, z, shrink) => grid.hits(x, z, shrink),
    update(t, dt, focus) {
      for (const f of flames) {
        const k = 0.85 + Math.sin(t * 9 + f.phase) * 0.12 + Math.sin(t * 23 + f.phase * 2) * 0.06;
        f.cone.scale.set(k, 0.9 + (k - 0.85) * 2.2, k);
      }
      const fk = 0.9 + Math.sin(t * 11) * 0.1 + Math.sin(t * 27) * 0.05;
      forgeFlame.scale.set(fk, 0.9 + (fk - 0.9) * 2, fk);
      forgeLight.intensity = 22 * fk;
      torchLights.forEach((l, i) => (l.intensity = 10 * (0.9 + Math.sin(t * 7 + i * 2) * 0.1)));
      crystal.rotation.y = t * 0.8;
      crystal.position.y = 1.8 + Math.sin(t * 1.6) * 0.1;
      fountainLight.intensity = 12 * (0.9 + Math.sin(t * 2) * 0.1);
      runeMat.opacity = 0.65 + Math.sin(t * 1.7) * 0.15;
      runes.forEach((m, i) => (m.rotation.y = t * 0.15 * (i % 2 ? 1 : -1)));
      sun.position.set(focus.x - 16, 28, focus.z + 12);
      sun.target.position.copy(focus);

      const zone = zoneAt(focus.x, focus.z);
      const look = LOOK[zone.id];
      const k = 1 - Math.exp(-dt * 1.6);
      goal.ambient.set(look.ambient);
      goal.sun.set(look.sun);
      goal.fog.set(zone.fog);
      cur.ambient.lerp(goal.ambient, k);
      cur.sun.lerp(goal.sun, k);
      cur.fog.lerp(goal.fog, k);
      cur.ai += (look.ambientI - cur.ai) * k;
      cur.si += (look.sunI - cur.si) * k;
      cur.near += (look.fogNear - cur.near) * k;
      cur.far += (look.fogFar - cur.far) * k;
      ambient.color.copy(cur.ambient);
      ambient.intensity = cur.ai;
      sun.color.copy(cur.sun);
      sun.intensity = cur.si;
      (scene.background as THREE.Color).copy(cur.fog);
      const fog = scene.fog as THREE.Fog;
      fog.color.copy(cur.fog);
      fog.near = cur.near;
      fog.far = cur.far;
    },
    dispose() {
      disposables.forEach((d) => d.dispose());
      scenery.traverse((o) => {
        const m = o as THREE.InstancedMesh;
        if (m.isInstancedMesh) m.dispose();
      });
    }
  };
}

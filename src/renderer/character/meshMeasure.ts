import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { CharacterState } from '../../types/character';
import { morphInfluence, bodyScale, baseModelKey } from './avatar';

/**
 * Measurements and front-view outline taken from the real MPFB body mesh: the base vertices plus every active morph delta
 * (the same influences the renderer uses), cut into thin slices. Used by the "So sánh thể hình" panel.
 */

export interface MeshMeasurements {
  height: number;
  shoulder: number;
  bust: number;
  underbust: number;
  waist: number;
  hip: number;
  thigh: number;
  calf: number;
  upperArm: number;
  neck: number;
  legLength: number;
  armLength: number;
}

export interface MeshOutline {
  /** SVG path data in px (origin top-left of the box, floor at floorY). */
  path: string;
}

interface BodyData {
  base: Float32Array;
  morphs: { name: string; d: Float32Array }[];
  bone: Uint8Array; // class of the dominant bone: 0 torso/other, 1 arm, 2 leg, 3 head, 4 hand
  joints: Record<string, THREE.Vector3>;
  jointDelta: Record<string, { name: string; d: THREE.Vector3 }[]>;
  restHeight: number;
}

const cache = new Map<string, Promise<BodyData>>();

const classOf = (n: string): number => {
  if (/hand|thumb|index|middle|ring|pinky/.test(n)) return 4;
  if (/upperarm|lowerarm|twist/.test(n)) return 1;
  if (/thigh|calf|foot|ball/.test(n)) return 2;
  if (/^head|neck_02/.test(n)) return 3;
  return 0;
};

const load = (key: string): Promise<BodyData> => {
  let p = cache.get(key);
  if (!p) {
    p = (async () => {
      const [extra, gltf] = await Promise.all([fetch(`/models/${key}_extra.json`).then((r) => r.json()), new GLTFLoader().loadAsync(`/models/${key}.glb`)]);
      gltf.scene.updateMatrixWorld(true);
      let body: THREE.SkinnedMesh | null = null;
      gltf.scene.traverse((o) => {
        if ((o as THREE.SkinnedMesh).isSkinnedMesh && o.name === 'Body') body = o as THREE.SkinnedMesh;
      });
      if (!body) throw new Error('no body mesh');
      const mesh = body as THREE.SkinnedMesh;
      const M = mesh.matrixWorld;
      const geo = mesh.geometry;
      const pos = geo.getAttribute('position');
      const n = pos.count;
      const v = new THREE.Vector3();
      const base = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(M);
        base.set([v.x, v.y, v.z], i * 3);
      }
      const lin = new THREE.Matrix4().extractRotation(M);
      const sc = new THREE.Vector3().setFromMatrixScale(M);
      const morphs: BodyData['morphs'] = [];
      const dict = mesh.morphTargetDictionary ?? {};
      const mp = geo.morphAttributes.position ?? [];
      Object.entries(dict).forEach(([name, idx]) => {
        const a = mp[idx as number];
        if (!a) return;
        const d = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) {
          v.set(a.getX(i) * sc.x, a.getY(i) * sc.y, a.getZ(i) * sc.z).applyMatrix4(lin);
          d.set([v.x, v.y, v.z], i * 3);
        }
        morphs.push({ name, d });
      });
      const si = geo.getAttribute('skinIndex');
      const sw = geo.getAttribute('skinWeight');
      const names = mesh.skeleton.bones.map((b) => b.name);
      const bone = new Uint8Array(n);
      for (let i = 0; i < n; i++) {
        let best = 0;
        let bw = -1;
        for (let k = 0; k < 4; k++) {
          const w = sw.getComponent(i, k);
          if (w > bw) {
            bw = w;
            best = si.getComponent(i, k);
          }
        }
        bone[i] = classOf(names[best] ?? '');
      }
      const joints: Record<string, THREE.Vector3> = {};
      mesh.skeleton.bones.forEach((b) => (joints[b.name] = new THREE.Vector3().setFromMatrixPosition(b.matrixWorld)));
      const jointDelta: BodyData['jointDelta'] = {};
      Object.entries((extra.bones ?? {}) as Record<string, Record<string, number[]>>).forEach(([bn, keys]) => {
        jointDelta[bn] = Object.entries(keys).map(([name, d]) => ({ name, d: new THREE.Vector3(d[0], d[1], d[2]).multiplyScalar(sc.y) }));
      });
      let lo = Infinity;
      let hi = -Infinity;
      for (let i = 0; i < n; i++) {
        lo = Math.min(lo, base[i * 3 + 1]);
        hi = Math.max(hi, base[i * 3 + 1]);
      }
      return { base, morphs, bone, joints, jointDelta, restHeight: hi - lo };
    })();
    cache.set(key, p);
  }
  return p;
};

/** Convex-hull perimeter of 2-D points (Andrew's monotone chain). */
const hullPerimeter = (pts: [number, number][]): number => {
  if (pts.length < 3) return 0;
  pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: number[], a: number[], b: number[]) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: [number, number][] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: [number, number][] = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  const h = lower.slice(0, -1).concat(upper.slice(0, -1));
  let s = 0;
  for (let i = 0; i < h.length; i++) {
    const a = h[i];
    const b = h[(i + 1) % h.length];
    s += Math.hypot(a[0] - b[0], a[1] - b[1]);
  }
  return s;
};

export interface MeshResult {
  m: MeshMeasurements;
  outline: (pxPerMetre: number, cx: number, floorY: number) => MeshOutline;
}

/** Measure `state` on the real body mesh (cm). */
export const measureMesh = async (state: CharacterState): Promise<MeshResult> => {
  const d = await load(baseModelKey(state.race, state.gender));
  const infl = morphInfluence(state);
  const n = d.base.length / 3;
  const P = Float32Array.from(d.base);
  for (const mo of d.morphs) {
    const w = infl.get(mo.name);
    if (!w) continue;
    for (let i = 0; i < P.length; i++) P[i] += mo.d[i] * w;
  }
  const J = (name: string) => {
    const j = (d.joints[name] ?? new THREE.Vector3()).clone();
    for (const k of d.jointDelta[name] ?? []) {
      const w = infl.get(k.name);
      if (w) j.addScaledVector(k.d, w);
    }
    return j;
  };
  // head size scales the head around the neck joint
  const neckTop = J('neck_01');
  const hs = state.body.headSize;
  if (Math.abs(hs - 1) > 1e-3) {
    for (let i = 0; i < n; i++) {
      if (d.bone[i] !== 3) continue;
      for (let c = 0; c < 3; c++) P[i * 3 + c] = neckTop.getComponent(c) + (P[i * 3 + c] - neckTop.getComponent(c)) * hs;
    }
  }
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < n; i++) {
    lo = Math.min(lo, P[i * 3 + 1]);
    hi = Math.max(hi, P[i * 3 + 1]);
  }
  const s = bodyScale(state, d.restHeight); // metres per model unit after all scales
  const H = hi - lo;
  const half = 0.004 * H;

  const slab = (y: number, pick: (cls: number, x: number) => boolean): [number, number][] => {
    const pts: [number, number][] = [];
    for (let i = 0; i < n; i++) {
      if (Math.abs(P[i * 3 + 1] - y) <= half && pick(d.bone[i], P[i * 3])) pts.push([P[i * 3], P[i * 3 + 2]]);
    }
    return pts;
  };
  const trunkRing = (y: number) => hullPerimeter(slab(y, (c) => c === 0 || c === 3)) * s * 100;
  const hipRing = (y: number) => hullPerimeter(slab(y, (c) => c === 0 || c === 2)) * s * 100;
  const scan = (y0: number, y1: number, f: (y: number) => number, max: boolean) => {
    let best = max ? -Infinity : Infinity;
    for (let k = 0; k <= 24; k++) {
      const v = f(y0 + ((y1 - y0) * k) / 24);
      if (v > 0) best = max ? Math.max(best, v) : Math.min(best, v);
    }
    return Number.isFinite(best) ? best : 0;
  };

  const thigh = J('thigh_l');
  const lowerarm = J('lowerarm_l');
  const upperarm = J('upperarm_l');
  const hand = J('hand_l');

  // crotch: scanning up from the knees, the first slice where something (glutes / pelvis, behind the hip joint) crosses the centre line
  let crotchY = thigh.y - 0.07 * H;
  for (let y = lo + 0.3 * H; y < thigh.y + 0.05 * H; y += 0.004 * H) {
    let hit = false;
    for (let i = 0; i < n && !hit; i++) {
      if (Math.abs(P[i * 3 + 1] - y) < 0.003 * H && Math.abs(P[i * 3]) < 0.006 * H && P[i * 3 + 2] < thigh.z && d.bone[i] !== 1 && d.bone[i] !== 4) hit = true;
    }
    if (hit) {
      crotchY = y;
      break;
    }
  }

  const side = (y: number, cls: number) => hullPerimeter(slab(y, (c, x) => c === cls && x > 0)) * s * 100;
  let xmin = Infinity;
  let xmax = -Infinity;
  for (let i = 0; i < n; i++) {
    if (Math.abs(P[i * 3 + 1] - upperarm.y) < 0.02 * H) {
      xmin = Math.min(xmin, P[i * 3]);
      xmax = Math.max(xmax, P[i * 3]);
    }
  }
  let reach = 0;
  for (let i = 0; i < n; i++) {
    if (d.bone[i] === 4 && P[i * 3] * (hand.x >= 0 ? 1 : -1) > 0) reach = Math.max(reach, Math.hypot(P[i * 3] - hand.x, P[i * 3 + 1] - hand.y, P[i * 3 + 2] - hand.z));
  }

  const m: MeshMeasurements = {
    height: H * s * 100,
    shoulder: (xmax - xmin) * s * 100,
    // windows are fractions of the body height above the floor (checked against the ring profile of the default body)
    bust: scan(lo + 0.71 * H, lo + 0.77 * H, trunkRing, true),
    underbust: scan(lo + 0.66 * H, lo + 0.715 * H, trunkRing, false),
    waist: scan(lo + 0.60 * H, lo + 0.68 * H, trunkRing, false),
    hip: scan(lo + 0.5 * H, lo + 0.58 * H, hipRing, true),
    thigh: scan(crotchY - 0.07 * H, crotchY - 0.01 * H, (y) => side(y, 2), true),
    calf: scan(lo + 0.19 * H, lo + 0.3 * H, (y) => side(y, 2), true),
    upperArm: side((upperarm.y + lowerarm.y) / 2, 1),
    neck: hullPerimeter(slab(neckTop.y + 0.025 * H, (c) => c === 3 || c === 0)) * s * 100,
    legLength: (crotchY - lo) * s * 100,
    armLength: (upperarm.distanceTo(lowerarm) + lowerarm.distanceTo(hand) + reach) * s * 100
  };

  const outline = (pxPerMetre: number, cx: number, floorY: number): MeshOutline => {
    const k = s * pxPerMetre;
    const step = 0.012 * H;
    const gap = (0.03 * H) / 1.7;
    const parts: string[] = [];
    for (let y = lo; y < hi; y += step) {
      const xs: number[] = [];
      for (let i = 0; i < n; i++) if (P[i * 3 + 1] >= y && P[i * 3 + 1] < y + step) xs.push(P[i * 3]);
      if (!xs.length) continue;
      xs.sort((a, b) => a - b);
      let a = xs[0];
      let prev = xs[0];
      const flush = (b: number) => {
        const w = Math.max(0.8, (b - a) * k);
        parts.push(`M${(cx + a * k).toFixed(1)} ${(floorY - (y + step - lo) * k).toFixed(1)}h${w.toFixed(1)}v${(step * k + 1.2).toFixed(1)}h${(-w).toFixed(1)}z`);
      };
      for (const x of xs) {
        if (x - prev > gap) {
          flush(prev);
          a = x;
        }
        prev = x;
      }
      flush(prev);
    }
    return { path: parts.join('') };
  };
  return { m, outline };
};

import * as THREE from 'three';

/**
 * Doubles the density of the body mesh: neighbouring triangles are paired up across their shared edge (the longest edges first) and
 * each pair is cut at the middle of that edge, so every paired triangle becomes two. Both sides of the cut edge are split, so no
 * crack can open. The shape does not change (the new vertex sits on the straight line between the two old ones); what changes is
 * the density, so the parts hidden under clothing are cut along a finer line and every per-vertex test (what lies under a garment,
 * where the lips are, how a seam is covered) has about twice the resolution.
 *
 * Every attribute is carried over: positions, normals, UVs, skin indices / weights and all morph targets are interpolated, so
 * sliders, joints and expressions keep working on the new vertices. New vertices get the "original index" `ORIG_BASE + k` in the
 * `_orig…` attribute (k = their number), and `parents` lists the two old vertices each one lies between.
 */

/** Original basemesh indices are below this; midpoint vertices are numbered from here. */
export const ORIG_BASE = 30000;

export interface Subdivision {
  /** Old vertex count. */
  base: number;
  /** For each new vertex k (index base + k): the two old vertices it lies between (a, b). */
  parents: Int32Array;
}

type Attr = THREE.BufferAttribute | THREE.InterleavedBufferAttribute;

export function subdivideBody(geo: THREE.BufferGeometry): Subdivision | null {
  const index = geo.index;
  const pos = geo.getAttribute('position');
  if (!index || !pos) return null;
  const n0 = pos.count;
  const src = index.array;
  const mids = new Map<number, number>();
  const pa: number[] = [];
  const pb: number[] = [];
  const mid = (a: number, b: number) => {
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    const key = lo * n0 + hi;
    let m = mids.get(key);
    if (m === undefined) {
      m = n0 + pa.length;
      mids.set(key, m);
      pa.push(lo);
      pb.push(hi);
    }
    return m;
  };
  // pair triangles across shared edges, longest edge first: a triangle takes part in at most one pair
  const nt = Math.floor(src.length / 3);
  const edges = new Map<number, number[]>();
  for (let t = 0; t < nt; t++)
    for (let k = 0; k < 3; k++) {
      const a = src[t * 3 + k], b = src[t * 3 + ((k + 1) % 3)];
      const key = Math.min(a, b) * n0 + Math.max(a, b);
      const l = edges.get(key);
      if (l) l.push(t);
      else edges.set(key, [t]);
    }
  const len2 = (a: number, b: number) => (pos.getX(a) - pos.getX(b)) ** 2 + (pos.getY(a) - pos.getY(b)) ** 2 + (pos.getZ(a) - pos.getZ(b)) ** 2;
  const shared: { a: number; b: number; l: number; t1: number; t2: number }[] = [];
  edges.forEach((tris, key) => {
    if (tris.length !== 2 || tris[0] === tris[1]) return;
    const a = Math.floor(key / n0), b = key % n0;
    shared.push({ a, b, l: len2(a, b), t1: tris[0], t2: tris[1] });
  });
  shared.sort((x, y) => y.l - x.l);
  const cut = new Map<number, [number, number]>(); // triangle -> the shared edge it is cut along
  for (const e of shared) {
    if (cut.has(e.t1) || cut.has(e.t2)) continue;
    cut.set(e.t1, [e.a, e.b]);
    cut.set(e.t2, [e.a, e.b]);
  }
  const out: number[] = [];
  for (let t = 0; t < nt; t++) {
    const v = [src[t * 3], src[t * 3 + 1], src[t * 3 + 2]];
    const edge = cut.get(t);
    if (!edge) {
      out.push(v[0], v[1], v[2]);
      continue;
    }
    // rotate so the cut edge is (x, y) and z is the opposite corner; the winding stays the same
    let r = 0;
    while (!((v[r] === edge[0] && v[(r + 1) % 3] === edge[1]) || (v[r] === edge[1] && v[(r + 1) % 3] === edge[0]))) r++;
    const x = v[r], y = v[(r + 1) % 3], z = v[(r + 2) % 3];
    const mm = mid(x, y);
    out.push(x, mm, z, mm, y, z);
  }
  const m = pa.length;
  const n1 = n0 + m;

  /** A copy of `attr` with the midpoint values appended (the mean of the two ends; normals are renormalised). */
  const widen = (attr: Attr, normal = false) => {
    const size = attr.itemSize;
    const arr = new Float32Array(n1 * size);
    for (let i = 0; i < n0; i++) for (let k = 0; k < size; k++) arr[i * size + k] = attr.getComponent(i, k);
    for (let j = 0; j < m; j++) {
      let len = 0;
      for (let k = 0; k < size; k++) {
        const v = (attr.getComponent(pa[j], k) + attr.getComponent(pb[j], k)) * 0.5;
        arr[(n0 + j) * size + k] = v;
        len += v * v;
      }
      if (normal && len > 1e-12) {
        len = Math.sqrt(len);
        for (let k = 0; k < size; k++) arr[(n0 + j) * size + k] /= len;
      }
    }
    return new THREE.BufferAttribute(arr, size, attr.normalized);
  };

  const si = geo.getAttribute('skinIndex');
  const sw = geo.getAttribute('skinWeight');
  for (const name of Object.keys(geo.attributes)) {
    const attr = geo.attributes[name];
    const lower = name.toLowerCase();
    if (lower === 'skinindex' || lower === 'skinweight') continue; // rebuilt below, together
    if (lower.startsWith('_orig')) {
      const arr = new Float32Array(n1);
      for (let i = 0; i < n0; i++) arr[i] = attr.getX(i);
      for (let j = 0; j < m; j++) arr[n0 + j] = ORIG_BASE + j;
      geo.setAttribute(name, new THREE.BufferAttribute(arr, 1));
      continue;
    }
    geo.setAttribute(name, widen(attr, lower === 'normal'));
  }

  if (si && sw) {
    const idx = new Uint16Array(n1 * 4);
    const wt = new Float32Array(n1 * 4);
    for (let i = 0; i < n0; i++)
      for (let k = 0; k < 4; k++) {
        idx[i * 4 + k] = si.getComponent(i, k);
        wt[i * 4 + k] = sw.getComponent(i, k);
      }
    // a midpoint is moved by the bones of both ends: merge their influences, keep the four strongest
    const acc = new Map<number, number>();
    for (let j = 0; j < m; j++) {
      acc.clear();
      for (const v of [pa[j], pb[j]])
        for (let k = 0; k < 4; k++) {
          const w = sw.getComponent(v, k);
          if (w > 0) acc.set(si.getComponent(v, k), (acc.get(si.getComponent(v, k)) ?? 0) + w * 0.5);
        }
      const top = [...acc.entries()].sort((x, y) => y[1] - x[1]).slice(0, 4);
      const sum = top.reduce((s, e) => s + e[1], 0) || 1;
      top.forEach(([bone, w], k) => {
        idx[(n0 + j) * 4 + k] = bone;
        wt[(n0 + j) * 4 + k] = w / sum;
      });
    }
    geo.setAttribute('skinIndex', new THREE.BufferAttribute(idx, 4));
    geo.setAttribute('skinWeight', new THREE.BufferAttribute(wt, 4));
  }

  for (const name of Object.keys(geo.morphAttributes)) {
    geo.morphAttributes[name] = geo.morphAttributes[name].map((attr) => widen(attr));
  }

  geo.setIndex(new THREE.BufferAttribute(n1 > 65535 ? new Uint32Array(out) : new Uint16Array(out), 1));
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  const parents = new Int32Array(m * 2);
  for (let j = 0; j < m; j++) {
    parents[j * 2] = pa[j];
    parents[j * 2 + 1] = pb[j];
  }
  return { base: n0, parents };
}

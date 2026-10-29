import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Trees and grass as instanced meshes: leaf / blade cards with alpha textures drawn on canvases, swaying in a shared
 * wind uniform. One draw call per tree part and one for all the grass.
 */

export interface TreeSpot {
  x: number;
  z: number;
  kind: 'oak' | 'pine';
  scale: number;
  rot: number;
  /** Ground height under the tree (outer hills); 0 inside the play area. */
  y?: number;
}

const wind = { value: 0 };

let seed = 1234;
const rnd = () => {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
};

function canvasTexture(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** A spray of leaves (or needles) on a transparent background. */
function leafTexture(pine: boolean) {
  return canvasTexture(256, 256, (ctx) => {
    for (let i = 0; i < (pine ? 260 : 150); i++) {
      const x = 128 + (rnd() - 0.5) * 220 * Math.sqrt(rnd());
      const y = 128 + (rnd() - 0.5) * 220 * Math.sqrt(rnd());
      const l = pine ? 14 + rnd() * 10 : 10 + rnd() * 10;
      const g = pine ? 70 + rnd() * 40 : 95 + rnd() * 70;
      ctx.fillStyle = `rgb(${Math.round(g * (pine ? 0.42 : 0.55))},${Math.round(g)},${Math.round(g * (pine ? 0.38 : 0.3))})`;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rnd() * Math.PI * 2);
      ctx.beginPath();
      ctx.ellipse(0, 0, l, pine ? 1.6 : l * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  });
}

/** Grass blades rising from the bottom edge. */
function grassTexture() {
  return canvasTexture(256, 128, (ctx) => {
    for (let i = 0; i < 46; i++) {
      const x = 8 + rnd() * 240;
      const h = 30 + rnd() * 90;
      const lean = (rnd() - 0.5) * 40;
      // dry and green blades mixed, darker at the base like real turf
      const g = 85 + rnd() * 70;
      const dry = rnd() < 0.3 ? 1 : 0;
      const grad = ctx.createLinearGradient(0, 128, 0, 128 - h);
      grad.addColorStop(0, `rgb(${Math.round(g * 0.4)},${Math.round(g * 0.6)},${Math.round(g * 0.25)})`);
      grad.addColorStop(1, dry ? `rgb(${Math.round(g * 1.15)},${Math.round(g * 1.05)},${Math.round(g * 0.55)})` : `rgb(${Math.round(g * 0.75)},${Math.round(g * 1.05)},${Math.round(g * 0.4)})`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(x - 2.5, 128);
      ctx.quadraticCurveTo(x + lean * 0.3, 128 - h * 0.6, x + lean, 128 - h);
      ctx.quadraticCurveTo(x + lean * 0.3 + 1.5, 128 - h * 0.6, x + 2.5, 128);
      ctx.fill();
    }
  });
}

/** Bend vertices above `base` sideways with the wind, more the higher they are. */
function windy(mat: THREE.Material, strength: number, base: number, height: number) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uWind = wind;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uWind;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vec3 iPos = vec3( 0.0 );
        #ifdef USE_INSTANCING
          iPos = instanceMatrix[ 3 ].xyz;
        #endif
        float bend = clamp( ( position.y - ${base.toFixed(2)} ) / ${height.toFixed(2)}, 0.0, 1.0 );
        float gust = sin( uWind * 1.7 + iPos.x * 0.31 + iPos.z * 0.23 ) + 0.5 * sin( uWind * 3.1 + iPos.x * 0.7 );
        transformed.x += gust * bend * bend * ${strength.toFixed(3)};
        transformed.z += cos( uWind * 1.3 + iPos.z * 0.29 ) * bend * bend * ${(strength * 0.6).toFixed(3)};`
      );
  };
  mat.customProgramCacheKey = () => `wind:${strength}:${base}:${height}`;
}

/** Leaf cards scattered over a few spheres (oak) or rings of a cone (pine). */
function crownCards(kind: TreeSpot['kind']) {
  const parts: THREE.BufferGeometry[] = [];
  const card = (x: number, y: number, z: number, size: number, tiltDown = 0) => {
    const g = new THREE.PlaneGeometry(size, size);
    g.rotateX(rnd() * Math.PI - tiltDown);
    g.rotateY(rnd() * Math.PI * 2);
    g.translate(x, y, z);
    parts.push(g);
  };
  if (kind === 'oak') {
    const clusters = [[0, 5.2, 0, 2.3], [1.4, 4.6, 0.6, 1.7], [-1.3, 4.7, -0.5, 1.8], [0.3, 6.4, -0.4, 1.6], [-0.5, 4.4, 1.3, 1.5], [0.6, 4.5, -1.4, 1.5]];
    for (const [cx, cy, cz, r] of clusters)
      for (let i = 0; i < 16; i++) {
        const v = new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize().multiplyScalar(r * (0.55 + rnd() * 0.45));
        card(cx + v.x, cy + v.y * 0.8, cz + v.z, 1.7 + rnd() * 0.6);
      }
  } else {
    for (let tier = 0; tier < 7; tier++) {
      const y = 2.6 + tier * 1.05;
      const r = 2.3 * (1 - tier / 7.5);
      const n = Math.round(10 - tier);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + rnd();
        card(Math.cos(a) * r * 0.6, y, Math.sin(a) * r * 0.6, r * 1.15 + 0.6, 0.6);
      }
    }
  }
  const g = mergeGeometries(parts)!;
  parts.forEach((p) => p.dispose());
  // light the cards like a round crown rather than as flat planes
  const pos = g.getAttribute('position');
  const nrm = g.getAttribute('normal');
  const centre = new THREE.Vector3(0, kind === 'oak' ? 5 : 5.5, 0);
  const n = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    n.set(pos.getX(i), pos.getY(i), pos.getZ(i)).sub(centre).normalize();
    n.y = n.y * 0.6 + 0.4;
    n.normalize();
    nrm.setXYZ(i, n.x, n.y, n.z);
  }
  return g;
}

/** Trunk with a few branches (oak) or a straight tapering pole (pine). */
function trunkGeometry(kind: TreeSpot['kind']) {
  if (kind === 'pine') {
    const g = new THREE.CylinderGeometry(0.1, 0.3, 9, 8);
    g.translate(0, 4.5, 0);
    return g;
  }
  const parts: THREE.BufferGeometry[] = [];
  const t = new THREE.CylinderGeometry(0.2, 0.34, 4.6, 9);
  t.translate(0, 2.3, 0);
  parts.push(t);
  for (const [ry, rz, len] of [[0.4, 0.75, 2.2], [2.6, 0.7, 2], [4.4, 0.8, 1.8]]) {
    const b = new THREE.CylinderGeometry(0.06, 0.14, len, 6);
    b.translate(0, len / 2, 0);
    b.rotateZ(rz);
    b.rotateY(ry);
    b.translate(0, 3.2, 0);
    parts.push(b);
  }
  const g = mergeGeometries(parts.map((p) => p.toNonIndexed()))!;
  parts.forEach((p) => p.dispose());
  return g;
}

export interface Vegetation {
  group: THREE.Group;
  /** Advance the wind; with the camera position, tiles that are too far away to matter are not drawn. */
  update(t: number, camera?: THREE.Vector3): void;
}

/** One square of the map's plants: its meshes share a bounding sphere, so culling (view and shadow) works tile by tile. */
interface Tile {
  meshes: THREE.Object3D[];
  x: number;
  z: number;
  radius: number;
  /** Beyond this distance (to the tile's edge) the tile is skipped. */
  reach: number;
}
const TREE_TILE = 64;
const GRASS_TILE = 32;
const TREE_REACH = 400; // the fog is solid by 380 m
const GRASS_REACH = 170;

export function buildVegetation(
  trees: TreeSpot[],
  grass: { area: number; count: number; accept: (x: number, z: number) => boolean },
  bark: THREE.Material
): Vegetation {
  const group = new THREE.Group();
  const leaves = { oak: leafTexture(false), pine: leafTexture(true) };
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const p = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const col = new THREE.Color();

  const tiles: Tile[] = [];
  (['oak', 'pine'] as const).forEach((kind) => {
    const spots = trees.filter((t) => t.kind === kind);
    if (!spots.length) return;
    const leafMat = new THREE.MeshStandardMaterial({ map: leaves[kind], alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.85 });
    windy(leafMat, kind === 'oak' ? 0.18 : 0.1, 3, 6);
    const trunkGeo = trunkGeometry(kind);
    const crownGeo = crownCards(kind);
    // the geometry is shared by every tile; the trees on the outer hills are scenery only and cast no shadow
    const byTile = new Map<string, TreeSpot[]>();
    for (const t of spots) {
      const key = `${t.y === undefined ? 0 : 1}|${Math.floor(t.x / TREE_TILE)}|${Math.floor(t.z / TREE_TILE)}`;
      const list = byTile.get(key);
      if (list) list.push(t);
      else byTile.set(key, [t]);
    }
    byTile.forEach((list) => {
      const trunk = new THREE.InstancedMesh(trunkGeo, bark, list.length);
      const crown = new THREE.InstancedMesh(crownGeo, leafMat, list.length);
      list.forEach((t, i) => {
        p.set(t.x, t.y ?? 0, t.z);
        q.setFromAxisAngle(up, t.rot);
        s.setScalar(t.scale);
        m.compose(p, q, s);
        trunk.setMatrixAt(i, m);
        crown.setMatrixAt(i, m);
        col.setHSL(kind === 'oak' ? 0.22 + rnd() * 0.06 : 0.3 + rnd() * 0.04, 0.35, 0.62 + rnd() * 0.25);
        crown.setColorAt(i, col);
      });
      const shadows = list[0].y === undefined;
      for (const mesh of [trunk, crown]) {
        mesh.castShadow = shadows;
        mesh.receiveShadow = true;
        mesh.computeBoundingSphere();
        group.add(mesh);
      }
      const bs = crown.boundingSphere!;
      tiles.push({ meshes: [trunk, crown], x: bs.center.x, z: bs.center.z, radius: bs.radius, reach: TREE_REACH });
    });
  });

  // grass clumps: three crossed cards, normals pointing up so they shade like the ground below
  const parts = [0, 1, 2].map((k) => {
    const g = new THREE.PlaneGeometry(0.75, 0.5);
    g.translate(0, 0.25, 0);
    g.rotateY((k * Math.PI) / 3);
    return g;
  });
  const clump = mergeGeometries(parts)!;
  parts.forEach((g) => g.dispose());
  const nrm = clump.getAttribute('normal');
  for (let i = 0; i < nrm.count; i++) nrm.setXYZ(i, 0, 1, 0);
  const grassMat = new THREE.MeshStandardMaterial({ map: grassTexture(), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 1 });
  windy(grassMat, 0.12, 0, 0.5);
  const placed: THREE.Matrix4[] = [];
  const colors: THREE.Color[] = [];
  for (let tries = 0; placed.length < grass.count && tries < grass.count * 4; tries++) {
    const x = (rnd() - 0.5) * grass.area * 2;
    const z = (rnd() - 0.5) * grass.area * 2;
    if (!grass.accept(x, z)) continue;
    p.set(x, 0, z);
    q.setFromAxisAngle(up, rnd() * Math.PI);
    s.set(0.6 + rnd() * 0.6, 0.35 + rnd() * 0.65, 0.6 + rnd() * 0.6);
    placed.push(new THREE.Matrix4().compose(p, q, s));
    colors.push(new THREE.Color().setHSL(0.17 + rnd() * 0.07, 0.22 + rnd() * 0.15, 0.48 + rnd() * 0.2));
  }
  // the grass is cut into squares so the view frustum and the draw distance can drop most of it each frame
  const patches = new Map<string, number[]>();
  placed.forEach((mat, i) => {
    const x = mat.elements[12];
    const z = mat.elements[14];
    const key = `${Math.floor(x / GRASS_TILE)}|${Math.floor(z / GRASS_TILE)}`;
    const list = patches.get(key);
    if (list) list.push(i);
    else patches.set(key, [i]);
  });
  patches.forEach((ids) => {
    const field = new THREE.InstancedMesh(clump, grassMat, ids.length);
    ids.forEach((id, i) => {
      field.setMatrixAt(i, placed[id]);
      field.setColorAt(i, colors[id]);
    });
    field.receiveShadow = true;
    field.computeBoundingSphere();
    group.add(field);
    const bs = field.boundingSphere!;
    tiles.push({ meshes: [field], x: bs.center.x, z: bs.center.z, radius: bs.radius, reach: GRASS_REACH });
  });

  return {
    group,
    update(t: number, camera?: THREE.Vector3) {
      wind.value = t;
      if (!camera) return;
      for (const tile of tiles) {
        const on = Math.hypot(tile.x - camera.x, tile.z - camera.z) - tile.radius < tile.reach;
        for (const mesh of tile.meshes) mesh.visible = on;
      }
    }
  };
}

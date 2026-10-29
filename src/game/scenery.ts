import * as THREE from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky.js';

/**
 * Building blocks for the game world: tiling photo textures (public/textures/game), boxes whose UVs follow their real
 * size so bricks and planks keep their scale, a grass / dirt ground with hills outside the play area, and a physical sky.
 */

export type Surface = 'grass' | 'dirt' | 'asphalt' | 'plaster' | 'brick' | 'roof' | 'wood' | 'rock';
/** Metres covered by one repeat of each texture. */
const TILE: Record<Surface, number> = { grass: 4, dirt: 4, asphalt: 5, plaster: 3, brick: 1.2, roof: 2.4, wood: 2, rock: 2.5 };

export class Materials {
  private readonly loader = new THREE.TextureLoader();
  private readonly textures = new Map<Surface, THREE.Texture>();
  private readonly cache = new Map<string, THREE.MeshStandardMaterial>();

  texture(s: Surface) {
    let t = this.textures.get(s);
    if (!t) {
      t = this.loader.load(`/textures/game/${s}.jpg`);
      t.colorSpace = THREE.SRGBColorSpace;
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.anisotropy = 8;
      this.textures.set(s, t);
    }
    return t;
  }

  /** Shared material for a surface, optionally tinted (painted plaster, rusty metal ...). */
  get(s: Surface, tint = 0xffffff, roughness = 0.9) {
    const key = `${s}:${tint}:${roughness}`;
    let m = this.cache.get(key);
    if (!m) {
      const map = this.texture(s);
      m = new THREE.MeshStandardMaterial({ map, color: tint, roughness, bumpMap: map, bumpScale: s === 'brick' || s === 'roof' || s === 'rock' ? 2.5 : 1 });
      this.cache.set(key, m);
    }
    return m;
  }

  tile(s: Surface) {
    return TILE[s];
  }
}

/** Box geometry whose UVs are in metres / tile, so a texture repeats at its real size on every face. */
export function boxGeometry(w: number, h: number, d: number, tile: number) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.getAttribute('uv') as THREE.BufferAttribute;
  // BoxGeometry face order: +x, -x, +y, -y, +z, -z; four vertices each
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++)
    for (let v = 0; v < 4; v++) {
      const i = f * 4 + v;
      uv.setXY(i, (uv.getX(i) * dims[f][0]) / tile, (uv.getY(i) * dims[f][1]) / tile);
    }
  return g;
}

/** Plane lying on the ground with UVs in metres / tile. */
export function groundPlane(w: number, d: number, tile: number) {
  const g = new THREE.PlaneGeometry(w, d);
  g.rotateX(-Math.PI / 2);
  const uv = g.getAttribute('uv') as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * w) / tile, (uv.getY(i) * d) / tile);
  return g;
}

/** Smooth value noise in [0, 1]. */
export function noise2(x: number, z: number, seed = 0) {
  const h = (i: number, j: number) => {
    const s = Math.sin(i * 127.1 + j * 311.7 + seed * 74.7) * 43758.5453;
    return s - Math.floor(s);
  };
  const xi = Math.floor(x);
  const zi = Math.floor(z);
  const xf = x - xi;
  const zf = z - zi;
  const u = xf * xf * (3 - 2 * xf);
  const v = zf * zf * (3 - 2 * zf);
  const a = h(xi, zi);
  const b = h(xi + 1, zi);
  const c = h(xi, zi + 1);
  const d = h(xi + 1, zi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export const fbm = (x: number, z: number, seed = 0) => noise2(x, z, seed) * 0.55 + noise2(x * 2.1, z * 2.1, seed + 1) * 0.3 + noise2(x * 4.3, z * 4.3, seed + 2) * 0.15;

/** Terrain height: exactly 0 inside the play area (the physics assumes a flat floor), rolling hills beyond it. */
export function terrainHeight(x: number, z: number, limit: number) {
  const edge = Math.max(Math.abs(x), Math.abs(z)) - (limit + 6);
  if (edge <= 0) return 0;
  const rise = Math.min(1, edge / 120);
  return rise * rise * (18 + fbm(x * 0.012, z * 0.012, 4) * 70) + fbm(x * 0.05, z * 0.05, 9) * 4 * rise;
}

/** Ground: grass and dirt blended per vertex (`dirtAt`: paths, yards, spawns), with large-scale colour variation. */
export function buildGround(mats: Materials, limit: number, dirtAt: (x: number, z: number) => number) {
  const size = 760;
  const seg = 190;
  const g = new THREE.PlaneGeometry(size, size, seg, seg);
  g.rotateX(-Math.PI / 2);
  const pos = g.getAttribute('position') as THREE.BufferAttribute;
  const uv = g.getAttribute('uv') as THREE.BufferAttribute;
  const dirt = new Float32Array(pos.count);
  const tint = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const y = terrainHeight(x, z, limit);
    pos.setY(i, y);
    uv.setXY(i, x / 4, z / 4);
    dirt[i] = Math.max(dirtAt(x, z), Math.max(0, fbm(x * 0.03, z * 0.03, 2) - 0.68) * 2.5, y > 20 ? Math.min(0.7, (y - 20) / 40) : 0);
    // large-scale colour variation hides the texture repeat
    const v = fbm(x * 0.02, z * 0.02, 7);
    tint[i * 3] = 0.82 + v * 0.3;
    tint[i * 3 + 1] = 0.86 + v * 0.22;
    tint[i * 3 + 2] = 0.8 + v * 0.18;
  }
  g.setAttribute('dirt', new THREE.BufferAttribute(dirt, 1));
  g.setAttribute('color', new THREE.BufferAttribute(tint, 3));
  g.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ map: mats.texture('grass'), vertexColors: true, roughness: 1 });
  const dirtMap = mats.texture('dirt');
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.dirtMap = { value: dirtMap };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float dirt;\nvarying float vDirt;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvDirt = dirt;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D dirtMap;\nvarying float vDirt;')
      .replace(
        '#include <map_fragment>',
        `vec4 grassC = texture2D( map, vMapUv );
         // a second, rotated and larger sample breaks up the visible repeat
         vec4 grassC2 = texture2D( map, mat2( 0.8, -0.6, 0.6, 0.8 ) * vMapUv * 0.37 );
         vec4 dirtC = texture2D( dirtMap, vMapUv * 0.9 );
         float n = clamp( smoothstep( 0.0, 1.0, vDirt + ( grassC2.g - 0.35 ) * 0.6 ), 0.0, 1.0 );
         diffuseColor *= mix( mix( grassC, grassC2, 0.35 ), dirtC, n );`
      );
  };
  mat.customProgramCacheKey = () => 'ground';
  const mesh = new THREE.Mesh(g, mat);
  mesh.receiveShadow = true;
  return mesh;
}

/** Physical sky, matching fog and image-based lighting. Returns the unit vector toward the sun. */
export function buildSky(scene: THREE.Scene, renderer: THREE.WebGLRenderer | null, elevation = 38, azimuth = 135) {
  const sky = new Sky();
  sky.scale.setScalar(700); // inside the camera far plane (GameEngine)
  const u = sky.material.uniforms;
  u.turbidity.value = 2.2;
  u.rayleigh.value = 1.6;
  u.mieCoefficient.value = 0.0025;
  u.mieDirectionalG.value = 0.82;
  const sun = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - elevation), THREE.MathUtils.degToRad(azimuth));
  u.sunPosition.value.copy(sun);
  // the sky shader is tuned for exposure ~0.5; the scene runs brighter, so darken the sky itself to keep it blue
  sky.material.fragmentShader = sky.material.fragmentShader.replace('gl_FragColor = vec4( retColor, 1.0 );', 'gl_FragColor = vec4( retColor * 0.62, 1.0 );');
  scene.add(sky);
  scene.fog = new THREE.Fog(0x9fb7cc, 80, 380);
  let envTarget: THREE.WebGLRenderTarget | null = null;
  if (renderer) {
    // light the PBR materials with the same sky
    const pm = new THREE.PMREMGenerator(renderer);
    const skyScene = new THREE.Scene();
    const copy = new Sky();
    copy.scale.setScalar(1000);
    for (const [k, v] of Object.entries(u)) (copy.material.uniforms[k] as { value: unknown }).value = (v as { value: unknown }).value;
    skyScene.add(copy);
    envTarget = pm.fromScene(skyScene, 0.04);
    scene.environment = envTarget.texture;
    scene.environmentIntensity = 0.55;
    copy.geometry.dispose();
    copy.material.dispose();
    pm.dispose();
  }
  return { sun, sky, envTarget };
}

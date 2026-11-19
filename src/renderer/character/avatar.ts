import { morphInfluence } from './morphInfluence';
export { morphInfluence } from './morphInfluence';
import { BODY_HUGGING_SLOTS, CLOTH_LAYER, COVERS_SKIN, maskInnerGarments } from './clothingLayers';
import { eyeStyleUrl } from '../../constants/eyes';
import * as THREE from 'three';
import type { RetargetPose } from './mixamo';
import { GLTFLoader, GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { CharacterState } from '../../types/character';
import { ASSET_INFO, assetUrl, defaultFaceHairColor, defaultSkin, equipped, faceHairOverride, skinInfo, skinUrl, SlotId, SLOT_IDS, tailColor } from '../../constants/equipment';
import { lerp, disposeObject } from './geometry';
import { skinAlbedo } from './skin';
import { FaceExtra, installOverlay, MakeupPainter } from './makeup';
import { ORIG_BASE, Subdivision, subdivideBody } from './subdivide';

/**
 * Character body made with MPFB (MakeHuman for Blender), see /mpfb. Each gender has its own base model
 * (jin_<gender>.glb); it carries the skinned body, eyes, brows, lashes, teeth and tongue with one pair of morph targets
 * per app slider (`<slider>_pos` / `<slider>_neg`).
 *  - all bases share the basemesh topology and rig; clothing is fitted to the base body with
 *    jin_<gender>.delta.bin (how far each basemesh vertex is from the body the clothes were made for)
 *  - sliders become morph influences (body, face parts, hair and clothes share the same morph names)
 *  - the joints follow the morphs (per-bone offsets from jin_<gender>_extra.json, inverse bind matrices are rebuilt)
 *  - hair / outfit / shoes / hat are separate GLBs re-bound to the body's skeleton
 *  - make-up and face markings are painted into an overlay texture; the iris colour is repainted
 *  - poses aim the limb bones in world space
 */

type Rot = [number, number, number];
const TARGET_HEIGHT = 1.72;
const FLOOR_Y = -0.9;
/** Mean of the normalised albedo textures baked by mpfb/lib.py (normalize_albedo). */
const ALBEDO_MEAN = 0.8;

const JOINTS = ['hips', 'torso', 'neck', 'head', 'shL', 'shR', 'elL', 'elR', 'wrL', 'wrR', 'hpL', 'hpR', 'knL', 'knR'] as const;
type J = (typeof JOINTS)[number];
type Slot = SlotId;

/** File name (without extension) of the MPFB base body for a gender. */
export const bodyModelKey = (gender: string): string => (gender === 'male' ? 'jin_male' : 'jin_female');

export interface AvatarAnchors {
  headY: number;
  chestY: number;
  waistY: number;
  feetY: number;
  height: number;
  scale: number;
}

interface BoneRest {
  q: THREE.Quaternion;
  p: THREE.Vector3;
  worldQ: THREE.Quaternion;
}

interface Extra extends FaceExtra {
  morphs: string[];
  bones: Record<string, Record<string, [number, number, number]>>;
}

/** Offset of the grip from the palm's centre along the palm normal (m). */
const SOCKET_PALM = { L: 0, R: 0 };
/**
 * Cloth that moves: every loose garment (skirt, dress, outfit, shirt, trousers, hair) is skinned to the body as before, then its
 * vertices are pushed in the vertex shader by a small spring simulation of the body's movement. The part of the garment below
 * `uYTop` follows with a smooth weight that is 0 at that height and 1 at the hem, so the waist stays put and the hem moves most.
 * Strength says how loose the fabric is (a skirt flies, trousers barely move).
 */
const CLOTH_STRENGTH: Partial<Record<string, number>> = { skirt: 1, outfit: 0.85, top: 0.3, pants: 0.28, hair: 0.9 };
/** Height above the pelvis where the garment's weight starts (0 below this point at the hem) per slot. */
const CLOTH_TOP: Partial<Record<string, number>> = { skirt: 0.04, outfit: 0.04, top: 0.3, pants: 0.02, hair: 0.5 };

const CLOTH_VERTEX_HEAD = `
uniform vec3 uSway; uniform float uSwirl; uniform float uFlare; uniform vec2 uLegF; uniform float uTime;
uniform float uStrength; uniform float uYTop; uniform float uYBot; uniform float uHair;`;
const CLOTH_VERTEX_BODY = `
{
  float span = max(0.05, uYTop - uYBot);
  float w = clamp((uYTop - position.y) / span, 0.0, 1.0);
  float w1 = w * w * (3.0 - 2.0 * w) * uStrength;
  vec2 radial = position.xz;
  float r = length(radial);
  vec2 dir = r > 1e-4 ? radial / r : vec2(0.0, 1.0);
  float skirt = 1.0 - uHair;
  // the garment trails behind the body's movement
  transformed.xz += uSway.xz * w1;
  transformed.y += uSway.y * w1;
  // and lags when the body turns
  float a = uSwirl * w1;
  float cs = cos(a); float sn = sin(a);
  transformed.xz = vec2(cs * transformed.x - sn * transformed.z, sn * transformed.x + cs * transformed.z);
  // flares outward, and a stepping leg pushes the hem in front of / behind it
  transformed.xz += dir * uFlare * w1 * skirt;
  float side = smoothstep(-0.08, 0.08, position.x);
  float push = mix(uLegF.y, uLegF.x, side);
  transformed.z += (max(push, 0.0) * smoothstep(0.0, 0.7, dir.y) - max(-push, 0.0) * smoothstep(0.0, 0.7, -dir.y)) * w1 * skirt;
  // a faint breeze keeps the cloth alive even when the body is still
  transformed.y += sin(uTime * 1.7 + atan(dir.x, dir.y) * 3.0) * 0.012 * w1 * w1;
  transformed.xz += dir * sin(uTime * 2.1 + r * 9.0) * 0.007 * w1;
}`;

/** Facial expression channels driven by animation (morphs x<Name>_pos built from MPFB's expression units). */
export type FaceKey =
  | 'blinkL' | 'blinkR' | 'smile' | 'mouthOpen' | 'browUp' | 'browDown' | 'squint'
  // emotions
  | 'sad' | 'surprise' | 'sneer' | 'pout' | 'eyeWide' | 'anger'
  // visemes (mouth shapes of speech): aa / ee / oo / oh, f-v, m-b-p
  | 'vAA' | 'vEE' | 'vOO' | 'vOH' | 'vFV' | 'vMM';
const FACE_ZERO: Record<FaceKey, number> = {
  blinkL: 0, blinkR: 0, smile: 0, mouthOpen: 0, browUp: 0, browDown: 0, squint: 0,
  sad: 0, surprise: 0, sneer: 0, pout: 0, eyeWide: 0, anger: 0, vAA: 0, vEE: 0, vOO: 0, vOH: 0, vFV: 0, vMM: 0
};
/** Channels that ease quickly (the mouth of speech) rather than at the speed of an expression. */
const FAST_FACE = new Set<FaceKey>(['vAA', 'vEE', 'vOO', 'vOH', 'vFV', 'vMM', 'mouthOpen']);
const FINGER_AXIS = new THREE.Vector3(1, 0, 0);
/** Grid cell (model units ≈ m) for the clothing fit lookup. */
const FIT_CELL = 0.04;
const fitKey = (x: number, y: number, z: number) => (x + 512) + (y + 512) * 1024 + (z + 512) * 1048576;
const fitCell = (x: number, y: number, z: number) => fitKey(Math.floor(x / FIT_CELL), Math.floor(y / FIT_CELL), Math.floor(z / FIT_CELL));

/**
 * Laplacian-smooth a per-vertex displacement over a mesh's edges. Vertices at the same position (UV / normal seams) are
 * welded first so the smoothing crosses seams instead of opening them.
 */
const smoothOverMesh = (geo: THREE.BufferGeometry, pos: THREE.BufferAttribute, disp: Float32Array, iterations: number) => {
  const n = pos.count;
  const weld = new Int32Array(n);
  const seen = new Map<string, number>();
  for (let v = 0; v < n; v++) {
    const key = `${Math.round(pos.getX(v) * 1e4)},${Math.round(pos.getY(v) * 1e4)},${Math.round(pos.getZ(v) * 1e4)}`;
    const w = seen.get(key);
    if (w === undefined) {
      seen.set(key, v);
      weld[v] = v;
    } else weld[v] = w;
  }
  const idx = geo.index ? (geo.index.array as ArrayLike<number>) : Array.from({ length: n }, (_, i) => i);
  const nbr: number[][] = Array.from({ length: n }, () => []);
  for (let t = 0; t + 2 < idx.length; t += 3) {
    const a = weld[idx[t]];
    const b = weld[idx[t + 1]];
    const c = weld[idx[t + 2]];
    nbr[a].push(b, c);
    nbr[b].push(a, c);
    nbr[c].push(a, b);
  }
  // welded copies share the displacement of their representative
  for (let v = 0; v < n; v++) if (weld[v] !== v) for (let k = 0; k < 3; k++) disp[v * 3 + k] = disp[weld[v] * 3 + k];
  const next = new Float32Array(disp.length);
  for (let it = 0; it < iterations; it++) {
    for (let v = 0; v < n; v++) {
      const r = weld[v];
      const list = nbr[r];
      if (r !== v || !list.length) {
        for (let k = 0; k < 3; k++) next[v * 3 + k] = disp[r * 3 + k];
        continue;
      }
      for (let k = 0; k < 3; k++) {
        let sum = 0;
        for (const m of list) sum += disp[m * 3 + k];
        next[v * 3 + k] = disp[v * 3 + k] * 0.5 + (sum / list.length) * 0.5;
      }
    }
    disp.set(next);
    for (let v = 0; v < n; v++) if (weld[v] !== v) for (let k = 0; k < 3; k++) disp[v * 3 + k] = disp[weld[v] * 3 + k];
  }
};

export class AvatarController {
  public group = new THREE.Group();
  public ready = false;
  /** A pose taken from another skeleton's animation (see mixamo.ts): applied over the joint pose every frame while set. */
  public retarget: RetargetPose | null = null;
  /** Counts the bodies installed so far: a new body (gender switched) starts a new dressing. */
  public bodyVersion = 0;
  /** No body is being fetched (the one shown is the one asked for). */
  public get bodyIdle() { return this.loadingKey === null; }
  /** Empty nodes that follow the wrists / head / hips so weapons, ears and tail can be attached. */
  public handAnchor = { L: new THREE.Group(), R: new THREE.Group() };
  public headAnchor = new THREE.Group();
  public hipsAnchor = new THREE.Group();
  /** Which hands close around a weapon grip (set by the model when it hands out weapons). */
  public grip = { L: false, R: false };
  /** Direction of the fingers in each hand bone's own frame (the axis the forearm twists about). */
  /** Twist about the finger axis that turns the thumb side of the closed hand to face forward (found from the bind pose). */
  private baseRoll = { L: 0, R: 0 };
  private handAxis: { L: THREE.Vector3 | null; R: THREE.Vector3 | null } = { L: null, R: null };

  private loadingKey: string | null = null;
  private loadedKey: string | null = null;
  /** Gender of the loaded base: clothing files are made per gender. */
  private loadedGender: string | null = null;
  /** Moves clothing made for the jin body onto this base (null when this base is the jin body). */
  private fit: { grid: Map<number, number[]>; base: Float32Array; delta: Float32Array } | null = null;
  private model: THREE.Object3D | null = null;
  private bones = new Map<string, THREE.Bone>();
  private rest = new Map<string, BoneRest>();
  private adjPos = new Map<string, THREE.Vector3>();
  private pelvisModelPos = new THREE.Vector3();
  private bodyMesh: THREE.SkinnedMesh | null = null;
  private meshes: THREE.SkinnedMesh[] = [];
  private extra: Extra | null = null;
  private painter: MakeupPainter | null = null;
  private eyeSource: ImageBitmap | HTMLImageElement | null = null;
  private eyeKey = '';
  /** Ready-made eye textures by style id (null while loading, false if missing). */
  private eyeStyles = new Map<string, HTMLImageElement | null | false>();
  private refreshEyes: (() => void) | null = null;
  private baseScale = 1;
  private soleY = 0;
  private anchorsCache: AvatarAnchors | null = null;
  private cur: Record<J, Rot> = Object.fromEntries(JOINTS.map((j) => [j, [0, 0, 0] as Rot])) as Record<J, Rot>;
  /** Spring state and shader inputs shared by every cloth material. */
  private clothU = {
    uSway: { value: new THREE.Vector3() },
    uSwirl: { value: 0 },
    uFlare: { value: 0.02 },
    uLegF: { value: new THREE.Vector2() },
    uTime: { value: 0 }
  };
  private clothVel = new THREE.Vector3();
  private clothSwirlVel = 0;
  private clothPrev = new THREE.Vector3();
  private clothPrevYaw = 0;
  private clothMove = new THREE.Vector3();
  private clothReady = false;
  private drop = 0;
  /** Turn of the whole body about the vertical axis (the creator turns the character instead of orbiting the camera). */
  public yaw = 0;
  private frame = new THREE.Quaternion();
  /** Standing height of the group on the floor (from the rest pose) and how far the current pose moves the lowest point off it. */
  private baseY = FLOOR_Y;
  private poseLift = 0;
  private restHeadQ = new THREE.Quaternion();
  private headScale = 1;
  private lastState: CharacterState | null = null;
  private skinKey = '';
  private skinTextures = new Map<string, THREE.Texture>();

  /** Per body vertex: its index in the full MPFB basemesh (custom `_orig` attribute) and the untouched index buffer. */
  private origIndex: Float32Array | null = null;
  private fullIndex: ArrayLike<number> | null = null;
  /** Midpoint vertices added to the body mesh (see subdivide.ts): the old vertices each one lies between. */
  private subdiv: Subdivision | null = null;
  private hideRanges: Record<string, { hide?: [number, number][] }> = {};
  private gltfCache = new Map<string, Promise<GLTF>>();
  private layers = new Map<Slot, { id: string; gender: string; mesh?: THREE.SkinnedMesh }>();
  private disposed = false;

  public dispose() {
    this.disposed = true;
    this.ready = false;
    this.layers.clear();
    this.skinTextures.forEach(texture => texture.dispose());
    this.skinTextures.clear();
    this.gltfCache.forEach(promise => { void promise.then(gltf => disposeObject(gltf.scene)).catch(() => undefined); });
    this.gltfCache.clear();
  }

  constructor(private onReady: () => void) {
    this.group.visible = false;
    this.group.add(this.handAnchor.L, this.handAnchor.R, this.headAnchor, this.hipsAnchor);
  }

  private load(url: string): Promise<GLTF> {
    let p = this.gltfCache.get(url);
    if (!p) {
      p = new GLTFLoader().loadAsync(url);
      this.gltfCache.set(url, p);
    }
    return p;
  }

  public ensureLoaded(gender: string) {
    const g = gender === 'male' ? 'male' : 'female';
    const key = bodyModelKey(g);
    if ((this.ready && this.loadedKey === key) || this.loadingKey === key) return;
    this.loadingKey = key;
    Promise.all([
      fetch(`/models/${key}_extra.json`).then((r) => r.json() as Promise<Extra>),
      new GLTFLoader().loadAsync(`/models/${key}.glb`),
      fetch(`/models/${key}.delta.bin`)
        // a dev server answers a missing file with index.html: only accept binary data
        .then((r) => (r.ok && !(r.headers.get('content-type') ?? '').includes('text/html') ? r.arrayBuffer() : null))
        .then((b) => (b ? new Float32Array(b) : null))
        .catch(() => null)
    ])
      .then(([extra, gltf, delta]) => {
        // a newer request (gender switched meanwhile) wins
        if (this.loadingKey !== key) {
          disposeObject(gltf.scene);
          return;
        }
        this.install(g, key, extra, gltf, delta);
      })
      .catch((e) => {
        console.error('Failed to load MPFB model', e);
        if (this.loadingKey === key) this.loadingKey = null;
      });
  }

  private install(g: string, key: string, extra: Extra, gltf: GLTF, delta: Float32Array | null) {
    if (this.disposed) {
      disposeObject(gltf.scene);
      return;
    }
    if (this.model) {
      this.group.remove(this.model);
      this.model.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
    }
    this.layers.forEach((l) => l.mesh?.geometry.dispose());
    this.layers.clear();
    this.skinKey = '';
    fetch(`/models/assets/manifest.${g}.json`)
      .then((r) => r.json())
      .then((m) => {
        if (this.disposed) return;
        this.hideRanges = m;
        this.refreshMask();
      })
      .catch(() => undefined);
    this.bones.clear();
    this.rest.clear();
    this.adjPos.clear();
    this.meshes = [];
    this.extra = extra;
    this.painter = new MakeupPainter(extra);
    this.eyeKey = '';

    const root = gltf.scene;
    this.model = root;
    this.group.add(root);
    root.updateMatrixWorld(true);
    root.traverse((o) => {
      if ((o as THREE.Bone).isBone) {
        const b = o as THREE.Bone;
        this.bones.set(b.name, b);
        this.rest.set(b.name, { q: b.quaternion.clone(), p: b.position.clone(), worldQ: b.getWorldQuaternion(new THREE.Quaternion()) });
        this.adjPos.set(b.name, b.position.clone());
      }
      if ((o as THREE.SkinnedMesh).isSkinnedMesh) {
        const m = o as THREE.SkinnedMesh;
        m.frustumCulled = false;
        m.castShadow = true;
        m.receiveShadow = true;
        m.material = (m.material as THREE.Material).clone();
        this.meshes.push(m);
        if (m.name === 'Body') this.bodyMesh = m;
        if (m.name === 'eyes') {
          const map = (m.material as THREE.MeshStandardMaterial).map;
          this.eyeSource = (map?.image as ImageBitmap | HTMLImageElement) ?? null;
        }
      }
    });
    this.origIndex = null;
    this.fullIndex = null;
    this.subdiv = null;
    if (this.bodyMesh) {
      this.subdiv = subdivideBody(this.bodyMesh.geometry);
      const geo = this.bodyMesh.geometry;
      const key = Object.keys(geo.attributes).find((k) => k.toLowerCase().startsWith('_orig'));
      if (key) this.origIndex = Float32Array.from({ length: geo.attributes[key].count }, (_, i) => geo.attributes[key].getX(i));
      if (geo.index) this.fullIndex = (geo.index.array as Uint16Array | Uint32Array).slice();
    }
    this.buildFit(delta);
    this.painter?.drawLips();
    if (this.bodyMesh) installOverlay(this.bodyMesh.material as THREE.MeshStandardMaterial, this.painter);

    // measure in the group's own space: after a gender switch the group still carries the previous body's scale and lift
    this.group.updateMatrixWorld(true);
    const toGroup = this.group.matrixWorld.clone().invert();
    const box = new THREE.Box3();
    this.meshes.forEach((m) => {
      m.computeBoundingBox();
      box.union(m.boundingBox!.clone().applyMatrix4(toGroup.clone().multiply(m.matrixWorld)));
    });
    this.soleY = box.min.y;
    this.baseScale = TARGET_HEIGHT / (box.max.y - box.min.y);
    this.restHeadQ.copy(this.rest.get('head')?.worldQ ?? new THREE.Quaternion());
    this.loadedGender = g;
    this.loadedKey = key;
    this.loadingKey = null;
    this.attachSockets();
    this.bodyVersion++;
    this.ready = true;
    this.onReady();
  }

  /** World position of a skeleton bone (the origin until a body has loaded). */
  public boneWorld(name: string, out: THREE.Vector3) {
    const b = this.bones.get(name);
    return b ? out.setFromMatrixPosition(b.matrixWorld) : out.set(0, 0, 0);
  }

  private bone(name: string) {
    return this.bones.get(name);
  }

  /**
   * Weapon sockets: a node rigidly attached to each hand bone, in the middle of the palm. Its +y axis runs across the palm from the
   * little finger to the thumb (the way a fist closes around a grip), +x along the fingers, so a weapon built with its grip at the
   * origin and its long axis on +y sits in the closed hand and follows every wrist / forearm / shoulder rotation.
   */
  private attachSockets() {
    (['L', 'R'] as const).forEach((side) => {
      const sx = side === 'L' ? 'l' : 'r';
      const hand = this.bone(`hand_${sx}`);
      const mid = this.bone(`middle_01_${sx}`);
      const th = this.bone(`thumb_01_${sx}`);
      const pk = this.bone(`pinky_01_${sx}`);
      if (!hand || !mid || !th || !pk) return;
      const f = mid.position.clone().normalize();
      const lat = th.position.clone().sub(pk.position);
      lat.addScaledVector(f, -lat.dot(f)).normalize();
      const nrm = new THREE.Vector3().crossVectors(f, lat);
      this.handAxis[side] = f.clone();
      // bind pose: twist that carries the pinky→thumb direction onto the character's front, measured about the finger axis
      hand.updateWorldMatrix(true, false);
      const qh = hand.getWorldQuaternion(new THREE.Quaternion());
      const fw = f.clone().applyQuaternion(qh).normalize();
      const flat = (v: THREE.Vector3) => v.clone().addScaledVector(fw, -v.dot(fw)).normalize();
      const from = flat(lat.clone().applyQuaternion(qh));
      const to = flat(new THREE.Vector3(0, 0, 1));
      this.baseRoll[side] = Math.atan2(new THREE.Vector3().crossVectors(from, to).dot(fw), from.dot(to));
      const a = this.handAnchor[side];
      a.position.copy(mid.position).multiplyScalar(0.55).addScaledVector(nrm, SOCKET_PALM[side]);
      a.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(f, lat, nrm));
      a.scale.setScalar(1);
      hand.add(a);
    });
  }

  /**
   * Where a prop modelled in the bind pose (MPFB's carried weapons sit around the character's hand) goes under the weapon group:
   * the hand bone's bind matrix undone, then the hand anchor's own offset.
   */
  public propMatrix(side: 'L' | 'R'): THREE.Matrix4 | null {
    const bone = this.bone(`hand_${side.toLowerCase()}`);
    const skin = this.meshes.find((m) => m.skeleton)?.skeleton;
    if (!bone || !skin) return null;
    const i = skin.bones.indexOf(bone);
    if (i < 0) return null;
    const a = this.handAnchor[side];
    a.updateMatrix();
    return new THREE.Matrix4().copy(a.matrix).invert().multiply(skin.boneInverses[i]);
  }

  /** Close (or relax) the fingers of one hand around a grip. */
  private curlFingers(sx: string, closed: boolean) {
    const AMOUNT: Record<string, number> = { index: 1.35, middle: 1.45, ring: 1.5, pinky: 1.5, thumb: 0.5 };
    for (const [finger, a] of Object.entries(AMOUNT)) {
      for (let i = 1; i <= 3; i++) {
        const b = this.bone(`${finger}_0${i}_${sx}`);
        if (!b) continue;
        const q0 = (b.userData.q0 ??= b.quaternion.clone()) as THREE.Quaternion;
        b.quaternion.copy(q0);
        if (closed) b.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(FINGER_AXIS, a * (finger === 'thumb' ? 1 : i === 1 ? 0.8 : 1)));
      }
    }
    this.bone(`hand_${sx}`)?.updateWorldMatrix(false, true);
  }

  private worldPos(name: string) {
    const b = this.bones.get(name);
    return b ? new THREE.Vector3().setFromMatrixPosition(b.matrixWorld) : new THREE.Vector3();
  }

  /* ───────────────────────── state → morphs, joints, looks ───────────────────────── */

  public apply(state: CharacterState) {
    if (!this.ready || !this.extra) return;
    this.lastState = state;
    const b = state.body as unknown as Record<string, number>;

    // morph influences by name
    const influence = morphInfluence(state);
    if (this.painter?.follow(influence)) this.painter.paint(state.cosmetics);
    this.meshes.forEach((m) => {
      const dict = m.morphTargetDictionary;
      const inf = m.morphTargetInfluences;
      if (!dict || !inf) return;
      inf.fill(0);
      influence.forEach((val, name) => {
        const i = dict[name];
        if (i !== undefined) inf[i] = val;
      });
    });

    this.adjustJoints(influence);
    this.updateClothAnchors();

    this.headScale = b.headSize;
    const s = this.baseScale * b.height;
    this.group.scale.setScalar(s);
    this.baseY = FLOOR_Y - this.lowestY() * s;
    this.group.position.y = this.baseY + this.poseLift;

    this.syncLooks(state);
    this.tintMaterials(state);
    this.group.updateMatrixWorld(true);
    this.anchorsCache = {
      headY: this.worldPos('head').y + 0.1 * s,
      chestY: this.worldPos('spine_03').y,
      waistY: this.worldPos('spine_01').y,
      feetY: FLOOR_Y,
      height: TARGET_HEIGHT * b.height,
      scale: s
    };
  }

  /** Vertices near the bottom of a mesh's bind pose (the feet), so the lowest-point search does not skin the whole body. */
  private footVerts = new WeakMap<THREE.SkinnedMesh, Uint32Array>();
  private footCandidates(m: THREE.SkinnedMesh) {
    let c = this.footVerts.get(m);
    if (!c) {
      const pos = m.geometry.attributes.position;
      m.geometry.boundingBox ?? m.geometry.computeBoundingBox();
      const { min, max } = m.geometry.boundingBox!;
      const limit = min.y + (max.y - min.y) * (m.name === 'Body' ? 0.12 : 1);
      const idx: number[] = [];
      for (let i = 0; i < pos.count; i++) if (pos.getY(i) <= limit) idx.push(i);
      c = Uint32Array.from(idx);
      this.footVerts.set(m, c);
    }
    return c;
  }

  /** Feet plus a coarse sample of the rest of the mesh: once posed (sitting, kneeling) the lowest point may be a hip or a knee. */
  private sparseVerts = new WeakMap<THREE.SkinnedMesh, Uint32Array>();
  private posedCandidates(m: THREE.SkinnedMesh) {
    let c = this.sparseVerts.get(m);
    if (!c) {
      const set = new Set<number>(this.footCandidates(m));
      for (let i = 0; i < m.geometry.attributes.position.count; i += 6) set.add(i);
      c = Uint32Array.from(set);
      this.sparseVerts.set(m, c);
    }
    return c;
  }

  /** Lowest point of the posed body and shoes in world space (the body may be tilted or lying down, unlike `lowestY`). */
  public lowestWorldY() {
    this.group.updateMatrixWorld(true);
    const v = new THREE.Vector3();
    let low = Infinity;
    for (const m of [this.bodyMesh, this.layers.get('shoes')?.mesh]) {
      if (!m) continue;
      m.skeleton.update();
      for (const i of this.posedCandidates(m)) {
        m.getVertexPosition(i, v).applyMatrix4(m.matrixWorld);
        if (v.y < low) low = v.y;
      }
    }
    return Number.isFinite(low) ? low : null;
  }

  /**
   * Lowest point of the body and worn shoes as they stand now (morphs, joint shifts and skinning included), in the group's own
   * space. Sliders such as leg length and shoes with thick soles or heels move it, so measuring it once at load is not enough.
   */
  private lowestY(posed = false) {
    this.group.updateMatrixWorld(true);
    const inv = this.group.matrixWorld.clone().invert();
    const toGroup = new THREE.Matrix4();
    const v = new THREE.Vector3();
    let low = Infinity;
    for (const m of [this.bodyMesh, this.layers.get('shoes')?.mesh]) {
      if (!m) continue;
      m.skeleton.update();
      toGroup.multiplyMatrices(inv, m.matrixWorld);
      for (const i of posed ? this.posedCandidates(m) : this.footCandidates(m)) {
        m.getVertexPosition(i, v).applyMatrix4(toGroup);
        if (v.y < low) low = v.y;
      }
    }
    return Number.isFinite(low) ? low : this.soleY;
  }

  /** Move every joint to where the morphs put it and rebuild the inverse bind matrices to match. */
  private adjustJoints(influence: Map<string, number>) {
    if (!this.extra || !this.model) return;
    const delta = new Map<string, THREE.Vector3>();
    Object.entries(this.extra.bones).forEach(([bone, keys]) => {
      const d = new THREE.Vector3();
      for (const [key, v] of Object.entries(keys)) {
        const w = influence.get(key);
        if (w) d.add(new THREE.Vector3(v[0], v[1], v[2]).multiplyScalar(w));
      }
      delta.set(bone, d);
    });

    const tmp = new THREE.Vector3();
    this.bones.forEach((bn, name) => {
      const r = this.rest.get(name)!;
      const parent = bn.parent as THREE.Bone | null;
      const parentIsBone = !!parent && (parent as THREE.Bone).isBone;
      const dc = delta.get(name);
      const dp = parentIsBone ? delta.get(parent!.name) : undefined;
      const p = this.adjPos.get(name)!;
      p.copy(r.p);
      if (parentIsBone && (dc || dp)) {
        tmp.set(0, 0, 0);
        if (dc) tmp.add(dc);
        if (dp) tmp.sub(dp);
        const pq = this.rest.get(parent!.name)!.worldQ.clone().invert();
        p.add(tmp.applyQuaternion(pq));
      } else if (!parentIsBone && dc) {
        p.add(dc);
      }
      bn.position.copy(p);
      bn.quaternion.copy(r.q);
      bn.scale.set(1, 1, 1);
    });
    this.model.updateMatrixWorld(true);

    const inv = new THREE.Matrix4().copy(this.model.matrixWorld).invert();
    const seen = new Set<THREE.Skeleton>();
    this.meshes.forEach((m) => {
      if (seen.has(m.skeleton)) return;
      seen.add(m.skeleton);
      m.skeleton.bones.forEach((bn, i) => {
        m.skeleton.boneInverses[i].copy(inv).multiply(bn.matrixWorld).invert();
      });
    });
    const pel = this.bone('pelvis');
    if (pel) this.pelvisModelPos.setFromMatrixPosition(new THREE.Matrix4().copy(inv).multiply(pel.matrixWorld));
  }

  /* ───────────────────────── hair / outfit / shoes / hat ───────────────────────── */

  private syncLooks(state: CharacterState) {
    const g = this.loadedGender!;
    SLOT_IDS.forEach((slot) => this.setSlot(slot, equipped(state, slot), g));
    // worn eyebrows / eyelashes replace the built-in ones
    this.meshes.forEach((m) => {
      if (m.name === 'eyebrows') m.visible = !equipped(state, 'eyebrows');
      if (m.name === 'eyelashes') m.visible = !equipped(state, 'eyelashes');
      if (m.name === 'teeth') m.visible = !equipped(state, 'teeth');
    });
  }

  /** Number of clothing / hair files still loading. */
  private pending = 0;
  public get assetsLoading() { return this.pending > 0; }
  public get skinReady() { return !!this.skinTextures.get(this.skinKey)?.image?.width; }

  /** Resolves once every requested asset has loaded (or after `timeout` ms). */
  public settled(timeout = 6000): Promise<void> {
    const t0 = performance.now();
    return new Promise((resolve) => {
      const tick = () => (this.pending <= 0 || performance.now() - t0 > timeout ? resolve() : setTimeout(tick, 60));
      tick();
    });
  }

  private setSlot(slot: Slot, id: string | null, gender: string) {
    const cur = this.layers.get(slot);
    if (cur && cur.id === (id ?? '') && cur.gender === gender) return;
    if (cur?.mesh) {
      cur.mesh.removeFromParent();
      cur.mesh.geometry.dispose();
      this.meshes = this.meshes.filter((m) => m !== cur.mesh);
      cur.mesh = undefined;
      this.refreshMask();
    }
    if (!id) {
      this.layers.set(slot, { id: '', gender });
      return;
    }
    this.layers.set(slot, { id, gender });
    this.pending++;
    this.load(assetUrl(id, gender, 'glb'))
      .finally(() => this.pending--)
      .then((gltf) => {
        const want = this.layers.get(slot);
        if (!want || want.id !== id || want.gender !== gender || !this.bodyMesh || !this.model) return;
        let src: THREE.SkinnedMesh | null = null;
        gltf.scene.traverse((o) => {
          if (!src && (o as THREE.SkinnedMesh).isSkinnedMesh) src = o as THREE.SkinnedMesh;
        });
        if (!src) return;
        const mesh = this.rebind(src, slot);
        if (COVERS_SKIN.has(slot)) mesh.userData.covered = this.skinUnder(mesh);
        want.mesh = mesh;
        this.model.add(mesh);
        this.meshes.push(mesh);
        this.refreshMask();
        if (this.lastState) this.apply(this.lastState);
      })
      .catch((e) => console.warn('asset failed', id, e));
  }

  /** Hide the body triangles that touch a vertex covered by a worn asset (as MakeHuman / MPFB do). */
  /**
   * Skin the garment lies over, as original body vertex indices: every body vertex just behind the cloth surface (or within a
   * few mm in front of it) near one of its vertices. Measured on the unmorphed shapes, where the cloth sits over the skin; hiding
   * these keeps skin from poking through when sliders (bust, weight …) push the body further than the cloth follows. MPFB's own
   * delete groups often leave such areas (e.g. the bust under sweaters) uncovered.
   */
  private skinUnder(mesh: THREE.SkinnedMesh): number[] {
    const body = this.bodyMesh?.geometry;
    const orig = this.origIndex;
    if (!body || !orig) return [];
    return this.under(body, mesh).map((v) => orig[v]);
  }

  /** Vertices of `target` that lie just under the cloth of `mesh` (same bind space), by the rules described at skinUnder. */
  private under(body: THREE.BufferGeometry, mesh: THREE.SkinnedMesh, opt: { maxDist?: number; rimRings?: number; align?: number } = {}): number[] {
    const MAXD = opt.maxDist ?? 0.02;
    const RINGS = opt.rimRings ?? 2;
    const ALIGN = opt.align ?? 0.5;
    const bp = body.attributes.position as THREE.BufferAttribute;
    const gp = mesh.geometry.attributes.position as THREE.BufferAttribute;
    const gn = mesh.geometry.attributes.normal as THREE.BufferAttribute | undefined;
    if (!gn) return [];
    // vertices on the cloth's open edges (hems, neck and sleeve openings): skin near them may be visible, never hide it
    const weld = new Map<string, number>();
    const wid = new Int32Array(gp.count);
    for (let i = 0; i < gp.count; i++) {
      const k = `${Math.round(gp.getX(i) * 1e4)},${Math.round(gp.getY(i) * 1e4)},${Math.round(gp.getZ(i) * 1e4)}`;
      let w = weld.get(k);
      if (w === undefined) weld.set(k, (w = weld.size));
      wid[i] = w;
    }
    const idx = mesh.geometry.index;
    const edges = new Map<string, number>();
    const tri = idx ? idx.count : gp.count;
    const at = (n: number) => (idx ? idx.getX(n) : n);
    for (let t = 0; t + 2 < tri; t += 3) {
      const a = wid[at(t)], b = wid[at(t + 1)], c = wid[at(t + 2)];
      for (const [u, v] of [[a, b], [b, c], [c, a]]) {
        const k = u < v ? `${u}_${v}` : `${v}_${u}`;
        edges.set(k, (edges.get(k) ?? 0) + 1);
      }
    }
    const rim = new Uint8Array(weld.size);
    const nbr: number[][] = Array.from({ length: weld.size }, () => []);
    edges.forEach((n, k) => {
      const [u, v] = k.split('_').map(Number);
      nbr[u].push(v);
      nbr[v].push(u);
      if (n === 1) rim[u] = rim[v] = 1;
    });
    // grow the rim by two rings: skin right beside an opening is never under the cloth
    for (let ring = 0; ring < RINGS; ring++) {
      const grow: number[] = [];
      rim.forEach((r, w) => {
        if (r) for (const n of nbr[w]) if (!rim[n]) grow.push(n);
      });
      grow.forEach((w) => (rim[w] = 1));
    }
    const bn = body.attributes.normal as THREE.BufferAttribute;
    const CELL = Math.max(0.035, MAXD);
    const key = (x: number, y: number, z: number) => `${Math.floor(x / CELL)},${Math.floor(y / CELL)},${Math.floor(z / CELL)}`;
    const grid = new Map<string, number[]>();
    for (let i = 0; i < gp.count; i++) {
      const k = key(gp.getX(i), gp.getY(i), gp.getZ(i));
      let c = grid.get(k);
      if (!c) grid.set(k, (c = []));
      c.push(i);
    }
    const out: number[] = [];
    const MAX2 = CELL * CELL;
    for (let v = 0; v < bp.count; v++) {
      const x = bp.getX(v), y = bp.getY(v), z = bp.getZ(v);
      const cx = Math.floor(x / CELL), cy = Math.floor(y / CELL), cz = Math.floor(z / CELL);
      let best = -1;
      let bestD = MAX2;
      for (let dx = -1; dx <= 1; dx++)
        for (let dy = -1; dy <= 1; dy++)
          for (let dz = -1; dz <= 1; dz++) {
            const c = grid.get(`${cx + dx},${cy + dy},${cz + dz}`);
            if (!c) continue;
            for (const i of c) {
              const ex = x - gp.getX(i), ey = y - gp.getY(i), ez = z - gp.getZ(i);
              const d = ex * ex + ey * ey + ez * ez;
              if (d < bestD) {
                bestD = d;
                best = i;
              }
            }
          }
      if (best < 0 || (RINGS >= 0 && rim[wid[best]]) || bestD > MAXD * MAXD) continue;
      // the skin must face the same way as the cloth over it (not the side of a fold or an edge)
      if (bn.getX(v) * gn.getX(best) + bn.getY(v) * gn.getY(best) + bn.getZ(v) * gn.getZ(best) < ALIGN) continue;
      // signed distance along the cloth normal: negative = the skin is under the cloth
      const s = (x - gp.getX(best)) * gn.getX(best) + (y - gp.getY(best)) * gn.getY(best) + (z - gp.getZ(best)) * gn.getZ(best);
      if (s < 0.004) out.push(v);
    }
    return out;
  }

  /**
   * Vertices of a top below the waistline of trousers / a skirt: the waistline is the garment's upper open edge, sampled as a
   * height per direction around the body, so low-rise backs and high waists both work and bulky knits never poke out.
   */
  private belowWaist(target: THREE.BufferGeometry, outer: THREE.SkinnedMesh): number[] {
    const gp = outer.geometry.attributes.position as THREE.BufferAttribute;
    const idx = outer.geometry.index;
    if (!idx) return [];
    const weld = new Map<string, number>();
    const wid = new Int32Array(gp.count);
    for (let i = 0; i < gp.count; i++) {
      const k = `${Math.round(gp.getX(i) * 1e4)},${Math.round(gp.getY(i) * 1e4)},${Math.round(gp.getZ(i) * 1e4)}`;
      let w = weld.get(k);
      if (w === undefined) weld.set(k, (w = weld.size));
      wid[i] = w;
    }
    const edges = new Map<string, number>();
    const firstOf = new Int32Array(weld.size).fill(-1);
    for (let i = 0; i < gp.count; i++) if (firstOf[wid[i]] < 0) firstOf[wid[i]] = i;
    for (let t = 0; t + 2 < idx.count; t += 3) {
      const a = wid[idx.getX(t)], b = wid[idx.getX(t + 1)], c = wid[idx.getX(t + 2)];
      for (const [u, v] of [[a, b], [b, c], [c, a]]) {
        const k = u < v ? `${u}_${v}` : `${v}_${u}`;
        edges.set(k, (edges.get(k) ?? 0) + 1);
      }
    }
    // the open edge nearest the top of the garment is its waistline
    let topY = -Infinity, cx = 0, cz = 0;
    for (let i = 0; i < gp.count; i++) {
      topY = Math.max(topY, gp.getY(i));
      cx += gp.getX(i);
      cz += gp.getZ(i);
    }
    cx /= gp.count;
    cz /= gp.count;
    const BINS = 32;
    const waist = new Float32Array(BINS).fill(-Infinity);
    const reach = new Float32Array(BINS);
    edges.forEach((n, k) => {
      if (n !== 1) return;
      for (const w of k.split('_').map(Number)) {
        const i = firstOf[w];
        const y = gp.getY(i);
        if (y < topY - 0.09) continue;
        const b = Math.floor(((Math.atan2(gp.getX(i) - cx, gp.getZ(i) - cz) / (Math.PI * 2) + 0.5) * BINS)) % BINS;
        waist[b] = Math.max(waist[b], y);
        reach[b] = Math.max(reach[b], Math.hypot(gp.getX(i) - cx, gp.getZ(i) - cz));
      }
    });
    // how far out the garment reaches in each direction at any height (sleeves hanging beside the hips stay outside)
    for (let i = 0; i < gp.count; i++) {
      const b = Math.floor(((Math.atan2(gp.getX(i) - cx, gp.getZ(i) - cz) / (Math.PI * 2) + 0.5) * BINS)) % BINS;
      if (gp.getY(i) > topY - 0.3) reach[b] = Math.max(reach[b], Math.hypot(gp.getX(i) - cx, gp.getZ(i) - cz));
    }
    // fill directions the edge sampling missed from their neighbours
    for (let pass = 0; pass < BINS; pass++)
      for (let b = 0; b < BINS; b++)
        if (!Number.isFinite(waist[b])) {
          const l = waist[(b + BINS - 1) % BINS], r = waist[(b + 1) % BINS];
          if (Number.isFinite(l) || Number.isFinite(r)) waist[b] = Number.isFinite(l) && Number.isFinite(r) ? (l + r) / 2 : Number.isFinite(l) ? l : r;
        }
    for (let b = 0; b < BINS; b++) if (!reach[b]) reach[b] = Math.max(reach[(b + BINS - 1) % BINS], reach[(b + 1) % BINS]);
    const tp = target.attributes.position as THREE.BufferAttribute;
    const out: number[] = [];
    for (let v = 0; v < tp.count; v++) {
      const b = Math.floor(((Math.atan2(tp.getX(v) - cx, tp.getZ(v) - cz) / (Math.PI * 2) + 0.5) * BINS)) % BINS;
      const y = tp.getY(v);
      if (!Number.isFinite(waist[b]) || y >= waist[b] - 0.012 || y < topY - 0.45) continue;
      if (Math.hypot(tp.getX(v) - cx, tp.getZ(v) - cz) > reach[b] + 0.02) continue;
      out.push(v);
    }
    return out;
  }

  /** Hide the part of the top that is tucked under trousers or a skirt (it would otherwise poke through at the waist). */
  private refreshTuck() {
    const top = this.layers.get('top')?.mesh;
    if (!top) return;
    const geo = top.geometry;
    const full = (top.userData.fullIndex ??= geo.index ? (geo.index.array as Uint16Array | Uint32Array).slice() : null) as Uint16Array | Uint32Array | null;
    if (!full) return;
    const hidden = new Uint8Array(geo.attributes.position.count);
    (['pants', 'skirt'] as const).forEach((slot) => {
      const outer = this.layers.get(slot)?.mesh;
      if (!outer) return;
      const key = `${this.layers.get(slot)!.id}`;
      const cache = (top.userData.tuck ??= {}) as Record<string, number[]>;
      const list = (cache[key] ??= this.belowWaist(geo, outer));
      for (const v of list) hidden[v] = 1;
    });
    const out: number[] = [];
    for (let i = 0; i < full.length; i += 3) {
      // drop a triangle only when it is entirely below the waistline, so the cut stays hidden under the waistband
      if (hidden[full[i]] && hidden[full[i + 1]] && hidden[full[i + 2]]) continue;
      out.push(full[i], full[i + 1], full[i + 2]);
    }
    geo.setIndex(out);
  }

  private refreshUnderwear() {
    maskInnerGarments(
      (slot) => this.layers.get(slot)?.mesh,
      (geometry, outer) => this.under(geometry, outer, { maxDist: 0.05 })
    );
  }

  private refreshMask() {
    this.refreshUnderwear();
    this.refreshTuck();
    const geo = this.bodyMesh?.geometry;
    if (!geo || !this.origIndex || !this.fullIndex || !this.loadedGender) return;
    const hidden = new Uint8Array(ORIG_BASE + (this.subdiv ? this.subdiv.parents.length / 2 : 0));
    // covered underwear is not drawn (see tintMaterials) and must not cut the skin either (the outer garment hides what it covers)
    const wearing = (slot: Slot) => !!this.layers.get(slot)?.mesh;
    this.layers.forEach((l, slot) => {
      if (!l.mesh) return;
      if (slot === 'underwear_top' && (wearing('top') || wearing('outfit'))) return;
      if (slot === 'underwear_bottom' && (wearing('pants') || wearing('outfit'))) return;
      for (const [a, b] of this.hideRanges[l.id]?.hide ?? []) hidden.fill(1, a, b + 1);
      for (const v of (l.mesh.userData.covered as number[] | undefined) ?? []) hidden[v] = 1;
    });
    // a midpoint vertex is covered when it was found under a garment, or when both vertices it lies between are
    if (this.subdiv) {
      const par = this.subdiv.parents;
      for (let j = 0; j < par.length / 2; j++) {
        if (hidden[this.origIndex[par[j * 2]]] && hidden[this.origIndex[par[j * 2 + 1]]]) hidden[ORIG_BASE + j] = 1;
      }
    }
    const src = this.fullIndex;
    const out: number[] = [];
    for (let i = 0; i < src.length; i += 3) {
      const a = src[i];
      const b = src[i + 1];
      const c = src[i + 2];
      // Cull a skin face only when most of it is under clothing. A single
      // covered vertex at a garment edge must not remove the whole triangle.
      const covered = Number(!!hidden[this.origIndex[a]]) + Number(!!hidden[this.origIndex[b]]) + Number(!!hidden[this.origIndex[c]]);
      if (covered >= 2) continue;
      out.push(a, b, c);
    }
    geo.setIndex(out);
  }

  /**
   * Index the body the clothes were made for as it would sit inside this base: each body vertex at that position, with
   * how far it moves to reach this base's shape. Clothing vertices then follow their nearest jin body vertices (see fitGeometry).
   */
  private buildFit(delta: Float32Array | null) {
    this.fit = null;
    if (!delta || !this.bodyMesh || !this.origIndex) return;
    if (!delta.some((d) => Math.abs(d) > 1e-5)) return;
    const pos = this.bodyMesh.geometry.getAttribute('position');
    const n = pos.count;
    const base = new Float32Array(n * 3);
    const dv = new Float32Array(n * 3);
    const grid = new Map<number, number[]>();
    for (let i = 0; i < n; i++) {
      const oi = this.origIndex[i];
      const sub = this.subdiv;
      const o = oi * 3;
      const j = oi >= ORIG_BASE && sub ? oi - ORIG_BASE : -1;
      const oa = j >= 0 ? this.origIndex[sub!.parents[j * 2]] * 3 : 0;
      const ob = j >= 0 ? this.origIndex[sub!.parents[j * 2 + 1]] * 3 : 0;
      for (let k = 0; k < 3; k++) {
        dv[i * 3 + k] = j >= 0 ? ((delta[oa + k] ?? 0) + (delta[ob + k] ?? 0)) * 0.5 : delta[o + k] ?? 0;
        base[i * 3 + k] = pos.getComponent(i, k) - dv[i * 3 + k];
      }
      const cell = fitCell(base[i * 3], base[i * 3 + 1], base[i * 3 + 2]);
      const list = grid.get(cell);
      if (list) list.push(i);
      else grid.set(cell, [i]);
    }
    this.fit = { grid, base, delta: dv };
  }

  /**
   * Move a clothing / hair geometry made for the jin body onto this base. Each vertex takes a distance-weighted blend of
   * the deltas of its nearest jin body vertices; the result is then smoothed over the cloth mesh itself, so neighbouring
   * cloth vertices that latched onto different limbs (a skirt between the thighs) cannot tear apart.
   */
  private fitGeometry(geo: THREE.BufferGeometry) {
    const f = this.fit;
    if (!f) return;
    const pos = geo.getAttribute('position') as THREE.BufferAttribute;
    const n = pos.count;
    const disp = new Float32Array(n * 3);
    const K = 8;
    const best: { i: number; d: number }[] = [];
    for (let v = 0; v < n; v++) {
      const x = pos.getX(v);
      const y = pos.getY(v);
      const z = pos.getZ(v);
      const cx = Math.floor(x / FIT_CELL);
      const cy = Math.floor(y / FIT_CELL);
      const cz = Math.floor(z / FIT_CELL);
      best.length = 0;
      for (let r = 1; r <= 4 && best.length < K; r++) {
        for (let a = -r; a <= r; a++)
          for (let b = -r; b <= r; b++)
            for (let c = -r; c <= r; c++) {
              // only the shell of the cube: the inner cells were searched with a smaller r
              if (r > 1 && Math.max(Math.abs(a), Math.abs(b), Math.abs(c)) !== r) continue;
              const list = f.grid.get(fitKey(cx + a, cy + b, cz + c));
              if (!list) continue;
              for (const i of list) {
                const dx = f.base[i * 3] - x;
                const dy = f.base[i * 3 + 1] - y;
                const dz = f.base[i * 3 + 2] - z;
                const d = dx * dx + dy * dy + dz * dz;
                if (best.length < K) best.push({ i, d });
                else if (d < best[K - 1].d) best[K - 1] = { i, d };
                else continue;
                best.sort((p, q) => p.d - q.d);
              }
            }
      }
      if (!best.length) continue;
      // Gaussian falloff around the nearest distance: smooth across the K neighbours, not dominated by one vertex
      const s2 = Math.max(best[0].d, 0.0004) * 4;
      let w = 0;
      let mx = 0;
      let my = 0;
      let mz = 0;
      for (const { i, d } of best) {
        const k = Math.exp(-d / s2);
        w += k;
        mx += f.delta[i * 3] * k;
        my += f.delta[i * 3 + 1] * k;
        mz += f.delta[i * 3 + 2] * k;
      }
      disp[v * 3] = mx / w;
      disp[v * 3 + 1] = my / w;
      disp[v * 3 + 2] = mz / w;
    }
    smoothOverMesh(geo, pos, disp, 6);
    for (let v = 0; v < n; v++) pos.setXYZ(v, pos.getX(v) + disp[v * 3], pos.getY(v) + disp[v * 3 + 1], pos.getZ(v) + disp[v * 3 + 2]);
    pos.needsUpdate = true;
    geo.computeBoundingBox();
    geo.computeBoundingSphere();
  }

  /** Make a garment's material move with the cloth simulation (see CLOTH_STRENGTH). */
  private installCloth(mat: THREE.MeshStandardMaterial, slot: Slot, geo: THREE.BufferGeometry) {
    const strength = CLOTH_STRENGTH[slot];
    if (!strength) return;
    geo.boundingBox ?? geo.computeBoundingBox();
    const own = { uStrength: { value: strength }, uYTop: { value: 0.9 }, uYBot: { value: geo.boundingBox!.min.y }, uHair: { value: slot === 'hair' ? 1 : 0 } };
    mat.userData.cloth = { slot, ...own };
    mat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, this.clothU, own);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>\n${CLOTH_VERTEX_HEAD}`)
        .replace('#include <skinning_vertex>', `#include <skinning_vertex>\n${CLOTH_VERTEX_BODY}`);
    };
    mat.customProgramCacheKey = () => 'cloth-v1';
  }

  /** Re-anchor every garment's weight to the hips (they move with the body shape sliders). */
  private updateClothAnchors() {
    this.meshes.forEach((m) => {
      const c = (m.material as THREE.Material).userData?.cloth as { slot: string; uYTop: { value: number } } | undefined;
      if (c) c.uYTop.value = this.pelvisModelPos.y + (CLOTH_TOP[c.slot] ?? 0);
    });
  }

  /**
   * Spring-damper simulation of loose cloth. The hips' velocity (in the body's own frame) drags the hem behind, a turn of the
   * body swirls it, a leg stepping forward or back pushes the hem, and speed makes it flare. Everything is critically soft so the
   * motion settles; large steps (a teleport, a slow frame) are clamped.
   */
  private updateCloth(dt: number) {
    const u = this.clothU;
    const d = Math.min(Math.max(dt, 1 / 240), 0.05);
    u.uTime.value += dt;
    this.group.updateMatrixWorld(true);
    const pel = this.worldPos('pelvis');
    const q = this.group.getWorldQuaternion(new THREE.Quaternion());
    const yaw = new THREE.Euler().setFromQuaternion(q, 'YXZ').y;
    if (!this.clothReady || dt <= 0) {
      this.clothPrev.copy(pel);
      this.clothPrevYaw = yaw;
      this.clothReady = true;
      return;
    }
    // hips velocity and yaw rate (smoothed), in the group's own frame
    const vel = pel.clone().sub(this.clothPrev).divideScalar(d);
    this.clothPrev.copy(pel);
    if (vel.length() > 30) vel.set(0, 0, 0); // a jump of position, not a movement
    this.clothMove.lerp(vel, 1 - Math.exp(-d * 14));
    const local = this.clothMove.clone().applyQuaternion(q.clone().invert()).divideScalar(Math.max(0.2, this.group.scale.y));
    let dy = yaw - this.clothPrevYaw;
    dy -= Math.round(dy / (Math.PI * 2)) * Math.PI * 2;
    this.clothPrevYaw = yaw;
    const yawRate = Math.abs(dy / d) > 25 ? 0 : dy / d;

    const clampV = (v: number, m: number) => Math.max(-m, Math.min(m, v));
    const target = new THREE.Vector3(clampV(-local.x * 0.05, 0.3), clampV(-local.y * 0.025, 0.12), clampV(-local.z * 0.05, 0.3));
    // semi-implicit spring (stiffness 70, damping 9) with substeps for stability
    const steps = Math.ceil(d / 0.008);
    const h = d / steps;
    const pos = u.uSway.value;
    for (let i = 0; i < steps; i++) {
      this.clothVel.addScaledVector(target.clone().sub(pos), 70 * h).multiplyScalar(Math.exp(-9 * h));
      pos.addScaledVector(this.clothVel, h);
      const tw = clampV(-yawRate * 0.06, 0.55);
      this.clothSwirlVel = (this.clothSwirlVel + (tw - u.uSwirl.value) * 55 * h) * Math.exp(-8 * h);
      u.uSwirl.value += this.clothSwirlVel * h;
    }
    // stepping legs push the hem; speed makes the skirt flare
    const k = 1 - Math.exp(-d * 12);
    u.uLegF.value.x += (clampV(-this.cur.hpL[0] * 0.22, 0.3) - u.uLegF.value.x) * k;
    u.uLegF.value.y += (clampV(-this.cur.hpR[0] * 0.22, 0.3) - u.uLegF.value.y) * k;
    const speed = Math.hypot(local.x, local.z);
    u.uFlare.value += (0.02 + Math.min(0.06, speed * 0.008) - u.uFlare.value) * k;
  }

  /**
   * Shrink-wrap a garment onto the body: every vertex moves along the body's surface normal until it lies about 2 mm off the skin,
   * whether it was floating above it (loose underwear) or sunk into it. Done on the bind-pose body; the garment's morphs then carry
   * it along with the body shape sliders.
   */
  private hugBody(geo: THREE.BufferGeometry) {
    const body = this.bodyMesh?.geometry;
    if (!body) return;
    const bp = body.attributes.position as THREE.BufferAttribute;
    const bn = body.attributes.normal as THREE.BufferAttribute | undefined;
    const gp = geo.attributes.position as THREE.BufferAttribute;
    if (!bn) return;
    const CELL = 0.03;
    const key = (x: number, y: number, z: number) => `${Math.floor(x / CELL)},${Math.floor(y / CELL)},${Math.floor(z / CELL)}`;
    const grid = new Map<string, number[]>();
    for (let i = 0; i < bp.count; i++) {
      const k = key(bp.getX(i), bp.getY(i), bp.getZ(i));
      const l = grid.get(k);
      if (l) l.push(i);
      else grid.set(k, [i]);
    }
    const OFFSET = 0.002;
    for (let v = 0; v < gp.count; v++) {
      const x = gp.getX(v), y = gp.getY(v), z = gp.getZ(v);
      const cx = Math.floor(x / CELL), cy = Math.floor(y / CELL), cz = Math.floor(z / CELL);
      let best = -1;
      let bd = 0.04 * 0.04;
      for (let dx = -1; dx <= 1; dx++)
        for (let dy = -1; dy <= 1; dy++)
          for (let dz = -1; dz <= 1; dz++) {
            const l = grid.get(`${cx + dx},${cy + dy},${cz + dz}`);
            if (!l) continue;
            for (const i of l) {
              const d = (bp.getX(i) - x) ** 2 + (bp.getY(i) - y) ** 2 + (bp.getZ(i) - z) ** 2;
              if (d < bd) {
                bd = d;
                best = i;
              }
            }
          }
      if (best < 0) continue;
      const nx = bn.getX(best), ny = bn.getY(best), nz = bn.getZ(best);
      const off = (x - bp.getX(best)) * nx + (y - bp.getY(best)) * ny + (z - bp.getZ(best)) * nz;
      const move = off - OFFSET;
      gp.setXYZ(v, x - nx * move, y - ny * move, z - nz * move);
    }
    gp.needsUpdate = true;
    geo.computeBoundingBox();
    geo.computeBoundingSphere();
  }

  /** Re-use the asset's geometry on the body's skeleton (joints are matched by name). */
  private rebind(src: THREE.SkinnedMesh, slot: Slot): THREE.SkinnedMesh {
    const skel = this.bodyMesh!.skeleton;
    const map = src.skeleton.bones.map((b) => Math.max(0, skel.bones.findIndex((x) => x.name === b.name)));
    const geo = src.geometry.clone();
    this.fitGeometry(geo);
    if (BODY_HUGGING_SLOTS.has(slot)) this.hugBody(geo);
    const si = geo.getAttribute('skinIndex');
    const arr = new Uint16Array(si.count * 4);
    for (let i = 0; i < si.count; i++) {
      arr[i * 4] = map[si.getX(i)];
      arr[i * 4 + 1] = map[si.getY(i)];
      arr[i * 4 + 2] = map[si.getZ(i)];
      arr[i * 4 + 3] = map[si.getW(i)];
    }
    geo.setAttribute('skinIndex', new THREE.BufferAttribute(arr, 4));
    const mat = (src.material as THREE.MeshStandardMaterial).clone();
    // hair is made of cards and needs both faces; cloth drawn double-sided shows its inner shell as noise
    mat.side = slot === 'hair' ? THREE.DoubleSide : THREE.FrontSide;
    mat.transparent = false;
    // the glTF loader turns BLEND materials into depthWrite=false, which draws cloth layers in triangle order (see-through)
    mat.depthWrite = true;
    if (slot === 'hair') {
      mat.alphaTest = 0.3;
      mat.alphaToCoverage = true;
    } else {
      mat.alphaTest = 0;
    }
    // layered cloth sits millimetres apart: push inner layers back in depth so the outer one always wins
    const layer = CLOTH_LAYER[slot] ?? 0;
    mat.polygonOffset = layer !== 0;
    mat.polygonOffsetFactor = layer;
    mat.polygonOffsetUnits = layer * 4;
    this.installCloth(mat, slot, geo);
    const mesh = new THREE.SkinnedMesh(geo, mat);
    mesh.name = `slot:${slot}`;
    mesh.userData.slot = slot;
    mesh.bind(skel, this.bodyMesh!.bindMatrix);
    mesh.morphTargetDictionary = { ...(src.morphTargetDictionary ?? {}) };
    mesh.morphTargetInfluences = new Array(src.morphTargetInfluences?.length ?? 0).fill(0);
    mesh.frustumCulled = false;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  /* ───────────────────────── colours ───────────────────────── */

  private tint(mat: THREE.MeshStandardMaterial, hex: string) {
    mat.color.set(hex).multiplyScalar(1 / ALBEDO_MEAN);
  }

  /**
   * Brow / lash / beard textures are painted near-black, so multiplying them by a colour stays black. Switch the
   * material to "dye" mode: the texture only gives the strand mask (alpha) and a little shading, the colour comes from
   * mat.color. Turning dye off restores the plain textured look.
   */
  private setDye(mat: THREE.MeshStandardMaterial, hex: string | null) {
    if (!mat.userData.dyePatched) {
      mat.userData.dyePatched = true;
      mat.userData.dye = { value: 0 };
      mat.onBeforeCompile = (sh) => {
        sh.uniforms.uDye = mat.userData.dye;
        sh.fragmentShader = sh.fragmentShader
          .replace('void main() {', 'uniform float uDye;\nvoid main() {')
          .replace(
            '#include <map_fragment>',
            `#ifdef USE_MAP
              vec4 dyeTexel = texture2D( map, vMapUv );
              float dyeShade = 0.75 + 0.25 * clamp( dot( dyeTexel.rgb, vec3( 0.333 ) ) * 4.0, 0.0, 1.0 );
              diffuseColor *= mix( dyeTexel, vec4( vec3( dyeShade ), dyeTexel.a ), uDye );
            #endif`
          );
      };
      mat.customProgramCacheKey = () => 'dye';
      mat.needsUpdate = true;
    }
    if (!mat.userData.baseColor) mat.userData.baseColor = mat.color.clone();
    mat.userData.dye.value = hex ? 1 : 0;
    if (hex) mat.color.set(hex);
    else mat.color.copy(mat.userData.baseColor as THREE.Color);
  }

  private tintMaterials(state: CharacterState) {
    const c = state.cosmetics;
    this.painter?.paint(c);
    this.refreshEyes = () => this.recolorEyes(c.eyeIrisColor, c.pupilStyle, state.face.irisSize, c.eyeStyle);
    this.refreshEyes();
    this.applySkin(state);
    const worn = (slot: Slot) => ASSET_INFO[this.layers.get(slot)?.id ?? ''];
    this.meshes.forEach((m) => {
      const mat = m.material as THREE.MeshStandardMaterial;
      const slot = m.userData.slot as Slot | undefined;
      if (slot) {
        switch (slot) {
          case 'hair':
            this.tint(mat, c.hairColorPrimary);
            mat.roughness = lerp(0.7, 0.3, c.hairGloss);
            break;
          case 'beard':
            this.setDye(mat, faceHairOverride(c, slot) ?? defaultFaceHairColor(c, slot));
            break;
          case 'eyebrows':
          case 'eyelashes':
            this.setDye(mat, faceHairOverride(c, slot) ?? defaultFaceHairColor(c, slot));
            mat.transparent = true;
            mat.alphaTest = 0.2;
            mat.depthWrite = false;
            break;
          case 'tail':
            this.tint(mat, tailColor(state, worn(slot)?.color));
            break;
          case 'shoes':
          case 'jewelry':
          case 'accessory':
          case 'glasses':
          case 'horns':
          case 'wings':
          case 'nails':
            this.tint(mat, c.wearColors?.[slot] || c.outfitAccent || worn(slot)?.color || '#4a4a4f');
            break;
          default:
            this.tint(mat, c.wearColors?.[slot] || c.outfitMain || worn(slot)?.color || '#9aa4b2');
        }
        return;
      }
      switch (m.name) {
        case 'Body':
          mat.transparent = false;
          mat.alphaTest = 0;
          mat.depthWrite = true;
          mat.roughness = lerp(0.72, 0.4, c.skinGloss);
          break;
        case 'eyebrows':
          this.setDye(mat, faceHairOverride(c, 'eyebrows') ?? defaultFaceHairColor(c, 'eyebrows'));
          mat.transparent = true;
          mat.alphaTest = 0.2;
          mat.depthWrite = false;
          break;
        case 'eyelashes':
          // built-in lashes keep their texture colour until the user picks one
          this.setDye(mat, faceHairOverride(c, 'eyelashes') ?? null);
          mat.transparent = true;
          mat.alphaTest = 0.2;
          mat.depthWrite = false;
          break;
        default:
          mat.transparent = false;
          mat.depthWrite = true;
          break;
      }
    });
  }

  /** Swap the skin texture and scale it toward the chosen skin tone. */
  private applySkin(state: CharacterState) {
    if (!this.bodyMesh) return;
    const mat = this.bodyMesh.material as THREE.MeshStandardMaterial;
    const info = skinInfo(state.skin, state.gender);
    const id = info?.id ?? defaultSkin(state.gender);
    if (id !== this.skinKey) {
      this.skinKey = id;
      let tex = this.skinTextures.get(id);
      if (!tex) {
        const loaded = new THREE.TextureLoader().load(skinUrl(id), (t) => {
          if (this.bodyMesh) (this.bodyMesh.material as THREE.MeshStandardMaterial).needsUpdate = true;
          // the lip tint follows the lips painted in this skin (only when it is the skin on show)
          if (this.skinKey === id) this.painter?.measureLips(t.image as CanvasImageSource, id);
        });
        tex = loaded;
        tex.flipY = false;
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 8;
        this.skinTextures.set(id, tex);
        // every skin is a 2048 px texture held on the GPU: keep only the last few, or flicking through the skins fills video memory
        for (const [k, t] of this.skinTextures) {
          if (this.skinTextures.size <= 4) break;
          if (k !== id) {
            t.dispose();
            this.skinTextures.delete(k);
          }
        }
      }
      mat.map = tex;
      mat.needsUpdate = true;
      if (tex.image) this.painter?.measureLips(tex.image as CanvasImageSource, id);
    }
    // tone relative to the texture's own average colour: picking a skin sets the tone to that colour, so the texture shows as is
    const want = skinAlbedo(state.cosmetics.skinTone);
    const own = skinAlbedo(info?.color ?? state.cosmetics.skinTone);
    // soften the tint so pale presets do not wash the texture out
    const k = (w: number, o: number) => 1 + (Math.min(1.8, w / Math.max(0.05, o)) - 1) * 0.65;
    mat.color.setRGB(k(want.r, own.r), k(want.g, own.g), k(want.b, own.b));
  }

  /** Repaint the iris of the eye atlas with the chosen colour (the atlas holds both eyes: sclera, iris, pupil). */
  private recolorEyes(hex: string, pupil: string = 'round', irisSize = 0, style?: string) {
    let source: ImageBitmap | HTMLImageElement | null = this.eyeSource;
    if (style) {
      // a ready-made eye texture: load it (once), then repaint when it arrives
      const id = style;
      const have = this.eyeStyles.get(id);
      if (have === undefined) {
        this.eyeStyles.set(id, null);
        const img = new Image();
        img.onload = () => {
          this.eyeStyles.set(id, img);
          this.eyeKey = '';
          this.refreshEyes?.();
        };
        img.onerror = () => this.eyeStyles.set(id, false);
        img.src = eyeStyleUrl(id);
      }
      if (have) source = have;
      else if (have === null) return; // still loading: keep what is on the eyes
      else style = undefined;
    }
    const key = `${style ?? ''}|${hex}|${pupil}|${irisSize.toFixed(2)}`;
    if (this.eyeKey === key || !source) return;
    this.eyeKey = key;
    const eyes = this.meshes.find((m) => m.name === 'eyes');
    if (!eyes) return;
    const W = source.width;
    const H = source.height;
    const cv = document.createElement('canvas');
    cv.width = W;
    cv.height = H;
    const ctx = cv.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(source, 0, 0, W, H);
    const centers = [
      [0.705, 0.296],
      [0.29, 0.71]
    ];
    const R = 0.122 * W;
    // iris size: resample the iris disc around its centre (scale > 1 = bigger iris)
    const zoom = 1 + irisSize * 0.3;
    if (Math.abs(zoom - 1) > 0.01) {
      const src = ctx.getImageData(0, 0, W, H);
      const dst = ctx.getImageData(0, 0, W, H);
      const rr = R * 1.15;
      for (const [cx, cy] of centers) {
        for (let y = Math.floor(cy * H - rr); y < Math.ceil(cy * H + rr); y++) {
          for (let x = Math.floor(cx * W - rr); x < Math.ceil(cx * W + rr); x++) {
            const dx = x - cx * W;
            const dy = y - cy * H;
            if (Math.hypot(dx, dy) > rr) continue;
            const sx = Math.round(cx * W + dx / zoom);
            const sy = Math.round(cy * H + dy / zoom);
            const a = (y * W + x) * 4;
            const b = (sy * W + sx) * 4;
            dst.data[a] = src.data[b];
            dst.data[a + 1] = src.data[b + 1];
            dst.data[a + 2] = src.data[b + 2];
          }
        }
      }
      ctx.putImageData(dst, 0, 0);
    }
    if (style) {
      // a ready-made eye keeps its own iris and pupil: only the iris size above applies
      const own = new THREE.CanvasTexture(cv);
      own.flipY = false;
      own.colorSpace = THREE.SRGBColorSpace;
      own.anisotropy = 8;
      const m = eyes.material as THREE.MeshStandardMaterial;
      m.map?.dispose();
      m.map = own;
      m.needsUpdate = true;
      return;
    }
    const img = ctx.getImageData(0, 0, W, H);
    const d = img.data;
    const target = new THREE.Color(hex);
    for (const [cx, cy] of centers) {
      const x0 = Math.floor(cx * W - R);
      const x1 = Math.ceil(cx * W + R);
      const y0 = Math.floor(cy * H - R);
      const y1 = Math.ceil(cy * H + R);
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const dist = Math.hypot(x - cx * W, y - cy * H);
          const inPupil = dist < R * 0.3 * zoom;
          if (dist > R || (inPupil && pupil === 'round')) continue;
          const i = (y * W + x) * 4;
          const lum = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) / 255;
          const k = inPupil ? 0.9 : Math.min(1.6, lum / 0.22);
          const mix = 1 - Math.pow(dist / R, 6);
          d[i] = d[i] * (1 - mix) + Math.min(255, target.r * 255 * k) * mix;
          d[i + 1] = d[i + 1] * (1 - mix) + Math.min(255, target.g * 255 * k) * mix;
          d[i + 2] = d[i + 2] * (1 - mix) + Math.min(255, target.b * 255 * k) * mix;
        }
      }
    }
    ctx.putImageData(img, 0, 0);
    if (pupil !== 'round') {
      // reshape the pupil: paint it over the round one with a slightly larger, differently shaped dark patch
      const r = R * 0.3 * zoom;
      ctx.fillStyle = '#050505';
      for (const [cx, cy] of centers) {
        ctx.save();
        ctx.translate(cx * W, cy * H);
        ctx.beginPath();
        if (pupil === 'cat' || pupil === 'dragon') {
          const w = pupil === 'cat' ? 0.38 : 0.22;
          ctx.ellipse(0, 0, r * w, r * 2.1, 0, 0, Math.PI * 2);
        } else {
          for (let k = 0; k < 6; k++) {
            ctx.save();
            ctx.rotate((k / 6) * Math.PI * 2);
            ctx.ellipse(0, -r * 0.95, r * 0.42, r * 0.9, 0, 0, Math.PI * 2);
            ctx.restore();
          }
          ctx.arc(0, 0, r * 0.6, 0, Math.PI * 2);
        }
        ctx.fill();
        ctx.restore();
      }
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.flipY = false;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    const mat = eyes.material as THREE.MeshStandardMaterial;
    mat.map?.dispose();
    mat.map = tex;
    mat.needsUpdate = true;
  }

  /** Height of the top of the head right now (follows animation; anchors().headY is the value at the last state change). */
  public liveHeadY(): number {
    return this.worldPos('head').y + 0.1 * this.group.scale.y;
  }

  public anchors(): AvatarAnchors {
    return this.anchorsCache ?? { headY: 0.7, chestY: 0.2, waistY: 0, feetY: FLOOR_Y, height: 1.7, scale: 1 };
  }

  /* ───────────────────────── poses ───────────────────────── */

  /** Rotate `name` so that its world orientation = delta · rest orientation (works for any bone roll). */
  /** Give `name` the world orientation `delta · rest`. */
  private setWorldQuat(name: string, delta: THREE.Quaternion) {
    const b = this.bone(name);
    const r = this.rest.get(name);
    if (!b || !r || !b.parent) return;
    b.parent.updateWorldMatrix(true, false);
    const pq = b.parent.getWorldQuaternion(new THREE.Quaternion());
    b.quaternion.copy(pq.invert().multiply(this.frame.clone().multiply(delta).multiply(r.worldQ)));
    b.updateMatrixWorld(true);
  }

  private setWorldRot(name: string, e: Rot, factor = 1) {
    const b = this.bone(name);
    const r = this.rest.get(name);
    if (!b || !r || !b.parent) return;
    const delta = new THREE.Quaternion().setFromEuler(new THREE.Euler(e[0] * factor, e[1] * factor, e[2] * factor));
    b.parent.updateWorldMatrix(true, false);
    const pq = b.parent.getWorldQuaternion(new THREE.Quaternion());
    b.quaternion.copy(pq.invert().multiply(this.frame.clone().multiply(delta).multiply(r.worldQ)));
    b.updateMatrixWorld(true);
  }

  /** Rotate `name` so the vector towards `childName` points along `dir` (world space). */
  private aim(name: string, childName: string, dir: THREE.Vector3) {
    const b = this.bone(name);
    const child = this.bone(childName);
    if (!b || !child || !b.parent) return;
    b.updateWorldMatrix(true, false);
    child.updateWorldMatrix(true, false);
    const bp = new THREE.Vector3().setFromMatrixPosition(b.matrixWorld);
    const cp = new THREE.Vector3().setFromMatrixPosition(child.matrixWorld);
    const cur = cp.sub(bp);
    if (cur.lengthSq() < 1e-10) return;
    cur.normalize();
    const dq = new THREE.Quaternion().setFromUnitVectors(cur, dir.clone().applyQuaternion(this.frame).normalize());
    const wq = b.getWorldQuaternion(new THREE.Quaternion());
    const pq = b.parent.getWorldQuaternion(new THREE.Quaternion());
    b.quaternion.copy(pq.invert().multiply(dq.multiply(wq)));
    b.updateMatrixWorld(true);
  }

  /** `ground` keeps the lowest point of the posed body on the floor (plus `lift`), whatever the pose, body proportions or shoes. */
  public animate(dt: number, target: Partial<Record<string, Rot>>, hipsDrop: number, speed = 9, ground = false, lift = 0) {
    if (!this.ready || !this.group.visible) return;
    const k = 1 - Math.exp(-speed * Math.min(dt, 0.1));
    this.group.rotation.y = this.yaw;
    this.frame.setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
    JOINTS.forEach((j) => {
      const want = (target[j] ?? [0, 0, 0]) as Rot;
      const c = this.cur[j];
      c[0] = lerp(c[0], want[0], k);
      c[1] = lerp(c[1], want[1], k);
      c[2] = lerp(c[2], want[2], k);
    });
    this.drop = lerp(this.drop, hipsDrop, k);

    // back to the (morph-adjusted) bind pose, then pose from the hips outward
    this.bones.forEach((bn, name) => {
      bn.quaternion.copy(this.rest.get(name)!.q);
      bn.position.copy(this.adjPos.get(name)!);
      bn.scale.set(1, 1, 1);
    });
    this.group.updateMatrixWorld(true);

    const hips = this.bone('pelvis');
    if (hips && hips.parent) {
      const wp = this.group.localToWorld(this.pelvisModelPos.clone());
      wp.y -= this.drop;
      hips.position.copy(hips.parent.worldToLocal(wp));
      hips.updateMatrixWorld(true);
    }
    this.setWorldRot('pelvis', this.cur.hips);
    // the spine turns from the hips' orientation to the chest's (hips · torso) over its three bones, so the chest carries the
    // same frame the arms are posed in
    {
      const qHipsS = new THREE.Quaternion().setFromEuler(new THREE.Euler(...this.cur.hips));
      const qChest = qHipsS.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(...this.cur.torso)));
      (['spine_01', 'spine_02', 'spine_03'] as const).forEach((name, i) => this.setWorldQuat(name, qHipsS.clone().slerp(qChest, (i + 1) / 3)));
    }
    this.setWorldRot('neck_01', this.cur.neck);
    this.setWorldRot('head', this.cur.head);
    this.bone('head')?.scale.setScalar(this.headScale);
    this.group.updateMatrixWorld(true);

    const E = (r: Rot) => new THREE.Quaternion().setFromEuler(new THREE.Euler(r[0], r[1], r[2]));
    const DOWN = new THREE.Vector3(0, -1, 0);
    const qHips = E(this.cur.hips);
    const qBody = qHips.clone().multiply(E(this.cur.torso));

    (['L', 'R'] as const).forEach((side) => {
      const sx = side === 'L' ? 'l' : 'r';
      const qa = qBody.clone().multiply(E(this.cur[`sh${side}` as J]));
      this.aim(`upperarm_${sx}`, `lowerarm_${sx}`, DOWN.clone().applyQuaternion(qa));
      const qf = qa.clone().multiply(E(this.cur[`el${side}` as J]));
      this.aim(`lowerarm_${sx}`, `hand_${sx}`, DOWN.clone().applyQuaternion(qf));

      const ql = qHips.clone().multiply(E(this.cur[`hp${side}` as J]));
      this.aim(`thigh_${sx}`, `calf_${sx}`, DOWN.clone().applyQuaternion(ql));
      const qk = ql.clone().multiply(E(this.cur[`kn${side}` as J]));
      this.aim(`calf_${sx}`, `foot_${sx}`, DOWN.clone().applyQuaternion(qk));

      // wrist: turns the hand (and with it the weapon socket and the fingers) relative to the forearm
      const hand = this.bone(`hand_${sx}`);
      if (hand) {
        const axis = this.handAxis[side];
        if (axis) hand.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(axis, this.baseRoll[side]));
        hand.quaternion.multiply(E(this.cur[`wr${side}` as J]));
        hand.updateMatrixWorld(true);
      }
      this.curlFingers(sx, this.grip[side]);
    });

    if (this.retarget) {
      // turn the trunk first, then aim the limbs (they hang off it), parents before children
      for (const [bone, q] of this.retarget.deltas) this.setWorldQuat(bone, q);
      for (const a of this.retarget.aims) this.aim(a.bone, a.child, a.dir);
    }

    if (ground) {
      // a clip whose feet leave its floor (a jump) lifts the body by the same share of this body's hip height
      const airborne = (this.retarget?.clearance ?? 0) * (this.pelvisModelPos.y - this.soleY) * this.group.scale.y;
      const want = FLOOR_Y + lift + airborne - (this.baseY + this.lowestY(true) * this.group.scale.y);
      // a clip moves the body itself: follow it at once (easing would flatten the jump); built-in poses settle gently
      this.poseLift = this.retarget ? want : lerp(this.poseLift, want, k);
      this.group.position.y = this.baseY + this.poseLift;
      this.group.updateMatrixWorld(true);
    }

    this.headAnchor.position.copy(this.group.worldToLocal(this.worldPos('head')));
    const hq = new THREE.Quaternion();
    this.bone('head')?.getWorldQuaternion(hq);
    this.headAnchor.quaternion.copy(this.frame.clone().invert().multiply(hq).multiply(this.restHeadQ.clone().invert()));
    this.hipsAnchor.position.copy(this.group.worldToLocal(this.worldPos('pelvis')));
    this.group.updateMatrixWorld(true);
    this.updateCloth(dt);
    this.updateFace(dt);
  }

  /* ───────────────────────── facial animation (MPFB expression units) ───────────────────────── */

  private faceWant: Record<FaceKey, number> = { ...FACE_ZERO };
  private faceCur: Record<FaceKey, number> = { ...FACE_ZERO };
  private blinkIn = 2.5;
  private blinkAt = -1;

  /** The expression to ease towards (missing channels relax to 0). Blinking runs on its own on top of it. */
  public setFace(want: Partial<Record<FaceKey, number>>) {
    this.faceWant = { ...FACE_ZERO, ...want };
  }

  private updateFace(dt: number) {
    const dtc = Math.min(dt, 0.1);
    const k = 1 - Math.exp(-10 * dtc);
    const kFast = 1 - Math.exp(-28 * dtc);
    (Object.keys(this.faceCur) as FaceKey[]).forEach((f) => (this.faceCur[f] += (this.faceWant[f] - this.faceCur[f]) * (FAST_FACE.has(f) ? kFast : k)));
    // natural blinks every 2–6 s, now and then a double blink
    this.blinkIn -= dt;
    if (this.blinkIn <= 0) {
      this.blinkAt = 0;
      this.blinkIn = Math.random() < 0.15 ? 0.32 : 2 + Math.random() * 4;
    }
    let blink = 0;
    if (this.blinkAt >= 0) {
      this.blinkAt += dt;
      const t = this.blinkAt;
      blink = t < 0.07 ? t / 0.07 : t < 0.19 ? 1 - (t - 0.07) / 0.12 : 0;
      if (t >= 0.19) this.blinkAt = -1;
    }
    const value: Record<string, number> = {
      xBlinkL_pos: Math.max(this.faceCur.blinkL, blink),
      xBlinkR_pos: Math.max(this.faceCur.blinkR, blink),
      xSmile_pos: this.faceCur.smile,
      xMouthOpen_pos: this.faceCur.mouthOpen,
      xBrowUp_pos: this.faceCur.browUp,
      xBrowDown_pos: this.faceCur.browDown,
      xSquint_pos: this.faceCur.squint,
      xSad_pos: this.faceCur.sad,
      xSurprise_pos: this.faceCur.surprise,
      xSneer_pos: this.faceCur.sneer,
      xPout_pos: this.faceCur.pout,
      xEyeWide_pos: this.faceCur.eyeWide,
      xAnger_pos: this.faceCur.anger,
      xVisAA_pos: this.faceCur.vAA,
      xVisEE_pos: this.faceCur.vEE,
      xVisOO_pos: this.faceCur.vOO,
      xVisOH_pos: this.faceCur.vOH,
      xVisFV_pos: this.faceCur.vFV,
      xVisMM_pos: this.faceCur.vMM
    };
    this.meshes.forEach((m) => {
      const dict = m.morphTargetDictionary;
      const inf = m.morphTargetInfluences;
      if (!dict || !inf) return;
      for (const name in value) {
        const i = dict[name];
        if (i !== undefined) inf[i] = Math.min(1, Math.max(0, value[name]));
      }
    });
  }
}

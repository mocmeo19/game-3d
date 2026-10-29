import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * Animations from Mixamo (or any rig with Mixamo's bone names) played on the avatar. The file's own skeleton is animated by a mixer and
 * read every frame; the avatar is never given the clip's bones, only what they do:
 *  - pelvis, spine, neck and head take the turn of the clip's bone since its bind pose (a world-space change), which works whatever
 *    the proportions of the two bodies;
 *  - arms and legs are aimed along the directions the clip's bones point in, which works whatever the resting pose of each rig is
 *    (Mixamo's T-pose against the avatar's own).
 * Bone names differ ("mixamorig:LeftUpLeg" / "thigh_l"), hence the tables below.
 */

export type RetargetParts = 'all' | 'lower';

export interface RetargetPose {
  /** World-orientation change from the bind pose, by avatar bone (parents first). */
  deltas: [string, THREE.Quaternion][];
  /** Avatar bones to point at their child along a direction (parents first). */
  aims: { bone: string; child: string; dir: THREE.Vector3 }[];
  /**
   * How high the clip's lowest foot is above the floor it stands on, as a share of its hip height (a jump lifts the whole body;
   * 0 while a foot is down). Rotations alone cannot show this, so whoever places the body adds it.
   */
  clearance?: number;
}

const FEET = ['leftfoot', 'rightfoot', 'lefttoebase', 'righttoebase'];

/** Mixamo bone → avatar bone, for bones that follow the turn of the clip. */
const TURNS: [string, string][] = [
  ['hips', 'pelvis'],
  ['spine', 'spine_01'],
  ['spine1', 'spine_02'],
  ['spine2', 'spine_03'],
  ['neck', 'neck_01'],
  ['head', 'head']
];

/** [source bone, source child, avatar bone, avatar child] for bones aimed along a direction; `{S}` is the side's name, `{s}` its letter. */
const AIMS: [string, string, string, string][] = [
  ['{S}shoulder', '{S}arm', 'clavicle_{s}', 'upperarm_{s}'],
  ['{S}arm', '{S}forearm', 'upperarm_{s}', 'lowerarm_{s}'],
  ['{S}forearm', '{S}hand', 'lowerarm_{s}', 'hand_{s}'],
  ['{S}hand', '{S}handmiddle1', 'hand_{s}', 'middle_01_{s}'],
  ['{S}upleg', '{S}leg', 'thigh_{s}', 'calf_{s}'],
  ['{S}leg', '{S}foot', 'calf_{s}', 'foot_{s}'],
  ['{S}foot', '{S}toebase', 'foot_{s}', 'ball_{s}'],
  // fingers: the clip's grip (around a gun, a fist, an open hand); the last segment follows the one before it
  ...(['Index', 'Middle', 'Ring', 'Pinky', 'Thumb'] as const).flatMap((finger): [string, string, string, string][] => {
    const f = finger.toLowerCase();
    return [
      [`{S}hand${f}1`, `{S}hand${f}2`, `${f}_01_{s}`, `${f}_02_{s}`],
      [`{S}hand${f}2`, `{S}hand${f}3`, `${f}_02_{s}`, `${f}_03_{s}`],
    ];
  })
];

const REQUIRED = ['hips', 'spine', 'head', 'leftarm', 'rightarm', 'leftforearm', 'rightforearm', 'lefthand', 'righthand', 'leftupleg', 'rightupleg', 'leftleg', 'rightleg', 'leftfoot', 'rightfoot'];

/** "mixamorig:LeftUpLeg" / "mixamorigLeftUpLeg" / "LeftUpLeg" → "leftupleg". */
const keyOf = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, '').replace(/^mixamorig\d*/, '');

export class MixamoSource {
  readonly name: string;
  readonly clipNames: string[];
  private readonly mixer: THREE.AnimationMixer;
  private readonly actions = new Map<string, THREE.AnimationAction>();
  private readonly nodes = new Map<string, THREE.Object3D>();
  private readonly rest = new Map<string, THREE.Quaternion>();
  private current: string | null = null;
  private readonly smoothQ = new Map<string, THREE.Quaternion>();
  /** Floor of the clip (its lowest foot at rest) and its hip height above it, in the file's units. */
  private readonly restFloorY: number;
  private readonly restHipHeight: number;
  private readonly smoothD = new Map<string, THREE.Vector3>();

  private constructor(name: string, private readonly root: THREE.Object3D, clips: THREE.AnimationClip[]) {
    this.name = name;
    // a skinned file may store a stray pose in its bone nodes: the bind pose is the T-pose the clips were made from
    root.traverse((o) => (o as THREE.SkinnedMesh).skeleton?.pose());
    root.updateMatrixWorld(true);
    root.traverse((o) => {
      const key = keyOf(o.name);
      if (key && !this.nodes.has(key)) this.nodes.set(key, o);
    });
    const missing = REQUIRED.filter((k) => !this.nodes.has(k));
    if (missing.length) throw new Error(`not a Mixamo skeleton (missing ${missing.join(', ')})`);
    for (const [src] of TURNS) {
      const n = this.nodes.get(src);
      if (n) this.rest.set(src, n.getWorldQuaternion(new THREE.Quaternion()));
    }
    this.restFloorY = this.lowestFootY();
    this.restHipHeight = this.nodes.get('hips')!.getWorldPosition(new THREE.Vector3()).y - this.restFloorY;
    this.mixer = new THREE.AnimationMixer(root);
    const base = name.replace(/\.[^.]+$/, '');
    clips.forEach((c, i) => {
      // Mixamo names every clip "mixamo.com": the file name says what it is
      const clipName = !c.name || /^mixamo\.com$/i.test(c.name) ? (clips.length > 1 ? `${base} ${i + 1}` : base) : c.name;
      this.actions.set(clipName, this.mixer.clipAction(c));
    });
    this.clipNames = [...this.actions.keys()];
  }

  static async load(file: File): Promise<MixamoSource> {
    const buffer = await file.arrayBuffer();
    if (/\.fbx$/i.test(file.name)) {
      const obj = new FBXLoader().parse(buffer, '');
      return new MixamoSource(file.name, obj, obj.animations);
    }
    const gltf = await new GLTFLoader().parseAsync(buffer, '');
    return new MixamoSource(file.name, gltf.scene, gltf.animations);
  }

  /**
   * Start a clip of the file (the others stop). `speed` stretches time (walking faster or slower than it was captured). A clip that is
   * already playing carries on unless `restart` is set; `once` plays it through and holds the last pose.
   */
  play(clip: string, speed = 1, opts: { once?: boolean; restart?: boolean } = {}) {
    const next = this.actions.get(clip);
    if (!next) return;
    if (clip !== this.current || opts.restart) {
      this.actions.forEach((a) => a.stop());
      next.reset();
      next.setLoop(opts.once ? THREE.LoopOnce : THREE.LoopRepeat, opts.once ? 1 : Infinity);
      next.clampWhenFinished = !!opts.once;
      next.play();
      this.current = clip;
    }
    next.timeScale = speed;
  }

  /** Length of a clip in seconds. */
  duration(clip: string) {
    return this.actions.get(clip)?.getClip().duration ?? 1;
  }

  /** Position 0..1 within the playing clip (0 before one has started). */
  get phase() {
    const action = this.current ? this.actions.get(this.current) : undefined;
    if (!action) return 0;
    const length = action.getClip().duration || 1;
    return (action.time % length) / length;
  }

  /** Jump the playing clip to a position 0..1 (keeps two walk cycles in step when they are blended). */
  seek(phase: number) {
    const action = this.current ? this.actions.get(this.current) : undefined;
    if (action) action.time = phase * action.getClip().duration;
  }

  /** True once a clip played with `once` has reached its end. */
  get finished() {
    const action = this.current ? this.actions.get(this.current) : undefined;
    return !!action && action.loop === THREE.LoopOnce && action.time >= action.getClip().duration - 1e-3;
  }

  /**
   * The clip now playing, as the avatar should pose; null before one has started. `smooth` eases towards the new pose (hides the
   * jump when another clip of the same file takes over); a caller that blends clips itself turns it off.
   */
  sample(dt: number, parts: RetargetParts, mirror = false, smooth = true): RetargetPose | null {
    if (!this.current) return null;
    this.mixer.update(dt);
    this.root.updateMatrixWorld(true);
    const f = smooth ? 1 - Math.exp(-Math.min(dt, 0.1) * 20) : 1;
    const tmp = new THREE.Quaternion();
    const clearance = this.restHipHeight > 1e-6 ? Math.max(0, (this.lowestFootY() - this.restFloorY) / this.restHipHeight) : 0;
    const pose: RetargetPose = { deltas: [], aims: [], clearance };
    if (parts === 'all') {
      for (const [src, dst] of TURNS) {
        const node = this.nodes.get(src);
        const rest = this.rest.get(src);
        if (!node || !rest) continue;
        const q = node.getWorldQuaternion(tmp).multiply(rest.clone().invert());
        // a mirrored clip (a run to the left played as a run to the right) reflects every turn across the body's mid-plane
        if (mirror) q.set(q.x, -q.y, -q.z, q.w);
        const prev = this.smoothQ.get(dst);
        const sm = prev ? prev.slerp(q, f) : q.clone();
        this.smoothQ.set(dst, sm);
        pose.deltas.push([dst, sm.clone()]);
      }
    }
    const p = new THREE.Vector3();
    const c = new THREE.Vector3();
    for (const side of ['Left', 'Right']) {
      const letter = side === 'Left' ? 'l' : 'r';
      for (const [from, to, bone, child] of AIMS) {
        if (parts === 'lower' && !/^(thigh|calf|foot)/.test(bone)) continue;
        // mirrored: the left limbs follow the clip's right ones, reflected
        const from_ = mirror ? (side === 'Left' ? 'Right' : 'Left') : side;
        const a = this.nodes.get(from.replace('{S}', from_).toLowerCase());
        const b = this.nodes.get(to.replace('{S}', from_).toLowerCase());
        if (!a || !b) continue;
        a.getWorldPosition(p);
        b.getWorldPosition(c);
        const dir = c.sub(p);
        if (dir.lengthSq() < 1e-12) continue;
        dir.normalize();
        if (mirror) dir.x = -dir.x;
        const avatarBone = bone.replace('{s}', letter);
        const prev = this.smoothD.get(avatarBone);
        const sm = prev ? prev.lerp(dir, f).normalize() : dir.clone();
        this.smoothD.set(avatarBone, sm);
        pose.aims.push({ bone: avatarBone, child: child.replace('{s}', letter), dir: sm.clone() });
      }
    }
    return pose;
  }

  private lowestFootY() {
    const p = new THREE.Vector3();
    let low = Infinity;
    for (const key of FEET) {
      const node = this.nodes.get(key);
      if (node) low = Math.min(low, node.getWorldPosition(p).y);
    }
    return Number.isFinite(low) ? low : 0;
  }

  dispose() {
    this.mixer.stopAllAction();
    this.root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      mesh.geometry?.dispose();
      const mats = mesh.material ? (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) : [];
      mats.forEach((m) => m.dispose());
    });
  }
}

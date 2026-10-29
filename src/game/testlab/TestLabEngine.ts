import { configureRenderer, getRenderSettings } from '../../settings/renderSettings';
import * as THREE from 'three';
import { LAB_WEAPONS, LAB_ZONES } from './labCatalog';
export { LAB_WEAPONS, LAB_ZONES } from './labCatalog';
import { resolveAnimation } from './animationConfig';
import { type MixRole, type MixCtx, ROLE_LABEL, CTX_LABEL } from './animationRoles';
export { type MixRole, type MixCtx, ROLE_LABEL, CTX_LABEL } from './animationRoles';
import { loadGameSettings, movementSpeed, normalizeGameSettings, type GameSettings } from './gameSettings';
import { CharacterState, PoseType } from '../../types/character';
import { CharacterModel, GamePose, GunHold } from '../../renderer/CharacterModel';
import { skillsFor } from '../../renderer/character/skills';
import { Sfx } from '../sfx';
import { WeaponId, WEAPONS } from '../rules';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { disposeTree, gunMesh, knifeSlashPose, radialTexture } from '../models';
import { LabProp, LabPropInfo, PropCollide } from './labProps';
import { MixamoSource, RetargetPose } from '../../renderer/character/mixamo';
import { AnimationSettings, BUILTIN_ANIMATION, animationSettingKey, loadAnimationSettings, saveAnimationSettings } from './animationSettings';

/**
 * Test lab: a small sandbox to try a character out. Parkour obstacles, things to push / sit on / carry, shooting targets, and every
 * body animation the game engines use (walk, run, jump, crouch, crawl, sit, lie, vault, climb, roll) plus poses, class skills and guns.
 * Units are metres; the heading h faces (sin h, cos h) and the camera yaw works the same way.
 */

export type Stance = 'stand' | 'crouch' | 'prone' | 'sit' | 'lie';
export type LabWeapon = 'none' | 'class' | WeaponId;
export type LabAction = 'jump' | 'crouch' | 'prone' | 'sit' | 'lie' | 'roll' | 'vault' | 'interact' | 'reload' | 'reset';

export interface LabSnapshot {
  loaded: boolean;
  weapon: LabWeapon;
  mag: number;
  magMax: number;
  reloading: boolean;
  stance: string;
  action: string;
  speed: number;
  hint: string;
  toast: string;
  aiming: boolean;
  pose: PoseType | null;
  slow: number;
  debug: boolean;
  hits: number;
  carrying: boolean;
  gun: boolean;
  /** Objects the user loaded from .glb files into the sandbox. */
  props: LabPropInfo[];
  /** Mixamo clips loaded from files, played on the character instead of its built-in motions. */
  mixamo: { id: number; label: string; role: MixRole | null; ctx: MixCtx; file: string | null; use: string | null; ready: boolean; playing: boolean }[];
  mixamoOn: boolean;
  mixamoManual: number | null;
  animationSettings: AnimationSettings;
}

interface Solid {
  min: THREE.Vector3;
  max: THREE.Vector3;
  mesh: THREE.Mesh;
  active: boolean;
  push?: boolean;
  carried?: boolean;
  home?: THREE.Vector3;
}

interface Body {
  mesh: THREE.Mesh;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  r: number;
  fuse?: number;
}

interface Dummy {
  group: THREE.Group;
  axis: THREE.Vector3;
  tilt: number;
  tiltV: number;
  flash: number;
  mats: THREE.MeshStandardMaterial[];
}

interface Seat {
  solid: Solid;
  heading: number;
  kind: 'bench' | 'bed';
}

interface Door {
  solid: Solid;
  open: number;
  want: number;
}

type Move =
  | { kind: 'vault'; t: number; dur: number; from: THREE.Vector3; to: THREE.Vector3; clearance: number }
  | { kind: 'climb'; t: number; dur: number; from: THREE.Vector3; wall: THREE.Vector3; to: THREE.Vector3; edge: THREE.Vector3; f: THREE.Vector2 }
  | { kind: 'roll'; t: number; dur: number; dir: THREE.Vector2 };

interface Fx {
  obj: THREE.Object3D;
  life: number;
  max: number;
  update?: (u: number) => void;
}

/** Role of a clip from its name, for files the user loads (the bundled ones are listed in public/animations/manifest.json). */
const ROLE_NAME: [MixRole, RegExp][] = [
  ['roll', /roll|flip|dive|tumble/i], ['vault', /vault/i], ['climb', /climb(?!ing down)/i], ['stab', /stab/i], ['slash', /slash|melee|swing/i], ['reload', /reload/i],
  ['fire', /fir(e|ing)|shoot/i], ['throw', /throw/i], ['proneidle', /(prone|lying|laying)\W*idle/i], ['crawl', /crawl|creep|prone\W*(forward|walk)/i],
  ['crouchwalk', /(crouch\w*|sneak\w*|duck\w*)\W+(walk|run|forward|move)|sneak/i], ['crouch', /crouch|duck|squat/i], ['sit', /\bsit(ting)?\b|seat/i], ['lie', /lie|lay|sleep|dead|death|down/i],
  ['jump', /jump|leap|fall|air/i], ['runback', /back\w*\W+\w*\W*run|run\W*back/i], ['runleft', /run\W*left|strafe\W*left/i], ['run', /run|jog|sprint/i], ['walk', /walk/i], ['idle', /idle|stand|breath|rest|wait/i]
];
/** Turns, strafes and get-up transitions are not looping motions: they are only played by hand. */
const MIX_MANUAL = /turn|situp|sit up|get up|stand up|to idle|to stand|to crouch|to prone|to sit|strafe|draw|climbing down|to wall/i;
const classifyClip = (name: string): { role: MixRole | null; ctx: MixCtx } => {
  const ctx: MixCtx = /rifle|pistol|gun/i.test(name) ? 'rifle' : /knife|stab/i.test(name) ? 'knife' : /sword/i.test(name) ? 'sword' : null;
  if (MIX_MANUAL.test(name)) return { role: null, ctx };
  return { role: ROLE_NAME.find(([, re]) => re.test(name))?.[0] ?? null, ctx };
};
/** The roles that keep the upper body of a held weapon when only a clip made for empty hands is available. */
const UPPER_KEPT: MixRole[] = ['idle', 'walk', 'run', 'runback', 'runleft', 'crouch', 'crouchwalk'];
/** Roles whose clip already lays the body down or turns it over: the lab must not tilt the body a second time. */
const FLAT_ROLES: MixRole[] = ['crawl', 'proneidle', 'lie', 'roll'];


interface MixEntry {
  id: number;
  label: string;
  role: MixRole | null;
  ctx: MixCtx;
  file: string | null;
  /** Where to fetch the file from (bundled clips are loaded the first time they are needed). */
  url: string | null;
  src: MixamoSource | null;
  loading: boolean;
  clip: string | null;
}

const HEIGHT: Record<Stance, number> = { stand: 1.72, crouch: 1.1, prone: 0.45, sit: 1.25, lie: 0.4 };
const STANCE_NAME: Record<Stance, string> = { stand: 'Đứng', crouch: 'Ngồi xổm', prone: 'Nằm sấp / bò', sit: 'Ngồi', lie: 'Nằm ngửa' };
const STEP = 0.36;
const ease = (u: number) => u * u * (3 - 2 * u);
const angleDiff = (a: number, b: number) => Math.atan2(Math.sin(b - a), Math.cos(b - a));

const holdOf = (id: WeaponId): GunHold => {
  const slot = WEAPONS[id].slot;
  if (slot === 3) return 'knife';
  if (slot === 4) return 'grenade';
  if (id === 'awp') return 'sniper';
  if (id === 'mp9') return 'smg';
  if (slot === 2) return 'pistol';
  return 'rifle';
};

const labelSprite = (text: string, w = 1.1) => {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const g = c.getContext('2d')!;
  g.fillStyle = 'rgba(8,20,30,0.72)';
  g.fillRect(0, 0, 256, 64);
  g.strokeStyle = 'rgba(160,220,255,0.8)';
  g.strokeRect(1, 1, 254, 62);
  g.fillStyle = '#e8f6ff';
  g.font = 'bold 28px sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 128, 33);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
  sp.scale.set(w, w / 4, 1);
  return sp;
};

export class TestLabEngine {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(55, 1, 0.05, 200);
  private readonly model: CharacterModel;
  private readonly sfx = new Sfx();
  private readonly resizeObserver: ResizeObserver;
  private raf = 0;
  private last = performance.now();
  private disposed = false;
  private emitT = 0;

  // player
  private readonly root = new THREE.Group();
  private readonly tiltG = new THREE.Group();
  private readonly pos = new THREE.Vector3();
  private readonly vel = new THREE.Vector3();
  private vy = 0;
  private visY = 0;
  /** Height the body is lifted or sunk so that its lowest point rests on the floor. */
  private groundOff = 0;
  /** 1 right after a hard landing, fading: the knees give to take the impact. */
  private landT = 0;
  /** Objects loaded from files (see labProps.ts). */
  private mixamo: MixEntry[] = [];
  private animationSettings = loadAnimationSettings();
  private mixamoOn = true;
  private mixamoManual: number | null = null;
  private mixamoActive: number | null = null;
  private mixKey = '';
  private mixSeq = 0;
  private lastShot = -9;
  private knifeAlt = false;
  private props: LabProp[] = [];
  private propSeq = 0;
  /** Where the hands are, relative to the body's position, as posed last frame (the climb hangs the body from them). */
  private readonly handRel = new THREE.Vector3();
  /** Phase (rad) of the crawl cycle: it advances with the distance crawled, so the limbs never slide on the floor. */
  private crawlPhase = 0;
  private heading = 0;
  private headingVis = 0;
  private stance: Stance = 'stand';
  private crouchBlend = 0;
  private tilt = 0;
  private scale = 1;
  private scaleSet = false;
  private onGround = true;
  private move: Move | null = null;
  private seat: Seat | null = null;
  private skillUntil = 0;
  private heldPose: PoseType | null = null;
  private state: CharacterState;

  // camera
  private camYaw = 0;
  private camPitch = 0.25;
  private gameSettings = loadGameSettings();
  private camDist = this.gameSettings.cameraDistance;
  private readonly camPos = new THREE.Vector3(0, 3, -25);

  // weapons
  private weapon: LabWeapon = 'none';
  private heldGun: THREE.Group | null = null;
  private heldGunId: WeaponId | null = null;
  private readonly ammo = new Map<WeaponId, number>();
  private cooldown = 0;
  private reloadLeft = 0;
  private aimBlend = 0;
  private kick = 0;
  private swingAt = -9;
  private throwAt = -9;
  private combatUntil = 0;
  private lowered = 0;
  private hits = 0;

  // world
  private solids: Solid[] = [];
  private seats: Seat[] = [];
  private doors: Door[] = [];
  private dummies: Dummy[] = [];
  private bodies: Body[] = [];
  private ball!: Body;
  private carrying: Solid | null = null;
  private fx: Fx[] = [];
  private targets: THREE.Object3D[] = [];
  private debugGroup = new THREE.Group();
  private debugCyl: THREE.Mesh | null = null;
  private debugOn = false;
  private slow = 1;
  private readonly flashTex = radialTexture([[0, 'rgba(255,240,180,1)'], [0.4, 'rgba(255,170,60,0.7)'], [1, 'rgba(255,120,0,0)']]);

  // input
  private keys = new Set<string>();
  private mouse = [false, false, false];
  private dragged = 0;
  /** A click that must not be lost between two frames. */
  private clickAttack = false;
  private wantJump = false;
  private footT = 0;
  private hint = '';
  private toastText = '';
  private toastT = 0;
  private readonly ray = new THREE.Raycaster();

  constructor(private readonly host: HTMLDivElement, state: CharacterState, private readonly onState: (s: LabSnapshot) => void) {
    this.state = { ...state, pose: 'idle' };
    this.renderer = new THREE.WebGLRenderer({ antialias: getRenderSettings().antialias, powerPreference: 'high-performance' });
    configureRenderer(this.renderer, 1.5);
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.9;
    host.appendChild(this.renderer.domElement);
    this.renderer.domElement.style.touchAction = 'none';

    this.buildWorld();
    this.model = new CharacterModel(this.state);
    this.model.setWeaponsVisible(false);
    this.tiltG.add(this.model.group);
    this.root.add(this.tiltG);
    this.scene.add(this.root);
    this.scene.add(this.debugGroup);
    this.applyGameSettings(this.gameSettings);

    void this.loadBundledClips();
    this.bindInput();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(host);
    this.resize();
    this.loop(this.last);
  }

  /* ───────────────────────── world ───────────────────────── */

  private mat(color: number, rough = 0.85) {
    return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0.05 });
  }

  /** A solid box standing on y0. Obstacles can be labelled with their height. */
  private addBox(cx: number, y0: number, cz: number, w: number, h: number, d: number, color: number, opts: { push?: boolean; label?: string } = {}) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), this.mat(color));
    mesh.position.set(cx, y0 + h / 2, cz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);
    const solid: Solid = {
      min: new THREE.Vector3(cx - w / 2, y0, cz - d / 2),
      max: new THREE.Vector3(cx + w / 2, y0 + h, cz + d / 2),
      mesh,
      active: true,
      push: opts.push,
      home: opts.push ? new THREE.Vector3(cx, y0, cz) : undefined
    };
    this.solids.push(solid);
    this.targets.push(mesh);
    if (opts.label) {
      const sp = labelSprite(opts.label);
      sp.position.set(cx, y0 + h + 0.35, cz);
      this.scene.add(sp);
    }
    return solid;
  }

  private placeSolid(s: Solid, x: number, y: number, z: number) {
    const w = s.max.x - s.min.x;
    const h = s.max.y - s.min.y;
    const d = s.max.z - s.min.z;
    s.min.set(x - w / 2, y, z - d / 2);
    s.max.set(x + w / 2, y + h, z + d / 2);
    s.mesh.position.set(x, y + h / 2, z);
  }

  private buildWorld() {
    this.scene.background = new THREE.Color(0xa9cde8);
    this.scene.fog = new THREE.Fog(0xa9cde8, 45, 110);
    this.scene.add(new THREE.HemisphereLight(0xdcecff, 0x6f7a62, 1.15));
    const sun = new THREE.DirectionalLight(0xfff1d8, 2.4);
    sun.position.set(-22, 38, 16);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera;
    sc.left = -48;
    sc.right = 48;
    sc.top = 48;
    sc.bottom = -48;
    sc.far = 120;
    sun.shadow.bias = -0.0004;
    this.scene.add(sun);

    // floor with a 1 m grid
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d')!;
    g.fillStyle = '#7d8c72';
    g.fillRect(0, 0, 128, 128);
    g.fillStyle = '#86967b';
    g.fillRect(0, 0, 64, 64);
    g.fillRect(64, 64, 64, 64);
    g.strokeStyle = 'rgba(255,255,255,0.18)';
    g.strokeRect(0, 0, 128, 128);
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(40, 40);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshStandardMaterial({ map: tex, roughness: 1 }));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);
    this.targets.push(ground);

    // boundary walls
    const wall = 0x9aa5ad;
    this.addBox(0, 0, 39, 80, 4, 1, wall);
    this.addBox(0, 0, -39, 80, 4, 1, wall);
    this.addBox(39, 0, 0, 1, 4, 80, wall);
    this.addBox(-39, 0, 0, 1, 4, 80, wall);

    // wall test: a long wall in front of the spawn (arms, legs and guns must not pass through it)
    this.addBox(0, 0, -8, 10, 3, 0.4, 0xb0a79a, { label: 'Tường 3 m' });

    // ── parkour lane (x ≈ -14) ──
    const px = -14;
    this.addBox(px, 0, -10, 3, 0.45, 0.35, 0xd9a441, { label: 'Rào 0,45 m' });
    this.addBox(px, 0, -5, 3, 0.9, 0.6, 0xd98b41, { label: 'Bục 0,9 m' });
    this.addBox(px, 0, 0, 3, 1.25, 0.6, 0xd96a41, { label: 'Cao 1,25 m' });
    this.addBox(px, 0, 6, 4, 2.0, 1.4, 0xb04a3a, { label: 'Tường leo 2 m' });
    // crawl tunnel: roof 0.75 m above the floor, a prone character fits and a crouching one does not
    this.addBox(px - 1.6, 0, 14, 0.4, 0.75, 4, 0x6b7a8f);
    this.addBox(px + 1.6, 0, 14, 0.4, 0.75, 4, 0x6b7a8f);
    this.addBox(px, 0.75, 14, 3.6, 0.2, 4, 0x55657a, { label: 'Hầm bò 0,75 m' });
    // stairs up to a platform
    for (let i = 0; i < 6; i++) this.addBox(-24 + i * 0.6, 0, -4, 0.6, 0.2 * (i + 1), 3, 0x9a9fa8);
    this.addBox(-19.8, 0, -4, 3, 1.2, 3, 0x8a8f98, { label: 'Cầu thang · bục 1,2 m' });

    // ── props area (x ≈ 12) ──
    const bench = this.addBox(12, 0, -6, 1.6, 0.42, 0.5, 0x8a5a33, { label: 'Ghế dài (E)' });
    this.seats.push({ solid: bench, heading: 0, kind: 'bench' });
    const bed = this.addBox(12, 0, -1.5, 1, 0.5, 2.1, 0xcfd7e8, { label: 'Giường (E)' });
    this.seats.push({ solid: bed, heading: 0, kind: 'bed' });
    // doorway with a sliding door
    this.addBox(8.3, 0, 5, 2.4, 3, 0.4, wall);
    this.addBox(15.7, 0, 5, 2.4, 3, 0.4, wall);
    this.addBox(12, 2.3, 5, 3.6, 0.7, 0.4, wall);
    const door = this.addBox(12, 0, 5, 1.2, 2.3, 0.14, 0x3f6f9a, { label: 'Cửa trượt (E)' });
    this.doors.push({ solid: door, open: 0, want: 0 });
    // light crates to push around or pick up
    for (let i = 0; i < 3; i++) this.addBox(7 + i * 1.4, 0, -12, 0.6, 0.6, 0.6, 0xc9a35b, { push: true, label: i === 0 ? 'Thùng nhẹ (đẩy / E bê)' : undefined });
    const ballMesh = new THREE.Mesh(new THREE.SphereGeometry(0.3, 20, 14), this.mat(0xe14b4b, 0.5));
    ballMesh.castShadow = true;
    this.scene.add(ballMesh);
    this.ball = { mesh: ballMesh, pos: new THREE.Vector3(9, 0.3, 0), vel: new THREE.Vector3(), r: 0.3 };
    this.bodies.push(this.ball);

    // ── shooting range (z ≈ 18) ──
    for (const x of [-6, -3, 0, 3, 6]) this.addDummy(x, 18 + Math.abs(x) * 0.8);
    this.addBox(0, 0, 30, 20, 3, 0.6, 0x6d7a86, { label: 'Bãi bắn' });
    this.addBox(-4, 0, 11, 1.4, 1.1, 0.4, 0x8a8f98, { label: 'Che chắn 1,1 m' });
    this.addBox(4, 0, 11, 1.4, 1.1, 0.4, 0x8a8f98);

    // debug helpers
    this.debugGroup.visible = false;
    for (const s of this.solids) this.debugGroup.add(new THREE.Box3Helper(new THREE.Box3(s.min, s.max), 0xffee55));
  }

  private addDummy(x: number, z: number) {
    const group = new THREE.Group();
    const mats: THREE.MeshStandardMaterial[] = [];
    const part = (geo: THREE.BufferGeometry, color: number, y: number) => {
      const m = this.mat(color, 0.6);
      mats.push(m);
      const mesh = new THREE.Mesh(geo, m);
      mesh.position.y = y;
      mesh.castShadow = true;
      group.add(mesh);
    };
    part(new THREE.CylinderGeometry(0.05, 0.05, 0.9, 8), 0x6b4a2b, 0.45);
    part(new THREE.CylinderGeometry(0.26, 0.3, 0.7, 14), 0xd8c9a3, 1.2);
    part(new THREE.SphereGeometry(0.17, 14, 10), 0xd8c9a3, 1.72);
    group.position.set(x, 0, z);
    const d: Dummy = { group, axis: new THREE.Vector3(1, 0, 0), tilt: 0, tiltV: 0, flash: 0, mats };
    group.traverse((o) => {
      o.userData.dummy = d;
      if ((o as THREE.Mesh).isMesh) this.targets.push(o);
    });
    this.dummies.push(d);
    this.scene.add(group);
    const sp = labelSprite('Bia tập', 0.9);
    sp.position.set(x, 2.25, z);
    this.scene.add(sp);
  }

  /* ───────────────────────── public controls ───────────────────────── */

  public applyGameSettings(settings: GameSettings) {
    this.gameSettings = normalizeGameSettings(settings);
    this.camDist = this.gameSettings.cameraDistance;
    this.camera.fov = this.gameSettings.cameraFov;
    this.camera.updateProjectionMatrix();
    this.slow = this.gameSettings.timeScale;
    this.teleport(this.gameSettings.startZone);
    this.setWeapon(this.gameSettings.startWeapon);
    this.emit();
  }

  public setWeapon(w: LabWeapon) {
    if (this.weapon === w) return;
    this.weapon = w;
    this.reloadLeft = 0;
    this.cooldown = 0.25;
    this.heldPose = null;
    if (w !== 'none' && w !== 'class' && !this.ammo.has(w)) this.ammo.set(w, WEAPONS[w].magazine);
    this.emit();
  }

  public setPose(p: PoseType | null) {
    this.heldPose = p;
    this.move = null;
    if (p) {
      if (!this.standUp(true)) {
        this.heldPose = null;
        return;
      }
      this.state = { ...this.state, pose: p };
      this.model.updateState(this.state);
    }
    this.emit();
  }

  public playSkill(id: string) {
    if (this.move || this.stance === 'prone' || this.stance === 'lie' || this.seat) return;
    this.heldPose = null;
    this.setWeapon('class');
    this.standUp(false);
    const dur = this.model.playSkill(id);
    if (dur > 0) {
      this.skillUntil = performance.now() / 1000 + dur;
      this.vel.set(0, 0, 0);
    }
    this.emit();
  }

  /* ───────────────────────── Mixamo clips ───────────────────────── */

  /** Load animation file(s) from Mixamo (.fbx or .glb with a mixamorig skeleton); each clip joins the library. */
  public async addMixamo(file: File) {
    const src = await MixamoSource.load(file);
    for (const clip of src.clipNames) {
      const { role, ctx } = classifyClip(clip);
      this.mixamo.push({ id: ++this.mixSeq, label: clip, role, ctx, file: null, url: null, src, loading: false, clip });
    }
    this.mixamoOn = true;
    this.toast(`Đã nạp ${src.clipNames.length} animation từ ${file.name}`);
    this.emit();
  }

  /** The clips that come with the project (public/animations): listed now, fetched when first needed, the ones with a role first. */
  private async loadBundledClips() {
    try {
      const res = await fetch('/animations/manifest.json');
      if (!res.ok || (res.headers.get('content-type') ?? '').includes('text/html')) return;
      const list = (await res.json()) as { file: string; label: string; role: MixRole | null; ctx: MixCtx }[];
      for (const it of list) this.mixamo.push({ id: ++this.mixSeq, label: it.label, role: it.role, ctx: it.ctx, file: it.file, url: `/animations/${it.file}`, src: null, loading: false, clip: null });
      this.emit();
      for (const e of this.mixamo.filter((x) => x.role)) {
        if (this.disposed) return;
        await this.ensureMixamo(e);
        await new Promise((r) => setTimeout(r, 30)); // let the frame draw between two files
      }
    } catch (e) {
      console.warn('bundled animations not loaded', e);
    }
  }

  private async ensureMixamo(e: MixEntry) {
    if (e.src || e.loading || !e.url) return;
    e.loading = true;
    try {
      const res = await fetch(e.url);
      if (!res.ok) throw new Error(`${res.status}`);
      const src = await MixamoSource.load(new File([await res.arrayBuffer()], `${e.label}.fbx`));
      e.src = src;
      e.clip = src.clipNames[0] ?? null;
    } catch (err) {
      console.warn('animation not loaded', e.label, err);
      e.url = null;
    }
    e.loading = false;
    if (!this.disposed) this.emit();
  }

  public setMixamoOn(on: boolean) {
    this.mixamoOn = on;
    if (!on) this.model.setRetarget(null);
    this.emit();
  }

  /** Play a library clip by hand (`null` goes back to choosing by what the character is doing). */
  public playMixamo(id: number | null) {
    this.mixamoManual = id;
    if (id !== null) {
      this.mixamoOn = true;
      const e = this.mixamo.find((x) => x.id === id);
      if (e) void this.ensureMixamo(e);
    }
    this.emit();
  }

  /** Forget the clips the user loaded (the bundled ones stay). */
  public clearMixamo() {
    this.model.setRetarget(null);
    const own = this.mixamo.filter((m) => !m.url && m.src);
    new Set(own.map((m) => m.src!)).forEach((src) => src.dispose());
    this.mixamo = this.mixamo.filter((m) => !own.includes(m));
    this.mixamoManual = null;
    this.mixamoActive = null;
    this.emit();
  }

  /** Choose a bundled clip for a body action, or use the built-in movement. Null restores the manifest choice. */
  public async setAnimationDefault(role: MixRole, ctx: MixCtx, file: string | null) {
    if (file && file !== BUILTIN_ANIMATION && !this.mixamo.some((entry) => entry.file === file)) return;
    const key = animationSettingKey(role, ctx);
    const next = { ...this.animationSettings };
    if (file === null) delete next[key]; else next[key] = file;
    await saveAnimationSettings(next);
    if (this.disposed) return;
    this.animationSettings = next;
    this.mixKey = '';
    if (this.mixamoManual !== null) this.mixamoManual = null;
    this.emit();
  }

  public async resetAnimationDefaults() {
    await saveAnimationSettings({});
    if (this.disposed) return;
    this.animationSettings = {};
    this.mixKey = '';
    this.mixamoManual = null;
    this.emit();
  }

  /** The library entry for a role, preferring one made for the weapon in hand; roles with stand-ins fall back to them. */
  private pickMix(role: MixRole, ctx: MixCtx): MixEntry | null {
    return resolveAnimation(this.mixamo, this.animationSettings, role, ctx);
  }

  /** What the character is doing, as a role (and the time an action takes, the side it runs to). */
  private mixRoleNow(v: number, now: number, ctx: MixCtx) {
    const m = this.move;
    const gun = this.gunId;
    const def = gun ? WEAPONS[gun] : null;
    let role: MixRole;
    let once = 0;
    let mirror = false;
    let stamp = 0;
    if (def && def.slot === 4 && now - this.throwAt < 0.8) [role, once, stamp] = ['throw', 0.8, this.throwAt];
    else if (def && def.slot === 3 && now - this.swingAt < 0.45) [role, once, stamp] = [this.knifeAlt ? 'slash' : 'stab', 0.45, this.swingAt];
    else if (def && def.slot <= 2 && this.reloadLeft > 0) [role, once] = ['reload', def.reload];
    else if (def && def.slot <= 2 && now - this.lastShot < 0.3) role = 'fire';
    else if (m) [role, once] = [m.kind === 'roll' ? 'roll' : m.kind === 'vault' ? 'vault' : 'climb', m.kind === 'climb' ? 0 : m.dur];
    else if (!this.onGround) [role, once] = ['jump', 0.62];
    else if (this.stance === 'prone') role = v > 0.2 ? 'crawl' : 'proneidle';
    else if (this.stance === 'lie') role = 'lie';
    else if (this.stance === 'sit' || this.seat) role = 'sit';
    else if (this.stance === 'crouch') role = v > 0.3 ? 'crouchwalk' : 'crouch';
    else {
      role = v > 3.6 ? 'run' : v > 0.4 ? 'walk' : 'idle';
      // facing one way and moving another (aiming, fighting): run backwards or to the side
      if (v > 0.4 && ctx && (this.mouse[2] || now < this.combatUntil)) {
        const rel = angleDiff(this.heading, Math.atan2(this.vel.x, this.vel.z));
        if (Math.abs(rel) > 2.1) role = 'runback';
        else if (Math.abs(rel) > 0.9) [role, mirror] = ['runleft', rel < 0];
      }
    }
    return { role, once, mirror, stamp };
  }

  /** The body pose of the clip now chosen, sampled for this frame; `flat` when the clip itself lays the body down. */
  private mixamoPose(dt: number, v: number, now: number): { pose: RetargetPose | null; flat: boolean } {
    const none = { pose: null, flat: false };
    this.mixamoActive = null;
    if (!this.mixamoOn || !this.mixamo.length) return none;
    const gun = this.gunId;
    const def = gun ? WEAPONS[gun] : null;
    const ctx: MixCtx = def ? (def.slot <= 2 ? 'rifle' : def.slot === 3 ? 'knife' : null) : this.weapon === 'class' ? 'sword' : null;
    let entry: MixEntry | null = this.mixamoManual !== null ? this.mixamo.find((x) => x.id === this.mixamoManual) ?? null : null;
    let { role, once, mirror, stamp } = this.mixRoleNow(v, now, ctx);
    if (entry) {
      once = 0;
      mirror = false;
    } else entry = this.pickMix(role, ctx);
    if (!entry) return none;
    if (!entry.src || !entry.clip) {
      void this.ensureMixamo(entry);
      return none; // until the file is in, the built-in pose
    }
    const dur = entry.src.duration(entry.clip);
    const key = `${entry.id}|${once ? stamp || role : ''}`;
    const speed = once ? dur / once : this.mixamoManual !== null ? 1 : THREE.MathUtils.clamp(entry.role === 'run' ? v / 5.4 : entry.role === 'idle' ? 1 : v / (entry.role === 'crawl' ? 0.9 : 2.4), 0.6, 1.6);
    entry.src.play(entry.clip, speed, { once: once > 0, restart: once > 0 && key !== this.mixKey });
    this.mixKey = key;
    this.mixamoActive = entry.id;
    const eff = entry.role ?? role;
    // a clip made for empty hands must not take the arms and chest from a weapon pose
    const keep = !!def && entry.ctx !== ctx && UPPER_KEPT.includes(eff) && this.mixamoManual === null;
    return { pose: entry.src.sample(dt, keep ? 'lower' : 'all', mirror), flat: this.mixamoManual === null && FLAT_ROLES.includes(eff) };
  }

  /* ───────────────────────── objects loaded from files ───────────────────────── */

  /** Load a .glb of objects (trees, cars, crates, ...) into the sandbox, in front of the camera; `split` makes each object of the file its own prop. */
  public async addProps(file: File, split: boolean) {
    const gltf = await new GLTFLoader().parseAsync(await file.arrayBuffer(), '');
    gltf.scene.updateMatrixWorld(true);
    const hasMesh = (n: THREE.Object3D) => {
      let found = false;
      n.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) found = true;
      });
      return found;
    };
    const items: { name: string; obj: THREE.Object3D; clips: THREE.AnimationClip[] }[] = split
      ? gltf.scene.children.filter(hasMesh).map((c) => {
          const copy = c.clone();
          copy.position.set(0, 0, 0);
          const holder = new THREE.Group();
          holder.add(copy);
          return { name: c.name || file.name, obj: holder, clips: [] };
        })
      : hasMesh(gltf.scene)
        ? [{ name: file.name, obj: gltf.scene, clips: gltf.animations }]
        : [];
    if (!items.length) throw new Error('no meshes in file');
    const made = items.map((it) => new LabProp(++this.propSeq, it.name, it.obj, it.clips));
    const width = (p: LabProp) => Math.max(p.dimensions().x, p.dimensions().z);
    const gap = 0.6;
    let cursor = -(made.reduce((a, p) => a + width(p), 0) + gap * (made.length - 1)) / 2;
    const depth = Math.max(...made.map(width)) / 2;
    made.forEach((p) => {
      const c = cursor + width(p) / 2;
      cursor += width(p) + gap;
      this.placeProp(p, c, 2.2 + depth);
      this.scene.add(p.group);
      p.meshes.forEach((m) => this.targets.push(m));
      this.props.push(p);
      this.syncProp(p);
    });
    this.toast(made.length > 1 ? `Đã nạp ${made.length} vật thể từ ${file.name}` : `Đã nạp ${file.name}`);
    this.emit();
  }

  /** Put a prop `ahead` metres in front of the camera and `side` metres to its right. */
  private placeProp(p: LabProp, side: number, ahead: number) {
    const fx = Math.sin(this.camYaw);
    const fz = Math.cos(this.camYaw);
    const x = THREE.MathUtils.clamp(this.pos.x + fx * ahead - fz * side, -36, 36);
    const z = THREE.MathUtils.clamp(this.pos.z + fz * ahead + fx * side, -36, 36);
    p.group.position.set(x, 0, z);
  }

  /** Rebuild the solid of a prop after it moved, turned, was resized or its collision changed. */
  private syncProp(p: LabProp) {
    if (p.solid) {
      const i = this.solids.findIndex((s) => s.min === p.solid!.min);
      if (i >= 0) this.solids.splice(i, 1);
      p.solid = null;
    }
    if (p.helper) {
      this.debugGroup.remove(p.helper);
      p.helper = null;
    }
    p.group.rotation.y = p.group.rotation.y % (Math.PI * 2);
    if (p.collide === 'none') return;
    const box = p.bounds();
    const solid: Solid = { min: box.min, max: box.max, mesh: new THREE.Mesh(), active: true };
    this.solids.push(solid);
    p.solid = solid;
    p.helper = new THREE.Box3Helper(new THREE.Box3(box.min, box.max), 0x66ddff);
    this.debugGroup.add(p.helper);
  }

  private prop(id: number) {
    return this.props.find((p) => p.id === id);
  }

  public setPropSize(id: number, size: number) {
    const p = this.prop(id);
    if (!p || !(size > 0)) return;
    p.setSize(THREE.MathUtils.clamp(size, 0.1, 60));
    this.syncProp(p);
    this.emit();
  }

  public rotateProp(id: number) {
    const p = this.prop(id);
    if (!p) return;
    p.group.rotation.y += Math.PI / 2;
    this.syncProp(p);
  }

  /** Shift a prop by `right` / `ahead` metres as seen from the camera. */
  public movePropView(id: number, right: number, ahead: number) {
    const p = this.prop(id);
    if (!p) return;
    const fx = Math.sin(this.camYaw);
    const fz = Math.cos(this.camYaw);
    p.group.position.x = THREE.MathUtils.clamp(p.group.position.x + fx * ahead - fz * right, -37, 37);
    p.group.position.z = THREE.MathUtils.clamp(p.group.position.z + fz * ahead + fx * right, -37, 37);
    this.syncProp(p);
  }

  public placePropFront(id: number) {
    const p = this.prop(id);
    if (!p) return;
    this.placeProp(p, 0, 2.2 + Math.max(p.dimensions().x, p.dimensions().z) / 2);
    this.syncProp(p);
  }

  public setPropCollide(id: number, mode: PropCollide) {
    const p = this.prop(id);
    if (!p) return;
    p.collide = mode;
    this.syncProp(p);
    this.emit();
  }

  public togglePropAnimation(id: number) {
    this.prop(id)?.toggleAnimation();
    this.emit();
  }

  public removeProp(id: number) {
    const p = this.prop(id);
    if (!p) return;
    p.collide = 'none';
    this.syncProp(p);
    this.targets = this.targets.filter((t) => !p.meshes.includes(t as THREE.Mesh));
    p.dispose();
    this.props = this.props.filter((x) => x !== p);
    this.emit();
  }

  public clearProps() {
    [...this.props].forEach((p) => this.removeProp(p.id));
  }

  public setSlow(v: number) {
    this.slow = v;
    this.emit();
  }

  public toggleDebug() {
    this.debugOn = !this.debugOn;
    this.debugGroup.visible = this.debugOn;
    this.emit();
  }

  public teleport(id: string) {
    const z = LAB_ZONES.find((x) => x.id === id) ?? LAB_ZONES[0];
    this.drop();
    this.pos.set(z.at[0], 0, z.at[1]);
    this.visY = 0;
    this.vy = 0;
    this.vel.set(0, 0, 0);
    this.heading = this.headingVis = z.heading;
    this.camYaw = z.heading;
    this.stance = 'stand';
    this.move = null;
    this.seat = null;
    this.heldPose = null;
  }

  public action(a: LabAction) {
    switch (a) {
      case 'jump':
        this.wantJump = true;
        break;
      case 'crouch':
        this.toggleStance('crouch');
        break;
      case 'prone':
        this.toggleStance('prone');
        break;
      case 'sit':
        this.toggleStance('sit');
        break;
      case 'lie':
        this.toggleStance('lie');
        break;
      case 'roll':
        this.startRoll();
        break;
      case 'vault':
        this.tryVault();
        break;
      case 'interact':
        this.interact();
        break;
      case 'reload':
        this.reload();
        break;
      case 'reset':
        this.resetWorld();
        break;
    }
  }

  public dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.resizeObserver.disconnect();
    this.unbindInput();
    this.sfx.dispose();
    this.model.dispose();
    if (this.heldGun) disposeTree(this.heldGun);
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.userData.sharedAsset) return; // loaded weapon models are shared across games
      m.geometry?.dispose();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (mat) (Array.isArray(mat) ? mat : [mat]).forEach((x) => x.dispose());
    });
    this.flashTex.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  private resetWorld() {
    this.drop();
    for (const s of this.solids) if (s.push && s.home) this.placeSolid(s, s.home.x, s.home.y, s.home.z);
    this.ball.pos.set(9, 0.3, 0);
    this.ball.vel.set(0, 0, 0);
    for (const b of this.bodies.filter((x) => x !== this.ball)) {
      this.scene.remove(b.mesh);
      disposeTree(b.mesh);
    }
    this.bodies = [this.ball];
    for (const d of this.doors) d.want = 0;
    for (const d of this.dummies) d.tilt = d.tiltV = 0;
    this.toast('Đã đặt lại vật thể.');
  }

  /* ───────────────────────── input ───────────────────────── */

  private onKeyDown = (e: KeyboardEvent) => {
    // keys typed into a number box or a list are not game keys; a tick box or a button must not swallow them
    if ((e.target as HTMLElement | null)?.closest('textarea, select, input:not([type=checkbox]):not([type=file])')) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const code = e.code;
    this.keys.add(code);
    if (e.repeat) return;
    if (code === 'Space') {
      this.wantJump = true;
      e.preventDefault();
    } else if (code === 'KeyC') this.toggleStance('crouch');
    else if (code === 'KeyZ') this.toggleStance('prone');
    else if (code === 'KeyX') this.toggleStance('sit');
    else if (code === 'KeyL') this.toggleStance('lie');
    else if (code === 'KeyQ') this.startRoll();
    else if (code === 'KeyV') this.tryVault();
    else if (code === 'KeyE') this.interact();
    else if (code === 'KeyR') this.reload();
    else if (code === 'KeyB') this.toggleDebug();
    else if (code === 'KeyT') this.setSlow(this.slow === 1 ? 0.3 : 1);
    else if (code === 'KeyY') this.resetWorld();
    else if (/^Digit[0-9]$/.test(code)) {
      const w = LAB_WEAPONS[(Number(code.slice(5)) + 9) % 10];
      if (w) this.setWeapon(w.id);
    }
    this.sfx.resume();
  };
  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
  };
  private onBlur = () => {
    this.keys.clear();
    this.mouse = [false, false, false];
  };
  // mouse events, not pointer events: a second button pressed while another is held (fire while aiming) sends no pointerdown
  private onDown = (e: MouseEvent) => {
    (document.activeElement as HTMLElement | null)?.blur?.();
    this.mouse[e.button] = true;
    this.dragged = 0;
    this.sfx.resume();
    if (e.button === 0) {
      this.clickAttack = true;
      this.pressAttack();
    }
  };
  private onUp = (e: MouseEvent) => {
    this.mouse[e.button] = false;
  };
  private onMove = (e: PointerEvent) => {
    const orbit = this.mouse[2] || (this.mouse[0] && (this.weapon === 'none' || this.dragged > 6)) || (e.buttons & 4) !== 0;
    if (!orbit) return;
    this.dragged += Math.abs(e.movementX) + Math.abs(e.movementY);
    this.camYaw -= e.movementX * 0.005 * this.gameSettings.mouseSensitivity;
    this.camPitch = THREE.MathUtils.clamp(this.camPitch + e.movementY * 0.004 * this.gameSettings.mouseSensitivity, -0.5, 1.2);
  };
  private onWheel = (e: WheelEvent) => {
    e.preventDefault();
    this.camDist = THREE.MathUtils.clamp(this.camDist * (1 + Math.sign(e.deltaY) * 0.08), 1.6, 12);
  };
  private onContext = (e: Event) => e.preventDefault();

  private bindInput() {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    const el = this.renderer.domElement;
    el.addEventListener('mousedown', this.onDown);
    window.addEventListener('mouseup', this.onUp);
    el.addEventListener('pointermove', this.onMove);
    el.addEventListener('wheel', this.onWheel, { passive: false });
    el.addEventListener('contextmenu', this.onContext);
  }

  private unbindInput() {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    const el = this.renderer.domElement;
    el.removeEventListener('mousedown', this.onDown);
    window.removeEventListener('mouseup', this.onUp);
    el.removeEventListener('pointermove', this.onMove);
    el.removeEventListener('wheel', this.onWheel);
    el.removeEventListener('contextmenu', this.onContext);
  }

  private resize() {
    const w = this.host.clientWidth || 1;
    const h = this.host.clientHeight || 1;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  /* ───────────────────────── collision ───────────────────────── */

  private get radius() {
    return 0.3 * this.scale;
  }

  /** Circle offsets along the heading: a body lying down is long, so its head and feet are tested too. */
  private offsets(stance: Stance): number[] {
    return stance === 'prone' || stance === 'lie' ? [-0.75 * this.scale, 0, 0.75 * this.scale] : [0];
  }

  private blocks(s: Solid, feet: number, h: number) {
    return s.active && !s.carried && s.min.y < feet + h - 0.02 && s.max.y > feet + STEP;
  }

  /** Correction that pushes the circle (cx, cz) out of box s, or null when they do not touch. */
  private circleOut(s: Solid, cx: number, cz: number, r: number): THREE.Vector2 | null {
    const px = Math.max(s.min.x, Math.min(s.max.x, cx));
    const pz = Math.max(s.min.z, Math.min(s.max.z, cz));
    const dx = cx - px;
    const dz = cz - pz;
    const d = Math.hypot(dx, dz);
    if (d >= r) return null;
    if (d > 1e-5) return new THREE.Vector2((dx / d) * (r - d), (dz / d) * (r - d));
    // centre inside the box: leave by the nearest face
    const l = cx - s.min.x;
    const rr = s.max.x - cx;
    const t = cz - s.min.z;
    const b = s.max.z - cz;
    const m = Math.min(l, rr, t, b);
    if (m === l) return new THREE.Vector2(-l - r, 0);
    if (m === rr) return new THREE.Vector2(rr + r, 0);
    if (m === t) return new THREE.Vector2(0, -t - r);
    return new THREE.Vector2(0, b + r);
  }

  private overlaps(x: number, z: number, feet: number, h: number, stance: Stance) {
    const r = this.radius;
    const fx = Math.sin(this.heading);
    const fz = Math.cos(this.heading);
    for (const off of this.offsets(stance)) for (const s of this.solids) if (this.blocks(s, feet, h) && this.circleOut(s, x + fx * off, z + fz * off, r)) return true;
    return false;
  }

  private resolve(stance = this.stance) {
    const r = this.radius;
    const h = HEIGHT[stance] * this.scale;
    const fx = Math.sin(this.heading);
    const fz = Math.cos(this.heading);
    for (let it = 0; it < 3; it++) {
      for (const off of this.offsets(stance)) {
        for (const s of this.solids) {
          if (!this.blocks(s, this.pos.y, h)) continue;
          const out = this.circleOut(s, this.pos.x + fx * off, this.pos.z + fz * off, r);
          if (!out) continue;
          if (s.push && this.pushCrate(s, out)) continue;
          this.pos.x += out.x;
          this.pos.z += out.y;
        }
      }
    }
  }

  /** Shove a light crate by the overlap; false when something behind it is in the way. */
  private pushCrate(s: Solid, out: THREE.Vector2): boolean {
    const w = s.max.x - s.min.x;
    const d = s.max.z - s.min.z;
    const nx = (s.min.x + s.max.x) / 2 - out.x;
    const nz = (s.min.z + s.max.z) / 2 - out.y;
    const x0 = nx - w / 2;
    const x1 = nx + w / 2;
    const z0 = nz - d / 2;
    const z1 = nz + d / 2;
    for (const o of this.solids) {
      if (o === s || !o.active || o.carried) continue;
      if (x0 < o.max.x && x1 > o.min.x && z0 < o.max.z && z1 > o.min.z && s.min.y < o.max.y - 0.02 && s.max.y > o.min.y + 0.02) return false;
    }
    this.placeSolid(s, nx, s.min.y, nz);
    return true;
  }

  private groundAt(x: number, z: number, feet: number, r = this.radius * 0.8) {
    let g = 0;
    for (const s of this.solids) {
      if (!s.active || s.carried) continue;
      if (s.max.y > feet + STEP) continue;
      if (x > s.min.x - r && x < s.max.x + r && z > s.min.z - r && z < s.max.z + r) g = Math.max(g, s.max.y);
    }
    return g;
  }

  private headroom(stance: Stance) {
    return !this.overlaps(this.pos.x, this.pos.z, this.pos.y, HEIGHT[stance] * this.scale, stance);
  }

  /* ───────────────────────── stances & actions ───────────────────────── */

  private standUp(quiet: boolean): boolean {
    if (this.seat) {
      const fx = Math.sin(this.heading);
      const fz = Math.cos(this.heading);
      if (this.seat.kind === 'bed') this.pos.set(this.pos.x + 0.9, 0, this.pos.z);
      else this.pos.set(this.pos.x + fx * 0.7, 0, this.pos.z + fz * 0.7);
      this.pos.y = this.groundAt(this.pos.x, this.pos.z, 0.2);
      this.visY = this.pos.y;
      this.seat = null;
      this.stance = 'stand';
      return true;
    }
    if (this.stance === 'stand') return true;
    if (this.headroom('stand')) {
      this.stance = 'stand';
      return true;
    }
    if (!quiet) this.toast('Không đủ chỗ để đứng dậy.');
    return false;
  }

  private toggleStance(next: Stance) {
    if (this.move || !this.model.ready) return;
    this.heldPose = null;
    if (this.seat || this.stance === next) {
      this.standUp(false);
      return;
    }
    if (this.carrying && next !== 'crouch') return;
    if ((next === 'sit' || next === 'lie') && !this.onGround) return;
    if (HEIGHT[next] > HEIGHT[this.stance] && !this.headroom(next)) {
      this.toast('Không đủ chỗ.');
      return;
    }
    if (next === 'sit' || next === 'lie') this.vel.set(0, 0, 0);
    this.stance = next;
  }

  private startRoll() {
    if (this.move || this.seat || !this.onGround || this.carrying || !this.model.ready) return;
    this.heldPose = null;
    if (this.stance !== 'stand' && this.stance !== 'crouch' && !this.standUp(false)) return;
    const dir = this.inputDir();
    const d = dir.lengthSq() > 0.01 ? dir.normalize() : new THREE.Vector2(Math.sin(this.heading), Math.cos(this.heading));
    this.heading = Math.atan2(d.x, d.y);
    this.move = { kind: 'roll', t: 0, dur: 0.75, dir: d };
    this.sfx.footstep(this.pos, 1.5);
  }

  /** Look ahead for something to climb over or onto. */
  private findObstacle() {
    const f = new THREE.Vector2(Math.sin(this.heading), Math.cos(this.heading));
    const feet = this.pos.y;
    for (let d = 0.25; d <= 1.0; d += 0.1) {
      const qx = this.pos.x + f.x * d;
      const qz = this.pos.z + f.y * d;
      for (const s of this.solids) {
        if (!s.active || s.carried || s.push) continue;
        if (qx < s.min.x - 0.02 || qx > s.max.x + 0.02 || qz < s.min.z - 0.02 || qz > s.max.z + 0.02) continue;
        const rel = s.max.y - feet;
        if (rel <= STEP + 0.02 || rel > 2.6 * this.scale) continue;
        // how deep is it along the heading?
        let exit = d;
        for (; exit < d + 5; exit += 0.1) {
          const x = this.pos.x + f.x * exit;
          const z = this.pos.z + f.y * exit;
          if (x < s.min.x || x > s.max.x || z < s.min.z || z > s.max.z) break;
        }
        return { s, f, entry: d, exit, rel };
      }
    }
    return null;
  }

  /** Distance along f from the body to where the box begins (null when the ray misses it). */
  private faceDist(s: Solid, f: THREE.Vector2): number | null {
    let tmin = -Infinity;
    let tmax = Infinity;
    for (const [o, d, lo, hi] of [[this.pos.x, f.x, s.min.x, s.max.x], [this.pos.z, f.y, s.min.z, s.max.z]]) {
      if (Math.abs(d) < 1e-6) {
        if (o < lo || o > hi) return null;
        continue;
      }
      const t1 = (lo - o) / d;
      const t2 = (hi - o) / d;
      tmin = Math.max(tmin, Math.min(t1, t2));
      tmax = Math.min(tmax, Math.max(t1, t2));
    }
    return tmin <= tmax ? Math.max(0, tmin) : null;
  }

  private tryVault(): boolean {
    if (this.move || !this.model.ready || this.carrying) return false;
    if (this.seat || this.stance === 'prone' || this.stance === 'lie' || this.stance === 'sit') return false;
    const o = this.findObstacle();
    if (!o) {
      this.toast('Không có chướng ngại vật phía trước.');
      return false;
    }
    this.heldPose = null;
    this.stance = 'stand';
    const { s, f, entry, exit, rel } = o;
    const depth = exit - entry;
    const from = this.pos.clone();
    const top = s.max.y;
    if (rel <= 1.35 * this.scale && depth <= 2.4) {
      const land = exit + 0.45;
      const lx = this.pos.x + f.x * land;
      const lz = this.pos.z + f.y * land;
      const ly = this.groundAt(lx, lz, top);
      if (!this.overlaps(lx, lz, ly, HEIGHT.stand * this.scale, 'stand')) {
        this.move = { kind: 'vault', t: 0, dur: 0.8, from, to: new THREE.Vector3(lx, ly, lz), clearance: Math.max(top - (from.y + ly) / 2, 0) + 0.18 };
        this.sfx.footstep(this.pos, 1.4);
        return true;
      }
      // nowhere to come down: mount it instead
      const reach = entry + Math.min(0.5, depth / 2);
      this.move = { kind: 'vault', t: 0, dur: 0.7, from, to: new THREE.Vector3(this.pos.x + f.x * reach, top, this.pos.z + f.y * reach), clearance: 0.2 };
      return true;
    }
    // the hands go on the top edge of the obstacle: where its face is, along the heading
    const face = this.faceDist(s, f) ?? entry;
    const wall = from.clone().add(new THREE.Vector3(f.x, 0, f.y).multiplyScalar(Math.max(0, face - 0.3 * this.scale)));
    const reach = face + Math.min(0.6, depth / 2 + 0.1);
    const edge = new THREE.Vector3(this.pos.x + f.x * face, top, this.pos.z + f.y * face);
    this.move = { kind: 'climb', t: 0, dur: 2.0, from, wall, to: new THREE.Vector3(this.pos.x + f.x * reach, top, this.pos.z + f.y * reach), edge, f: f.clone() };
    return true;
  }

  private jump() {
    if (this.move || !this.model.ready) return;
    if (this.seat || this.stance === 'sit' || this.stance === 'lie' || this.stance === 'prone') {
      this.standUp(false);
      return;
    }
    if (!this.carrying && this.findObstacle() && this.tryVault()) return;
    if (!this.onGround) return;
    if (this.stance === 'crouch' && !this.standUp(false)) return;
    this.vy = this.gameSettings.jumpSpeed;
    this.onGround = false;
    this.sfx.footstep(this.pos, 1.3);
  }

  /* ───────────────────────── interactions ───────────────────────── */

  private nearest<T>(list: T[], at: (t: T) => THREE.Vector3, reach: number): T | null {
    let best: T | null = null;
    let bd = reach;
    for (const t of list) {
      const p = at(t);
      const d = Math.hypot(p.x - this.pos.x, p.z - this.pos.z);
      if (d < bd) {
        bd = d;
        best = t;
      }
    }
    return best;
  }

  private center(s: Solid) {
    return new THREE.Vector3((s.min.x + s.max.x) / 2, s.min.y, (s.min.z + s.max.z) / 2);
  }

  private interactTarget():
    | { kind: 'stand' | 'drop'; label: string }
    | { kind: 'seat'; seat: Seat; label: string }
    | { kind: 'door'; door: Door; label: string }
    | { kind: 'carry'; crate: Solid; label: string }
    | null {
    if (this.move) return null;
    if (this.seat) return { kind: 'stand', label: 'E · Đứng dậy' };
    if (this.carrying) return { kind: 'drop', label: 'E · Đặt thùng xuống' };
    if (this.stance !== 'stand' && this.stance !== 'crouch') return null;
    const seat = this.nearest(this.seats, (s) => this.center(s.solid), 1.6);
    if (seat) return { kind: 'seat', seat, label: seat.kind === 'bed' ? 'E · Nằm xuống giường' : 'E · Ngồi xuống ghế' };
    const door = this.nearest(this.doors, (d) => this.center(d.solid), 2.2);
    if (door) return { kind: 'door', door, label: door.want ? 'E · Đóng cửa' : 'E · Mở cửa' };
    const crate = this.nearest(this.solids.filter((s) => s.push && s.active && !s.carried), (s) => this.center(s), 1.5);
    if (crate) return { kind: 'carry', crate, label: 'E · Bê thùng' };
    return null;
  }

  private interact() {
    if (!this.model.ready) return;
    const t = this.interactTarget();
    if (!t) return;
    this.heldPose = null;
    switch (t.kind) {
      case 'stand':
        this.standUp(false);
        break;
      case 'drop':
        this.drop();
        break;
      case 'door':
        t.door.want = t.door.want ? 0 : 1;
        this.sfx.click(900, 0.12);
        break;
      case 'carry':
        this.stance = 'stand';
        this.carrying = t.crate;
        t.crate.carried = true;
        break;
      case 'seat': {
        const c = this.center(t.seat.solid);
        this.vel.set(0, 0, 0);
        this.seat = t.seat;
        this.heading = this.headingVis = t.seat.heading;
        const fz = Math.cos(this.heading);
        if (t.seat.kind === 'bed') {
          this.pos.set(c.x, t.seat.solid.max.y, c.z);
          this.stance = 'lie';
        } else {
          this.pos.set(c.x, 0, c.z - fz * 0.12);
          this.stance = 'sit';
        }
        this.visY = this.pos.y;
        break;
      }
    }
  }

  private drop() {
    const c = this.carrying;
    if (!c) return;
    const w = c.max.x - c.min.x;
    const x = this.pos.x + Math.sin(this.headingVis) * 0.85;
    const z = this.pos.z + Math.cos(this.headingVis) * 0.85;
    c.carried = false;
    c.mesh.rotation.y = 0;
    this.placeSolid(c, x, this.groundAt(x, z, this.pos.y + 0.2, w / 2), z);
    const taken = this.solids.some((o) => o !== c && o.active && !o.carried && o.min.x < c.max.x && o.max.x > c.min.x && o.min.z < c.max.z && o.max.z > c.min.z && o.min.y < c.max.y - 0.02 && o.max.y > c.min.y + 0.02);
    if (taken) this.placeSolid(c, this.pos.x, this.pos.y, this.pos.z);
    this.carrying = null;
  }

  /* ───────────────────────── weapons ───────────────────────── */

  private get gunId(): WeaponId | null {
    return this.weapon === 'none' || this.weapon === 'class' ? null : this.weapon;
  }

  private reload() {
    const id = this.gunId;
    if (!id || WEAPONS[id].slot > 2 || this.reloadLeft > 0) return;
    if ((this.ammo.get(id) ?? 0) >= WEAPONS[id].magazine) return;
    this.reloadLeft = WEAPONS[id].reload;
    this.sfx.reload(WEAPONS[id].reload);
  }

  private pressAttack() {
    // class weapon: a click performs one of the skills in turn; guns fire from the loop (auto weapons keep firing while held)
    if (this.weapon === 'class') {
      const list = skillsFor(this.state.characterClass);
      if (list.length) this.playSkill(list[Math.floor(performance.now() / 700) % list.length].id);
    }
  }

  private canAttack() {
    return this.model.ready && !this.move && !this.seat && (this.stance === 'stand' || this.stance === 'crouch') && !this.heldPose && !this.carrying && performance.now() / 1000 > this.skillUntil;
  }

  private attack(now: number) {
    const id = this.gunId;
    if (!id || this.cooldown > 0 || !this.canAttack() || !this.heldGun) return;
    const def = WEAPONS[id];
    this.combatUntil = now + 0.7;
    if (def.slot === 3) {
      this.swingAt = now;
      this.knifeAlt = !this.knifeAlt;
      this.cooldown = def.cycle;
      this.sfx.knife(false, this.pos);
      window.setTimeout(() => !this.disposed && this.meleeHit(), 170);
      return;
    }
    if (def.slot === 4) {
      this.throwAt = now;
      this.cooldown = 1.0;
      window.setTimeout(() => !this.disposed && this.throwGrenade(), 260);
      return;
    }
    if (this.reloadLeft > 0) return;
    const mag = this.ammo.get(id) ?? 0;
    if (mag <= 0) {
      this.sfx.click(900, 0.12);
      this.cooldown = 0.25;
      this.reload();
      return;
    }
    this.ammo.set(id, mag - 1);
    this.cooldown = def.cycle;
    this.kick = 1;
    this.lastShot = now;
    this.fire(id);
  }

  private aimPoint(): THREE.Vector3 {
    this.ray.setFromCamera(new THREE.Vector2(0, 0), this.camera);
    this.ray.far = 90;
    const hit = this.ray.intersectObjects(this.targets, false)[0];
    return hit ? hit.point : this.ray.ray.at(90, new THREE.Vector3());
  }

  private fire(id: WeaponId) {
    const gun = this.heldGun;
    if (!gun) return;
    gun.updateWorldMatrix(true, true);
    const muzzleObj = gun.userData.muzzle as THREE.Object3D | undefined;
    const from = muzzleObj ? muzzleObj.getWorldPosition(new THREE.Vector3()) : gun.getWorldPosition(new THREE.Vector3());
    const dir = this.aimPoint().sub(from);
    if (dir.length() < 1.5) this.camera.getWorldDirection(dir);
    dir.normalize();
    const spread = id === 'awp' ? 0 : 0.004 + (this.aimBlend > 0.5 ? 0 : 0.01) + this.vel.length() * 0.002;
    dir.add(new THREE.Vector3((Math.random() - 0.5) * spread, (Math.random() - 0.5) * spread, (Math.random() - 0.5) * spread)).normalize();
    this.ray.set(from, dir);
    this.ray.far = 90;
    const hit = this.ray.intersectObjects(this.targets, false)[0];
    const end = hit ? hit.point : from.clone().addScaledVector(dir, 90);
    this.sfx.shot(id, this.pos);
    this.addTracer(from, end);
    this.addFlash(from, 0.45, 0.06);
    if (hit) {
      this.addFlash(hit.point, 0.22, 0.18);
      const d = hit.object.userData.dummy as Dummy | undefined;
      if (d) {
        this.hitDummy(d, dir, 1.6);
        this.hits++;
        this.sfx.hit(hit.point.y > 1.55, false);
      }
    }
    // a bullet through the ball sets it rolling
    const toBall = this.ball.pos.clone().sub(from);
    const along = toBall.dot(dir);
    if (along > 0 && along < from.distanceTo(end) && toBall.addScaledVector(dir, -along).length() < this.ball.r) this.ball.vel.addScaledVector(dir, 6);
  }

  private meleeHit() {
    const f = new THREE.Vector3(Math.sin(this.headingVis), 0, Math.cos(this.headingVis));
    for (const d of this.dummies) {
      const to = d.group.position.clone().sub(this.pos).setY(0);
      if (to.length() < 2.0 && to.normalize().dot(f) > 0.4) {
        this.hitDummy(d, f, 2.2);
        this.hits++;
        this.sfx.knife(true, this.pos);
      }
    }
    const tb = this.ball.pos.clone().sub(this.pos).setY(0);
    if (tb.length() < 1.8 && tb.normalize().dot(f) > 0.3) {
      this.ball.vel.addScaledVector(f, 5);
      this.ball.vel.y += 2;
    }
  }

  private hitDummy(d: Dummy, dir: THREE.Vector3, power: number) {
    d.axis.set(dir.z, 0, -dir.x).normalize();
    d.tiltV += power * 2.2;
    d.flash = 1;
  }

  private throwGrenade() {
    if (this.gunId !== 'he' || !this.heldGun) return;
    const from = this.model.group.localToWorld(this.model.gameWeaponGrip(new THREE.Vector3()));
    const dir = this.aimPoint().sub(from).normalize();
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 10), this.mat(0x3d4a2f, 0.6));
    mesh.castShadow = true;
    this.scene.add(mesh);
    const vel = dir.multiplyScalar(13);
    vel.y += 2.5;
    this.bodies.push({ mesh, pos: from.clone(), vel, r: 0.07, fuse: 2 });
    this.sfx.knife(false, this.pos);
  }

  private explode(at: THREE.Vector3) {
    this.sfx.explosion(at);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0.85, depthWrite: false });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), mat);
    mesh.position.copy(at);
    this.scene.add(mesh);
    this.fx.push({
      obj: mesh,
      life: 0.45,
      max: 0.45,
      update: (u) => {
        mesh.scale.setScalar(0.3 + 3.2 * Math.sqrt(u));
        mat.opacity = 0.85 * (1 - u);
      }
    });
    for (const d of this.dummies) {
      const to = d.group.position.clone().add(new THREE.Vector3(0, 1, 0)).sub(at);
      const dist = to.length();
      if (dist < 6) {
        this.hitDummy(d, to.setY(0).normalize(), 4 * (1 - dist / 6) + 0.8);
        this.hits++;
      }
    }
    const tb = this.ball.pos.clone().sub(at);
    const dist = tb.length();
    if (dist < 6) this.ball.vel.addScaledVector(tb.normalize(), 14 * (1 - dist / 6) + 3);
  }

  private addTracer(a: THREE.Vector3, b: THREE.Vector3) {
    const mat = new THREE.LineBasicMaterial({ color: 0xfff1a0, transparent: true, opacity: 0.9 });
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([a, b]), mat);
    this.scene.add(line);
    this.fx.push({ obj: line, life: 0.07, max: 0.07, update: (u) => (mat.opacity = 0.9 * (1 - u)) });
  }

  private addFlash(at: THREE.Vector3, size: number, life: number) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.flashTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    sp.position.copy(at);
    sp.scale.setScalar(size);
    this.scene.add(sp);
    this.fx.push({ obj: sp, life, max: life, update: (u) => (sp.material.opacity = 1 - u) });
  }

  /* ───────────────────────── frame ───────────────────────── */

  private loop = (now: number) => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const real = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.step(real * this.slow, real);
    this.renderer.render(this.scene, this.camera);
  };

  private inputDir(): THREE.Vector2 {
    const k = this.keys;
    const fwd = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
    const right = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    const sy = Math.sin(this.camYaw);
    const cy = Math.cos(this.camYaw);
    return new THREE.Vector2(fwd * sy - right * cy, fwd * cy + right * sy);
  }

  private toast(t: string) {
    this.toastText = t;
    this.toastT = 2.2;
  }

  private step(dt: number, real: number) {
    const now = performance.now() / 1000;
    const ready = this.model.ready;
    if (ready && !this.scaleSet) {
      this.scale = this.model.getAnchors().height / 1.72;
      this.scaleSet = true;
    }
    this.landT = Math.max(0, this.landT - dt * 4);
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.kick = Math.max(0, this.kick - dt * 7);
    this.toastT = Math.max(0, this.toastT - real);
    const skilling = now < this.skillUntil;
    const aiming = this.mouse[2] && !!this.gunId && WEAPONS[this.gunId].slot <= 2 && this.canAttack();
    this.aimBlend += ((aiming ? 1 : 0) - this.aimBlend) * Math.min(1, dt * 12);

    if (this.reloadLeft > 0) {
      this.reloadLeft -= dt;
      if (this.reloadLeft <= 0 && this.gunId) this.ammo.set(this.gunId, WEAPONS[this.gunId].magazine);
    }

    const dir = this.inputDir();
    const wants = dir.lengthSq() > 0.01;
    if (wants && this.heldPose) this.heldPose = null;
    if (wants && !skilling && this.seat) this.standUp(false);
    if (this.wantJump) {
      this.wantJump = false;
      if (!skilling) this.jump();
    }
    if (this.gunId && ((this.mouse[0] && this.dragged <= 6 && (WEAPONS[this.gunId].auto || this.dragged === 0)) || this.clickAttack)) this.attack(now);
    this.clickAttack = false;

    let hSpeed = 0;
    if (this.move) this.stepMove(this.move, dt);
    else if (!this.seat && ready) {
      const running = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
      let top = movementSpeed(this.gameSettings, this.stance, running);
      if (this.carrying) top = Math.min(top, 2.2);
      if (aiming || (this.gunId && now < this.combatUntil)) top = Math.min(top, 3.2);
      if (skilling || this.heldPose) top = 0;
      const want = wants ? dir.clone().normalize().multiplyScalar(top * this.scale) : new THREE.Vector2();
      const k = Math.min(1, dt * 10);
      this.vel.x += (want.x - this.vel.x) * k;
      this.vel.z += (want.y - this.vel.z) * k;
      this.pos.x += this.vel.x * dt;
      this.pos.z += this.vel.z * dt;
      this.resolve();
      hSpeed = Math.hypot(this.vel.x, this.vel.z);
      // face the way we go, or where the camera looks while aiming / fighting
      if (this.gunId && (aiming || now < this.combatUntil || this.mouse[2])) this.heading = this.camYaw;
      else if (hSpeed > 0.3) this.heading = Math.atan2(this.vel.x, this.vel.z);
      else if (skilling) this.heading = this.camYaw;
      this.stepVertical(dt, hSpeed);
    } else this.vel.set(0, 0, 0);

    // smooth height on steps
    const dy = this.pos.y - this.visY;
    this.visY = Math.abs(dy) > 0.55 || !this.onGround || this.move ? this.pos.y : this.visY + dy * Math.min(1, dt * 18);
    this.headingVis += angleDiff(this.headingVis, this.heading) * Math.min(1, dt * 14);
    this.crouchBlend += ((this.stance === 'crouch' ? 1 : 0) - this.crouchBlend) * Math.min(1, dt * 12);

    this.updateWorld(dt);
    if (ready) this.poseCharacter(real, dt, hSpeed, aiming, now);
    this.updateCamera(real);
    this.updateFx(real);
    this.updateHint();
    this.emitT -= real;
    if (this.emitT <= 0) {
      this.emitT = 0.1;
      this.emit();
    }
  }

  private stepVertical(dt: number, hSpeed: number) {
    const g = this.groundAt(this.pos.x, this.pos.z, this.pos.y);
    if (!this.onGround || this.vy > 0 || this.pos.y > g + 0.005) {
      this.vy -= this.gameSettings.gravity * dt;
      this.pos.y += this.vy * dt;
      if (this.vy < 0 && this.pos.y <= g) {
        this.pos.y = g;
        if (this.vy < -4) {
          this.sfx.land(this.pos);
          this.landT = 1;
        }
        this.vy = 0;
        this.onGround = true;
      } else this.onGround = false;
    } else {
      this.pos.y = g;
      this.onGround = true;
    }
    if (this.onGround && hSpeed > 0.8 && this.stance !== 'prone') {
      this.footT -= dt * hSpeed;
      if (this.footT <= 0) {
        this.sfx.footstep(this.pos, 0.6);
        this.footT = 1.5;
      }
    }
  }

  private stepMove(m: Move, dt: number) {
    m.t += dt;
    const u = Math.min(1, m.t / m.dur);
    if (m.kind === 'vault') {
      const e = ease(u);
      this.pos.set(THREE.MathUtils.lerp(m.from.x, m.to.x, e), THREE.MathUtils.lerp(m.from.y, m.to.y, e) + m.clearance * Math.sin(Math.PI * u), THREE.MathUtils.lerp(m.from.z, m.to.z, e));
    } else if (m.kind === 'climb') {
      if (u < 0.12) {
        const e = ease(u / 0.12);
        this.pos.set(THREE.MathUtils.lerp(m.from.x, m.wall.x, e), m.from.y, THREE.MathUtils.lerp(m.from.z, m.wall.z, e));
      } else {
        // the body hangs from the hands: they stay on the top edge (a little past it) whatever the arms are doing, and the body
        // moves with them; the pull-up and the mantle come from the arm pose alone
        const h = this.handRel;
        // while pressing on top the hands move a little way onto the surface, under the chest
        const onTop = ease(Math.min(1, Math.max(0, (u - 0.6) / 0.25)));
        const reachOn = 0.08 + 0.17 * onTop;
        let cx = m.edge.x + m.f.x * reachOn - h.x;
        let cz = m.edge.z + m.f.y * reachOn - h.z;
        const cy = m.edge.y + 0.02 - h.y;
        // before that the chest stays in front of the wall
        const along = (cx - m.edge.x) * m.f.x + (cz - m.edge.z) * m.f.y;
        const limit = -0.12 * this.scale + 0.4 * onTop;
        if (along > limit) {
          cx -= m.f.x * (along - limit);
          cz -= m.f.y * (along - limit);
        }
        // the very end: let go and stand up on top
        const e = u >= 0.88 ? ease((u - 0.88) / 0.12) : 0;
        const bx = THREE.MathUtils.lerp(cx, m.to.x, e);
        const by = THREE.MathUtils.lerp(cy, m.to.y, e);
        const bz = THREE.MathUtils.lerp(cz, m.to.z, e);
        const w = ease(Math.min(1, (u - 0.12) / 0.12));
        this.pos.set(THREE.MathUtils.lerp(m.wall.x, bx, w), THREE.MathUtils.lerp(m.from.y, by, w), THREE.MathUtils.lerp(m.wall.z, bz, w));
      }
    } else {
      this.vel.set(m.dir.x * 4.4 * this.scale, 0, m.dir.y * 4.4 * this.scale);
      this.pos.x += this.vel.x * dt;
      this.pos.z += this.vel.z * dt;
      this.resolve('crouch');
      this.pos.y = this.groundAt(this.pos.x, this.pos.z, this.pos.y);
    }
    if (u >= 1) {
      if (m.kind === 'roll') {
        this.stance = this.headroom('stand') ? 'stand' : 'crouch';
        this.vel.multiplyScalar(0.3);
      } else {
        this.pos.copy(m.to);
        this.onGround = true;
        this.vy = 0;
        this.vel.set(0, 0, 0);
        if (m.kind === 'climb') this.sfx.land(this.pos);
      }
      this.move = null;
    }
  }

  private updateWorld(dt: number) {
    for (const d of this.doors) {
      d.open += Math.sign(d.want - d.open) * Math.min(Math.abs(d.want - d.open), dt * 1.4);
      d.solid.mesh.position.y = d.solid.min.y + (d.solid.max.y - d.solid.min.y) / 2 + d.open * 2.2;
      d.solid.active = d.open < 0.35;
    }
    // a carried crate follows the hands
    if (this.carrying) {
      const c = this.carrying;
      const cx = this.pos.x + Math.sin(this.headingVis) * 0.6 * this.scale;
      const cz = this.pos.z + Math.cos(this.headingVis) * 0.6 * this.scale;
      c.mesh.position.set(cx, this.visY + 0.82 * this.scale, cz);
      c.mesh.rotation.y = this.headingVis;
    }
    for (const p of this.props) p.update(dt);
    for (const b of [...this.bodies]) this.stepBody(b, dt);
    // the ball is kicked by the player
    if (!this.seat && this.stance !== 'prone' && this.stance !== 'lie' && !this.move) {
      const dx = this.ball.pos.x - this.pos.x;
      const dz = this.ball.pos.z - this.pos.z;
      const d = Math.hypot(dx, dz) || 1;
      if (d < this.ball.r + this.radius + 0.05 && this.ball.pos.y < this.pos.y + 0.9) {
        const sp = Math.max(Math.hypot(this.vel.x, this.vel.z), 1.2);
        this.ball.vel.set((dx / d) * sp * 1.5, 1.2 + sp * 0.2, (dz / d) * sp * 1.5);
        this.sfx.bounce(this.ball.pos);
        const push = this.ball.r + this.radius + 0.06 - d;
        this.ball.pos.x += (dx / d) * push;
        this.ball.pos.z += (dz / d) * push;
      }
    }
    // dummies spring back upright
    for (const d of this.dummies) {
      d.tiltV += (-90 * d.tilt - 5 * d.tiltV) * dt;
      d.tilt = THREE.MathUtils.clamp(d.tilt + d.tiltV * dt, -0.9, 0.9);
      d.group.quaternion.setFromAxisAngle(d.axis, d.tilt * 0.5);
      d.flash = Math.max(0, d.flash - dt * 4);
      for (const m of d.mats) m.emissive.setRGB(d.flash * 0.9, d.flash * 0.1, 0);
    }
    if (this.debugOn) this.updateDebug();
  }

  private updateDebug() {
    if (!this.debugCyl) {
      this.debugCyl = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 20, 1, true), new THREE.MeshBasicMaterial({ color: 0x44ff88, wireframe: true, transparent: true, opacity: 0.8 }));
      this.debugGroup.add(this.debugCyl);
    }
    const h = HEIGHT[this.stance] * this.scale;
    const r = this.radius;
    this.debugCyl.scale.set(r, h, r);
    this.debugCyl.position.set(this.pos.x, this.pos.y + h / 2, this.pos.z);
    this.debugCyl.visible = this.stance !== 'prone' && this.stance !== 'lie';
  }

  private stepBody(b: Body, dt: number) {
    b.vel.y -= this.gameSettings.gravity * 0.7 * dt;
    b.pos.addScaledVector(b.vel, dt);
    // floor or the top of a box under it
    let floor = 0;
    for (const s of this.solids) {
      if (!s.active || s.carried) continue;
      if (b.pos.x > s.min.x && b.pos.x < s.max.x && b.pos.z > s.min.z && b.pos.z < s.max.z && s.max.y <= b.pos.y - b.r + 0.3) floor = Math.max(floor, s.max.y);
    }
    if (b.pos.y - b.r < floor) {
      b.pos.y = floor + b.r;
      if (b.vel.y < -1.2) this.sfx.bounce(b.pos);
      b.vel.y = b.vel.y < -1 ? -b.vel.y * 0.5 : 0;
      b.vel.x *= 1 - Math.min(1, dt * 1.2);
      b.vel.z *= 1 - Math.min(1, dt * 1.2);
    }
    // walls and boxes
    for (const s of this.solids) {
      if (!s.active || s.carried || s.max.y < b.pos.y - b.r + 0.05) continue;
      const px = Math.max(s.min.x, Math.min(s.max.x, b.pos.x));
      const py = Math.max(s.min.y, Math.min(s.max.y, b.pos.y));
      const pz = Math.max(s.min.z, Math.min(s.max.z, b.pos.z));
      const v = new THREE.Vector3(b.pos.x - px, b.pos.y - py, b.pos.z - pz);
      const d = v.length();
      if (d < b.r && d > 1e-5) {
        v.divideScalar(d);
        b.pos.addScaledVector(v, b.r - d);
        const vn = b.vel.dot(v);
        if (vn < 0) {
          b.vel.addScaledVector(v, -1.55 * vn);
          if (vn < -1.5) this.sfx.bounce(b.pos);
        }
      }
    }
    b.mesh.position.copy(b.pos);
    if (b === this.ball) b.mesh.rotation.x += (b.vel.z * dt) / b.r;
    if (b.fuse !== undefined) {
      b.fuse -= dt;
      if (b.fuse <= 0) {
        this.explode(b.pos);
        this.bodies.splice(this.bodies.indexOf(b), 1);
        this.scene.remove(b.mesh);
        disposeTree(b.mesh);
      }
    }
  }

  /* ───────────────────────── character ───────────────────────── */

  private poseCharacter(real: number, dt: number, hSpeed: number, aiming: boolean, now: number) {
    const s = this.scale;
    const m = this.move;
    const gp: GamePose = { speed: hSpeed / s, armed: false, crouch: Math.max(this.crouchBlend, 0.55 * this.landT), pitch: 0, airborne: !this.onGround && !m, vy: this.vy, keepWeapons: this.weapon === 'class' };
    const gun = this.gunId;
    const def = gun ? WEAPONS[gun] : null;
    const handsFree = !m && !this.seat && (this.stance === 'stand' || this.stance === 'crouch') && !this.carrying;
    const showGun = !!gun && !!def && handsFree && !this.heldPose;
    if (showGun && gun && def) {
      const gunLike = def.slot <= 2;
      gp.hold = holdOf(gun);
      gp.armed = gunLike;
      gp.aim = this.aimBlend;
      gp.kick = this.kick;
      gp.pitch = gunLike ? THREE.MathUtils.clamp(-this.camPitch, -1, 1) : 0;
      if (gp.hold === 'grenade' && now - this.throwAt < 0.6) gp.hold = 'knife';
      const slash = (now - this.swingAt) / 0.4;
      if (gun === 'knife' && slash >= 0 && slash < 1) gp.swing = slash;
      if (this.reloadLeft > 0 && def.reload > 0) gp.reload = 1 - this.reloadLeft / def.reload;
      // run with the weapon lowered, and keep it down when a wall is close in front
      const wall = this.wallAhead(1.15);
      this.lowered += ((wall ? 1 : THREE.MathUtils.clamp((hSpeed - 3.6) / 1.6, 0, 1)) - this.lowered) * Math.min(1, dt * 10);
      gp.lowered = this.cooldown > 0.05 && !wall ? 0 : this.lowered;
    }
    if (this.stance === 'lie') gp.stance = 'lie';
    else if (this.stance === 'sit') {
      gp.stance = 'sit';
      gp.chair = !!this.seat;
      gp.drop = this.seat ? Math.max(0.05, 0.9 * s - 0.5) : 0;
    } else if (this.stance === 'prone') {
      gp.stance = 'prone';
      gp.crawl = hSpeed / s;
      this.crawlPhase += (hSpeed / s) * dt * 7;
      gp.phase = this.crawlPhase;
    } else if (m) {
      gp.stance = m.kind;
      gp.phase = Math.min(1, m.t / m.dur);
    } else if (this.carrying) gp.stance = 'carry';

    // a Mixamo clip (when one fits) poses the body; the ones that lie down or roll over do their own turning
    const mix = this.heldPose ? { pose: null, flat: false } : this.mixamoPose(dt, hSpeed / s, now);

    // tilt of the whole body (lying / crawling / rolling)
    let target = 0;
    if (mix.flat) target = 0;
    else if (this.stance === 'prone') target = Math.PI / 2;
    else if (this.stance === 'lie') target = -Math.PI / 2;
    const rolling = m?.kind === 'roll' && !mix.flat;
    if (m && rolling) this.tilt = 2 * Math.PI * ease(Math.min(1, m.t / m.dur));
    else {
      if (this.tilt > Math.PI * 1.5) this.tilt -= Math.PI * 2;
      this.tilt += (target - this.tilt) * Math.min(1, dt * 9);
    }
    const pivot = rolling ? 0.6 * s : 0;
    const sn = rolling ? 0 : Math.sin(this.tilt);
    // the avatar poses its bones in the world frame: pose it untransformed, then move and turn the whole body
    this.root.position.set(0, 0, 0);
    this.root.rotation.set(0, 0, 0);
    this.tiltG.position.set(0, 0, 0);
    this.tiltG.rotation.set(0, 0, 0);
    this.model.group.position.set(0, 0, 0);
    this.model.group.updateMatrixWorld(true);

    this.model.setRetarget(mix.pose);
    if (this.heldPose && !m && !this.seat && this.stance === 'stand') {
      this.model.animateStage(real);
      if (this.heldGun) this.heldGun.visible = false;
    } else {
      if (!this.heldPose && this.state.pose !== 'idle') {
        this.state = { ...this.state, pose: 'idle' };
        this.model.updateState(this.state);
      }
      this.model.animateGame(real, gp);
      this.updateGun(showGun ? gun : null, gp, now, aiming);
    }
    this.root.position.set(this.pos.x, this.visY + this.groundOff, this.pos.z);
    this.root.rotation.y = this.headingVis;
    this.tiltG.position.set(0, pivot, -0.88 * s * sn);
    this.tiltG.rotation.x = this.tilt;
    this.model.group.position.set(0, -this.model.getAnchors().feetY - pivot, 0);
    this.root.updateMatrixWorld(true);
    this.model.handsWorld(this.handRel).sub(this.root.position);
    // keep the lowest point of the body (a foot, a hip, the back when lying) on the floor whatever the pose; in the air or while
    // vaulting, climbing and rolling the body is free
    const low = !m && this.onGround ? this.model.lowestWorldY() : null;
    if (low !== null) this.groundOff += (this.visY - low) * Math.min(1, dt * 30);
    else this.groundOff *= Math.max(0, 1 - dt * 8);
    this.root.position.y = this.visY + this.groundOff;
    this.root.updateMatrixWorld(true);
  }

  private wallAhead(dist: number) {
    const f = new THREE.Vector3(Math.sin(this.headingVis), 0, Math.cos(this.headingVis));
    this.ray.set(new THREE.Vector3(this.pos.x, this.pos.y + 1.2 * this.scale, this.pos.z), f);
    this.ray.far = dist;
    return this.ray.intersectObjects(this.targets, false).some((h) => !h.object.userData.dummy && !!h.face && Math.abs(h.face.normal.y) < 0.5);
  }

  private updateGun(id: WeaponId | null, gp: GamePose, now: number, aiming: boolean) {
    if (id !== this.heldGunId) {
      if (this.heldGun) {
        this.heldGun.removeFromParent();
        disposeTree(this.heldGun);
      }
      this.heldGun = id ? gunMesh(id) : null;
      if (this.heldGun) this.model.group.add(this.heldGun);
      this.heldGunId = id;
    }
    const g = this.heldGun;
    if (!g) return;
    g.visible = !!id;
    if (!id) return;
    const holdsGun = !!gp.armed;
    g.position.copy(this.model.gameWeaponGrip(new THREE.Vector3())).add(new THREE.Vector3(0, 0.02, 0.06));
    g.rotation.set(holdsGun ? this.camPitch * (aiming || now < this.combatUntil ? 1 : 0.6) : 0.6, 0, 0);
    if (holdsGun && (gp.reload ?? -1) >= 0) {
      const bell = Math.sin(Math.PI * (gp.reload ?? 0));
      g.rotation.x += 0.35 * bell;
      g.rotation.z += 0.3 * bell;
    }
    if (holdsGun && this.kick > 0) {
      g.position.z -= 0.05 * this.kick;
      g.rotation.x -= 0.1 * this.kick;
    }
    // the arm does the cutting (see GamePose.swing); the blade only turns with it
    const kp = (now - this.swingAt) / 0.4;
    if (id === 'knife' && kp >= 0 && kp < 1) {
      const sl = knifeSlashPose(kp);
      g.rotation.x += sl.rx;
      g.rotation.y += sl.ry;
      g.rotation.z += sl.rz;
    }
  }

  /* ───────────────────────── camera, fx, hud ───────────────────────── */

  private updateCamera(real: number) {
    const s = this.scale;
    const lying = this.stance === 'prone' || this.stance === 'lie';
    const eye = (lying ? 0.5 : this.stance === 'sit' || this.stance === 'crouch' ? 1.0 : 1.45) * s;
    const shoulder = (this.gunId ? 0.45 + 0.25 * this.aimBlend : 0) * s;
    const dist = this.camDist * (1 - 0.35 * this.aimBlend);
    const right = new THREE.Vector3(-Math.cos(this.camYaw), 0, Math.sin(this.camYaw));
    const target = new THREE.Vector3(this.pos.x, this.visY + eye, this.pos.z).addScaledVector(right, shoulder);
    const cp = Math.cos(this.camPitch);
    const back = new THREE.Vector3(-Math.sin(this.camYaw) * cp, Math.sin(this.camPitch), -Math.cos(this.camYaw) * cp);
    // do not let walls get between the character and the camera
    this.ray.set(target, back);
    this.ray.far = dist;
    const hit = this.ray.intersectObjects(this.targets, false).find((h) => !h.object.userData.dummy);
    const pos = target.clone().addScaledVector(back, hit ? Math.max(0.6, hit.distance - 0.25) : dist);
    pos.y = Math.max(0.25, pos.y);
    this.camPos.lerp(pos, 1 - Math.exp(-real * 25));
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(target);
    this.sfx.listener = { x: this.pos.x, y: this.pos.y, z: this.pos.z, yaw: this.camYaw };
  }

  private updateFx(real: number) {
    for (const f of [...this.fx]) {
      f.life -= real;
      f.update?.(1 - Math.max(0, f.life) / f.max);
      if (f.life <= 0) {
        this.scene.remove(f.obj);
        const m = f.obj as THREE.Mesh;
        m.geometry?.dispose();
        (m.material as THREE.Material | undefined)?.dispose();
        this.fx.splice(this.fx.indexOf(f), 1);
      }
    }
  }

  private updateHint() {
    const t = this.interactTarget();
    let h = t ? t.label : '';
    if (!h && !this.move && (this.stance === 'stand' || this.stance === 'crouch') && !this.seat && !this.carrying) {
      const o = this.findObstacle();
      if (o) h = o.rel <= 1.35 * this.scale ? 'Space / V · Vượt chướng ngại' : 'Space / V · Leo lên';
    }
    this.hint = h;
  }

  private emit() {
    const id = this.gunId;
    const def = id ? WEAPONS[id] : null;
    const sp = Math.hypot(this.vel.x, this.vel.z);
    const action = this.move
      ? { vault: 'Vượt chướng ngại', climb: 'Leo tường', roll: 'Lăn' }[this.move.kind]
      : !this.onGround
        ? 'Nhảy'
        : this.skillUntil > performance.now() / 1000
          ? 'Chiêu thức'
          : this.heldPose
            ? 'Giữ dáng'
            : this.carrying
              ? 'Bê thùng'
              : sp > 3.6
                ? 'Chạy'
                : sp > 0.4
                  ? this.stance === 'prone'
                    ? 'Bò'
                    : 'Đi'
                  : 'Đứng yên';
    this.onState({
      loaded: this.model.ready,
      weapon: this.weapon,
      mag: id ? this.ammo.get(id) ?? 0 : 0,
      magMax: def && def.slot <= 2 ? def.magazine : 0,
      reloading: this.reloadLeft > 0,
      stance: STANCE_NAME[this.stance],
      action,
      speed: sp,
      hint: this.toastT > 0 ? this.toastText : this.hint,
      toast: this.toastT > 0 ? this.toastText : '',
      aiming: this.aimBlend > 0.5,
      pose: this.heldPose,
      slow: this.slow,
      debug: this.debugOn,
      hits: this.hits,
      carrying: !!this.carrying,
      gun: !!def && def.slot <= 2,
      props: this.props.map((p) => p.info()),
      mixamo: this.mixamo.map((x) => ({ id: x.id, label: x.label, role: x.role, ctx: x.ctx, file: x.file, use: x.role ? ROLE_LABEL[x.role] + (x.ctx ? ` · ${CTX_LABEL[x.ctx]}` : '') : null, ready: !!x.src, playing: x.id === this.mixamoActive })),
      mixamoOn: this.mixamoOn,
      mixamoManual: this.mixamoManual,
      animationSettings: { ...this.animationSettings }
    });
  }
}

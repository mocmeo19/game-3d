import * as THREE from 'three';
import { Team, WeaponId, WEAPONS } from './rules';
import { attachGunModel } from './weapons/gunModelLibrary';
import { ViewArms, type ViewHands } from './viewArms';

/** Team colours shared by bodies, sleeves, radar and HUD. */
export const TEAM_COLOR: Record<Team, number> = { CT: 0x5d8fd8, T: 0xd8a24a };
/** How far the hips / head drop when fully crouched. */
export const CROUCH_DROP = 0.42;

const std = (color: number, roughness = 0.6, metalness = 0.1) => new THREE.MeshStandardMaterial({ color, roughness, metalness });

/**
 * Low-poly gun built from boxes and cylinders. Barrel points +z, grip hangs -y, origin at the trigger.
 * `userData.muzzle` is an Object3D at the muzzle.
 */
export function gunMesh(id: WeaponId): THREE.Group {
  const g = new THREE.Group();
  // low metalness: there is no environment map, so very metallic surfaces would render black
  const metal = std(0x3a3f45, 0.45, 0.3);
  const dark = std(0x26292d, 0.65, 0.15);
  const wood = std(0x8a4f26, 0.75);
  const green = std(0x4b5a39, 0.7);
  const box = (w: number, h: number, d: number, x: number, y: number, z: number, mat: THREE.Material = metal, rx = 0) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.rotation.x = rx;
    g.add(m);
    return m;
  };
  const tube = (r: number, len: number, x: number, y: number, z: number, mat: THREE.Material = metal) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 10), mat);
    m.rotation.x = Math.PI / 2;
    m.position.set(x, y, z + len / 2);
    g.add(m);
    return m;
  };
  let muzzle = 0.3;
  switch (id) {
    case 'ak47':
      box(0.055, 0.09, 0.42, 0, 0.02, 0.06);
      box(0.06, 0.07, 0.2, 0, 0.0, 0.33, wood);
      tube(0.011, 0.3, 0, 0.035, 0.42);
      box(0.012, 0.04, 0.012, 0, 0.07, 0.66);
      box(0.045, 0.1, 0.3, 0, -0.01, -0.3, wood);
      box(0.04, 0.2, 0.07, 0, -0.12, 0.16, dark, 0.35);
      box(0.035, 0.1, 0.045, 0, -0.08, -0.05, wood, -0.35);
      muzzle = 0.73;
      break;
    case 'm4a4':
      box(0.05, 0.09, 0.4, 0, 0.02, 0.05, dark);
      box(0.065, 0.065, 0.24, 0, 0.02, 0.36, dark);
      tube(0.011, 0.24, 0, 0.03, 0.48);
      box(0.025, 0.03, 0.34, 0, 0.08, 0.12, metal);
      box(0.045, 0.085, 0.26, 0, 0.0, -0.3, dark);
      box(0.038, 0.17, 0.065, 0, -0.11, 0.13, metal, 0.12);
      box(0.035, 0.1, 0.045, 0, -0.08, -0.05, dark, -0.35);
      muzzle = 0.73;
      break;
    case 'awp':
      box(0.065, 0.1, 0.55, 0, 0.0, 0.05, green);
      tube(0.015, 0.5, 0, 0.03, 0.32);
      tube(0.026, 0.3, 0, 0.11, -0.08, dark);
      box(0.06, 0.13, 0.36, 0, -0.03, -0.4, green);
      box(0.045, 0.12, 0.09, 0, -0.1, 0.14, dark);
      box(0.035, 0.1, 0.045, 0, -0.09, -0.12, green, -0.3);
      muzzle = 0.83;
      break;
    case 'ump':
      box(0.055, 0.1, 0.32, 0, 0.02, 0.05, dark);
      tube(0.012, 0.12, 0, 0.03, 0.21);
      box(0.04, 0.16, 0.05, 0, -0.1, 0.1, dark, 0.1);
      box(0.035, 0.1, 0.045, 0, -0.08, -0.06, dark, -0.3);
      box(0.04, 0.07, 0.22, 0, 0.0, -0.25, dark);
      muzzle = 0.36;
      break;
    case 'scar':
      box(0.055, 0.1, 0.42, 0, 0.02, 0.06, std(0xb59a6a, 0.7));
      tube(0.011, 0.24, 0, 0.035, 0.48);
      box(0.025, 0.03, 0.36, 0, 0.085, 0.1, dark);
      box(0.045, 0.09, 0.26, 0, 0.0, -0.3, std(0xb59a6a, 0.7));
      box(0.038, 0.17, 0.06, 0, -0.11, 0.14, dark, 0.15);
      box(0.035, 0.1, 0.045, 0, -0.08, -0.05, dark, -0.35);
      muzzle = 0.73;
      break;
    case 'm249':
      box(0.07, 0.11, 0.5, 0, 0.02, 0.06, dark);
      tube(0.014, 0.36, 0, 0.03, 0.42);
      box(0.09, 0.1, 0.12, 0, -0.08, 0.08, green);
      box(0.05, 0.1, 0.28, 0, 0.0, -0.32, dark);
      box(0.035, 0.1, 0.045, 0, -0.09, -0.06, dark, -0.35);
      muzzle = 0.8;
      break;
    case 'sks':
      box(0.05, 0.08, 0.5, 0, 0.0, 0.05, wood);
      tube(0.011, 0.32, 0, 0.035, 0.32);
      tube(0.022, 0.24, 0, 0.1, -0.06, dark);
      box(0.045, 0.11, 0.32, 0, -0.03, -0.36, wood);
      box(0.03, 0.08, 0.05, 0, -0.07, 0.12, metal);
      muzzle = 0.66;
      break;
    case 'kar98':
      box(0.05, 0.08, 0.6, 0, 0.0, 0.08, wood);
      tube(0.012, 0.36, 0, 0.035, 0.36);
      tube(0.022, 0.26, 0, 0.1, -0.06, dark);
      box(0.012, 0.012, 0.06, 0.04, 0.04, -0.08, metal);
      box(0.045, 0.11, 0.32, 0, -0.03, -0.38, wood);
      muzzle = 0.74;
      break;
    case 's12k':
      box(0.06, 0.11, 0.36, 0, 0.02, 0.05, dark);
      tube(0.018, 0.28, 0, 0.04, 0.23);
      box(0.06, 0.14, 0.08, 0, -0.1, 0.14, dark, 0.1);
      box(0.035, 0.1, 0.045, 0, -0.08, -0.06, dark, -0.35);
      box(0.045, 0.09, 0.24, 0, 0.0, -0.28, dark);
      muzzle = 0.53;
      break;
    case 'mp9':
      box(0.05, 0.085, 0.3, 0, 0.02, 0.04, dark);
      tube(0.012, 0.1, 0, 0.03, 0.19);
      box(0.035, 0.18, 0.05, 0, -0.1, -0.03, dark, -0.15);
      box(0.03, 0.06, 0.03, 0, -0.04, 0.12, dark);
      box(0.015, 0.05, 0.22, 0, 0.0, -0.22, metal);
      muzzle = 0.3;
      break;
    case 'deagle':
      box(0.045, 0.06, 0.26, 0, 0.04, 0.06, std(0x9a9ea3, 0.35, 0.35));
      box(0.035, 0.13, 0.055, 0, -0.05, -0.03, dark, -0.2);
      muzzle = 0.2;
      break;
    case 'usp':
      box(0.035, 0.045, 0.19, 0, 0.035, 0.04, dark);
      tube(0.016, 0.15, 0, 0.035, 0.13, metal);
      box(0.032, 0.12, 0.05, 0, -0.045, -0.03, dark, -0.2);
      muzzle = 0.29;
      break;
    case 'glock':
      box(0.035, 0.045, 0.18, 0, 0.035, 0.04, std(0x2e3134, 0.6, 0.3));
      box(0.032, 0.12, 0.05, 0, -0.045, -0.03, std(0x3a3d33, 0.8), -0.2);
      muzzle = 0.13;
      break;
    case 'knife':
      box(0.024, 0.03, 0.11, 0, 0, -0.02, dark);
      box(0.05, 0.012, 0.012, 0, 0, 0.04, metal);
      box(0.005, 0.034, 0.17, 0, 0.004, 0.13, std(0xc8ced4, 0.25, 0.45));
      muzzle = 0.2;
      break;
    case 'he':
      g.add(new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 10), std(0x48552f, 0.6)));
      box(0.018, 0.03, 0.018, 0, 0.04, 0, metal);
      muzzle = 0.04;
      break;
    case 'flash':
    case 'smoke':
      g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.11, 12), std(id === 'flash' ? 0xb8bcc0 : 0x6c7378, 0.5, 0.4)));
      box(0.018, 0.03, 0.018, 0, 0.065, 0, metal);
      if (id === 'smoke') box(0.058, 0.012, 0.058, 0, 0, 0, std(0x8aa0a8, 0.6));
      muzzle = 0.04;
      break;
  }
  const tip = new THREE.Object3D();
  tip.position.set(0, 0.03, muzzle);
  g.add(tip);
  g.userData.muzzle = tip;
  // where the other hand holds it: the handguard of a long gun, under the grip of a pistol
  const support = new THREE.Object3D();
  const slot = WEAPONS[id].slot;
  if (slot === 1) support.position.set(0, -0.02, muzzle * 0.55);
  else if (slot === 2) support.position.set(0, -0.07, -0.02);
  g.add(support);
  g.userData.support = support;
  g.userData.fitVersion = 0;
  g.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = true;
  });
  // the model chosen in the settings takes over from these boxes as soon as it is loaded
  attachGunModel(g, id);
  return g;
}

export interface BodyPose {
  speed: number;
  /** 0 = standing, 1 = fully crouched */
  crouch: number;
  pitch: number;
  alive: boolean;
  /** Seconds since death. */
  dead: number;
  airborne: boolean;
}

/** How a bot is dressed: a soldier of its team by default, or anyone else (passers-by, police, gangs). */
export interface BodyLook {
  cloth: number;
  /** Jacket or vest over the torso, also the sleeves. */
  top: number;
  skin: number;
  head: 'helmet' | 'balaclava' | 'bare' | 'cap';
  /** Colour of the cap or helmet. */
  headColor?: number;
}

const teamLook = (team: Team): BodyLook => ({
  cloth: team === 'CT' ? 0x3a4f6e : 0x6f5a3c, top: TEAM_COLOR[team], skin: 0xc69a7a, head: team === 'CT' ? 'helmet' : 'balaclava', headColor: 0x2d3a4c,
});

/** Procedural soldier used for bots. Faces +z; the engine rotates the group by yaw + PI. */
export class BotBody {
  readonly group = new THREE.Group();
  private readonly hips = new THREE.Group();
  private readonly torso = new THREE.Group();
  private readonly aim = new THREE.Group();
  private readonly legs: { thigh: THREE.Group; shin: THREE.Group }[] = [];
  private gun: THREE.Group | null = null;
  private gunId: WeaponId | null = null;
  private phase = Math.random() * 10;

  constructor(team: Team, look: BodyLook = teamLook(team)) {
    const cloth = std(look.cloth, 0.85);
    const vest = std(look.top, 0.7);
    const skin = std(look.skin, 0.7);
    const boots = std(0x1d1c1a, 0.8);
    const part = (parent: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.castShadow = true;
      parent.add(m);
      return m;
    };
    this.hips.position.y = 0.92;
    this.group.add(this.hips);
    for (const side of [-1, 1]) {
      const thigh = new THREE.Group();
      thigh.position.set(side * 0.11, 0, 0);
      this.hips.add(thigh);
      part(thigh, new THREE.BoxGeometry(0.15, 0.46, 0.17), cloth, 0, -0.23, 0);
      const shin = new THREE.Group();
      shin.position.y = -0.46;
      thigh.add(shin);
      part(shin, new THREE.BoxGeometry(0.13, 0.42, 0.15), cloth, 0, -0.21, 0);
      part(shin, new THREE.BoxGeometry(0.14, 0.08, 0.24), boots, 0, -0.42, 0.04);
      this.legs.push({ thigh, shin });
    }
    this.hips.add(this.torso);
    part(this.torso, new THREE.BoxGeometry(0.4, 0.3, 0.22), cloth, 0, 0.13, 0);
    part(this.torso, new THREE.BoxGeometry(0.44, 0.34, 0.27), vest, 0, 0.4, 0);
    part(this.torso, new THREE.SphereGeometry(0.13, 14, 10), skin, 0, 0.7, 0.02);
    if (look.head === 'helmet') {
      part(this.torso, new THREE.SphereGeometry(0.145, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), std(look.headColor ?? 0x2d3a4c, 0.5), 0, 0.72, 0.01).scale.y = 0.9;
      part(this.torso, new THREE.BoxGeometry(0.2, 0.05, 0.03), std(0x0f1418, 0.2, 0.6), 0, 0.71, 0.14);
    } else if (look.head === 'balaclava') {
      // balaclava with an eye slit
      part(this.torso, new THREE.SphereGeometry(0.137, 14, 10), std(0x2b2723, 0.9), 0, 0.71, 0.015);
      part(this.torso, new THREE.BoxGeometry(0.17, 0.04, 0.02), skin, 0, 0.71, 0.145);
    } else if (look.head === 'cap') {
      const capColor = std(look.headColor ?? 0x24364f, 0.7);
      part(this.torso, new THREE.SphereGeometry(0.138, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), capColor, 0, 0.73, 0.02);
      part(this.torso, new THREE.BoxGeometry(0.22, 0.02, 0.12), capColor, 0, 0.74, 0.17);
    }
    // arms + gun pivot at the shoulders so the gun follows the aim pitch
    this.aim.position.set(0, 0.5, 0.02);
    this.torso.add(this.aim);
    part(this.aim, new THREE.BoxGeometry(0.09, 0.09, 0.36), vest, 0.17, -0.06, 0.16);
    part(this.aim, new THREE.BoxGeometry(0.08, 0.08, 0.34), vest, -0.12, -0.08, 0.22).rotation.y = 0.45;
  }

  setWeapon(id: WeaponId | null) {
    if (id === this.gunId) return;
    this.gunId = id;
    if (this.gun) {
      this.gun.removeFromParent();
      disposeTree(this.gun);
      this.gun = null;
    }
    if (!id) return;
    this.gun = gunMesh(id);
    this.gun.position.set(0.1, -0.06, 0.36);
    if (WEAPONS[id].slot !== 1) this.gun.position.set(0.04, -0.03, 0.42);
    this.aim.add(this.gun);
  }

  muzzleWorld(out: THREE.Vector3) {
    const tip = this.gun?.userData.muzzle as THREE.Object3D | undefined;
    return (tip ?? this.aim).getWorldPosition(out);
  }

  update(dt: number, p: BodyPose) {
    if (!p.alive) {
      // topple backwards over half a second and stay down
      const t = Math.min(1, p.dead / 0.5);
      const ease = 1 - (1 - t) * (1 - t);
      this.hips.rotation.x = (-Math.PI / 2) * ease;
      this.hips.position.y = 0.92 - 0.74 * ease;
      this.aim.rotation.x = 0.8 * ease;
      return;
    }
    this.hips.rotation.x = 0;
    this.phase += dt * p.speed * 1.9;
    const swing = Math.min(1, p.speed / 4);
    const drop = p.crouch * CROUCH_DROP;
    this.hips.position.y = 0.92 - drop;
    // crouch: thigh forward, shin back, so the feet stay under the body
    const bend = Math.acos(Math.max(-1, Math.min(1, (0.92 - drop) / 0.92)));
    this.legs.forEach((l, i) => {
      const s = Math.sin(this.phase + i * Math.PI);
      l.thigh.rotation.x = -bend * 1.1 + (p.airborne ? -0.5 : s * 0.55 * swing);
      l.shin.rotation.x = bend * 2.2 + (p.airborne ? 0.9 : Math.max(0, -s) * 0.9 * swing);
    });
    this.torso.rotation.x = p.crouch * 0.18;
    this.aim.rotation.x = -p.pitch - p.crouch * 0.18;
  }
}

/* ───────────── first-person view model ───────────── */

export interface ViewPose {
  /** Bob phase (advances with distance walked) and strength 0..1. */
  bobPhase: number;
  bobAmount: number;
  /** Mouse sway (rad). */
  swayX: number;
  swayY: number;
  /** 0..1 kick right after a shot. */
  kick: number;
  /** 0..1 reload progress (0 = not reloading). */
  reload: number;
  /** 0..1 draw progress (1 = ready). */
  deploy: number;
  /** Seconds into an inspect, < 0 when not inspecting. */
  inspect: number;
  /** 0..1 knife / throw swing. */
  swing: number;
  /** True for the right-click forward knife stab. */
  swingHeavy: boolean;
  crouch: number;
  /** 0..1 eased aim-down-sights pose. */
  aim: number;
  /** World-space amount to retract the weapon near a wall. */
  obstruction: number;
}

/** Diagonal knife slash: chamber high on the right, cut down across to the left, then recover. */
export function knifeSlashPose(progress: number) {
  const t = THREE.MathUtils.clamp(progress, 0, 1);
  const keys = [
    { t: 0, x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0 },
    { t: 0.2, x: 0.16, y: 0.22, z: 0.04, rx: -0.18, ry: 0.16, rz: -0.28 },
    { t: 0.62, x: -0.2, y: -0.2, z: -0.16, rx: 0.38, ry: -0.18, rz: 0.38 },
    { t: 1, x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0 }
  ];
  let i = 0;
  while (i < keys.length - 2 && t > keys[i + 1].t) i++;
  const a = keys[i];
  const b = keys[i + 1];
  const u = (t - a.t) / (b.t - a.t);
  const e = u * u * (3 - 2 * u);
  return {
    x: THREE.MathUtils.lerp(a.x, b.x, e), y: THREE.MathUtils.lerp(a.y, b.y, e), z: THREE.MathUtils.lerp(a.z, b.z, e),
    rx: THREE.MathUtils.lerp(a.rx, b.rx, e), ry: THREE.MathUtils.lerp(a.ry, b.ry, e), rz: THREE.MathUtils.lerp(a.rz, b.rz, e)
  };
}

const VIEW_ARMS_HIDDEN_FROM_AIM = 0.05;
const VIEW_MODEL_SCALE: Record<ViewHands, number> = { rifle: 0.62, pistol: 0.7, one: 0.75 };

/** Arms + gun in camera space, drawn in a separate pass so it never clips into walls. */
export class ViewModel {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(58, 1, 0.01, 10);
  private readonly rig = new THREE.Group();
  private holder: THREE.Group | null = null;
  private arms: ViewArms | null = null;
  private id: WeaponId | null = null;
  private readonly flash: THREE.Sprite;
  private flashLeft = 0;

  constructor(private readonly team: Team) {
    this.scene.add(new THREE.HemisphereLight(0xe8f2ff, 0x6b6a60, 3));
    const key = new THREE.DirectionalLight(0xfff0d8, 2.6);
    key.position.set(-1, 2, 1);
    const fill = new THREE.DirectionalLight(0xdfe8ff, 1.2);
    fill.position.set(1, 0.5, 2);
    this.scene.add(key, fill, this.camera);
    this.camera.add(this.rig);
    const tex = radialTexture([
      [0, 'rgba(255,248,220,1)'],
      [0.25, 'rgba(255,200,90,0.9)'],
      [1, 'rgba(255,120,20,0)']
    ]);
    this.flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    this.flash.visible = false;
  }

  setWeapon(id: WeaponId | null) {
    if (id === this.id) return;
    this.id = id;
    this.flash.removeFromParent();
    if (this.holder) {
      this.holder.removeFromParent();
      disposeTree(this.holder);
      this.holder = null;
      this.arms = null;
    }
    if (!id) return;
    const gun = gunMesh(id);
    gun.rotation.y = Math.PI; // barrel away from the camera (-z)
    const slot = WEAPONS[id].slot;
    const hands: ViewHands = slot === 1 ? 'rifle' : slot === 2 ? 'pistol' : 'one';
    // the hands go where the gun's model is held, and follow it when the real model replaces the box model
    const arms = new ViewArms(gun, hands, this.team === 'CT' ? 0x2f4566 : 0x5a4a32);
    arms.update();
    const holder = new THREE.Group();
    holder.add(gun, arms.group);
    // a real-size model held this close would fill the screen: the view model is drawn smaller, about the grip (the hands stay on it)
    holder.scale.setScalar(VIEW_MODEL_SCALE[hands]);
    this.arms = arms;
    (gun.userData.muzzle as THREE.Object3D).add(this.flash);
    this.rig.add(holder);
    this.holder = holder;
  }

  /**
   * When the player's character holds the gun in this view (`muzzle` is that gun's muzzle), this view's own gun and arms are
   * hidden and the muzzle flash moves to the character's gun; null brings them back (until the character has loaded).
   */
  setBodyHolds(muzzle: THREE.Object3D | null) {
    if (this.holder) this.holder.visible = !muzzle;
    const own = (this.holder?.children[0]?.userData.muzzle as THREE.Object3D | undefined) ?? null;
    const anchor = muzzle ?? own;
    if (anchor && this.flash.parent !== anchor) anchor.add(this.flash);
  }

  muzzleFlash() {
    if (!this.id || WEAPONS[this.id].slot > 2) return;
    this.flashLeft = 0.045;
    this.flash.visible = true;
    this.flash.material.rotation = Math.random() * Math.PI;
    this.flash.scale.setScalar((this.id === 'usp' ? 0.06 : 0.14) * (0.8 + Math.random() * 0.4));
  }

  update(dt: number, p: ViewPose, aspect: number) {
    const fov = THREE.MathUtils.lerp(58, 43, p.aim);
    if (this.camera.fov !== fov) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }
    if (this.camera.aspect !== aspect) {
      this.camera.aspect = aspect;
      this.camera.updateProjectionMatrix();
    }
    this.flashLeft -= dt;
    if (this.flashLeft <= 0) this.flash.visible = false;
    const h = this.holder;
    if (!h || !this.id) return;
    if (this.arms) {
      // aiming shows only the gun lined up with the sights; the stand-in box arms are left out
      this.arms.group.visible = p.aim < VIEW_ARMS_HIDDEN_FROM_AIM;
      this.arms.update();
    }
    const slot = WEAPONS[this.id].slot;
    const base = slot === 1 ? [0.17, -0.19, -0.42] : slot === 2 ? [0.15, -0.17, -0.46] : [0.16, -0.18, -0.4];
    const bobX = Math.sin(p.bobPhase) * 0.012 * p.bobAmount;
    const bobY = -Math.abs(Math.cos(p.bobPhase)) * 0.012 * p.bobAmount;
    const down = (1 - p.deploy) * 0.25;
    const reloadDip = Math.sin(Math.min(1, p.reload) * Math.PI);
    h.position.set(THREE.MathUtils.lerp(base[0] + bobX - p.swayX * 0.05, 0.015, p.aim), THREE.MathUtils.lerp(base[1] + bobY - down - reloadDip * 0.08 + p.swayY * 0.05 - p.crouch * 0.01, -0.105, p.aim), THREE.MathUtils.lerp(base[2] + p.kick * 0.045, -0.3, p.aim) + p.obstruction);
    let rx = p.kick * 0.09 - (1 - p.deploy) * 0.9 - reloadDip * 0.5;
    let ry = 0;
    let rz = reloadDip * 0.5;
    if (p.inspect >= 0) {
      const t = Math.min(1, p.inspect / 2.4);
      const s = Math.sin(t * Math.PI);
      ry = s * 1.1;
      rz += Math.sin(t * Math.PI * 2) * 0.5;
      rx += s * 0.2;
    }
    if (p.swing > 0) {
      const s = Math.sin(p.swing * Math.PI);
      if (slot === 3) {
        if (p.swingHeavy) {
          h.position.z -= s * 0.32;
          rx -= s * 0.24;
        } else {
          const slash = knifeSlashPose(p.swing);
          h.position.x += slash.x;
          h.position.y += slash.y;
          h.position.z += slash.z;
          rx += slash.rx;
          ry += slash.ry;
          rz += slash.rz;
        }
      } else if (slot === 4) {
        rx -= s * 1.2;
        h.position.y += s * 0.1;
      }
    }
    h.rotation.set(rx, ry, rz);
  }

  dispose() {
    this.setWeapon(null);
    this.flash.material.map?.dispose();
    this.flash.material.dispose();
  }
}

export function radialTexture(stops: [number, string][], size = 64) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  stops.forEach(([o, col]) => grad.addColorStop(o, col));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Free the geometry and materials under `object`, except loaded weapon models' meshes, which other copies share. */
export function disposeTree(object: THREE.Object3D) {
  object.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.userData.sharedAsset) return;
    m.geometry?.dispose();
    if (m.material) (Array.isArray(m.material) ? m.material : [m.material]).forEach((mat) => mat.dispose());
  });
}

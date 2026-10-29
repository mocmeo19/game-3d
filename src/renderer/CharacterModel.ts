import { StageAnimations } from './character/stageAnimations';
import type { ModelSettings } from '../settings/modelSettings';
import * as THREE from 'three';
import type { RetargetPose } from './character/mixamo';
import { mixamoClipFile } from '../constants/mixamoPoses';
import { CharacterState, ExpressionId } from '../types/character';
import { ASSET_INFO, equipped } from '../constants/equipment';
import { AvatarController } from './character/avatar';
import { buildWeapons } from './character/weapons';
import { weaponStyleOf } from '../constants/weaponStyles';
import { WeaponPropController } from './character/weaponProps';
import { Skill, SkillTrail, sampleSkill, skillsFor } from './character/skills';
import { getMpfbPose } from '../constants/mpfbPoses';
import { FaceKey } from './character/avatar';
import { sound } from '../audio/soundManager';

type Rot = [number, number, number];
type Joint = 'hips' | 'torso' | 'neck' | 'head' | 'shL' | 'shR' | 'elL' | 'elR' | 'wrL' | 'wrR' | 'hpL' | 'hpR' | 'knL' | 'knR' | 'anL' | 'anR';
type PoseTarget = Partial<Record<Joint, Rot>> & { hipsDrop?: number; /** Metres above the floor the lowest point hovers at (otherwise the pose is grounded). */ hover?: number };

/** The plain standing pose: the starting point of the rest stance (and what a game shows when nothing is happening). */
const neutralStance = (t: number): PoseTarget => {
  const breathe = Math.sin(t * 1.6);
  return {
    hips: [0, 0, 0], torso: [breathe * 0.012, 0, 0], head: [-0.02 + breathe * 0.01, 0, 0],
    shL: [0.04, 0, 0.14 + breathe * 0.01], shR: [0.04, 0, -0.14 - breathe * 0.01],
    elL: [-0.14, 0, 0], elR: [-0.14, 0, 0], wrL: [0, 0, 0.05], wrR: [0, 0, -0.05],
    hpL: [0, 0, 0], hpR: [0, 0, 0], hipsDrop: 0
  };
};

const smooth01 = (x: number) => {
  const k = Math.max(0, Math.min(1, x));
  return k * k * (3 - 2 * k);
};

/**
 * Rest stance with a gentle, stylish idle: the weight shifts from one leg to the other (the free leg relaxes, hips and shoulders
 * tilt against each other), the arms sway a little and the head looks around. The wrists stay still: weapons ride on the hands.
 * `amount` 1 is the full performance on the stage, 0 is the plain standing pose.
 */
const restStyle = (t: number, amount: number): PoseTarget => {
  const n = neutralStance(t);
  const breathe = Math.sin(t * 1.6);
  const sway = Math.sin((t / 9) * Math.PI * 2);           // +1: weight on the left leg, -1: on the right
  const freeR = smooth01(sway);                           // right leg relaxed
  const freeL = smooth01(-sway);                          // left leg relaxed
  const look = 0.13 * Math.sin(t * 0.4) + 0.07 * Math.sin(t * 0.93 + 1);

  const style: PoseTarget = {
    hips: [0, 0.06 * sway + 0.03 * Math.sin(t * 0.5), -0.05 * sway],
    torso: [breathe * 0.014 + 0.01, 0.04 * Math.sin(t * 0.35 + 0.8) - 0.03 * sway, 0.035 * sway],
    neck: [0, look * 0.4, -0.015 * sway],
    head: [-0.02 + breathe * 0.01 + 0.02 * Math.sin(t * 0.6), look, 0.03 * Math.sin(t * 0.5 + 2) + 0.02 * sway],
    shL: [0.04 + 0.02 * Math.sin(t * 0.9 + 1), 0, 0.15 + 0.015 * sway + breathe * 0.008],
    shR: [0.04 + 0.02 * Math.sin(t * 0.9 + 3.6), 0, -0.15 + 0.015 * sway - breathe * 0.008],
    elL: [-0.2 - 0.03 * (1 + Math.sin(t * 0.9 + 1)), 0, 0],
    elR: [-0.2 - 0.03 * (1 + Math.sin(t * 0.9 + 3.6)), 0, 0],
    wrL: [0, 0, 0.05],
    wrR: [0, 0, -0.05],
    // legs stay together: the free leg only relaxes forward and bends a little, it does not swing out
    hpL: [-0.1 * freeL, 0, 0.004 + 0.01 * freeL],
    hpR: [-0.1 * freeR, 0, -0.004 - 0.01 * freeR],
    knL: [0.24 * freeL, 0, 0],
    knR: [0.24 * freeR, 0, 0],
    anL: [-0.05 * freeL, 0, 0],
    anR: [-0.05 * freeR, 0, 0],
    hipsDrop: 0.012 * (freeL + freeR)
  };
  const out: PoseTarget = {};
  for (const key of Object.keys(style) as (keyof PoseTarget)[]) {
    if (key === 'hipsDrop') out.hipsDrop = (n.hipsDrop ?? 0) + ((style.hipsDrop ?? 0) - (n.hipsDrop ?? 0)) * amount;
    else if (key !== 'hover') out[key as Joint] = mixRot((n[key as Joint] ?? [0, 0, 0]) as Rot, style[key as Joint] as Rot, amount);
  }
  return out;
};

const mixRot = (a: Rot, b: Rot, k: number): Rot => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];

/** The face of each expression you can hold: channels of the avatar's face (see FaceKey). */
const EXPRESSIONS: Record<Exclude<ExpressionId, 'neutral'>, Partial<Record<FaceKey, number>>> = {
  smile: { smile: 0.85, squint: 0.2 },
  joy: { smile: 1, browUp: 0.3, squint: 0.35, mouthOpen: 0.2 },
  sad: { sad: 0.95 },
  angry: { anger: 0.95, browDown: 0.3 },
  surprise: { surprise: 0.95, browUp: 0.2 },
  pout: { pout: 0.9, browDown: 0.2 },
  sneer: { sneer: 0.9 },
  wink: { blinkL: 1, smile: 0.5, squint: 0.15 }
};

/** What the shooter game tells the body each frame. */
export interface GamePose {
  /** Horizontal speed (m/s): walk / run cycles. */
  speed: number;
  /** Holding a gun (arms forward along the aim). */
  armed: boolean;
  /** 0 = standing, 1 = fully crouched. */
  crouch: number;
  /** View pitch (rad, + = up): the chest, head and arms follow it. */
  pitch: number;
  airborne: boolean;
  /** Keep the class weapons in the hands (melee games) instead of hiding them for a held gun. */
  keepWeapons?: boolean;
  /** How the weapon is held: each kind has its own arms. Without it a gun is held like a pistol. */
  hold?: GunHold;
  /** 0..1: aiming down the sights (arms tighter and higher). */
  aim?: number;
  /** 0..1: running with the weapon lowered to the hip. */
  lowered?: number;
  /** Progress 0..1 of a reload (the free hand goes to the magazine), -1 when not reloading. */
  reload?: number;
  /** A body stance that replaces the gait: sitting, lying, crawling, vaulting, climbing, rolling or carrying a load. */
  stance?: 'sit' | 'lie' | 'prone' | 'vault' | 'climb' | 'roll' | 'carry';
  /** Progress 0..1 of a vault / climb / roll. */
  phase?: number;
  /** Crawl speed (m/s) while prone; the limbs cycle with it. */
  crawl?: number;
  /** How far the hips sink while sitting (m): a chair is about 0.4, the ground about 0.8. */
  drop?: number;
  /** Sitting on a seat (thighs level) rather than on the ground. */
  chair?: boolean;
  /** 0..1: recoil kick of the last shot. */
  kick?: number;
  /** Vertical speed (m/s, + = up) while airborne: the jump goes through take-off, a tuck at the top and the reach for the ground. */
  vy?: number;
  /** Progress 0..1 of a knife slash (the arm and body cut across), unset when not slashing. */
  swing?: number;
}

export type GunHold = 'pistol' | 'smg' | 'rifle' | 'sniper' | 'knife' | 'grenade';

const ease01 = (u: number) => { const x = Math.max(0, Math.min(1, u)); return x * x * (3 - 2 * x); };

/** Whole-body stances of the character test lab. The game rotates the body itself for lying, crawling and rolling. */
const stancePose = (p: PoseTarget, g: GamePose) => {
  const ph = Math.max(0, Math.min(1, g.phase ?? 0));
  const bell = Math.sin(Math.PI * ph);
  const set = (o: PoseTarget) => {
    for (const k of Object.keys(p) as (keyof PoseTarget)[]) delete p[k];
    Object.assign(p, o);
  };
  switch (g.stance) {
    case 'sit': {
      const drop = g.drop ?? 0.4;
      const ground = !g.chair;
      set(ground
        ? { hips: [0, 0, 0], torso: [0.02, 0, 0], head: [0, 0, 0], hpL: [-1.5, 0, 0.12], hpR: [-1.5, 0, -0.12], knL: [0.25, 0, 0], knR: [0.25, 0, 0], anL: [-0.15, 0, 0], anR: [-0.15, 0, 0],
            shL: [0.15, 0, 0.25], elL: [-0.35, 0, 0], shR: [0.15, 0, -0.25], elR: [-0.35, 0, 0], hipsDrop: drop }
        : { hips: [0, 0, 0], torso: [0.04, 0, 0], head: [0, 0, 0], hpL: [-1.5, 0, 0.06], hpR: [-1.5, 0, -0.06], knL: [1.5, 0, 0], knR: [1.5, 0, 0], anL: [-0.05, 0, 0], anR: [-0.05, 0, 0],
            shL: [-0.45, 0, 0.14], elL: [-1.0, 0, 0], shR: [-0.45, 0, -0.14], elR: [-1.0, 0, 0], hipsDrop: drop });
      break;
    }
    case 'lie':
      // lying at attention: arms straight along the sides, legs straight and together
      set({ hips: [0, 0, 0], torso: [0, 0, 0], head: [0, 0, 0], shL: [0, 0, 0.1], elL: [0, 0, 0], shR: [0, 0, -0.1], elR: [0, 0, 0], hpL: [0, 0, 0.02], hpR: [0, 0, -0.02], knL: [0, 0, 0], knR: [0, 0, 0], anL: [0, 0, 0], anR: [0, 0, 0], hipsDrop: 0 });
      break;
    case 'prone': {
      // commando crawl, in the body's own frame (the game lays the body face down): the forearms pull, the opposite knee draws up
      // and pushes, and the cycle follows the distance travelled (`phase` is that phase in radians here)
      const w = g.phase ?? 0;
      const m = Math.min(1, (g.crawl ?? 0) / 0.35);
      const sw = Math.sin(w) * m;
      const eL = m > 0 ? (sw + 1) / 2 : 0.5; // 1 = left arm stretched ahead, 0 = pulled in
      const eR = m > 0 ? (1 - sw) / 2 : 0.5;
      const bendL = m * Math.max(0, 1 - 2 * eL); // the left knee comes up while the right arm reaches (never both at once)
      const bendR = m * Math.max(0, 1 - 2 * eR);
      // arms lie along the floor ahead of the head (a raised arm would hold the chest off the ground); the pulling arm swings out
      const arm = (e: number, side: 1 | -1): [Rot, Rot] => [[-3.0, 0, side * (0.3 + 0.55 * (1 - e))], [-0.1 - 0.35 * (1 - e), 0, 0]];
      const [shL, elL] = arm(eL, 1);
      const [shR, elR] = arm(eR, -1);
      set({
        hips: [0, sw * 0.08, 0], torso: [-0.05, -sw * 0.1, 0], neck: [-0.15, 0, 0], head: [-0.3, 0, 0],
        shL, elL, shR, elR,
        hpL: [-0.6 * bendL, 0, 0.1 + 0.5 * bendL], knL: [0.1 + 1.3 * bendL, 0, 0], hpR: [-0.6 * bendR, 0, -0.1 - 0.5 * bendR], knR: [0.1 + 1.3 * bendR, 0, 0],
        anL: [0.5, 0, 0], anR: [0.5, 0, 0], hipsDrop: 0
      });
      break;
    }
    case 'vault': {
      const clear = Math.sin(Math.PI * Math.min(1, ph * 1.15));
      set({
        hips: [0.25 + 0.3 * bell, 0, -0.3 * bell], torso: [0.1 + 0.55 * bell, 0, 0], head: [-0.25 * bell, 0, 0],
        shL: [-1.35 - 0.45 * bell, 0, 0.25], elL: [-0.3, 0, 0], shR: [-1.35 - 0.45 * bell, 0, -0.25], elR: [-0.3, 0, 0],
        hpL: [-0.15 - 1.15 * clear, 0, 0.35 * bell], knL: [0.2 + 1.2 * clear, 0, 0], hpR: [-0.1 - 0.75 * clear, 0, -0.15], knR: [0.25 + 0.95 * clear, 0, 0],
        anL: [0.2, 0, 0], anR: [0.2, 0, 0], hipsDrop: 0.05
      });
      break;
    }
    case 'climb': {
      // hang from the edge, pull up (elbows bend), then press down on the top and swing over: the game keeps the hands on the edge
      const w = ph * Math.PI * 5;
      const sn = Math.sin(w);
      const pull = ease01((ph - 0.12) / 0.48);
      const mant = ease01((ph - 0.6) / 0.25);
      const shX = -2.5 - 0.2 * pull + mant * 2.0; // overhead, then down beside the hips
      const elX = -0.25 - 0.9 * pull + mant * 1.1;
      const kick = 1 - mant;
      set({
        hips: [0.1 + mant * 0.4, 0, 0], torso: [0.05 + mant * 0.9, 0, 0], head: [-0.35 * (1 - mant), 0, 0],
        shL: [shX, 0, 0.18 + mant * 0.15], elL: [elX, 0, 0], shR: [shX, 0, -0.18 - mant * 0.15], elR: [elX, 0, 0],
        hpL: [-0.7 - Math.max(0, sn) * 0.8 * kick - mant * 0.5, 0, 0.2], knL: [0.9 + Math.max(0, sn) * 0.7 * kick + mant * 0.6, 0, 0],
        hpR: [-0.7 - Math.max(0, -sn) * 0.8 * kick, 0, -0.2], knR: [0.9 + Math.max(0, -sn) * 0.7 * kick, 0, 0],
        hipsDrop: 0.05
      });
      break;
    }
    case 'roll':
      set({
        hips: [0.55, 0, 0], torso: [1.0, 0, 0], head: [0.9, 0, 0], shL: [-1.0, 0, 0.2], elL: [-1.9, 0, 0], shR: [-1.0, 0, -0.2], elR: [-1.9, 0, 0],
        hpL: [-1.9, 0, 0.1], hpR: [-1.9, 0, -0.1], knL: [2.4, 0, 0], knR: [2.4, 0, 0], anL: [-0.4, 0, 0], anR: [-0.4, 0, 0], hipsDrop: 0.1
      });
      break;
    case 'carry': {
      const w = performance.now() / 1000 * Math.PI * 2 * 0.9;
      const sn = Math.sin(w) * Math.min(1, g.speed / 1.5);
      set({
        hips: [0, sn * 0.02, 0], torso: [-0.12, 0, 0], head: [0.05, 0, 0],
        shL: [-1.15, -0.1, 0.12], elL: [-0.65, 0, 0], shR: [-1.15, 0.1, -0.12], elR: [-0.65, 0, 0],
        hpL: [-0.3 * sn, 0, 0.012], knL: [0.1 + Math.max(0, Math.sin(w + 1.3)) * 0.5 * Math.min(1, g.speed), 0, 0],
        hpR: [0.3 * sn, 0, -0.012], knR: [0.1 + Math.max(0, Math.sin(w + 1.3 + Math.PI)) * 0.5 * Math.min(1, g.speed), 0, 0], hipsDrop: 0.02
      });
      break;
    }
  }
};

/** Layer the game state over a gait pose: crouch, jump tuck, aiming arms and an upper body that follows the pitch. */
const applyGamePose = (p: PoseTarget, g: GamePose, stride = 0) => {
  const mix = (a: Rot | undefined, b: Rot, k: number): Rot => {
    const x = a ?? [0, 0, 0];
    return [x[0] + (b[0] - x[0]) * k, x[1] + (b[1] - x[1]) * k, x[2] + (b[2] - x[2]) * k];
  };
  if (g.stance) {
    stancePose(p, g);
    return;
  }
  const c = Math.max(0, Math.min(1, g.crouch));
  if (c > 0) {
    // knees forward and bent, heels down: a squat the hips can sink into
    // moving, the legs take turns: one thigh comes forward and its knee lifts while the other pushes back
    const k = Math.min(1, g.speed / 1.2);
    const sw = Math.sin(stride) * 0.3 * k;
    const liftL = Math.max(0, Math.sin(stride + 1.3)) * 0.35 * k;
    const liftR = Math.max(0, Math.sin(stride + 1.3 + Math.PI)) * 0.35 * k;
    p.hpL = mix(p.hpL, [-1.25 - sw, 0, 0.12], c);
    p.hpR = mix(p.hpR, [-1.25 + sw, 0, -0.12], c);
    p.knL = mix(p.knL, [2.0 - liftL * 0.4 + sw * 0.5, 0, 0], c);
    p.knR = mix(p.knR, [2.0 - liftR * 0.4 - sw * 0.5, 0, 0], c);
    p.anL = mix(p.anL, [-0.7, 0, 0], c);
    p.anR = mix(p.anR, [-0.7, 0, 0], c);
    p.hipsDrop = (p.hipsDrop ?? 0) * (1 - c) + 0.36 * c;
  }
  if (g.airborne && g.vy !== undefined) {
    // take-off (one knee driven up, the other leg trailing, arms swinging up), a tuck at the top, then the legs reach for the ground
    // and the arms open for balance
    const u = Math.max(-1, Math.min(1, g.vy / 6)); // +1 rising, -1 falling
    const up = Math.max(0, u);
    const down = Math.max(0, -u);
    p.hips = mix(p.hips, [0.06 + 0.1 * down, 0, 0], 0.7);
    p.hpL = [u > 0 ? -1.05 + 0.3 * u : -1.05 + 0.7 * -u, 0, 0.06];
    p.hpR = [u > 0 ? -0.9 + 1.2 * u : -0.9 + 0.65 * -u, 0, -0.06];
    p.knL = [u > 0 ? 1.3 - 0.4 * u : 1.3 - 1.1 * -u, 0, 0];
    p.knR = [u > 0 ? 1.2 : 1.2 - 1.0 * -u, 0, 0];
    p.anL = [0.3 * down - 0.2 * up, 0, 0];
    p.anR = [0.3 * down - 0.2 * up, 0, 0];
    if (!g.armed) {
      p.shL = [-0.3 - 1.7 * up - 0.2 * (1 - up - down), 0, 0.3 + 0.9 * down];
      p.shR = [-0.3 - 1.7 * up - 0.2 * (1 - up - down), 0, -0.3 - 0.9 * down];
      p.elL = [-0.35, 0, 0];
      p.elR = [-0.35, 0, 0];
    }
  } else if (g.airborne) {
    // Tuck the legs and pitch the pelvis slightly forward for a compact, believable jump.
    p.hips = mix(p.hips, [0.08, 0, 0], 0.65);
    p.hpL = [-0.78, 0, 0.06];
    p.hpR = [-0.62, 0, -0.06];
    p.knL = [1.12, 0, 0];
    p.knR = [0.98, 0, 0];
    if (!g.armed) {
      p.shL = [-0.3, 0, 0.34];
      p.shR = [-0.42, 0, -0.34];
      p.elL = [-0.48, 0, 0];
      p.elR = [-0.38, 0, 0];
    }
  }
  const pitch = Math.max(-1.1, Math.min(1.1, g.pitch));
  // the chest takes part of the pitch, the head the rest; a crouch leans the body over the knees
  p.torso = [(p.torso?.[0] ?? 0) * 0.3 - pitch * 0.35 + c * 0.25 + (g.airborne ? 0.14 : 0), p.torso?.[1] ?? 0, 0];
  p.neck = [-pitch * 0.15, 0, 0];
  p.head = [-pitch * 0.3, 0, 0];
  if (g.armed || g.hold === 'knife' || g.hold === 'grenade') {
    const lift = -pitch * 0.7;
    // each way of holding a weapon: [right shoulder, right elbow, left shoulder, left elbow] (and a twist of the chest)
    let sR: Rot, eR: Rot, sL: Rot, eL: Rot;
    let twist = 0;
    switch (g.hold ?? 'pistol') {
      case 'smg':
        // stock tucked against the shoulder, support hand forward
        sR = [-1.15 + lift, 0.1, -0.2]; eR = [-0.85, 0, 0]; sL = [-1.3 + lift, -0.4, 0.2]; eL = [-0.45, 0, 0];
        break;
      case 'rifle':
        sR = [-1.05 + lift, 0.05, -0.28]; eR = [-1.0, 0, 0]; sL = [-1.4 + lift, -0.5, 0.25]; eL = [-0.3, 0, 0];
        twist = 0.08;
        break;
      case 'sniper':
        // the chest turned a little, cheek down on the stock, the other arm well out under the barrel
        sR = [-1.1 + lift, 0.05, -0.3]; eR = [-1.05, 0, 0]; sL = [-1.5 + lift, -0.55, 0.25]; eL = [-0.25, 0, 0];
        twist = 0.18;
        break;
      case 'knife':
        sR = [-0.95, 0.1, -0.25]; eR = [-1.15, 0, 0]; sL = [-0.2, 0, 0.25]; eL = [-0.4, 0, 0];
        break;
      case 'grenade':
        // the throwing arm cocked by the ear
        sR = [-1.9, 0.1, -0.3]; eR = [-1.3, 0, 0]; sL = [-0.3, 0, 0.25]; eL = [-0.4, 0, 0];
        break;
      default:
        // pistol: both hands on the grip, arms straight out along the aim
        sR = [-1.42 + lift, 0.12, -0.1]; eR = [-0.12, 0, 0]; sL = [-1.38 + lift, -0.4, 0.12]; eL = [-0.55, 0, 0];
    }
    const sw = g.swing;
    if (g.hold === 'knife' && sw !== undefined && sw >= 0 && sw <= 1) {
      // cut: draw the arm back and up on the right, slash down across the body to the left, then recover
      const keys: { t: number; sR: Rot; eR: Rot; sL: Rot; twist: number }[] = [
        { t: 0, sR, eR, sL, twist },
        { t: 0.25, sR: [-1.75, -0.6, -0.95], eR: [-0.9, 0, 0], sL: [-0.45, 0.1, 0.55], twist: -0.55 },
        { t: 0.6, sR: [-1.35, 1.0, -0.2], eR: [-0.3, 0, 0], sL: [-0.15, -0.3, 0.8], twist: 0.7 },
        { t: 1, sR, eR, sL, twist }
      ];
      let i = 0;
      while (i < keys.length - 2 && sw > keys[i + 1].t) i++;
      const a = keys[i];
      const b = keys[i + 1];
      const e = Math.max(0, Math.min(1, (sw - a.t) / (b.t - a.t)));
      const k = e * e * (3 - 2 * e);
      sR = mix(a.sR, b.sR, k) as Rot;
      eR = mix(a.eR, b.eR, k) as Rot;
      sL = mix(a.sL, b.sL, k) as Rot;
      twist = a.twist + (b.twist - a.twist) * k;
      p.hips = [0.1 * Math.sin(Math.PI * sw), twist * 0.5, 0];
    }
    const kick = Math.max(0, Math.min(1, g.kick ?? 0));
    if (kick > 0) {
      sR = [sR[0] + 0.14 * kick, sR[1], sR[2]]; eR = [eR[0] - 0.22 * kick, 0, 0];
      sL = [sL[0] + 0.1 * kick, sL[1], sL[2]];
      twist -= 0.06 * kick;
    }
    const aim = Math.max(0, Math.min(1, g.aim ?? 0));
    if (aim > 0) {
      // aiming: the weapon comes up to the face, elbows tuck in
      sR = [sR[0] - 0.12 * aim, sR[1], sR[2]]; eR = [eR[0] - 0.2 * aim, 0, 0];
      sL = [sL[0] - 0.08 * aim, sL[1] - 0.1 * aim, sL[2]]; eL = [eL[0] - 0.1 * aim, 0, 0];
    }
    const low = Math.max(0, Math.min(1, g.lowered ?? 0)) * (1 - aim);
    if (low > 0 && (g.hold === 'pistol' || g.hold === 'smg' || g.hold === 'rifle' || g.hold === 'sniper' || !g.hold)) {
      // running: the weapon held at the hip, barrel forward
      sR = mix(sR, [-0.55, 0.15, -0.2], low) as Rot; eR = mix(eR, [-1.1, 0, 0], low) as Rot;
      sL = mix(sL, [-0.6, -0.3, 0.2], low) as Rot; eL = mix(eL, [-1.0, 0, 0], low) as Rot;
    }
    const rel = g.reload ?? -1;
    if (rel >= 0 && rel <= 1) {
      // reload: the free hand drops to the magazine and back
      const bell = Math.sin(Math.PI * rel);
      sL = mix(sL, [-0.55, -0.2, 0.38], bell) as Rot;
      eL = mix(eL, [-1.55, 0, 0], bell) as Rot;
      eR = [eR[0] - 0.25 * bell, 0, 0];
    }
    p.shR = sR;
    p.elR = eR;
    p.shL = sL;
    p.elL = eL;
    p.torso = [p.torso?.[0] ?? 0, (p.torso?.[1] ?? 0) + twist, 0];
  }
};

export interface CameraAnchors {
  headY: number;
  chestY: number;
  waistY: number;
  feetY: number;
  height: number;
  scale: number;
}

/**
 * The character: an MPFB body (see ./character/avatar.ts) plus class weapons. Lyn body parts use the avatar equipment loader.
 * Poses are tables of joint rotations that the avatar turns into bone orientations.
 */
export class CharacterModel {
  public group: THREE.Group;

  private avatar: AvatarController;
  private readonly weaponProps: WeaponPropController;

  // Skill performance
  private skill: Skill | null = null;
  private skillT = 0;
  private skillSpeed = 1;
  private trails = { R: new SkillTrail(), L: new SkillTrail() };
  /** Edge of each hand's weapon in the weapon group's space (grip-side point, tip). */
  private edge: { R: [THREE.Vector3, THREE.Vector3] | null; L: [THREE.Vector3, THREE.Vector3] | null } = { R: null, L: null };

  // Weapons
  private rightHandWeaponGroup = new THREE.Group();
  private leftHandWeaponGroup = new THREE.Group();
  private outfitMainMaterial: THREE.MeshStandardMaterial;
  private outfitAccentMaterial: THREE.MeshStandardMaterial;
  private weaponMaterial: THREE.MeshStandardMaterial;
  private weaponGlowMaterial: THREE.MeshBasicMaterial;

  private currentState: CharacterState;
  private elapsed = 0;
  private gameplay: GamePose | null = null;
  /** Phase (rad) of the walking / running cycle in a game: it advances with the distance covered, so the feet keep up with the ground. */
  private stride = 0;

  public get ready() { return this.avatar.ready && this.avatar.bodyIdle && !this.avatar.assetsLoading; }
  public get previewReady() { return this.ready && this.avatar.skinReady; }

  /**
   * Loading gate: the body arrives before its clothes, hair and weapons, so a character shown right away would first stand there
   * undressed. Nothing of it is drawn until the body and every asset it asked for are in; after that it stays visible, and later
   * outfit changes swap in place. A new body (race or gender) closes the gate again.
   */
  private revealed = false;
  private bodyKey = '';

  /** Middle of the two hands in world space (after the body has been posed and placed). */
  public handsWorld(out: THREE.Vector3) {
    const a = this.avatar.handAnchor.L.getWorldPosition(new THREE.Vector3());
    const b = this.avatar.handAnchor.R.getWorldPosition(out);
    return out.add(a).multiplyScalar(0.5);
  }

  private stageAnimations = new StageAnimations();
  public animationStatus(file: string) { return this.stageAnimations.status(file); }
  private stageMixamo(dt: number): RetargetPose | null {
    const file = mixamoClipFile(this.currentState.pose);
    return file ? this.stageAnimations.sample(file, dt) : null;
  }

  /** Pose the body from another skeleton's animation (Mixamo clips); null goes back to the built-in poses. */
  public setRetarget(pose: RetargetPose | null) {
    this.avatar.retarget = pose;
  }

  /** World height of the lowest point of the posed body (null before it has loaded). */
  public lowestWorldY() {
    return this.avatar.lowestWorldY();
  }

  /** Another character is about to be shown: hide this one again until it is fully dressed. */
  public closeGate() {
    this.revealed = false;
    this.updateReveal();
  }

  /** True once the character has been shown (dressed) at least once for the current body. */
  public get shown() { return this.revealed; }

  private seenBody = 0;

  private updateReveal() {
    // a different body was installed: whatever was shown is gone, so wait for the new one to be dressed
    if (this.avatar.bodyVersion !== this.seenBody) {
      this.seenBody = this.avatar.bodyVersion;
      this.revealed = false;
    }
    if (!this.revealed && this.ready) this.revealed = true;
    this.avatar.group.visible = this.avatar.ready && this.revealed;
    this.applyWeaponVisibility();
  }

  /** Grip in character-local space; callers pose the character before asking for it. */
  public gameWeaponGrip(out: THREE.Vector3) {
    return this.group.worldToLocal(this.avatar.handAnchor.R.getWorldPosition(out));
  }

  /** Class weapons shown in the hands (hidden in the character creator). Hidden weapons also open the hands. */
  public setWeaponsVisible(show: boolean) {
    this.weaponsShown = show;
    this.applyWeaponVisibility();
  }

  private applyWeaponVisibility() {
    this.rightHandWeaponGroup.visible = this.weaponsShown && this.revealed;
    this.leftHandWeaponGroup.visible = this.weaponsShown && this.revealed;
    this.avatar.grip.R = this.weaponsShown && this.holds.R;
    this.avatar.grip.L = this.weaponsShown && this.holds.L;
  }

  /** Drive the body from the shooter game (see src/game): locomotion, crouch, jump and aiming the held gun. */
  public animateGame(dt: number, pose: GamePose) {
    this.gameplay = pose;
    this.rightHandWeaponGroup.visible = !!pose.keepWeapons && this.weaponsShown && this.revealed;
    this.leftHandWeaponGroup.visible = !!pose.keepWeapons && this.weaponsShown && this.revealed;
    this.animate(dt);
  }

  /** Animate without a game driving the body: the character shows the pose in its state (poses, skills of the test lab). */
  public animateStage(dt: number) {
    this.gameplay = null;
    this.applyWeaponVisibility();
    this.animate(dt);
  }

  public dispose() {
    this.weaponProps.dispose();
    this.stageAnimations.dispose();
    this.avatar.dispose();
    const textures = new Set<THREE.Texture>();
    const skeletons = new Set<THREE.Skeleton>();
    this.group.traverse((object) => {
      const mesh = object as THREE.Mesh;
      mesh.geometry?.dispose();
      if ((mesh as THREE.SkinnedMesh).isSkinnedMesh) skeletons.add((mesh as THREE.SkinnedMesh).skeleton);
      if (mesh.material) (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach(m => {
        for (const value of Object.values(m)) if (value instanceof THREE.Texture) textures.add(value);
        m.dispose();
      });
    });
    textures.forEach(texture => texture.dispose());
    skeletons.forEach(skeleton => skeleton.dispose());
    this.group.removeFromParent();
  }
  private sig = { weapon: '' };
  private weaponsShown = true;
  /** Which hands close around the class weapon when it is shown. */
  private holds = { L: false, R: false };

  constructor(initialState: CharacterState, modelSettings?: () => ModelSettings) {
    this.currentState = initialState;
    this.group = new THREE.Group();
    this.avatar = new AvatarController(() => this.updateState(this.currentState, true), modelSettings);
    this.weaponProps = new WeaponPropController(
      (hand) => this.avatar.propMatrix(hand),
      () => { this.sig.weapon = ''; this.rebuildWeapon(); }
    );
    this.group.add(this.avatar.group);
    this.group.add(this.trails.R.mesh, this.trails.L.mesh);

    // Weapons follow the wrist anchors owned by the avatar.
    this.avatar.handAnchor.R.add(this.rightHandWeaponGroup);
    this.avatar.handAnchor.L.add(this.leftHandWeaponGroup);
    this.rightHandWeaponGroup.name = 'weapon_R';
    this.leftHandWeaponGroup.name = 'weapon_L';
    this.rightHandWeaponGroup.position.set(0, 0, 0.01);
    this.leftHandWeaponGroup.position.set(0, 0, 0.01);

    this.outfitMainMaterial = new THREE.MeshStandardMaterial({ color: new THREE.Color('#1a365d'), roughness: 0.45, metalness: 0.1 });
    this.outfitAccentMaterial = new THREE.MeshStandardMaterial({ color: new THREE.Color('#d69e2e'), roughness: 0.25, metalness: 0.85 });
    this.weaponMaterial = new THREE.MeshStandardMaterial({ color: new THREE.Color('#e2e8f0'), metalness: 0.9, roughness: 0.18 });
    this.weaponGlowMaterial = new THREE.MeshBasicMaterial({ color: new THREE.Color('#38bdf8'), transparent: true, opacity: 0.8 });

    this.updateState(initialState, true);
  }

  /* ───────────────────────── State → scene ───────────────────────── */

  public updateState(state: CharacterState, force = false) {
    this.currentState = state;
    const c = state.cosmetics;

    this.avatar.ensureLoaded(state.gender, state.race);
    const key = `${state.gender}|${state.race}`;
    if (key !== this.bodyKey) {
      this.bodyKey = key;
      this.revealed = false;
    }
    this.avatar.apply(state);
    this.updateReveal();

    const weaponSig = `${state.characterClass}|${state.race}|${state.weaponStyle ?? ''}`;
    if (force || weaponSig !== this.sig.weapon) {
      this.sig.weapon = weaponSig;
      this.rebuildWeapon();
    }

    // weapon trim follows the outfit colours
    const outfit = ASSET_INFO[equipped(state, 'outfit') ?? ''];
    this.outfitMainMaterial.color.set(c.outfitMain || outfit?.color || '#1a365d');
    this.outfitAccentMaterial.color.set(c.outfitAccent || '#d69e2e');
  }

  /** World-space heights for camera framing. */
  public getAnchors(): CameraAnchors {
    return this.avatar.anchors();
  }

  /** Live head height, for close camera views that should follow the head through animations. */
  /** Turn the character about the vertical axis (radians). */
  public setYaw(yaw: number) {
    this.avatar.yaw = yaw;
  }

  public liveHeadY(): number {
    return this.avatar.liveHeadY();
  }

  /* ───────────────────────── Weapons ───────────────────────── */

  private rebuildWeapon() {
    clearGroupKeepMaterials(this.rightHandWeaponGroup);
    clearGroupKeepMaterials(this.leftHandWeaponGroup);
    const style = weaponStyleOf(this.currentState.race, this.currentState.characterClass, this.currentState.weaponStyle);
    this.weaponMaterial.color.set(style.metal);
    this.weaponMaterial.metalness = style.metalness;
    this.weaponMaterial.roughness = style.roughness;
    this.weaponGlowMaterial.color.set(style.glow);
    const propSet = this.weaponProps.build(style.model);
    const set = style.model
      ? propSet
      : buildWeapons(this.currentState.characterClass, {
          metal: this.weaponMaterial,
          glow: this.weaponGlowMaterial,
          main: this.outfitMainMaterial,
          accent: this.outfitAccentMaterial
        });
    [...set.R, ...set.L].forEach((o) => o.scale.multiplyScalar(style.scale));
    set.R.forEach((o) => this.rightHandWeaponGroup.add(o));
    set.L.forEach((o) => this.leftHandWeaponGroup.add(o));
    const cls = this.currentState.characterClass;
    const holds = !!style.model || !['kung_fu_master', 'force_master', 'soul_fighter', 'astromancer'].includes(cls);
    this.holds.R = holds && set.R.length > 0;
    this.holds.L = holds && set.L.length > 0 && (!!style.model || cls !== 'warlock');
    this.applyWeaponVisibility();
    this.measureEdges();
  }

  /* ───────────────────────── Poses & animation ───────────────────────── */

  private poseTarget(pose: string, t: number, calm = 1): PoseTarget {
    const breathe = Math.sin(t * 1.6);
    const still = getMpfbPose(pose);
    if (still) {
      // a still pose from the MPFB packs, with a little breathing so it does not look frozen
      const b = (still.torso ?? [0, 0, 0]) as Rot;
      const h = (still.head ?? [0, 0, 0]) as Rot;
      return { ...(still as PoseTarget), torso: [b[0] + breathe * 0.01, b[1], b[2]], head: [h[0] + breathe * 0.006, h[1], h[2]] };
    }
    switch (pose) {
      case 'combat_ready':
        return {
          hips: [0.05, -0.55, 0], torso: [0.08, 0.25, 0], neck: [0, 0.1, 0], head: [-0.05, 0.4, 0],
          shR: [-1.05, 0.3, -0.35], elR: [-1.5, 0, 0], wrR: [0, 0, 0.1],
          shL: [-0.7, -0.2, 0.5], elL: [-1.7, 0, 0],
          hpR: [-0.55, 0, -0.18], knR: [0.75, 0, 0], anR: [-0.2, 0, 0],
          hpL: [0.28, 0, 0.22], knL: [0.3, 0, 0], anL: [-0.1, 0, 0],
          hipsDrop: 0.07
        };
      case 'victory':
        return {
          hips: [0, 0.12, 0], torso: [-0.1, 0.1, 0], head: [-0.18, 0.1, 0],
          shR: [-0.2, 0, -2.55], elR: [-0.2, 0, 0],
          shL: [0.1, 0, 0.5], elL: [-1.9, 0, 0],
          hpL: [0, 0, 0.12], hpR: [0, 0, -0.12]
        };
      case 'dance': {
        const s = Math.sin(t * 3);
        const c = Math.cos(t * 3);
        const bounce = Math.max(0, Math.sin(t * 6));
        return {
          hips: [0, s * 0.35, s * 0.05], torso: [0, -s * 0.25, c * 0.08], head: [s * 0.1, -s * 0.2, s * 0.1],
          shL: [-0.4 + s * 0.5, 0, 0.9 + c * 0.5], elL: [-0.9 - bounce * 0.3, 0, 0],
          shR: [-0.4 - s * 0.5, 0, -0.9 + c * 0.5], elR: [-0.9 - bounce * 0.3, 0, 0],
          hpL: [-0.1, 0, 0.1], hpR: [-0.1, 0, -0.1], knL: [0.25 + bounce * 0.25, 0, 0], knR: [0.25 + (1 - bounce) * 0.2, 0, 0],
          hipsDrop: 0.03 + bounce * 0.03
        };
      }
      case 'jump': {
        // A repeated, buoyant leap with arms raised and legs tucked in the air.
        const phase = (t * 2.8) % (Math.PI * 2);
        const lift = Math.max(0, Math.sin(phase));
        const tuck = Math.max(0, Math.sin(phase - 0.35));
        return {
          hips: [-0.08 - lift * 0.12, Math.sin(phase) * 0.08, Math.sin(phase) * 0.04],
          torso: [-0.12 - lift * 0.08, 0, Math.sin(phase) * 0.04],
          head: [0.04, 0, 0],
          shL: [-0.45 - lift * 0.25, 0, 1.8], elL: [-0.45, 0, 0.15],
          shR: [-0.45 - lift * 0.25, 0, -1.8], elR: [-0.45, 0, -0.15],
          hpL: [-0.08 - tuck * 0.65, 0, 0.12], knL: [0.18 + tuck * 0.85, 0, 0],
          hpR: [-0.08 - tuck * 0.65, 0, -0.12], knR: [0.18 + tuck * 0.85, 0, 0],
          anL: [-0.15, 0, 0], anR: [-0.15, 0, 0],
          hipsDrop: 0.03 + lift * 0.08,
          hover: lift * 0.2
        };
      }
      case 'vault': {
        // A looping parkour vault: lean forward, reach over the obstacle, tuck the lead leg, then extend to land.
        const phase = (t * 2.1) % (Math.PI * 2);
        const hop = Math.max(0, Math.sin(phase));
        const clear = Math.max(0, Math.sin(phase - 0.7));
        return {
          hips: [0.24 + hop * 0.12, Math.sin(phase) * 0.05, 0],
          torso: [0.34 - hop * 0.16, 0, Math.sin(phase) * 0.035],
          head: [-0.08, 0, 0],
          shL: [-1.2, 0, 0.65], elL: [-0.28, 0, 0.1],
          shR: [-1.05, 0, -0.65], elR: [-0.38, 0, -0.1],
          hpL: [-0.48 - clear * 0.45, 0, 0.08], knL: [0.25 + clear * 0.8, 0, 0],
          hpR: [0.38 - hop * 0.12, 0, -0.08], knR: [0.18 + hop * 0.25, 0, 0],
          anL: [-0.1, 0, 0], anR: [0.08, 0, 0],
          hipsDrop: 0.06 + hop * 0.04,
          hover: hop * 0.16
        };
      }
      case 'bow':
        return {
          hips: [0.05, 0, 0], torso: [0.6, 0, 0], neck: [0.15, 0, 0], head: [0.2, 0, 0],
          shL: [-0.95, -0.35, 0.12], elL: [-1.35, 0, 0],
          shR: [-0.95, 0.35, -0.12], elR: [-1.35, 0, 0],
          hpL: [0, 0, 0.03], hpR: [0, 0, -0.03]
        };
      case 'cute':
        return {
          hips: [0, 0.15, -0.06], torso: [0, 0, -0.06], neck: [0, 0, 0.08], head: [0.1, 0, 0.3],
          shL: [-1.4, 0.4, 0.2], elL: [-1.9, 0, 0],
          shR: [-0.35, 0, -0.3], elR: [-1.0, 0.3, 0],
          hpL: [-0.1, 0, 0.1], knL: [0.4, 0, 0], hpR: [0, 0, -0.05]
        };
      case 'walk': {
        // A natural walk: the thigh swings both ways with a long stride, the knee bends most as the leg swings through and a little
        // at the heel strike, the pelvis turns with each step and the chest and arms counter-turn, the head stays level. In a game the
        // phase follows the distance walked, so the feet do not skate.
        const w = this.gameplay ? this.stride : t * Math.PI * 2 * 0.9;
        const sn = Math.sin(w);
        const cs = Math.cos(w);
        const swingKnee = (x: number) => 0.14 + Math.max(0, x) * 0.78;
        return {
          hips: [0.025, 0.1 * sn, 0.03 * sn], torso: [0.03, -0.13 * sn, -0.025 * sn], neck: [0, 0.03 * sn, 0], head: [-0.02, 0.05 * sn, 0],
          hpL: [-0.42 * sn - 0.03, 0, 0.012], knL: [swingKnee(Math.sin(w + 1.3)), 0, 0], anL: [0.2 * sn - 0.04, 0, 0],
          hpR: [0.42 * sn - 0.03, 0, -0.012], knR: [swingKnee(Math.sin(w + 1.3 + Math.PI)), 0, 0], anR: [-0.2 * sn - 0.04, 0, 0],
          shL: [0.42 * sn, 0, 0.09 + 0.02 * cs], elL: [-0.28 - Math.max(0, -sn) * 0.3, 0, 0],
          shR: [-0.42 * sn, 0, -0.09 - 0.02 * cs], elR: [-0.28 - Math.max(0, sn) * 0.3, 0, 0],
          wrL: [0, 0, 0.05], wrR: [0, 0, -0.05],
          // the hips sink as the legs spread and rise as they pass under the body
          hipsDrop: 0.012 + Math.abs(sn) * 0.032
        };
      }
      case 'run': {
        // Forward lean, high knees, elbows bent to a right angle and pumping against the legs, the chest twisting against the hips.
        const w = this.gameplay ? this.stride : t * Math.PI * 2 * 1.45;
        const sn = Math.sin(w);
        const swingKnee = (x: number) => 0.4 + Math.max(0, x) * 1.5;
        return {
          hips: [0.12, 0.13 * sn, 0.04 * sn], torso: [0.2, -0.2 * sn, -0.03 * sn], neck: [-0.05, 0.05 * sn, 0], head: [-0.14, 0.06 * sn, 0],
          hpL: [-0.78 * sn - 0.14, 0, 0.015], knL: [swingKnee(Math.sin(w + 1.4)), 0, 0], anL: [0.25 * sn - 0.1, 0, 0],
          hpR: [0.78 * sn - 0.14, 0, -0.015], knR: [swingKnee(Math.sin(w + 1.4 + Math.PI)), 0, 0], anR: [-0.25 * sn - 0.1, 0, 0],
          shL: [0.85 * sn, 0, 0.1], elL: [-1.45 - Math.max(0, -sn) * 0.25, 0, 0],
          shR: [-0.85 * sn, 0, -0.1], elR: [-1.45 - Math.max(0, sn) * 0.25, 0, 0],
          hipsDrop: 0.035 + Math.abs(sn) * 0.05
        };
      }
      case 'meditate': {
        // floating lotus: crossed legs (from the MPFB lotus pose), hands on the knees, a slow hover and breath
        const hover = Math.sin(t * 1.1);
        return {
          hips: [-0.15, Math.sin(t * 0.35) * 0.08, 0], torso: [0.08 + breathe * 0.02, 0, 0], head: [0.06, 0, 0],
          hpL: [-1.63, 0, 0.47], knL: [2.88, 0, -0.63], hpR: [-1.63, 0, -0.46], knR: [2.69, 0, 0.84],
          shL: [0.26, 0, 0.07], elL: [-1.06, 0, 0.24], shR: [0.26, 0, -0.07], elR: [-1.06, 0, -0.24],
          hipsDrop: 0.42, hover: 0.07 + hover * 0.03
        };
      }
      default: // idle
        return restStyle(t, calm);
    }
  }

  private updateTrails(dt: number) {
    (['R', 'L'] as const).forEach((side) => {
      const g = side === 'R' ? this.rightHandWeaponGroup : this.leftHandWeaponGroup;
      const e = this.edge[side];
      let pts: [THREE.Vector3, THREE.Vector3] | null = null;
      if (this.skill && e && g.children.length) {
        this.group.updateMatrixWorld(true);
        pts = [this.group.worldToLocal(g.localToWorld(e[0].clone())), this.group.worldToLocal(g.localToWorld(e[1].clone()))];
      }
      this.trails[side].update(dt, pts);
    });
  }

  /** Where the cutting edge of each weapon lies along its long axis (+y of the grip), used for the skill trail. */
  private measureEdges() {
    (['R', 'L'] as const).forEach((side) => {
      const g = side === 'R' ? this.rightHandWeaponGroup : this.leftHandWeaponGroup;
      this.edge[side] = null;
      if (!g.children.length) return;
      g.updateMatrixWorld(true);
      const box = new THREE.Box3();
      const inv = g.matrixWorld.clone().invert();
      g.children.forEach((c) => box.union(new THREE.Box3().setFromObject(c).applyMatrix4(inv)));
      if (box.isEmpty()) return;
      const len = box.max.y;
      this.edge[side] = len > 0.12 ? [new THREE.Vector3(0, len * 0.3, 0), new THREE.Vector3(0, len, 0)] : [new THREE.Vector3(0, -0.03, 0), new THREE.Vector3(0, 0.1, 0)];
    });
  }

  /** Perform one of the current class's skills (the character returns to its pose afterwards). */
  public playSkill(id: string, speed = 1) {
    const skill = skillsFor(this.currentState.characterClass).find((s) => s.id === id);
    if (!skill) return 0;
    this.skill = skill;
    this.skillT = 0;
    this.skillSpeed = speed;
    this.trails.R.setColor(skill.trail ?? '#9fe3ff');
    this.trails.L.setColor(skill.trail ?? '#9fe3ff');
    return skill.keys[skill.keys.length - 1].t / speed;
  }

  /** True while a class skill is being performed. */
  public get performing() { return !!this.skill; }

  /** Facial expression for the current pose / skill, with a talking mouth while a voice line plays. */
  private faceFor(t: number): Partial<Record<FaceKey, number>> {
    const pose = this.currentState.pose;
    let f: Partial<Record<FaceKey, number>> = {};
    switch (pose) {
      case 'victory':
        f = { smile: 0.85, browUp: 0.35, mouthOpen: 0.15 };
        break;
      case 'cute':
        f = { smile: 0.7, blinkL: 0.95, squint: 0.15 };
        break;
      case 'combat_ready':
        f = { browDown: 0.65, squint: 0.3 };
        break;
      case 'dance':
        f = { smile: 0.6, mouthOpen: 0.1 + 0.1 * Math.max(0, Math.sin(t * 3)) };
        break;
      case 'bow':
        f = { smile: 0.3, blinkL: 0.45, blinkR: 0.45 };
        break;
      case 'meditate':
        f = { blinkL: 1, blinkR: 1, smile: 0.12 };
        break;
      case 'run':
        f = { browDown: 0.3, mouthOpen: 0.25 };
        break;
      default:
        f = pose.startsWith('mpfb:') || pose.startsWith('mixamo:') ? { smile: 0.12 } : {};
    }
    if (this.skill) f = { ...f, browDown: 0.8, squint: 0.35, mouthOpen: 0.3, smile: 0 };
    // an expression chosen on the stage replaces the one the pose suggests
    const ex = this.currentState.expression;
    if (ex && ex !== 'neutral' && !this.skill) f = { ...EXPRESSIONS[ex] };
    if (sound.getVoiceState().status === 'playing') f = { ...f, ...this.visemes(t) };
    return f;
  }

  /** Mouth shape of the voice line right now, from its sound: which vowel band is loud decides the shape, loudness the opening. */
  private visemes(t: number): Partial<Record<FaceKey, number>> {
    const sp = sound.getVoiceSpectrum();
    if (sp.level < 0.01) {
      // no analyser (or a silent moment at the very start): an uneven rhythm cycling through vowels
      const open = 0.35 + 0.45 * Math.abs(Math.sin(t * 13) * Math.sin(t * 4.7 + 1));
      const phase = Math.floor(t * 6.5) % 4;
      return { vAA: phase === 0 ? open : 0, vEE: phase === 1 ? open * 0.8 : 0, vOH: phase === 2 ? open : 0, vOO: phase === 3 ? open * 0.9 : 0 };
    }
    const o = Math.min(1, sp.level * 1.25);
    if (o < 0.14) return { vMM: 0.5 * (1 - o / 0.14) }; // between words the lips meet
    const hiss = sp.hiss;
    return {
      vAA: Math.min(1, sp.mid * o * 1.25) * (1 - hiss * 0.6),
      vOH: Math.min(1, sp.low * o * 1.0) * (1 - hiss * 0.6),
      vOO: Math.min(1, Math.max(0, sp.low - 0.45) * o * 1.6),
      vEE: Math.min(1, (sp.high * 1.2 + hiss * 0.6) * o),
      vFV: Math.min(1, hiss * o * 0.35),
      mouthOpen: 0.06 * o
    };
  }

  public animate(deltaTime: number) {
    this.updateReveal();
    this.elapsed += deltaTime;
    const t = this.elapsed;
    const g = this.gameplay;
    // on the stage a chosen Mixamo clip poses the body (a game sets its own pose through setRetarget)
    if (!g) this.avatar.retarget = this.stageMixamo(deltaTime);
    if (g) {
      // one full cycle (two steps) per this many metres: a crouched walk takes shorter steps than a walk, and a walk than a run
      const len = g.speed > 3.2 ? 3.2 : g.crouch > 0.4 ? 1.1 : 1.55;
      this.stride += (g.speed / len) * Math.PI * 2 * deltaTime;
    }
    const gait = !g ? this.currentState.pose : g.speed > 3.2 ? 'run' : g.speed > 0.4 ? 'walk' : 'idle';
    // in a game the resting body moves only a little; on the stage it styles itself
    const base = this.poseTarget(gait, t, g ? 0.25 : 1);
    if (g) applyGamePose(base, g, this.stride);
    let target: PoseTarget = base;
    let speed = 9;
    if (this.skill) {
      this.skillT += deltaTime * this.skillSpeed;
      const s = sampleSkill(this.skill, this.skillT, base);
      if (s) {
        target = s;
        speed = 22;
      } else this.skill = null;
    }
    this.avatar.animate(deltaTime, target as Partial<Record<string, Rot>>, target.hipsDrop ?? 0, speed, !g && !this.skill, target.hover ?? 0);
    this.avatar.setFace(this.faceFor(t));
    this.updateTrails(deltaTime);

    // Force Master chi bangles
    const bR = this.rightHandWeaponGroup.getObjectByName('chiBangle_1');
    const bL = this.leftHandWeaponGroup.getObjectByName('chiBangle_-1');
    if (bR) bR.rotation.y += deltaTime * 3.5;
    if (bL) bL.rotation.y -= deltaTime * 3.5;

    // Warlock grimoire bobs above the hand, Astromancer orb turns
    const book = this.leftHandWeaponGroup.getObjectByName('grimoire');
    if (book) book.position.y = 0.12 + Math.sin(t * 2.2) * 0.015;
    const orb = this.leftHandWeaponGroup.getObjectByName('starOrb');
    if (orb) orb.rotation.y += deltaTime * 1.2;
  }
}

/** Remove children (weapons share long-lived materials, so only geometry is freed). */
const clearGroupKeepMaterials = (g: THREE.Object3D) => {
  while (g.children.length) {
    const c = g.children[0];
    g.remove(c);
    c.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
  }
};

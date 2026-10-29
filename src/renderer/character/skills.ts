import * as THREE from 'three';
import type { WeaponKind } from '../../types/character';

/**
 * Class skills ("chiêu thức"): short keyframed performances. A key is a partial pose (joint rotations as in CharacterModel's
 * pose tables); joints a key leaves out keep the current pose, so every skill starts and ends in the pose the character was in.
 * Weapons ride on the hand sockets of the avatar, so they follow the wrists; the trail records the weapon's edge while it moves.
 */

export type Rot = [number, number, number];
export type SkillPose = Partial<Record<'hips' | 'torso' | 'neck' | 'head' | 'shL' | 'shR' | 'elL' | 'elR' | 'wrL' | 'wrR' | 'hpL' | 'hpR' | 'knL' | 'knR' | 'anL' | 'anR', Rot>> & { hipsDrop?: number };

export interface SkillKey {
  /** Seconds from the start. */
  t: number;
  pose: SkillPose;
}

export interface Skill {
  id: string;
  ko: string;
  en: string;
  /** Leave a glowing trail behind the weapon. */
  trail?: string;
  keys: SkillKey[];
}

const END = (t: number): SkillKey => ({ t, pose: {} });

const SLASH: Skill = {
  id: 'slash',
  ko: 'Chém ngang',
  en: 'Horizontal slash',
  trail: '#9fe3ff',
  keys: [
    END(0),
    { t: 0.4, pose: { hips: [0.05, -0.8, 0], torso: [0.05, -0.5, 0], head: [0, -0.3, 0], shR: [-1.6, -0.7, -0.9], elR: [-1.1, 0, 0], shL: [-0.5, 0.3, 0.7], elL: [-1.4, 0, 0], hpR: [-0.45, 0, -0.2], knR: [0.6, 0, 0], hpL: [0.3, 0, 0.2], knL: [0.3, 0, 0], hipsDrop: 0.06 } },
    { t: 0.62, pose: { hips: [0.05, 0.45, 0], torso: [0.1, 0.65, 0], head: [0, 0.4, 0], shR: [-1.45, 1.1, -0.15], elR: [-0.25, 0, 0], shL: [-0.3, -0.4, 0.8], elL: [-1.2, 0, 0], hpR: [-0.75, 0, -0.1], knR: [0.9, 0, 0], hpL: [0.4, 0, 0.2], knL: [0.2, 0, 0], hipsDrop: 0.1 } },
    { t: 1.0, pose: { hips: [0.05, 0.45, 0], torso: [0.1, 0.65, 0], head: [0, 0.4, 0], shR: [-1.45, 1.1, -0.15], elR: [-0.25, 0, 0], shL: [-0.3, -0.4, 0.8], elL: [-1.2, 0, 0], hpR: [-0.75, 0, -0.1], knR: [0.9, 0, 0], hpL: [0.4, 0, 0.2], knL: [0.2, 0, 0], hipsDrop: 0.1 } },
    END(1.7)
  ]
};

const OVERHEAD: Skill = {
  id: 'overhead',
  ko: 'Bổ từ trên xuống',
  en: 'Overhead cleave',
  trail: '#ffd27a',
  keys: [
    END(0),
    { t: 0.45, pose: { hips: [-0.05, -0.3, 0], torso: [-0.25, -0.2, 0], head: [-0.15, 0, 0], shR: [-2.9, 0.1, -0.3], elR: [-0.9, 0, 0], shL: [-2.7, 0.1, 0.35], elL: [-1.0, 0, 0], hpR: [-0.2, 0, -0.15], knR: [0.2, 0, 0], hpL: [0.1, 0, 0.15], hipsDrop: 0 } },
    { t: 0.68, pose: { hips: [0.2, -0.3, 0], torso: [0.5, -0.15, 0], head: [0.15, 0, 0], shR: [-1.3, 0.1, -0.15], elR: [-0.2, 0, 0], shL: [-1.2, 0.1, 0.25], elL: [-0.3, 0, 0], hpR: [-0.85, 0, -0.1], knR: [0.95, 0, 0], hpL: [0.35, 0, 0.15], knL: [0.2, 0, 0], hipsDrop: 0.13 } },
    { t: 1.1, pose: { hips: [0.2, -0.3, 0], torso: [0.5, -0.15, 0], head: [0.15, 0, 0], shR: [-1.3, 0.1, -0.15], elR: [-0.2, 0, 0], shL: [-1.2, 0.1, 0.25], elL: [-0.3, 0, 0], hpR: [-0.85, 0, -0.1], knR: [0.95, 0, 0], hpL: [0.35, 0, 0.15], knL: [0.2, 0, 0], hipsDrop: 0.13 } },
    END(1.8)
  ]
};

const PUNCH: Skill = {
  id: 'punch',
  ko: 'Liên hoàn quyền',
  en: 'Punch combo',
  trail: '#ffb36b',
  keys: [
    END(0),
    { t: 0.25, pose: { hips: [0.05, -0.4, 0], torso: [0.05, -0.3, 0], shR: [-0.9, 0.2, -0.5], elR: [-2.2, 0, 0], shL: [-1.55, -0.1, 0.35], elL: [-0.15, 0, 0], hpR: [-0.35, 0, -0.15], knR: [0.5, 0, 0], hpL: [0.2, 0, 0.15], knL: [0.3, 0, 0], hipsDrop: 0.06 } },
    { t: 0.5, pose: { hips: [0.05, 0.4, 0], torso: [0.05, 0.3, 0], shR: [-1.55, 0.1, -0.1], elR: [-0.1, 0, 0], shL: [-0.9, -0.2, 0.5], elL: [-2.2, 0, 0], hpR: [-0.35, 0, -0.15], knR: [0.5, 0, 0], hpL: [0.2, 0, 0.15], knL: [0.3, 0, 0], hipsDrop: 0.06 } },
    { t: 0.75, pose: { hips: [0.05, -0.4, 0], torso: [0.05, -0.3, 0], shR: [-1.55, -0.1, -0.1], elR: [-0.1, 0, 0], shL: [-0.9, 0.2, 0.5], elL: [-2.2, 0, 0], hpR: [-0.35, 0, -0.15], knR: [0.5, 0, 0], hpL: [0.2, 0, 0.15], knL: [0.3, 0, 0], hipsDrop: 0.06 } },
    { t: 1.0, pose: { hips: [0.05, 0.5, 0], torso: [0.1, 0.4, 0], shR: [-0.7, 0.2, -0.5], elR: [-2.3, 0, 0], shL: [-1.6, 0, 0.2], elL: [-0.1, 0, 0], hpR: [-0.5, 0, -0.15], knR: [0.7, 0, 0], hpL: [0.2, 0, 0.15], knL: [0.3, 0, 0], hipsDrop: 0.09 } },
    END(1.6)
  ]
};

const KICK: Skill = {
  id: 'kick',
  ko: 'Cước xoay',
  en: 'Spin kick',
  trail: '#ffb36b',
  keys: [
    END(0),
    { t: 0.35, pose: { hips: [0, -0.7, 0], torso: [0, -0.4, 0], shR: [-0.6, 0, -0.9], elR: [-1.2, 0, 0], shL: [-0.6, 0, 0.9], elL: [-1.2, 0, 0], hpL: [0.15, 0, 0.1], knL: [0.5, 0, 0], hpR: [-0.9, 0, -0.2], knR: [1.4, 0, 0], hipsDrop: 0.05 } },
    { t: 0.6, pose: { hips: [-0.1, 0.5, 0], torso: [-0.2, 0.5, 0], shR: [-0.3, 0, -1.4], elR: [-0.3, 0, 0], shL: [-0.3, 0, 1.4], elL: [-0.3, 0, 0], hpL: [0.1, 0, 0.1], knL: [0.15, 0, 0], hpR: [-1.55, 0, -0.1], knR: [0.15, 0, 0], hipsDrop: 0.03 } },
    { t: 1.0, pose: { hips: [-0.1, 0.5, 0], torso: [-0.2, 0.5, 0], shR: [-0.3, 0, -1.4], elR: [-0.3, 0, 0], shL: [-0.3, 0, 1.4], elL: [-0.3, 0, 0], hpL: [0.1, 0, 0.1], knL: [0.15, 0, 0], hpR: [-1.55, 0, -0.1], knR: [0.15, 0, 0], hipsDrop: 0.03 } },
    END(1.7)
  ]
};

const CAST: Skill = {
  id: 'cast',
  ko: 'Phóng khí công',
  en: 'Chi blast',
  trail: '#7dd3fc',
  keys: [
    END(0),
    { t: 0.5, pose: { hips: [0, -0.2, 0], torso: [-0.15, 0, 0], head: [-0.1, 0, 0], shR: [-1.2, -0.5, -0.4], elR: [-1.6, 0, 0], shL: [-1.2, 0.5, 0.4], elL: [-1.6, 0, 0], hpR: [-0.1, 0, -0.15], hpL: [0.1, 0, 0.15], hipsDrop: 0.04 } },
    { t: 0.75, pose: { hips: [0.05, 0, 0], torso: [0.2, 0, 0], head: [0.05, 0, 0], shR: [-1.55, 0.1, -0.15], elR: [-0.1, 0, 0], shL: [-1.55, -0.1, 0.15], elL: [-0.1, 0, 0], hpR: [-0.6, 0, -0.15], knR: [0.6, 0, 0], hpL: [0.2, 0, 0.15], knL: [0.2, 0, 0], hipsDrop: 0.09 } },
    { t: 1.3, pose: { hips: [0.05, 0, 0], torso: [0.2, 0, 0], head: [0.05, 0, 0], shR: [-1.55, 0.1, -0.15], elR: [-0.1, 0, 0], shL: [-1.55, -0.1, 0.15], elL: [-0.1, 0, 0], hpR: [-0.6, 0, -0.15], knR: [0.6, 0, 0], hpL: [0.2, 0, 0.15], knL: [0.2, 0, 0], hipsDrop: 0.09 } },
    END(2.0)
  ]
};

const SMASH: Skill = {
  id: 'smash',
  ko: 'Giáng búa',
  en: 'Axe smash',
  trail: '#ff8a65',
  keys: [
    END(0),
    { t: 0.6, pose: { hips: [-0.1, -0.2, 0], torso: [-0.4, -0.1, 0], head: [-0.2, 0, 0], shR: [-3.0, 0.1, -0.25], elR: [-0.7, 0, 0], shL: [-2.8, 0.1, 0.3], elL: [-0.8, 0, 0], hpR: [-0.25, 0, -0.2], knR: [0.3, 0, 0], hpL: [0.15, 0, 0.2], knL: [0.2, 0, 0], hipsDrop: 0 } },
    { t: 0.85, pose: { hips: [0.25, -0.2, 0], torso: [0.65, -0.1, 0], head: [0.2, 0, 0], shR: [-1.15, 0.1, -0.15], elR: [-0.15, 0, 0], shL: [-1.05, 0.1, 0.25], elL: [-0.25, 0, 0], hpR: [-0.9, 0, -0.1], knR: [1.0, 0, 0], hpL: [0.3, 0, 0.2], knL: [0.3, 0, 0], hipsDrop: 0.16 } },
    { t: 1.3, pose: { hips: [0.25, -0.2, 0], torso: [0.65, -0.1, 0], head: [0.2, 0, 0], shR: [-1.15, 0.1, -0.15], elR: [-0.15, 0, 0], shL: [-1.05, 0.1, 0.25], elL: [-0.25, 0, 0], hpR: [-0.9, 0, -0.1], knR: [1.0, 0, 0], hpL: [0.3, 0, 0.2], knL: [0.3, 0, 0], hipsDrop: 0.16 } },
    END(2.0)
  ]
};

const DUAL: Skill = {
  id: 'dual',
  ko: 'Song đao chéo',
  en: 'Cross slash',
  trail: '#d6bcfa',
  keys: [
    END(0),
    { t: 0.3, pose: { hips: [0.1, 0, 0], torso: [0.1, 0, 0], shR: [-1.9, -0.9, -1.0], elR: [-1.0, 0, 0], shL: [-1.9, 0.9, 1.0], elL: [-1.0, 0, 0], hpR: [-0.5, 0, -0.2], knR: [0.7, 0, 0], hpL: [0.3, 0, 0.2], knL: [0.3, 0, 0], hipsDrop: 0.08 } },
    { t: 0.5, pose: { hips: [0.15, 0.2, 0], torso: [0.2, 0.2, 0], shR: [-1.3, 1.1, -0.1], elR: [-0.3, 0, 0], shL: [-1.3, -1.1, 0.1], elL: [-0.3, 0, 0], hpR: [-0.7, 0, -0.15], knR: [0.9, 0, 0], hpL: [0.3, 0, 0.2], knL: [0.3, 0, 0], hipsDrop: 0.12 } },
    { t: 0.85, pose: { hips: [0.15, 0.2, 0], torso: [0.2, 0.2, 0], shR: [-1.3, 1.1, -0.1], elR: [-0.3, 0, 0], shL: [-1.3, -1.1, 0.1], elL: [-0.3, 0, 0], hpR: [-0.7, 0, -0.15], knR: [0.9, 0, 0], hpL: [0.3, 0, 0.2], knL: [0.3, 0, 0], hipsDrop: 0.12 } },
    END(1.5)
  ]
};

const SUMMON: Skill = {
  id: 'summon',
  ko: 'Triệu hồi',
  en: 'Summon',
  trail: '#a5b4fc',
  keys: [
    END(0),
    { t: 0.6, pose: { hips: [0, 0.1, 0], torso: [-0.2, 0, 0], head: [-0.25, 0, 0], shR: [-2.8, 0, -0.35], elR: [-0.5, 0, 0], shL: [-0.6, 0.2, 1.3], elL: [-0.6, 0, 0], hpR: [0, 0, -0.1], hpL: [0, 0, 0.1] } },
    { t: 1.4, pose: { hips: [0, -0.1, 0], torso: [-0.25, 0, 0], head: [-0.3, 0, 0], shR: [-2.8, 0, -0.35], elR: [-0.5, 0, 0], shL: [-0.6, 0.2, 1.5], elL: [-0.4, 0, 0], hpR: [0, 0, -0.1], hpL: [0, 0, 0.1] } },
    END(2.2)
  ]
};

const SHOOT: Skill = {
  id: 'shoot',
  ko: 'Song thương liên xạ',
  en: 'Dual shot',
  trail: '#fde68a',
  keys: [
    END(0),
    { t: 0.3, pose: { hips: [0, -0.15, 0], torso: [0, -0.1, 0], shR: [-1.55, -0.1, -0.2], elR: [-0.1, 0, 0], shL: [-1.55, 0.1, 0.2], elL: [-0.1, 0, 0], hpR: [-0.2, 0, -0.2], hpL: [0.1, 0, 0.2], hipsDrop: 0.04 } },
    { t: 0.42, pose: { hips: [0, -0.15, 0], torso: [-0.1, -0.1, 0], shR: [-1.85, -0.1, -0.2], elR: [-0.3, 0, 0], shL: [-1.55, 0.1, 0.2], elL: [-0.1, 0, 0], hpR: [-0.2, 0, -0.2], hpL: [0.1, 0, 0.2], hipsDrop: 0.04 } },
    { t: 0.54, pose: { hips: [0, -0.15, 0], torso: [0, -0.1, 0], shR: [-1.55, -0.1, -0.2], elR: [-0.1, 0, 0], shL: [-1.85, 0.1, 0.2], elL: [-0.3, 0, 0], hpR: [-0.2, 0, -0.2], hpL: [0.1, 0, 0.2], hipsDrop: 0.04 } },
    { t: 0.66, pose: { hips: [0, -0.15, 0], torso: [-0.1, -0.1, 0], shR: [-1.85, -0.1, -0.2], elR: [-0.3, 0, 0], shL: [-1.55, 0.1, 0.2], elL: [-0.1, 0, 0], hpR: [-0.2, 0, -0.2], hpL: [0.1, 0, 0.2], hipsDrop: 0.04 } },
    { t: 1.1, pose: { hips: [0, -0.15, 0], torso: [0, -0.1, 0], shR: [-1.55, -0.1, -0.2], elR: [-0.1, 0, 0], shL: [-1.55, 0.1, 0.2], elL: [-0.1, 0, 0], hpR: [-0.2, 0, -0.2], hpL: [0.1, 0, 0.2], hipsDrop: 0.04 } },
    END(1.7)
  ]
};

const SPIN: Skill = {
  id: 'spin',
  ko: 'Lốc kiếm',
  en: 'Blade whirl',
  trail: '#c4b5fd',
  keys: [
    END(0),
    { t: 0.3, pose: { hips: [0.05, -1.2, 0], torso: [0.1, -0.6, 0], shR: [-1.5, -0.4, -1.2], elR: [-0.4, 0, 0], shL: [-1.4, 0.4, 1.2], elL: [-0.4, 0, 0], hpR: [-0.4, 0, -0.2], knR: [0.6, 0, 0], hpL: [-0.2, 0, 0.2], knL: [0.5, 0, 0], hipsDrop: 0.1 } },
    { t: 0.55, pose: { hips: [0.05, 0.2, 0], torso: [0.1, 0.5, 0], shR: [-1.5, 0.2, -1.3], elR: [-0.2, 0, 0], shL: [-1.4, -0.2, 1.3], elL: [-0.2, 0, 0], hpR: [-0.4, 0, -0.2], knR: [0.6, 0, 0], hpL: [-0.2, 0, 0.2], knL: [0.5, 0, 0], hipsDrop: 0.1 } },
    { t: 0.8, pose: { hips: [0.05, 1.3, 0], torso: [0.1, 0.7, 0], shR: [-1.5, 0.6, -1.2], elR: [-0.3, 0, 0], shL: [-1.4, -0.6, 1.2], elL: [-0.3, 0, 0], hpR: [-0.4, 0, -0.2], knR: [0.6, 0, 0], hpL: [-0.2, 0, 0.2], knL: [0.5, 0, 0], hipsDrop: 0.1 } },
    { t: 1.05, pose: { hips: [0.05, -0.3, 0], torso: [0.1, -0.4, 0], shR: [-1.5, -0.3, -1.2], elR: [-0.3, 0, 0], shL: [-1.4, 0.3, 1.2], elL: [-0.3, 0, 0], hpR: [-0.4, 0, -0.2], knR: [0.6, 0, 0], hpL: [-0.2, 0, 0.2], knL: [0.5, 0, 0], hipsDrop: 0.1 } },
    END(1.6)
  ]
};

const DRAW: Skill = {
  id: 'draw',
  ko: 'Tiễn tích lực',
  en: 'Charged shot',
  trail: '#86efac',
  keys: [
    END(0),
    { t: 0.4, pose: { hips: [0, -0.9, 0], torso: [0, -0.4, 0], head: [0, 0.9, 0], shL: [-1.5, 0.9, 0.1], elL: [-0.05, 0, 0], shR: [-1.5, 0.95, -0.2], elR: [-1.6, 0, 0], hpR: [0, 0, -0.25], hpL: [0, 0, 0.25] } },
    { t: 1.0, pose: { hips: [0, -0.9, 0], torso: [-0.05, -0.45, 0], head: [0, 0.95, 0], shL: [-1.55, 0.95, 0.1], elL: [-0.02, 0, 0], shR: [-1.45, 0.4, -0.7], elR: [-2.4, 0, 0], hpR: [0, 0, -0.25], hpL: [0, 0, 0.25] } },
    { t: 1.12, pose: { hips: [0, -0.9, 0], torso: [-0.05, -0.45, 0], head: [0, 0.95, 0], shL: [-1.55, 0.95, 0.1], elL: [-0.02, 0, 0], shR: [-1.1, 0.2, -1.2], elR: [-0.6, 0, 0], hpR: [0, 0, -0.25], hpL: [0, 0, 0.25] } },
    { t: 1.5, pose: { hips: [0, -0.9, 0], torso: [-0.05, -0.45, 0], head: [0, 0.95, 0], shL: [-1.55, 0.95, 0.1], elL: [-0.02, 0, 0], shR: [-1.1, 0.2, -1.2], elR: [-0.6, 0, 0], hpR: [0, 0, -0.25], hpL: [0, 0, 0.25] } },
    END(2.1)
  ]
};

const INVOKE: Skill = {
  id: 'invoke',
  ko: 'Phóng bùa ấn',
  en: 'Talisman burst',
  trail: '#e879f9',
  keys: [
    END(0),
    { t: 0.35, pose: { hips: [0, -0.4, 0], torso: [-0.1, -0.3, 0], shR: [-2.2, -0.3, -0.6], elR: [-1.3, 0, 0], shL: [-1.2, 0.3, 0.5], elL: [-1.1, 0, 0], hpR: [-0.2, 0, -0.15], hpL: [0.1, 0, 0.15] } },
    { t: 0.6, pose: { hips: [0, 0.3, 0], torso: [0.15, 0.35, 0], shR: [-1.55, 0.5, -0.1], elR: [-0.05, 0, 0], shL: [-1.3, 0.2, 0.5], elL: [-1.0, 0, 0], hpR: [-0.5, 0, -0.15], knR: [0.5, 0, 0], hpL: [0.2, 0, 0.15], hipsDrop: 0.06 } },
    { t: 1.1, pose: { hips: [0, 0.3, 0], torso: [0.15, 0.35, 0], shR: [-1.55, 0.5, -0.1], elR: [-0.05, 0, 0], shL: [-1.3, 0.2, 0.5], elL: [-1.0, 0, 0], hpR: [-0.5, 0, -0.15], knR: [0.5, 0, 0], hpL: [0.2, 0, 0.15], hipsDrop: 0.06 } },
    END(1.7)
  ]
};

const STARFALL: Skill = {
  id: 'starfall',
  ko: 'Mưa sao băng',
  en: 'Starfall',
  trail: '#fcd34d',
  keys: [
    END(0),
    { t: 0.6, pose: { hips: [0, 0, 0], torso: [-0.25, 0, 0], head: [-0.35, 0, 0], shR: [-2.6, 0, -0.6], elR: [-0.3, 0, 0], shL: [-2.6, 0, 0.6], elL: [-0.3, 0, 0], hpR: [0, 0, -0.1], hpL: [0, 0, 0.1] } },
    { t: 1.0, pose: { hips: [0, 0, 0], torso: [-0.3, 0, 0], head: [-0.4, 0, 0], shR: [-2.8, 0, -0.4], elR: [-0.2, 0, 0], shL: [-2.8, 0, 0.4], elL: [-0.2, 0, 0], hpR: [0, 0, -0.1], hpL: [0, 0, 0.1] } },
    { t: 1.3, pose: { hips: [0.1, 0, 0], torso: [0.3, 0, 0], head: [0.1, 0, 0], shR: [-1.4, 0.2, -0.3], elR: [-0.1, 0, 0], shL: [-1.4, -0.2, 0.3], elL: [-0.1, 0, 0], hpR: [-0.5, 0, -0.15], knR: [0.5, 0, 0], hpL: [0.2, 0, 0.15], hipsDrop: 0.07 } },
    { t: 1.7, pose: { hips: [0.1, 0, 0], torso: [0.3, 0, 0], head: [0.1, 0, 0], shR: [-1.4, 0.2, -0.3], elR: [-0.1, 0, 0], shL: [-1.4, -0.2, 0.3], elL: [-0.1, 0, 0], hpR: [-0.5, 0, -0.15], knR: [0.5, 0, 0], hpL: [0.2, 0, 0.15], hipsDrop: 0.07 } },
    END(2.3)
  ]
};

const strum = (t: number, down: boolean): SkillKey => ({
  t,
  pose: { torso: [0.05, 0.15, 0], head: [0.15, 0.25, 0.1], shL: [-1.0, 0.7, 0.3], elL: [-1.2, 0, 0], shR: [-0.5, 0.6, -0.2], elR: [down ? -1.5 : -1.9, 0, 0], hpR: [0, 0, -0.08], hpL: [0, 0, 0.08] }
});

const PLAY: Skill = {
  id: 'play',
  ko: 'Hùng ca',
  en: 'Anthem',
  trail: '#f9a8d4',
  keys: [END(0), strum(0.45, true), strum(0.65, false), strum(0.85, true), strum(1.05, false), strum(1.25, true), strum(1.45, false), strum(1.65, true), END(2.3)]
};

export const WEAPON_SKILLS: Record<WeaponKind, Skill[]> = {
  curved_saber: [SLASH, OVERHEAD],
  dragon_gauntlets: [PUNCH, KICK],
  chi_bangles: [CAST],
  great_axe: [SMASH, OVERHEAD],
  reverse_daggers: [DUAL, SLASH],
  flower_staff: [SUMMON],
  spirit_revolvers: [SHOOT],
  slender_sword: [SPIN, SLASH],
  talismans: [INVOKE, CAST],
  soul_gauntlets: [CAST, PUNCH],
  greatsword: [OVERHEAD, SLASH],
  longbow: [DRAW],
  star_orb: [STARFALL, CAST],
  twin_shortswords: [SPIN, DUAL],
  lute: [PLAY]
};

export const skillsFor = (weapon: WeaponKind): Skill[] => WEAPON_SKILLS[weapon] ?? [];

/* ───────────────────────── interpolation ───────────────────────── */

const JOINT_KEYS = ['hips', 'torso', 'neck', 'head', 'shL', 'shR', 'elL', 'elR', 'wrL', 'wrR', 'hpL', 'hpR', 'knL', 'knR', 'anL', 'anR'] as const;
const ease = (u: number) => u * u * (3 - 2 * u);

/** Pose of a skill at time `t`, filling joints the keys do not mention from `base`. Returns null when the skill is over. */
export const sampleSkill = (skill: Skill, t: number, base: SkillPose): SkillPose | null => {
  const keys = skill.keys;
  if (t >= keys[keys.length - 1].t) return null;
  let i = 0;
  while (i < keys.length - 2 && t >= keys[i + 1].t) i++;
  const a = keys[i];
  const b = keys[i + 1];
  const u = ease(Math.min(1, Math.max(0, (t - a.t) / (b.t - a.t))));
  const out: SkillPose = {};
  for (const j of JOINT_KEYS) {
    const ra = (a.pose[j] ?? base[j] ?? [0, 0, 0]) as Rot;
    const rb = (b.pose[j] ?? base[j] ?? [0, 0, 0]) as Rot;
    out[j] = [ra[0] + (rb[0] - ra[0]) * u, ra[1] + (rb[1] - ra[1]) * u, ra[2] + (rb[2] - ra[2]) * u];
  }
  const da = a.pose.hipsDrop ?? base.hipsDrop ?? 0;
  const db = b.pose.hipsDrop ?? base.hipsDrop ?? 0;
  out.hipsDrop = da + (db - da) * u;
  return out;
};

/* ───────────────────────── weapon trail ───────────────────────── */

const MAX_SAMPLES = 30;
const LIFE = 0.32;

/** Ribbon that follows the edge of a weapon (two points in the weapon group's space) in the model's space. */
export class SkillTrail {
  public mesh: THREE.Mesh;
  private pos = new Float32Array(MAX_SAMPLES * 2 * 3);
  private col = new Float32Array(MAX_SAMPLES * 2 * 4);
  private samples: { a: THREE.Vector3; b: THREE.Vector3; age: number }[] = [];
  private geo = new THREE.BufferGeometry();
  private color = new THREE.Color('#9fe3ff');

  constructor() {
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('color', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    const idx: number[] = [];
    for (let i = 0; i < MAX_SAMPLES - 1; i++) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
    this.geo.setIndex(idx);
    this.mesh = new THREE.Mesh(
      this.geo,
      new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending })
    );
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    this.mesh.renderOrder = 20;
  }

  public setColor(hex: string) {
    this.color.set(hex);
  }

  public clear() {
    this.samples = [];
    this.mesh.visible = false;
  }

  /** Age the samples, optionally add a new one (points already in the trail's parent space) and rebuild the ribbon. */
  public update(dt: number, edge: [THREE.Vector3, THREE.Vector3] | null) {
    this.samples.forEach((s) => (s.age += dt));
    this.samples = this.samples.filter((s) => s.age < LIFE);
    if (edge) this.samples.unshift({ a: edge[0].clone(), b: edge[1].clone(), age: 0 });
    if (this.samples.length > MAX_SAMPLES) this.samples.length = MAX_SAMPLES;
    const n = this.samples.length;
    this.mesh.visible = n > 1;
    if (n < 2) return;
    for (let i = 0; i < MAX_SAMPLES; i++) {
      const s = this.samples[Math.min(i, n - 1)];
      const fade = i < n ? Math.pow(1 - s.age / LIFE, 1.6) : 0;
      this.pos.set([s.a.x, s.a.y, s.a.z, s.b.x, s.b.y, s.b.z], i * 6);
      this.col.set([this.color.r, this.color.g, this.color.b, fade * 0.85, this.color.r, this.color.g, this.color.b, fade * 0.25], i * 8);
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.color.needsUpdate = true;
  }
}

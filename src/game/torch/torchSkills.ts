/**
 * The hero's own skill system. The basic attack is free; every other skill is learned with skill points (one per level), can be
 * raised to rank 5, and from rank 3 can carry one of three runes that change how it behaves. Learned skills are bound to five slots
 * by the player, and six passive talents add to the hero's stats. Pure data and functions (tests/torch-rules.test.mjs).
 */

export type SkillId = 'bolt' | 'whirl' | 'leap' | 'nova' | 'frost' | 'chain' | 'dash' | 'meteor' | 'guard' | 'drain';
export type SkillKind = 'projectile' | 'nova' | 'leap' | 'ring' | 'chain' | 'dash' | 'meteor' | 'guard' | 'drain';

/** What a rune does to the skill it is set in. */
export type RuneEffect = 'power' | 'wide' | 'swift' | 'frugal' | 'vamp' | 'burn' | 'freeze' | 'stun' | 'echo';
export const RUNE_TEXT: Record<RuneEffect, string> = {
  power: '+40% sát thương, tốn thêm 20% năng lượng',
  wide: '+50% phạm vi',
  swift: 'Hồi chiêu nhanh hơn 35%',
  frugal: 'Tiết kiệm 45% năng lượng',
  vamp: 'Hút 12% sát thương gây ra thành máu',
  burn: 'Thiêu đốt: mỗi giây gây thêm 25% trong 4 giây',
  freeze: 'Làm chậm kẻ địch 50% trong 3 giây',
  stun: 'Làm choáng 1,2 giây (trừ trùm)',
  echo: 'Vang vọng: tái xuất sau 0,7 giây với 50% sát thương'
};

export interface SkillDef {
  id: SkillId;
  kind: SkillKind;
  name: string;
  icon: string;
  blurb: string;
  /** Hero level needed to learn it. */
  reqLevel: number;
  cost: number;
  cooldown: number;
  /** Damage as a multiple of the hero's damage stat (per hit; ignored by `guard`). */
  mult: number;
  radius: number;
  range: number;
  color: string;
  /** Seconds the hero is committed to the cast, and when the effect lands. */
  lock: number;
  delay: number;
  anim: number;
  runes: [RuneEffect, RuneEffect, RuneEffect];
  runeNames: [string, string, string];
}

export const SKILLS: Record<SkillId, SkillDef> = {
  bolt: {
    id: 'bolt', kind: 'projectile', name: 'Hỏa cầu', icon: '🔥', blurb: 'Bắn quả cầu lửa xuyên qua mọi kẻ địch trên đường bay.', reqLevel: 1,
    cost: 12, cooldown: 1.1, mult: 1.7, radius: 0.9, range: 16, color: '#ff8a3a', lock: 0.4, delay: 0.2, anim: 2.4,
    runes: ['burn', 'power', 'echo'], runeNames: ['Lửa địa ngục', 'Cầu hủy diệt', 'Cầu song sinh']
  },
  whirl: {
    id: 'whirl', kind: 'nova', name: 'Lốc xoáy', icon: '🌀', blurb: 'Xoay vũ khí, gây sát thương và đẩy lùi kẻ địch xung quanh.', reqLevel: 2,
    cost: 22, cooldown: 4.5, mult: 2.1, radius: 3.6, range: 0, color: '#9fe3ff', lock: 0.6, delay: 0.3, anim: 1.9,
    runes: ['vamp', 'wide', 'swift'], runeNames: ['Lốc hút máu', 'Bão cuốn', 'Gió thần tốc']
  },
  leap: {
    id: 'leap', kind: 'leap', name: 'Nhảy chấn động', icon: '💥', blurb: 'Lao tới chỗ trỏ chuột và đập xuống đất, làm choáng kẻ địch.', reqLevel: 3,
    cost: 28, cooldown: 8, mult: 2.8, radius: 3.2, range: 8, color: '#ffd27a', lock: 0.5, delay: 0.5, anim: 1.9,
    runes: ['stun', 'wide', 'swift'], runeNames: ['Chấn động đất', 'Đại địa chấn', 'Nhảy cấp tốc']
  },
  dash: {
    id: 'dash', kind: 'dash', name: 'Lướt kiếm', icon: '🗡️', blurb: 'Lao thẳng về phía trước, chém mọi kẻ địch trên đường.', reqLevel: 3,
    cost: 18, cooldown: 5, mult: 2.2, radius: 1.5, range: 8, color: '#e8f0ff', lock: 0.35, delay: 0.08, anim: 2.4,
    runes: ['swift', 'power', 'vamp'], runeNames: ['Lướt chớp nhoáng', 'Kiếm khí', 'Lướt hút huyết']
  },
  frost: {
    id: 'frost', kind: 'ring', name: 'Vòng băng', icon: '❄️', blurb: 'Vòng băng lan quanh người, làm chậm và gây sát thương.', reqLevel: 4,
    cost: 26, cooldown: 7, mult: 1.9, radius: 5.5, range: 0, color: '#9fdcff', lock: 0.5, delay: 0.25, anim: 2,
    runes: ['freeze', 'wide', 'echo'], runeNames: ['Băng giá vĩnh cửu', 'Bão tuyết', 'Băng vọng']
  },
  chain: {
    id: 'chain', kind: 'chain', name: 'Sét lan', icon: '⚡', blurb: 'Tia sét đánh kẻ gần nhất rồi nhảy sang 4 kẻ khác.', reqLevel: 5,
    cost: 20, cooldown: 3.2, mult: 1.9, radius: 7, range: 13, color: '#bfd8ff', lock: 0.4, delay: 0.2, anim: 2.3,
    runes: ['stun', 'power', 'echo'], runeNames: ['Sét tê liệt', 'Lôi đình', 'Sét vang']
  },
  drain: {
    id: 'drain', kind: 'drain', name: 'Hấp huyết', icon: '🩸', blurb: 'Rút sinh lực kẻ địch quanh bạn, hồi máu cho mình.', reqLevel: 5,
    cost: 30, cooldown: 9, mult: 1.6, radius: 4.5, range: 0, color: '#d8284a', lock: 0.6, delay: 0.3, anim: 1.9,
    runes: ['wide', 'burn', 'power'], runeNames: ['Hút rộng', 'Huyết thiêu', 'Huyết nộ']
  },
  guard: {
    id: 'guard', kind: 'guard', name: 'Khiên thần', icon: '🛡️', blurb: 'Dựng khiên năng lượng hấp thụ sát thương trong 6 giây.', reqLevel: 7,
    cost: 34, cooldown: 14, mult: 3.2, radius: 2.2, range: 0, color: '#ffe28a', lock: 0.4, delay: 0.1, anim: 2.2,
    runes: ['power', 'swift', 'frugal'], runeNames: ['Khiên kiên cố', 'Khiên mau', 'Khiên tiết kiệm']
  },
  meteor: {
    id: 'meteor', kind: 'meteor', name: 'Thiên thạch', icon: '☄️', blurb: 'Gọi thiên thạch rơi xuống chỗ trỏ chuột sau 1 giây.', reqLevel: 8,
    cost: 48, cooldown: 12, mult: 4.8, radius: 4.2, range: 16, color: '#ff6a2a', lock: 0.5, delay: 0.3, anim: 1.7,
    runes: ['burn', 'wide', 'echo'], runeNames: ['Thiên thạch lửa', 'Đại thiên thạch', 'Mưa sao băng']
  },
  nova: {
    id: 'nova', kind: 'nova', name: 'Lôi bạo', icon: '🌩️', blurb: 'Sấm sét nổ quanh bạn, làm choáng mọi kẻ địch trong vùng.', reqLevel: 6,
    cost: 55, cooldown: 20, mult: 5, radius: 8, range: 0, color: '#8fb8ff', lock: 0.8, delay: 0.5, anim: 1.5,
    runes: ['frugal', 'swift', 'power'], runeNames: ['Lôi bạo tiết kiệm', 'Lôi bạo liên hoàn', 'Thiên lôi']
  }
};
export const SKILL_LIST: SkillId[] = ['bolt', 'whirl', 'leap', 'dash', 'frost', 'chain', 'drain', 'nova', 'guard', 'meteor'];
export const MAX_RANK = 5;
export const RUNE_RANK = 3;

/** Bar slots: the controls that fire a bound skill. */
export const SLOT_KEYS = ['Chuột phải', 'Q', 'E', 'R', 'F'];

export const BASIC = { name: 'Đòn thường', icon: '⚔️', cooldown: 0.55, mult: 1, radius: 2.3, range: 2.4, color: '#ffe6b0', lock: 0.42, delay: 0.22, anim: 2.3, mana: 4 };

/* ───────────────────────── passives ───────────────────────── */

export type PassiveId = 'might' | 'vitality' | 'precision' | 'focus' | 'fleet' | 'haste';
export interface PassiveDef {
  id: PassiveId;
  name: string;
  icon: string;
  /** What one rank adds. */
  text: string;
  reqLevel: number;
}
export const PASSIVES: Record<PassiveId, PassiveDef> = {
  might: { id: 'might', name: 'Sức mạnh', icon: '💪', text: '+4% sát thương mỗi bậc', reqLevel: 1 },
  vitality: { id: 'vitality', name: 'Thể lực', icon: '❤️', text: '+5% máu tối đa mỗi bậc', reqLevel: 1 },
  precision: { id: 'precision', name: 'Chuẩn xác', icon: '🎯', text: '+1,5% chí mạng mỗi bậc', reqLevel: 4 },
  focus: { id: 'focus', name: 'Định thần', icon: '🔮', text: '+0,5 hồi năng lượng/giây mỗi bậc', reqLevel: 4 },
  fleet: { id: 'fleet', name: 'Nhanh nhẹn', icon: '👟', text: '+2,5% tốc độ chạy mỗi bậc', reqLevel: 6 },
  haste: { id: 'haste', name: 'Tốc chiêu', icon: '⏱️', text: '-3% thời gian hồi chiêu mỗi bậc', reqLevel: 8 }
};
export const PASSIVE_LIST: PassiveId[] = ['might', 'vitality', 'precision', 'focus', 'fleet', 'haste'];

export interface PassiveBonus {
  dmgPct: number;
  hpPct: number;
  crit: number;
  mpRegen: number;
  speedPct: number;
  cdr: number;
}

/* ───────────────────────── the book ───────────────────────── */

export interface SkillBook {
  /** Unspent skill points. */
  points: number;
  ranks: Partial<Record<SkillId, number>>;
  /** Index (0..2) of the rune set in each skill, -1 = none. */
  runes: Partial<Record<SkillId, number>>;
  slots: (SkillId | null)[];
  passives: Partial<Record<PassiveId, number>>;
}

export const newBook = (): SkillBook => ({
  points: 1,
  ranks: {},
  runes: {},
  slots: [null, null, null, null, null],
  passives: {}
});

export const rankOf = (b: SkillBook, id: SkillId) => b.ranks[id] ?? 0;
export const passiveRank = (b: SkillBook, id: PassiveId) => b.passives[id] ?? 0;

export function canLearn(b: SkillBook, id: SkillId, level: number): boolean {
  return b.points >= 1 && rankOf(b, id) < MAX_RANK && level >= SKILLS[id].reqLevel;
}

/** Spend a point on a skill (the first rank also puts it in the first free slot). */
export function learn(b: SkillBook, id: SkillId, level: number): boolean {
  if (!canLearn(b, id, level)) return false;
  b.points--;
  const was = rankOf(b, id);
  b.ranks[id] = was + 1;
  if (was === 0) {
    const free = b.slots.indexOf(null);
    if (free >= 0) b.slots[free] = id;
    b.runes[id] = -1;
  }
  return true;
}

export function canLearnPassive(b: SkillBook, id: PassiveId, level: number): boolean {
  return b.points >= 1 && passiveRank(b, id) < MAX_RANK && level >= PASSIVES[id].reqLevel;
}

export function learnPassive(b: SkillBook, id: PassiveId, level: number): boolean {
  if (!canLearnPassive(b, id, level)) return false;
  b.points--;
  b.passives[id] = passiveRank(b, id) + 1;
  return true;
}

/** Choose the rune of a skill (rank 3 or more); -1 removes it. */
export function setRune(b: SkillBook, id: SkillId, index: number): boolean {
  if (rankOf(b, id) < RUNE_RANK || index < -1 || index > 2) return false;
  b.runes[id] = index;
  return true;
}

/** Put a learned skill on a slot (moving it if it was on another one; null empties the slot). */
export function bind(b: SkillBook, slot: number, id: SkillId | null): boolean {
  if (slot < 0 || slot >= b.slots.length) return false;
  if (id) {
    if (rankOf(b, id) < 1) return false;
    const was = b.slots.indexOf(id);
    if (was >= 0) b.slots[was] = b.slots[slot];
  }
  b.slots[slot] = id;
  return true;
}

export function passiveBonus(b: SkillBook): PassiveBonus {
  const r = (id: PassiveId) => passiveRank(b, id);
  return { dmgPct: 0.04 * r('might'), hpPct: 0.05 * r('vitality'), crit: 0.015 * r('precision'), mpRegen: 0.5 * r('focus'), speedPct: 0.025 * r('fleet'), cdr: 0.03 * r('haste') };
}

/* ───────────────────────── what a skill does at its rank and rune ───────────────────────── */

export interface SkillRuntime {
  cost: number;
  cooldown: number;
  mult: number;
  radius: number;
  range: number;
  /** Fraction of the damage dealt that heals the hero. */
  vamp: number;
  /** Burn: share of one hit dealt per second for 4 s. */
  burn: number;
  /** Slow factor (0.5 = half speed) for 3 s, 0 = none. */
  freeze: number;
  stun: number;
  echo: boolean;
}

export const activeRune = (b: SkillBook, id: SkillId): RuneEffect | null =>
  rankOf(b, id) >= RUNE_RANK && (b.runes[id] ?? -1) >= 0 ? SKILLS[id].runes[b.runes[id]!] : null;

export function skillRuntime(b: SkillBook, id: SkillId, extraCdr = 0): SkillRuntime {
  const def = SKILLS[id];
  const up = Math.max(1, rankOf(b, id)) - 1;
  const run: SkillRuntime = {
    cost: def.cost * (1 + 0.04 * up),
    cooldown: def.cooldown * (1 - 0.04 * up),
    mult: def.mult * (1 + 0.18 * up),
    radius: def.radius * (1 + 0.04 * up),
    range: def.range,
    vamp: 0,
    burn: 0,
    freeze: 0,
    stun: 0,
    echo: false
  };
  switch (activeRune(b, id)) {
    case 'power': run.mult *= 1.4; run.cost *= 1.2; break;
    case 'wide': run.radius *= 1.5; run.range *= 1.2; break;
    case 'swift': run.cooldown *= 0.65; break;
    case 'frugal': run.cost *= 0.55; break;
    case 'vamp': run.vamp = 0.12; break;
    case 'burn': run.burn = 0.25; break;
    case 'freeze': run.freeze = 0.5; break;
    case 'stun': run.stun = 1.2; break;
    case 'echo': run.echo = true; break;
  }
  run.cooldown = Math.max(0.4, run.cooldown * (1 - Math.min(0.5, extraCdr)));
  run.cost = Math.round(run.cost);
  return run;
}

/** Points spent so far (skills and passives). */
export const pointsSpent = (b: SkillBook) =>
  Object.values(b.ranks).reduce((s, r) => s + (r ?? 0), 0) + Object.values(b.passives).reduce((s, r) => s + (r ?? 0), 0);

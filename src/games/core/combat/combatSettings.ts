import { readConfiguration, writeConfiguration } from '../../../settings/configurationStore';
import { COMBAT_SLOTS, combatSlot } from './combatCatalog';

/** What fills one animation slot. A null file leaves the slot to the built-in procedural motion. */
export interface CombatSlotConfig {
  file: string | null;
  /** Playback rate on top of the automatic one (1 = as made). Ignored by slots stretched to a game action. */
  speed: number;
  /** Cross-fade (ms) from the previous pose when this slot takes over. */
  blendMs: number;
  mirror: boolean;
  lockFacing: boolean;
  /** Movement speed (m/s) matching the clip's own pace; 0 for clips that do not move. */
  refSpeed: number;
}

/** Procedural layers added on top of the clips (game.md 3.1 Additive Layer). */
export interface CombatTuning {
  /** Share of the view pitch the chest and arms follow (aim offset). */
  aimPitchShare: number;
  /** Largest aim pitch the body follows while prone (degrees). */
  proneAimLimitDeg: number;
  recoilKickDeg: number;
  recoilRecoverMs: number;
  leanAngleDeg: number;
  /** Sideways shift of the eye at full lean (m). */
  leanOffsetM: number;
  leanSpeed: number;
  hitFlinchDeg: number;
  /** Weight of a hit-reaction clip over the upper body (1 = replaces it while it plays). */
  hitWeight: number;
  hitMs: number;
  unequipMs: number;
  /**
   * Third-person camera: behind, right of and above the eye, so the gun shows over the shoulder and the crosshair clears the
   * head; pulled in over the right shoulder while aiming (PUBG style). The lifts are heights above the eye (m).
   */
  cameraDistance: number;
  cameraSide: number;
  cameraLift: number;
  cameraFov: number;
  shoulderDistance: number;
  shoulderSide: number;
  shoulderLift: number;
  shoulderFov: number;
  /** Share of the lean angle the camera rolls by. */
  leanCameraRoll: number;
  /** First person: the body (posed by the clips) moved forward and down from the eye, and tilted, to frame the gun. */
  fpSide: number;
  fpForward: number;
  fpDown: number;
  fpTiltDeg: number;
}

/** Which part of the settings page a tuning value belongs to. */
export type CombatTuningGroup = 'additive' | 'camera';

export interface CombatAnimationSettings {
  /** Off: the battle game uses only the built-in procedural motion. */
  enabled: boolean;
  slots: Record<string, CombatSlotConfig>;
  tuning: CombatTuning;
}

export interface CombatTuningField {
  key: keyof CombatTuning;
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  group: CombatTuningGroup;
}

const additive = (field: Omit<CombatTuningField, 'group'>): CombatTuningField => ({ ...field, group: 'additive' });
const camera = (field: Omit<CombatTuningField, 'group'>): CombatTuningField => ({ ...field, group: 'camera' });

export const COMBAT_TUNING_FIELDS: CombatTuningField[] = [
  additive({ key: 'aimPitchShare', label: 'Thân trên theo góc ngắm', unit: '×', min: 0, max: 1, step: 0.05 }),
  additive({ key: 'proneAimLimitDeg', label: 'Giới hạn góc ngắm khi nằm', unit: '°', min: 0, max: 60, step: 1 }),
  additive({ key: 'recoilKickDeg', label: 'Giật súng mỗi phát', unit: '°', min: 0, max: 15, step: 0.5 }),
  additive({ key: 'recoilRecoverMs', label: 'Hồi giật', unit: 'ms', min: 30, max: 600, step: 10 }),
  additive({ key: 'leanAngleDeg', label: 'Góc nghiêng người', unit: '°', min: 0, max: 30, step: 1 }),
  additive({ key: 'leanOffsetM', label: 'Khoảng nghiêng mắt', unit: 'm', min: 0, max: 0.6, step: 0.01 }),
  additive({ key: 'leanSpeed', label: 'Tốc độ nghiêng', unit: '/s', min: 1, max: 20, step: 0.5 }),
  additive({ key: 'hitFlinchDeg', label: 'Giật người khi trúng đạn', unit: '°', min: 0, max: 25, step: 0.5 }),
  additive({ key: 'hitWeight', label: 'Trọng số clip trúng đạn', unit: '×', min: 0, max: 1, step: 0.05 }),
  additive({ key: 'hitMs', label: 'Thời gian phản ứng trúng đạn', unit: 'ms', min: 100, max: 1500, step: 10 }),
  additive({ key: 'unequipMs', label: 'Thời gian cất súng', unit: 'ms', min: 100, max: 1500, step: 10 }),
  camera({ key: 'cameraDistance', label: 'Khoảng cách camera', unit: 'm', min: 1.2, max: 6, step: 0.05 }),
  camera({ key: 'cameraSide', label: 'Lệch phải', unit: 'm', min: -1.5, max: 1.5, step: 0.01 }),
  camera({ key: 'cameraLift', label: 'Nâng camera', unit: 'm', min: -0.3, max: 1.2, step: 0.01 }),
  camera({ key: 'cameraFov', label: 'Góc nhìn', unit: '°', min: 45, max: 100, step: 1 }),
  camera({ key: 'shoulderDistance', label: 'Khoảng cách khi ngắm qua vai', unit: 'm', min: 0.6, max: 4, step: 0.05 }),
  camera({ key: 'shoulderSide', label: 'Lệch phải khi ngắm', unit: 'm', min: -1.5, max: 1.5, step: 0.01 }),
  camera({ key: 'shoulderLift', label: 'Nâng camera khi ngắm', unit: 'm', min: -0.5, max: 0.8, step: 0.01 }),
  camera({ key: 'shoulderFov', label: 'Góc nhìn khi ngắm', unit: '°', min: 30, max: 90, step: 1 }),
  camera({ key: 'leanCameraRoll', label: 'Camera nghiêng theo người', unit: '×', min: 0, max: 1, step: 0.05 }),
  camera({ key: 'fpSide', label: 'Góc nhìn thứ nhất: đưa súng sang phải', unit: 'm', min: -0.4, max: 0.4, step: 0.01 }),
  camera({ key: 'fpForward', label: 'Góc nhìn thứ nhất: đưa súng ra xa', unit: 'm', min: -0.5, max: 0.5, step: 0.01 }),
  camera({ key: 'fpDown', label: 'Góc nhìn thứ nhất: hạ súng xuống', unit: 'm', min: -0.5, max: 0.5, step: 0.01 }),
  camera({ key: 'fpTiltDeg', label: 'Góc nhìn thứ nhất: nâng súng lên', unit: '°', min: -30, max: 30, step: 0.5 }),
];

export const DEFAULT_COMBAT_TUNING: CombatTuning = {
  aimPitchShare: 1, proneAimLimitDeg: 25, recoilKickDeg: 3.5, recoilRecoverMs: 140, leanAngleDeg: 14, leanOffsetM: 0.32,
  leanSpeed: 8, hitFlinchDeg: 7, hitWeight: 0.65, hitMs: 450, unequipMs: 450,
  cameraDistance: 2, cameraSide: 0.3, cameraLift: 0.3, cameraFov: 74, shoulderDistance: 1.4, shoulderSide: 0.62, shoulderLift: 0.17,
  shoulderFov: 55, leanCameraRoll: 0.6, fpSide: 0.1, fpForward: 0.1, fpDown: -0.1, fpTiltDeg: 0,
};

export const SLOT_SPEED_RANGE = { min: 0.1, max: 3 };
export const SLOT_BLEND_RANGE = { min: 0, max: 1000 };
export const SLOT_REF_SPEED_RANGE = { min: 0, max: 12 };
const DEFAULT_BLEND_MS = 160;
const STORAGE_KEY = 'nams-battle-royal-combat-animations-v1';
const FILE_PATTERN = /^[a-z0-9-]+\.fbx$/i;

export const defaultSlotConfig = (id: string): CombatSlotConfig => {
  const def = combatSlot(id);
  return {
    file: def?.defaultFile ?? null, speed: 1, blendMs: DEFAULT_BLEND_MS, mirror: !!def?.defaultMirror,
    lockFacing: !!def?.lockFacing, refSpeed: def?.refSpeed ?? 0,
  };
};

export const defaultCombatSettings = (): CombatAnimationSettings => ({
  enabled: true,
  slots: Object.fromEntries(COMBAT_SLOTS.map((def) => [def.id, defaultSlotConfig(def.id)])),
  tuning: { ...DEFAULT_COMBAT_TUNING },
});

const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const clampNumber = (value: unknown, range: { min: number; max: number }, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value) ? Math.min(range.max, Math.max(range.min, value)) : fallback;

function normalizeSlot(id: string, value: unknown): CombatSlotConfig {
  const base = defaultSlotConfig(id);
  if (!isRecord(value)) return base;
  const file = value.file === null ? null : typeof value.file === 'string' && FILE_PATTERN.test(value.file) ? value.file : base.file;
  return {
    file,
    speed: clampNumber(value.speed, SLOT_SPEED_RANGE, base.speed),
    blendMs: clampNumber(value.blendMs, SLOT_BLEND_RANGE, base.blendMs),
    mirror: typeof value.mirror === 'boolean' ? value.mirror : base.mirror,
    lockFacing: typeof value.lockFacing === 'boolean' ? value.lockFacing : base.lockFacing,
    refSpeed: clampNumber(value.refSpeed, SLOT_REF_SPEED_RANGE, base.refSpeed),
  };
}

/** Stored data is untrusted: unknown slots are dropped, missing ones get their defaults, numbers are kept within range. */
export function normalizeCombatSettings(value: unknown): CombatAnimationSettings {
  const result = defaultCombatSettings();
  if (!isRecord(value)) return result;
  if (typeof value.enabled === 'boolean') result.enabled = value.enabled;
  const slots = isRecord(value.slots) ? value.slots : {};
  for (const def of COMBAT_SLOTS) result.slots[def.id] = normalizeSlot(def.id, slots[def.id]);
  const tuning = isRecord(value.tuning) ? value.tuning : {};
  for (const field of COMBAT_TUNING_FIELDS) result.tuning[field.key] = clampNumber(tuning[field.key], field, DEFAULT_COMBAT_TUNING[field.key]);
  return result;
}

export const loadCombatSettings = (): CombatAnimationSettings => normalizeCombatSettings(readConfiguration(STORAGE_KEY));

export async function saveCombatSettings(settings: CombatAnimationSettings): Promise<CombatAnimationSettings> {
  const normalized = normalizeCombatSettings(settings);
  await writeConfiguration(STORAGE_KEY, normalized);
  return normalized;
}

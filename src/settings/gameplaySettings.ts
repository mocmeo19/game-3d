import type { AimStyle, Perspective } from '../games/core/aim/aimModes';
import { readConfiguration, writeConfiguration } from './configurationStore';

/** How the shooter games feel in the player's hands; read by the game engine when a match starts. */
export interface GameplaySettings {
  /** Mouse look speed outside aiming (1 = the engine's base speed). */
  cameraSensitivity: number;
  /** Multiplier on the look speed while aiming over the shoulder, down the sights or through a scope. */
  aimSensitivity: number;
  invertY: boolean;
  /** Vertical field of view in first person (degrees). */
  firstPersonFovDeg: number;
  /** View the battle starts in (V switches during the match). */
  startPerspective: Perspective;
  /** Battle Royal right-click: `pubg` (click toggles, hold aims while held) or `hold` (aim only while held). */
  aimStyle: AimStyle;
}

export const CAMERA_SENSITIVITY_RANGE = { min: 0.3, max: 3, step: 0.05 } as const;
export const AIM_SENSITIVITY_RANGE = { min: 0.3, max: 2, step: 0.05 } as const;
export const FIRST_PERSON_FOV_RANGE_DEG = { min: 60, max: 90, step: 1 } as const;

export const DEFAULT_GAMEPLAY_SETTINGS: GameplaySettings = {
  cameraSensitivity: 1,
  aimSensitivity: 1,
  invertY: false,
  firstPersonFovDeg: 74,
  startPerspective: 'tpp',
  aimStyle: 'pubg',
};

const STORAGE_KEY = 'bns.gameplay.v1';
/** The pause menu kept the mouse sensitivity here before the gameplay settings existed. */
const LEGACY_SENSITIVITY_KEY = 'clothes.arena.sens';

const clampedNumber = (value: unknown, range: { min: number; max: number }, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value) ? Math.max(range.min, Math.min(range.max, value)) : fallback;

export function normalizeGameplaySettings(value: unknown): GameplaySettings {
  const source = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const defaults = DEFAULT_GAMEPLAY_SETTINGS;
  return {
    cameraSensitivity: clampedNumber(source.cameraSensitivity, CAMERA_SENSITIVITY_RANGE, defaults.cameraSensitivity),
    aimSensitivity: clampedNumber(source.aimSensitivity, AIM_SENSITIVITY_RANGE, defaults.aimSensitivity),
    invertY: typeof source.invertY === 'boolean' ? source.invertY : defaults.invertY,
    firstPersonFovDeg: Math.round(clampedNumber(source.firstPersonFovDeg, FIRST_PERSON_FOV_RANGE_DEG, defaults.firstPersonFovDeg)),
    startPerspective: source.startPerspective === 'fpp' || source.startPerspective === 'tpp' ? source.startPerspective : defaults.startPerspective,
    aimStyle: source.aimStyle === 'pubg' || source.aimStyle === 'hold' ? source.aimStyle : defaults.aimStyle,
  };
}

function legacySensitivity(): unknown {
  try {
    const raw = localStorage.getItem(LEGACY_SENSITIVITY_KEY);
    return raw === null ? undefined : Number(raw);
  } catch {
    return undefined;
  }
}

let current: GameplaySettings | null = null;

/** Read lazily: the configuration cache is only filled once ConfigurationGate has finished loading. */
export function getGameplaySettings(): GameplaySettings {
  if (current) return current;
  const stored = readConfiguration(STORAGE_KEY);
  current = normalizeGameplaySettings(stored ?? { cameraSensitivity: legacySensitivity() });
  return current;
}

/** The new values are used by the next match only once IndexedDB has committed them. */
export async function saveGameplaySettings(settings: GameplaySettings): Promise<GameplaySettings> {
  const normalized = normalizeGameplaySettings(settings);
  await writeConfiguration(STORAGE_KEY, normalized);
  current = normalized;
  return normalized;
}

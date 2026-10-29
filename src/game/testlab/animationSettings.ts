import { readConfiguration, writeConfiguration } from '../../settings/configurationStore';

/** A bundled clip selected for a role, or the built-in body motion. Missing keys use the manifest defaults. */
export type AnimationSettings = Record<string, string>;

export const BUILTIN_ANIMATION = '__builtin__';
const STORAGE_KEY = 'nams-battle-royal-animation-settings-v1';

export const animationSettingKey = (role: string, ctx: string | null) => `${role}|${ctx ?? 'none'}`;

export function loadAnimationSettings(): AnimationSettings {
  try {
    const value: unknown = readConfiguration(STORAGE_KEY);
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return Object.fromEntries(Object.entries(value).filter(([key, file]) =>
      /^[a-z]+\|(none|rifle|knife|sword)$/.test(key) &&
      (file === BUILTIN_ANIMATION || (typeof file === 'string' && /^[a-z0-9-]+\.fbx$/i.test(file)))
    ));
  } catch {
    return {};
  }
}

export function saveAnimationSettings(settings: AnimationSettings): Promise<void> {
  return writeConfiguration(STORAGE_KEY, settings);
}

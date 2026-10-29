import { readConfiguration, writeConfiguration } from '../../settings/configurationStore';
import type { LabWeapon } from './TestLabEngine';

export interface GameSettings {
  walkSpeed: number;
  runSpeed: number;
  crouchSpeed: number;
  crawlSpeed: number;
  gravity: number;
  jumpSpeed: number;
  cameraFov: number;
  cameraDistance: number;
  mouseSensitivity: number;
  timeScale: number;
  startWeapon: LabWeapon;
  startZone: string;
}

export const DEFAULT_GAME_SETTINGS: GameSettings = {
  walkSpeed: 2.4, runSpeed: 5.4, crouchSpeed: 1.7, crawlSpeed: 1.1,
  gravity: 22, jumpSpeed: 6.4, cameraFov: 55, cameraDistance: 4.2,
  mouseSensitivity: 1, timeScale: 1, startWeapon: 'none', startZone: 'center',
};

export const GAME_NUMBER_FIELDS = [
  { key: 'walkSpeed', label: 'Tốc độ đi', unit: 'm/s', min: 0.5, max: 10, step: 0.1, group: 'Di chuyển & vật lý' },
  { key: 'runSpeed', label: 'Tốc độ chạy', unit: 'm/s', min: 1, max: 20, step: 0.1, group: 'Di chuyển & vật lý' },
  { key: 'crouchSpeed', label: 'Tốc độ đi khom', unit: 'm/s', min: 0.2, max: 8, step: 0.1, group: 'Di chuyển & vật lý' },
  { key: 'crawlSpeed', label: 'Tốc độ bò', unit: 'm/s', min: 0.2, max: 5, step: 0.1, group: 'Di chuyển & vật lý' },
  { key: 'gravity', label: 'Trọng lực', unit: 'm/s²', min: 1, max: 50, step: 0.5, group: 'Di chuyển & vật lý' },
  { key: 'jumpSpeed', label: 'Vận tốc nhảy', unit: 'm/s', min: 1, max: 15, step: 0.1, group: 'Di chuyển & vật lý' },
  { key: 'cameraFov', label: 'Góc nhìn', unit: '°', min: 35, max: 100, step: 1, group: 'Camera' },
  { key: 'cameraDistance', label: 'Khoảng cách ban đầu', unit: 'm', min: 1.6, max: 12, step: 0.1, group: 'Camera' },
  { key: 'mouseSensitivity', label: 'Độ nhạy chuột', unit: '×', min: 0.2, max: 3, step: 0.1, group: 'Camera' },
  { key: 'timeScale', label: 'Tốc độ thời gian', unit: '×', min: 0.1, max: 2, step: 0.1, group: 'Khởi động game' },
] as const;

const STORAGE_KEY = 'nams-testlab-game-settings-v1';
const WEAPON_IDS = ['none', 'class', 'knife', 'usp', 'deagle', 'mp9', 'ak47', 'm4a4', 'awp', 'he'];
const ZONE_IDS = ['center', 'parkour', 'props', 'range'];

export function normalizeGameSettings(value: unknown): GameSettings {
  const result = { ...DEFAULT_GAME_SETTINGS };
  if (!value || typeof value !== 'object' || Array.isArray(value)) return result;
  const source = value as Record<string, unknown>;
  for (const field of GAME_NUMBER_FIELDS) {
    const number = source[field.key];
    if (typeof number === 'number' && Number.isFinite(number)) {
      result[field.key] = Math.min(field.max, Math.max(field.min, number));
    }
  }
  if (typeof source.startWeapon === 'string' && WEAPON_IDS.includes(source.startWeapon)) {
    result.startWeapon = source.startWeapon as LabWeapon;
  }
  if (typeof source.startZone === 'string' && ZONE_IDS.includes(source.startZone)) result.startZone = source.startZone;
  return result;
}

export function loadGameSettings(): GameSettings {
  return normalizeGameSettings(readConfiguration(STORAGE_KEY));
}

export async function saveGameSettings(settings: GameSettings): Promise<GameSettings> {
  const normalized = normalizeGameSettings(settings);
  await writeConfiguration(STORAGE_KEY, normalized);
  return normalized;
}

export function movementSpeed(settings: GameSettings, stance: string, running: boolean): number {
  if (stance === 'prone') return settings.crawlSpeed;
  if (stance === 'crouch') return settings.crouchSpeed;
  if (stance === 'sit' || stance === 'lie') return 0;
  return running ? settings.runSpeed : settings.walkSpeed;
}

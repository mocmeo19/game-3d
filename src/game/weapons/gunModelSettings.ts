import { readConfiguration, writeConfiguration } from '../../settings/configurationStore';
import { WEAPONS, type WeaponId } from '../rules';
import { DEFAULT_GUN_ASSIGNMENTS, GUN_MODELS, gunModel, type GunModelFit } from './gunModelCatalog';

/** Which model each weapon shows (null: the built-in box model), and corrections to each model's fit. */
export interface GunModelSettings {
  assignments: Record<WeaponId, string | null>;
  fits: Record<string, GunModelFit>;
}

export const FIT_FIELDS: { key: 'length' | 'gripAlong' | 'gripHeight' | 'muzzleHeight' | 'supportAlong' | 'supportHeight'; label: string; unit: string; min: number; max: number; step: number }[] = [
  { key: 'length', label: 'Chiều dài thật', unit: 'm', min: 0.05, max: 2.5, step: 0.01 },
  { key: 'gripAlong', label: 'Vị trí tay cầm (sau → trước)', unit: '', min: 0, max: 1, step: 0.01 },
  { key: 'gripHeight', label: 'Độ cao tay cầm (dưới → trên)', unit: '', min: 0, max: 1, step: 0.01 },
  { key: 'muzzleHeight', label: 'Độ cao đầu nòng', unit: '', min: 0, max: 1, step: 0.01 },
  { key: 'supportAlong', label: 'Vị trí tay đỡ (sau → trước)', unit: '', min: 0, max: 1, step: 0.01 },
  { key: 'supportHeight', label: 'Độ cao tay đỡ (dưới → trên)', unit: '', min: 0, max: 1, step: 0.01 },
];

const STORAGE_KEY = 'nams-battle-royal-gun-models-v1';
const WEAPON_IDS = Object.keys(WEAPONS) as WeaponId[];

export const defaultGunModelSettings = (): GunModelSettings => ({
  assignments: { ...DEFAULT_GUN_ASSIGNMENTS },
  fits: Object.fromEntries(GUN_MODELS.map((model) => [model.id, { ...model.fit }])),
});

const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);

function normalizeFit(base: GunModelFit, value: unknown): GunModelFit {
  if (!isRecord(value)) return { ...base };
  const result = { ...base };
  for (const field of FIT_FIELDS) {
    const number = value[field.key];
    if (typeof number === 'number' && Number.isFinite(number)) result[field.key] = Math.min(field.max, Math.max(field.min, number));
  }
  if (typeof value.flipBarrel === 'boolean') result.flipBarrel = value.flipBarrel;
  if (typeof value.flipUp === 'boolean') result.flipUp = value.flipUp;
  return result;
}

/** Stored data is untrusted: unknown weapons and models are dropped, numbers are kept within range. */
export function normalizeGunModelSettings(value: unknown): GunModelSettings {
  const result = defaultGunModelSettings();
  if (!isRecord(value)) return result;
  const assignments = isRecord(value.assignments) ? value.assignments : {};
  for (const id of WEAPON_IDS) {
    const model = assignments[id];
    if (model === null) result.assignments[id] = null;
    else if (typeof model === 'string' && gunModel(model)) result.assignments[id] = model;
  }
  const fits = isRecord(value.fits) ? value.fits : {};
  for (const model of GUN_MODELS) result.fits[model.id] = normalizeFit(model.fit, fits[model.id]);
  return result;
}

export const loadGunModelSettings = (): GunModelSettings => normalizeGunModelSettings(readConfiguration(STORAGE_KEY));

export async function saveGunModelSettings(settings: GunModelSettings): Promise<GunModelSettings> {
  const normalized = normalizeGunModelSettings(settings);
  await writeConfiguration(STORAGE_KEY, normalized);
  return normalized;
}

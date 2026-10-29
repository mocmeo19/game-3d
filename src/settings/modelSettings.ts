import { readConfiguration, writeConfiguration } from './configurationStore';
import type { RaceType } from '../types/character';

export const BODY_MODELS = [
  'jin_female', 'jin_male', 'gon_female', 'gon_male', 'lyn_female', 'lyn_male', 'yun_female',
] as const;
export type BodyModel = typeof BODY_MODELS[number];
export const TAIL_MODELS = [
  'elvs_fluffy_tail_as_clothes_1', 'elvs_cat_tail_as_clothes_1',
  'culturalibre_tigra_tail', 'culturalibre_cl_devil_tail',
] as const;
export const RACE_NAMES: Record<RaceType, string> = { jin: 'Jin', gon: 'Gon', lyn: 'Lyn', yun: 'Yun' };
export interface ModelSettings {
  bodies: Record<BodyModel, BodyModel>;
  raceScale: Record<RaceType, number>;
  lynFluffyTail: string;
  lynSlenderTail: string;
}
export const DEFAULT_MODEL_SETTINGS: ModelSettings = {
  bodies: {
    jin_female: 'jin_female', jin_male: 'jin_male', gon_female: 'gon_female', gon_male: 'gon_male',
    lyn_female: 'lyn_female', lyn_male: 'lyn_male', yun_female: 'yun_female',
  },
  raceScale: { jin: 1, gon: 1.1, lyn: 0.76, yun: 1.05 },
  lynFluffyTail: 'elvs_fluffy_tail_as_clothes_1', lynSlenderTail: 'elvs_cat_tail_as_clothes_1',
};
const STORAGE_KEY = 'bns.model-settings.v1';
const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};

export function normalizeModelSettings(value: unknown): ModelSettings {
  const source = record(value);
  const bodies = { ...DEFAULT_MODEL_SETTINGS.bodies };
  const raceScale = { ...DEFAULT_MODEL_SETTINGS.raceScale };
  for (const key of BODY_MODELS) {
    const model = record(source.bodies)[key];
    if (BODY_MODELS.some((id) => id === model) && typeof model === 'string'
      && model.split('_')[1] === key.split('_')[1]) bodies[key] = model as BodyModel;
  }
  for (const race of Object.keys(RACE_NAMES) as RaceType[]) {
    const scale = record(source.raceScale)[race];
    if (typeof scale === 'number' && Number.isFinite(scale)) raceScale[race] = Math.max(0.5, Math.min(1.5, scale));
  }
  const tail = (value: unknown, fallback: string) => TAIL_MODELS.find((id) => id === value) ?? fallback;
  return {
    bodies, raceScale,
    lynFluffyTail: tail(source.lynFluffyTail, DEFAULT_MODEL_SETTINGS.lynFluffyTail),
    lynSlenderTail: tail(source.lynSlenderTail, DEFAULT_MODEL_SETTINGS.lynSlenderTail),
  };
}

export function loadModelSettings(): ModelSettings {
  return normalizeModelSettings(readConfiguration(STORAGE_KEY));
}
let current = loadModelSettings();
export const getModelSettings = () => current;
export async function saveModelSettings(settings: ModelSettings): Promise<ModelSettings> {
  const normalized = normalizeModelSettings(settings);
  await writeConfiguration(STORAGE_KEY, normalized);
  current = normalized;
  return normalized;
}

export function baseModelKey(race: string, gender: string, settings = current): BodyModel {
  const key = `${race}_${gender === 'male' ? 'male' : 'female'}`;
  const slot = BODY_MODELS.find((model) => model === key) ?? (gender === 'male' ? 'jin_male' : 'jin_female');
  return settings.bodies[slot];
}
export const raceScale = (race: RaceType, settings = current) => settings.raceScale[race];

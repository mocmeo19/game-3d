import { readConfiguration } from '../settings/configurationStore';

export interface AudioSettings { muted: boolean; music: number; effects: number }
export interface AudioSaveState { saving: boolean; error: string }
export const AUDIO_KEY = 'bns.audio.v1';

export function readAudioSettings(): AudioSettings {
  const value = readConfiguration(AUDIO_KEY);
  const saved = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const level = (value: unknown, fallback: number) => typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.min(1, value)) : fallback;
  return { muted: saved.muted === true, music: level(saved.music, 0.35), effects: level(saved.effects, 0.7) };
}

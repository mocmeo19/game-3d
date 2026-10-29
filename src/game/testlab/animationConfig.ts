import type { LabSnapshot, MixCtx, MixRole } from './TestLabEngine';
import { animationSettingKey, BUILTIN_ANIMATION, type AnimationSettings } from './animationSettings';

export type AnimationClip = LabSnapshot['mixamo'][number];
export const MOVEMENT_ROLES: MixRole[] = ['walk', 'run', 'runback', 'runleft', 'crouchwalk', 'crawl'];
export const POSTURE_ROLES: MixRole[] = ['idle', 'crouch', 'proneidle', 'sit', 'lie'];
export const ACTION_ROLES: MixRole[] = ['jump', 'roll', 'vault', 'climb'];
const FALLBACK: Partial<Record<MixRole, MixRole[]>> = {
  run: ['walk'], runback: ['run', 'walk'], runleft: ['run', 'walk'], vault: ['jump'],
  throwrun: ['throw'], throwcrouch: ['throw'],
};

export function resolveAnimation<T extends { role: MixRole | null; ctx: MixCtx; file: string | null }>(
  clips: T[], settings: AnimationSettings, role: MixRole, ctx: MixCtx,
): T | null {
  for (const candidate of [role, ...(FALLBACK[role] ?? [])]) {
    const selected = (ctx ? settings[animationSettingKey(candidate, ctx)] : undefined)
      ?? settings[animationSettingKey(candidate, null)];
    if (selected === BUILTIN_ANIMATION) return null;
    if (selected) {
      const clip = clips.find((entry) => entry.file === selected);
      if (clip) return clip;
    }
    const clip = (ctx ? clips.find((entry) => entry.role === candidate && entry.ctx === ctx) : null)
      ?? clips.find((entry) => entry.role === candidate && entry.ctx === null);
    if (clip) return clip;
  }
  return null;
}

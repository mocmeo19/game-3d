import { readConfiguration, writeConfiguration } from './configurationStore';
import type { WebGLRenderer } from 'three';

export interface RenderSettings { pixelRatio: number; shadows: boolean; antialias: boolean }
export const DEFAULT_RENDER_SETTINGS: RenderSettings = { pixelRatio: 2, shadows: true, antialias: true };
const STORAGE_KEY = 'bns.render-settings.v1';

export function normalizeRenderSettings(value: unknown): RenderSettings {
  const source = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const ratio = source.pixelRatio;
  return {
    pixelRatio: typeof ratio === 'number' && Number.isFinite(ratio) ? Math.max(0.75, Math.min(2, ratio)) : 2,
    shadows: typeof source.shadows === 'boolean' ? source.shadows : true,
    antialias: typeof source.antialias === 'boolean' ? source.antialias : true,
  };
}
export function loadRenderSettings(): RenderSettings {
  return normalizeRenderSettings(readConfiguration(STORAGE_KEY));
}
let current = loadRenderSettings();
export const getRenderSettings = () => current;
export async function saveRenderSettings(settings: RenderSettings): Promise<RenderSettings> {
  const normalized = normalizeRenderSettings(settings);
  await writeConfiguration(STORAGE_KEY, normalized);
  current = normalized;
  return normalized;
}
export function rendererPixelRatio(sceneLimit = 2): number {
  return Math.min(globalThis.devicePixelRatio || 1, sceneLimit, current.pixelRatio);
}
export function configureRenderer(renderer: WebGLRenderer, sceneLimit = 2): void {
  renderer.setPixelRatio(rendererPixelRatio(sceneLimit));
  renderer.shadowMap.enabled = current.shadows;
}

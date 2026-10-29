import { useSyncExternalStore } from 'react';
import { readConfiguration, writeConfiguration } from '../settings/configurationStore';

export const PERFORMANCE_OVERLAY_CORNERS = ['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const;
export type PerformanceOverlayCorner = typeof PERFORMANCE_OVERLAY_CORNERS[number];

export interface PerformanceOverlaySettings {
  isVisible: boolean;
  corner: PerformanceOverlayCorner;
}

export const DEFAULT_PERFORMANCE_OVERLAY_SETTINGS: PerformanceOverlaySettings = { isVisible: false, corner: 'top-right' };
const STORAGE_KEY = 'bns.performance-overlay.v1';

const isCorner = (value: unknown): value is PerformanceOverlayCorner =>
  typeof value === 'string' && (PERFORMANCE_OVERLAY_CORNERS as readonly string[]).includes(value);

export function normalizePerformanceOverlaySettings(value: unknown): PerformanceOverlaySettings {
  const source = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return {
    isVisible: typeof source.isVisible === 'boolean' ? source.isVisible : DEFAULT_PERFORMANCE_OVERLAY_SETTINGS.isVisible,
    corner: isCorner(source.corner) ? source.corner : DEFAULT_PERFORMANCE_OVERLAY_SETTINGS.corner,
  };
}

let current: PerformanceOverlaySettings | null = null;
const listeners = new Set<() => void>();

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
/** Read lazily: the configuration cache is only filled once ConfigurationGate has finished loading. */
const getSettings = (): PerformanceOverlaySettings => {
  current ??= normalizePerformanceOverlaySettings(readConfiguration(STORAGE_KEY));
  return current;
};

/** Applies the change everywhere only once IndexedDB has committed it. */
export async function savePerformanceOverlaySettings(settings: PerformanceOverlaySettings): Promise<void> {
  const normalized = normalizePerformanceOverlaySettings(settings);
  await writeConfiguration(STORAGE_KEY, normalized);
  current = normalized;
  listeners.forEach((listener) => listener());
}

export const usePerformanceOverlaySettings = () => useSyncExternalStore(subscribe, getSettings, getSettings);

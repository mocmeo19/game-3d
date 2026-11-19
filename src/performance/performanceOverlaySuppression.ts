import { useEffect, useSyncExternalStore } from 'react';

type Listener = () => void;
const listeners = new Set<Listener>();
let suppressorCount = 0;

function changeSuppressorCount(delta: number): void {
  suppressorCount += delta;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const isSuppressed = (): boolean => suppressorCount > 0;

/** Hides the FPS/RAM stats while the calling screen is mounted, without changing the user's saved setting. */
export function useSuppressPerformanceOverlay(): void {
  useEffect(() => {
    changeSuppressorCount(1);
    return () => changeSuppressorCount(-1);
  }, []);
}

export function useIsPerformanceOverlaySuppressed(): boolean {
  return useSyncExternalStore(subscribe, isSuppressed, isSuppressed);
}

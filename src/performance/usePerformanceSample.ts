import { useEffect, useState } from 'react';

const SAMPLE_INTERVAL_MS = 500;
const BYTES_PER_MEGABYTE = 1048576;

export interface PerformanceSample {
  framesPerSecond: number;
  /** JS heap in use; null where the browser does not expose it (only Chromium does). */
  usedHeapMegabytes: number | null;
}

function readUsedHeapMegabytes(): number | null {
  if (!('memory' in performance)) return null;
  const memory: unknown = performance.memory;
  if (!memory || typeof memory !== 'object' || !('usedJSHeapSize' in memory)) return null;
  const used = memory.usedJSHeapSize;
  return typeof used === 'number' ? used / BYTES_PER_MEGABYTE : null;
}

/** Counts animation frames and reads the heap, publishing to React only twice a second. */
export function usePerformanceSample(): PerformanceSample {
  const [sample, setSample] = useState<PerformanceSample>(() => ({ framesPerSecond: 0, usedHeapMegabytes: readUsedHeapMegabytes() }));

  useEffect(() => {
    let frameCount = 0;
    let sampleStart = performance.now();
    let frameId = 0;
    const countFrame = (now: number) => {
      frameCount++;
      const elapsedMs = now - sampleStart;
      if (elapsedMs >= SAMPLE_INTERVAL_MS) {
        setSample({ framesPerSecond: Math.round((frameCount * 1000) / elapsedMs), usedHeapMegabytes: readUsedHeapMegabytes() });
        frameCount = 0;
        sampleStart = now;
      }
      frameId = requestAnimationFrame(countFrame);
    };
    frameId = requestAnimationFrame(countFrame);
    return () => cancelAnimationFrame(frameId);
  }, []);

  return sample;
}

import type { PerformanceOverlayCorner } from './performanceOverlaySettings';
import { usePerformanceSample } from './usePerformanceSample';

const CORNER_CLASSES: Record<PerformanceOverlayCorner, string> = {
  'top-left': 'top-1.5 left-1.5',
  'top-right': 'top-1.5 right-1.5',
  'bottom-left': 'bottom-1.5 left-1.5',
  'bottom-right': 'bottom-1.5 right-1.5',
};

export function PerformanceStatsPanel({ corner }: { corner: PerformanceOverlayCorner }) {
  const { framesPerSecond, usedHeapMegabytes } = usePerformanceSample();
  return (
    <aside
      aria-label="Thông số hiệu năng"
      className={`pointer-events-none fixed z-1000 flex gap-3 rounded-sm border border-white/15 bg-[#081116]/75 px-2.5 py-1.5 font-mono text-[10px] leading-tight text-[#d3e0e1] tabular-nums backdrop-blur-xs ${CORNER_CLASSES[corner]}`}
    >
      <span><b className="text-xs text-[#a8e8b2]">{framesPerSecond}</b> FPS</span>
      <span><b className="text-xs text-[#a8e8b2]">{usedHeapMegabytes === null ? '—' : usedHeapMegabytes.toFixed(0)}</b> MB RAM</span>
    </aside>
  );
}

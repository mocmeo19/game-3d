import { usePerformanceOverlaySettings } from './performanceOverlaySettings';
import { PerformanceStatsPanel } from './PerformanceStatsPanel';
import { useIsPerformanceOverlaySuppressed } from './performanceOverlaySuppression';

/** Mounted once at the app root; the frame counter only runs while the stats are switched on. */
export function PerformanceOverlay() {
  const { isVisible, corner } = usePerformanceOverlaySettings();
  const isSuppressed = useIsPerformanceOverlaySuppressed();
  if (!isVisible || isSuppressed) return null;
  return <PerformanceStatsPanel corner={corner} />;
}

import { usePerformanceOverlaySettings } from './performanceOverlaySettings';
import { PerformanceStatsPanel } from './PerformanceStatsPanel';

/** Mounted once at the app root; the frame counter only runs while the stats are switched on. */
export function PerformanceOverlay() {
  const { isVisible, corner } = usePerformanceOverlaySettings();
  if (!isVisible) return null;
  return <PerformanceStatsPanel corner={corner} />;
}

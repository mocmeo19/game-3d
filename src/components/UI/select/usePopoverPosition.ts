import { useLayoutEffect, useState, type CSSProperties, type RefObject } from 'react';

const GAP_PX = 4;
const EDGE_PX = 8;
const MIN_WIDTH_PX = 200;
const MAX_HEIGHT_PX = 320;
/** Below this much room under the anchor the list opens upwards when there is more room above. */
const MIN_ROOM_BELOW_PX = 220;

/**
 * Where a popup list opens next to its anchor, in viewport coordinates (it is rendered in a portal, so no scrolling container or
 * overflow clips it). Re-measured on scroll and resize while open, at most once per frame.
 */
export function usePopoverPosition(anchor: RefObject<HTMLElement | null>, open: boolean): CSSProperties {
  const [style, setStyle] = useState<CSSProperties>({ visibility: 'hidden' });
  useLayoutEffect(() => {
    if (!open) return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const element = anchor.current;
      if (!element) return;
      const rect = element.getBoundingClientRect();
      const viewWidth = window.innerWidth;
      const viewHeight = window.innerHeight;
      const width = Math.min(Math.max(rect.width, MIN_WIDTH_PX), viewWidth - EDGE_PX * 2);
      const left = Math.min(Math.max(rect.left, EDGE_PX), viewWidth - width - EDGE_PX);
      const below = viewHeight - rect.bottom - GAP_PX - EDGE_PX;
      const above = rect.top - GAP_PX - EDGE_PX;
      const upwards = below < MIN_ROOM_BELOW_PX && above > below;
      const maxHeight = Math.min(MAX_HEIGHT_PX, upwards ? above : below);
      setStyle(upwards
        ? { position: 'fixed', left, width, maxHeight, bottom: viewHeight - rect.top + GAP_PX }
        : { position: 'fixed', left, width, maxHeight, top: rect.bottom + GAP_PX });
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener('scroll', schedule, true);
    window.addEventListener('resize', schedule);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule, true);
      window.removeEventListener('resize', schedule);
    };
  }, [anchor, open]);
  return style;
}

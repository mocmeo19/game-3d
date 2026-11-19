import type { FrameRateCap } from '../../../settings/renderSettings';

/** A frame arriving this much early still counts as on time, so a 60 FPS cap on a 60 Hz screen does not drop frames to jitter. */
const FRAME_TIMING_TOLERANCE_MS = 2;

/** Skips animation frames so the game draws at most `cap` frames a second (the GPU rests in between). */
export class FrameRateLimiter {
  private readonly intervalMs: number;
  private nextFrameAtMs = 0;

  constructor(cap: FrameRateCap) {
    this.intervalMs = cap === 'unlimited' ? 0 : 1000 / cap;
  }

  /** `timeMs`: the requestAnimationFrame timestamp. */
  shouldDraw(timeMs: number): boolean {
    if (this.intervalMs === 0) return true;
    if (timeMs < this.nextFrameAtMs - FRAME_TIMING_TOLERANCE_MS) return false;
    // after a stall the schedule restarts from now instead of rushing frames to catch up
    this.nextFrameAtMs = Math.max(this.nextFrameAtMs + this.intervalMs, timeMs);
    return true;
  }
}

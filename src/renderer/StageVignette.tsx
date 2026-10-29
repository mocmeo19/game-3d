import type { CSSProperties } from 'react';

/** CSS variable (set on an ancestor) with the character's horizontal place on screen; the bright middle of the vignette follows it. */
export const STAGE_FOCUS_X_VAR = '--stage-focus-x';

/**
 * Darkened edges over the 3D stage so the character stands out from the backdrop: a layer drawn on top of the canvas, clear
 * around the character and fading to dark towards the borders. The backdrop pictures themselves are untouched.
 */
const VIGNETTE: CSSProperties = {
  background: [
    `radial-gradient(ellipse 46% 68% at var(${STAGE_FOCUS_X_VAR}, 50%) 50%, rgba(0,0,0,0) 0%, rgba(0,0,0,0) 42%, rgba(0,0,0,0.32) 72%, rgba(0,0,0,0.68) 100%)`,
    'linear-gradient(to bottom, rgba(0,0,0,0.28) 0%, rgba(0,0,0,0) 18%, rgba(0,0,0,0) 78%, rgba(0,0,0,0.35) 100%)',
  ].join(', '),
};

export function StageVignette() {
  return <div aria-hidden="true" className="absolute inset-0 z-1 pointer-events-none" style={VIGNETTE} />;
}

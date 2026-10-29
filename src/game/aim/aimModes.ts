/**
 * Aim modes (aim.md 3.1) and how the right mouse button moves between them, PUBG style:
 * - a quick click (shorter than AIM_HOLD_S) toggles aiming down the sights (ADS); clicking again leaves it,
 * - holding the button aims while held: over the shoulder in third person, down the sights in first person,
 * - anything that takes the gun out of a firing grip (sprinting, reloading, a jump, a weapon switch, death) drops the aim.
 * The 5 vs 5 mode keeps its plain hold-to-aim style. Pure logic: no three.js, no DOM.
 */

export type AimMode = 'FPP_HIP' | 'TPP_HIP' | 'TPP_SHOULDER' | 'ADS';
export type Perspective = 'fpp' | 'tpp';
/** `pubg`: click toggles ADS, hold aims while held. `hold`: aim only while the button is held, never toggles. */
export type AimStyle = 'pubg' | 'hold';

/** A press shorter than this is a click (toggles ADS); longer is a hold (aims while held). */
export const AIM_HOLD_S = 0.2;

export interface AimFrame {
  now: number;
  /** Right mouse button (or the touch aim button) is down. */
  pressed: boolean;
  perspective: Perspective;
  /** The player could aim right now: alive, a gun in a firing grip, not sprinting, reloading, airborne or in a menu. */
  canAim: boolean;
  style: AimStyle;
}

const hip = (perspective: Perspective): AimMode => (perspective === 'fpp' ? 'FPP_HIP' : 'TPP_HIP');

export class AimController {
  private adsLatched = false;
  private pressAt: number | null = null;
  /** The current press was spent leaving ADS: it neither aims while held nor toggles on release. */
  private pressSpent = false;
  private wasPressed = false;
  private current: AimMode = 'TPP_HIP';

  get mode() {
    return this.current;
  }

  update(f: AimFrame): AimMode {
    if (f.pressed && !this.wasPressed) {
      this.pressAt = f.now;
      this.pressSpent = this.adsLatched;
      this.adsLatched = false;
    } else if (!f.pressed && this.wasPressed) {
      const click = this.pressAt !== null && f.now - this.pressAt < AIM_HOLD_S;
      if (click && !this.pressSpent && f.style === 'pubg' && f.canAim) this.adsLatched = true;
      this.pressAt = null;
      this.pressSpent = false;
    }
    this.wasPressed = f.pressed;
    if (!f.canAim) this.adsLatched = false;
    const holding = f.pressed && this.pressAt !== null && !this.pressSpent && (f.style === 'hold' || f.now - this.pressAt >= AIM_HOLD_S);
    if (!f.canAim) this.current = hip(f.perspective);
    else if (this.adsLatched) this.current = 'ADS';
    else if (holding) this.current = f.perspective === 'tpp' ? 'TPP_SHOULDER' : 'ADS';
    else this.current = hip(f.perspective);
    return this.current;
  }

  /** Back to the hip at once (a new round, respawn, death). */
  reset(perspective: Perspective) {
    this.adsLatched = false;
    this.pressAt = null;
    this.pressSpent = false;
    this.wasPressed = false;
    this.current = hip(perspective);
  }
}

export type GunGrip = 'pistol' | 'smg' | 'rifle' | 'sniper';

/** Seconds to raise each kind of gun to the sights (aim.md 3.3: the transition time depends on the weapon). */
const ADS_SECONDS: Record<GunGrip, number> = { pistol: 0.14, smg: 0.17, rifle: 0.22, sniper: 0.3 };
/** Over the shoulder is a camera move, quicker than shouldering the gun. */
const SHOULDER_SECONDS = 0.16;

export const transitionSeconds = (mode: AimMode, grip: GunGrip) => (mode === 'ADS' ? ADS_SECONDS[grip] : SHOULDER_SECONDS);

/** Spread multiplier by aim mode: the sights steady the gun, the shoulder a little (PUBG's hip, aim and ADS spread). */
const SPREAD_FACTOR: Record<AimMode, number> = { FPP_HIP: 1, TPP_HIP: 1, TPP_SHOULDER: 0.8, ADS: 0.55 };

export const aimSpreadFactor = (mode: AimMode) => SPREAD_FACTOR[mode];

/** Walking speed is cut while aiming down the sights. */
export const slowsMovement = (mode: AimMode) => mode === 'ADS';

/** The gun is raised (aiming animation, raised upper body) in these modes. */
export const isAiming = (mode: AimMode) => mode === 'TPP_SHOULDER' || mode === 'ADS';

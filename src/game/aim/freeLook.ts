/**
 * Free look (PUBG: hold Alt): the mouse turns the camera around the character while the body keeps facing where it was, so the
 * player can look behind or aside while running. On release the view eases back to the body's facing.
 */

const MAX_YAW = (150 * Math.PI) / 180;
const MAX_PITCH = (70 * Math.PI) / 180;
/** 1/s: how fast the view swings back to the body after the key is let go. */
const RETURN_RATE = 10;

export class FreeLook {
  /** Camera turn away from the body (rad, + = left, as yaw). */
  yaw = 0;
  pitch = 0;
  private active = false;

  /** `held`: the free-look key is down and free look is allowed (not aiming, alive). */
  update(dt: number, held: boolean) {
    this.active = held;
    if (held) return;
    const k = 1 - Math.exp(-RETURN_RATE * dt);
    this.yaw -= this.yaw * k;
    this.pitch -= this.pitch * k;
    if (Math.abs(this.yaw) < 1e-4) this.yaw = 0;
    if (Math.abs(this.pitch) < 1e-4) this.pitch = 0;
  }

  /** Mouse turn (rad) while free looking; returns false when the body should take it instead. */
  take(dYaw: number, dPitch: number) {
    if (!this.active) return false;
    this.yaw = Math.max(-MAX_YAW, Math.min(MAX_YAW, this.yaw + dYaw));
    this.pitch = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, this.pitch + dPitch));
    return true;
  }

  reset() {
    this.yaw = this.pitch = 0;
    this.active = false;
  }
}

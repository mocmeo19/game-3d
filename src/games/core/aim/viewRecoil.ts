/**
 * The recoil the player's view shows (PUBG style): the camera climbs with the gun's punch over a few frames instead of jumping a
 * step per bullet, and each shot adds a small roll shake. Shots are aimed from the punch shown here, so the crosshair stays true;
 * the roll never moves the crosshair. Pure logic: no three.js, no DOM.
 */

/** 1/s: how fast the shown punch chases the gun's punch (about 90% of the way in 80 ms). */
const FOLLOW_RATE = 28;
/** Roll (rad) one shot shakes the view by, and how fast (1/s) that shake dies away. */
const SHAKE_ROLL = 0.012;
const SHAKE_DECAY = 18;
/** The shake never piles up past this (rad), however fast the gun fires. */
const MAX_SHAKE_ROLL = 0.03;

export class ViewRecoil {
  /** Punch the view shows now (rad, [yaw right, pitch up]). */
  readonly shown: [number, number] = [0, 0];
  private roll = 0;

  /** Ease the shown punch towards the gun's current punch. */
  update(dt: number, target: readonly [number, number]) {
    const k = 1 - Math.exp(-FOLLOW_RATE * dt);
    this.shown[0] += (target[0] - this.shown[0]) * k;
    this.shown[1] += (target[1] - this.shown[1]) * k;
    this.roll *= Math.exp(-SHAKE_DECAY * dt);
  }

  /** A shot: shake the view to a random side. */
  kick(random: () => number = Math.random) {
    const side = random() < 0.5 ? -1 : 1;
    const roll = this.roll + side * SHAKE_ROLL * (0.6 + 0.4 * random());
    this.roll = Math.max(-MAX_SHAKE_ROLL, Math.min(MAX_SHAKE_ROLL, roll));
  }

  /** Roll (rad) to add to the camera. */
  get shakeRoll() {
    return this.roll;
  }

  /** Straight back to no recoil (a new round, respawn). */
  reset() {
    this.shown[0] = this.shown[1] = 0;
    this.roll = 0;
  }
}

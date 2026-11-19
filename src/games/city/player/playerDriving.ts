import * as THREE from 'three';
import { angleDiff, type Agent } from '../../core/agents/agent';
import type { CityMap } from '../map/cityWorld';
import type { Vehicle } from '../vehicles/Vehicle';
import type { CityGear } from './cityGear';

/** The keys the wheel listens to (the shared movement keys). */
export interface DriveKeys {
  has(action: string): boolean;
}

/** Fastest the player can be going to step out (m/s). */
export const EXIT_SPEED = 3;
const CAMERA_LIFT = 1.35;
const CAMERA_FOV = 68;
const CAMERA_HEIGHT = 1.1;
/** After the mouse turns the view, it stays put this long before swinging back behind the car (s). */
const LOOK_HOLD_S = 1.6;
const RECENTRE_RATE = 2.5;
const CAMERA_WALL_GAP = 0.4;
const CAMERA_GROUND_GAP = 0.6;
/** Where to try to put the player down beside the car: left door, right door, behind, in front. */
const EXIT_SIDES: [number, number][] = [[-1, 0], [1, 0], [0, 1], [0, -1]];

/** The player at the wheel: getting in and out, the wheel and pedals from the keys, and the chase camera. */
export class PlayerDriving {
  vehicle: Vehicle | null = null;
  private lookYaw = 0;
  private lookedAt = -99;
  private readonly target = new THREE.Vector3();
  private readonly back = new THREE.Vector3();

  constructor(
    private readonly map: CityMap,
    private readonly gear: CityGear,
  ) {}

  get isDriving() {
    return this.vehicle !== null;
  }

  enter(player: Agent, vehicle: Vehicle) {
    this.vehicle = vehicle;
    vehicle.driver = 'player';
    this.gear.isDriving = true;
    player.vel.set(0, 0, 0);
    player.yaw = vehicle.state.heading;
    player.pitch = -0.12;
    this.lookYaw = player.yaw;
    this.follow(player);
  }

  /** Steps out beside the car if one side is free; false when the car is too fast or boxed in. */
  exit(player: Agent, isBlocked: (x: number, z: number, y: number) => boolean): boolean {
    const v = this.vehicle;
    if (!v) return false;
    if (Math.abs(v.state.speed) > EXIT_SPEED && !v.isWrecked) return false;
    const s = v.state;
    const fx = -Math.sin(s.heading);
    const fz = -Math.cos(s.heading);
    const rx = Math.cos(s.heading);
    const rz = -Math.sin(s.heading);
    for (const [side, along] of EXIT_SIDES) {
      const reach = side ? v.spec.width / 2 + 0.9 : v.spec.length / 2 + 0.9;
      const x = s.x + rx * side * reach - fx * along * reach;
      const z = s.z + rz * side * reach - fz * along * reach;
      if (isBlocked(x, z, s.y)) continue;
      player.pos.set(x, this.map.groundAt(x, z), z);
      player.yaw = s.heading;
      player.pitch = 0;
      player.onGround = true;
      v.driver = 'none';
      this.vehicle = null;
      this.gear.isDriving = false;
      return true;
    }
    return false;
  }

  /** Thrown out of a wreck or on death: no free side needed. */
  eject(player: Agent) {
    const v = this.vehicle;
    if (!v) return;
    v.driver = 'none';
    this.vehicle = null;
    this.gear.isDriving = false;
    player.pos.set(v.state.x + Math.cos(v.state.heading) * (v.spec.width / 2 + 0.8), v.state.y, v.state.z - Math.sin(v.state.heading) * (v.spec.width / 2 + 0.8));
  }

  /** Wheel and pedals from the movement keys: W / S, A / D, Space for the handbrake. */
  steer(keys: DriveKeys) {
    const v = this.vehicle;
    if (!v) return;
    v.controls.throttle = (keys.has('forward') ? 1 : 0) - (keys.has('back') ? 1 : 0);
    v.controls.steer = (keys.has('right') ? 1 : 0) - (keys.has('left') ? 1 : 0);
    v.controls.handbrake = keys.has('jump');
  }

  /** Keeps the player's body with the car (radar, police and missions read the player's position). */
  follow(player: Agent) {
    const v = this.vehicle;
    if (!v) return;
    player.pos.set(v.state.x, v.state.y + 0.4, v.state.z);
    player.vel.set(0, 0, 0);
    player.onGround = true;
  }

  /**
   * Chase camera behind the car. The mouse turns it (the player's view angles); a while after the mouse stops it swings
   * back behind the car. It stays above the ground and in front of walls between it and the car.
   */
  placeCamera(player: Agent, camera: THREE.PerspectiveCamera, now: number, dt: number) {
    const v = this.vehicle;
    if (!v) return;
    if (Math.abs(angleDiff(player.yaw, this.lookYaw)) > 1e-4) this.lookedAt = now;
    if (now - this.lookedAt > LOOK_HOLD_S && Math.abs(v.state.speed) > 1) {
      const behind = v.state.speed >= 0 ? v.state.heading : v.state.heading + Math.PI;
      player.yaw += angleDiff(behind, player.yaw) * Math.min(1, RECENTRE_RATE * dt);
      player.pitch += (-0.12 - player.pitch) * Math.min(1, RECENTRE_RATE * dt);
    }
    player.pitch = THREE.MathUtils.clamp(player.pitch, -0.7, 0.35);
    this.lookYaw = player.yaw;
    const distance = 3.2 + v.spec.length;
    this.target.set(v.state.x, v.state.y + CAMERA_LIFT, v.state.z);
    this.back.set(Math.sin(player.yaw) * Math.cos(player.pitch), -Math.sin(player.pitch) + CAMERA_HEIGHT / distance, Math.cos(player.yaw) * Math.cos(player.pitch)).normalize();
    const hit = this.map.terrain.rayHit(this.target.x, this.target.y, this.target.z, this.back.x, this.back.y, this.back.z, distance);
    const reach = hit === null ? distance : Math.max(1.2, hit - CAMERA_WALL_GAP);
    camera.position.copy(this.target).addScaledVector(this.back, reach);
    camera.position.y = Math.max(camera.position.y, this.map.groundAt(camera.position.x, camera.position.z) + CAMERA_GROUND_GAP);
    if (Math.abs(camera.fov - CAMERA_FOV) > 0.01) {
      camera.fov = CAMERA_FOV;
      camera.updateProjectionMatrix();
    }
    camera.lookAt(this.target);
  }
}

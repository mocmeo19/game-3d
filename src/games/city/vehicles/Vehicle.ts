import * as THREE from 'three';
import type { Solid } from '../../core/rules';
import type { VehicleBody } from './vehicleMesh';
import { footprint, type VehicleControls, type VehicleState } from './vehiclePhysics';
import type { VehicleSpec } from './vehicleSpecs';

/** Who moves a car: nobody (parked), the player, or the city's drivers (traffic, police, a mission's runaway). */
export type DriverKind = 'none' | 'player' | 'ai';

/** Black smoke tint a wrecked body takes. */
const WRECK_TINT = 0x232323;
const SIREN_HZ = 3;

let nextVehicleId = 1;

/** A car in the city: its physics state, its body in the scene and its damage. */
export class Vehicle {
  readonly id = nextVehicleId++;
  health: number;
  driver: DriverKind = 'none';
  sirenOn = false;
  /** Mission or job cars are kept when the player drives away; traffic is recycled. */
  isKept = false;
  /** What the driver asks of the car this frame (the fleet steps the physics with it). */
  readonly controls: VehicleControls = { throttle: 0, steer: 0, handbrake: false };
  private wheelSpin = 0;
  private readonly bodyBox: Solid = { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } };

  constructor(
    readonly spec: VehicleSpec,
    readonly paint: number,
    readonly state: VehicleState,
    readonly body: VehicleBody,
  ) {
    this.health = spec.health;
    body.group.userData.vehicleId = this.id;
  }

  get isWrecked() {
    return this.health <= 0;
  }

  get position() {
    return this.state;
  }

  /** Damage in health points; the car is wrecked at 0 and its body goes dark. */
  damage(points: number) {
    if (this.isWrecked || points <= 0) return;
    this.health = Math.max(0, this.health - points);
    if (!this.isWrecked) return;
    this.state.speed = 0;
    this.sirenOn = false;
    this.body.group.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      // the body's materials are shared with other cars: a wreck gets its own dark one
      mesh.material = new THREE.MeshStandardMaterial({ color: WRECK_TINT, roughness: 0.95 });
    });
  }

  /** The axis-aligned box around the car, for walkers, bullets and the camera (refreshed in `sync`). */
  get solid(): Solid {
    return this.bodyBox;
  }

  /** Moves the body to the physics state and animates wheels and siren. */
  sync(dt: number, timeS: number) {
    const s = this.state;
    const g = this.body.group;
    g.position.set(s.x, s.y, s.z);
    g.rotation.set(0, 0, 0);
    g.rotateY(s.heading);
    g.rotateX(s.pitch);
    this.wheelSpin -= (s.speed / this.body.wheelRadius) * dt;
    for (const wheel of this.body.wheels) wheel.rotation.x = this.wheelSpin;
    for (const pivot of this.body.frontWheels) pivot.rotation.y = -s.steer * 0.5;
    if (this.body.sirens) {
      const on = this.sirenOn && !this.isWrecked;
      const phase = Math.sin(timeS * Math.PI * 2 * SIREN_HZ) > 0;
      const [red, blue] = this.body.sirens;
      (red.material as THREE.MeshStandardMaterial).emissiveIntensity = on && phase ? 3 : 0.2;
      (blue.material as THREE.MeshStandardMaterial).emissiveIntensity = on && !phase ? 3 : 0.2;
    }
    let minX = Infinity;
    let minZ = Infinity;
    let maxX = -Infinity;
    let maxZ = -Infinity;
    for (const [x, z] of footprint(s, this.spec, -0.15)) {
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minZ = Math.min(minZ, z);
      maxZ = Math.max(maxZ, z);
    }
    this.bodyBox.min.x = minX;
    this.bodyBox.min.y = s.y;
    this.bodyBox.min.z = minZ;
    this.bodyBox.max.x = maxX;
    this.bodyBox.max.y = s.y + this.spec.height;
    this.bodyBox.max.z = maxZ;
  }
}

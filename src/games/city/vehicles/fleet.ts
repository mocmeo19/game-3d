import type { Agent } from '../../core/agents/agent';
import { disposeTree } from '../../core/models';
import type { Solid } from '../../core/rules';
import type { CityMap } from '../map/cityWorld';
import { Vehicle } from './Vehicle';
import { VehicleMeshFactory } from './vehicleMesh';
import { insideFootprint, newVehicleState, stepVehicle, type DriveSurface } from './vehiclePhysics';
import { pickPaint, VEHICLES, type VehicleKind } from './vehicleSpecs';

/** Health a car loses per m/s of speed lost against a wall or another car above a soft knock. */
const DAMAGE_PER_IMPACT = 2.2;
const SOFT_IMPACT = 4;
/** A car hits people at more than this speed (m/s). */
const RUN_OVER_SPEED = 3.5;
const RUN_OVER_DAMAGE_PER_MS = 9;
/** Cars are pushed apart as two circles each (front and back half). */
const CAR_RESTITUTION = 0.3;

/** What happens to people a car runs into. */
export type RunOverHandler = (vehicle: Vehicle, victim: Agent, damage: number) => void;

/**
 * Every car in the city: spawns and removes their bodies, steps the physics with what their drivers ask, keeps them apart,
 * runs people over and lends their boxes to walkers, bullets and the camera.
 */
export class VehicleFleet {
  readonly vehicles: Vehicle[] = [];
  private readonly meshes = new VehicleMeshFactory();
  private readonly surface: DriveSurface;

  constructor(private readonly map: CityMap) {
    this.surface = {
      groundAt: (x, z) => map.groundAt(x, z),
      blocksAt: (x, z, y) => !!map.terrain.blocksStep?.(x, z, y),
    };
  }

  spawn(kind: VehicleKind, x: number, z: number, heading: number, random: () => number, paint?: number): Vehicle {
    const spec = VEHICLES[kind];
    const color = paint ?? pickPaint(spec, random);
    const body = this.meshes.build(spec, color);
    const vehicle = new Vehicle(spec, color, newVehicleState(x, this.map.groundAt(x, z), z, heading), body);
    this.map.scene.add(body.group);
    this.vehicles.push(vehicle);
    vehicle.sync(0, 0);
    return vehicle;
  }

  remove(vehicle: Vehicle) {
    const i = this.vehicles.indexOf(vehicle);
    if (i < 0) return;
    this.vehicles.splice(i, 1);
    vehicle.body.group.removeFromParent();
    // shared geometry and paint stay with the factory; only a wreck's own materials go
    if (vehicle.isWrecked) disposeTree(vehicle.body.group);
  }

  /** The nearest working car within `reach` (m) of x/z that the player could get into. */
  nearestEnterable(x: number, z: number, reach: number): Vehicle | null {
    let best: Vehicle | null = null;
    let bestD = reach;
    for (const v of this.vehicles) {
      if (v.isWrecked || v.driver === 'player') continue;
      const d = Math.hypot(v.state.x - x, v.state.z - z) - v.spec.length / 2;
      if (d < bestD) {
        bestD = d;
        best = v;
      }
    }
    return best;
  }

  step(dt: number, timeS: number, agents: readonly Agent[], onRunOver: RunOverHandler) {
    for (const v of this.vehicles) {
      if (v.isWrecked || v.driver === 'none') {
        v.controls.throttle = 0;
        v.controls.steer = 0;
        v.controls.handbrake = true;
      }
      const { impact } = stepVehicle(v.state, v.spec, v.controls, dt, this.surface);
      if (impact > SOFT_IMPACT) v.damage((impact - SOFT_IMPACT) * DAMAGE_PER_IMPACT);
    }
    this.separate();
    this.runOver(agents, onRunOver);
    for (const v of this.vehicles) v.sync(dt, timeS);
  }

  /** Pushes overlapping cars apart and trades their speed along the push (with some lost as damage). */
  private separate() {
    const list = this.vehicles;
    for (let i = 0; i < list.length; i++)
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        const reach = (a.spec.length + b.spec.length) / 2 + 0.5;
        if (Math.abs(a.state.x - b.state.x) > reach || Math.abs(a.state.z - b.state.z) > reach) continue;
        for (const ca of this.circles(a))
          for (const cb of this.circles(b)) {
            const dx = cb.x - ca.x;
            const dz = cb.z - ca.z;
            const d = Math.hypot(dx, dz);
            const min = ca.r + cb.r;
            if (d >= min || d < 1e-4) continue;
            const nx = dx / d;
            const nz = dz / d;
            const push = (min - d) / 2;
            a.state.x -= nx * push;
            a.state.z -= nz * push;
            b.state.x += nx * push;
            b.state.z += nz * push;
            const closing = this.velocityAlong(a, nx, nz) - this.velocityAlong(b, nx, nz);
            if (closing <= 0) continue;
            a.state.speed -= closing * (1 + CAR_RESTITUTION) * 0.5 * this.forwardShare(a, nx, nz);
            b.state.speed += closing * (1 + CAR_RESTITUTION) * 0.5 * this.forwardShare(b, nx, nz);
            if (closing > SOFT_IMPACT) {
              a.damage((closing - SOFT_IMPACT) * DAMAGE_PER_IMPACT * 0.6);
              b.damage((closing - SOFT_IMPACT) * DAMAGE_PER_IMPACT * 0.6);
            }
          }
      }
  }

  private circles(v: Vehicle) {
    const s = v.state;
    const r = v.spec.width / 2 + 0.05;
    const off = v.spec.length / 2 - r;
    const fx = -Math.sin(s.heading) * off;
    const fz = -Math.cos(s.heading) * off;
    return [
      { x: s.x + fx, z: s.z + fz, r },
      { x: s.x - fx, z: s.z - fz, r },
    ];
  }

  /** How much of the car's heading lies along a direction (signed). */
  private forwardShare(v: Vehicle, nx: number, nz: number) {
    return -Math.sin(v.state.heading) * nx + -Math.cos(v.state.heading) * nz;
  }

  private velocityAlong(v: Vehicle, nx: number, nz: number) {
    return v.state.speed * this.forwardShare(v, nx, nz);
  }

  private runOver(agents: readonly Agent[], onRunOver: RunOverHandler) {
    for (const v of this.vehicles) {
      const speed = Math.abs(v.state.speed);
      if (speed < RUN_OVER_SPEED) continue;
      for (const a of agents) {
        if (!a.alive || a.gear?.isAboard || Math.abs(a.pos.y - v.state.y) > 2) continue;
        if (!insideFootprint(v.state, v.spec, a.pos.x, a.pos.z, 0.35)) continue;
        // thrown clear ahead of the bumper, so one pass hits once
        const fx = -Math.sin(v.state.heading) * Math.sign(v.state.speed);
        const fz = -Math.cos(v.state.heading) * Math.sign(v.state.speed);
        a.pos.x += fx * (v.spec.length / 2 + 0.8);
        a.pos.z += fz * (v.spec.length / 2 + 0.8);
        a.vel.set(fx * speed * 0.6, 3, fz * speed * 0.6);
        a.onGround = false;
        v.state.speed *= 0.85;
        onRunOver(v, a, speed * RUN_OVER_DAMAGE_PER_MS);
      }
    }
  }

  /** The cars' boxes as solids for walkers, bullets and the camera, leaving out the car the player sits in. */
  writeSolids(into: Solid[]) {
    into.length = 0;
    for (const v of this.vehicles) if (v.driver !== 'player') into.push(v.solid);
  }

  dispose() {
    for (const v of [...this.vehicles]) this.remove(v);
    this.meshes.dispose();
  }
}

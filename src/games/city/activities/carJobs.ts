import type { P2 } from '../../core/agents/nav';
import { distance2d } from '../map/streetSampling';
import type { Vehicle } from '../vehicles/Vehicle';
import type { VehicleKind } from '../vehicles/vehicleSpecs';

/** Cars the delivery job asks for. */
export const JOB_KINDS: readonly VehicleKind[] = ['sports', 'suv', 'sedan'];
export const JOB_MIN_M = 350;
export const JOB_MAX_M = 800;
const BASE_PAY = 500;
/** Pay for a car without a scratch on top of the base. */
const CONDITION_PAY = 900;
const DROP_REACH_M = 12;
const DROP_SPEED = 6;

export type CarJobEvent = { kind: 'paid'; cash: number } | { kind: 'lost' };

/**
 * The delivery job at the car yard: a customer wants a certain car, which waits parked somewhere across town. Bring it back
 * to the yard; the pay depends on what is left of it.
 */
export class CarJobs {
  vehicle: Vehicle | null = null;

  get isActive() {
    return this.vehicle !== null;
  }

  begin(vehicle: Vehicle) {
    vehicle.isKept = true;
    this.vehicle = vehicle;
  }

  update(playerCar: Vehicle | null, yard: P2): CarJobEvent | null {
    const v = this.vehicle;
    if (!v) return null;
    if (v.isWrecked) {
      this.vehicle = null;
      v.isKept = false;
      return { kind: 'lost' };
    }
    if (playerCar !== v || distance2d(v.state, yard) > DROP_REACH_M || Math.abs(v.state.speed) > DROP_SPEED) return null;
    this.vehicle = null;
    v.isKept = false;
    return { kind: 'paid', cash: Math.round(BASE_PAY + CONDITION_PAY * (v.health / v.spec.health)) };
  }

  cancel() {
    if (this.vehicle) this.vehicle.isKept = false;
    this.vehicle = null;
  }
}

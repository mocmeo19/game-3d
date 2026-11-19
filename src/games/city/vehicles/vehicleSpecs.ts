/** The cars of the city: size, handling and paint per kind. Pure data, no three.js. */

export type VehicleKind = 'sedan' | 'hatch' | 'suv' | 'sports' | 'van' | 'taxi' | 'police';

export interface VehicleSpec {
  kind: VehicleKind;
  name: string;
  /** Body size (m). */
  length: number;
  width: number;
  height: number;
  /** Top speed forward (m/s). */
  topSpeed: number;
  /** Acceleration from standstill (m/s²). */
  accel: number;
  /** Braking deceleration (m/s²). */
  brake: number;
  /** Turn rate at full lock and town speed (rad/s). */
  turnRate: number;
  health: number;
  /** Paints a car of this kind is sold in (picked at random). */
  paints: readonly number[];
}

const CIVIL_PAINTS = [0xb8bcc2, 0x23262b, 0xe9e7e1, 0x7a1f22, 0x1f3f6b, 0x3f5a3a, 0x8c8072, 0x5a6470] as const;

export const VEHICLES: Record<VehicleKind, VehicleSpec> = {
  sedan: { kind: 'sedan', name: 'Sedan Thiên Mã', length: 4.6, width: 1.85, height: 1.45, topSpeed: 38, accel: 6.5, brake: 12, turnRate: 1.9, health: 100, paints: CIVIL_PAINTS },
  hatch: { kind: 'hatch', name: 'Hatchback Én Nhỏ', length: 3.9, width: 1.75, height: 1.5, topSpeed: 33, accel: 6, brake: 11, turnRate: 2.2, health: 85, paints: [0xd8452f, 0xf0c64a, 0x3c8fd0, 0xe9e7e1, 0x2c2c2c] },
  suv: { kind: 'suv', name: 'SUV Hổ Vằn', length: 4.9, width: 2.0, height: 1.85, topSpeed: 35, accel: 5.5, brake: 11, turnRate: 1.6, health: 140, paints: [0x1d1f22, 0xe9e7e1, 0x4d5a4a, 0x6b5340] },
  sports: { kind: 'sports', name: 'Siêu xe Phượng Lửa', length: 4.5, width: 1.95, height: 1.2, topSpeed: 52, accel: 10, brake: 15, turnRate: 2.1, health: 80, paints: [0xd11f1f, 0xf2c200, 0x1d1f22, 0xff7a00, 0x1d6be0] },
  van: { kind: 'van', name: 'Xe tải nhỏ Bò Rừng', length: 5.3, width: 2.05, height: 2.3, topSpeed: 30, accel: 4.2, brake: 9, turnRate: 1.4, health: 160, paints: [0xe9e7e1, 0x6e7a85, 0x2d4a6e] },
  taxi: { kind: 'taxi', name: 'Taxi Vàng', length: 4.6, width: 1.85, height: 1.45, topSpeed: 37, accel: 6.3, brake: 12, turnRate: 1.9, health: 100, paints: [0xf3c623] },
  police: { kind: 'police', name: 'Xe tuần tra', length: 4.8, width: 1.95, height: 1.5, topSpeed: 46, accel: 8.5, brake: 14, turnRate: 2.0, health: 150, paints: [0x14181f] },
};

/** How often each kind turns up in traffic (police come only with a wanted level). */
export const TRAFFIC_MIX: readonly [VehicleKind, number][] = [
  ['sedan', 5],
  ['hatch', 3],
  ['suv', 3],
  ['taxi', 2],
  ['van', 2],
  ['sports', 1],
];

export function pickTrafficKind(random: () => number): VehicleKind {
  const total = TRAFFIC_MIX.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = random() * total;
  for (const [kind, weight] of TRAFFIC_MIX) if ((roll -= weight) <= 0) return kind;
  return TRAFFIC_MIX[0][0];
}

export const pickPaint = (spec: VehicleSpec, random: () => number) => spec.paints[Math.floor(random() * spec.paints.length)] ?? spec.paints[0];

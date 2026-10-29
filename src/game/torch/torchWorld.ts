/**
 * The open world of the Torchlight mode: a village in the middle, four zones in rings around it (each tougher than the last),
 * and monster camps scattered through them. Pure data and functions (no rendering) so they can be tested on their own.
 */

export type ZoneId = 'village' | 'meadow' | 'forest' | 'swamp' | 'volcano';

export interface Zone {
  id: ZoneId;
  name: string;
  /** Distance from the village centre where the zone starts and ends. */
  rIn: number;
  rOut: number;
  /** Monster level at the inner and outer edge. */
  lvMin: number;
  lvMax: number;
  /** Ground colour, fog and sky of the zone. */
  ground: string;
  fog: number;
  sky: number;
  /** Monster names by kind, and the tint their bodies take. */
  names: { grunt: string; archer: string; brute: string; boss: string };
  tint: number;
  /** Relative odds of grunt / archer in an ordinary camp. */
  mix: { grunt: number; archer: number };
  /** Camps in the zone (the boss camp is extra). */
  camps: number;
}

export const WORLD_HALF = 170;
export const VILLAGE_R = 20;

export const ZONES: Record<ZoneId, Zone> = {
  village: {
    id: 'village', name: 'Làng Hỏa Đăng', rIn: 0, rOut: VILLAGE_R, lvMin: 1, lvMax: 1, ground: '#8a7a5a', fog: 0xb9cfe0, sky: 0xa9cdee,
    names: { grunt: '', archer: '', brute: '', boss: '' }, tint: 0, mix: { grunt: 1, archer: 0 }, camps: 0
  },
  meadow: {
    id: 'meadow', name: 'Đồng Cỏ Khởi Nguyên', rIn: VILLAGE_R, rOut: 70, lvMin: 1, lvMax: 5, ground: '#59883f', fog: 0xb4cfe2, sky: 0xa4caea,
    names: { grunt: 'Yêu tinh đồng cỏ', archer: 'Cung thủ xương', brute: 'Quỷ đá', boss: 'Yêu Vương Đồng Cỏ' }, tint: 0x6f9a44, mix: { grunt: 3, archer: 1 }, camps: 15
  },
  forest: {
    id: 'forest', name: 'Rừng U Ám', rIn: 70, rOut: 110, lvMin: 6, lvMax: 12, ground: '#34573a', fog: 0x587a6c, sky: 0x7ea192,
    names: { grunt: 'Yêu rừng', archer: 'Cung thủ ma', brute: 'Cự thú rừng sâu', boss: 'Sói Quỷ Nanh Đêm' }, tint: 0x3f7a62, mix: { grunt: 2, archer: 1 }, camps: 18
  },
  swamp: {
    id: 'swamp', name: 'Đầm Lầy Độc', rIn: 110, rOut: 140, lvMin: 12, lvMax: 18, ground: '#55512f', fog: 0x75724c, sky: 0x8a8458,
    names: { grunt: 'Xác sống đầm lầy', archer: 'Xạ thủ độc', brute: 'Quái bùn', boss: 'Hắc Thủy Mẫu' }, tint: 0x8a6fa0, mix: { grunt: 2, archer: 1 }, camps: 14
  },
  volcano: {
    id: 'volcano', name: 'Núi Lửa Tro Tàn', rIn: 140, rOut: 240, lvMin: 18, lvMax: 30, ground: '#3e2c28', fog: 0x6b3426, sky: 0x5a2a20,
    names: { grunt: 'Quỷ lửa', archer: 'Pháp sư tro', brute: 'Cự quỷ dung nham', boss: 'Quỷ Vương Hắc Hỏa' }, tint: 0xc4553a, mix: { grunt: 3, archer: 2 }, camps: 16
  }
};
export const ZONE_ORDER: ZoneId[] = ['village', 'meadow', 'forest', 'swamp', 'volcano'];

/** Where the village stands and where a defeated hero wakes up. */
export const SPAWN = { x: 0, z: 6 };

/** Distance to the village centre, bent by the direction so zone borders wander instead of forming perfect circles. */
export function zoneDistance(x: number, z: number): number {
  const r = Math.hypot(x, z);
  const a = Math.atan2(z, x);
  return r + 4.5 * Math.sin(a * 3 + 1) + 2.5 * Math.sin(a * 7 + 2) * Math.min(1, r / 60);
}

export function zoneAt(x: number, z: number): Zone {
  const d = zoneDistance(x, z);
  for (const id of ZONE_ORDER) if (d < ZONES[id].rOut) return ZONES[id];
  return ZONES.volcano;
}

/** Monster level at a spot: rises smoothly from the inner to the outer edge of its zone. */
export function levelAt(x: number, z: number): number {
  const zone = zoneAt(x, z);
  if (zone.id === 'village') return 1;
  const k = Math.max(0, Math.min(1, (zoneDistance(x, z) - zone.rIn) / (zone.rOut - zone.rIn)));
  return Math.max(1, Math.round(zone.lvMin + k * (zone.lvMax - zone.lvMin)));
}

export const inVillage = (x: number, z: number) => zoneDistance(x, z) < VILLAGE_R - 2;

/* ───────────────────────── monster camps ───────────────────────── */

export interface Camp {
  id: number;
  x: number;
  z: number;
  zone: ZoneId;
  level: number;
  /** Ordinary monsters in the camp (a boss camp adds the boss on top). */
  size: number;
  boss: boolean;
  /** An ordinary camp whose leader is a stronger "champion". */
  champion: boolean;
}

const lcg = (seed: number) => () => {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
};

/** The same camps every time: a fixed seed lays out the world. */
export function generateCamps(seed = 8841): Camp[] {
  const r = lcg(seed);
  const camps: Camp[] = [];
  const free = (x: number, z: number, gap: number) => camps.every((c) => Math.hypot(c.x - x, c.z - z) >= gap);
  const limit = WORLD_HALF - 8;
  for (const id of ZONE_ORDER) {
    if (id === 'village') continue;
    const zone = ZONES[id];
    // one boss camp near the far edge of each zone, in a direction of its own
    const ba = r() * Math.PI * 2;
    for (let t = 0; t < 60; t++) {
      const rad = Math.min(zone.rOut - 9 - r() * 4, limit * 1.1);
      const x = Math.cos(ba + t * 0.15) * rad;
      const z = Math.sin(ba + t * 0.15) * rad;
      if (Math.abs(x) > limit || Math.abs(z) > limit || zoneAt(x, z).id !== id) continue;
      camps.push({ id: camps.length, x, z, zone: id, level: levelAt(x, z) + 1, size: 4, boss: true, champion: false });
      break;
    }
    let made = 0;
    for (let tries = 0; tries < 900 && made < zone.camps; tries++) {
      const a = r() * Math.PI * 2;
      // uniform over the ring's area
      const outer = Math.min(zone.rOut, 215);
      const rad = Math.sqrt(zone.rIn * zone.rIn + r() * (outer * outer - zone.rIn * zone.rIn));
      const x = Math.cos(a) * rad;
      const z = Math.sin(a) * rad;
      if (Math.abs(x) > limit || Math.abs(z) > limit) continue;
      if (zoneAt(x, z).id !== id || !free(x, z, 17) || Math.hypot(x, z) < VILLAGE_R + 9) continue;
      camps.push({ id: camps.length, x, z, zone: id, level: levelAt(x, z), size: 3 + Math.floor(r() * 3), boss: false, champion: r() < 0.22 });
      made++;
    }
  }
  return camps;
}

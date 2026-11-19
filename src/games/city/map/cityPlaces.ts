import type { P2 } from '../../core/agents/nav';
import type { CityGround } from './cityAssets';

/** The named spots every city map has (missions, shops and services refer to them by id); each map places them itself. */
export const PLACE_NAMES = {
  hideout: 'Gara Xóm Nam',
  downtown: 'Trung tâm',
  plaza: 'Bãi xe Quảng trường',
  dome: 'Mái vòm',
  expo: 'Khu Hội chợ',
  interchange: 'Nút giao Xoắn',
  riverside: 'Bờ sông Đông',
  westPark: 'Công viên Tây',
  northwest: 'Khu Tây Bắc',
  arena: 'Nhà thi đấu tròn',
  pawnShop: 'Tiệm cầm đồ Lâm',
  vyLoft: 'Gác xép của Tú',
  hospital: 'Bệnh viện Thiên Lộc',
  policeHq: 'Sở cảnh sát',
  gunShopWest: 'Tiệm súng Phía Tây',
  gunShopNorth: 'Tiệm súng Phía Bắc',
  paintShop: 'Xưởng sơn xe',
  storeA: 'Tạp hoá Ngã Tư',
  storeB: 'Cửa hàng 24h Mái vòm',
  storeC: 'Siêu thị mini Hội chợ',
  storeD: 'Tạp hoá Công viên',
  storeE: 'Quán đêm Xóm Nam',
  jobGarage: 'Bãi giao xe',
} as const;

export type PlaceId = keyof typeof PLACE_NAMES;

export const PLACE_IDS = Object.keys(PLACE_NAMES) as PlaceId[];

/**
 * The places on the Dallas photo map, read off its top-down picture. They are rough on purpose: each is moved onto the
 * nearest open street cell when the city loads, so a spot that lands on a roof still ends up somewhere reachable.
 */
export const DALLAS_PLACES: Record<PlaceId, P2> = {
  hideout: { x: -932, z: 828 },
  downtown: { x: 272, z: -546 },
  plaza: { x: -150, z: -92 },
  dome: { x: -129, z: -610 },
  expo: { x: 928, z: -335 },
  interchange: { x: 209, z: 363 },
  riverside: { x: 1456, z: 658 },
  westPark: { x: -1630, z: 659 },
  northwest: { x: -1165, z: -567 },
  arena: { x: -742, z: -673 },
  pawnShop: { x: -1060, z: -320 },
  vyLoft: { x: 420, z: -620 },
  hospital: { x: -636, z: 67 },
  policeHq: { x: 632, z: 24 },
  gunShopWest: { x: -425, z: 236 },
  gunShopNorth: { x: 420, z: -715 },
  paintShop: { x: -1313, z: 490 },
  storeA: { x: -1060, z: -187 },
  storeB: { x: -2, z: -863 },
  storeC: { x: 737, z: -145 },
  storeD: { x: -1482, z: 1081 },
  storeE: { x: -214, z: 975 },
  jobGarage: { x: 526, z: 658 },
};

/** Farthest (m) a place is moved to reach an open street cell. */
const SNAP_SEARCH_M = 120;

/** The open street cell nearest to a point, searched ring by ring outward; the point itself when nothing is open nearby. */
export function snapToStreet(ground: CityGround, p: P2, needDrive = false): P2 {
  const { grid, masks } = ground;
  const mask = needDrive ? masks.drive : masks.walk;
  const c0 = grid.col(p.x);
  const r0 = grid.row(p.z);
  const maxRing = Math.ceil(SNAP_SEARCH_M / grid.cellM);
  for (let ring = 0; ring <= maxRing; ring++) {
    let best = -1;
    let bestD = Infinity;
    for (let dr = -ring; dr <= ring; dr++)
      for (let dc = -ring; dc <= ring; dc++) {
        if (Math.max(Math.abs(dr), Math.abs(dc)) !== ring) continue;
        const c = c0 + dc;
        const r = r0 + dr;
        if (!grid.inside(c, r)) continue;
        const k = r * grid.cols + c;
        if (!mask[k]) continue;
        const d = dr * dr + dc * dc;
        if (d < bestD) {
          bestD = d;
          best = k;
        }
      }
    if (best >= 0) return { x: grid.centreX(best % grid.cols), z: grid.centreZ(Math.floor(best / grid.cols)) };
  }
  return p;
}

/** Every place moved onto the street (done once when the city loads). */
export function snapPlaces(ground: CityGround, places: Record<PlaceId, P2>): Record<PlaceId, P2> {
  const out = {} as Record<PlaceId, P2>;
  for (const id of PLACE_IDS) out[id] = snapToStreet(ground, places[id]);
  return out;
}

/** The name of the named place nearest to x/z within `withinM`, or the city's name. */
export function placeNameNear(places: Record<PlaceId, P2>, x: number, z: number, withinM = 260): string {
  let best = 'Thành phố Thiên Lộc';
  let bestD = withinM;
  for (const id of PLACE_IDS) {
    const d = Math.hypot(places[id].x - x, places[id].z - z);
    if (d < bestD) {
      bestD = d;
      best = PLACE_NAMES[id];
    }
  }
  return best;
}

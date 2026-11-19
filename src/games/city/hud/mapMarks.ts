import type { BlipKind } from '../citySnapshot';

/** How each kind of map mark looks: its colour and the glyph inside it. */
export const BLIP_STYLE: Record<BlipKind, { color: string; glyph: string; name: string }> = {
  mission: { color: '#f5c542', glyph: '★', name: 'Nhiệm vụ' },
  objective: { color: '#f5d742', glyph: '◆', name: 'Mục tiêu' },
  enemy: { color: '#e5483b', glyph: '●', name: 'Kẻ địch' },
  target: { color: '#4fc3f7', glyph: '▲', name: 'Xe mục tiêu' },
  police: { color: '#3d7bff', glyph: '●', name: 'Cảnh sát' },
  gunShop: { color: '#d9d4c7', glyph: '⌖', name: 'Tiệm súng' },
  hospital: { color: '#ff6b81', glyph: '+', name: 'Bệnh viện' },
  store: { color: '#7bd88f', glyph: '$', name: 'Cửa hàng (cướp được)' },
  job: { color: '#c58cff', glyph: '⚑', name: 'Việc giao xe' },
  paint: { color: '#ffa94d', glyph: '◎', name: 'Xưởng sơn xe' },
  waypoint: { color: '#c77dff', glyph: '⬤', name: 'Điểm đến' },
};

/** Minimap reach (m from the player to the edge): wider at speed so the road ahead is seen. */
export const minimapReach = (speedKmh: number) => 130 + Math.min(1, speedKmh / 120) * 120;

/**
 * A world point on the turning minimap: relative to the player, turned so the view direction points up, in metres.
 * Points past `reach` are pulled in to the edge (they show where to go).
 */
export function toMinimap(me: { x: number; z: number; yaw: number }, x: number, z: number, reach: number) {
  const dx = x - me.x;
  const dz = z - me.z;
  const c = Math.cos(me.yaw);
  const s = Math.sin(me.yaw);
  let mx = dx * c - dz * s;
  let my = dx * s + dz * c;
  const d = Math.hypot(mx, my);
  const isEdge = d > reach;
  if (isEdge) {
    mx = (mx / d) * reach;
    my = (my / d) * reach;
  }
  return { x: mx, y: my, isEdge };
}

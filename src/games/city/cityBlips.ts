import type { Agent } from '../core/agents/agent';
import type { P2 } from '../core/agents/nav';
import { PLACE_NAMES, type PlaceId } from './map/cityPlaces';
import type { MapBlip } from './citySnapshot';
import type { MissionTarget } from './story/missionRunner';
import type { Mission } from './story/missionTypes';
import { PROTAGONISTS } from './story/protagonists';

/** Everything the maps can mark this moment. */
export interface BlipSources {
  place(id: PlaceId): P2;
  /** Story missions that can be started (shown only when none is being played). */
  missions: readonly Mission[];
  missionActive: boolean;
  targets: readonly MissionTarget[];
  police: readonly Agent[];
  openStores: readonly PlaceId[];
  jobTarget: P2 | null;
  waypoint: P2 | null;
}

const SERVICE_BLIPS: readonly [PlaceId, MapBlip['kind']][] = [
  ['gunShopWest', 'gunShop'],
  ['gunShopNorth', 'gunShop'],
  ['hospital', 'hospital'],
  ['paintShop', 'paint'],
  ['jobGarage', 'job'],
];

const TARGET_BLIP: Record<MissionTarget['kind'], MapBlip['kind']> = { enemy: 'enemy', vehicle: 'target', objective: 'objective' };

/** The marks of the minimap and the big map: services, open shops, mission markers or targets, police, the waypoint. */
export function collectBlips(src: BlipSources): MapBlip[] {
  const blips: MapBlip[] = [];
  const atPlace = (id: PlaceId, kind: MapBlip['kind'], label: string = PLACE_NAMES[id], letter?: string) => {
    const p = src.place(id);
    blips.push({ id: `${kind}-${id}`, kind, x: p.x, z: p.z, label, letter });
  };
  for (const [id, kind] of SERVICE_BLIPS) atPlace(id, kind);
  for (const id of src.openStores) atPlace(id, 'store');
  if (!src.missionActive)
    for (const m of src.missions) atPlace(m.start, 'mission', `${m.title} (${PROTAGONISTS[m.protagonist].name})`, PROTAGONISTS[m.protagonist].name[0]);
  src.targets.forEach((t, i) => blips.push({ id: `target-${i}`, kind: TARGET_BLIP[t.kind], x: t.x, z: t.z, label: t.label }));
  for (const officer of src.police) if (officer.alive) blips.push({ id: `police-${officer.id}`, kind: 'police', x: officer.pos.x, z: officer.pos.z, label: officer.name });
  if (src.jobTarget) blips.push({ id: 'job-car', kind: 'target', x: src.jobTarget.x, z: src.jobTarget.z, label: 'Xe khách đặt' });
  if (src.waypoint) blips.push({ id: 'waypoint', kind: 'waypoint', x: src.waypoint.x, z: src.waypoint.z, label: 'Điểm đến' });
  return blips;
}

import * as THREE from 'three';
import { NavGrid, type P2 } from '../../core/agents/nav';
import { buildDaylight } from '../../core/world/scenery';
import type { ShooterMap, SpawnPoint } from '../../core/world/shooterMap';
import type { ViewDistance } from '../../core/world/viewDistance';
import type { CityGround, CitySource } from './cityAssets';
import type { CityScenery } from './cityScenery';
import { CityTerrain } from './cityTerrain';
import { STREAM_RADII } from './cityTiles';
import { snapPlaces, type PlaceId } from './cityPlaces';

/**
 * Haze thickens from 140 m and hides everything a little before the edge of the streamed tiles, so tiles appear and go
 * unseen; the background is the haze colour, so the horizon has no seam.
 */
const FOG_FAR_M = STREAM_RADII.loadM - 60;
const CITY_VIEW: ViewDistance = { fogNear: 140, fogFar: FOG_FAR_M, cameraFar: FOG_FAR_M + 20, showSky: false };
/** Path grid cells: fine enough for people in side streets, coarse for cars to keep long routes cheap. */
const FOOT_NAV_CELL_M = 4;
const CAR_NAV_CELL_M = 8;

/** The open-world city: the shooter map plus its street masks, path grids for people and cars, and the named places. */
export interface CityMap extends ShooterMap {
  ground: CityGround;
  places: Record<PlaceId, P2>;
  /** Path grid for cars: streets, car parks and highways wide enough to drive. */
  carNav: NavGrid;
  /** x/z is on the street level reachable on foot. */
  isStreet(x: number, z: number): boolean;
  /** A car fits at x/z. */
  isDrivable(x: number, z: number): boolean;
  /** Ground height to stand or drive on. */
  groundAt(x: number, z: number): number;
  /** The buildings and streets, loaded tile by tile around the camera. */
  scenery: CityScenery;
}

export function buildCityMap(renderer: THREE.WebGLRenderer | null, source: CitySource): CityMap {
  const scene = new THREE.Scene();
  const { ground } = source;
  const scenery = source.createScenery();
  scene.add(scenery.group);
  const { sun, sunDir, sky, envTarget } = buildDaylight(scene, renderer);
  // the city neither casts nor receives shadows: a shadow pass over whole streets would only cost frame time
  sun.castShadow = false;
  const terrain = new CityTerrain(ground.grid);
  const { grid, masks } = ground;
  const isStreet = (x: number, z: number) => {
    const k = grid.index(x, z);
    return k >= 0 && masks.walk[k] === 1;
  };
  const isDrivable = (x: number, z: number) => {
    const k = grid.index(x, z);
    return k >= 0 && masks.drive[k] === 1;
  };
  const half = Math.max(Math.abs(grid.originX), Math.abs(grid.maxX), Math.abs(grid.originZ), Math.abs(grid.maxZ));
  const nav = new NavGrid(half, (x, z) => !isStreet(x, z), FOOT_NAV_CELL_M);
  const carNav = new NavGrid(half, (x, z) => !isDrivable(x, z), CAR_NAV_CELL_M);
  const places = snapPlaces(ground, source.places);
  const home = places.hideout;
  const spawn: SpawnPoint = { x: home.x, z: home.z, yaw: 0 };

  return {
    scene,
    sun,
    sunDir,
    sky,
    solids: [],
    terrain,
    nav,
    climbs: [],
    spawns: { CT: [spawn], T: [spawn] },
    spawnCenter: { CT: home, T: home },
    // the open world gives every bot its own goal; these only keep the shared AI's fallbacks defined
    points: { attack: [home], hold: { CT: [home], T: [home] } },
    view: CITY_VIEW,
    ground,
    places,
    carNav,
    isStreet,
    isDrivable,
    groundAt: (x, z) => terrain.heightAt(x, z),
    scenery,
    update(timeS: number, camera: THREE.Vector3) {
      scenery.update(camera, timeS);
    },
    dispose() {
      scenery.dispose();
      envTarget?.dispose();
    },
  };
}

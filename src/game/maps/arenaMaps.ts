import * as THREE from 'three';
import { NavGrid, P2 } from '../nav';
import { makeBlocked, Solid, Team, WORLD_LIMIT } from '../rules';
import { applyViewDistance } from '../viewDistance';
import type { Arena } from '../world';
import { cargoShipSolids, POINTS, SHIP_NAV_CELL, SHIP_NAV_HALF, SPAWN_CENTER, SPAWNS } from './cargoShipLayout';
import { buildCargoShipScene, CargoShipScene } from './cargoShipScene';

type MapMode = 'cs' | 'br';

/** What the game plays on: the meshes shown, the boxes collided with, where teams start and where bots go. */
interface MapLayout {
  group: THREE.Object3D;
  solids: Solid[];
  spawns: Arena['spawns'];
  spawnCenter: Record<Team, P2>;
  points: Arena['points'];
  nav: NavGrid;
}

/**
 * The two maps sharing the arena's scene, sky and light: battle royale plays on the town, 5 vs 5 on the cargo ship. Switching
 * shows one and hides the other, and swaps the arena's collision boxes, spawns and bot points in place, so the rest of the
 * game keeps reading `arena` as before.
 */
export class ArenaMaps {
  private readonly ship: CargoShipScene;
  private readonly layouts: Record<MapMode, MapLayout>;
  private mode: MapMode = 'cs';

  constructor(private readonly arena: Arena) {
    this.ship = buildCargoShipScene();
    arena.scene.add(this.ship.group);
    const townSolids = [...arena.solids];
    const shipSolids = cargoShipSolids();
    this.layouts = {
      br: {
        group: arena.land, solids: townSolids, spawns: arena.spawns, spawnCenter: arena.spawnCenter, points: arena.points,
        nav: new NavGrid(WORLD_LIMIT - 2, makeBlocked(townSolids, 0.5), 2.5),
      },
      cs: {
        group: this.ship.group, solids: shipSolids, spawns: SPAWNS, spawnCenter: SPAWN_CENTER, points: POINTS,
        nav: new NavGrid(SHIP_NAV_HALF, makeBlocked(shipSolids, 0.5), SHIP_NAV_CELL),
      },
    };
  }

  /** Shows the map of a mode and makes it the one the arena plays on; returns the bots' path grid for it. */
  use(mode: MapMode, camera: THREE.PerspectiveCamera): NavGrid {
    this.mode = mode;
    const layout = this.layouts[mode];
    for (const other of Object.values(this.layouts)) other.group.visible = other === layout;
    this.arena.solids.length = 0;
    this.arena.solids.push(...layout.solids);
    this.arena.spawns = layout.spawns;
    this.arena.spawnCenter = layout.spawnCenter;
    this.arena.points = layout.points;
    applyViewDistance(this.arena, camera, mode);
    return layout.nav;
  }

  /** Per-frame animation of the map on show (swaying grass in the town, waves at sea). */
  update(t: number, camera: THREE.Vector3) {
    if (this.mode === 'br') this.arena.update(t, camera);
    else this.ship.update(t);
  }
}

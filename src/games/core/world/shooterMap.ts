import type * as THREE from 'three';
import type { Climb } from '../agents/botClimb';
import type { NavGrid, P2 } from '../agents/nav';
import type { Solid, Team } from '../rules';
import type { Terrain } from './terrain';
import type { ViewDistance } from './viewDistance';

export interface SpawnPoint {
  x: number;
  z: number;
  yaw: number;
}

/** Bot destinations: where attackers push to and where each side holds. */
export interface BotPoints {
  attack: P2[];
  hold: Record<Team, P2[]>;
}

/** What a shooter game plays on; each game builds its own (the cargo ship, the island). */
export interface ShooterMap {
  scene: THREE.Scene;
  sun: THREE.DirectionalLight;
  /** Unit vector toward the sun (the shadow light is kept along it, around the camera). */
  sunDir: THREE.Vector3;
  /** Sky dome; hidden where a thick haze ends the view (see viewDistance.ts). */
  sky: THREE.Object3D;
  /** Axis-aligned boxes that block movement, bullets and sight. */
  solids: Solid[];
  terrain: Terrain;
  /** The bots' path grid. */
  nav: NavGrid;
  /** Watchtowers bots can climb. */
  climbs: Climb[];
  spawns: Record<Team, SpawnPoint[]>;
  /** Middle of each team's spawn. */
  spawnCenter: Record<Team, P2>;
  points: BotPoints;
  view: ViewDistance;
  /** Per-frame animation (swaying grass, waves at sea). */
  update(timeS: number, camera: THREE.Vector3): void;
  /** Frees what the scene traversal in GameEngine.dispose does not reach (the environment map). */
  dispose(): void;
}

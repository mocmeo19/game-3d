import type * as THREE from 'three';

/** The buildings and streets a city draws, kept only around the camera (the photo tiles or the generated city). */
export interface CityScenery {
  /** What the scenery has in the scene. */
  readonly group: THREE.Group;
  /** Called every frame: loads or builds what comes near, frees what is far. */
  update(camera: THREE.Vector3, timeS: number): void;
  /** Everything right around x/z is drawn (false only just after a jump: the start, a respawn). */
  isDrawnAround(x: number, z: number): boolean;
  dispose(): void;
}

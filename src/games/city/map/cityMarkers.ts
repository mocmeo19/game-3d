import * as THREE from 'three';
import type { BlipKind, MapBlip } from '../citySnapshot';

/** Kinds of map marks that also stand in the street as glowing rings, so the spot to walk or drive into can be seen. */
const MARKER_COLOR: Partial<Record<BlipKind, number>> = {
  mission: 0xf5c542,
  objective: 0xf5d742,
  store: 0x7bd88f,
  gunShop: 0xd9d4c7,
  job: 0xc58cff,
  paint: 0xffa94d,
  waypoint: 0xc77dff,
};
const MAX_MARKERS = 12;
const SHOW_WITHIN_M = 220;
const RADIUS_M = 1.6;
const HEIGHT_M = 2.4;
const PULSE_HZ = 0.8;
/** A marker hides while the camera is this close outside its ring (m). */
const CAMERA_CLEAR_M = 2;

/**
 * Glowing cylinders over mission starts, objectives and shops near the camera. A fixed pool of meshes sharing one geometry,
 * so no allocation happens per frame; the spots are refreshed a few times a second by the engine.
 */
export class CityMarkers {
  private readonly geometry = new THREE.CylinderGeometry(RADIUS_M, RADIUS_M, HEIGHT_M, 28, 1, true);
  private readonly materials = new Map<number, THREE.MeshBasicMaterial>();
  private readonly meshes: THREE.Mesh[] = [];

  constructor(scene: THREE.Scene, private readonly groundAt: (x: number, z: number) => number) {
    this.geometry.translate(0, HEIGHT_M / 2, 0);
    for (let i = 0; i < MAX_MARKERS; i++) {
      const mesh = new THREE.Mesh(this.geometry, this.material(0xffffff));
      mesh.visible = false;
      mesh.renderOrder = 2;
      scene.add(mesh);
      this.meshes.push(mesh);
    }
  }

  private material(color: number) {
    let m = this.materials.get(color);
    if (!m) {
      m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
      this.materials.set(color, m);
    }
    return m;
  }

  /** Places the pool on the nearest marked spots. */
  place(blips: readonly MapBlip[], camera: THREE.Vector3) {
    let used = 0;
    for (const blip of blips) {
      const color = MARKER_COLOR[blip.kind];
      if (color === undefined || used >= MAX_MARKERS) continue;
      const distance = Math.hypot(blip.x - camera.x, blip.z - camera.z);
      // from inside, the glowing walls would wash over the whole screen
      if (distance > SHOW_WITHIN_M || distance < RADIUS_M + CAMERA_CLEAR_M) continue;
      const mesh = this.meshes[used++];
      mesh.material = this.material(color);
      mesh.position.set(blip.x, this.groundAt(blip.x, blip.z), blip.z);
      mesh.visible = true;
    }
    for (let i = used; i < MAX_MARKERS; i++) this.meshes[i].visible = false;
  }

  /** A slow breathing glow. */
  animate(timeS: number) {
    const k = 0.25 + 0.15 * Math.sin(timeS * Math.PI * 2 * PULSE_HZ);
    for (const m of this.materials.values()) m.opacity = k;
  }

  dispose() {
    for (const mesh of this.meshes) mesh.removeFromParent();
    this.geometry.dispose();
    this.materials.forEach((m) => m.dispose());
  }
}

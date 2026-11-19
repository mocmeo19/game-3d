import * as THREE from 'three';

/** How far the player sees: fog fades the world out and the camera draws nothing past it. Each map picks its own. */
export interface ViewDistance {
  fogNear: number;
  fogFar: number;
  cameraFar: number;
  showSky: boolean;
}

export function applyViewDistance(map: { scene: THREE.Scene; sky: THREE.Object3D; view: ViewDistance }, camera: THREE.PerspectiveCamera) {
  const { view } = map;
  const fog = map.scene.fog as THREE.Fog;
  fog.near = view.fogNear;
  fog.far = view.fogFar;
  map.sky.visible = view.showSky;
  map.scene.background = view.showSky ? null : fog.color;
  camera.far = view.cameraFar;
  camera.updateProjectionMatrix();
}

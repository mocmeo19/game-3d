import * as THREE from 'three';

/** How far the player sees: fog fades the world out and the camera draws nothing past it. */
interface ViewDistance {
  fogNear: number;
  fogFar: number;
  cameraFar: number;
  showSky: boolean;
}

/**
 * The 5v5 round is fenced into a small area, so the whole sky and the far scenery stay visible. The battle royale roams the whole
 * map (about 660 m across): a thick haze ends the view at 200 m so far buildings, trees and bots are not drawn at all; the sky
 * gives way to the haze colour so the fogged horizon has no seam. Bots spot enemies within 80 m, well inside the clear part.
 */
const VIEWS: Record<'cs' | 'br', ViewDistance> = {
  cs: { fogNear: 80, fogFar: 380, cameraFar: 1000, showSky: true },
  br: { fogNear: 40, fogFar: 200, cameraFar: 205, showSky: false },
};

export function applyViewDistance(arena: { scene: THREE.Scene; sky: THREE.Object3D }, camera: THREE.PerspectiveCamera, mode: 'cs' | 'br') {
  const view = VIEWS[mode];
  const fog = arena.scene.fog as THREE.Fog;
  fog.near = view.fogNear;
  fog.far = view.fogFar;
  arena.sky.visible = view.showSky;
  arena.scene.background = view.showSky ? null : fog.color;
  camera.far = view.cameraFar;
  camera.updateProjectionMatrix();
}

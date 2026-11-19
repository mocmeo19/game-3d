import * as THREE from 'three';
import { CharacterState } from '../../types/character';
import { AvatarController } from './avatar';
import { makeStudioEnvironment } from './skin';
import { FACE_MARKINGS } from '../../constants/presets';

/**
 * Face-marking thumbnails drawn by the real avatar: a small off-screen renderer loads the same MPFB body, paints each marking
 * on it with the current skin and colour and photographs the face. Results are cached per gender / skin / colour.
 */

const SIZE = 160;
const cache = new Map<string, Promise<Record<string, string>>>();

export interface ThumbRig {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  avatar: AvatarController;
  ready: Promise<void>;
  gender: string;
}

let shared: ThumbRig | null = null;

const setup = (gender: string): ThumbRig => {
  if (shared && shared.gender === gender) return shared;
  if (shared) {
    shared.renderer.dispose();
    shared.renderer.forceContextLoss(); // hand the GPU context back: browsers allow only a handful at a time
    shared = null;
  }
  const canvas = document.createElement('canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setSize(SIZE, SIZE, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene();
  scene.environment = makeStudioEnvironment(renderer);
  const key = new THREE.DirectionalLight('#fff4e6', 2.2);
  key.position.set(1.5, 2, 3);
  scene.add(key, new THREE.AmbientLight('#8c93a8', 0.6));
  const camera = new THREE.PerspectiveCamera(14, 1, 0.05, 20);
  let resolve!: () => void;
  const ready = new Promise<void>((r) => (resolve = r));
  const avatar = new AvatarController(() => resolve());
  scene.add(avatar.group);
  avatar.ensureLoaded(gender);
  shared = { renderer, scene, camera, avatar, ready, gender };
  return shared;
};

/** Run `job` on the shared off-screen avatar, one job at a time (marking and designer thumbnails share it). */
let queue: Promise<unknown> = Promise.resolve();
export const withThumbRig = <T,>(gender: string, job: (rig: ThumbRig) => Promise<T>): Promise<T> => {
  const run = queue.then(async () => {
    const s = setup(gender);
    await s.ready;
    return job(s);
  });
  queue = run.catch(() => undefined);
  return run;
};

export const markingThumbs = (state: CharacterState): Promise<Record<string, string>> => {
  const c = state.cosmetics;
  const key = [state.gender, state.skin ?? '', c.skinTone, c.faceMarkingColor, state.body.chestSize].join('|');
  let p = cache.get(key);
  if (!p) {
    p = withThumbRig(state.gender, async (s) => {
      const out: Record<string, string> = {};
      const make = (id: string): CharacterState => ({
          ...state,
          costume: 'none',
          pose: 'idle',
          gear: {},
          hat: undefined,
          cosmetics: { ...c, hairStyle: 'none', faceMarking: id as CharacterState['cosmetics']['faceMarking'], eyeshadowIntensity: 0, blushIntensity: 0, lipOff: true }
      });
      s.avatar.apply(make('none'));
      s.avatar.group.visible = true;
      await new Promise((r) => setTimeout(r, 1500)); // skin / eye textures load asynchronously
      for (const fm of FACE_MARKINGS) {
        const next = make(fm.id);
        s.avatar.apply(next);
        s.avatar.group.visible = true;
        s.scene.updateMatrixWorld(true);
        const a = s.avatar.anchors();
        const y = a.headY - 0.07 * a.scale;
        s.camera.position.set(0, y, 1.1);
        s.camera.lookAt(0, y, 0);
        s.renderer.render(s.scene, s.camera);
        out[fm.id] = s.renderer.domElement.toDataURL('image/png');
      }
      return out;
    });
    cache.set(key, p);
    if (cache.size > 12) cache.delete(cache.keys().next().value as string);
  }
  return p;
};

import * as THREE from 'three';

/** Colour helpers and lighting shared by the character renderer. */

/** The skin swatches are "as seen" colours; real albedo is darker and warmer, otherwise lighting blows it out. */
export const skinAlbedo = (hex: string, out = new THREE.Color()): THREE.Color => {
  const hsl = { h: 0, s: 0, l: 0 };
  out.set(hex).getHSL(hsl);
  const light = smoothLight(hsl.l);
  return out.setHSL(hsl.h, Math.min(1, hsl.s * (1 + 0.1 * light) + 0.02 * light), hsl.l * (1 - 0.26 * light));
};
const smoothLight = (l: number) => Math.min(1, Math.max(0, (l - 0.35) / 0.55));

/** Small studio-like environment (key softbox, fill, floor bounce) for believable specular reflections. */
export const makeStudioEnvironment = (renderer: THREE.WebGLRenderer): THREE.Texture => {
  const scene = new THREE.Scene();
  const room = new THREE.Mesh(
    new THREE.BoxGeometry(10, 8, 10),
    new THREE.MeshBasicMaterial({ color: '#8c8f9a', side: THREE.BackSide })
  );
  room.position.y = 3;
  scene.add(room);
  const panel = (w: number, h: number, c: string, i: number, x: number, y: number, z: number) => {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(i), side: THREE.DoubleSide }));
    p.position.set(x, y, z);
    p.lookAt(0, 1.2, 0);
    scene.add(p);
  };
  panel(4, 3, '#fff4e6', 9, 3.5, 5, 3.5); // key softbox
  panel(3, 3, '#cfe0ff', 3.5, -4, 3, 2); // cool fill
  panel(5, 1.2, '#ffffff', 5, 0, 6.5, -3); // top strip
  panel(8, 8, '#4a4038', 1, 0, -0.9, 0); // warm floor bounce
  const pmrem = new THREE.PMREMGenerator(renderer);
  const tex = pmrem.fromScene(scene, 0.03).texture;
  pmrem.dispose();
  scene.traverse((o) => {
    const m = o as THREE.Mesh;
    m.geometry?.dispose();
    (m.material as THREE.Material | undefined)?.dispose();
  });
  return tex;
};

import * as THREE from 'three';

/** Floor level: the character's soles stand on the painted world's ground. */
export const GROUND_Y = -0.9;
/** Height above the floor the panorama is projected from (the eye height of the painting) and the skybox radius. */
export const SKY_HEIGHT = 1.0;
export const SKY_RADIUS = 9;
/** Where the painting's eye point sits: on the camera's axis at the usual full-body distance, so the picture is seen undistorted. */
export const SKY_CENTER_Z = 3.2;
/** Horizontal field of view of the paintings (generated as ordinary 24mm-lens pictures) and where their horizon sits (fraction from the top). */
export const PAINTING_HFOV = 90;
export const PAINTING_HORIZON = 0.55;
export const PAINTING_ASPECT = 5504 / 3072;

/** Soft round shadow for under the feet (ambient occlusion where the character meets the ground). */
let contactTex: THREE.CanvasTexture | null = null;
export const contactShadow = () => {
  if (contactTex) return contactTex;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, 'rgba(0,0,0,0.6)');
  grad.addColorStop(0.45, 'rgba(0,0,0,0.32)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  contactTex = new THREE.CanvasTexture(c);
  return contactTex;
};

/** Night of lanterns: a black glossy floor and paper lanterns hanging in the dark around the stage, swaying a little. */
const glowTexture = () => {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,200,140,0.9)');
  r.addColorStop(0.35, 'rgba(255,140,70,0.35)');
  r.addColorStop(1, 'rgba(255,100,40,0)');
  g.fillStyle = r;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
};

export const buildLanterns = () => {
  const group = new THREE.Group();
  const own: { dispose(): void }[] = [];
  const keep = <T extends { dispose(): void }>(x: T) => (own.push(x), x);
  const glowTex = keep(glowTexture());

  // glossy black floor
  const floor = new THREE.Mesh(new THREE.CircleGeometry(40, 64), keep(new THREE.MeshStandardMaterial({ color: 0x000000, roughness: 0.4, metalness: 0.15, envMapIntensity: 0.15 })));
  keep(floor.geometry);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = GROUND_Y - 0.003;
  floor.receiveShadow = true;
  group.add(floor);

  // lantern body: a squashed paper sphere with ribs, dark wood caps, a tassel and a cord up into the dark
  const profile: THREE.Vector2[] = [];
  for (let i = 0; i <= 14; i++) {
    const t = (i / 14) * Math.PI;
    profile.push(new THREE.Vector2(Math.sin(t) * 0.5 * (1 + 0.04 * Math.sin(i * 2.4)), -Math.cos(t) * 0.42));
  }
  const bodyGeo = keep(new THREE.LatheGeometry(profile, 20));
  const capGeo = keep(new THREE.CylinderGeometry(0.17, 0.2, 0.07, 14));
  const tasselGeo = keep(new THREE.ConeGeometry(0.035, 0.34, 6));
  const wood = keep(new THREE.MeshStandardMaterial({ color: 0x1c110c, roughness: 0.7 }));
  const tasselMat = keep(new THREE.MeshStandardMaterial({ color: 0xb0281c, roughness: 0.8 }));
  const cordMat = keep(new THREE.LineBasicMaterial({ color: 0x2a1a14 }));
  const palette = [0xd8281a, 0xe0401e, 0xe8661e, 0xc81e1e, 0xf08a2a];
  const mats = palette.map((c) => keep(new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 1.5, roughness: 0.6, transparent: true, opacity: 0.96 })));
  const sprites = keep(new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.85 }));

  let seed = 20260;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const swingers: { g: THREE.Group; phase: number; amp: number }[] = [];
  const place = (angle: number, radius: number, height: number, scale: number) => {
    const holder = new THREE.Group();
    holder.position.set(Math.sin(angle) * radius, GROUND_Y + height, -Math.cos(angle) * radius + 0.4);
    const lamp = new THREE.Group();
    lamp.scale.setScalar(scale);
    const body = new THREE.Mesh(bodyGeo, mats[Math.floor(rnd() * mats.length)]);
    body.scale.y = 0.9;
    const top = new THREE.Mesh(capGeo, wood);
    top.position.y = 0.4;
    const bottom = new THREE.Mesh(capGeo, wood);
    bottom.position.y = -0.4;
    const tassel = new THREE.Mesh(tasselGeo, tasselMat);
    tassel.position.y = -0.62;
    tassel.rotation.x = Math.PI;
    const glow = new THREE.Sprite(sprites);
    glow.scale.setScalar(2.4);
    lamp.add(body, top, bottom, tassel, glow);
    // the cord rises into the dark, out of view
    const cord = new THREE.Line(keep(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0.43 * scale, 0), new THREE.Vector3(0, 12, 0)])), cordMat);
    holder.add(lamp, cord);
    holder.userData.lamp = lamp;
    group.add(holder);
    swingers.push({ g: holder, phase: rnd() * 6.28, amp: 0.02 + rnd() * 0.035 });
  };
  // mostly behind and beside the character, a few high and near the camera's edges; none in front of the face
  for (let i = 0; i < 46; i++) {
    const a = (rnd() - 0.5) * Math.PI * 1.55;
    place(a, 4.5 + rnd() * 8, 0.6 + rnd() * 5.5, 0.34 + rnd() * 0.4);
  }
  for (let i = 0; i < 8; i++) place(Math.PI / 2 * (rnd() < 0.5 ? -1 : 1) * (0.9 + rnd() * 0.5), 3.6 + rnd() * 3, 0.3 + rnd() * 2.5, 0.32 + rnd() * 0.3);

  // a few warm lights so the character and floor pick up the glow
  const lights: THREE.PointLight[] = [];
  for (const [x, y, z, k] of [[-2.2, 1.6, -1.8, 9], [2.4, 1.2, -2.2, 9], [0, 2.4, -3.6, 7], [-3, 0.4, 1.2, 4], [3, 0.5, 1, 4]] as const) {
    const l = new THREE.PointLight(0xff8a50, k, 9, 1.6);
    l.position.set(x, GROUND_Y + y, z);
    group.add(l);
    lights.push(l);
  }

  return {
    group,
    update(t: number) {
      swingers.forEach((s, i) => {
        s.g.rotation.z = Math.sin(t * 0.7 + s.phase) * s.amp;
        s.g.rotation.x = Math.cos(t * 0.55 + s.phase * 1.3) * s.amp * 0.7;
        const lamp = s.g.userData.lamp as THREE.Group;
        lamp.rotation.y = Math.sin(t * 0.3 + i) * 0.5;
      });
      lights.forEach((l, i) => (l.intensity = (i < 3 ? 9 : 4) * (0.9 + 0.1 * Math.sin(t * 2.3 + i * 1.7) + 0.05 * Math.sin(t * 7 + i))));
    },
    dispose() {
      own.forEach((o) => o.dispose());
      group.removeFromParent();
    }
  };
};


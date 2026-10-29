import * as THREE from 'three';
import { gunMesh, radialTexture } from './models';
import { AmmoType, Circle, Level, Loot, MedId } from './royale';

/** 3D side of battle royale: models of loot lying on the ground, death crates, and the blue zone wall. */

const AMMO_COLOR: Record<AmmoType, number> = { '9mm': 0xd9b23c, '7.62': 0xb8442f, '5.56': 0x4f8a3c, '.300': 0x2f4f86 };
const LEVEL_TINT: Record<Level, number> = { 1: 0x9a8f6a, 2: 0x5d6b4a, 3: 0x2c3138 };

const std = (color: number, roughness = 0.7, metalness = 0.1) => new THREE.MeshStandardMaterial({ color, roughness, metalness });

function boxMesh(w: number, h: number, d: number, mat: THREE.Material, y = h / 2) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.y = y;
  return m;
}

function medMesh(med: MedId) {
  const g = new THREE.Group();
  const white = std(0xeeeeea, 0.6);
  const red = std(0xc23a2e, 0.6);
  if (med === 'bandage') {
    const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.09, 14), white);
    roll.rotation.z = Math.PI / 2;
    roll.position.y = 0.05;
    g.add(roll);
  } else if (med === 'energy') {
    const can = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.14, 14), std(0x2fa85a, 0.35, 0.6));
    can.position.y = 0.07;
    g.add(can);
  } else if (med === 'painkiller') {
    const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.09, 12), std(0xd9822b, 0.4));
    bottle.position.y = 0.045;
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.025, 12), white);
    cap.position.y = 0.1;
    g.add(bottle, cap);
  } else {
    const big = med === 'medkit';
    g.add(boxMesh(big ? 0.42 : 0.3, big ? 0.16 : 0.1, big ? 0.3 : 0.2, big ? red : white));
    const crossMat = big ? white : red;
    const h = big ? 0.165 : 0.105;
    g.add(boxMesh(0.16, 0.01, 0.05, crossMat, h), boxMesh(0.05, 0.01, 0.16, crossMat, h));
  }
  return g;
}

/** A small model for a loot item, lying on the floor. */
export function lootMesh(l: Loot): THREE.Object3D {
  switch (l.kind) {
    case 'weapon':
    case 'grenade': {
      const g = new THREE.Group();
      const gun = gunMesh(l.id);
      gun.scale.setScalar(1.25);
      gun.rotation.z = Math.PI / 2;
      gun.position.y = 0.06;
      g.add(gun);
      return g;
    }
    case 'ammo': {
      const g = new THREE.Group();
      g.add(boxMesh(0.26, 0.15, 0.18, std(AMMO_COLOR[l.ammo], 0.55)));
      g.add(boxMesh(0.265, 0.04, 0.185, std(0x1b1b1b, 0.8), 0.11));
      return g;
    }
    case 'med':
      return medMesh(l.med);
    case 'gear': {
      const g = new THREE.Group();
      const tint = LEVEL_TINT[l.level];
      if (l.gear === 'vest') g.add(boxMesh(0.5, 0.1, 0.42, std(tint, 0.85), 0.05), boxMesh(0.2, 0.11, 0.12, std(0x1d1d1d, 0.9), 0.06));
      else if (l.gear === 'helmet') g.add(new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), std(tint, 0.6, 0.3)));
      else g.add(boxMesh(0.36, 0.2, 0.46, std(tint, 0.9), 0.1), boxMesh(0.3, 0.06, 0.2, std(0x2a2a2a, 0.9), 0.22));
      return g;
    }
  }
}

/** Wooden box left where someone died; it holds everything they carried. */
export function crateMesh() {
  const g = new THREE.Group();
  g.add(boxMesh(0.9, 0.5, 0.6, std(0x8a6a42, 0.85)));
  g.add(boxMesh(0.94, 0.06, 0.64, std(0x5c4630, 0.9), 0.5));
  return g;
}

let sparkleTex: THREE.Texture | null = null;
/** A soft glint that pulses over loot so it can be spotted in the grass. */
export function sparkle() {
  sparkleTex ??= radialTexture([[0, 'rgba(255,255,240,0.9)'], [0.3, 'rgba(255,245,200,0.35)'], [1, 'rgba(255,240,200,0)']]);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: sparkleTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  s.scale.setScalar(0.35);
  s.position.y = 0.3;
  return s;
}

/** The blue zone: a tall translucent striped wall at the current circle, and a white ring on the ground for the next one. */
export class ZoneView {
  readonly group = new THREE.Group();
  private readonly wall: THREE.Mesh;
  private readonly ring: THREE.Mesh;
  private readonly mat: THREE.ShaderMaterial;

  constructor() {
    this.mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: { uTime: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `uniform float uTime; varying vec2 vUv;
        void main() {
          float stripes = 0.5 + 0.5 * sin(vUv.x * 160.0 + vUv.y * 8.0 - uTime * 1.5);
          float fade = smoothstep(1.0, 0.25, vUv.y);
          gl_FragColor = vec4(0.18, 0.42, 1.0, (0.22 + stripes * 0.12) * fade);
        }`
    });
    this.wall = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 90, 128, 1, true), this.mat);
    this.wall.position.y = 45;
    this.wall.renderOrder = 5;
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.985, 1, 128), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false }));
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = 0.08;
    this.group.add(this.wall, this.ring);
  }

  update(t: number, cur: Circle, next: Circle | null) {
    this.mat.uniforms.uTime.value = t;
    this.wall.position.x = cur.x;
    this.wall.position.z = cur.z;
    this.wall.scale.set(Math.max(0.01, cur.r), 1, Math.max(0.01, cur.r));
    this.ring.visible = !!next && next.r > 0.5;
    if (next) {
      this.ring.position.x = next.x;
      this.ring.position.z = next.z;
      this.ring.scale.setScalar(Math.max(0.01, next.r));
    }
  }
}

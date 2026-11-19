import * as THREE from 'three';
import type { VehicleKind, VehicleSpec } from './vehicleSpecs';

/** The parts of a car body the game animates. */
export interface VehicleBody {
  group: THREE.Group;
  /** Wheel pivots: all spin, the front two also steer. */
  wheels: THREE.Object3D[];
  frontWheels: THREE.Object3D[];
  /** Red and blue light bar halves of a police car. */
  sirens: [THREE.Mesh, THREE.Mesh] | null;
  wheelRadius: number;
}

/** How the cabin sits on the body, by kind (shares of the body length and height). */
const CABIN: Record<VehicleKind, { length: number; offset: number; rise: number }> = {
  sedan: { length: 0.48, offset: 0.06, rise: 0.42 },
  hatch: { length: 0.55, offset: 0.12, rise: 0.45 },
  suv: { length: 0.62, offset: 0.08, rise: 0.45 },
  sports: { length: 0.4, offset: 0.05, rise: 0.38 },
  van: { length: 0.78, offset: 0.06, rise: 0.55 },
  taxi: { length: 0.48, offset: 0.06, rise: 0.42 },
  police: { length: 0.5, offset: 0.06, rise: 0.42 },
};

const SIREN_RED = 0xff2a2a;
const SIREN_BLUE = 0x2a6bff;

/**
 * Builds car bodies from boxes and cylinders. Geometry and materials are shared between cars of the same kind and paint, so a
 * street full of traffic costs a handful of buffers; the factory belongs to one game and is disposed with it.
 */
export class VehicleMeshFactory {
  private readonly geometries = new Map<string, THREE.BufferGeometry>();
  private readonly materials = new Map<string, THREE.Material>();

  private geometry(key: string, make: () => THREE.BufferGeometry) {
    let g = this.geometries.get(key);
    if (!g) {
      g = make();
      this.geometries.set(key, g);
    }
    return g;
  }

  private material(key: string, make: () => THREE.Material) {
    let m = this.materials.get(key);
    if (!m) {
      m = make();
      this.materials.set(key, m);
    }
    return m;
  }

  private paint(color: number) {
    return this.material(`paint-${color}`, () => new THREE.MeshStandardMaterial({ color, metalness: 0.45, roughness: 0.38 }));
  }

  private flat(name: string, color: number, emissive = 0) {
    return this.material(name, () => new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.2, emissive, emissiveIntensity: emissive ? 1.6 : 0 }));
  }

  build(spec: VehicleSpec, paintColor: number): VehicleBody {
    const group = new THREE.Group();
    const { length: L, width: W, height: H, kind } = spec;
    const wheelRadius = kind === 'suv' || kind === 'van' ? 0.4 : kind === 'sports' ? 0.33 : 0.35;
    const bodyH = H * 0.42;
    const bodyY = wheelRadius * 0.7 + bodyH / 2;
    const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number) => {
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      group.add(mesh);
      return mesh;
    };
    add(this.geometry(`body-${kind}`, () => new THREE.BoxGeometry(W, bodyH, L)), this.paint(paintColor), 0, bodyY, 0);
    const cabin = CABIN[kind];
    const cabinH = H - (bodyY + bodyH / 2) + 0.02;
    const cabinY = bodyY + bodyH / 2 + cabinH / 2;
    const cabinZ = L * cabin.offset;
    add(this.geometry(`cabin-${kind}`, () => new THREE.BoxGeometry(W * 0.86, cabinH, L * cabin.length)), this.paint(paintColor), 0, cabinY, cabinZ);
    add(this.geometry(`glass-${kind}`, () => new THREE.BoxGeometry(W * 0.88, cabinH * 0.62, L * cabin.length * 0.96)), this.flat('glass', 0x1a242d), 0, cabinY + cabinH * 0.06, cabinZ);
    const lightZ = -L / 2 - 0.01;
    for (const side of [-1, 1]) {
      add(this.geometry('headlight', () => new THREE.BoxGeometry(0.34, 0.12, 0.04)), this.flat('headlight', 0xfff6d8, 0xfff2c0), side * W * 0.33, bodyY + bodyH * 0.15, lightZ);
      add(this.geometry('taillight', () => new THREE.BoxGeometry(0.3, 0.12, 0.04)), this.flat('taillight', 0x7a0a0a, 0x5a0000), side * W * 0.33, bodyY + bodyH * 0.15, L / 2 + 0.01);
    }
    if (kind === 'taxi') add(this.geometry('taxi-sign', () => new THREE.BoxGeometry(0.6, 0.18, 0.25)), this.flat('taxi-sign', 0xfff1a0, 0x6a5a10), 0, H + 0.1, cabinZ);
    let sirens: VehicleBody['sirens'] = null;
    if (kind === 'police') {
      add(this.geometry('police-stripe', () => new THREE.BoxGeometry(W + 0.02, bodyH * 0.5, L * 0.5)), this.flat('police-white', 0xeef1f5), 0, bodyY, 0);
      const barGeo = this.geometry('siren', () => new THREE.BoxGeometry(0.42, 0.12, 0.26));
      const red = add(barGeo, new THREE.MeshStandardMaterial({ color: SIREN_RED, emissive: SIREN_RED, emissiveIntensity: 0.2 }), -0.24, H + 0.06, cabinZ);
      const blue = add(barGeo, new THREE.MeshStandardMaterial({ color: SIREN_BLUE, emissive: SIREN_BLUE, emissiveIntensity: 0.2 }), 0.24, H + 0.06, cabinZ);
      sirens = [red, blue];
    }
    const wheelGeo = this.geometry(`wheel-${wheelRadius}`, () => new THREE.CylinderGeometry(wheelRadius, wheelRadius, 0.26, 14).rotateZ(Math.PI / 2));
    const tyre = this.flat('tyre', 0x161616);
    const wheels: THREE.Object3D[] = [];
    const frontWheels: THREE.Object3D[] = [];
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
      const pivot = new THREE.Group();
      pivot.position.set(sx * (W / 2 - 0.08), wheelRadius, sz * L * 0.32);
      const wheel = new THREE.Mesh(wheelGeo, tyre);
      wheel.castShadow = true;
      pivot.add(wheel);
      group.add(pivot);
      wheels.push(wheel);
      if (sz < 0) frontWheels.push(pivot);
    }
    return { group, wheels, frontWheels, sirens, wheelRadius };
  }

  dispose() {
    this.geometries.forEach((g) => g.dispose());
    this.materials.forEach((m) => m.dispose());
    this.geometries.clear();
    this.materials.clear();
  }
}

import type { BufferGeometry, SkinnedMesh } from 'three';
import type { SlotId } from '../../constants/equipment';

export const COVERS_SKIN = new Set<SlotId>([
  'outfit', 'top', 'pants', 'skirt', 'underwear_top', 'underwear_bottom', 'socks', 'gloves', 'shoes'
]);

export const BODY_HUGGING_SLOTS = new Set<SlotId>(['underwear_top', 'underwear_bottom', 'socks']);

export const CLOTH_LAYER: Partial<Record<SlotId, number>> = {
  underwear_top: 3,
  underwear_bottom: 3,
  socks: 3,
  top: 2,
  pants: 1,
  gloves: 1,
  skirt: 0,
  shoes: 2,
  outfit: -1,
  hat: -1,
  jewelry: -2,
  accessory: -2,
  glasses: -2,
  horns: -2,
  wings: -2,
  tail: -2,
  nails: -2
};

const OUTER_GARMENTS: Partial<Record<SlotId, SlotId[]>> = {
  underwear_top: ['top', 'outfit'],
  underwear_bottom: ['pants', 'skirt', 'outfit'],
  socks: ['shoes', 'pants', 'skirt', 'outfit']
};

export function maskInnerGarments(
  getMesh: (slot: SlotId) => SkinnedMesh | undefined,
  coveredVertices: (geometry: BufferGeometry, outer: SkinnedMesh) => number[]
) {
  for (const slot of ['underwear_top', 'underwear_bottom', 'socks'] as const) {
    const mesh = getMesh(slot);
    if (!mesh) continue;
    const geometry = mesh.geometry;
    const fullIndex = (geometry.userData.fullIndex ??= geometry.index
      ? Array.from(geometry.index.array)
      : null) as number[] | null;
    if (!fullIndex) continue;

    const hidden = new Uint8Array(geometry.attributes.position.count);
    for (const outerSlot of OUTER_GARMENTS[slot] ?? []) {
      const outer = getMesh(outerSlot);
      if (outer) for (const vertex of coveredVertices(geometry, outer)) hidden[vertex] = 1;
    }

    const index: number[] = [];
    for (let i = 0; i < fullIndex.length; i += 3) {
      const a = fullIndex[i], b = fullIndex[i + 1], c = fullIndex[i + 2];
      if (!hidden[a] || !hidden[b] || !hidden[c]) index.push(a, b, c);
    }
    geometry.setIndex(index);
  }
}

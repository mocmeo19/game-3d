import * as THREE from 'three';

/**
 * Static batching: the arena is built from thousands of small meshes (walls, planks, fence rails, crates ...), each its own draw
 * call, again in the shadow pass. Once the arena is complete, every plain mesh that never moves is baked into world space and merged
 * with the others that share its material, flags and square tile of the map, so the GPU draws a few hundred meshes instead of
 * thousands and frustum culling still works tile by tile.
 *
 * Skipped: instanced and skinned meshes, transparent materials, material arrays, and anything marked `userData.dynamic`.
 */

const TILE = 48;

export function batchStatic(scene: THREE.Object3D): { merged: number; into: number } {
  scene.updateMatrixWorld(true);
  const groups = new Map<string, { material: THREE.Material; cast: boolean; receive: boolean; list: THREE.Mesh[] }>();
  const v = new THREE.Vector3();

  scene.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || (mesh as THREE.InstancedMesh).isInstancedMesh || (mesh as THREE.SkinnedMesh).isSkinnedMesh) return;
    if (mesh.userData.dynamic || Array.isArray(mesh.material) || !mesh.visible) return;
    const mat = mesh.material as THREE.Material;
    if (mat.transparent || mat.userData?.dynamic) return;
    const geo = mesh.geometry;
    if (!geo.getAttribute('position') || !geo.getAttribute('normal') || !geo.getAttribute('uv')) return;
    // big pieces (the ground, the hills) are already one draw call and would only widen the tile's bounds
    if (!geo.boundingSphere) geo.computeBoundingSphere();
    if (geo.boundingSphere!.radius * Math.max(mesh.matrixWorld.getMaxScaleOnAxis(), 1) > TILE * 0.4) return;
    v.setFromMatrixPosition(mesh.matrixWorld);
    const key = `${mat.uuid}|${mesh.castShadow ? 1 : 0}${mesh.receiveShadow ? 1 : 0}|${Math.floor(v.x / TILE)}|${Math.floor(v.z / TILE)}`;
    let g = groups.get(key);
    if (!g) groups.set(key, (g = { material: mat, cast: mesh.castShadow, receive: mesh.receiveShadow, list: [] }));
    g.list.push(mesh);
  });

  let merged = 0;
  let into = 0;
  for (const g of groups.values()) {
    if (g.list.length < 2) continue;
    let verts = 0;
    let indices = 0;
    for (const m of g.list) {
      const geo = m.geometry;
      verts += geo.getAttribute('position').count;
      indices += geo.index ? geo.index.count : geo.getAttribute('position').count;
    }
    const position = new Float32Array(verts * 3);
    const normal = new Float32Array(verts * 3);
    const uv = new Float32Array(verts * 2);
    const index = new Uint32Array(indices);
    const normalMatrix = new THREE.Matrix3();
    let vo = 0;
    let io = 0;
    for (const m of g.list) {
      const geo = m.geometry;
      const pos = geo.getAttribute('position');
      const nor = geo.getAttribute('normal');
      const tex = geo.getAttribute('uv');
      normalMatrix.getNormalMatrix(m.matrixWorld);
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
        position.set([v.x, v.y, v.z], (vo + i) * 3);
        v.fromBufferAttribute(nor, i).applyMatrix3(normalMatrix).normalize();
        normal.set([v.x, v.y, v.z], (vo + i) * 3);
        uv.set([tex.getX(i), tex.getY(i)], (vo + i) * 2);
      }
      if (geo.index) for (let i = 0; i < geo.index.count; i++) index[io++] = geo.index.getX(i) + vo;
      else for (let i = 0; i < pos.count; i++) index[io++] = vo + i;
      vo += pos.count;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(position, 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(normal, 3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geometry.setIndex(new THREE.BufferAttribute(index, 1));
    geometry.computeBoundingSphere();
    geometry.computeBoundingBox();
    const mesh = new THREE.Mesh(geometry, g.material);
    mesh.castShadow = g.cast;
    mesh.receiveShadow = g.receive;
    mesh.matrixAutoUpdate = false;
    scene.add(mesh);
    for (const m of g.list) {
      m.removeFromParent();
      m.geometry.dispose();
    }
    merged += g.list.length;
    into++;
  }
  return { merged, into };
}

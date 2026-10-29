/**
 * UV layout files (see test/uv.json): the texture coordinates of a mesh, exported from the GLB, used as a guide when painting
 * a skin. Coordinates are normalised with the origin at the top-left and v pointing down, so a point lands on the image at
 * (u * width, v * height). A file is untrusted input: everything is checked before use.
 */

export interface UvLayout {
  /** Shown in the editor: the mesh or the file the layout came from. */
  label: string;
  /** Model the UVs were taken from, if the file says. */
  sourceModel: string | null;
  /** u, v pairs. */
  uv: Float32Array;
  /** Three indices into the pairs of `uv` per triangle. */
  triangles: Uint32Array;
}

const MAX_VERTICES = 2_000_000;
const MAX_TRIANGLES = 4_000_000;

const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const isCoordinate = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= -1 && value <= 2;

interface Primitive {
  uv: unknown;
  triangles: unknown;
}

function primitivesOf(data: Record<string, unknown>): Primitive[] {
  if (Array.isArray(data.primitives)) return data.primitives.filter(isRecord).map((p) => ({ uv: p.uv, triangles: p.triangles }));
  return [{ uv: data.uv, triangles: data.triangles }];
}

/** Reads a UV layout file (the exported format, or a bare `{ uv, triangles }`); throws an Error saying what is wrong. */
export function parseUvLayout(data: unknown, fileName = 'UV'): UvLayout {
  if (!isRecord(data)) throw new Error('File UV phải là một đối tượng JSON.');
  if (data.coordinateSystem !== undefined) {
    const origin = isRecord(data.coordinateSystem) ? data.coordinateSystem.origin : undefined;
    if (origin !== undefined && origin !== 'top-left') throw new Error(`Gốc toạ độ "${String(origin)}" chưa được hỗ trợ (cần top-left).`);
  }
  const primitives = primitivesOf(data);
  if (!primitives.length) throw new Error('File UV không có primitive nào.');
  const uv: number[] = [];
  const triangles: number[] = [];
  primitives.forEach((primitive, index) => {
    if (!Array.isArray(primitive.uv) || !Array.isArray(primitive.triangles)) throw new Error(`Primitive ${index} thiếu "uv" hoặc "triangles".`);
    const offset = uv.length / 2;
    for (const pair of primitive.uv) {
      if (!Array.isArray(pair) || pair.length !== 2 || !isCoordinate(pair[0]) || !isCoordinate(pair[1])) throw new Error(`Primitive ${index}: toạ độ UV không hợp lệ.`);
      uv.push(pair[0], pair[1]);
    }
    const count = primitive.uv.length;
    for (const tri of primitive.triangles) {
      if (!Array.isArray(tri) || tri.length !== 3 || !tri.every((i) => Number.isInteger(i) && i >= 0 && i < count)) {
        throw new Error(`Primitive ${index}: tam giác trỏ tới đỉnh không tồn tại.`);
      }
      triangles.push(tri[0] + offset, tri[1] + offset, tri[2] + offset);
    }
    if (uv.length / 2 > MAX_VERTICES || triangles.length / 3 > MAX_TRIANGLES) throw new Error('File UV quá lớn.');
  });
  if (!triangles.length) throw new Error('File UV không có tam giác nào.');
  const sourceModel = typeof data.sourceModel === 'string' ? data.sourceModel : null;
  const mesh = typeof data.nodeName === 'string' ? data.nodeName : typeof data.meshName === 'string' ? data.meshName : fileName;
  return { label: mesh, sourceModel, uv: new Float32Array(uv), triangles: new Uint32Array(triangles) };
}

/** Counts shown to the user. */
export const layoutStats = (layout: UvLayout) => ({ vertices: layout.uv.length / 2, triangles: layout.triangles.length / 3 });

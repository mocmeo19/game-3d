import type * as THREE from 'three';
import { HEAD, HITBOXES, PRONE_HEAD, PRONE_HITBOXES, type Agent } from '../agents/agent';
import { CROUCH_DROP } from '../models';
import { rayBox, type HitGroup } from '../rules';

export interface AgentHit {
  /** Distance along the ray (world metres). */
  t: number;
  group: HitGroup;
}

/** Ray against an agent's hit boxes, tested in its body frame. */
export function hitAgent(a: Agent, o: THREE.Vector3, d: THREE.Vector3, far: number): AgentHit | null {
  const rot = -(a.yaw + Math.PI);
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  // body space divided by the agent's size: the hit boxes are for a 1.72 m body, and t stays a world distance
  const k = 1 / a.scale;
  const lx = o.x - a.pos.x;
  const lz = o.z - a.pos.z;
  const ox = (lx * c + lz * s) * k;
  const oz = (-lx * s + lz * c) * k;
  const oy = (o.y - a.pos.y) * k;
  const dx = (d.x * c + d.z * s) * k;
  const dz = (-d.x * s + d.z * c) * k;
  const dy = d.y * k;
  const prone = a.prone > 0.5;
  const drop = a.crouch * CROUCH_DROP;
  let best: AgentHit | null = null;
  // head sphere; in this frame the body faces +z and its right is -x, so a lean to the right moves the head towards -x
  const hx = ox + a.lean * a.leanReach;
  const py = oy - (prone ? PRONE_HEAD.y : HEAD.y - drop);
  const hz = oz - (prone ? PRONE_HEAD.z : 0);
  // |d| is 1/scale here: solve the full quadratic
  const qa = dx * dx + dy * dy + dz * dz;
  const b = hx * dx + py * dy + hz * dz;
  const disc = b * b - qa * (hx * hx + py * py + hz * hz - HEAD.r * HEAD.r);
  if (disc >= 0) {
    const t = (-b - Math.sqrt(disc)) / qa;
    if (t > 0 && t < far) best = { t, group: 'head' };
  }
  const boxes = prone
    ? PRONE_HITBOXES.map((hb) => ({ group: hb.group, min: { x: hb.min[0], y: hb.min[1], z: hb.min[2] }, max: { x: hb.max[0], y: hb.max[1], z: hb.max[2] } }))
    : HITBOXES.map((hb) => ({ group: hb.group, min: { x: hb.min[0], y: hb.drops ? hb.min[1] - drop : hb.min[1], z: hb.min[2] }, max: { x: hb.max[0], y: hb.max[1] - drop, z: hb.max[2] } }));
  for (const box of boxes) {
    const r = rayBox(ox, oy, oz, dx, dy, dz, box, far);
    if (r && (!best || r[0] < best.t)) best = { t: r[0], group: box.group };
  }
  return best;
}

import * as THREE from 'three';
import { allied, type Agent } from '../agents/agent';
import { disposeTree, gunMesh } from '../models';
import { flashDuration, heDamage, MOVE, spendGrenade, type WeaponId } from '../rules';
import type { Combat } from './combat';
import type { MatchContext } from './matchContext';

interface Nade {
  id: WeaponId;
  owner: Agent;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  mesh: THREE.Group;
  age: number;
  still: number;
}

/** Thrown grenades: flight with bounces, then the explosion, the flash or the smoke. */
export class Grenades {
  private live: Nade[] = [];

  constructor(
    private readonly ctx: MatchContext,
    private readonly fight: Pick<Combat, 'canSee' | 'damage'>,
  ) {}

  throw(a: Agent, mode: 'fire' | 'alt') {
    const g = a.inv.grenade;
    if (!g) return;
    const dir = a.forward();
    const pos = a.eye().addScaledVector(dir, 0.4);
    const vel = dir.clone().multiplyScalar(mode === 'fire' ? 17 : 8).add(new THREE.Vector3(0, 2.2, 0)).addScaledVector(a.vel, 0.8);
    const mesh = gunMesh(g.id);
    mesh.scale.setScalar(1.4);
    mesh.position.copy(pos);
    this.ctx.arena.scene.add(mesh);
    this.live.push({ id: g.id, owner: a, pos, vel, mesh, age: 0, still: 0 });
    spendGrenade(a.inv);
    if (a.isPlayer) {
      this.ctx.feedback.swingAt = this.ctx.now;
      this.ctx.sfx.knife(false);
    }
  }

  update(dt: number) {
    for (let i = this.live.length - 1; i >= 0; i--) {
      const n = this.live[i];
      n.age += dt;
      for (let s = 0; s < 2; s++) {
        const h = dt / 2;
        n.vel.y -= MOVE.gravity * h;
        const next = n.pos.clone().addScaledVector(n.vel, h);
        for (const b of this.ctx.solids) {
          const e = 0.05;
          const inside = next.x > b.min.x - e && next.x < b.max.x + e && next.y > b.min.y - e && next.y < b.max.y + e && next.z > b.min.z - e && next.z < b.max.z + e;
          if (!inside) continue;
          // bounce off the face it came through
          if (n.pos.x <= b.min.x - e || n.pos.x >= b.max.x + e) n.vel.x *= -0.45;
          else if (n.pos.z <= b.min.z - e || n.pos.z >= b.max.z + e) n.vel.z *= -0.45;
          else n.vel.y *= -0.4;
          n.vel.multiplyScalar(0.75);
          next.copy(n.pos);
          if (n.vel.length() > 2) this.ctx.sfx.bounce(n.pos);
          break;
        }
        const floor = this.ctx.terrain.heightAt(next.x, next.z) + 0.05;
        if (next.y < floor) {
          next.y = floor;
          if (Math.abs(n.vel.y) > 1.5) this.ctx.sfx.bounce(next);
          n.vel.y = -n.vel.y * 0.4;
          n.vel.x *= 0.7;
          n.vel.z *= 0.7;
        }
        n.pos.copy(next);
      }
      n.mesh.position.copy(n.pos);
      n.mesh.rotation.x += n.vel.length() * dt * 2;
      n.still = n.vel.length() < 0.3 ? n.still + dt : 0;
      const done = n.id === 'smoke' ? (n.still > 0.4 && n.age > 1) || n.age > 4 : n.age > 1.6;
      if (!done) continue;
      this.detonate(n);
      n.mesh.removeFromParent();
      disposeTree(n.mesh);
      this.live.splice(i, 1);
    }
  }

  private detonate(n: Nade) {
    const at = n.pos.clone().setY(Math.max(0.3, n.pos.y));
    if (n.id === 'he') {
      this.ctx.effects.explosion(at);
      this.ctx.sfx.explosion(at);
      this.ctx.heard.push({ pos: at.clone(), squad: n.owner.squad, t: this.ctx.now });
      for (const a of this.ctx.agents) {
        if (!a.alive || (allied(a, n.owner) && a !== n.owner)) continue;
        const chest = a.chest();
        const dmg = heDamage(chest.distanceTo(at));
        if (dmg > 0 && this.fight.canSee(at, chest, false)) this.fight.damage(a, n.owner, 'he', dmg, 'chest', 0, false, chest, chest.clone().sub(at).normalize());
      }
    } else if (n.id === 'flash') {
      this.ctx.effects.flashbang(at);
      this.ctx.sfx.flashPop(at);
      for (const a of this.ctx.agents) {
        if (!a.alive) continue;
        const eye = a.eye();
        if (!this.fight.canSee(at, eye, false)) continue;
        const to = at.clone().sub(eye);
        const dur = flashDuration(to.length(), a.forward().dot(to.normalize()));
        if (dur <= 0) continue;
        a.blindUntil = Math.max(a.blindUntil, this.ctx.now + dur);
        if (a === this.ctx.player) this.ctx.sfx.flashRing(dur);
      }
    } else {
      this.ctx.effects.smoke(at);
      this.ctx.sfx.smokeHiss(at);
    }
  }

  /** Removes every grenade still in the air (a new round or match). */
  clear() {
    for (const n of this.live) {
      n.mesh.removeFromParent();
      disposeTree(n.mesh);
    }
    this.live = [];
  }
}

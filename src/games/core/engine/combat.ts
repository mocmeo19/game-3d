import * as THREE from 'three';
import { allied, dirFromAngles, type Agent } from '../agents/agent';
import { aimSpreadFactor } from '../aim/aimModes';
import type { BodyHit } from '../aim/aimTrajectory';
import type { PlayerAim } from '../aim/playerAim';
import type { PlayerAvatarRig } from '../combat/PlayerAvatarRig';
import type { ViewModel } from '../models';
import {
  activeWeapon, aimPunch, beginReload, recoilScale, canFire, computeDamage, consumeShot, inaccuracy, penetrate, rayBox, tickWeapon, WEAPONS,
  type HitGroup, type WeaponId, type WeaponState
} from '../rules';
import { hitAgent } from './hitTest';
import type { MatchContext } from './matchContext';

/** What the rest of the match does around a fight. */
export interface CombatHooks {
  /** What a fighter leaves behind on death: a crate of everything in battle royale, the gun on the floor in 5 vs 5. */
  leaveGear(victim: Agent): void;
  /** After each death: is the round or the match over? */
  afterDeath(victim: Agent, attacker: Agent): void;
  throwGrenade(thrower: Agent, mode: 'fire' | 'alt'): void;
  /** The game can make a fighter take no damage (a CS Lite test match's god mode). */
  isInvulnerable(victim: Agent): boolean;
  /** A fighter killed an enemy with a weapon: the game may pay for it (CS Lite kill money). */
  rewardKill(killer: Agent, weapon: WeaponId): void;
}

/** Sight lines, bullets, damage and deaths, and the trigger of every gun and knife (the player's and the bots'). */
export class Combat {
  private shotCount = 0;

  constructor(
    private readonly ctx: MatchContext,
    private readonly rig: PlayerAvatarRig,
    private readonly aim: PlayerAim,
    private readonly camera: THREE.PerspectiveCamera,
    private readonly vm: ViewModel,
    private readonly hooks: CombatHooks,
  ) {}

  /** Clear sight line between two points (solids, and smoke unless disabled). */
  readonly canSee = (a: THREE.Vector3, b: THREE.Vector3, smoke = true) => {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dz = b.z - a.z;
    const len = Math.hypot(dx, dy, dz);
    if (len < 1e-3) return true;
    for (const s of this.ctx.solids) {
      const hit = rayBox(a.x, a.y, a.z, dx / len, dy / len, dz / len, s, len);
      if (hit && hit[0] < len - 0.05 && hit[1] > 0.05) return false;
    }
    if (this.ctx.terrain.rayHit(a.x, a.y, a.z, dx / len, dy / len, dz / len, len - 0.05) !== null) return false;
    return !smoke || !this.ctx.effects.smokeBlocks(a, b);
  };


  /** Distance to the first living bot along a ray: the crosshair stops on it. */
  readonly hitBody: BodyHit = (origin, direction, far) =>
    this.ctx.agents.reduce<number | null>((near, b) => (b.isPlayer || !b.alive ? near : hitAgent(b, origin, direction, near ?? far)?.t ?? near), null);

  /** Spread multiplier of the player's aim (down the sights is steadier than over the shoulder, which beats the hip). */
  aimSpread(a: Agent) {
    return a.isPlayer ? aimSpreadFactor(this.aim.mode) : 1;
  }

  /** Share of the spray pattern a fighter feels: less crouched, lying down or (the player) down the sights. */
  recoilScaleOf(a: Agent) {
    return recoilScale({ crouch: a.crouch, prone: a.prone, ads: a.isPlayer && this.aim.mode === 'ADS' });
  }

  /** One bullet with wall penetration. Returns where it stopped. */
  private traceBullet(shooter: Agent, id: WeaponId, origin: THREE.Vector3, dir: THREE.Vector3): THREE.Vector3 {
    const far = WEAPONS[id].range;
    type Hit = { t: number; exit?: number; agent?: Agent; group?: HitGroup; ground?: boolean };
    const hits: Hit[] = [];
    for (const s of this.ctx.solids) {
      const r = rayBox(origin.x, origin.y, origin.z, dir.x, dir.y, dir.z, s, far);
      if (r && r[1] > 0.001) hits.push({ t: r[0], exit: r[1] });
    }
    const groundT = this.ctx.terrain.rayHit(origin.x, origin.y, origin.z, dir.x, dir.y, dir.z, far);
    if (groundT !== null) hits.push({ t: groundT, ground: true });
    for (const a of this.ctx.agents) {
      if (!a.alive || a === shooter || allied(a, shooter)) continue;
      const h = hitAgent(a, origin, dir, far);
      if (h) hits.push({ t: h.t, agent: a, group: h.group });
    }
    hits.sort((x, y) => x.t - y.t);
    let damage = WEAPONS[id].damage;
    let walls = 0;
    const point = (t: number) => origin.clone().addScaledVector(dir, t);
    for (const h of hits) {
      const p = point(h.t);
      if (h.agent) {
        this.damage(h.agent, shooter, id, damage, h.group!, h.t, walls > 0, p, dir);
        return p;
      }
      if (h.ground) {
        const normal = this.ctx.terrain.normalAt(p.x, p.z, new THREE.Vector3());
        this.ctx.effects.impact(p, normal, true);
        this.ctx.effects.bulletHole(p, normal);
        return p;
      }
      // face normal: the axis the ray came in along
      const n = dir.clone().negate();
      const normal = Math.abs(n.y) > 0.9 ? new THREE.Vector3(0, Math.sign(n.y), 0) : Math.abs(n.x) > Math.abs(n.z) ? new THREE.Vector3(Math.sign(n.x), 0, 0) : new THREE.Vector3(0, 0, Math.sign(n.z));
      this.ctx.effects.impact(p, normal);
      this.ctx.effects.bulletHole(p, normal);
      damage = penetrate(id, damage, h.exit! - h.t);
      walls++;
      if (damage < 1 || walls > 2) return p;
      this.ctx.effects.bulletHole(point(h.exit!), normal.clone().negate());
    }
    return point(far);
  }

  damage(victim: Agent, attacker: Agent, id: WeaponId, base: number, group: HitGroup, distance: number, wallbang: boolean, at: THREE.Vector3, dir: THREE.Vector3) {
    if (!victim.alive || this.hooks.isInvulnerable(victim)) return;
    let helmet: boolean;
    let res: { health: number };
    if (victim.gear) {
      const soaked = victim.gear.absorbHit(base * Math.pow(WEAPONS[id].falloff, distance / 12.7), group);
      helmet = soaked.helmet;
      res = soaked;
    } else {
      helmet = victim.inv.helmet && group === 'head';
      const cs = computeDamage(id, base, distance, group, victim.inv.armor, victim.inv.helmet);
      victim.inv.armor = Math.max(0, victim.inv.armor - cs.armor);
      if (victim.inv.armor <= 0) victim.inv.helmet = false;
      res = cs;
    }
    victim.health -= res.health;
    victim.tagUntil = this.ctx.now + 0.35;
    victim.damageFrom.set(attacker, (victim.damageFrom.get(attacker) ?? 0) + res.health);
    this.ctx.effects.blood(at, dir, group === 'head');
    if (victim === this.ctx.player) {
      this.ctx.hurtDirs.push({ from: attacker.pos.clone(), until: this.ctx.now + 1.2 });
      this.rig.notifyHit(attacker.pos, victim, this.ctx.now);
      this.ctx.sfx.hurt();
      victim.pitch += 0.015; // flinch
    }
    if (attacker === this.ctx.player && victim !== this.ctx.player) this.ctx.sfx.hit(group === 'head', helmet);
    if (victim.brain && !victim.brain.target) {
      victim.brain.lastKnown = attacker.pos.clone();
      victim.brain.seenAt = this.ctx.now - 1;
    }
    if (victim.health <= 0) this.kill(victim, attacker, id, group === 'head', wallbang);
    if (attacker === this.ctx.player && victim !== attacker) this.ctx.markHit(!victim.alive ? 'kill' : group === 'head' ? 'head' : 'body');
  }

  kill(victim: Agent, attacker: Agent, id: WeaponId | 'zone', headshot: boolean, wallbang: boolean) {
    victim.alive = false;
    victim.health = 0;
    victim.deaths++;
    victim.diedAt = this.ctx.now;
    victim.gear?.onDeath();
    this.hooks.leaveGear(victim);
    victim.inv.grenades = [];
    victim.inv.grenade = null;
    victim.body?.setWeapon(null);
    if (attacker !== victim && !allied(attacker, victim)) {
      attacker.kills++;
      attacker.roundKills++;
      if (headshot) attacker.headshots++;
      if (id !== 'zone') this.hooks.rewardKill(attacker, id);
    }
    for (const [a, dmg] of victim.damageFrom) if (a !== attacker && !allied(a, victim) && dmg > 40) a.assists++;
    this.ctx.killfeed.push({
      id: this.ctx.now + Math.random(), t: this.ctx.now, killer: attacker.name, killerTeam: attacker.team, victim: victim.name, victimTeam: victim.team, weapon: id, headshot, wallbang,
      mine: attacker === this.ctx.player || victim === this.ctx.player
    });
    if (this.ctx.killfeed.length > 6) this.ctx.killfeed.shift();
    if (victim === this.ctx.player) {
      this.ctx.killedBy = id === 'zone' ? 'Bạn bị bo xanh hạ gục' : attacker === victim ? 'Bạn tự hạ chính mình' : `Bị hạ bởi ${attacker.name} · ${WEAPONS[id].name}${headshot ? ' · trúng đầu' : ''}`;
      this.ctx.menus.closeAll();
      this.ctx.spectate = 0;
      this.rig.hideGun();
    }
    this.hooks.afterDeath(victim, attacker);
    this.ctx.notify();
  }

  private fire(a: Agent, w: WeaponState) {
    const def = WEAPONS[w.id];
    // inaccuracy is measured before this shot adds its own penalty: the first bullet is the accurate one
    const spread = inaccuracy(w, { speed: a.speed2d, crouched: a.crouch > 0.5, airborne: !a.onGround, prone: a.prone > 0.5 }) * this.aimSpread(a);
    const eye = a.eye();
    // the player's bullet leaves the muzzle in third person (the eye in first person) towards the point the crosshair is on
    const origin = a.isPlayer ? this.aim.shotOrigin(eye) : eye;
    const [yaw0, pitch0] = a.isPlayer ? this.aim.shotAngles(this.camera, origin, [a.yaw, a.pitch], this.ctx.solids, this.hitBody) : [a.yaw, a.pitch];
    const index = consumeShot(w);
    if (index < 0) return;
    const [px, py] = aimPunch(w.id, index, this.recoilScaleOf(a));
    const jitter = (Math.random() - 0.5) * 0.0015 * Math.min(index, 10);
    // shotgun pellets spread at least the gun's own cone, even down the sights
    const pelletSpread = def.pellets ? Math.max(spread, def.standInacc) : spread;
    let dir = new THREE.Vector3();
    let end = origin;
    for (let pellet = 0; pellet < (def.pellets ?? 1); pellet++) {
      const r = pelletSpread * Math.random();
      const th = Math.random() * Math.PI * 2;
      dir = dirFromAngles(yaw0 - px + Math.cos(th) * r + jitter, pitch0 + py + Math.sin(th) * r);
      end = this.traceBullet(a, w.id, origin, dir);
    }
    const muzzle = new THREE.Vector3();
    if (a.body) a.body.muzzleWorld(muzzle);
    else if (origin !== eye) muzzle.copy(origin);
    else muzzle.copy(eye).addScaledVector(dir, 0.6).add(new THREE.Vector3(0, -0.12, 0));
    this.ctx.effects.muzzle(muzzle, dir);
    if (!a.isPlayer || this.shotCount++ % 3 === 0) this.ctx.effects.tracer(muzzle, end, a.team === 'CT' ? 0xbfd8ff : 0xffd79a);
    if (a.isPlayer) {
      this.ctx.sfx.shot(w.id);
      this.vm.muzzleFlash();
      this.ctx.feedback.kick = 1;
      this.ctx.feedback.inspectAt = -99;
      this.aim.recoil.kick();
    } else this.ctx.sfx.shot(w.id, a.pos);
    if (w.id !== 'usp') this.ctx.heard.push({ pos: a.pos.clone(), squad: a.squad, t: this.ctx.now });
    // a scoped shot keeps the scope: dropping out of it for every bolt cycle made the picture jump (the bolt time is the weapon's cooldown)
    if (def.scope && w.zoom > 0 && !a.isPlayer) {
      // bots still look through the scope only between shots
      a.resumeZoom = 0;
      w.zoom = 0;
    }
  }

  private knife(a: Agent, heavy: boolean) {
    const w = a.inv.knife;
    if (!canFire(w)) return;
    consumeShot(w);
    if (heavy) w.cooldown = 1.0;
    const eye = a.eye();
    const dir = a.forward();
    let best: { agent: Agent; t: number; group: HitGroup } | null = null;
    for (const b of this.ctx.agents) {
      if (!b.alive || allied(b, a)) continue;
      const h = hitAgent(b, eye, dir, WEAPONS.knife.range);
      if (h && (!best || h.t < best.t)) best = { agent: b, ...h };
    }
    if (a.isPlayer) {
      this.ctx.feedback.swingAt = this.ctx.now;
      this.ctx.feedback.swingHeavy = heavy;
    }
    this.ctx.sfx.knife(!!best, a.isPlayer ? undefined : a.pos);
    if (!best) return;
    // backstab: the attacker is behind the victim
    const victimFwd = best.agent.forward().setY(0).normalize();
    const toAttacker = a.pos.clone().sub(best.agent.pos).setY(0).normalize();
    const back = victimFwd.dot(toAttacker) < -0.4;
    const dmg = (heavy ? 65 : 40) * (back ? (heavy ? 3 : 2.25) : 1);
    this.damage(best.agent, a, 'knife', dmg, best.group === 'head' ? 'chest' : best.group, 0, false, eye.clone().addScaledVector(dir, best.t), dir);
  }

  /** Reload, fire, scope and grenades; the same code drives the player and the bots. */
  updateWeapon(a: Agent, dt: number) {
    const w = activeWeapon(a.inv);
    if (!w) return;
    tickWeapon(w, dt);
    const def = WEAPONS[w.id];
    if (a.resumeZoom && w.cooldown <= 0) {
      if (w.reloadLeft <= 0) w.zoom = a.resumeZoom;
      a.resumeZoom = 0;
    }
    const inp = a.input;
    if (inp.reload && beginReload(w) && a.isPlayer) {
      this.ctx.sfx.reload(def.reload);
      this.ctx.feedback.inspectAt = -99;
    }
    const canShoot = (this.ctx.phase === 'live' || this.ctx.phase === 'roundEnd') && !a.swimming;
    if (def.slot === 4) {
      // hold to pull the pin, release to throw (left = far, right = short lob)
      if ((inp.fire || inp.alt) && !a.pin && w.deployLeft <= 0) a.pin = inp.fire ? 'fire' : 'alt';
      if (a.pin && !inp.fire && !inp.alt && canShoot) {
        const mode = a.pin;
        a.pin = '';
        this.hooks.throwGrenade(a, mode);
      }
      return;
    }
    // secondary attack (on press): AWP zoom levels / heavy knife stab
    if (inp.alt && !a.altLatch) {
      if (def.scope && w.reloadLeft <= 0 && w.deployLeft <= 0) {
        w.zoom = (w.zoom + 1) % (def.scope.length + 1);
        a.resumeZoom = 0;
        if (a.isPlayer) this.ctx.sfx.click(1300, 0.1);
      } else if (w.id === 'knife' && canShoot) this.knife(a, true);
    }
    a.altLatch = inp.alt;
    if (!inp.fire) {
      a.fireLatch = false;
      return;
    }
    if (!canShoot) return;
    if (w.id === 'knife') {
      this.knife(a, false);
      return;
    }
    if (!def.auto && a.fireLatch) return;
    if (w.ammo === 0 && w.reloadLeft <= 0) {
      // dry fire: click, then reload automatically
      if (!a.fireLatch) {
        if (a.isPlayer) this.ctx.sfx.click();
        if (beginReload(w) && a.isPlayer) this.ctx.sfx.reload(def.reload);
      }
      a.fireLatch = true;
      return;
    }
    if (canFire(w)) {
      a.fireLatch = true;
      this.fire(a, w);
    }
  }
}

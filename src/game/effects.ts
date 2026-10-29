import * as THREE from 'three';
import { radialTexture } from './models';

interface Particle {
  sprite: THREE.Sprite;
  vel: THREE.Vector3;
  life: number;
  max: number;
  gravity: number;
  grow: number;
  size: number;
  fade: number;
  additive: boolean;
}

export interface SmokeVolume {
  center: THREE.Vector3;
  radius: number;
  /** Seconds since it popped. */
  age: number;
  life: number;
  group: THREE.Group;
}

/** Pooled world effects: bullet holes, particles, tracers, flashes of light and smoke clouds. */
export class Effects {
  private readonly decals: THREE.Mesh[] = [];
  private decalIndex = 0;
  private readonly particles: Particle[] = [];
  private readonly tracers: { line: THREE.Line; ttl: number }[] = [];
  readonly smokes: SmokeVolume[] = [];
  private readonly soft: THREE.Texture;
  private readonly hole: THREE.Texture;
  private readonly decalMat: THREE.MeshBasicMaterial;
  private readonly decalGeo = new THREE.PlaneGeometry(0.11, 0.11);
  private readonly lights: { light: THREE.PointLight; ttl: number }[] = [];

  constructor(private readonly scene: THREE.Scene) {
    this.soft = radialTexture([[0, 'rgba(255,255,255,1)'], [0.4, 'rgba(255,255,255,0.6)'], [1, 'rgba(255,255,255,0)']]);
    this.hole = radialTexture([[0, 'rgba(10,10,10,1)'], [0.35, 'rgba(20,18,16,0.95)'], [0.55, 'rgba(60,55,50,0.5)'], [1, 'rgba(60,55,50,0)']]);
    this.decalMat = new THREE.MeshBasicMaterial({ map: this.hole, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 });
    for (let i = 0; i < 160; i++) {
      const m = new THREE.Mesh(this.decalGeo, this.decalMat);
      m.visible = false;
      scene.add(m);
      this.decals.push(m);
    }
    for (let i = 0; i < 4; i++) {
      const light = new THREE.PointLight(0xffc070, 0, 8, 2);
      scene.add(light);
      this.lights.push({ light, ttl: 0 });
    }
  }

  bulletHole(point: THREE.Vector3, normal: THREE.Vector3) {
    const m = this.decals[this.decalIndex++ % this.decals.length];
    m.position.copy(point).addScaledVector(normal, 0.004);
    m.lookAt(point.clone().add(normal));
    m.rotateZ(Math.random() * Math.PI);
    m.visible = true;
  }

  private spawn(pos: THREE.Vector3, vel: THREE.Vector3, color: number, size: number, life: number, gravity: number, opts: { additive?: boolean; grow?: number; opacity?: number } = {}) {
    const additive = !!opts.additive;
    let p = this.particles.find((q) => q.life <= 0 && q.additive === additive);
    if (!p) {
      if (this.particles.length > 420) return;
      const mat = new THREE.SpriteMaterial({ map: this.soft, transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending });
      p = { sprite: new THREE.Sprite(mat), vel: new THREE.Vector3(), life: 0, max: 1, gravity: 0, grow: 0, size: 1, fade: 1, additive };
      this.scene.add(p.sprite);
      this.particles.push(p);
    }
    p.sprite.position.copy(pos);
    p.sprite.material.color.setHex(color);
    p.sprite.material.opacity = opts.opacity ?? 1;
    p.sprite.material.rotation = Math.random() * Math.PI * 2;
    p.sprite.visible = true;
    p.sprite.scale.setScalar(size);
    p.vel.copy(vel);
    p.life = p.max = life;
    p.gravity = gravity;
    p.grow = opts.grow ?? 0;
    p.size = size;
    p.fade = opts.opacity ?? 1;
  }

  private rand(spread: number) {
    return new THREE.Vector3((Math.random() - 0.5) * spread, (Math.random() - 0.5) * spread, (Math.random() - 0.5) * spread);
  }

  /** Dust (+ sparks on hard surfaces) where a bullet hits. */
  impact(point: THREE.Vector3, normal: THREE.Vector3, ground = false) {
    for (let i = 0; i < 4; i++) this.spawn(point, normal.clone().multiplyScalar(0.8 + Math.random()).add(this.rand(1.2)), ground ? 0x8a7d62 : 0xb8b0a0, 0.12, 0.45, 1.5, { grow: 0.5, opacity: 0.7 });
    if (!ground) for (let i = 0; i < 3; i++) this.spawn(point, normal.clone().multiplyScalar(3).add(this.rand(5)), 0xffc46a, 0.03, 0.18, 9, { additive: true });
  }

  blood(point: THREE.Vector3, dir: THREE.Vector3, headshot: boolean) {
    const n = headshot ? 9 : 5;
    for (let i = 0; i < n; i++) this.spawn(point, dir.clone().multiplyScalar(1.5).add(this.rand(1.6)), 0x8a1414, 0.09 + Math.random() * 0.06, 0.5, 6, { opacity: 0.9, grow: 0.3 });
  }

  tracer(from: THREE.Vector3, to: THREE.Vector3, color = 0xffe2a0) {
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([from, to]), new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.75 }));
    this.scene.add(line);
    this.tracers.push({ line, ttl: 0.05 });
  }

  /** Short-lived light at a muzzle or explosion. */
  flashLight(pos: THREE.Vector3, intensity = 6, ttl = 0.05, color = 0xffc070) {
    const slot = this.lights.reduce((a, b) => (a.ttl < b.ttl ? a : b));
    slot.light.position.copy(pos);
    slot.light.color.setHex(color);
    slot.light.intensity = intensity;
    slot.light.distance = intensity > 20 ? 25 : 8;
    slot.ttl = ttl;
  }

  muzzle(pos: THREE.Vector3, dir: THREE.Vector3) {
    this.spawn(pos, dir.clone().multiplyScalar(2), 0xffd28a, 0.22, 0.04, 0, { additive: true });
    this.flashLight(pos, 4, 0.04);
  }

  explosion(pos: THREE.Vector3) {
    for (let i = 0; i < 18; i++) this.spawn(pos, this.rand(9).setY(Math.random() * 6), 0xffa040, 0.6, 0.35, 2, { additive: true, grow: 3 });
    for (let i = 0; i < 14; i++) this.spawn(pos.clone().add(this.rand(1)), this.rand(4).setY(1 + Math.random() * 2), 0x3a3632, 1.2, 1.6, -0.4, { grow: 2.2, opacity: 0.75 });
    this.flashLight(pos, 60, 0.12, 0xffa050);
  }

  flashbang(pos: THREE.Vector3) {
    this.spawn(pos, new THREE.Vector3(), 0xffffff, 4, 0.12, 0, { additive: true, grow: 10 });
    this.flashLight(pos, 120, 0.1, 0xffffff);
  }

  smoke(center: THREE.Vector3): SmokeVolume {
    const group = new THREE.Group();
    group.position.copy(center).setY(0);
    for (let i = 0; i < 34; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.soft, color: 0xb9bcbd, transparent: true, depthWrite: false, opacity: 0 }));
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * 3.4;
      s.position.set(Math.cos(a) * r, 0.6 + Math.random() * 3.2, Math.sin(a) * r);
      s.userData.size = 3.2 + Math.random() * 2.2;
      s.userData.spin = (Math.random() - 0.5) * 0.15;
      group.add(s);
    }
    this.scene.add(group);
    const v: SmokeVolume = { center: center.clone().setY(1.8), radius: 0, age: 0, life: 18, group };
    this.smokes.push(v);
    return v;
  }

  /** Whether a segment passes through an opaque smoke cloud. */
  smokeBlocks(a: THREE.Vector3, b: THREE.Vector3) {
    const ab = b.clone().sub(a);
    const len = ab.length();
    ab.divideScalar(len || 1);
    for (const s of this.smokes) {
      if (s.radius < 1.5) continue;
      const t = Math.max(0, Math.min(len, s.center.clone().sub(a).dot(ab)));
      const closest = a.clone().addScaledVector(ab, t);
      // the cloud is taller than wide: squash y before the distance test
      const dx = closest.x - s.center.x;
      const dy = (closest.y - s.center.y) * 0.75;
      const dz = closest.z - s.center.z;
      if (dx * dx + dy * dy + dz * dz < s.radius * s.radius * 0.8) return true;
    }
    return false;
  }

  /** Whether a point is inside a smoke (used to grey out the screen). */
  smokeDensity(p: THREE.Vector3) {
    let d = 0;
    for (const s of this.smokes) {
      if (s.radius <= 0) continue;
      const dist = p.distanceTo(s.center);
      d = Math.max(d, Math.max(0, Math.min(1, (s.radius - dist) / 1.5)));
    }
    return d;
  }

  private disposeSmoke(s: SmokeVolume) {
    s.group.children.forEach((c) => (c as THREE.Sprite).material.dispose());
    s.group.removeFromParent();
  }

  update(dt: number) {
    for (const p of this.particles) {
      if (p.life <= 0) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.sprite.visible = false;
        continue;
      }
      p.vel.y -= p.gravity * dt;
      p.vel.multiplyScalar(Math.exp(-dt * 1.5));
      p.sprite.position.addScaledVector(p.vel, dt);
      if (p.sprite.position.y < 0.02) {
        p.sprite.position.y = 0.02;
        p.vel.y = 0;
      }
      const t = p.life / p.max;
      p.sprite.material.opacity = p.fade * t;
      p.sprite.scale.setScalar(p.size * (1 + p.grow * (1 - t)));
    }
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i];
      t.ttl -= dt;
      (t.line.material as THREE.LineBasicMaterial).opacity = Math.max(0, t.ttl / 0.05) * 0.75;
      if (t.ttl <= 0) {
        t.line.removeFromParent();
        t.line.geometry.dispose();
        (t.line.material as THREE.Material).dispose();
        this.tracers.splice(i, 1);
      }
    }
    for (const l of this.lights) {
      l.ttl -= dt;
      if (l.ttl <= 0) l.light.intensity = 0;
    }
    for (let i = this.smokes.length - 1; i >= 0; i--) {
      const s = this.smokes[i];
      s.age += dt;
      const grow = Math.min(1, s.age / 1.2);
      const fadeOut = Math.max(0, Math.min(1, (s.life - s.age) / 2.5));
      s.radius = 4.3 * grow * Math.min(1, fadeOut / 0.4);
      s.group.children.forEach((c) => {
        const sp = c as THREE.Sprite;
        sp.scale.setScalar(sp.userData.size * (0.3 + 0.7 * grow));
        sp.material.opacity = 0.92 * grow * fadeOut;
        sp.material.rotation += sp.userData.spin * dt;
      });
      if (s.age >= s.life) {
        this.disposeSmoke(s);
        this.smokes.splice(i, 1);
      }
    }
  }

  /** Clear holes, smokes and particles between rounds. */
  reset() {
    this.decals.forEach((d) => (d.visible = false));
    this.particles.forEach((p) => {
      p.life = 0;
      p.sprite.visible = false;
    });
    this.smokes.forEach((s) => this.disposeSmoke(s));
    this.smokes.length = 0;
  }

  dispose() {
    this.reset();
    this.decalGeo.dispose();
    this.decalMat.dispose();
    this.particles.forEach((p) => p.sprite.material.dispose());
    this.tracers.forEach((t) => {
      t.line.geometry.dispose();
      (t.line.material as THREE.Material).dispose();
    });
    this.soft.dispose();
    this.hole.dispose();
  }
}

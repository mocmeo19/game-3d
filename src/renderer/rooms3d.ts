import * as THREE from 'three';

/**
 * Real 3D backdrops (no painting): each builder returns a group placed around the stage, an `update(t)` for what moves and a
 * `dispose`. The character stands at the origin and the camera looks towards -z, so the scenery fills the back and the sides and
 * leaves the front clear. `y0` is the height of the stage floor.
 */

export interface Room {
  group: THREE.Group;
  update(t: number): void;
  dispose(): void;
}

interface Kit {
  group: THREE.Group;
  keep<T extends { dispose(): void }>(x: T): T;
  rnd(): number;
  glow(color: string): THREE.SpriteMaterial;
  floor(color: number, rough: number, metal: number, y0: number, radius?: number): THREE.Mesh;
  finish(update: (t: number) => void): Room;
}

const kit = (seed: number): Kit => {
  const group = new THREE.Group();
  const own: { dispose(): void }[] = [];
  let s = seed;
  const keep = <T extends { dispose(): void }>(x: T) => (own.push(x), x);
  return {
    group,
    keep,
    rnd: () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646,
    glow(color) {
      const c = document.createElement('canvas');
      c.width = c.height = 64;
      const g = c.getContext('2d')!;
      const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      r.addColorStop(0, color);
      r.addColorStop(0.35, color.replace(/[\d.]+\)$/, '0.3)'));
      r.addColorStop(1, color.replace(/[\d.]+\)$/, '0)'));
      g.fillStyle = r;
      g.fillRect(0, 0, 64, 64);
      const tex = keep(new THREE.CanvasTexture(c));
      tex.colorSpace = THREE.SRGBColorSpace;
      return keep(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    },
    floor(color, rough, metal, y0, radius = 40) {
      const m = new THREE.Mesh(
        keep(new THREE.CircleGeometry(radius, 64)),
        keep(new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, envMapIntensity: 0.2 }))
      );
      m.rotation.x = -Math.PI / 2;
      m.position.y = y0 - 0.003;
      m.receiveShadow = true;
      group.add(m);
      return m;
    },
    finish(update) {
      return {
        group,
        update,
        dispose() {
          own.forEach((o) => o.dispose());
          group.removeFromParent();
        }
      };
    }
  };
};

/** Set one instance of an InstancedMesh from a position, rotation and scale. */
const place = (mesh: THREE.InstancedMesh, i: number, p: THREE.Vector3, rot: THREE.Euler, sc: THREE.Vector3) => {
  mesh.setMatrixAt(i, new THREE.Matrix4().compose(p, new THREE.Quaternion().setFromEuler(rot), sc));
};

/** A point behind or beside the stage: angle 0 is straight behind, ±π/2 is to the sides. */
const around = (angle: number, radius: number) => new THREE.Vector3(Math.sin(angle) * radius, 0, -Math.cos(angle) * radius + 0.4);

/** Keep scenery out of the camera's view of the character: anything in front of the stage is mirrored to the back. */
const behind = (p: THREE.Vector3, limit: number) => (p.z > limit ? new THREE.Vector3(p.x, p.y, -p.z + limit) : p);

/** Little lights drifting through the air (fireflies, sparkles, dust). */
const motes = (k: Kit, count: number, color: number, size: number, spread: number, y0: number, top: number) => {
  const pos = new Float32Array(count * 3);
  const base = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const p = around((k.rnd() - 0.5) * Math.PI * 1.7, 1.5 + k.rnd() * spread);
    base.set([p.x, y0 + 0.2 + k.rnd() * top, p.z], i * 3);
  }
  pos.set(base);
  const geo = k.keep(new THREE.BufferGeometry());
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = k.keep(new THREE.PointsMaterial({ color, size, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  k.group.add(pts);
  return (t: number) => {
    for (let i = 0; i < count; i++) {
      pos[i * 3] = base[i * 3] + Math.sin(t * 0.4 + i) * 0.35;
      pos[i * 3 + 1] = base[i * 3 + 1] + Math.sin(t * 0.55 + i * 1.7) * 0.25;
      pos[i * 3 + 2] = base[i * 3 + 2] + Math.cos(t * 0.35 + i * 0.8) * 0.35;
    }
    geo.attributes.position.needsUpdate = true;
    mat.opacity = 0.65 + 0.3 * Math.sin(t * 1.3);
  };
};

/** Moon: a pale disc with a halo, far behind the stage. */
const moon = (k: Kit, x: number, y: number, z: number, r: number, color: number, halo: string) => {
  const disc = new THREE.Mesh(k.keep(new THREE.CircleGeometry(r, 48)), k.keep(new THREE.MeshBasicMaterial({ color, fog: false })));
  disc.position.set(x, y, z);
  const sprite = new THREE.Sprite(k.glow(halo));
  sprite.scale.setScalar(r * 7);
  sprite.position.set(x, y, z - 0.1);
  k.group.add(sprite, disc);
};

/* ───────────────────────── Bamboo forest under the moon ───────────────────────── */
export const buildBamboo = (y0: number): Room => {
  const k = kit(7711);
  k.floor(0x0b1a16, 0.85, 0.02, y0);
  moon(k, -3.5, y0 + 6.5, -17, 1.6, 0xeafff4, 'rgba(190,255,225,0.9)');

  const stalks = 90;
  const stalkGeo = k.keep(new THREE.CylinderGeometry(0.07, 0.085, 16, 8));
  const stalkMat = k.keep(new THREE.MeshStandardMaterial({ color: 0x4f8f5a, roughness: 0.55, emissive: 0x0a2a18, emissiveIntensity: 0.5 }));
  const stalkMesh = new THREE.InstancedMesh(stalkGeo, stalkMat, stalks);
  const nodeGeo = k.keep(new THREE.CylinderGeometry(0.1, 0.1, 0.05, 8));
  const nodeMat = k.keep(new THREE.MeshStandardMaterial({ color: 0x2f6a3c, roughness: 0.6 }));
  const perStalk = 11;
  const nodeMesh = new THREE.InstancedMesh(nodeGeo, nodeMat, stalks * perStalk);
  const leafGeo = k.keep(new THREE.ConeGeometry(0.07, 0.9, 4));
  const leafMat = k.keep(new THREE.MeshStandardMaterial({ color: 0x78c070, roughness: 0.7, emissive: 0x143a1c, emissiveIntensity: 0.4 }));
  const leafMesh = new THREE.InstancedMesh(leafGeo, leafMat, stalks * 6);
  const one = new THREE.Vector3(1, 1, 1);
  for (let i = 0; i < stalks; i++) {
    const wide = k.rnd() < 0.25;
    const p = behind(around((k.rnd() - 0.5) * Math.PI * (wide ? 2.1 : 1.55), 2.8 + k.rnd() * 11), 1.5);
    const lean = new THREE.Euler((k.rnd() - 0.5) * 0.06, 0, (k.rnd() - 0.5) * 0.06);
    place(stalkMesh, i, new THREE.Vector3(p.x, y0 + 8, p.z), lean, one);
    for (let n = 0; n < perStalk; n++) place(nodeMesh, i * perStalk + n, new THREE.Vector3(p.x, y0 + 0.8 + n * 1.35, p.z), lean, one);
    for (let l = 0; l < 6; l++) {
      const a = k.rnd() * Math.PI * 2;
      place(leafMesh, i * 6 + l, new THREE.Vector3(p.x + Math.cos(a) * 0.3, y0 + 5 + k.rnd() * 7, p.z + Math.sin(a) * 0.3), new THREE.Euler(Math.PI / 2 - 0.5, 0, a), new THREE.Vector3(1.4, 1, 1));
    }
  }
  [stalkMesh, nodeMesh, leafMesh].forEach((m) => {
    m.frustumCulled = false;
    k.group.add(m);
  });
  const fire = motes(k, 46, 0xd8ff8a, 0.07, 9, y0, 3);
  const l1 = new THREE.PointLight(0x8affc8, 7, 11, 1.6);
  l1.position.set(-2.4, y0 + 1.8, -2.6);
  const l2 = new THREE.PointLight(0xb0d8ff, 5, 10, 1.6);
  l2.position.set(2.6, y0 + 2.4, -3);
  k.group.add(l1, l2);
  return k.finish((t) => {
    fire(t);
    [stalkMesh, nodeMesh, leafMesh].forEach((m) => (m.rotation.z = Math.sin(t * 0.35) * 0.004));
    l1.intensity = 7 * (0.92 + 0.08 * Math.sin(t * 1.1));
  });
};

/* ───────────────────────── Snowy peaks with an aurora ───────────────────────── */
export const buildSnow = (y0: number): Room => {
  const k = kit(4242);
  k.floor(0xdfe9f5, 0.92, 0, y0);

  const mountMat = k.keep(new THREE.MeshStandardMaterial({ color: 0x4a5f80, roughness: 0.95, flatShading: true }));
  const capMat = k.keep(new THREE.MeshStandardMaterial({ color: 0xf2f7ff, roughness: 0.9, flatShading: true }));
  const mountGeo = k.keep(new THREE.ConeGeometry(1, 1, 6));
  for (let i = 0; i < 16; i++) {
    const a = (i / 15 - 0.5) * Math.PI * 1.4 + (k.rnd() - 0.5) * 0.1;
    const h = 8 + k.rnd() * 12;
    const w = 6 + k.rnd() * 6;
    const p = around(a, 20 + k.rnd() * 14);
    const m = new THREE.Mesh(mountGeo, mountMat);
    m.scale.set(w, h, w);
    m.position.set(p.x, y0 + h / 2 - 0.5, p.z);
    const cap = new THREE.Mesh(mountGeo, capMat);
    cap.scale.set(w * 0.42, h * 0.38, w * 0.42);
    cap.position.set(p.x, y0 + h * 0.81 - 0.5, p.z);
    k.group.add(m, cap);
  }

  // pines: three stacked cones on a trunk, snow on each
  const pines = 60;
  const coneGeo = k.keep(new THREE.ConeGeometry(0.9, 1.6, 7));
  const pineMat = k.keep(new THREE.MeshStandardMaterial({ color: 0x1d3f36, roughness: 0.85 }));
  const snowMat = k.keep(new THREE.MeshStandardMaterial({ color: 0xeaf2fa, roughness: 0.9 }));
  const trunkGeo = k.keep(new THREE.CylinderGeometry(0.1, 0.14, 1, 6));
  const trunkMat = k.keep(new THREE.MeshStandardMaterial({ color: 0x4a3426, roughness: 0.9 }));
  const trees = new THREE.InstancedMesh(coneGeo, pineMat, pines * 3);
  const caps = new THREE.InstancedMesh(coneGeo, snowMat, pines * 3);
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, pines);
  const none = new THREE.Euler();
  for (let i = 0; i < pines; i++) {
    const p = behind(around((k.rnd() - 0.5) * Math.PI * 1.9, 7 + k.rnd() * 14), 1.2);
    const s = 0.6 + k.rnd() * 1.1;
    place(trunks, i, new THREE.Vector3(p.x, y0 + 0.5 * s, p.z), none, new THREE.Vector3(s, s, s));
    for (let l = 0; l < 3; l++) {
      const sc = s * (1 - l * 0.25);
      const pos = new THREE.Vector3(p.x, y0 + (1 + l * 0.95) * s, p.z);
      place(trees, i * 3 + l, pos, none, new THREE.Vector3(sc, sc, sc));
      place(caps, i * 3 + l, pos.clone().add(new THREE.Vector3(0, 0.12 * s, 0)), none, new THREE.Vector3(sc * 0.78, sc * 0.82, sc * 0.78));
    }
  }
  [trees, caps, trunks].forEach((m) => {
    m.frustumCulled = false;
    k.group.add(m);
  });

  // aurora: big additive curtains with a moving gradient
  const aurora = k.keep(
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      fog: false,
      uniforms: { t: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `varying vec2 vUv; uniform float t;
        void main() {
          float band = sin(vUv.x * 9.0 + t * 0.4) * 0.5 + 0.5;
          float fade = smoothstep(0.0, 0.25, vUv.y) * (1.0 - smoothstep(0.55, 1.0, vUv.y));
          vec3 c = mix(vec3(0.1, 1.0, 0.55), vec3(0.6, 0.3, 1.0), vUv.y + 0.2 * sin(vUv.x * 4.0 + t * 0.3));
          gl_FragColor = vec4(c * (0.25 + 0.45 * band) * fade, 1.0);
        }`
    })
  );
  const planeGeo = k.keep(new THREE.PlaneGeometry(40, 12, 1, 1));
  for (const [x, y, z, ry] of [[-6, 11, -26, 0.15], [8, 13, -30, -0.2], [0, 15, -34, 0]] as const) {
    const m = new THREE.Mesh(planeGeo, aurora);
    m.position.set(x, y0 + y, z);
    m.rotation.y = ry;
    k.group.add(m);
  }
  const l1 = new THREE.PointLight(0x9fd0ff, 6, 12, 1.5);
  l1.position.set(-2.5, y0 + 2.2, -2.5);
  k.group.add(l1);
  return k.finish((t) => {
    aurora.uniforms.t.value = t;
  });
};

/* ───────────────────────── Neon city in the rain ───────────────────────── */
const windowsTexture = (k: Kit) => {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = '#05050a';
  g.fillRect(0, 0, 128, 256);
  const cols = ['#ffd27a', '#7af0ff', '#ff7ad8', '#ffffff'];
  for (let y = 6; y < 250; y += 14)
    for (let x = 6; x < 122; x += 14) {
      if (k.rnd() < 0.45) {
        g.fillStyle = cols[Math.floor(k.rnd() * cols.length)];
        g.globalAlpha = 0.5 + k.rnd() * 0.5;
        g.fillRect(x, y, 8, 9);
      }
    }
  g.globalAlpha = 1;
  const tex = k.keep(new THREE.CanvasTexture(c));
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
};

export const buildNeon = (y0: number): Room => {
  const k = kit(9090);
  const floor = k.floor(0x07070d, 0.12, 0.7, y0);
  // a neon grid on the wet street
  {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d')!;
    g.fillStyle = '#000';
    g.fillRect(0, 0, 256, 256);
    g.strokeStyle = '#ff2fb0';
    g.lineWidth = 3;
    g.strokeRect(0, 0, 256, 256);
    g.strokeStyle = '#2fe0ff';
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(128, 0);
    g.lineTo(128, 256);
    g.moveTo(0, 128);
    g.lineTo(256, 128);
    g.stroke();
    const tex = k.keep(new THREE.CanvasTexture(c));
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(24, 24);
    tex.colorSpace = THREE.SRGBColorSpace;
    const m = floor.material as THREE.MeshStandardMaterial;
    m.emissive = new THREE.Color(0xffffff);
    m.emissiveMap = tex;
    m.emissiveIntensity = 0.35;
  }

  const win = windowsTexture(k);
  const boxGeo = k.keep(new THREE.BoxGeometry(1, 1, 1));
  const n = 70;
  const bodyMat = k.keep(new THREE.MeshStandardMaterial({ color: 0x14141f, roughness: 0.6, metalness: 0.3, emissive: 0xffffff, emissiveMap: win, emissiveIntensity: 0.9 }));
  const towers = new THREE.InstancedMesh(boxGeo, bodyMat, n);
  for (let i = 0; i < n; i++) {
    const w = 1.8 + k.rnd() * 2.6;
    const h = 5 + k.rnd() * 22;
    const p = behind(around((k.rnd() - 0.5) * Math.PI * 1.9, 9 + k.rnd() * 16), 0.5);
    place(towers, i, new THREE.Vector3(p.x, y0 + h / 2 - 0.02, p.z), new THREE.Euler(0, k.rnd() * 0.4, 0), new THREE.Vector3(w, h, w));
  }
  towers.frustumCulled = false;
  k.group.add(towers);

  // neon signs: glowing bars with halos
  const colors = [0xff2fb0, 0x2fe0ff, 0xffd83a, 0x8a5cff];
  const halos = ['rgba(255,47,176,0.9)', 'rgba(47,224,255,0.9)', 'rgba(255,216,58,0.9)', 'rgba(138,92,255,0.9)'].map((c) => k.glow(c));
  const signs: { mat: THREE.MeshBasicMaterial; color: number; phase: number }[] = [];
  for (let i = 0; i < 16; i++) {
    const ci = i % colors.length;
    const mat = k.keep(new THREE.MeshBasicMaterial({ color: colors[ci] }));
    const vertical = k.rnd() < 0.5;
    const bar = new THREE.Mesh(boxGeo, mat);
    bar.scale.set(vertical ? 0.12 : 1.4 + k.rnd(), vertical ? 1.6 + k.rnd() * 1.5 : 0.12, 0.12);
    const p = behind(around((k.rnd() - 0.5) * Math.PI * 1.6, 3.5 + k.rnd() * 7), 0.2);
    bar.position.set(p.x, y0 + 1.2 + k.rnd() * 5, p.z);
    const halo = new THREE.Sprite(halos[ci]);
    halo.scale.set(3.5 / bar.scale.x, 3.5 / bar.scale.y, 1);
    bar.add(halo);
    k.group.add(bar);
    signs.push({ mat, color: colors[ci], phase: k.rnd() * 6 });
  }

  // rain streaks
  const drops = 220;
  const rpos = new Float32Array(drops * 6);
  const seeds = Array.from({ length: drops }, () => {
    const p = around((k.rnd() - 0.5) * Math.PI * 1.9, 0.8 + k.rnd() * 9);
    return { x: p.x, z: p.z, y: k.rnd() * 9, v: 9 + k.rnd() * 5 };
  });
  const rgeo = k.keep(new THREE.BufferGeometry());
  rgeo.setAttribute('position', new THREE.BufferAttribute(rpos, 3));
  const rain = new THREE.LineSegments(rgeo, k.keep(new THREE.LineBasicMaterial({ color: 0x9fc8ff, transparent: true, opacity: 0.35 })));
  rain.frustumCulled = false;
  k.group.add(rain);

  const l1 = new THREE.PointLight(0xff2fb0, 9, 12, 1.5);
  l1.position.set(-2.6, y0 + 1.8, -2);
  const l2 = new THREE.PointLight(0x2fe0ff, 9, 12, 1.5);
  l2.position.set(2.6, y0 + 1.6, -2.4);
  k.group.add(l1, l2);
  return k.finish((t) => {
    seeds.forEach((d, i) => {
      const y = y0 + 9 - ((d.y + t * d.v) % 9);
      rpos.set([d.x, y, d.z, d.x - 0.03, y + 0.45, d.z], i * 6);
    });
    rgeo.attributes.position.needsUpdate = true;
    signs.forEach((s) => {
      const flicker = Math.sin(t * 0.7 + s.phase) > 0.85 ? 0.35 + 0.65 * Math.abs(Math.sin(t * 38 + s.phase)) : 1;
      s.mat.color.setHex(s.color).multiplyScalar(flicker);
    });
    l1.intensity = 9 * (0.85 + 0.15 * Math.sin(t * 2.1));
    l2.intensity = 9 * (0.85 + 0.15 * Math.sin(t * 1.7 + 1));
  });
};

/* ───────────────────────── Lotus lake at night ───────────────────────── */
export const buildLotus = (y0: number): Room => {
  const k = kit(5150);
  k.floor(0x07202c, 0.07, 0.55, y0);
  moon(k, 4, y0 + 7, -18, 1.9, 0xfff6dc, 'rgba(255,240,200,0.9)');

  const padGeo = k.keep(new THREE.CylinderGeometry(1, 1, 0.025, 20));
  const padMat = k.keep(new THREE.MeshStandardMaterial({ color: 0x2f7a46, roughness: 0.6, emissive: 0x0c2a16, emissiveIntensity: 0.5 }));
  const pads = 70;
  const padMesh = new THREE.InstancedMesh(padGeo, padMat, pads);
  for (let i = 0; i < pads; i++) {
    const p = behind(around((k.rnd() - 0.5) * Math.PI * 2, 2 + k.rnd() * 14), 1.4);
    const r = 0.3 + k.rnd() * 0.5;
    place(padMesh, i, new THREE.Vector3(p.x, y0 + 0.01, p.z), new THREE.Euler(), new THREE.Vector3(r, 1, r));
  }
  padMesh.frustumCulled = false;
  k.group.add(padMesh);

  // flowers: a ring of pink petals around a golden heart, each with a soft halo
  const petalGeo = k.keep(new THREE.ConeGeometry(0.11, 0.42, 5));
  const petalMat = k.keep(new THREE.MeshStandardMaterial({ color: 0xff9ac8, roughness: 0.5, emissive: 0xff5a9a, emissiveIntensity: 0.55 }));
  const heartMat = k.keep(new THREE.MeshBasicMaterial({ color: 0xffd86a }));
  const heartGeo = k.keep(new THREE.SphereGeometry(0.07, 8, 6));
  const halo = k.glow('rgba(255,150,200,0.8)');
  const flowers: THREE.Group[] = [];
  for (let i = 0; i < 16; i++) {
    const f = new THREE.Group();
    for (let j = 0; j < 9; j++) {
      const petal = new THREE.Mesh(petalGeo, petalMat);
      const a = (j / 9) * Math.PI * 2;
      petal.position.set(Math.cos(a) * 0.12, 0.2, Math.sin(a) * 0.12);
      petal.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5);
      f.add(petal);
    }
    f.add(new THREE.Mesh(heartGeo, heartMat));
    const sprite = new THREE.Sprite(halo);
    sprite.scale.setScalar(1.3);
    sprite.position.y = 0.25;
    f.add(sprite);
    const p = behind(around((k.rnd() - 0.5) * Math.PI * 1.8, 2.2 + k.rnd() * 10), 1.2);
    f.position.set(p.x, y0 + 0.05, p.z);
    f.scale.setScalar(0.8 + k.rnd() * 1.3);
    f.userData.phase = k.rnd() * 6;
    k.group.add(f);
    flowers.push(f);
  }

  // ripples
  const ringGeo = k.keep(new THREE.RingGeometry(0.95, 1, 40));
  const ripples = Array.from({ length: 5 }, (_, i) => {
    const m = new THREE.Mesh(ringGeo, k.keep(new THREE.MeshBasicMaterial({ color: 0xbfe8ff, transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false })));
    m.rotation.x = -Math.PI / 2;
    const p = around((k.rnd() - 0.5) * Math.PI * 1.6, 1.8 + k.rnd() * 6);
    m.position.set(p.x, y0 + 0.012, p.z);
    k.group.add(m);
    return { m, off: i * 1.3 };
  });
  const fire = motes(k, 40, 0xfff0a0, 0.06, 9, y0, 2.5);
  const l1 = new THREE.PointLight(0xff9ac8, 6, 10, 1.6);
  l1.position.set(-2.2, y0 + 1.2, -2.4);
  const l2 = new THREE.PointLight(0x9fe8ff, 5, 11, 1.6);
  l2.position.set(2.6, y0 + 2, -3);
  k.group.add(l1, l2);
  return k.finish((t) => {
    fire(t);
    flowers.forEach((f) => (f.rotation.z = Math.sin(t * 0.6 + f.userData.phase) * 0.05));
    ripples.forEach((r) => {
      const u = ((t + r.off) % 6.5) / 6.5;
      r.m.scale.setScalar(0.15 + u * 1.4);
      (r.m.material as THREE.MeshBasicMaterial).opacity = 0.35 * (1 - u);
    });
  });
};

/* ───────────────────────── Crystal cave ───────────────────────── */
export const buildCrystal = (y0: number): Room => {
  const k = kit(1313);
  k.floor(0x120c1e, 0.18, 0.55, y0);

  const colors = [0x35e0ff, 0xff4fd0, 0x9a6bff, 0xffb23a, 0x5cff9a];
  const halos = ['rgba(53,224,255,0.9)', 'rgba(255,79,208,0.9)', 'rgba(154,107,255,0.9)', 'rgba(255,178,58,0.9)', 'rgba(92,255,154,0.9)'].map((c) => k.glow(c));
  halos.forEach((h) => (h.opacity = 0.3));
  const bodyGeo = k.keep(new THREE.CylinderGeometry(0.5, 0.6, 1, 6));
  const tipGeo = k.keep(new THREE.ConeGeometry(0.5, 0.7, 6));
  const clusters: { phase: number; mat: THREE.MeshStandardMaterial }[] = [];
  for (let i = 0; i < 26; i++) {
    const ci = i % colors.length;
    const mat = k.keep(new THREE.MeshStandardMaterial({ color: colors[ci], emissive: colors[ci], emissiveIntensity: 0.5, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.85 }));
    const g = new THREE.Group();
    const spikes = 3 + Math.floor(k.rnd() * 4);
    for (let j = 0; j < spikes; j++) {
      const h = 0.8 + k.rnd() * 2.6;
      const s = 0.18 + k.rnd() * 0.28;
      const spike = new THREE.Group();
      const body = new THREE.Mesh(bodyGeo, mat);
      body.scale.set(s, h, s);
      body.position.y = h / 2;
      const tip = new THREE.Mesh(tipGeo, mat);
      tip.scale.set(s, h * 0.5, s);
      tip.position.y = h + 0.35 * h * 0.5;
      spike.add(body, tip);
      spike.rotation.set((k.rnd() - 0.5) * 0.7, k.rnd() * 6, (k.rnd() - 0.5) * 0.7);
      spike.position.set((k.rnd() - 0.5) * 0.8, 0, (k.rnd() - 0.5) * 0.8);
      g.add(spike);
    }
    const sprite = new THREE.Sprite(halos[ci]);
    sprite.scale.setScalar(2.6);
    sprite.position.y = 1;
    g.add(sprite);
    const p = behind(around((k.rnd() - 0.5) * Math.PI * 1.9, 4.5 + k.rnd() * 10), 0.8);
    g.position.set(p.x, y0, p.z);
    g.scale.setScalar(0.6 + k.rnd() * 1.1);
    k.group.add(g);
    clusters.push({ phase: k.rnd() * 6, mat });
  }
  const sparkle = motes(k, 70, 0xe8d8ff, 0.05, 10, y0, 5);
  const lights = [0x35e0ff, 0xff4fd0, 0x9a6bff].map((c, i) => {
    const l = new THREE.PointLight(c, 5, 11, 1.5);
    l.position.set([-2.8, 2.8, 0][i], y0 + [1.2, 1.4, 2.6][i], [-2, -2.4, -4][i]);
    k.group.add(l);
    return l;
  });
  return k.finish((t) => {
    sparkle(t);
    clusters.forEach((c) => (c.mat.emissiveIntensity = 0.45 + 0.2 * Math.sin(t * 1.4 + c.phase)));
    lights.forEach((l, i) => (l.intensity = 5 * (0.85 + 0.15 * Math.sin(t * 1.6 + i * 2))));
  });
};

/** Scene look of each 3D room: clear colour and fog density. */
export const ROOMS: Record<string, { build: (y0: number) => Room; bg: number; fog: number }> = {
  bamboo: { build: buildBamboo, bg: 0x04100e, fog: 0.045 },
  snow: { build: buildSnow, bg: 0x0a1630, fog: 0.018 },
  neon: { build: buildNeon, bg: 0x08060f, fog: 0.035 },
  lotus: { build: buildLotus, bg: 0x040f1a, fog: 0.04 },
  crystal: { build: buildCrystal, bg: 0x06030c, fog: 0.04 }
};

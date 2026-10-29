import * as THREE from 'three';
import type { WeaponKind } from '../../types/character';

/**
 * Class weapons built from extruded profiles, tapered shafts and wrapped grips instead of plain boxes.
 * Every weapon is defined in "hand space": the grip is at the origin, the long axis is +y unless noted.
 */

export interface WeaponMats {
  metal: THREE.Material;
  glow: THREE.Material;
  main: THREE.Material;
  accent: THREE.Material;
}

export interface WeaponSet {
  R: THREE.Object3D[];
  L: THREE.Object3D[];
}

let leather: THREE.MeshStandardMaterial | null = null;
let wood: THREE.MeshStandardMaterial | null = null;
let darkSteel: THREE.MeshStandardMaterial | null = null;
const leatherMat = () => (leather ??= new THREE.MeshStandardMaterial({ color: '#3a2a20', roughness: 0.6, metalness: 0.05 }));
const woodMat = () => (wood ??= new THREE.MeshStandardMaterial({ color: '#5b3a24', roughness: 0.55 }));
const steelDark = () => (darkSteel ??= new THREE.MeshStandardMaterial({ color: '#4a4f58', roughness: 0.32, metalness: 0.95 }));

const mesh = (g: THREE.BufferGeometry, m: THREE.Material) => {
  const o = new THREE.Mesh(g, m);
  o.castShadow = true;
  return o;
};

/** Flat blade with bevelled edges. Profile is in XY (length along +y), thickness along z. */
const blade = (len: number, width: number, thick: number, tipSkew = 0.25, bevel = 0.18): THREE.BufferGeometry => {
  const s = new THREE.Shape();
  const w = width / 2;
  const t = len * 0.12;
  s.moveTo(-w, 0);
  s.lineTo(-w * 0.96, len - t);
  s.quadraticCurveTo(-w * 0.5 + tipSkew * w, len - t * 0.2, tipSkew * w, len);
  s.quadraticCurveTo(w * 0.9, len - t * 0.5, w * 0.96, len - t * 1.3);
  s.lineTo(w, 0);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, {
    depth: thick,
    bevelEnabled: bevel > 0,
    bevelThickness: thick * 0.6,
    bevelSize: width * bevel * 0.4,
    bevelSegments: 2,
    steps: 1,
    curveSegments: 10
  });
  g.translate(0, 0, -thick / 2);
  g.computeVertexNormals();
  return g;
};

/** Grip with cord-wrap rings. */
const wrappedGrip = (len: number, r: number, y0: number, core: THREE.Material, wrap: THREE.Material): THREE.Object3D => {
  const g = new THREE.Group();
  const body = mesh(new THREE.CylinderGeometry(r, r * 0.94, len, 14), core);
  body.position.y = y0 + len / 2;
  g.add(body);
  const n = Math.max(3, Math.round(len / (r * 1.3)));
  for (let i = 0; i < n; i++) {
    const ring = mesh(new THREE.TorusGeometry(r * 1.02, r * 0.16, 6, 16), wrap);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = y0 + (len * (i + 0.5)) / n;
    g.add(ring);
  }
  return g;
};

/* ───────────────────────── Weapons ───────────────────────── */

const sword = (m: WeaponMats): THREE.Object3D => {
  const g = new THREE.Group();
  const b = mesh(blade(0.8, 0.036, 0.0055), m.metal);
  b.position.y = 0.03;
  g.add(b);
  // luminous fuller down the middle of the blade
  const f = new THREE.Mesh(blade(0.6, 0.007, 0.0075, 0, 0), m.glow);
  f.position.y = 0.06;
  g.add(f);
  // oval guard
  const guard = mesh(new THREE.SphereGeometry(1, 20, 12), m.accent);
  guard.scale.set(0.05, 0.007, 0.034);
  guard.position.y = 0.025;
  g.add(guard);
  const collar = mesh(new THREE.CylinderGeometry(0.018, 0.02, 0.018, 14), m.accent);
  collar.position.y = 0.04;
  g.add(collar);
  g.add(wrappedGrip(0.25, 0.0185, -0.23, m.main, leatherMat()));
  const pommel = mesh(new THREE.SphereGeometry(0.024, 14, 10), m.accent);
  pommel.scale.set(1, 0.7, 1);
  pommel.position.y = -0.245;
  g.add(pommel);
  return g;
};

const gauntlet = (m: WeaponMats): THREE.Object3D => {
  const g = new THREE.Group();
  const bracer = mesh(new THREE.CylinderGeometry(0.046, 0.04, 0.12, 20, 1, true), leatherMat());
  bracer.position.y = 0.035;
  (bracer.material as THREE.Material).side = THREE.DoubleSide;
  g.add(bracer);
  for (let i = 0; i < 3; i++) {
    const strap = mesh(new THREE.TorusGeometry(0.0465 - i * 0.0015, 0.004, 6, 20), m.accent);
    strap.rotation.x = Math.PI / 2;
    strap.position.y = i * 0.035;
    g.add(strap);
  }
  // knuckle guard: a metal band over the fingers with a row of studs pointing forward
  const band = mesh(new THREE.TorusGeometry(0.034, 0.0075, 8, 24), steelDark());
  band.rotation.x = Math.PI / 2;
  band.scale.set(0.55, 1, 1);
  band.position.set(0, -0.098, 0);
  g.add(band);
  for (let i = 0; i < 4; i++) {
    const stud = mesh(new THREE.ConeGeometry(0.0065, 0.02, 8), m.accent);
    stud.rotation.x = Math.PI / 2;
    stud.position.set(0, -0.098, 0.0275 - i * 0.0183);
    g.add(stud);
  }
  const aura = new THREE.Mesh(new THREE.SphereGeometry(0.075, 18, 14), m.glow);
  aura.position.set(0, -0.1, 0);
  g.add(aura);
  return g;
};

const chiBangle = (m: WeaponMats, side: number, orbColor: number): THREE.Object3D => {
  const g = new THREE.Group();
  g.name = `chiBangle_${side}`;
  g.add(mesh(new THREE.TorusGeometry(0.1, 0.007, 10, 48), m.accent));
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const tick = mesh(new THREE.BoxGeometry(0.006, 0.02, 0.008), m.accent);
    tick.position.set(Math.cos(a) * 0.1, Math.sin(a) * 0.1, 0);
    tick.rotation.z = a;
    g.add(tick);
  }
  g.add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.036, 2), new THREE.MeshBasicMaterial({ color: orbColor })));
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.052, 16, 12), new THREE.MeshBasicMaterial({ color: orbColor, transparent: true, opacity: 0.22, depthWrite: false })));
  g.position.set(0, -0.1, 0);
  return g;
};

const greatAxe = (m: WeaponMats): THREE.Object3D => {
  const g = new THREE.Group();
  // shaft: slightly tapered wood with a leather grip near the hand
  const shaft = mesh(new THREE.CylinderGeometry(0.02, 0.025, 1.1, 14), woodMat());
  shaft.position.y = 0.12;
  g.add(shaft);
  g.add(wrappedGrip(0.3, 0.026, -0.12, leatherMat(), m.accent));
  const butt = mesh(new THREE.ConeGeometry(0.028, 0.06, 12), steelDark());
  butt.rotation.x = Math.PI;
  butt.position.y = -0.46;
  g.add(butt);
  // crescent head: two blades with a hollowed profile
  const head = new THREE.Shape();
  head.moveTo(0, -0.09);
  head.quadraticCurveTo(0.12, -0.14, 0.2, -0.2);
  head.quadraticCurveTo(0.255, 0, 0.2, 0.2);
  head.quadraticCurveTo(0.12, 0.14, 0, 0.09);
  head.lineTo(0, -0.09);
  const hg = new THREE.ExtrudeGeometry(head, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.012, bevelSegments: 2, curveSegments: 14 });
  hg.translate(0, 0, -0.006);
  [1, -1].forEach((s) => {
    const h = mesh(hg, m.metal);
    h.scale.set(s * 0.72, 0.72, 1);
    h.position.y = 0.52;
    g.add(h);
  });
  const spike = mesh(new THREE.ConeGeometry(0.016, 0.16, 10), m.metal);
  spike.position.y = 0.7;
  g.add(spike);
  const socket = mesh(new THREE.CylinderGeometry(0.03, 0.027, 0.12, 14), steelDark());
  socket.position.y = 0.52;
  g.add(socket);
  [1, -1].forEach((s) => {
    const rune = new THREE.Mesh(new THREE.CircleGeometry(0.024, 16), m.glow);
    rune.position.set(0, 0.52, 0.03 * s);
    rune.rotation.y = s > 0 ? 0 : Math.PI;
    g.add(rune);
  });
  return g;
};

const dagger = (m: WeaponMats): THREE.Object3D => {
  const g = new THREE.Group();
  const b = mesh(blade(0.3, 0.032, 0.006, 0.4), m.metal);
  b.position.y = 0.03;
  g.add(b);
  const guard = mesh(new THREE.BoxGeometry(0.07, 0.009, 0.016), m.accent);
  guard.position.y = 0.027;
  g.add(guard);
  g.add(wrappedGrip(0.12, 0.0165, -0.09, m.main, leatherMat()));
  const pommel = mesh(new THREE.SphereGeometry(0.02, 12, 10), m.accent);
  pommel.position.y = -0.1;
  g.add(pommel);
  return g;
};

const staff = (m: WeaponMats): THREE.Object3D => {
  const g = new THREE.Group();
  const shaft = mesh(new THREE.CylinderGeometry(0.019, 0.023, 1.55, 14), woodMat());
  shaft.position.y = 0.1;
  g.add(shaft);
  g.add(wrappedGrip(0.26, 0.0245, -0.12, leatherMat(), m.accent));
  // head: open ring cradling a crystal, petals around it
  const ring = mesh(new THREE.TorusGeometry(0.07, 0.009, 10, 40), m.accent);
  ring.position.y = 0.97;
  g.add(ring);
  const gem = mesh(
    new THREE.IcosahedronGeometry(0.052, 1),
    new THREE.MeshPhysicalMaterial({ color: '#f472b6', roughness: 0.12, clearcoat: 1, emissive: '#c0267f', emissiveIntensity: 0.5 })
  );
  gem.scale.y = 1.35;
  gem.position.y = 0.97;
  g.add(gem);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const petal = mesh(new THREE.SphereGeometry(1, 12, 8), m.accent);
    petal.scale.set(0.012, 0.045, 0.006);
    petal.position.set(Math.cos(a) * 0.092, 0.97 + Math.sin(a) * 0.092, 0);
    petal.rotation.z = a - Math.PI / 2;
    g.add(petal);
  }
  const cup = mesh(new THREE.ConeGeometry(0.03, 0.08, 10), m.accent);
  cup.rotation.x = Math.PI;
  cup.position.y = 0.87;
  g.add(cup);
  return g;
};

const revolver = (m: WeaponMats): THREE.Object3D => {
  const g = new THREE.Group();
  // side profile (x = barrel direction, y = height), extruded to the gun's thickness then turned so x → z
  const s = new THREE.Shape();
  s.moveTo(-0.06, -0.01);
  s.lineTo(-0.05, 0.035);
  s.lineTo(-0.035, 0.045);
  s.lineTo(0.13, 0.045);
  s.lineTo(0.13, 0.015);
  s.lineTo(0.02, 0.015);
  s.lineTo(0.02, -0.01);
  s.closePath();
  const frame = new THREE.ExtrudeGeometry(s, { depth: 0.022, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 2 });
  frame.translate(0, 0, -0.011);
  frame.rotateY(-Math.PI / 2);
  g.add(mesh(frame, m.metal));
  const barrel = mesh(new THREE.CylinderGeometry(0.0085, 0.0095, 0.2, 14), steelDark());
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.032, 0.17);
  g.add(barrel);
  const drum = mesh(new THREE.CylinderGeometry(0.027, 0.027, 0.06, 18), steelDark());
  drum.rotation.x = Math.PI / 2;
  drum.position.set(0, 0.026, 0.045);
  g.add(drum);
  const grip = new THREE.Shape();
  grip.moveTo(0, 0);
  grip.lineTo(0.045, 0);
  grip.lineTo(0.05, -0.1);
  grip.quadraticCurveTo(0.02, -0.125, -0.02, -0.105);
  grip.lineTo(0, 0);
  const gg = new THREE.ExtrudeGeometry(grip, { depth: 0.024, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 2 });
  gg.translate(0, 0, -0.012);
  gg.rotateY(-Math.PI / 2);
  const gm = mesh(gg, woodMat());
  gm.position.set(0, 0, -0.05);
  g.add(gm);
  const guardRing = mesh(new THREE.TorusGeometry(0.024, 0.0035, 6, 18, Math.PI * 1.2), m.accent);
  guardRing.rotation.y = Math.PI / 2;
  guardRing.position.set(0, -0.008, 0.0);
  g.add(guardRing);
  const hammer = mesh(new THREE.BoxGeometry(0.008, 0.026, 0.012), steelDark());
  hammer.position.set(0, 0.058, -0.052);
  hammer.rotation.x = -0.5;
  g.add(hammer);
  return g;
};

/** Straight sword with a given blade length (Blade Dancer long sword, Dual Blade short swords, Warden greatsword). */
const straightSword = (m: WeaponMats, len: number, width: number, gripLen: number, guardW: number): THREE.Object3D => {
  const g = new THREE.Group();
  const b = mesh(blade(len, width, 0.005 + width * 0.08, 0.05), m.metal);
  b.position.y = 0.03;
  g.add(b);
  const f = new THREE.Mesh(blade(len * 0.75, width * 0.2, 0.0075 + width * 0.08, 0, 0), m.glow);
  f.position.y = 0.06;
  g.add(f);
  const guard = mesh(new THREE.BoxGeometry(guardW, 0.012, 0.022), m.accent);
  guard.position.y = 0.026;
  g.add(guard);
  [1, -1].forEach((s) => {
    const tip = mesh(new THREE.SphereGeometry(0.011, 10, 8), m.accent);
    tip.position.set((s * guardW) / 2, 0.026, 0);
    g.add(tip);
  });
  g.add(wrappedGrip(gripLen, 0.017 + width * 0.05, -gripLen + 0.02, m.main, leatherMat()));
  const pommel = mesh(new THREE.SphereGeometry(0.021 + width * 0.06, 12, 10), m.accent);
  pommel.position.y = -gripLen + 0.005;
  g.add(pommel);
  return g;
};

/** Warlock: a fan of paper talismans held between the fingers. */
const talismans = (m: WeaponMats): THREE.Object3D => {
  const g = new THREE.Group();
  const paper = new THREE.MeshStandardMaterial({ color: '#efe3c2', roughness: 0.85, side: THREE.DoubleSide });
  const ink = new THREE.MeshBasicMaterial({ color: '#a21caf', side: THREE.DoubleSide });
  for (let i = 0; i < 4; i++) {
    const card = new THREE.Group();
    card.add(mesh(new THREE.PlaneGeometry(0.05, 0.13), paper));
    const rune = new THREE.Mesh(new THREE.PlaneGeometry(0.012, 0.09), ink);
    rune.position.z = 0.0008;
    card.add(rune);
    card.position.set(0, 0.07, 0);
    const pivot = new THREE.Group();
    pivot.rotation.z = (i - 1.5) * 0.28;
    pivot.add(card);
    g.add(pivot);
  }
  const wisp = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 10), m.glow);
  wisp.position.y = 0.16;
  g.add(wisp);
  g.position.set(0, -0.02, 0.02);
  return g;
};

/** Warlock: a floating grimoire above the off hand. */
const grimoire = (m: WeaponMats): THREE.Object3D => {
  const g = new THREE.Group();
  g.name = 'grimoire';
  const cover = new THREE.MeshStandardMaterial({ color: '#3b0764', roughness: 0.5, metalness: 0.2 });
  const pages = new THREE.MeshStandardMaterial({ color: '#f5ecd6', roughness: 0.9 });
  [1, -1].forEach((s) => {
    const half = new THREE.Group();
    const c = mesh(new THREE.BoxGeometry(0.11, 0.006, 0.15), cover);
    c.position.x = 0.055;
    half.add(c);
    const p = mesh(new THREE.BoxGeometry(0.1, 0.012, 0.14), pages);
    p.position.set(0.052, 0.008, 0);
    half.add(p);
    half.rotation.z = s > 0 ? 0.25 : Math.PI - 0.25;
    g.add(half);
  });
  const sigil = new THREE.Mesh(new THREE.RingGeometry(0.05, 0.058, 32), m.glow);
  sigil.rotation.x = -Math.PI / 2;
  sigil.position.y = 0.05;
  g.add(sigil);
  g.position.set(0, 0.12, 0.08);
  return g;
};

/** Soul Fighter: wraps with a ball of soul energy. */
const soulFist = (m: WeaponMats, color: number): THREE.Object3D => {
  const g = gauntlet(m);
  const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.045, 2), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55, depthWrite: false }));
  orb.position.set(0, -0.1, 0);
  g.add(orb);
  return g;
};

/** Archer: recurve bow; the grip is at the origin and the limbs run along ±y (the line of the closed fist). */
const bow = (m: WeaponMats): THREE.Object3D => {
  const g = new THREE.Group();
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 24; i++) {
    const u = i / 24 - 0.5;
    const y = u * 1.2;
    const x = 0.12 * (Math.cos(u * Math.PI) - 1) + 0.05 * Math.pow(Math.abs(u) * 2, 4);
    pts.push(new THREE.Vector3(x, y, 0));
  }
  g.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, 0.011, 8), woodMat()));
  g.add(wrappedGrip(0.1, 0.018, -0.05, leatherMat(), m.accent));
  const ends = [pts[0], pts[pts.length - 1]];
  const str = new THREE.BufferGeometry().setFromPoints(ends);
  g.add(new THREE.Line(str, new THREE.LineBasicMaterial({ color: '#e8e1d0' })));
  ends.forEach((e) => {
    const nock = mesh(new THREE.SphereGeometry(0.012, 8, 6), m.accent);
    nock.position.copy(e);
    g.add(nock);
  });
  return g;
};

/** Archer: one arrow held in the drawing hand. */
const arrow = (m: WeaponMats): THREE.Object3D => {
  const g = new THREE.Group();
  const shaft = mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.7, 6), woodMat());
  shaft.position.y = 0.3;
  g.add(shaft);
  const head = mesh(new THREE.ConeGeometry(0.012, 0.05, 8), m.metal);
  head.position.y = 0.67;
  g.add(head);
  for (let i = 0; i < 3; i++) {
    const fl = mesh(new THREE.PlaneGeometry(0.02, 0.07), new THREE.MeshStandardMaterial({ color: '#e5e7eb', side: THREE.DoubleSide }));
    fl.position.set(Math.cos((i / 3) * Math.PI * 2) * 0.008, -0.02, Math.sin((i / 3) * Math.PI * 2) * 0.008);
    fl.rotation.y = (i / 3) * Math.PI * 2;
    g.add(fl);
  }
  return g;
};

/** Astromancer: an orb with orbiting stars floating above the palm. */
const starOrb = (m: WeaponMats): THREE.Object3D => {
  const g = new THREE.Group();
  g.name = 'starOrb';
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.06, 24, 18), new THREE.MeshPhysicalMaterial({ color: '#1e1b4b', roughness: 0.05, clearcoat: 1, emissive: '#4338ca', emissiveIntensity: 0.6 })));
  for (let i = 0; i < 3; i++) {
    const ring = mesh(new THREE.TorusGeometry(0.09 + i * 0.012, 0.0025, 6, 48), m.accent);
    ring.rotation.set(i * 1.1, i * 0.7, 0);
    g.add(ring);
  }
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.012), new THREE.MeshBasicMaterial({ color: '#fde68a' }));
    star.position.set(Math.cos(a) * 0.1, Math.sin(a * 2) * 0.03, Math.sin(a) * 0.1);
    g.add(star);
  }
  g.position.set(0, 0.04, 0.1);
  return g;
};

/** Musician: a long-necked lute held by the neck. */
const lute = (m: WeaponMats): THREE.Object3D => {
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: '#8a4b2a', roughness: 0.45 });
  const body = mesh(new THREE.SphereGeometry(1, 24, 16), wood);
  body.scale.set(0.15, 0.2, 0.06);
  body.position.y = -0.25;
  g.add(body);
  const face = mesh(new THREE.CircleGeometry(1, 32), new THREE.MeshStandardMaterial({ color: '#d9b77e', roughness: 0.6 }));
  face.scale.set(0.14, 0.19, 1);
  face.position.set(0, -0.25, 0.058);
  g.add(face);
  const hole = new THREE.Mesh(new THREE.CircleGeometry(0.03, 20), new THREE.MeshBasicMaterial({ color: '#1a0f08' }));
  hole.position.set(0, -0.2, 0.06);
  g.add(hole);
  const neck = mesh(new THREE.BoxGeometry(0.035, 0.42, 0.02), wood);
  neck.position.set(0, 0.1, 0.03);
  g.add(neck);
  const head = mesh(new THREE.BoxGeometry(0.045, 0.09, 0.025), m.accent);
  head.position.set(0, 0.35, 0.025);
  head.rotation.x = -0.35;
  g.add(head);
  for (let i = 0; i < 4; i++) {
    const str = mesh(new THREE.CylinderGeometry(0.0009, 0.0009, 0.62, 4), m.metal);
    str.position.set((i - 1.5) * 0.007, 0.0, 0.062);
    g.add(str);
  }
  return g;
};

/**
 * Place a weapon in the hand socket (see AvatarController.attachSockets): the socket's +y runs across the fist from the little
 * finger to the thumb, +x along the fingers. `grip` is where the hand closes on the weapon (along its +y), `tilt` turns the
 * weapon about the palm normal (negative = blade dips toward the fingers), `x` slides it toward the fingers (+) or wrist (−).
 */
const seat = (inner: THREE.Object3D, grip: number, tilt = 0, x = 0, turn?: THREE.Euler): THREE.Object3D => {
  const w = new THREE.Group();
  inner.position.y -= grip;
  if (turn) inner.rotation.copy(turn);
  w.add(inner);
  w.rotation.z = tilt;
  w.position.x = x;
  return w;
};
/** Rest angle of blades: forward and a little down. */
const TILT = -0.45;
/** Forearm-mounted pieces (gauntlets, bangles) were modelled along −y from the wrist: lay them along the fingers. */
const ARM = Math.PI / 2;

export const buildWeapons = (weapon: WeaponKind, m: WeaponMats): WeaponSet => {
  switch (weapon) {
    case 'curved_saber':
      return { R: [seat(sword(m), -0.105, TILT)], L: [] };
    case 'dragon_gauntlets':
      return { R: [seat(gauntlet(m), 0, ARM, -0.055)], L: [seat(gauntlet(m), 0, ARM, -0.055)] };
    case 'chi_bangles':
      return { R: [seat(chiBangle(m, 1, 0x38bdf8), 0, ARM, -0.055)], L: [seat(chiBangle(m, -1, 0xf97316), 0, ARM, -0.055)] };
    case 'great_axe':
      return { R: [seat(greatAxe(m), 0.03, Math.PI / 2 - 0.3)], L: [] };
    case 'reverse_daggers':
      return { R: [seat(dagger(m), -0.03, TILT)], L: [seat(dagger(m), -0.03, TILT)] };
    case 'flower_staff':
      return { R: [seat(staff(m), 0.01, Math.PI / 2)], L: [] };
    case 'slender_sword':
      return { R: [seat(straightSword(m, 0.95, 0.028, 0.2, 0.08), -0.08, TILT)], L: [] };
    case 'talismans':
      return { R: [talismans(m)], L: [grimoire(m)] };
    case 'soul_gauntlets':
      return { R: [seat(soulFist(m, 0x2dd4bf), 0, ARM, -0.055)], L: [seat(soulFist(m, 0x2dd4bf), 0, ARM, -0.055)] };
    case 'greatsword':
      return { R: [seat(straightSword(m, 1.15, 0.075, 0.3, 0.22), -0.13, TILT)], L: [] };
    case 'longbow':
      return { R: [seat(arrow(m), 0.2)], L: [seat(bow(m), 0)] };
    case 'star_orb':
      return { R: [], L: [starOrb(m)] };
    case 'twin_shortswords':
      return { R: [seat(straightSword(m, 0.5, 0.03, 0.13, 0.07), -0.045, TILT)], L: [seat(straightSword(m, 0.5, 0.03, 0.13, 0.07), -0.045, TILT)] };
    case 'lute':
      return { R: [], L: [seat(lute(m), 0.12, 0.8)] };
    case 'spirit_revolvers':
      return { R: [seat(revolver(m), -0.05, 0, 0, new THREE.Euler(0, Math.PI / 2, 0))], L: [seat(revolver(m), -0.05, 0, 0, new THREE.Euler(0, Math.PI / 2, 0))] };
  }
};

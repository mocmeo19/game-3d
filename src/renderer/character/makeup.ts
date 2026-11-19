import * as THREE from 'three';
import { CosmeticColors } from '../../types/character';

/**
 * Make-up and face markings for the MPFB body. Everything is painted into a canvas that is a flat picture of the face seen from
 * the front (x = to the character's left, y = up, in metres around the landmarks of /public/models/<race>_<gender>_extra.json). The skin
 * shader projects that picture onto the front-facing part of the head from the vertex position, so it does not depend on how
 * MPFB splits the face into UV islands, and it follows the face morphs.
 */

export interface Landmark {
  uv: [number, number];
  /** UV change per metre: [du/dx, dv/dx, du/dz, dv/dz] (the face island can be rotated in UV space). */
  jac: [number, number, number, number];
  pos: [number, number];
}

export interface FaceExtra {
  landmarks: Record<string, Landmark>;
  lips: number[];
  /** Per landmark and morph: how far the skin around it moves (x, up) at full influence. */
  shift?: Record<string, Record<string, [number, number]>>;
}

const SIZE = 1024;
/** Width / height of the face picture in metres. */
export const FACE_SPAN = 0.26;
type Pt = [number, number];

/** Where `lipmask.png` sits in a 4096 px skin: x, y, width, height. */
const LIP_MASK_BOX = [3645, 2019, 184, 195] as const;
let lipMaskImage: Promise<HTMLImageElement | null> | null = null;
const loadLipMask = () =>
  (lipMaskImage ??= new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = '/models/lipmask.png';
  }));

export class MakeupPainter {
  public texture: THREE.CanvasTexture;
  /** Height of the picture's centre line (the eyes) in metres. */
  public centerY: number;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private key = '';
  /** Lip tint: a mask of the lip faces in the skin's UV space, a colour and a gloss, applied inside the skin shader. */
  public lipMask: THREE.CanvasTexture;
  public lipColor = { value: new THREE.Color('#c04050') };
  public lipAmount = { value: 0.9 };
  public lipGloss = { value: 0 };
  /** Mean (linear) brightness of the lips painted in the skin: the tint is normalised by it so the whole mouth gets one even colour. */
  public lipRef = { value: 0.3 };
  private moved: Record<string, [number, number]> = {};
  private movedKey = '';
  private lipCanvas!: HTMLCanvasElement;
  /** The lip faces alone (the core the tint grows from) and their bounding box in mask pixels. */
  private lipCore!: HTMLCanvasElement;
  private lipBox = { x0: 0, y0: 0, x1: 0, y1: 0 };
  private lipFitKey = '';

  constructor(private extra: FaceExtra) {
    this.centerY = (extra.landmarks.eye_l?.pos[1] ?? 1.5) - 0.03;
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.canvas.height = SIZE;
    this.ctx = this.canvas.getContext('2d')!;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.flipY = false;
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 4;
    this.texture.wrapS = this.texture.wrapT = THREE.ClampToEdgeWrapping;

    // Lip UVs occupy a very small area; a denser mask captures the tiny corner
    // triangles cleanly without expanding the tint onto surrounding skin.
    const LS = 4096;
    const mc = document.createElement('canvas');
    mc.width = mc.height = LS;
    const m = mc.getContext('2d')!;
    m.fillStyle = '#000';
    m.fillRect(0, 0, LS, LS);
    m.fillStyle = '#fff';
    const t = extra.lips;
    for (let i = 0; i + 5 < t.length; i += 6) {
      m.beginPath();
      m.moveTo(t[i] * LS, (1 - t[i + 1]) * LS);
      m.lineTo(t[i + 2] * LS, (1 - t[i + 3]) * LS);
      m.lineTo(t[i + 4] * LS, (1 - t[i + 5]) * LS);
      m.closePath();
      m.fill();
    }
    this.lipCanvas = mc;
    // remember the bare faces and where they are: the mask is regrown from them for every skin texture (fitLips)
    this.lipCore = document.createElement('canvas');
    this.lipCore.width = this.lipCore.height = LS;
    this.lipCore.getContext('2d')!.drawImage(mc, 0, 0);
    // the bounding box of the real lips: a stray island of faces far from the mouth (inside the mouth) must not stretch it
    const cents: [number, number][] = [];
    for (let i = 0; i + 5 < t.length; i += 6) cents.push([((t[i] + t[i + 2] + t[i + 4]) / 3) * LS, ((1 - (t[i + 1] + t[i + 3] + t[i + 5]) / 3)) * LS]);
    const med = (a: number[]) => [...a].sort((x, y) => x - y)[a.length >> 1];
    const mx = med(cents.map((c) => c[0])), my = med(cents.map((c) => c[1]));
    let bx0 = LS, by0 = LS, bx1 = 0, by1 = 0;
    for (let i = 0; i + 5 < t.length; i += 6) {
      const [cx, cy] = cents[i / 6];
      if (Math.hypot(cx - mx, cy - my) > 260) continue;
      for (let k = 0; k < 6; k += 2) {
        const x = t[i + k] * LS, y = (1 - t[i + k + 1]) * LS;
        bx0 = Math.min(bx0, x); bx1 = Math.max(bx1, x); by0 = Math.min(by0, y); by1 = Math.max(by1, y);
      }
    }
    this.lipBox = { x0: Math.floor(bx0), y0: Math.floor(by0), x1: Math.ceil(bx1), y1: Math.ceil(by1) };
    this.lipMask = new THREE.CanvasTexture(mc);
    this.lipMask.flipY = false;
    this.lipMask.wrapS = this.lipMask.wrapT = THREE.ClampToEdgeWrapping;
    // the lips cover a tiny patch of the skin UV: mip-mapping would average the mask away and leave only a faint tint
    this.lipMask.generateMipmaps = false;
    this.lipMask.minFilter = THREE.LinearFilter;
  }

  /** Run `draw` with the canvas transformed so that its coordinates are metres on the face (x to the character's left, z up) centred on the landmark. */
  private local(name: string, draw: (c: CanvasRenderingContext2D) => void) {
    const l = this.extra.landmarks[name];
    if (!l) return;
    const c = this.ctx;
    const K = SIZE / FACE_SPAN;
    const m = this.moved[name] ?? [0, 0];
    c.save();
    c.transform(K, 0, 0, -K, SIZE / 2 + (l.pos[0] + m[0]) * K, SIZE / 2 - (l.pos[1] + m[1] - this.centerY) * K);
    draw(c);
    c.restore();
  }

  private blob(name: string, rx: number, rz: number, color: string, alpha: number, dx = 0, dz = 0) {
    if (alpha <= 0.01) return;
    this.local(name, (c) => {
      c.translate(dx, dz);
      c.scale(rx, rz);
      const rgb = new THREE.Color(color);
      const base = `${Math.round(rgb.r * 255)},${Math.round(rgb.g * 255)},${Math.round(rgb.b * 255)}`;
      const g = c.createRadialGradient(0, 0, 0, 0, 0, 1);
      g.addColorStop(0, `rgba(${base},1)`);
      g.addColorStop(0.55, `rgba(${base},0.55)`);
      g.addColorStop(1, `rgba(${base},0)`);
      c.globalAlpha = alpha;
      c.fillStyle = g;
      c.beginPath();
      c.arc(0, 0, 1, 0, Math.PI * 2);
      c.fill();
    });
  }

  private stroke(name: string, pts: Pt[], width: number, color: string, alpha = 1, dx = 0, dz = 0, mirror = 1) {
    this.local(name, (c) => {
      c.globalAlpha = alpha;
      c.strokeStyle = color;
      c.lineCap = 'round';
      c.lineJoin = 'round';
      c.lineWidth = width;
      c.beginPath();
      pts.forEach(([x, z], i) => {
        if (i === 0) c.moveTo(dx + x * mirror, dz + z);
        else c.lineTo(dx + x * mirror, dz + z);
      });
      c.stroke();
    });
  }

  private fill(name: string, pts: Pt[], color: string, alpha = 1) {
    this.local(name, (c) => {
      c.globalAlpha = alpha;
      c.fillStyle = color;
      c.beginPath();
      pts.forEach(([x, z], i) => {
        if (i === 0) c.moveTo(x, z);
        else c.lineTo(x, z);
      });
      c.closePath();
      c.fill();
    });
  }

  /** Move the landmarks with the face morphs (influences by morph name). Returns true if anything moved enough to repaint. */
  public follow(influence: Map<string, number>): boolean {
    const moved: Record<string, [number, number]> = {};
    for (const [name, table] of Object.entries(this.extra.shift ?? {})) {
      let dx = 0;
      let dz = 0;
      for (const [morph, [x, z]] of Object.entries(table)) {
        const w = influence.get(morph);
        if (w) {
          dx += x * w;
          dz += z * w;
        }
      }
      moved[name] = [dx, dz];
    }
    const key = JSON.stringify(Object.values(moved).map(([x, z]) => [Math.round(x * 4e3), Math.round(z * 4e3)]));
    if (key === this.movedKey) return false;
    this.movedKey = key;
    this.moved = moved;
    this.key = '';
    return true;
  }

  /**
   * The lip mask is drawn in the skin's UV space, which is the same on every body and every skin (the bodies differ only in vertex
   * positions). `public/models/lipmask.png` is the lip shape cut out once, with the slit between the lips left dark; it is stamped
   * at LIP_MASK_BOX (pixels of a 4096 px skin). Measuring the lips from each body's vertex positions did not work: their height
   * above the mouth landmark differs from body to body.
   */
  public drawLips() {
    loadLipMask().then((img) => {
      if (!img) return;
      const LS = this.lipCanvas.width;
      const k = LS / 4096;
      const [x0, y0, w, h] = LIP_MASK_BOX;
      for (const cv of [this.lipCanvas, this.lipCore]) {
        const g = cv.getContext('2d')!;
        g.save();
        g.filter = 'none';
        g.fillStyle = '#000';
        g.fillRect(0, 0, LS, LS);
        g.drawImage(img, x0 * k, y0 * k, w * k, h * k);
        g.restore();
      }
      const pad = 24;
      this.lipBox = { x0: Math.floor((x0 + pad) * k), y0: Math.floor((y0 + pad) * k), x1: Math.ceil((x0 + w - pad) * k), y1: Math.ceil((y0 + h - pad) * k) };
      this.lipFitKey = '';
      this.lipMask.needsUpdate = true;
    });
  }

  /** Mean brightness of the lips painted in this skin: the tint is normalised by it (see lipRef). */
  public measureLips(image: CanvasImageSource, key: string) {
    if (key === this.lipFitKey) return;
    this.lipFitKey = key;
    const LS = this.lipCanvas.width;
    const { x0, y0, x1, y1 } = this.lipBox;
    const w = x1 - x0, h = y1 - y0;
    if (w <= 0 || h <= 0) return;
    const tmp = document.createElement('canvas');
    tmp.width = tmp.height = LS;
    const g = tmp.getContext('2d', { willReadFrequently: true })!;
    try {
      g.drawImage(image, 0, 0, LS, LS);
    } catch {
      return;
    }
    const skin = g.getImageData(x0, y0, w, h).data;
    const core = this.lipCore.getContext('2d', { willReadFrequently: true })!.getImageData(x0, y0, w, h).data;
    let r = 0, gr = 0, b = 0, n = 0;
    for (let i = 0; i < core.length; i += 4) if (core[i] > 200) { r += skin[i]; gr += skin[i + 1]; b += skin[i + 2]; n++; }
    if (!n) return;
    const lin = (v: number) => Math.pow(v / 255, 2.2);
    this.lipRef.value = Math.max(0.04, 0.2126 * lin(r / n) + 0.7152 * lin(gr / n) + 0.0722 * lin(b / n));
  }

  /** Repaint when the cosmetics that affect the face change. Returns true if the texture was updated. */
  public paint(cos: CosmeticColors): boolean {
    this.lipColor.value.set(cos.lipColor);
    this.lipAmount.value = cos.lipOff ? 0 : 0.9 * THREE.MathUtils.clamp(cos.lipIntensity, 0, 1);
    this.lipGloss.value = cos.lipGloss;
    const key = JSON.stringify([cos.eyeshadowColor, cos.eyeshadowIntensity, cos.blushColor, cos.blushIntensity, cos.faceMarking, cos.faceMarkingColor]);
    if (key === this.key) return false;
    this.key = key;
    const c = this.ctx;
    c.clearRect(0, 0, SIZE, SIZE);

    (['cheek_l', 'cheek_r'] as const).forEach((n) => this.blob(n, 0.034, 0.024, cos.blushColor, Math.min(0.75, cos.blushIntensity * 0.7)));
    (['lid_l', 'lid_r'] as const).forEach((n) => this.blob(n, 0.02, 0.011, cos.eyeshadowColor, Math.min(0.85, cos.eyeshadowIntensity * 0.9), 0, 0.004));

    this.markings(cos);
    this.texture.needsUpdate = true;
    return true;
  }

  private markings(cos: CosmeticColors) {
    const col = cos.faceMarkingColor;
    const gold = '#e7c35a';
    const circle = (r: number, n = 32): Pt[] => Array.from({ length: n + 1 }, (_, i) => [Math.cos((i / n) * Math.PI * 2) * r, Math.sin((i / n) * Math.PI * 2) * r] as Pt);
    switch (cos.faceMarking) {
      case 'phoenix_bindi':
        this.fill('forehead', [[0, 0.0075], [0.0042, 0], [0, -0.0075], [-0.0042, 0]], col, 0.95);
        this.stroke('forehead', circle(0.0075), 0.0012, gold, 0.95);
        break;
      case 'dragon_claw':
        for (let i = 0; i < 3; i++) this.stroke('temple_l', [[-0.012 - i * 0.0072, 0.014], [-0.008 - i * 0.0072, -0.016]], 0.0022, col, 0.95, 0, -0.004);
        break;
      case 'hongmoon_rune':
        this.stroke('forehead', circle(0.0085), 0.0012, col, 0.95);
        for (let i = 0; i < 3; i++) {
          const a = (i / 3) * Math.PI;
          this.stroke('forehead', [[Math.cos(a) * 0.0085, Math.sin(a) * 0.0085], [-Math.cos(a) * 0.0085, -Math.sin(a) * 0.0085]], 0.0009, col, 0.95);
        }
        this.fill('forehead', circle(0.0018, 12), col, 1);
        break;
      case 'shadow_fox':
        (['cheek_l', 'cheek_r'] as const).forEach((n, s) => {
          const m = s === 0 ? 1 : -1;
          for (let k = 0; k < 3; k++) this.stroke(n, [[0.004, 0.006 - k * 0.0085], [0.03, 0.006 - k * 0.0085 + (k - 1) * -0.004]], 0.0017, col, 0.9, 0, 0.012, m);
        });
        break;
      case 'gold_lotus':
        for (let i = 0; i < 5; i++) {
          const a = ((i - 2) / 2) * 0.9;
          const cx = Math.sin(a) * 0.006;
          const cy = Math.cos(a) * 0.006;
          const petal = ([[0, 0.0065], [0.0026, 0], [0, -0.0065], [-0.0026, 0]] as Pt[]).map(
            ([x, y]) => [x * Math.cos(-a) - y * Math.sin(-a) + cx, x * Math.sin(-a) + y * Math.cos(-a) + cy] as Pt
          );
          this.fill('forehead', petal, gold, 0.95);
        }
        break;
      default:
        break;
    }
  }
}

/** Blend the make-up picture over the skin diffuse (projected from the front, on front-facing surfaces only). Call once per material. */
export const installOverlay = (mat: THREE.MeshStandardMaterial, painter: MakeupPainter) => {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uOverlay = { value: painter.texture };
    sh.uniforms.uLipMask = { value: painter.lipMask };
    sh.uniforms.uLipColor = painter.lipColor;
    sh.uniforms.uLipAmt = painter.lipAmount;
    sh.uniforms.uLipGloss = painter.lipGloss;
    sh.uniforms.uLipRef = painter.lipRef;
    sh.uniforms.uPlane = { value: new THREE.Vector2(painter.centerY, FACE_SPAN) };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vOP;\nvarying vec3 vON;')
      // bind-pose position and normal (before the bones move them): the picture is glued to the face and follows every movement
      .replace('#include <skinnormal_vertex>', 'vON = objectNormal;\n#include <skinnormal_vertex>')
      .replace('#include <skinning_vertex>', 'vOP = transformed;\n#include <skinning_vertex>');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D uOverlay;\nuniform sampler2D uLipMask;\nuniform vec3 uLipColor;\nuniform float uLipAmt;\nuniform float uLipGloss;\nuniform float uLipRef;\nuniform vec2 uPlane;\nvarying vec3 vOP;\nvarying vec3 vON;')
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        #ifdef USE_MAP
        vec2 fu = vec2(vOP.x / uPlane.y + 0.5, 0.5 - (vOP.y - uPlane.x) / uPlane.y);
        float inside = step(0.0, fu.x) * step(fu.x, 1.0) * step(0.0, fu.y) * step(fu.y, 1.0);
        float front = smoothstep(0.1, 0.5, normalize(vON).z);
        vec4 ov = texture2D(uOverlay, fu);
        diffuseColor.rgb = mix(diffuseColor.rgb, ov.rgb * 0.92, ov.a * inside * front);
        // lips: tint the skin texture itself (keeps its shading), only where the lip faces are
        float lipM = texture2D(uLipMask, vMapUv).r * uLipAmt;
        float lipL = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
        float lipK = clamp(mix(1.0, lipL / uLipRef, 0.12), 0.88, 1.12);
        diffuseColor.rgb = mix(diffuseColor.rgb, uLipColor * lipK, lipM);
        #endif`
      )
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        #ifdef USE_MAP
        roughnessFactor = mix(roughnessFactor, 0.16, lipM * uLipGloss);
        #endif`);
  };
  mat.customProgramCacheKey = () => 'bns-overlay-v7';
  mat.needsUpdate = true;
};

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/** The body model the UV layout was exported from (see the file's `sourceModel`). */
export const PREVIEW_MODEL_URL = '/models/jin_female.glb';
const BODY_NODE = 'Body';
const MAX_PIXEL_RATIO = 2;

/**
 * The bare body with the skin being made on it: the editor's working canvas is the body's texture, refreshed whenever the skin
 * changes. Drawn only when something changes (a new skin, a turn, a resize), not every frame.
 */
export class SkinPreviewScene {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(30, 1, 0.05, 50);
  private readonly pivot = new THREE.Group();
  private readonly texture: THREE.CanvasTexture;
  private readonly material: THREE.MeshStandardMaterial;
  private readonly resizeObserver: ResizeObserver;
  private readonly removers: (() => void)[] = [];
  private frame = 0;
  private disposed = false;
  private yaw = 0;
  private distance = 3.4;
  private modelHeight = 1.7;
  private readonly target = new THREE.Vector3(0, 0.9, 0);

  constructor(private readonly host: HTMLElement, skin: HTMLCanvasElement, onError: (message: string) => void) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.appendChild(this.renderer.domElement);
    this.texture = new THREE.CanvasTexture(skin);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    // the UV file's v runs down from the top-left, as glTF's does: the canvas goes on unflipped
    this.texture.flipY = false;
    this.texture.anisotropy = 8;
    this.material = new THREE.MeshStandardMaterial({ map: this.texture, roughness: 0.62, metalness: 0 });
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x4a3b33, 1.6));
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(2, 3, 3);
    const rim = new THREE.DirectionalLight(0xbcd8ff, 1.2);
    rim.position.set(-2, 2, -3);
    this.scene.add(key, rim, this.pivot);
    this.bindControls();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(host);
    this.resize();
    void this.load(onError);
  }

  /** The skin canvas changed: upload it again and redraw. */
  textureChanged() {
    this.texture.needsUpdate = true;
    this.requestRender();
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    this.resizeObserver.disconnect();
    this.removers.forEach((remove) => remove());
    this.scene.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.geometry.dispose();
      (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach((material) => {
        Object.values(material).forEach((value) => value instanceof THREE.Texture && value !== this.texture && value.dispose());
        material.dispose();
      });
    });
    this.texture.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  private async load(onError: (message: string) => void) {
    try {
      const gltf = await new GLTFLoader().loadAsync(PREVIEW_MODEL_URL);
      if (this.disposed) return;
      const model = gltf.scene;
      // only the body wears the skin; the eyes, teeth and brows in the file are placed by the game at runtime, so they are hidden
      model.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (!mesh.isMesh) return;
        if (mesh.name === BODY_NODE || mesh.parent?.name === BODY_NODE) mesh.material = this.material;
        else mesh.visible = false;
      });
      // stand the body on the floor, centred on the turning axis, and frame it
      const box = new THREE.Box3().setFromObject(model);
      const centre = box.getCenter(new THREE.Vector3());
      model.position.set(-centre.x, -box.min.y, -centre.z);
      const height = box.max.y - box.min.y;
      this.modelHeight = height;
      this.target.set(0, height * 0.55, 0);
      this.distance = height * 1.9;
      this.pivot.add(model);
      this.requestRender();
    } catch {
      if (!this.disposed) onError('Không tải được mô hình cơ thể để xem trước.');
    }
  }

  private bindControls() {
    const canvas = this.renderer.domElement;
    canvas.style.touchAction = 'none';
    let dragging: { x: number; y: number; yaw: number; height: number } | null = null;
    const listen = <K extends keyof HTMLElementEventMap>(type: K, handler: (event: HTMLElementEventMap[K]) => void, options?: AddEventListenerOptions) => {
      canvas.addEventListener(type, handler, options);
      this.removers.push(() => canvas.removeEventListener(type, handler, options));
    };
    listen('pointerdown', (event) => {
      dragging = { x: event.clientX, y: event.clientY, yaw: this.yaw, height: this.target.y };
      canvas.setPointerCapture(event.pointerId);
    });
    listen('pointermove', (event) => {
      if (!dragging) return;
      // sideways turns the body, up and down moves the view along it (to look at the face after zooming in)
      this.yaw = dragging.yaw + (event.clientX - dragging.x) * 0.01;
      const rise = ((event.clientY - dragging.y) / Math.max(1, this.host.clientHeight)) * this.modelHeight;
      this.target.y = THREE.MathUtils.clamp(dragging.height + rise, this.modelHeight * 0.05, this.modelHeight);
      this.requestRender();
    });
    listen('pointerup', () => (dragging = null));
    listen('pointercancel', () => (dragging = null));
    listen('wheel', (event) => {
      event.preventDefault();
      this.distance = THREE.MathUtils.clamp(this.distance * Math.exp(event.deltaY * 0.001), 0.6, 8);
      this.requestRender();
    }, { passive: false });
  }

  private resize() {
    const width = Math.max(1, this.host.clientWidth);
    const height = Math.max(1, this.host.clientHeight);
    this.renderer.setSize(width, height);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.requestRender();
  }

  private requestRender() {
    if (this.frame || this.disposed) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      this.pivot.rotation.y = this.yaw;
      this.camera.position.set(this.target.x, this.target.y + this.distance * 0.08, this.target.z + this.distance);
      this.camera.lookAt(this.target);
      this.renderer.render(this.scene, this.camera);
    });
  }
}

import * as THREE from 'three';
import { configureRenderer } from '../../../settings/renderSettings';

const GRIP_COLOR = 0x41d17a;
const MUZZLE_COLOR = 0xff5a4f;
const SUPPORT_COLOR = 0x4fa8ff;
const MARKER_RADIUS = 0.012;
const MIN_DISTANCE = 0.45;
const MAX_DISTANCE = 4;
const DRAG_SPEED = 0.008;

/**
 * A small 3D view of one weapon in the game's weapon frame: the hold point (green, where the hand goes), the muzzle (red, where
 * shots and the flash start) and the direction it fires. Drag to turn, scroll to zoom. Draws only while it is shown.
 */
export class GunModelPreviewScene {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(35, 1, 0.01, 50);
  private readonly pivot = new THREE.Group();
  private readonly grip: THREE.Mesh;
  private readonly muzzle: THREE.Mesh;
  private readonly support: THREE.Mesh;
  private readonly arrow: THREE.ArrowHelper;
  private readonly resize: ResizeObserver;
  private model: THREE.Object3D | null = null;
  private yaw = -0.9;
  private pitch = 0.25;
  private distance = 1.4;
  private frame = 0;
  private drag: { x: number; y: number } | null = null;
  private readonly removers: (() => void)[] = [];

  constructor(private readonly host: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    configureRenderer(this.renderer, 2);
    host.appendChild(this.renderer.domElement);
    this.renderer.domElement.style.touchAction = 'none';
    this.scene.add(new THREE.HemisphereLight(0xe8f2ff, 0x404448, 2.4));
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(2, 3, 2);
    this.scene.add(key, this.pivot);
    this.scene.add(new THREE.GridHelper(2, 20, 0x3c6a7a, 0x23404b));
    const markerGeometry = new THREE.SphereGeometry(MARKER_RADIUS, 16, 12);
    this.grip = new THREE.Mesh(markerGeometry, new THREE.MeshBasicMaterial({ color: GRIP_COLOR, depthTest: false }));
    this.muzzle = new THREE.Mesh(markerGeometry, new THREE.MeshBasicMaterial({ color: MUZZLE_COLOR, depthTest: false }));
    this.support = new THREE.Mesh(markerGeometry, new THREE.MeshBasicMaterial({ color: SUPPORT_COLOR, depthTest: false }));
    this.grip.renderOrder = this.muzzle.renderOrder = this.support.renderOrder = 2;
    this.arrow = new THREE.ArrowHelper(new THREE.Vector3(0, 0, 1), new THREE.Vector3(), 0.25, MUZZLE_COLOR, 0.05, 0.025);
    this.pivot.add(this.grip, this.muzzle, this.support, this.arrow);
    this.pivot.position.y = 0.3;
    this.resize = new ResizeObserver(() => this.fitCanvas());
    this.resize.observe(host);
    this.fitCanvas();
    this.bindPointer();
    this.loop();
  }

  /** Show a fitted model (the scene does not own it: copies share the game's geometry) with its muzzle and support points. */
  show(model: THREE.Object3D | null, muzzle: THREE.Vector3 | null, length: number, support: THREE.Vector3 | null = null) {
    if (this.model) this.pivot.remove(this.model);
    this.model = model;
    if (model) this.pivot.add(model);
    this.muzzle.visible = this.arrow.visible = !!muzzle;
    if (muzzle) {
      this.muzzle.position.copy(muzzle);
      this.arrow.position.copy(muzzle);
    }
    this.support.visible = !!support;
    if (support) this.support.position.copy(support);
    this.distance = THREE.MathUtils.clamp(length * 2.2, MIN_DISTANCE, MAX_DISTANCE);
  }

  dispose() {
    cancelAnimationFrame(this.frame);
    this.resize.disconnect();
    this.removers.forEach((remove) => remove());
    if (this.model) this.pivot.remove(this.model);
    this.grip.geometry.dispose();
    (this.grip.material as THREE.Material).dispose();
    (this.muzzle.material as THREE.Material).dispose();
    (this.support.material as THREE.Material).dispose();
    this.arrow.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  private fitCanvas() {
    const width = Math.max(1, this.host.clientWidth);
    const height = Math.max(1, this.host.clientHeight);
    this.renderer.setSize(width, height, false);
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  private bindPointer() {
    const canvas = this.renderer.domElement;
    const listen = <K extends keyof HTMLElementEventMap>(type: K, handler: (event: HTMLElementEventMap[K]) => void, options?: AddEventListenerOptions) => {
      canvas.addEventListener(type, handler, options);
      this.removers.push(() => canvas.removeEventListener(type, handler, options));
    };
    listen('pointerdown', (event) => {
      this.drag = { x: event.clientX, y: event.clientY };
      canvas.setPointerCapture(event.pointerId);
    });
    listen('pointermove', (event) => {
      if (!this.drag) return;
      this.yaw -= (event.clientX - this.drag.x) * DRAG_SPEED;
      this.pitch = THREE.MathUtils.clamp(this.pitch + (event.clientY - this.drag.y) * DRAG_SPEED, -1.3, 1.3);
      this.drag = { x: event.clientX, y: event.clientY };
    });
    listen('pointerup', () => (this.drag = null));
    listen('wheel', (event) => {
      event.preventDefault();
      this.distance = THREE.MathUtils.clamp(this.distance * Math.exp(event.deltaY * 0.001), MIN_DISTANCE, MAX_DISTANCE);
    }, { passive: false });
  }

  private loop = () => {
    this.frame = requestAnimationFrame(this.loop);
    // nothing to draw while the settings tab or the page is hidden
    if (document.hidden || !this.host.offsetParent) return;
    const target = this.pivot.position;
    this.camera.position.set(
      target.x + Math.sin(this.yaw) * Math.cos(this.pitch) * this.distance,
      target.y + Math.sin(this.pitch) * this.distance,
      target.z + Math.cos(this.yaw) * Math.cos(this.pitch) * this.distance,
    );
    this.camera.lookAt(target);
    this.renderer.render(this.scene, this.camera);
  };
}

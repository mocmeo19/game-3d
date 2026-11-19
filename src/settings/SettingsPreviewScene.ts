import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CharacterModel } from '../renderer/CharacterModel';
import type { CharacterState } from '../types/character';
import { getRenderSettings, type RenderSettings } from './renderSettings';

export interface PreviewOptions {
  state: CharacterState;
  render?: RenderSettings;
  camera?: { fov: number; distance: number };
}
export type PreviewStatus = 'loading' | 'ready' | 'error';

export class SettingsPreviewScene {
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(40, 1, 0.05, 100);
  private renderer!: THREE.WebGLRenderer;
  private controls!: OrbitControls;
  private model: CharacterModel;
  private resize: ResizeObserver;
  private frame = 0;
  private last = 0;
  private height = 0;
  private paused = false;
  private elapsed = 0;
  private status: PreviewStatus = 'loading';
  private settings: RenderSettings;
  private floor: THREE.Mesh;
  private grid: THREE.GridHelper;
  private disposed = false;
  private angle = 0;
  private portrait = false;

  constructor(private host: HTMLElement, private options: PreviewOptions, private onStatus: (status: PreviewStatus) => void) {
    this.settings = options.render ?? getRenderSettings();
    this.createRenderer();
    this.scene.background = new THREE.Color('#0d1e2a');
    this.scene.add(new THREE.HemisphereLight(0xe6f3ff, 0x45566c, 2.5));
    const key = new THREE.DirectionalLight(0xffe4ce, 3.5);
    key.position.set(3, 5, 4);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    this.scene.add(key);
    const fill = new THREE.DirectionalLight(0x8ecfff, 2);
    fill.position.set(-3, 2, -2);
    this.scene.add(fill);
    this.floor = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.MeshStandardMaterial({ color: '#273d4c', roughness: 0.9 }));
    this.floor.rotation.x = -Math.PI / 2;
    this.floor.position.y = -0.905;
    this.floor.receiveShadow = true;
    this.grid = new THREE.GridHelper(12, 24, 0x55788c, 0x324957);
    this.grid.position.y = -0.9;
    this.scene.add(this.floor, this.grid);
    this.model = new CharacterModel(options.state);
    this.model.setWeaponsVisible(false);
    this.scene.add(this.model.group);
    this.resize = new ResizeObserver(() => this.setSize());
    this.resize.observe(host);
    this.setSize();
    this.frame = requestAnimationFrame(this.tick);
  }

  private createRenderer() {
    const renderer = new THREE.WebGLRenderer({ antialias: this.settings.antialias, preserveDrawingBuffer: true });
    renderer.shadowMap.enabled = this.settings.shadows;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, this.settings.pixelRatio));
    renderer.domElement.style.cssText = 'width:100%;height:100%;touch-action:none;display:block';
    this.host.appendChild(renderer.domElement);
    this.renderer = renderer;
    this.controls = new OrbitControls(this.camera, renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.minDistance = 0.6;
    this.controls.maxDistance = 8;
    this.controls.maxPolarAngle = Math.PI / 2;
  }

  update(options: PreviewOptions) {
    const previous = this.options;
    this.options = options;
    const render = options.render ?? getRenderSettings();
    if (this.settings.antialias !== render.antialias) {
      this.controls.dispose();
      this.renderer.domElement.remove();
      this.renderer.dispose();
      this.renderer.forceContextLoss();
      this.settings = render;
      this.createRenderer();
      this.setSize();
    }
    this.settings = render;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, render.pixelRatio));
    this.renderer.shadowMap.enabled = render.shadows;
    const changedBody = previous.state.gender !== options.state.gender;
    if (changedBody || previous.state.pose !== options.state.pose || previous.state.skin !== options.state.skin) {
      this.elapsed = 0;
      this.setStatus('loading');
    }
    if (changedBody) this.model.closeGate();
    this.model.updateState(options.state);
    this.fit();
  }

  setPaused(paused: boolean) { this.paused = paused; }
  view(angle: number, portrait = false) { this.angle = angle; this.portrait = portrait; this.fit(); }
  private setStatus(status: PreviewStatus) {
    if (status !== this.status) { this.status = status; this.onStatus(status); }
  }
  private setSize() {
    const width = Math.max(1, this.host.clientWidth);
    const height = Math.max(1, this.host.clientHeight);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }
  private fit() {
    if (!this.model.ready) return;
    const anchors = this.model.getAnchors();
    this.height = anchors.height;
    const distance = this.portrait ? anchors.height * 0.5 : this.options.camera?.distance ?? anchors.height * 2.2;
    this.camera.fov = this.options.camera?.fov ?? 40;
    this.camera.updateProjectionMatrix();
    const targetY = this.portrait ? anchors.headY - 0.05 : anchors.feetY + anchors.height * 0.5;
    this.controls.target.set(0, targetY, 0);
    this.camera.position.set(Math.sin(this.angle) * distance, targetY + (this.portrait ? 0 : anchors.height * 0.15), Math.cos(this.angle) * distance);
    this.controls.update();
  }
  private tick = (time: number) => {
    if (this.disposed) return;
    this.frame = requestAnimationFrame(this.tick);
    const dt = Math.min(0.05, this.last ? (time - this.last) / 1000 : 0);
    this.last = time;
    if (document.hidden || !this.host.clientWidth || !this.host.clientHeight) return;
    this.elapsed += dt;
    this.model.animateStage(this.paused ? 0 : dt);
    const file = this.options.state.pose.startsWith('mixamo:') ? this.options.state.pose.slice(7) : null;
    if (this.model.previewReady && (!file || this.model.animationStatus(file) === 'ready')) this.setStatus('ready');
    else if (this.elapsed > 30 || (file && this.model.animationStatus(file) === 'failed')) this.setStatus('error');
    if (this.model.ready && Math.abs(this.model.getAnchors().height - this.height) > 0.001) this.fit();
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    this.resize.disconnect();
    this.controls.dispose();
    this.model.dispose();
    this.scene.remove(this.model.group);
    this.scene.traverse((object) => {
      const mesh = object as THREE.Mesh;
      mesh.geometry?.dispose();
      const material = mesh.material;
      if (material) (Array.isArray(material) ? material : [material]).forEach((value) => value.dispose());
      if (object instanceof THREE.DirectionalLight) object.shadow.dispose();
    });
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.renderer.domElement.remove();
  }
}

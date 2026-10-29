import * as THREE from 'three';
import { EnvironmentType } from '../types/character';
import { GroundedSkybox } from 'three/examples/jsm/objects/GroundedSkybox.js';
import { panoramaTexture } from './backdropTextures';
import { ROOMS, Room } from './rooms3d';

import { LOOKS } from './environmentLooks';
import {
  GROUND_Y, SKY_HEIGHT, SKY_RADIUS, SKY_CENTER_Z, PAINTING_HFOV, PAINTING_HORIZON, PAINTING_ASPECT, contactShadow, buildLanterns
} from './environmentStage';

/** Owns backdrop loading, scene lighting, stage materials and ambient particles. */
export class EnvironmentScene {
  public scene: THREE.Scene;
  public keyLight: THREE.DirectionalLight;
  public fillLight: THREE.DirectionalLight;
  public rimLight: THREE.DirectionalLight;
  public ambientLight: THREE.AmbientLight;

  private ground: THREE.Mesh;
  /** Soft shadow under the feet, where the character meets the ground. */
  private contact: THREE.Mesh;
  private textures = new Map<EnvironmentType, THREE.Texture>();
  private loader = new THREE.TextureLoader();
  private panos = new Map<EnvironmentType, THREE.Texture>();
  private skybox: GroundedSkybox | null = null;
  /** 3D rooms built so far (lanterns and the ones in rooms3d.ts) and the one on show. */
  private rooms = new Map<string, Room>();
  private activeRoom: Room | null = null;
  private time = 0;
  private disposed = false;
  private particleSystem: THREE.Points | null = null;
  private particlePositions: Float32Array | null = null;
  private particleVelocities: Float32Array | null = null;
  private builtEnv: EnvironmentType | null = null;
  private lightAngle = 30;

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    this.ambientLight = new THREE.AmbientLight(0x221d2e, 1.2);
    this.scene.add(this.ambientLight);

    this.keyLight = new THREE.DirectionalLight(0xffeedd, 2.5);
    this.keyLight.position.set(3, 4, 3);
    this.keyLight.castShadow = true;
    this.keyLight.shadow.mapSize.width = 2048;
    this.keyLight.shadow.mapSize.height = 2048;
    this.keyLight.shadow.camera.near = 0.5;
    this.keyLight.shadow.camera.far = 15;
    this.keyLight.shadow.camera.left = this.keyLight.shadow.camera.bottom = -2.5;
    this.keyLight.shadow.camera.right = this.keyLight.shadow.camera.top = 2.5;
    this.keyLight.shadow.bias = -0.0005;
    // double-sided cloth and skin would otherwise show rectangular shadow acne
    this.keyLight.shadow.normalBias = 0.025;
    this.scene.add(this.keyLight);

    this.fillLight = new THREE.DirectionalLight(0x7dd3fc, 0.8);
    this.fillLight.position.set(-3, 2, -2);
    this.scene.add(this.fillLight);

    this.rimLight = new THREE.DirectionalLight(0xf472b6, 2.2);
    this.rimLight.position.set(0, 3, -4);
    this.scene.add(this.rimLight);

    // the painted floor (projected skybox) stays visible: this plane only darkens it where shadows fall
    this.ground = new THREE.Mesh(new THREE.CircleGeometry(8, 64), new THREE.ShadowMaterial({ opacity: 0.45 }));
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.position.y = GROUND_Y + 0.002;
    this.ground.receiveShadow = true;
    this.scene.add(this.ground);

    this.contact = new THREE.Mesh(new THREE.CircleGeometry(0.4, 48), new THREE.MeshBasicMaterial({ map: contactShadow(), transparent: true, depthWrite: false, toneMapped: false }));
    this.contact.rotation.x = -Math.PI / 2;
    this.contact.position.y = GROUND_Y + 0.003;
    this.contact.renderOrder = 1;
    this.scene.add(this.contact);

    this.setupEnvironment('cultivation');
  }

  public setLightAngle(degrees: number) {
    this.lightAngle = degrees;
    const rad = (degrees * Math.PI) / 180;
    const distance = 4.5;
    this.keyLight.position.set(Math.sin(rad) * distance, 3.5, Math.cos(rad) * distance);
  }

  /** Gradient background shown behind everything (and alone while the panorama loads or if it fails). */
  private texture(env: EnvironmentType): THREE.Texture {
    const cached = this.textures.get(env);
    if (cached) return cached;
    const look = LOOKS[env] ?? LOOKS.cultivation;
    const fallback = panoramaTexture(null, look.horizon, look.sky, look.floor);
    this.textures.set(env, fallback);
    return fallback;
  }

  /** Sky material: looks the painting up by view direction (a pinhole camera at the eye point) instead of by sphere UV. */
  private paintingMaterial(tex: THREE.Texture) {
    const halfTan = Math.tan((PAINTING_HFOV * Math.PI) / 360);
    return new THREE.ShaderMaterial({
      uniforms: { map: { value: tex }, uHalfTan: { value: halfTan }, uAspect: { value: PAINTING_ASPECT }, uHorizon: { value: PAINTING_HORIZON } },
      vertexShader: 'varying vec3 vDir; void main() { vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `uniform sampler2D map; uniform float uHalfTan; uniform float uAspect; uniform float uHorizon; varying vec3 vDir;
        void main() {
          vec3 d = normalize(vDir);
          float k = 1.0 / max(-d.z, 0.02);
          vec2 t = vec2(clamp(d.x * k, -8.0, 8.0), clamp(d.y * k, -8.0, 8.0));
          vec2 uv = vec2(0.5 + t.x / (2.0 * uHalfTan), 1.0 - (uHorizon - t.y * uAspect / (2.0 * uHalfTan)));
          gl_FragColor = vec4(texture2D(map, uv).rgb, 1.0);
          #include <colorspace_fragment>
        }`,
      depthWrite: false,
      toneMapped: false
    });
  }

  /** Put the painting of `env` on the ground-projected skybox (loaded once, then cached). */
  private showPanorama(env: EnvironmentType) {
    const apply = (tex: THREE.Texture) => {
      if (this.disposed || this.builtEnv !== env) return;
      if (!this.skybox) {
        this.skybox = new GroundedSkybox(tex, SKY_HEIGHT, SKY_RADIUS, 96);
        this.skybox.renderOrder = -10;
        this.skybox.position.set(0, GROUND_Y + SKY_HEIGHT, SKY_CENTER_Z);
        this.scene.add(this.skybox);
      }
      (this.skybox.material as THREE.Material).dispose();
      (this.skybox as THREE.Mesh).material = this.paintingMaterial(tex);
      this.skybox.visible = true;
    };
    const cached = this.panos.get(env);
    if (cached) return apply(cached);
    if (this.skybox) this.skybox.visible = false; // the gradient shows until the new painting arrives
    this.loader.load(`/backdrops/flat/${env}.jpg`, (tex) => {
      if (this.disposed) { tex.dispose(); return; }
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 8;
      this.panos.set(env, tex);
      apply(tex);
    });
  }

  public dispose() {
    this.disposed = true;
    this.rooms.forEach((r) => r.dispose());
    this.rooms.clear();
    this.activeRoom = null;
    this.scene.background = null;
    this.textures.forEach((texture) => texture.dispose());
    this.panos.forEach((texture) => texture.dispose());
    this.textures.clear();
    this.panos.clear();
    [this.ground, this.contact, this.particleSystem, this.skybox].forEach((object) => {
      if (!object) return;
      const mesh = object as THREE.Mesh;
      mesh.geometry.dispose();
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      materials.forEach((material) => material.dispose());
      object.removeFromParent();
    });
  }

  public setupEnvironment(env: EnvironmentType) {
    // Called on every character change; only rebuild when the environment actually switches.
    if (this.builtEnv === env) return;
    this.builtEnv = env;
    const look = LOOKS[env] ?? LOOKS.cultivation;

    if (this.particleSystem) {
      this.scene.remove(this.particleSystem);
      this.particleSystem.geometry.dispose();
      (this.particleSystem.material as THREE.Material).dispose();
      this.particleSystem = null;
    }

    const roomDef = env === 'lanterns' ? { build: () => buildLanterns(), bg: 0x000000, fog: 0.06 } : ROOMS[env];
    this.scene.background = roomDef ? new THREE.Color(roomDef.bg) : this.texture(env);
    this.scene.fog = roomDef ? new THREE.FogExp2(roomDef.bg, roomDef.fog) : null;
    this.rooms.forEach((r) => (r.group.visible = false));
    if (roomDef) {
      if (this.skybox) this.skybox.visible = false;
      let room = this.rooms.get(env);
      if (!room) {
        room = roomDef.build(GROUND_Y);
        this.rooms.set(env, room);
        this.scene.add(room.group);
      }
      room.group.visible = true;
      this.activeRoom = room;
    } else {
      this.activeRoom = null;
      this.showPanorama(env);
    }

    this.ambientLight.color.set(look.ambient[0]);
    this.ambientLight.intensity = look.ambient[1];
    this.keyLight.color.set(look.key[0]);
    this.keyLight.intensity = look.key[1];
    this.fillLight.color.set(look.fill[0]);
    this.fillLight.intensity = look.fill[1];
    this.rimLight.color.set(look.rim[0]);
    this.rimLight.intensity = look.rim[1];
    (this.ground.material as THREE.ShadowMaterial).opacity = look.shadow;
    this.setLightAngle(this.lightAngle);

    if (look.particles) this.createParticles(look.particles.count, look.particles.color, look.particles.size, look.particles.motion);
  }

  private createParticles(count: number, colorHex: number, size: number, movementType: 'up' | 'fast_up' | 'down_drift' | 'float') {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 8.0;
      positions[i * 3 + 1] = Math.random() * 5.0 - 0.5;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 8.0;

      if (movementType === 'up') {
        velocities[i * 3] = (Math.random() - 0.5) * 0.2;
        velocities[i * 3 + 1] = 0.2 + Math.random() * 0.3;
        velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.2;
      } else if (movementType === 'fast_up') {
        velocities[i * 3] = (Math.random() - 0.5) * 0.4;
        velocities[i * 3 + 1] = 0.6 + Math.random() * 0.8;
        velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.4;
      } else if (movementType === 'down_drift') {
        velocities[i * 3] = 0.3 + Math.random() * 0.2; // wind drift
        velocities[i * 3 + 1] = -0.35 - Math.random() * 0.25;
        velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.2;
      } else {
        velocities[i * 3] = (Math.random() - 0.5) * 0.1;
        velocities[i * 3 + 1] = (Math.random() - 0.5) * 0.1;
        velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.1;
      }
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({ color: colorHex, size, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
    this.particleSystem = new THREE.Points(geo, mat);
    this.particlePositions = positions;
    this.particleVelocities = velocities;
    this.scene.add(this.particleSystem);
  }

  public animate(deltaTime: number) {
    this.time += deltaTime;
    this.activeRoom?.update(this.time);
    if (!this.particleSystem || !this.particlePositions || !this.particleVelocities) return;
    const count = this.particlePositions.length / 3;
    for (let i = 0; i < count; i++) {
      this.particlePositions[i * 3] += this.particleVelocities[i * 3] * deltaTime;
      this.particlePositions[i * 3 + 1] += this.particleVelocities[i * 3 + 1] * deltaTime;
      this.particlePositions[i * 3 + 2] += this.particleVelocities[i * 3 + 2] * deltaTime;
      if (this.particlePositions[i * 3 + 1] > 5.0) this.particlePositions[i * 3 + 1] = -0.5;
      else if (this.particlePositions[i * 3 + 1] < -0.5) this.particlePositions[i * 3 + 1] = 5.0;
      if (this.particlePositions[i * 3] > 4.5) this.particlePositions[i * 3] = -4.5;
      if (this.particlePositions[i * 3] < -4.5) this.particlePositions[i * 3] = 4.5;
    }
    this.particleSystem.geometry.attributes.position.needsUpdate = true;
  }
}

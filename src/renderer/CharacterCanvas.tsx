import { configureRenderer, getRenderSettings } from '../settings/renderSettings';
import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import * as THREE from 'three';
import { CharacterState, CameraViewPreset } from '../types/character';
import { CharacterModel } from './CharacterModel';
import { EnvironmentScene } from './EnvironmentScene';
import { SKY_CENTER_Z } from './environmentStage';
import { STAGE_FOCUS_X_VAR, StageVignette } from './StageVignette';
import { makeStudioEnvironment } from './character/skin';
import { SKILL_EVENT } from './character/skills';
import { EXPORT_GLB_EVENT, downloadBlob, exportGLB } from './exportGlb';

/** Camera elevation limits (polar angle from straight above): from nearly overhead down to eye level, never below. */
const MIN_PHI = Math.PI * 0.12;
const MAX_PHI = Math.PI * 0.5;

/** Full-body framing distance per metre of character height. */
const FULL_BODY_RADIUS_PER_HEIGHT = 1.85;
const MIN_ORBIT_RADIUS = 0.75;
/**
 * The painted floor is projected from SKY_CENTER_Z: backing the camera far past that point stretches it, so zooming out
 * stops a little behind it (or at the full-body framing for a character tall enough to need more room).
 */
const MAX_ORBIT_PAST_PAINTING_EYE = 0.4;

function clampOrbitRadius(radius: number, characterHeight: number): number {
  const maxRadius = Math.max(SKY_CENTER_Z + MAX_ORBIT_PAST_PAINTING_EYE, FULL_BODY_RADIUS_PER_HEIGHT * characterHeight);
  return Math.max(MIN_ORBIT_RADIUS, Math.min(maxRadius, radius));
}

export interface CharacterCanvasRef {
  setCameraView: (preset: CameraViewPreset) => void;
  takeScreenshot: () => string;
  /** Shift the picture sideways on screen (fraction of the width; +0.2 moves the character 20% to the left) without moving the orbit centre. */
  setViewShift: (frac: number) => void;
}

interface Props {
  characterState: CharacterState;
  autoRotate?: boolean;
  active?: boolean;
  /** Home screen: only horizontal rotation is allowed (no zoom, no vertical tilt, no panning). */
  lockView?: boolean;
  /** Show the class weapon in the hands (off in the character creator). */
  showWeapons?: boolean;
  /** Which character this is (a save slot or 'new'): when it changes, the stage shows the loading screen until the new one is dressed. */
  identity?: string | number | null;
}

export const CharacterCanvas = forwardRef<CharacterCanvasRef, Props>(({ characterState, autoRotate = false, lockView = false, active = true, showWeapons = true, identity = null }, ref) => {
  const activeRef = useRef(active);
  activeRef.current = active;
  const lockViewRef = useRef<boolean>(lockView);
  lockViewRef.current = lockView;
  const containerRef = useRef<HTMLDivElement>(null);
  const autoRotateRef = useRef<boolean>(autoRotate);
  autoRotateRef.current = autoRotate;
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const characterModelRef = useRef<CharacterModel | null>(null);
  const [glFailed, setGlFailed] = useState(false);
  // the character stays hidden until its body and clothes are all loaded (see CharacterModel.shown)
  const [dressed, setDressed] = useState(false);
  const lastIdentity = useRef(identity);
  /** Look-at height of the face / portrait view for the head at its resting place (the live head offset is added each frame). */
  const headLook = useRef(0);
  const envSceneRef = useRef<EnvironmentScene | null>(null);

  // Camera Orbit and Target Lerping
  const targetCameraPos = useRef<THREE.Vector3>(new THREE.Vector3(0, 0.15, 3.4));
  const currentCameraPos = useRef<THREE.Vector3>(new THREE.Vector3(0, 0.15, 3.4));
  const targetLookAt = useRef<THREE.Vector3>(new THREE.Vector3(0, 0.15, 0));
  const currentLookAt = useRef<THREE.Vector3>(new THREE.Vector3(0, 0.15, 0));

  // Mouse interaction state
  const isDragging = useRef<boolean>(false);
  const isPanning = useRef<boolean>(false);
  const previousMouse = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const orbitSpherical = useRef<THREE.Spherical>(new THREE.Spherical(3.4, Math.PI / 2, 0));
  /** The camera's eased orbit (radius, elevation, angle): easing these instead of the position keeps fast spins on the circle. */
  const currentSpherical = useRef<THREE.Spherical>(new THREE.Spherical(3.4, Math.PI / 2, 0));

  const activePreset = useRef<CameraViewPreset>('full');
  const lastHeight = useRef<number>(0);
  const viewShift = useRef<number>(0);
  /** The camera never orbits (the backdrop is a fixed picture): dragging and the turntable turn the character instead. */
  const targetYaw = useRef<number>(0);
  const currentYaw = useRef<number>(0);

  /** Frame the character from its real proportions so every race / height slider stays centred. */
  const setCameraView = (preset: CameraViewPreset) => {
    activePreset.current = preset;
    const a = characterModelRef.current?.getAnchors();
    const s = a?.scale ?? 1;
    const H = a?.height ?? 1.7;
    const headY = a?.headY ?? 0.7;
    const chestY = a?.chestY ?? 0.2;
    const waistY = a?.waistY ?? 0.0;
    const feetY = a?.feetY ?? -0.9;
    if (a) lastHeight.current = H;

    if (preset === 'face') {
      targetLookAt.current.set(0, headY - 0.005, 0);
      headLook.current = targetLookAt.current.y;
      orbitSpherical.current.radius = 0.72 * s + 0.08;
      orbitSpherical.current.phi = Math.PI * 0.5;
    } else if (preset === 'portrait') {
      targetLookAt.current.set(0, (headY + chestY) / 2 + 0.02, 0);
      headLook.current = targetLookAt.current.y;
      orbitSpherical.current.radius = 1.5 * s;
      orbitSpherical.current.phi = Math.PI * 0.5;
    } else if (preset === 'waist') {
      targetLookAt.current.set(0, waistY + 0.12 * s, 0);
      orbitSpherical.current.radius = 2.3 * s;
      orbitSpherical.current.phi = Math.PI * 0.5;
    } else if (preset === 'full') {
      targetLookAt.current.set(0, feetY + H * 0.5, 0);
      orbitSpherical.current.radius = FULL_BODY_RADIUS_PER_HEIGHT * H;
      orbitSpherical.current.phi = Math.PI * 0.5;
    } else if (preset === 'shoes') {
      targetLookAt.current.set(0, feetY + 0.14 * s, 0);
      orbitSpherical.current.radius = 1.2 * s + 0.3;
      orbitSpherical.current.phi = Math.PI * 0.42;
    }
  };

  useImperativeHandle(ref, () => ({
    setCameraView,
    setViewShift: (frac: number) => {
      viewShift.current = frac;
      // the view offset moves the picture left by `frac` of the width: the character stands at (0.5 - frac)
      containerRef.current?.style.setProperty(STAGE_FOCUS_X_VAR, `${(0.5 - frac) * 100}%`);
    },
    takeScreenshot: () => {
      if (!rendererRef.current || !sceneRef.current || !cameraRef.current) return '';
      // Force render frame to guarantee full resolution capture
      rendererRef.current.render(sceneRef.current, cameraRef.current);
      return rendererRef.current.domElement.toDataURL('image/png');
    }
  }));

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 50);
    camera.position.set(0, 0.15, 2.7);
    cameraRef.current = camera;

    // Renderer
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: getRenderSettings().antialias,
        preserveDrawingBuffer: true,
        powerPreference: 'high-performance'
      });
    } catch (e) {
      // no WebGL (graphics driver stuck, hardware acceleration off, too many open GPU tabs): say so instead of a black screen
      console.error(e);
      setGlFailed(true);
      return;
    }
    renderer.setSize(width, height);
    configureRenderer(renderer);
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // image-based lighting for believable skin / cloth / metal highlights
    scene.environment = makeStudioEnvironment(renderer);
    scene.environmentIntensity = 0.55;

    // Environment & Lighting
    const envScene = new EnvironmentScene(scene);
    envSceneRef.current = envScene;

    // Character Model
    const characterModel = new CharacterModel(characterState);
    scene.add(characterModel.group);
    characterModelRef.current = characterModel;
    setCameraView('full');
    currentCameraPos.current.setFromSpherical(orbitSpherical.current).add(targetLookAt.current);
    currentSpherical.current.copy(orbitSpherical.current);
    currentLookAt.current.copy(targetLookAt.current);

    // Animation Loop
    let animationFrameId: number;
    let lastTime = performance.now();

    const animate = (time: number) => {
      animationFrameId = requestAnimationFrame(animate);
      const deltaTime = (time - lastTime) / 1000;
      lastTime = time;
      setDressed((was) => (was === characterModel.shown ? was : characterModel.shown));
      if (!activeRef.current) return;

      // Update Character animations
      if (characterModelRef.current) {
        characterModelRef.current.animate(deltaTime);
      }

      // Update Environment particles
      if (envSceneRef.current) {
        envSceneRef.current.animate(deltaTime);
      }

      // Turntable: slow orbit while the user is not dragging
      if (autoRotateRef.current && !isDragging.current) {
        targetYaw.current += deltaTime * 0.15;
      }

      // close views follow the head through animations (sitting, bowing, floating …)
      const preset = activePreset.current;
      if ((preset === 'face' || preset === 'portrait') && characterModelRef.current) {
        const live = characterModelRef.current.liveHeadY();
        const rest = characterModelRef.current.getAnchors().headY;
        if (Number.isFinite(live) && Number.isFinite(rest)) targetLookAt.current.y = headLook.current + (live - rest);
      }

      // turn the character towards its target angle (shortest way round)
      let dYaw = targetYaw.current - currentYaw.current;
      dYaw -= Math.round(dYaw / (Math.PI * 2)) * Math.PI * 2;
      currentYaw.current += dYaw * 0.15;
      characterModelRef.current?.setYaw(currentYaw.current);

      // Smooth Orbit Camera update
      // orbit only around the vertical axis and from level to above: never from below
      orbitSpherical.current.phi = Math.max(MIN_PHI, Math.min(MAX_PHI, orbitSpherical.current.phi));
      targetCameraPos.current.setFromSpherical(orbitSpherical.current).add(targetLookAt.current);

      // ease in spherical coordinates: easing the position would cut across the circle during a fast spin and
      // pull the camera towards the character (a zoom-in)
      const cs = currentSpherical.current;
      const ts = orbitSpherical.current;
      let dTheta = ts.theta - cs.theta;
      dTheta -= Math.round(dTheta / (Math.PI * 2)) * Math.PI * 2;
      cs.theta += dTheta * 0.1;
      cs.phi += (ts.phi - cs.phi) * 0.1;
      cs.radius += (ts.radius - cs.radius) * 0.1;
      currentLookAt.current.lerp(targetLookAt.current, 0.1);
      currentCameraPos.current.setFromSpherical(cs).add(currentLookAt.current);

      camera.position.copy(currentCameraPos.current);
      camera.lookAt(currentLookAt.current);

      // screen-space framing offset (keeps the orbit centred on the character)
      const box = containerRef.current;
      if (box && viewShift.current !== 0) {
        const w = box.clientWidth;
        const h = box.clientHeight;
        camera.setViewOffset(w, h, viewShift.current * w, 0, w, h);
      } else if (camera.view?.enabled) {
        camera.clearViewOffset();
      }

      renderer.render(scene, camera);
    };

    animationFrameId = requestAnimationFrame(animate);

    // Resize Handler
    const handleResize = () => {
      if (!containerRef.current || !rendererRef.current || !cameraRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // Mouse / Touch Orbit Controls
    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 0) isDragging.current = true;
      if (e.button === 2) isPanning.current = true;
      previousMouse.current = { x: e.clientX, y: e.clientY };
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!activeRef.current) return;
      const deltaX = e.clientX - previousMouse.current.x;
      const deltaY = e.clientY - previousMouse.current.y;
      previousMouse.current = { x: e.clientX, y: e.clientY };

      if (isDragging.current) {
        targetYaw.current += deltaX * 0.007;
      } else if (isPanning.current && !lockViewRef.current) {
        targetLookAt.current.y += deltaY * 0.003;
      }
    };

    const onMouseUp = () => {
      isDragging.current = false;
      isPanning.current = false;
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (lockViewRef.current) return;
      orbitSpherical.current.radius = clampOrbitRadius(orbitSpherical.current.radius + e.deltaY * 0.0025, lastHeight.current);
    };

    const onContextMenu = (e: MouseEvent) => e.preventDefault();

    const dom = renderer.domElement;
    dom.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    dom.addEventListener('wheel', onWheel, { passive: false });
    dom.addEventListener('contextmenu', onContextMenu);

    // Touch events
    let touchStartDist = 0;
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        isDragging.current = true;
        previousMouse.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      } else if (e.touches.length === 2) {
        touchStartDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 1 && isDragging.current) {
        const deltaX = e.touches[0].clientX - previousMouse.current.x;
        previousMouse.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };

        targetYaw.current += deltaX * 0.007;
      } else if (e.touches.length === 2 && !lockViewRef.current) {
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        const diff = touchStartDist - dist;
        orbitSpherical.current.radius = clampOrbitRadius(orbitSpherical.current.radius + diff * 0.005, lastHeight.current);
        touchStartDist = dist;
      }
    };

    const onTouchEnd = () => {
      isDragging.current = false;
    };

    dom.addEventListener('touchstart', onTouchStart);
    dom.addEventListener('touchmove', onTouchMove);
    dom.addEventListener('touchend', onTouchEnd);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      dom.removeEventListener('mousedown', onMouseDown);
      dom.removeEventListener('wheel', onWheel);
      dom.removeEventListener('contextmenu', onContextMenu);
      dom.removeEventListener('touchstart', onTouchStart);
      dom.removeEventListener('touchmove', onTouchMove);
      dom.removeEventListener('touchend', onTouchEnd);
      cancelAnimationFrame(animationFrameId);
      envScene.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Skill performances requested by the UI
  useEffect(() => {
    const onSkill = (e: Event) => characterModelRef.current?.playSkill((e as CustomEvent<string>).detail);
    window.addEventListener(SKILL_EVENT, onSkill);
    return () => window.removeEventListener(SKILL_EVENT, onSkill);
  }, []);

  // Export the character as .glb when the UI asks for it
  useEffect(() => {
    const onExport = async (e: Event) => {
      const model = characterModelRef.current;
      if (!model) return;
      const name = ((e as CustomEvent<string>).detail || 'nhan-vat').replace(/[^\p{L}\p{N}_-]+/gu, '_');
      try {
        downloadBlob(await exportGLB(model.group), `${name}.glb`);
      } catch (err) {
        console.error('GLB export failed', err);
        window.alert('Không xuất được GLB: ' + (err instanceof Error ? err.message : String(err)));
      }
    };
    window.addEventListener(EXPORT_GLB_EVENT, onExport);
    return () => window.removeEventListener(EXPORT_GLB_EVENT, onExport);
  }, []);

  useEffect(() => {
    characterModelRef.current?.setWeaponsVisible(showWeapons);
  }, [showWeapons]);

  // Update Character state when props change
  useEffect(() => {
    if (characterModelRef.current) {
      if (lastIdentity.current !== identity) {
        lastIdentity.current = identity;
        characterModelRef.current.closeGate();
      }
      characterModelRef.current.updateState(characterState);
      const h = characterModelRef.current.getAnchors().height;
      if (Math.abs(h - lastHeight.current) > 0.002) setCameraView(activePreset.current);
    }
    if (envSceneRef.current) {
      envSceneRef.current.setupEnvironment(characterState.environment);
      envSceneRef.current.setLightAngle(characterState.lightAngle);
    }
  }, [characterState]);

  return (
    <div 
      ref={containerRef} 
      className="w-full h-full absolute inset-0 cursor-grab active:cursor-grabbing overflow-hidden" 
    >
      <StageVignette />
      {!dressed && !glFailed && (
        <div role="status" className="absolute inset-0 z-10 grid place-items-center pointer-events-none">
          <div className="flex items-center gap-3 px-4 py-2 text-sm text-white/85 bg-black/45 border border-white/15">
            <span className="w-4 h-4 rounded-full border-2 border-white/25 border-t-sky-300 animate-spin" aria-hidden />
            Đang tải nhân vật…
          </div>
        </div>
      )}
      {glFailed && (
        <div role="alert" className="absolute inset-0 z-50 grid place-items-center bg-[#0b0d12] p-6 text-center text-white">
          <div className="max-w-md">
            <h1 className="mb-2 text-xl font-semibold">Không khởi tạo được đồ họa 3D (WebGL)</h1>
            <p className="text-sm leading-relaxed text-white/70">
              Trình duyệt không cấp được WebGL. Hãy đóng hết các tab đang dùng GPU, khởi động lại trình duyệt (hoặc máy) và bật “Dùng tăng tốc phần cứng” trong cài đặt trình duyệt, rồi tải lại trang.
            </p>
            <button className="gp-btn mt-4" onClick={() => window.location.reload()}>
              Tải lại trang
            </button>
          </div>
        </div>
      )}
    </div>
  );
});

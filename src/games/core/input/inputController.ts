import type { Agent } from '../agents/agent';
import { isAiming, type AimStyle } from '../aim/aimModes';
import type { PlayerAim } from '../aim/playerAim';
import { actionForKey, isCoreAction, type ControlLayout } from './controlLayouts';
import type { PlayerStanceKeys } from './playerStanceKeys';
import { activeWeapon, WEAPONS, type WeaponState } from '../rules';

/** What keys, buttons and the mouse do in the engine. */
export interface InputHandlers<A extends string> {
  isActive(): boolean;
  menuOpen(): boolean;
  playerAlive(): boolean;
  escape(): void;
  keyDown(action: A, repeat: boolean): void;
  keyUp(action: A): void;
  /** A key only the game uses went down or up: the HUD may show it at once (a held scoreboard). */
  gameKeyChanged(): void;
  look(dx: number, dy: number): void;
  /** Mouse wheel: the next (or previous) weapon slot that holds something. */
  cycleWeapon(forward: boolean): void;
  spectateNext(): void;
  lockPointer(): void;
  /** Ctrl + Alt: lets the cursor out without pausing; a click on the canvas takes it back. */
  freePointer(): void;
  pause(): void;
}

/** What turning held keys into the player's input needs from the frame. */
export interface PlayerInputFrame {
  dt: number;
  now: number;
  /** The right button aims guns in `aimStyle` (otherwise it aims only while held, and scopes zoom). */
  rightButtonAimsGuns: boolean;
  thirdPerson: boolean;
  aimStyle: AimStyle;
  menuOpen: boolean;
  aim: PlayerAim;
  stance: PlayerStanceKeys;
  canAim(w: WeaponState | null, menuOpen: boolean): boolean;
}

const CHORD_KEYS = new Set(['ControlLeft', 'ControlRight', 'AltLeft', 'AltRight']);

/** The second of Ctrl and Alt going down while the other is held. */
const isFreePointerChord = (e: KeyboardEvent) => CHORD_KEYS.has(e.code) && e.ctrlKey && e.altKey && !e.repeat;

/** Keyboard, mouse and touch: the DOM listeners and the raw state of what is held. */
export class InputController<A extends string> {
  /** Actions whose key is held (the game's own ones too). */
  readonly keys = new Set<string>();
  mouse = [false, false];
  touchFire = false;
  touchAlt = false;
  reloadPressed = false;
  /** -1 / 0 / 1: Q or E held. */
  leanWant = 0;
  /** The next pointer-lock release was asked for (a menu opened), so it must not pause the game. */
  unlocking = false;
  private ctrlSpaceActive = false;
  private dragging = false;
  private touchPoint = { x: 0, y: 0 };
  private readonly removers: (() => void)[] = [];

  constructor(canvas: HTMLCanvasElement, private readonly layout: ControlLayout<A>, private readonly on: InputHandlers<A>) {
    this.bind(canvas);
  }

  /** Lets go of every key and button (pause, restart). */
  release() {
    this.keys.clear();
    this.mouse = [false, false];
    this.touchFire = this.touchAlt = false;
  }

  /** Turns what is held into the player's input for this frame, and steps the aim. */
  applyTo(player: Agent, f: PlayerInputFrame) {
    const k = this.keys;
    const inp = player.input;
    inp.f = Number(k.has('forward')) - Number(k.has('back'));
    inp.r = Number(k.has('right')) - Number(k.has('left'));
    inp.walk = k.has('walk');
    inp.crouch = f.stance.value === 'crouch';
    inp.jump = k.has('jump');
    const ui = f.menuOpen;
    inp.fire = !ui && (this.mouse[0] || this.touchFire);
    const w = activeWeapon(player.inv);
    const aimsGuns = f.rightButtonAimsGuns;
    const aimPressed = !ui && (this.mouse[1] || this.touchAlt);
    const mode = f.aim.step({
      dt: f.dt, now: f.now, style: aimsGuns ? f.aimStyle : 'hold', perspective: f.thirdPerson ? 'tpp' : 'fpp', pressed: aimPressed, canAim: f.canAim(w, ui),
      freeLookHeld: k.has('freeLook') && player.alive, holdBreathHeld: k.has('sprint'), scoped: !!w && !!WEAPONS[w.id].scope, stance: f.stance.value,
    });
    // when the right button aims guns it aims scoped ones too; it stays the secondary attack of knives and grenades (and of scopes otherwise)
    inp.alt = aimPressed && !(aimsGuns && !!w && WEAPONS[w.id].slot <= 2);
    if (aimsGuns && w && WEAPONS[w.id].scope) w.zoom = mode === 'ADS' ? 1 : 0;
    // a shot or an aim ends a sprint at once (Shift holds the breath through a scope instead)
    inp.sprint = k.has('sprint') && inp.f > 0 && f.stance.value === 'stand' && !inp.fire && !inp.alt && !isAiming(mode);
    this.leanWant = Number(k.has('leanRight')) - Number(k.has('leanLeft'));
    inp.reload = this.reloadPressed;
    this.reloadPressed = false;
  }

  dispose() {
    this.removers.forEach((remove) => remove());
  }

  private listen(target: EventTarget, event: string, handler: EventListener, options?: AddEventListenerOptions) {
    target.addEventListener(event, handler, options);
    this.removers.push(() => target.removeEventListener(event, handler, options));
  }

  private bind(canvas: HTMLCanvasElement) {
    this.listen(window, 'keydown', ((e: KeyboardEvent) => {
      if (e.code === 'Space' && e.ctrlKey) {
        e.preventDefault();
        e.stopPropagation();
        this.ctrlSpaceActive = true;
        if (this.on.isActive()) this.keys.add('jump');
        return;
      }
      if ((e.target as HTMLElement)?.closest('input,textarea,[contenteditable]')) return;
      if (e.code === 'Escape') {
        this.on.escape();
        return;
      }
      if (isFreePointerChord(e)) {
        e.preventDefault();
        this.release();
        this.on.freePointer();
        return;
      }
      const action = actionForKey(this.layout, e.code);
      if (!this.on.isActive() || !action) return;
      e.preventDefault();
      this.on.keyDown(action, e.repeat);
      if (!e.repeat && !isCoreAction(action)) this.on.gameKeyChanged();
    }) as EventListener, { capture: true });
    this.listen(window, 'keyup', ((e: KeyboardEvent) => {
      if (e.code === 'Space' && this.ctrlSpaceActive) {
        e.preventDefault();
        e.stopPropagation();
        this.ctrlSpaceActive = false;
      }
      const action = actionForKey(this.layout, e.code);
      if (!action) return;
      this.on.keyUp(action);
      if (!isCoreAction(action)) this.on.gameKeyChanged();
    }) as EventListener, { capture: true });
    this.listen(canvas, 'pointerdown', ((e: PointerEvent) => {
      if (!this.on.isActive()) return;
      if (e.pointerType === 'touch') {
        this.touchPoint = { x: e.clientX, y: e.clientY };
        this.dragging = true;
        canvas.setPointerCapture(e.pointerId);
        return;
      }
      if (this.on.menuOpen()) return;
      if (document.pointerLockElement !== canvas) this.on.lockPointer();
      if (e.button === 0) this.mouse[0] = true;
      if (e.button === 2) this.mouse[1] = true;
      if (!this.on.playerAlive() && e.button === 0) this.on.spectateNext();
    }) as EventListener);
    this.listen(window, 'pointerup', ((e: PointerEvent) => {
      if (e.pointerType === 'touch') this.dragging = false;
      else if (e.button === 0) this.mouse[0] = false;
      else if (e.button === 2) this.mouse[1] = false;
      if (e.pointerType !== 'touch' && e.buttons === 0) this.mouse[0] = this.mouse[1] = false;
    }) as EventListener);
    // browsers also report the chorded press as a plain mouse event
    const chord = ((e: MouseEvent) => {
      if (!this.on.isActive() || !(this.mouse[0] || this.mouse[1])) return;
      this.mouse[0] = (e.buttons & 1) !== 0;
      this.mouse[1] = (e.buttons & 2) !== 0;
    }) as EventListener;
    this.listen(window, 'mousedown', chord);
    this.listen(window, 'mouseup', chord);
    this.listen(window, 'pointermove', ((e: PointerEvent) => {
      if (!this.on.isActive()) return;
      // pressing a second mouse button while one is held (right = aim, then left = fire) sends no pointerdown, only a move with the
      // new `buttons`: follow it, but only for a press that began on the canvas
      if (e.pointerType !== 'touch' && (this.mouse[0] || this.mouse[1])) {
        this.mouse[0] = (e.buttons & 1) !== 0;
        this.mouse[1] = (e.buttons & 2) !== 0;
      }
      if (e.pointerType === 'touch') {
        if (!this.dragging) return;
        this.on.look((e.clientX - this.touchPoint.x) * 1.6, (e.clientY - this.touchPoint.y) * 1.6);
        this.touchPoint = { x: e.clientX, y: e.clientY };
      } else if (document.pointerLockElement === canvas) this.on.look(e.movementX, e.movementY);
    }) as EventListener);
    this.listen(canvas, 'wheel', ((e: WheelEvent) => {
      if (!this.on.isActive() || !this.on.playerAlive()) return;
      this.on.cycleWeapon(e.deltaY > 0);
    }) as EventListener, { passive: true });
    this.listen(canvas, 'contextmenu', ((e: Event) => e.preventDefault()) as EventListener);
    this.listen(document, 'pointerlockchange', (() => {
      if (document.pointerLockElement === canvas) return;
      if (this.unlocking) {
        this.unlocking = false;
        return;
      }
      // leaving the browser also drops the lock: the match keeps running, only Esc pauses
      if (document.hidden || !document.hasFocus()) return;
      if (!this.on.menuOpen()) this.on.pause();
    }) as EventListener);
    // keyup and pointerup never arrive once the window loses focus, so held keys and buttons would stick
    this.listen(window, 'blur', (() => this.release()) as EventListener);
    this.listen(document, 'visibilitychange', (() => document.hidden && this.release()) as EventListener);
  }
}

import { configureRenderer, getRenderSettings } from '../../settings/renderSettings';
import { getGameplaySettings } from '../../settings/gameplaySettings';
import * as THREE from 'three';
import { CharacterState } from '../../types/character';
import { CharacterModel } from '../../renderer/CharacterModel';
import { Agent, allied } from './agents/agent';
import { AiWorld, Difficulty, SKILLS, think } from './agents/ai';
import { Effects } from './effects';
import { disposeTree, ViewModel } from './models';
import { PlayerAvatarRig } from './combat/PlayerAvatarRig';
import { FirstPersonArms } from './combat/FirstPersonArms';
import { PlayerStanceKeys } from './input/playerStanceKeys';
import { floorAt, moveAgent, type MovementWorld } from './agents/agentMovement';
import type { ControlLayout, CoreAction } from './input/controlLayouts';
import { PlayerAim } from './aim/playerAim';
import { slowsMovement } from './aim/aimModes';
import { NavGrid } from './agents/nav';
import { activeWeapon, dropActive, MOVE, rayBox, selectSlot, SlotNo, WEAPONS, WeaponState, type WeaponId } from './rules';
import { Sfx } from './sfx';
import { Combat } from './engine/combat';
import { FrameRenderer, VFOV } from './engine/frameRenderer';
import { FrameRateLimiter } from './engine/frameRateLimiter';
import { Grenades } from './engine/grenades';
import { buildSnapshot } from './engine/hudSnapshot';
import { InputController, type InputHandlers } from './input/inputController';
import { MatchContext, type GameMenus, type ShooterRules } from './engine/matchContext';
import type { GameSnapshot } from './engine/snapshotTypes';
import type { ShooterMap } from './world/shooterMap';
import { applyViewDistance } from './world/viewDistance';

export type { GameSnapshot, KillEvent, Phase, ScoreRow } from './engine/snapshotTypes';

/** What a game hands the shared engine: its map, how it plays, and its own menus. */
export interface ShooterSetup<TMap extends ShooterMap, TAction extends string> {
  buildMap(renderer: THREE.WebGLRenderer): TMap;
  rules: ShooterRules;
  controls: ControlLayout<TAction>;
  menus: GameMenus;
}

/** Room kept between a leaning head and a wall (m). */
const LEAN_WALL_GAP = 0.18;
/** Radians of turn per pixel of mouse movement at sensitivity 1. */
const LOOK = 0.0018;
const WEAPON_CYCLE: SlotNo[] = [1, 2, 3, 4];

/**
 * What the shooter games share: the renderer, the player's character, aiming, movement, combat, grenades and the frame loop.
 * Each game brings its map, rules and menus (`ShooterSetup`), adds its own items, HUD view (`TView`) and controls through the
 * protected hooks below, and calls `boot()` once it is fully built.
 */
export abstract class GameEngine<TMap extends ShooterMap = ShooterMap, TView = unknown, TAction extends string = CoreAction> {
  readonly arena: TMap;
  readonly renderer: THREE.WebGLRenderer;
  readonly camera = new THREE.PerspectiveCamera(VFOV, 1, 0.05, 1000);
  protected readonly ctx: MatchContext<TMap>;
  protected readonly sfx = new Sfx();
  private readonly nav: NavGrid;
  private readonly vm: ViewModel;
  protected readonly player: Agent;
  private readonly model: CharacterModel;
  private readonly rig: PlayerAvatarRig;
  /** The player's character holding the gun in the first-person view (box arms until it has loaded). */
  private readonly fpArms: FirstPersonArms;
  /** Stance the player chose (C crouch, Z prone); the body eases into it through `crouch` / `prone`. */
  protected readonly stance = new PlayerStanceKeys();
  /** The player's aiming: mode, camera, free look, scope sway and the aim point (see aim/). */
  private readonly playerAim = new PlayerAim();
  protected readonly input: InputController<TAction>;
  protected readonly combat: Combat;
  private readonly grenades: Grenades;
  private readonly frames: FrameRenderer;
  private readonly host: HTMLDivElement;
  protected paused = false;
  private touchMode = false;
  private difficulty: Difficulty = 'normal';
  private sensitivity: number;
  /** Read once: changes made on the home screen apply from the next match. */
  private readonly gameplay = getGameplaySettings();
  /** The starting view comes from the settings (third person shows the character they made); V switches. */
  private thirdPerson = this.gameplay.startPerspective === 'tpp';
  private playerWasSwimming = false;
  // loop
  private frame = 0;
  private readonly frameLimiter = new FrameRateLimiter(getRenderSettings().frameRateCap);
  private last = performance.now();
  private hudTime = 0;
  private spotTime = 0;
  private disposed = false;
  private readonly resizeObserver: ResizeObserver;

  protected constructor(
    setup: ShooterSetup<TMap, TAction>,
    host: HTMLDivElement,
    state: CharacterState,
    private readonly onState: (s: GameSnapshot<TView>) => void,
    sensitivity = 1,
  ) {
    this.host = host;
    this.sensitivity = sensitivity;
    this.renderer = new THREE.WebGLRenderer({ antialias: getRenderSettings().antialias, powerPreference: 'high-performance' });
    configureRenderer(this.renderer, 1.5);
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.8;
    this.renderer.autoClear = false;
    host.appendChild(this.renderer.domElement);
    this.arena = setup.buildMap(this.renderer);
    applyViewDistance(this.arena, this.camera);
    this.nav = this.arena.nav;
    this.player = new Agent(0, state.name?.trim() || 'Bạn', 'CT', true);
    this.ctx = new MatchContext(this.arena, setup.rules, setup.menus, new Effects(this.arena.scene), this.sfx, this.player, () => this.emit());

    this.model = new CharacterModel({ ...state, pose: 'idle' });
    this.arena.scene.add(this.model.group);
    // the class weapon (a sword, a bow…) has no place in a gunfight: the hands hold the gun drawn by the rig
    this.model.setWeaponsVisible(false);
    this.rig = new PlayerAvatarRig(this.model);
    this.fpArms = new FirstPersonArms(this.model);
    this.player.leanReach = this.rig.leanReach;
    this.vm = new ViewModel(this.player.team);

    this.combat = new Combat(this.ctx, this.rig, this.playerAim, this.camera, this.vm, {
      leaveGear: (victim) => this.leaveGear(victim),
      afterDeath: (victim, attacker) => this.afterDeath(victim, attacker),
      throwGrenade: (thrower, throwMode) => this.grenades.throw(thrower, throwMode),
      isInvulnerable: (victim) => this.isInvulnerable(victim),
      rewardKill: (killer, weapon) => this.rewardKill(killer, weapon),
    });
    this.grenades = new Grenades(this.ctx, this.combat);
    this.frames = new FrameRenderer(
      this.ctx,
      {
        renderer: this.renderer, camera: this.camera, host, root: host.parentElement ?? host, rig: this.rig, fpArms: this.fpArms, vm: this.vm, aim: this.playerAim,
        stance: this.stance, playerBody: this.model.group,
        updateWorldView: (cameraPosition, timeS) => this.updateWorldView(cameraPosition, timeS),
        placeGameCamera: (target, camera, eyeFovDeg) => this.placeGameCamera(target, camera, eyeFovDeg),
      },
      this.combat,
    );
    this.input = new InputController(this.renderer.domElement, setup.controls, this.inputHandlers());
    this.resizeObserver = new ResizeObserver(() => this.frames.resize());
  }

  /** Starts drawing; called by the game's constructor once its own parts exist (the first frame already reads them). */
  protected boot() {
    this.resizeObserver.observe(this.host);
    this.frames.resize();
    this.loop(this.last);
  }

  /* ───────────────────────── game hooks ───────────────────────── */

  /** A fresh match: the first one when the player starts, and every restart. */
  protected abstract startMatch(): void;
  /** The game's clock and rules for this frame, before anyone moves; true when the match has just ended. */
  protected abstract stepRules(dt: number): boolean;
  /** The game's own world after everyone has moved and fired (dropping, picking up, the end of a round). */
  protected abstract stepWorld(dt: number): void;
  /** Someone has died: the game checks whether the round or the match is over. */
  protected abstract afterDeath(victim: Agent, attacker: Agent): void;
  /** What a fallen fighter leaves on the ground. */
  protected abstract leaveGear(victim: Agent): void;
  /** Lays a weapon taken out of a fighter's hands on the ground. */
  protected abstract placeDroppedWeapon(a: Agent, w: WeaponState, onDeath: boolean): void;
  /** The game's rule on top of the shared checks for raising a gun to aim. */
  protected abstract canAimWith(w: WeaponState): boolean;
  /** Handles a key that only this game uses; true when it was handled. */
  protected abstract handleGameKey(action: TAction): boolean;
  /** Closes the game's own menu (buy menu, inventory, map) if one is open; true when one was. */
  protected abstract closeOpenMenu(): boolean;
  /** The part of the HUD only this game fills. */
  protected abstract gameView(): TView;
  /** Where the bots head and what they can climb. */
  protected abstract aiGoals(): Pick<AiWorld, 'objective' | 'climbs' | 'isHostile'>;

  /** Bots skip their thinking this frame (a CS Lite test match can freeze them). */
  protected shouldBotsThink() {
    return true;
  }
  /** One bot's decisions this frame; a game with bots that are not fighters (passers-by) steers those itself. */
  protected thinkBot(bot: Agent, world: AiWorld, dt: number) {
    think(bot, world, dt);
  }
  /** Dresses the player's character in another look (the open world's protagonists). */
  protected restyleCharacter(state: CharacterState) {
    this.model.updateState({ ...state, pose: 'idle' });
  }
  /** Runs after the bots have chosen their input and before anyone moves. */
  protected afterBotsThink() {}
  /** A fighter takes no damage (a CS Lite test match's god mode). */
  protected isInvulnerable(_victim: Agent) {
    return false;
  }
  /** A fighter killed an enemy with `weapon` (a game with an economy pays for it). */
  protected rewardKill(_killer: Agent, _weapon: WeaponId) {}
  /** The game pauses: close what must not stay open under the pause menu. */
  protected onPause() {}
  /** The game places the camera itself for this fighter (riding the battle royale plane); false leaves it to the aim camera. */
  protected placeGameCamera(_target: Agent, _camera: THREE.PerspectiveCamera, _eyeFovDeg: number) {
    return false;
  }
  /** The game's world drawing each frame (battle royale: loot and the zone). */
  protected updateWorldView(_cameraPosition: THREE.Vector3, _timeS: number) {}

  /* ───────────────────────── public controls ───────────────────────── */

  public start(difficulty: Difficulty, touch = false) {
    if (!this.model.ready) return;
    this.touchMode = touch;
    this.difficulty = difficulty;
    // eye height, hit boxes and camera follow the size of the character the player made (race + height slider)
    this.player.scale = this.model.getAnchors().height / 1.72;
    if (this.ctx.phase === 'menu' || this.ctx.phase === 'matchEnd') this.startMatch();
    this.paused = false;
    this.last = performance.now();
    if (!touch) this.lock();
    this.sfx.resume();
    this.emit();
  }
  public resume() {
    if (!this.paused || this.ctx.phase === 'menu' || this.ctx.phase === 'matchEnd') return;
    this.paused = false;
    this.last = performance.now();
    if (!this.touchMode) this.lock();
    this.sfx.resume();
    this.emit();
  }
  public restart() {
    if (!this.paused || this.ctx.phase === 'menu') return;
    this.input.release();
    this.ctx.menus.closeAll();
    this.paused = false;
    this.startMatch();
    this.last = performance.now();
    if (!this.touchMode) this.lock();
    this.sfx.resume();
    this.emit();
  }
  public pause() {
    if (this.ctx.phase === 'menu' || this.ctx.phase === 'matchEnd' || this.paused) return;
    this.paused = true;
    this.input.release();
    this.onPause();
    if (document.pointerLockElement === this.renderer.domElement) document.exitPointerLock();
    this.emit();
  }
  public setSensitivity(v: number) {
    this.sensitivity = v;
  }
  public control(action: TAction, down: boolean) {
    if (down) this.keyDown(action, false);
    else this.keyUp(action);
  }
  public trigger(down: boolean) {
    this.input.touchFire = down;
  }
  public secondary(down: boolean) {
    this.input.touchAlt = down;
  }
  public look(dx: number, dy: number) {
    if (!this.player.alive || this.ctx.menuOpen) return;
    // slower in step with the zoom: over the shoulder, down the sights, through a scope
    const aimBlend = Math.max(this.playerAim.view.ads, this.playerAim.view.shoulder);
    const k = LOOK * this.sensitivity * THREE.MathUtils.lerp(1, this.gameplay.aimSensitivity, aimBlend) * Math.min(1, this.camera.fov / VFOV);
    const ky = this.gameplay.invertY ? -k : k;
    if (this.playerAim.look(-dx * k, -dy * ky)) return;
    this.player.yaw -= dx * k;
    this.player.pitch = THREE.MathUtils.clamp(this.player.pitch - dy * ky, -1.5, 1.5);
    this.frames.swayBy(dx, dy);
  }
  public reload() {
    this.input.reloadPressed = true;
  }
  public slot(n: SlotNo) {
    if (this.player.alive && selectSlot(this.player.inv, n)) this.onSwitch();
  }

  /* ───────────────────────── input ───────────────────────── */

  private inputHandlers(): InputHandlers<TAction> {
    return {
      isActive: () => this.active(),
      menuOpen: () => this.ctx.menuOpen,
      playerAlive: () => this.player.alive,
      escape: () => this.escape(),
      keyDown: (action, repeat) => this.keyDown(action, repeat),
      keyUp: (action) => this.keyUp(action),
      gameKeyChanged: () => this.emit(),
      look: (dx, dy) => this.look(dx, dy),
      cycleWeapon: (forward) => this.cycleWeapon(forward),
      spectateNext: () => {
        this.ctx.spectate++;
      },
      lockPointer: () => this.lock(),
      freePointer: () => this.freePointer(),
      pause: () => this.pause(),
    };
  }

  private lock() {
    try {
      const r = this.renderer.domElement.requestPointerLock?.() as unknown as Promise<void> | undefined;
      r?.catch?.(() => this.ctx.say('Nhấn vào màn hình để khoá chuột.'));
    } catch {
      this.ctx.say('Nhấn vào màn hình để khoá chuột.');
    }
  }

  private freePointer() {
    if (document.pointerLockElement !== this.renderer.domElement) return;
    this.input.unlocking = true;
    document.exitPointerLock();
  }

  /** A menu opening frees the mouse (without pausing); closing it takes the mouse back. */
  protected releasePointerForMenu(menuOpen: boolean) {
    if (menuOpen && document.pointerLockElement === this.renderer.domElement) {
      this.input.unlocking = true;
      document.exitPointerLock();
    } else if (!menuOpen && !this.paused && this.active()) this.lock();
  }

  private active() {
    return !this.paused && this.ctx.phase !== 'menu' && this.ctx.phase !== 'matchEnd';
  }

  private escape() {
    if (this.closeOpenMenu()) return;
    if (this.paused) this.resume();
    else this.pause();
  }

  private keyUp(action: TAction) {
    this.input.keys.delete(action);
    this.stance.key(action, false);
  }

  private keyDown(action: TAction, repeat: boolean) {
    this.input.keys.add(action);
    if (repeat) return;
    const p = this.player;
    if (p.alive) this.stance.key(action, true);
    if (this.handleGameKey(action)) return;
    const shared: string = action;
    switch (shared) {
      case 'reload':
        this.input.reloadPressed = true;
        break;
      case 'drop': {
        const w = p.alive ? dropActive(p.inv) : null;
        if (w) {
          this.dropWeapon(p, w);
          this.onSwitch();
        }
        break;
      }
      case 'inspect':
        if ((activeWeapon(p.inv)?.reloadLeft ?? 1) <= 0) this.ctx.feedback.inspectAt = this.ctx.now;
        break;
      case 'lastWeapon':
        if (p.alive && selectSlot(p.inv, p.inv.last)) this.onSwitch();
        break;
      case 'slot1':
      case 'slot2':
      case 'slot3':
      case 'slot4':
        this.slot(Number(shared.slice(4)) as SlotNo);
        break;
      case 'camera':
        this.thirdPerson = !this.thirdPerson;
        break;
      case 'jump':
        if (!p.alive) this.ctx.spectate++;
        else if (this.stance.value !== 'stand') {
          // from a crouch or lying down, jump stands the body up first
          this.stance.stand();
          p.jumpLatch = true;
        }
        break;
    }
  }

  private cycleWeapon(forward: boolean) {
    const inv = this.player.inv;
    let i = WEAPON_CYCLE.indexOf(inv.active);
    for (let n = 0; n < WEAPON_CYCLE.length; n++) {
      i = (i + (forward ? 1 : WEAPON_CYCLE.length - 1)) % WEAPON_CYCLE.length;
      if (WEAPON_CYCLE[i] === inv.active) break;
      if (selectSlot(inv, WEAPON_CYCLE[i])) {
        this.onSwitch();
        break;
      }
    }
  }

  protected onSwitch() {
    this.ctx.feedback.inspectAt = -99;
    this.player.pin = '';
    this.sfx.click(700, 0.08);
  }

  /* ───────────────────────── matches ───────────────────────── */

  /** Clears what the last round or match left on the field: effects, live grenades and the HUD alerts. */
  protected clearBattlefield() {
    this.ctx.effects.reset();
    this.grenades.clear();
    this.ctx.heard = [];
    this.ctx.hurtDirs = [];
    this.ctx.killedBy = '';
  }

  protected resetPlayerStance() {
    this.stance.stand();
    this.playerAim.reset(this.thirdPerson ? 'tpp' : 'fpp');
  }

  /** The match is over: free the mouse for the results screen. */
  private endMatch() {
    if (document.pointerLockElement === this.renderer.domElement) document.exitPointerLock();
    this.emit();
  }

  protected dropWeapon(a: Agent, w: WeaponState, onDeath = false) {
    if (w === a.inv.primary) a.inv.primary = null;
    if (w === a.inv.secondary) a.inv.secondary = null;
    w.zoom = 0;
    w.reloadLeft = 0;
    this.placeDroppedWeapon(a, w, onDeath);
  }

  /* ───────────────────────── frame ───────────────────────── */

  /** The player can raise the gun to aim: a gun in hand, alive, no menu open, and whatever the game adds. */
  private canAim(w: WeaponState | null, menuOpen: boolean) {
    if (!w || WEAPONS[w.id].slot > 2 || !this.player.alive || menuOpen || this.ctx.phase === 'menu') return false;
    return this.canAimWith(w);
  }

  /**
   * Lean towards Q / E. A wall beside the head stops the lean before the eye (and so the camera and the shots) would go into it.
   */
  private updateLean(a: Agent, dt: number) {
    const can = a.alive && a.prone < 0.5 && !a.sprinting;
    let want = can ? this.input.leanWant : 0;
    if (want !== 0 && a.leanReach > 0) {
      const reach = a.leanReach * a.scale;
      const side = Math.sign(want);
      const dirX = Math.cos(a.yaw) * side;
      const dirZ = -Math.sin(a.yaw) * side;
      const y = a.pos.y + a.eyeHeight;
      let free = reach + LEAN_WALL_GAP;
      for (const solid of this.ctx.solids) {
        const hit = rayBox(a.pos.x, y, a.pos.z, dirX, 0, dirZ, solid, free);
        if (hit) free = Math.min(free, hit[0]);
      }
      want = side * THREE.MathUtils.clamp((free - LEAN_WALL_GAP) / reach, 0, 1);
    }
    const step = this.rig.leanSpeed * dt;
    a.lean += THREE.MathUtils.clamp(want - a.lean, -step, step);
  }

  private aiWorld(): AiWorld {
    const ctx = this.ctx;
    return {
      now: ctx.now, liveTime: ctx.now - ctx.liveAt, agents: ctx.agents, nav: this.nav, points: this.arena.points, heard: ctx.heard, skill: SKILLS[this.difficulty],
      canSee: this.combat.canSee, ...this.aiGoals(),
    };
  }

  private movementWorld(): MovementWorld {
    const ctx = this.ctx;
    return {
      solids: ctx.solids, terrain: ctx.terrain, agents: ctx.agents, now: ctx.now, frozen: ctx.phase === 'freeze',
      playerProne: this.stance.value === 'prone', playerAimSlows: slowsMovement(this.playerAim.mode),
      onLand: (a) => this.sfx.land(a.isPlayer ? undefined : a.pos),
      onFootstep: (a) => (a.isPlayer ? this.sfx.footstep(undefined, 0.3) : this.sfx.footstep(a.pos)),
    };
  }

  private step(dt: number) {
    const ctx = this.ctx;
    ctx.now += dt;
    if (this.stepRules(dt)) this.endMatch();
    if (ctx.phase === 'matchEnd') return;

    this.input.applyTo(this.player, {
      dt, now: ctx.now, rightButtonAimsGuns: ctx.rules.rightButtonAimsGuns, thirdPerson: this.thirdPerson, aimStyle: this.gameplay.aimStyle, menuOpen: ctx.menuOpen, aim: this.playerAim,
      stance: this.stance,
      canAim: (w, menuOpen) => this.canAim(w, menuOpen),
    });
    const world = this.aiWorld();
    // bots the game carries (on their way down from a plane) do not think until they land
    if (this.shouldBotsThink()) for (const a of ctx.agents) if (!a.isPlayer && !a.gear?.isCarried) this.thinkBot(a, world, dt);
    this.afterBotsThink();
    const movement = this.movementWorld();
    for (const a of ctx.agents) {
      if (!a.alive || a.gear?.isCarried) continue;
      moveAgent(a, dt, movement);
      if (a.isPlayer) this.updateLean(a, dt);
      this.combat.updateWeapon(a, dt);
      a.body?.setWeapon(activeWeapon(a.inv)?.id ?? null);
    }
    if (this.player.swimming && !this.playerWasSwimming) ctx.say('Đang bơi: không thể bắn hay ngắm', 2.5);
    this.playerWasSwimming = this.player.swimming;
    // Death disables controls and combat, but airborne bodies still fall and
    // settle onto the terrain or the top of nearby props.
    for (const a of ctx.agents) {
      if (a.alive || a.onGround) continue;
      a.vel.y -= MOVE.gravity * dt;
      const nextY = a.pos.y + a.vel.y * dt;
      const ground = floorAt(movement, a.pos.x, a.pos.z, a.pos.y);
      if (nextY <= ground) {
        a.pos.y = ground;
        a.vel.y = 0;
        a.onGround = true;
      } else {
        a.pos.y = nextY;
      }
    }
    this.grenades.update(dt);
    ctx.heard = ctx.heard.filter((h) => ctx.now - h.t < 2);
    ctx.hurtDirs = ctx.hurtDirs.filter((h) => h.until > ctx.now);
    this.spotEnemies(dt);
    this.stepWorld(dt);
  }

  /** Enemies the player can see appear on the team radar. */
  private spotEnemies(dt: number) {
    this.spotTime += dt;
    if (this.spotTime <= 0.1 || !this.player.alive) return;
    this.spotTime = 0;
    const eye = this.player.eye();
    const fwd = this.player.forward();
    for (const e of this.ctx.agents) {
      if (!e.alive || allied(e, this.player)) continue;
      const chest = e.chest();
      const to = chest.clone().sub(eye);
      if (to.length() < 120 && fwd.dot(to.normalize()) > 0.55 && this.combat.canSee(eye, chest)) e.spot(this.ctx.now);
    }
  }

  private loop = (time: number) => {
    if (this.disposed) return;
    this.frame = requestAnimationFrame(this.loop);
    if (!this.frameLimiter.shouldDraw(time)) return;
    // `last` is set from performance.now() in start(), which can be later than the frame timestamp rAF passes in
    const dt = Math.max(0, Math.min(0.05, (time - this.last) / 1000));
    this.last = time;
    const running = this.active();
    if (running) this.step(dt);
    this.ctx.effects.update(running ? dt : 0);
    this.frames.render(running ? dt : 0);
    if (running) this.frames.adaptResolution(dt);
    this.hudTime += dt;
    if (this.hudTime > 0.1) {
      this.hudTime = 0;
      this.emit();
    }
  };

  protected emit() {
    this.onState(
      buildSnapshot(this.ctx, {
        paused: this.paused, loaded: this.model.ready, thirdPerson: this.thirdPerson, aimView: this.playerAim.view, view: this.gameView(),
      }),
    );
  }

  public dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    this.input.dispose();
    this.resizeObserver.disconnect();
    if (document.pointerLockElement === this.renderer.domElement) document.exitPointerLock();
    this.rig.dispose();
    this.model.dispose();
    this.vm.dispose();
    this.ctx.effects.dispose();
    const textures = new Set<THREE.Texture>();
    this.arena.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      // loaded weapon models are shared with the next game: keep their textures
      if (m.material && !m.userData.sharedAsset)
        (Array.isArray(m.material) ? m.material : [m.material]).forEach((mat) => {
          for (const v of Object.values(mat)) if (v instanceof THREE.Texture) textures.add(v);
        });
    });
    textures.forEach((t) => t.dispose());
    disposeTree(this.arena.scene);
    this.arena.sun.shadow.dispose();
    this.arena.dispose();
    this.sfx.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}

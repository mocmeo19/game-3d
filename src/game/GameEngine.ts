import { configureRenderer, getRenderSettings, rendererPixelRatio } from '../settings/renderSettings';
import * as THREE from 'three';
import { CharacterState } from '../types/character';
import { CharacterModel } from '../renderer/CharacterModel';
import { Agent, allied, angleDiff, anglesTo, dirFromAngles, HEAD, HITBOXES, PRONE_HEAD, PRONE_HITBOXES } from './agent';
import { AiWorld, Difficulty, newBrain, SKILLS, think } from './ai';
import { Effects } from './effects';
import { BotBody, CROUCH_DROP, disposeTree, gunMesh, ViewModel } from './models';
import { PlayerAvatarRig } from './combat/PlayerAvatarRig';
import { FirstPersonArms } from './combat/FirstPersonArms';
import { PlayerStanceKeys } from './playerStanceKeys';
import { ArenaMaps } from './maps/arenaMaps';
import { actionForKey, layoutForMode, type ControlAction } from './controlLayouts';
import { PlayerAim } from './aim/playerAim';
import { aimSpreadFactor, isAiming, slowsMovement, transitionSeconds, type AimMode, type GunGrip } from './aim/aimModes';
import type { BodyHit } from './aim/aimTrajectory';
import { NavGrid } from './nav';
import {
  activeWeapon, addMoney, aimPunch, beginReload, blocked, buy, BUY_RADIUS, BuyItem, buyBlock, canFire, computeDamage, consumeShot, dropActive, ECON,
  equip, flashDuration, groundHeight, heDamage, HitGroup, inaccuracy, itemPrice, lossBonus, maxSpeed, MOVE, newInventory, penetrate, rayBox, ROUND,
  selectSlot, SlotNo, spendGrenade, Team, tickWeapon, WeaponId, WEAPONS, WeaponState, WORLD_LIMIT, newWeapon, fallbackSlot
} from './rules';
import { Sfx } from './sfx';
import {
  AMMO_OF, AmmoType, BOOST_DRAIN, boostEffect, BRInventory, brDamage, bestBoost, bestHeal, capacity, Circle, GEAR, healAmount, isUpgrade, Loot, lootName, MedId, MEDS,
  newBRInventory, planZones, rollLoot, roomFor, weight, zoneAt, ZoneNow
} from './royale';
import { crateMesh, lootMesh, sparkle, ZoneView } from './royaleScene';
import { Arena, buildArena } from './world';

export type Phase = 'menu' | 'freeze' | 'live' | 'roundEnd' | 'matchEnd';
/** Ground loot farther than this from the camera is not drawn (battle royale). */
const LOOT_DRAW_DISTANCE = 55;

/** cs = 5v5 rounds with an economy; br = battle royale, everyone for themselves. */
export type Mode = 'cs' | 'br';

export interface KillEvent {
  id: number;
  killer: string;
  killerTeam: Team;
  victim: string;
  victimTeam: Team;
  weapon: WeaponId | 'zone';
  headshot: boolean;
  wallbang: boolean;
  mine: boolean;
}
export interface ScoreRow {
  id: number;
  name: string;
  team: Team;
  kills: number;
  deaths: number;
  assists: number;
  hs: number;
  mvps: number;
  money: number;
  alive: boolean;
  me: boolean;
}
export interface ShopItem {
  item: BuyItem;
  name: string;
  price: number;
  block: string;
}
export interface GameSnapshot {
  phase: Phase;
  paused: boolean;
  loaded: boolean;
  round: number;
  score: Record<Team, number>;
  timer: number;
  buyLeft: number;
  canBuy: boolean;
  buyOpen: boolean;
  shop: ShopItem[];
  health: number;
  armor: number;
  helmet: boolean;
  money: number;
  alive: boolean;
  team: Team;
  weapon: { id: WeaponId; name: string; ammo: number; reserve: number; reloading: boolean; mag: number } | null;
  slots: { slot: SlotNo; id: WeaponId; name: string; active: boolean }[];
  killfeed: KillEvent[];
  killConfirm: { id: number; headshot: boolean } | null;
  rows: ScoreRow[];
  message: string;
  banner: { winner: Team; reason: string; mvp: string; mine: boolean } | null;
  matchWinner: Team | null;
  radar: { me: { x: number; z: number; yaw: number }; allies: { x: number; z: number; alive: boolean }[]; enemies: { x: number; z: number }[] };
  /** Directions (deg, 0 = ahead, positive = right) damage came from recently. */
  hurt: number[];
  pickup: string;
  spectating: string;
  killedBy: string;
  scoreboard: boolean;
  scope: number;
  thirdPerson: boolean;
  aiming: boolean;
  /** Looking down the sights (no crosshair). */
  ads: boolean;
  alive5: Record<Team, boolean[]>;
  mode: Mode;
  br: RoyaleSnapshot | null;
}

export interface RoyaleSnapshot {
  alive: number;
  total: number;
  kills: number;
  /** Final rank once the match is over for the player (1 = winner). */
  placement: number;
  zone: { cur: Circle; next: Circle | null; phase: number; shrinking: boolean; timeLeft: number; dps: number; outside: boolean; distance: number };
  vest: { level: number; durability: number; max: number } | null;
  helmet: { level: number; durability: number; max: number } | null;
  backpack: number;
  boost: number;
  healing: { name: string; progress: number } | null;
  meds: Record<MedId, number>;
  ammo: Record<AmmoType, number>;
  grenades: WeaponId[];
  weight: number;
  capacity: number;
  invOpen: boolean;
  mapOpen: boolean;
  /** Items within reach (shown in the inventory screen), nearest first. */
  near: { id: number; name: string; upgrade: boolean; crate: boolean }[];
  /** What F picks up right now. */
  hint: string;
  me: { x: number; z: number; yaw: number };
  buildings: { minX: number; maxX: number; minZ: number; maxZ: number }[];
}

/** An item lying on the ground (or inside a death crate) in battle royale. */
interface GroundItem {
  id: number;
  loot: Loot;
  /** The actual gun (keeps its loaded magazine). */
  weapon?: WeaponState;
  pos: THREE.Vector3;
  mesh: THREE.Object3D;
  glint: THREE.Sprite | null;
  /** Death crate it lies in (0 = on the ground). */
  crate: number;
}

const BR_BOTS = ['Hải', 'Long', 'Minh', 'Tuấn', 'Khang', 'Phúc', 'Quân', 'Bảo', 'Duy', 'Nam', 'Sơn', 'Vy', 'Linh', 'Trang', 'Đạt'];
/** Better primaries rank higher when bots decide whether to swap. */
const GUN_TIER: Partial<Record<WeaponId, number>> = { glock: 1, usp: 1, deagle: 2, mp9: 2, ak47: 3, m4a4: 3, awp: 3 };

interface Pickup {
  w: WeaponState;
  mesh: THREE.Group;
  pos: THREE.Vector3;
}
interface Nade {
  id: WeaponId;
  owner: Agent;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  mesh: THREE.Group;
  age: number;
  still: number;
}

const BOT_NAMES: Record<Team, string[]> = { CT: ['Hải', 'Long', 'Minh', 'Tuấn'], T: ['Khang', 'Phúc', 'Quân', 'Bảo', 'Duy'] };
const SHOP: BuyItem[] = ['glock', 'usp', 'deagle', 'mp9', 'ak47', 'm4a4', 'awp', 'kevlar', 'helmet', 'he', 'flash', 'smoke'];
/** Vertical field of view, CS:GO's 90° horizontal at 4:3. */
const VFOV = 74;
/** Time to lie down or get up (s). */
const PRONE_SECONDS = 0.7;
/** How much lower the collision box is lying down than standing (m). */
const PRONE_HEIGHT_DROP = 1.2;
/** Room kept between a leaning head and a wall (m). */
const LEAN_WALL_GAP = 0.18;
/** Camera distance on the start menu, where the character is shown off (the in-game camera comes from the settings). */
const TPP_MENU_DISTANCE = 3.6;
/** Radians of turn per pixel of mouse movement at sensitivity 1. */
const LOOK = 0.0018;
/** Field of view down iron sights or a red dot (no magnification). */
const IRON_SIGHT_FOV = 61;
const gripOf = (w: WeaponState | null): GunGrip => (!w ? 'rifle' : WEAPONS[w.id].scope ? 'sniper' : WEAPONS[w.id].slot === 2 ? 'pistol' : w.id === 'mp9' ? 'smg' : 'rifle');
const enemyOf = (t: Team): Team => (t === 'CT' ? 'T' : 'CT');

export class GameEngine {
  readonly arena: Arena;
  readonly renderer: THREE.WebGLRenderer;
  readonly camera = new THREE.PerspectiveCamera(VFOV, 1, 0.05, 1000);
  private readonly effects: Effects;
  private readonly sfx = new Sfx();
  private nav: NavGrid;
  private readonly vm: ViewModel;
  private readonly agents: Agent[] = [];
  private readonly player: Agent;
  private readonly model: CharacterModel;
  private readonly rig: PlayerAvatarRig;
  /** The player's character holding the gun in the first-person view (box arms until it has loaded). */
  private readonly fpArms: FirstPersonArms;
  /** The town (battle royale) and the cargo ship (5 vs 5) sharing the arena. */
  private readonly maps: ArenaMaps;
  /** Stance the player chose (C crouch, Z prone); the body eases into it through `crouch` / `prone`. */
  private readonly stance = new PlayerStanceKeys();
  private pickups: Pickup[] = [];
  private nades: Nade[] = [];
  private phase: Phase = 'menu';
  private paused = false;
  private touchMode = false;
  private timer = 0;
  private now = 0;
  private liveAt = 0;
  private roundAt = 0;
  private round = 0;
  private score: Record<Team, number> = { CT: 0, T: 0 };
  private lossStreak: Record<Team, number> = { CT: 0, T: 0 };
  private banner: GameSnapshot['banner'] = null;
  private matchWinner: Team | null = null;
  private killfeed: (KillEvent & { t: number })[] = [];
  private heard: AiWorld['heard'] = [];
  private hurtDirs: { from: THREE.Vector3; until: number }[] = [];
  private message = '';
  private messageUntil = 0;
  private killedBy = '';
  private spec = 0;
  private difficulty: Difficulty = 'normal';
  // input
  private keys = new Set<ControlAction>();
  private ctrlSpaceActive = false;
  private mouse = [false, false];
  private touchFire = false;
  private touchAlt = false;
  private reloadPressed = false;
  /** -1 / 0 / 1: Q or E held. */
  private leanWant = 0;
  private sensitivity: number;
  /** Third person by default so the player sees the character they made (V switches). */
  private thirdPerson = true;
  /** The player's aiming: mode, camera, free look, scope sway and the aim point (see aim/). */
  private readonly playerAim = new PlayerAim();
  /** Distance to the first living bot along a ray: the crosshair stops on it. */
  private readonly hitBody: BodyHit = (origin, direction, far) =>
    this.agents.reduce<number | null>((near, b) => (b.isPlayer || !b.alive ? near : this.hitAgent(b, origin, direction, near ?? far)?.t ?? near), null);
  private gunObstruction = 0;
  private buyOpen = false;
  private unlocking = false;
  private dragging = false;
  private touchPoint = { x: 0, y: 0 };
  // view model state
  private bob = 0;
  private sway = { x: 0, y: 0 };
  private kick = 0;
  private inspectAt = -99;
  private swingAt = -99;
  private swingHeavy = false;
  private shotCount = 0;
  // battle royale
  private mode: Mode = 'cs';
  private items: GroundItem[] = [];
  private crates = new Map<number, THREE.Object3D>();
  private itemSeq = 0;
  private zones: Circle[] = [];
  private zoneNow: ZoneNow | null = null;
  private zoneView: ZoneView | null = null;
  private brStart = 0;
  private brPhaseSeen = '';
  private brPlacement = 0;
  private brEndAt = 0;
  private invOpen = false;
  private mapOpen = false;
  private brTotal = 16;
  // loop
  private frame = 0;
  private last = performance.now();
  private hudTime = 0;
  private spotTime = 0;
  private disposed = false;
  private readonly removers: (() => void)[] = [];
  private readonly resizeObserver: ResizeObserver;
  private readonly root: HTMLElement;

  constructor(private readonly host: HTMLDivElement, state: CharacterState, private readonly onState: (s: GameSnapshot) => void, sensitivity = 1) {
    this.sensitivity = sensitivity;
    this.root = host.parentElement ?? host;
    this.renderer = new THREE.WebGLRenderer({ antialias: getRenderSettings().antialias, powerPreference: 'high-performance' });
    configureRenderer(this.renderer, 1.5);
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.8;
    this.renderer.autoClear = false;
    host.appendChild(this.renderer.domElement);
    this.arena = buildArena(this.renderer);
    this.effects = new Effects(this.arena.scene);
    this.maps = new ArenaMaps(this.arena);
    this.nav = this.maps.use('cs', this.camera);

    this.player = new Agent(0, state.name?.trim() || 'Bạn', 'CT', true);
    this.agents.push(this.player);
    this.model = new CharacterModel({ ...state, pose: 'idle' });
    this.arena.scene.add(this.model.group);
    // the class weapon (a sword, a bow…) has no place in a gunfight: the hands hold the gun drawn by the rig
    this.model.setWeaponsVisible(false);
    this.rig = new PlayerAvatarRig(this.model);
    this.fpArms = new FirstPersonArms(this.model);
    this.player.leanReach = this.rig.leanReach;
    let id = 1;
    (['CT', 'T'] as Team[]).forEach((team) =>
      BOT_NAMES[team].forEach((name) => {
        const bot = new Agent(id++, name, team, false);
        bot.body = new BotBody(team);
        bot.brain = newBrain();
        this.arena.scene.add(bot.body.group);
        this.agents.push(bot);
      })
    );
    this.vm = new ViewModel(this.player.team);
    this.placeAtSpawns();
    this.bindInput();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(host);
    this.resize();
    this.loop(this.last);
  }

  /* ───────────────────────── public controls ───────────────────────── */

  public start(difficulty: Difficulty, touch = false, mode: Mode = 'cs') {
    if (!this.model.ready) return;
    this.touchMode = touch;
    this.difficulty = difficulty;
    // eye height, hit boxes and camera follow the size of the character the player made (race + height slider)
    this.player.scale = this.model.getAnchors().height / 1.72;
    if (this.phase === 'menu' || this.phase === 'matchEnd') {
      if (mode === 'br') this.startRoyale();
      else this.startMatch();
    }
    this.paused = false;
    this.last = performance.now();
    if (!touch) this.lock();
    this.sfx.resume();
    this.emit();
  }
  public resume() {
    if (!this.paused || this.phase === 'menu' || this.phase === 'matchEnd') return;
    this.paused = false;
    this.last = performance.now();
    if (!this.touchMode) this.lock();
    this.sfx.resume();
    this.emit();
  }
  public restart() {
    if (!this.paused || this.phase === 'menu') return;
    this.keys.clear();
    this.mouse = [false, false];
    this.touchFire = this.touchAlt = false;
    this.buyOpen = this.invOpen = this.mapOpen = false;
    this.paused = false;
    if (this.mode === 'br') this.startRoyale();
    else this.startMatch();
    this.last = performance.now();
    if (!this.touchMode) this.lock();
    this.sfx.resume();
    this.emit();
  }
  public pause() {
    if (this.phase === 'menu' || this.phase === 'matchEnd' || this.paused) return;
    this.paused = true;
    this.keys.clear();
    this.mouse = [false, false];
    this.touchFire = this.touchAlt = false;
    this.buyOpen = false;
    if (document.pointerLockElement === this.renderer.domElement) document.exitPointerLock();
    this.emit();
  }
  public setSensitivity(v: number) {
    this.sensitivity = v;
  }
  public control(action: ControlAction, down: boolean) {
    if (down) this.keyDown(action, false);
    else this.keyUp(action);
  }
  private keyUp(action: ControlAction) {
    this.keys.delete(action);
    this.stance.key(action, false);
  }
  public trigger(down: boolean) {
    this.touchFire = down;
  }
  public secondary(down: boolean) {
    this.touchAlt = down;
  }
  public look(dx: number, dy: number) {
    if (!this.player.alive || this.buyOpen || this.invOpen || this.mapOpen) return;
    // slower in step with the zoom: over the shoulder, down the sights, through a scope
    const k = LOOK * this.sensitivity * Math.min(1, this.camera.fov / VFOV);
    if (this.playerAim.look(-dx * k, -dy * k)) return;
    this.player.yaw -= dx * k;
    this.player.pitch = THREE.MathUtils.clamp(this.player.pitch - dy * k, -1.5, 1.5);
    this.sway.x = THREE.MathUtils.clamp(this.sway.x + dx * 0.0006, -0.12, 0.12);
    this.sway.y = THREE.MathUtils.clamp(this.sway.y + dy * 0.0006, -0.12, 0.12);
  }
  public toggleBuy(open = !this.buyOpen) {
    if (open && !this.canBuy(this.player)) {
      this.say(this.player.alive ? 'Hết thời gian mua hoặc bạn đang ở ngoài vùng mua.' : 'Chờ round sau để mua.');
      return;
    }
    this.buyOpen = open;
    if (open && document.pointerLockElement === this.renderer.domElement) {
      this.unlocking = true;
      document.exitPointerLock();
    } else if (!open && !this.paused && this.active()) this.lock();
    this.emit();
  }
  public purchase(item: BuyItem) {
    const p = this.player;
    if (!this.canBuy(p)) return;
    const res = buy(item, p.inv, p.money, p.team);
    if (!res) {
      this.sfx.cue('deny');
      return;
    }
    p.money = res.money;
    if (res.dropped) this.dropWeapon(p, res.dropped);
    this.sfx.cue('buy');
    this.emit();
  }
  public interact() {
    const p = this.player;
    const near = this.nearestPickup(p, 2.2);
    if (!p.alive || !near) return;
    this.removePickup(near);
    const old = equip(p.inv, near.w);
    if (old) this.dropWeapon(p, old);
    this.sfx.click(900, 0.2);
  }
  public reload() {
    this.reloadPressed = true;
  }
  public slot(n: SlotNo) {
    if (this.player.alive && selectSlot(this.player.inv, n)) this.onSwitch();
  }

  /* ───────────────────────── input ───────────────────────── */

  private listen(target: EventTarget, event: string, handler: EventListener, options?: AddEventListenerOptions) {
    target.addEventListener(event, handler, options);
    this.removers.push(() => target.removeEventListener(event, handler, options));
  }

  private lock() {
    try {
      const r = this.renderer.domElement.requestPointerLock?.() as unknown as Promise<void> | undefined;
      r?.catch?.(() => this.say('Nhấn vào màn hình để khoá chuột.'));
    } catch {
      this.say('Nhấn vào màn hình để khoá chuột.');
    }
  }

  private active() {
    return !this.paused && this.phase !== 'menu' && this.phase !== 'matchEnd';
  }

  private keyDown(action: ControlAction, repeat: boolean) {
    this.keys.add(action);
    if (repeat) return;
    const p = this.player;
    if (p.alive) this.stance.key(action, true);
    switch (action) {
      case 'reload':
        this.reloadPressed = true;
        break;
      case 'drop': {
        const w = p.alive ? dropActive(p.inv) : null;
        if (w) {
          this.dropWeapon(p, w);
          this.onSwitch();
        }
        break;
      }
      case 'interact':
        if (this.mode === 'br') this.pickupNearest();
        else if (p.alive && this.nearestPickup(p, 2.2)) this.interact();
        break;
      case 'inspect':
        if ((activeWeapon(p.inv)?.reloadLeft ?? 1) <= 0) this.inspectAt = this.now;
        break;
      case 'inventory':
        if (this.mode === 'br') this.brToggle('inv');
        break;
      case 'map':
        if (this.mode === 'br') this.brToggle('map');
        break;
      case 'heal': {
        const med = p.br && bestHeal(p.br, p.health);
        if (med) this.brUse(med);
        else if (p.br) this.say('Không có đồ hồi máu phù hợp.', 2);
        break;
      }
      case 'boost': {
        const med = p.br && bestBoost(p.br, p.boost);
        if (med) this.brUse(med);
        else if (p.br) this.say('Không có đồ tăng lực.', 2);
        break;
      }
      case 'lastWeapon':
        if (p.alive && selectSlot(p.inv, p.inv.last)) this.onSwitch();
        break;
      case 'slot1':
      case 'slot2':
      case 'slot3':
      case 'slot4':
        this.slot(Number(action.slice(4)) as SlotNo);
        break;
      case 'buy':
        if (this.mode === 'cs') this.toggleBuy();
        break;
      case 'camera':
        this.thirdPerson = !this.thirdPerson;
        break;
      case 'jump':
        if (!p.alive) this.spec++;
        else if (this.stance.value !== 'stand') {
          // from a crouch or lying down, jump stands the body up first
          this.stance.stand();
          p.jumpLatch = true;
        }
        break;
    }
  }

  private bindInput() {
    const canvas = this.renderer.domElement;
    this.listen(window, 'keydown', ((e: KeyboardEvent) => {
      if (e.code === 'Space' && e.ctrlKey) {
        e.preventDefault();
        e.stopPropagation();
        this.ctrlSpaceActive = true;
        if (this.active()) this.keys.add('jump');
        return;
      }
      if ((e.target as HTMLElement)?.closest('input,textarea,[contenteditable]')) return;
      if (e.code === 'Escape') {
        if (this.buyOpen) this.toggleBuy(false);
        else if (this.invOpen) this.brToggle('inv', false);
        else if (this.mapOpen) this.brToggle('map', false);
        else if (this.paused) this.resume();
        else this.pause();
        return;
      }
      const action = actionForKey(layoutForMode(this.mode), e.code);
      if (!this.active() || !action) return;
      e.preventDefault();
      this.keyDown(action, e.repeat);
      if (action === 'scoreboard') this.emit();
    }) as EventListener, { capture: true });
    this.listen(window, 'keyup', ((e: KeyboardEvent) => {
      if (e.code === 'Space' && this.ctrlSpaceActive) {
        e.preventDefault();
        e.stopPropagation();
        this.ctrlSpaceActive = false;
      }
      const action = actionForKey(layoutForMode(this.mode), e.code);
      if (action) this.keyUp(action);
      if (action === 'scoreboard') this.emit();
    }) as EventListener, { capture: true });
    this.listen(canvas, 'pointerdown', ((e: PointerEvent) => {
      if (!this.active()) return;
      if (e.pointerType === 'touch') {
        this.touchPoint = { x: e.clientX, y: e.clientY };
        this.dragging = true;
        canvas.setPointerCapture(e.pointerId);
        return;
      }
      if (this.buyOpen || this.invOpen || this.mapOpen) return;
      if (document.pointerLockElement !== canvas) this.lock();
      if (e.button === 0) this.mouse[0] = true;
      if (e.button === 2) this.mouse[1] = true;
      if (!this.player.alive && e.button === 0) this.spec++;
    }) as EventListener);
    this.listen(window, 'pointerup', ((e: PointerEvent) => {
      if (e.pointerType === 'touch') this.dragging = false;
      else if (e.button === 0) this.mouse[0] = false;
      else if (e.button === 2) this.mouse[1] = false;
      if (e.pointerType !== 'touch' && e.buttons === 0) this.mouse[0] = this.mouse[1] = false;
    }) as EventListener);
    // browsers also report the chorded press as a plain mouse event
    const chord = ((e: MouseEvent) => {
      if (!this.active() || !(this.mouse[0] || this.mouse[1])) return;
      this.mouse[0] = (e.buttons & 1) !== 0;
      this.mouse[1] = (e.buttons & 2) !== 0;
    }) as EventListener;
    this.listen(window, 'mousedown', chord);
    this.listen(window, 'mouseup', chord);
    this.listen(window, 'pointermove', ((e: PointerEvent) => {
      if (!this.active()) return;
      // pressing a second mouse button while one is held (right = aim, then left = fire) sends no pointerdown, only a move with the
      // new `buttons`: follow it, but only for a press that began on the canvas
      if (e.pointerType !== 'touch' && (this.mouse[0] || this.mouse[1])) {
        this.mouse[0] = (e.buttons & 1) !== 0;
        this.mouse[1] = (e.buttons & 2) !== 0;
      }
      if (e.pointerType === 'touch') {
        if (!this.dragging) return;
        this.look((e.clientX - this.touchPoint.x) * 1.6, (e.clientY - this.touchPoint.y) * 1.6);
        this.touchPoint = { x: e.clientX, y: e.clientY };
      } else if (document.pointerLockElement === canvas) this.look(e.movementX, e.movementY);
    }) as EventListener);
    this.listen(canvas, 'wheel', ((e: WheelEvent) => {
      if (!this.active() || !this.player.alive) return;
      const order: SlotNo[] = [1, 2, 3, 4];
      const inv = this.player.inv;
      let i = order.indexOf(inv.active);
      for (let n = 0; n < 4; n++) {
        i = (i + (e.deltaY > 0 ? 1 : 3)) % 4;
        if (order[i] === inv.active) break;
        if (selectSlot(inv, order[i])) {
          this.onSwitch();
          break;
        }
      }
    }) as EventListener, { passive: true });
    this.listen(canvas, 'contextmenu', ((e: Event) => e.preventDefault()) as EventListener);
    this.listen(document, 'pointerlockchange', (() => {
      if (document.pointerLockElement === canvas) return;
      if (this.unlocking) {
        this.unlocking = false;
        return;
      }
      if (!this.buyOpen && !this.invOpen && !this.mapOpen) this.pause();
    }) as EventListener);
    this.listen(window, 'blur', (() => this.pause()) as EventListener);
    this.listen(document, 'visibilitychange', (() => document.hidden && this.pause()) as EventListener);
  }

  private onSwitch() {
    this.inspectAt = -99;
    this.player.pin = '';
    this.sfx.click(700, 0.08);
  }

  private say(message: string, seconds = 3) {
    this.message = message;
    this.messageUntil = this.now + seconds;
    this.emit();
  }

  /**
   * Adaptive resolution: when frames take too long the picture is drawn at a lower pixel ratio (and sharpens again when there is
   * time to spare), so a weak GPU loses sharpness before it loses smoothness.
   */
  private adaptTime = 0;
  private adaptFrames = 0;
  private pixelRatio = rendererPixelRatio(1.5);
  private adaptResolution(dt: number) {
    this.adaptTime += dt;
    this.adaptFrames++;
    if (this.adaptTime < 1.5) return;
    const ms = (this.adaptTime / this.adaptFrames) * 1000;
    this.adaptTime = this.adaptFrames = 0;
    const max = rendererPixelRatio(1.5);
    let next = this.pixelRatio;
    if (ms > 24) next = Math.max(0.6, this.pixelRatio - 0.15);
    else if (ms < 13) next = Math.min(max, this.pixelRatio + 0.1);
    if (Math.abs(next - this.pixelRatio) < 0.01) return;
    this.pixelRatio = next;
    this.renderer.setPixelRatio(next);
    this.resize();
  }

  private resize() {
    const w = this.host.clientWidth;
    const h = this.host.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  /* ───────────────────────── rounds & economy ───────────────────────── */

  private placeAtSpawns() {
    this.stance.stand();
    this.playerAim.reset(this.thirdPerson ? 'tpp' : 'fpp');
    (['CT', 'T'] as Team[]).forEach((team) =>
      this.agents
        .filter((a) => a.team === team)
        .forEach((a, i) => {
          const s = this.arena.spawns[team][i % 5];
          a.pos.set(s.x, 0, s.z);
          a.vel.set(0, 0, 0);
          a.yaw = s.yaw;
          a.pitch = 0;
          a.crouch = 0;
          a.prone = 0;
          a.lean = 0;
          a.sprinting = false;
          a.onGround = true;
          a.body?.setWeapon(activeWeapon(a.inv)?.id ?? null);
        })
    );
  }

  private startMatch() {
    if (this.mode === 'br') {
      this.clearRoyale();
      this.setupAgents('cs');
      for (const a of this.agents) a.br = null;
    }
    this.mode = 'cs';
    this.nav = this.maps.use('cs', this.camera);
    this.round = 0;
    this.score = { CT: 0, T: 0 };
    this.lossStreak = { CT: 0, T: 0 };
    this.matchWinner = null;
    this.killfeed = [];
    for (const a of this.agents) {
      a.money = ECON.start;
      a.kills = a.deaths = a.assists = a.headshots = a.mvps = 0;
      a.alive = false; // everyone starts the match with fresh gear
    }
    this.startRound();
  }

  /** Clears what the last round or match left on the field: effects, dropped guns, live grenades and the HUD alerts. */
  private clearBattlefield() {
    this.effects.reset();
    [...this.pickups].forEach((p) => this.removePickup(p));
    this.nades.forEach((n) => {
      n.mesh.removeFromParent();
      disposeTree(n.mesh);
    });
    this.nades = [];
    this.heard = [];
    this.hurtDirs = [];
    this.banner = null;
    this.killedBy = '';
  }

  private startRound() {
    this.round++;
    this.clearBattlefield();
    for (const a of this.agents) {
      // survivors keep their gear (as in CS), the dead start over with a pistol
      if (!a.alive) a.inv = newInventory(a.team);
      a.alive = true;
      a.health = 100;
      a.blindUntil = 0;
      a.tagUntil = 0;
      a.roundKills = 0;
      a.damageFrom.clear();
      a.pin = '';
      a.fireLatch = false;
      a.resumeZoom = 0;
      const w = activeWeapon(a.inv);
      if (w) {
        w.zoom = 0;
        w.reloadLeft = 0;
      }
      if (a.inv.active === 4) selectSlot(a.inv, a.inv.primary ? 1 : 2);
      if (a.brain) a.brain = newBrain();
    }
    this.placeAtSpawns();
    for (const a of this.agents) if (!a.isPlayer) this.botBuy(a);
    this.phase = 'freeze';
    this.timer = ROUND.freeze;
    this.roundAt = this.now;
    this.liveAt = this.now + ROUND.freeze;
    this.say(this.round === 1 ? 'Round súng lục! Nhấn B để mua đồ.' : `Round ${this.round} · Nhấn B để mua đồ`, ROUND.freeze);
  }

  private canBuy(a: Agent) {
    const c = this.arena.spawnCenter[a.team];
    return (
      this.mode === 'cs' &&
      a.alive &&
      (this.phase === 'freeze' || this.phase === 'live') &&
      this.now - this.roundAt < ROUND.freeze + ROUND.buy &&
      Math.hypot(a.pos.x - c.x, a.pos.z - c.z) < BUY_RADIUS
    );
  }

  /** CS-like bot buy: full buy when rich, MP9 force after losses, armour (or a Deagle) on the pistol round. */
  private botBuy(a: Agent) {
    const rifle: WeaponId = a.team === 'T' ? 'ak47' : 'm4a4';
    const get = (item: BuyItem) => {
      const r = buy(item, a.inv, a.money, a.team);
      if (r) a.money = r.money;
      return !!r;
    };
    if (!a.inv.primary) {
      if (a.money >= WEAPONS.awp.price + ECON.helmet && Math.random() < 0.2) get('awp');
      else if (a.money >= WEAPONS[rifle].price + ECON.helmet) get(rifle);
      else if (this.round > 1 && a.money >= WEAPONS.mp9.price + ECON.kevlar && this.lossStreak[a.team] >= 2) get('mp9');
    }
    if (a.inv.armor < 100 || !a.inv.helmet) {
      if (a.money >= ECON.helmet + 400) get('helmet');
      else if (a.inv.armor < 100 && a.money >= ECON.kevlar) get(this.round === 1 && Math.random() < 0.35 ? 'deagle' : 'kevlar');
    }
    if (a.inv.primary) selectSlot(a.inv, 1);
  }

  private endRound(winner: Team, reason: string) {
    if (this.phase !== 'live') return;
    const loser = enemyOf(winner);
    this.score[winner]++;
    this.lossStreak[winner] = 0;
    this.lossStreak[loser]++;
    for (const a of this.agents) a.money = addMoney(a.money, a.team === winner ? ECON.win : lossBonus(this.lossStreak[loser]));
    const mvp = this.agents.filter((a) => a.team === winner).sort((x, y) => y.roundKills - x.roundKills)[0];
    const hasMvp = !!mvp && mvp.roundKills > 0;
    if (hasMvp) mvp.mvps++;
    const mine = winner === this.player.team;
    this.banner = { winner, reason, mvp: hasMvp ? `${mvp.name} · ${mvp.roundKills} hạ gục` : '', mine };
    this.sfx.cue(mine ? 'win' : 'lose');
    this.phase = 'roundEnd';
    this.timer = ROUND.end;
    this.buyOpen = false;
    if (this.score[winner] >= ROUND.winRounds) this.matchWinner = winner;
    this.emit();
  }

  private checkElimination() {
    if (this.phase !== 'live') return;
    const alive = (t: Team) => this.agents.some((a) => a.team === t && a.alive);
    if (!alive('T')) this.endRound('CT', 'Đã hạ toàn bộ phe T');
    else if (!alive('CT')) this.endRound('T', 'Đã hạ toàn bộ phe CT');
  }

  /* ───────────────────────── combat ───────────────────────── */

  /** Clear sight line between two points (solids, and smoke unless disabled). */
  private canSee = (a: THREE.Vector3, b: THREE.Vector3, smoke = true) => {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dz = b.z - a.z;
    const len = Math.hypot(dx, dy, dz);
    if (len < 1e-3) return true;
    for (const s of this.arena.solids) {
      const hit = rayBox(a.x, a.y, a.z, dx / len, dy / len, dz / len, s, len);
      if (hit && hit[0] < len - 0.05 && hit[1] > 0.05) return false;
    }
    return !smoke || !this.effects.smokeBlocks(a, b);
  };

  /** Ray against an agent's hit boxes, tested in its body frame. */
  private hitAgent(a: Agent, o: THREE.Vector3, d: THREE.Vector3, far: number): { t: number; group: HitGroup } | null {
    const rot = -(a.yaw + Math.PI);
    const c = Math.cos(rot);
    const s = Math.sin(rot);
    // body space divided by the agent's size: the hit boxes are for a 1.72 m body, and t stays a world distance
    const k = 1 / a.scale;
    const lx = o.x - a.pos.x;
    const lz = o.z - a.pos.z;
    const ox = (lx * c + lz * s) * k;
    const oz = (-lx * s + lz * c) * k;
    const oy = (o.y - a.pos.y) * k;
    const dx = (d.x * c + d.z * s) * k;
    const dz = (-d.x * s + d.z * c) * k;
    const dy = d.y * k;
    const prone = a.prone > 0.5;
    const drop = a.crouch * CROUCH_DROP;
    let best: { t: number; group: HitGroup } | null = null;
    // head sphere; in this frame the body faces +z and its right is -x, so a lean to the right moves the head towards -x
    const hx = ox + a.lean * a.leanReach;
    const py = oy - (prone ? PRONE_HEAD.y : HEAD.y - drop);
    const hz = oz - (prone ? PRONE_HEAD.z : 0);
    // |d| is 1/scale here: solve the full quadratic
    const qa = dx * dx + dy * dy + dz * dz;
    const b = hx * dx + py * dy + hz * dz;
    const disc = b * b - qa * (hx * hx + py * py + hz * hz - HEAD.r * HEAD.r);
    if (disc >= 0) {
      const t = (-b - Math.sqrt(disc)) / qa;
      if (t > 0 && t < far) best = { t, group: 'head' };
    }
    const boxes = prone
      ? PRONE_HITBOXES.map((hb) => ({ group: hb.group, min: { x: hb.min[0], y: hb.min[1], z: hb.min[2] }, max: { x: hb.max[0], y: hb.max[1], z: hb.max[2] } }))
      : HITBOXES.map((hb) => ({ group: hb.group, min: { x: hb.min[0], y: hb.drops ? hb.min[1] - drop : hb.min[1], z: hb.min[2] }, max: { x: hb.max[0], y: hb.max[1] - drop, z: hb.max[2] } }));
    for (const box of boxes) {
      const r = rayBox(ox, oy, oz, dx, dy, dz, box, far);
      if (r && (!best || r[0] < best.t)) best = { t: r[0], group: box.group };
    }
    return best;
  }

  /** One bullet with wall penetration. Returns where it stopped. */
  private traceBullet(shooter: Agent, id: WeaponId, origin: THREE.Vector3, dir: THREE.Vector3): THREE.Vector3 {
    const far = WEAPONS[id].range;
    type Hit = { t: number; exit?: number; agent?: Agent; group?: HitGroup; ground?: boolean };
    const hits: Hit[] = [];
    for (const s of this.arena.solids) {
      const r = rayBox(origin.x, origin.y, origin.z, dir.x, dir.y, dir.z, s, far);
      if (r && r[1] > 0.001) hits.push({ t: r[0], exit: r[1] });
    }
    if (dir.y < -1e-4) {
      const t = -origin.y / dir.y;
      if (t > 0 && t < far) hits.push({ t, ground: true });
    }
    for (const a of this.agents) {
      if (!a.alive || a === shooter || allied(a, shooter)) continue;
      const h = this.hitAgent(a, origin, dir, far);
      if (h) hits.push({ t: h.t, agent: a, group: h.group });
    }
    hits.sort((x, y) => x.t - y.t);
    let damage = WEAPONS[id].damage;
    let walls = 0;
    const point = (t: number) => origin.clone().addScaledVector(dir, t);
    for (const h of hits) {
      const p = point(h.t);
      if (h.agent) {
        this.damage(h.agent, shooter, id, damage, h.group!, h.t, walls > 0, p, dir);
        return p;
      }
      if (h.ground) {
        const up = new THREE.Vector3(0, 1, 0);
        this.effects.impact(p, up, true);
        this.effects.bulletHole(p, up);
        return p;
      }
      // face normal: the axis the ray came in along
      const n = dir.clone().negate();
      const normal = Math.abs(n.y) > 0.9 ? new THREE.Vector3(0, Math.sign(n.y), 0) : Math.abs(n.x) > Math.abs(n.z) ? new THREE.Vector3(Math.sign(n.x), 0, 0) : new THREE.Vector3(0, 0, Math.sign(n.z));
      this.effects.impact(p, normal);
      this.effects.bulletHole(p, normal);
      damage = penetrate(id, damage, h.exit! - h.t);
      walls++;
      if (damage < 1 || walls > 2) return p;
      this.effects.bulletHole(point(h.exit!), normal.clone().negate());
    }
    return point(far);
  }

  private damage(victim: Agent, attacker: Agent, id: WeaponId, base: number, group: HitGroup, distance: number, wallbang: boolean, at: THREE.Vector3, dir: THREE.Vector3) {
    if (!victim.alive) return;
    let helmet: boolean;
    let res: { health: number };
    if (victim.br) {
      helmet = !!victim.br.helmet && group === 'head';
      res = brDamage(base * Math.pow(WEAPONS[id].falloff, distance / 12.7), group, victim.br);
    } else {
      helmet = victim.inv.helmet && group === 'head';
      const cs = computeDamage(id, base, distance, group, victim.inv.armor, victim.inv.helmet);
      victim.inv.armor = Math.max(0, victim.inv.armor - cs.armor);
      if (victim.inv.armor <= 0) victim.inv.helmet = false;
      res = cs;
    }
    victim.health -= res.health;
    victim.tagUntil = this.now + 0.35;
    victim.damageFrom.set(attacker, (victim.damageFrom.get(attacker) ?? 0) + res.health);
    this.effects.blood(at, dir, group === 'head');
    if (victim === this.player) {
      this.hurtDirs.push({ from: attacker.pos.clone(), until: this.now + 1.2 });
      this.rig.notifyHit(attacker.pos, victim, this.now);
      this.sfx.hurt();
      victim.pitch += 0.015; // flinch
    }
    if (attacker === this.player && victim !== this.player) this.sfx.hit(group === 'head', helmet);
    if (victim.brain && !victim.brain.target) {
      victim.brain.lastKnown = attacker.pos.clone();
      victim.brain.seenAt = this.now - 1;
    }
    if (victim.health <= 0) this.kill(victim, attacker, id, group === 'head', wallbang);
  }

  private kill(victim: Agent, attacker: Agent, id: WeaponId | 'zone', headshot: boolean, wallbang: boolean) {
    victim.alive = false;
    victim.health = 0;
    victim.deaths++;
    victim.diedAt = this.now;
    victim.healing = null;
    if (this.mode === 'br') this.deathCrate(victim);
    else {
      const drop = victim.inv.primary ?? victim.inv.secondary;
      if (drop) this.dropWeapon(victim, drop, true);
    }
    victim.inv.grenades = [];
    victim.inv.grenade = null;
    victim.body?.setWeapon(null);
    if (attacker !== victim && !allied(attacker, victim)) {
      attacker.kills++;
      attacker.roundKills++;
      if (headshot) attacker.headshots++;
      if (id !== 'zone') attacker.money = addMoney(attacker.money, WEAPONS[id].reward);
    }
    for (const [a, dmg] of victim.damageFrom) if (a !== attacker && !allied(a, victim) && dmg > 40) a.assists++;
    this.killfeed.push({
      id: this.now + Math.random(), t: this.now, killer: attacker.name, killerTeam: attacker.team, victim: victim.name, victimTeam: victim.team, weapon: id, headshot, wallbang,
      mine: attacker === this.player || victim === this.player
    });
    if (this.killfeed.length > 6) this.killfeed.shift();
    if (victim === this.player) {
      this.killedBy = id === 'zone' ? 'Bạn bị bo xanh hạ gục' : attacker === victim ? 'Bạn tự hạ chính mình' : `Bị hạ bởi ${attacker.name} · ${WEAPONS[id].name}${headshot ? ' · trúng đầu' : ''}`;
      this.invOpen = this.mapOpen = false;
      this.buyOpen = false;
      this.spec = 0;
      this.rig.hideGun();
    }
    if (this.mode === 'br') this.checkRoyaleEnd();
    else this.checkElimination();
    this.emit();
  }

  private dropWeapon(a: Agent, w: WeaponState, onDeath = false) {
    if (w === a.inv.primary) a.inv.primary = null;
    if (w === a.inv.secondary) a.inv.secondary = null;
    w.zoom = 0;
    w.reloadLeft = 0;
    if (this.mode === 'br') {
      this.dropLoot(a, { kind: 'weapon', id: w.id }, w);
      return;
    }
    const ahead = onDeath ? 0.4 : 1.4;
    const pos = new THREE.Vector3(a.pos.x - Math.sin(a.yaw) * ahead, 0, a.pos.z - Math.cos(a.yaw) * ahead);
    if (blocked(pos.x, pos.z, this.arena.solids, 0.2, a.pos.y)) pos.set(a.pos.x, 0, a.pos.z);
    pos.y = groundHeight(pos.x, pos.z, this.arena.solids, a.pos.y + 0.1, 0.2) + 0.05;
    const mesh = gunMesh(w.id);
    mesh.position.copy(pos);
    mesh.rotation.set(0, Math.random() * Math.PI * 2, Math.PI / 2);
    this.arena.scene.add(mesh);
    this.pickups.push({ w, mesh, pos });
  }

  private removePickup(p: Pickup) {
    p.mesh.removeFromParent();
    disposeTree(p.mesh);
    this.pickups = this.pickups.filter((q) => q !== p);
  }

  private nearestPickup(a: Agent, range: number) {
    let best: Pickup | null = null;
    let d = range;
    for (const p of this.pickups) {
      const dist = Math.hypot(p.pos.x - a.pos.x, p.pos.z - a.pos.z);
      if (dist < d && Math.abs(p.pos.y - a.pos.y) < 1.5) {
        d = dist;
        best = p;
      }
    }
    return best;
  }

  private fire(a: Agent, w: WeaponState) {
    const def = WEAPONS[w.id];
    // inaccuracy is measured before this shot adds its own penalty: the first bullet is the accurate one
    const spread = inaccuracy(w, { speed: a.speed2d, crouched: a.crouch > 0.5, airborne: !a.onGround, prone: a.prone > 0.5 }) * this.aimSpread(a);
    const eye = a.eye();
    // the player's bullet leaves the muzzle (battle royale) towards the point the crosshair is on
    const origin = a.isPlayer && this.mode === 'br' ? this.playerAim.shotOrigin(eye) : eye;
    const [yaw0, pitch0] = a.isPlayer ? this.playerAim.shotAngles(this.camera, origin, [a.yaw, a.pitch], this.arena.solids, this.hitBody, aimPunch(w.id, w.recoil)) : [a.yaw, a.pitch];
    const index = consumeShot(w);
    if (index < 0) return;
    const [px, py] = aimPunch(w.id, index);
    const r = spread * Math.random();
    const th = Math.random() * Math.PI * 2;
    const jitter = (Math.random() - 0.5) * 0.0015 * Math.min(index, 10);
    const dir = dirFromAngles(yaw0 - px + Math.cos(th) * r + jitter, pitch0 + py + Math.sin(th) * r);
    const end = this.traceBullet(a, w.id, origin, dir);
    const muzzle = new THREE.Vector3();
    if (a.body) a.body.muzzleWorld(muzzle);
    else if (origin !== eye) muzzle.copy(origin);
    else muzzle.copy(eye).addScaledVector(dir, 0.6).add(new THREE.Vector3(0, -0.12, 0));
    this.effects.muzzle(muzzle, dir);
    if (!a.isPlayer || this.shotCount++ % 3 === 0) this.effects.tracer(muzzle, end, a.team === 'CT' ? 0xbfd8ff : 0xffd79a);
    if (a.isPlayer) {
      this.sfx.shot(w.id);
      this.vm.muzzleFlash();
      this.kick = 1;
      this.inspectAt = -99;
    } else this.sfx.shot(w.id, a.pos);
    if (w.id !== 'usp') this.heard.push({ pos: a.pos.clone(), squad: a.squad, t: this.now });
    // a scoped shot keeps the scope: dropping out of it for every bolt cycle made the picture jump (the bolt time is the weapon's cooldown)
    if (def.scope && w.zoom > 0 && !a.isPlayer) {
      // bots still look through the scope only between shots
      a.resumeZoom = 0;
      w.zoom = 0;
    }
  }

  private knife(a: Agent, heavy: boolean) {
    const w = a.inv.knife;
    if (!canFire(w)) return;
    consumeShot(w);
    if (heavy) w.cooldown = 1.0;
    const eye = a.eye();
    const dir = a.forward();
    let best: { agent: Agent; t: number; group: HitGroup } | null = null;
    for (const b of this.agents) {
      if (!b.alive || allied(b, a)) continue;
      const h = this.hitAgent(b, eye, dir, WEAPONS.knife.range);
      if (h && (!best || h.t < best.t)) best = { agent: b, ...h };
    }
    if (a.isPlayer) {
      this.swingAt = this.now;
      this.swingHeavy = heavy;
    }
    this.sfx.knife(!!best, a.isPlayer ? undefined : a.pos);
    if (!best) return;
    // backstab: the attacker is behind the victim
    const victimFwd = best.agent.forward().setY(0).normalize();
    const toAttacker = a.pos.clone().sub(best.agent.pos).setY(0).normalize();
    const back = victimFwd.dot(toAttacker) < -0.4;
    const dmg = (heavy ? 65 : 40) * (back ? (heavy ? 3 : 2.25) : 1);
    this.damage(best.agent, a, 'knife', dmg, best.group === 'head' ? 'chest' : best.group, 0, false, eye.clone().addScaledVector(dir, best.t), dir);
  }

  private throwNade(a: Agent, mode: 'fire' | 'alt') {
    const g = a.inv.grenade;
    if (!g) return;
    const dir = a.forward();
    const pos = a.eye().addScaledVector(dir, 0.4);
    const vel = dir.clone().multiplyScalar(mode === 'fire' ? 17 : 8).add(new THREE.Vector3(0, 2.2, 0)).addScaledVector(a.vel, 0.8);
    const mesh = gunMesh(g.id);
    mesh.scale.setScalar(1.4);
    mesh.position.copy(pos);
    this.arena.scene.add(mesh);
    this.nades.push({ id: g.id, owner: a, pos, vel, mesh, age: 0, still: 0 });
    spendGrenade(a.inv);
    if (a.isPlayer) {
      this.swingAt = this.now;
      this.sfx.knife(false);
    }
  }

  /** Reload, fire, scope and grenades; the same code drives the player and the bots. */
  private updateWeapon(a: Agent, dt: number) {
    const w = activeWeapon(a.inv);
    if (!w) return;
    tickWeapon(w, dt);
    const def = WEAPONS[w.id];
    if (a.resumeZoom && w.cooldown <= 0) {
      if (w.reloadLeft <= 0) w.zoom = a.resumeZoom;
      a.resumeZoom = 0;
    }
    const inp = a.input;
    if (inp.reload && beginReload(w) && a.isPlayer) {
      this.sfx.reload(def.reload);
      this.inspectAt = -99;
    }
    const canShoot = this.phase === 'live' || this.phase === 'roundEnd';
    if (def.slot === 4) {
      // hold to pull the pin, release to throw (left = far, right = short lob)
      if ((inp.fire || inp.alt) && !a.pin && w.deployLeft <= 0) a.pin = inp.fire ? 'fire' : 'alt';
      if (a.pin && !inp.fire && !inp.alt && canShoot) {
        const mode = a.pin;
        a.pin = '';
        this.throwNade(a, mode);
      }
      return;
    }
    // secondary attack (on press): AWP zoom levels / heavy knife stab
    if (inp.alt && !a.altLatch) {
      if (def.scope && w.reloadLeft <= 0 && w.deployLeft <= 0) {
        w.zoom = (w.zoom + 1) % (def.scope.length + 1);
        a.resumeZoom = 0;
        if (a.isPlayer) this.sfx.click(1300, 0.1);
      } else if (w.id === 'knife' && canShoot) this.knife(a, true);
    }
    a.altLatch = inp.alt;
    if (!inp.fire) {
      a.fireLatch = false;
      return;
    }
    if (!canShoot) return;
    if (w.id === 'knife') {
      this.knife(a, false);
      return;
    }
    if (!def.auto && a.fireLatch) return;
    if (w.ammo === 0 && w.reloadLeft <= 0) {
      // dry fire: click, then reload automatically
      if (!a.fireLatch) {
        if (a.isPlayer) this.sfx.click();
        if (beginReload(w) && a.isPlayer) this.sfx.reload(def.reload);
      }
      a.fireLatch = true;
      return;
    }
    if (canFire(w)) {
      a.fireLatch = true;
      this.fire(a, w);
    }
  }

  /* ───────────────────────── movement ───────────────────────── */

  /**
   * Lean towards Q / E. A wall beside the head stops the lean before the eye (and so the camera and the shots) would go into it.
   */
  private updateLean(a: Agent, dt: number) {
    const can = a.alive && a.prone < 0.5 && !a.sprinting;
    let want = can ? this.leanWant : 0;
    if (want !== 0 && a.leanReach > 0) {
      const reach = a.leanReach * a.scale;
      const side = Math.sign(want);
      const dirX = Math.cos(a.yaw) * side;
      const dirZ = -Math.sin(a.yaw) * side;
      const y = a.pos.y + a.eyeHeight;
      let free = reach + LEAN_WALL_GAP;
      for (const solid of this.arena.solids) {
        const hit = rayBox(a.pos.x, y, a.pos.z, dirX, 0, dirZ, solid, free);
        if (hit) free = Math.min(free, hit[0]);
      }
      want = side * THREE.MathUtils.clamp((free - LEAN_WALL_GAP) / reach, 0, 1);
    }
    const step = this.rig.leanSpeed * dt;
    a.lean += THREE.MathUtils.clamp(want - a.lean, -step, step);
  }

  private move(a: Agent, dt: number) {
    const inp = a.input;
    const frozen = this.phase === 'freeze';
    const w = activeWeapon(a.inv);
    // a jump from a crouch stands the body up and keeps it up until it lands: holding crouch in the air must not pull it back down
    a.crouch = THREE.MathUtils.clamp(a.crouch + (inp.crouch && a.onGround ? 1 : -1) * dt * (a.onGround ? 6 : 12), 0, 1);
    const wantProne = a.isPlayer && a.alive && this.stance.value === 'prone' && a.onGround;
    a.prone = THREE.MathUtils.clamp(a.prone + (wantProne ? 1 : -1) * (dt / PRONE_SECONDS), 0, 1);
    a.sprinting = inp.sprint && a.prone < 0.1 && a.crouch < 0.1 && !frozen;
    if (a.isPlayer) this.updateLean(a, dt);
    const gait = a.prone > 0.5 ? 'prone' : a.sprinting ? 'sprint' : 'normal';
    let wishX = 0;
    let wishZ = 0;
    if (!frozen && (inp.f || inp.r)) {
      wishX = -Math.sin(a.yaw) * inp.f + Math.cos(a.yaw) * inp.r;
      wishZ = -Math.cos(a.yaw) * inp.f - Math.sin(a.yaw) * inp.r;
      const len = Math.hypot(wishX, wishZ) || 1;
      const max =
        maxSpeed(w?.id ?? 'knife', inp.walk || !!a.healing, a.crouch > 0.5, (w?.zoom ?? 0) > 0 || (a.isPlayer && slowsMovement(this.playerAim.mode)), gait) * (this.now < a.tagUntil ? 0.45 : 1) * (a.healing ? 0.8 : 1) * boostEffect(a.boost).speed;
      wishX = (wishX / len) * max;
      wishZ = (wishZ / len) * max;
    }
    if (a.onGround) {
      // accelerate toward the wished velocity; letting go (or counter-strafing) stops fast
      const dx = wishX - a.vel.x;
      const dz = wishZ - a.vel.z;
      const dl = Math.hypot(dx, dz);
      const rate = (wishX || wishZ ? MOVE.accel : MOVE.friction) * dt;
      if (dl <= rate) {
        a.vel.x = wishX;
        a.vel.z = wishZ;
      } else {
        a.vel.x += (dx / dl) * rate;
        a.vel.z += (dz / dl) * rate;
      }
      if (inp.jump && !a.jumpLatch && !frozen && a.prone <= 0) {
        // Release the crouch pose on takeoff so a crouch-jump is visibly and
        // physically treated as a jump instead of remaining in the low stance.
        a.crouch = 0;
        a.vel.y = MOVE.jump;
        a.onGround = false;
        a.jumpLatch = true;
      }
    } else if (wishX || wishZ) {
      a.vel.x += THREE.MathUtils.clamp(wishX - a.vel.x, -MOVE.airAccel * dt, MOVE.airAccel * dt);
      a.vel.z += THREE.MathUtils.clamp(wishZ - a.vel.z, -MOVE.airAccel * dt, MOVE.airAccel * dt);
    }
    if (!inp.jump) a.jumpLatch = false;
    if (frozen) a.vel.x = a.vel.z = 0;
    const height = 1.8 - a.crouch * 0.5 - a.prone * PRONE_HEIGHT_DROP;
    const solids = this.arena.solids;
    const moveStartX = a.pos.x;
    const moveStartZ = a.pos.z;
    const attemptedX = a.vel.x;
    const attemptedZ = a.vel.z;
    const nx = a.pos.x + a.vel.x * dt;
    if (!blocked(nx, a.pos.z, solids, MOVE.radius, a.pos.y, height)) a.pos.x = nx;
    else a.vel.x = 0;
    const nz = a.pos.z + a.vel.z * dt;
    if (!blocked(a.pos.x, nz, solids, MOVE.radius, a.pos.y, height)) a.pos.z = nz;
    else a.vel.z = 0;
    // A* uses a coarse grid, so a bot can occasionally face a wall that the
    // route considers open. Probe nearby escape directions when fully blocked.
    if (a.brain && !a.isPlayer && (wishX || wishZ) && Math.hypot(a.pos.x - moveStartX, a.pos.z - moveStartZ) < 0.001) {
      const base = Math.atan2(attemptedZ || wishZ, attemptedX || wishX);
      const step = Math.max(0.08, Math.hypot(attemptedX, attemptedZ) * dt);
      const offsets = [Math.PI / 4, -Math.PI / 4, Math.PI / 2, -Math.PI / 2, (3 * Math.PI) / 4, -(3 * Math.PI) / 4, Math.PI];
      for (const offset of offsets) {
        const angle = base + offset;
        const x = moveStartX + Math.cos(angle) * step;
        const z = moveStartZ + Math.sin(angle) * step;
        if (blocked(x, z, solids, MOVE.radius, a.pos.y, height)) continue;
        a.pos.x = x;
        a.pos.z = z;
        a.vel.x = (x - moveStartX) / Math.max(dt, 1e-3);
        a.vel.z = (z - moveStartZ) / Math.max(dt, 1e-3);
        a.brain.path = [];
        a.brain.repathAt = 0;
        break;
      }
    }
    // keep agents from overlapping
    for (const b of this.agents) {
      if (b === a || !b.alive) continue;
      const dx = a.pos.x - b.pos.x;
      const dz = a.pos.z - b.pos.z;
      const d = Math.hypot(dx, dz);
      if (d > 0.001 && d < 0.7 && Math.abs(a.pos.y - b.pos.y) < 1.5) {
        const push = (0.7 - d) * 0.5;
        const px = a.pos.x + (dx / d) * push;
        const pz = a.pos.z + (dz / d) * push;
        if (!blocked(px, pz, solids, MOVE.radius, a.pos.y, height)) a.pos.set(px, a.pos.y, pz);
      }
    }
    // vertical: gravity, landing on the ground or a crate, walking off edges
    const wasAir = !a.onGround;
    const fall = a.vel.y;
    if (!a.onGround) a.vel.y -= MOVE.gravity * dt;
    const prevY = a.pos.y;
    a.pos.y += a.vel.y * dt;
    const ground = groundHeight(a.pos.x, a.pos.z, solids, Math.max(prevY, a.pos.y));
    if (a.pos.y <= ground) {
      a.pos.y = ground;
      a.vel.y = 0;
      a.onGround = true;
      if (wasAir && fall < -4) this.sfx.land(a.isPlayer ? undefined : a.pos);
    } else if (a.onGround && a.pos.y > ground + 0.05) a.onGround = false;
    // footsteps: running is loud, walking / crouching is silent (as in CS)
    const speed = a.speed2d;
    if (a.onGround && speed > MOVE.run * 0.62) {
      a.stepDist += speed * dt;
      if (a.stepDist > 2.4) {
        a.stepDist = 0;
        if (a.isPlayer) this.sfx.footstep(undefined, 0.3);
        else this.sfx.footstep(a.pos);
      }
    }
  }

  /* ───────────────────────── grenades ───────────────────────── */

  private updateNades(dt: number) {
    for (let i = this.nades.length - 1; i >= 0; i--) {
      const n = this.nades[i];
      n.age += dt;
      for (let s = 0; s < 2; s++) {
        const h = dt / 2;
        n.vel.y -= MOVE.gravity * h;
        const next = n.pos.clone().addScaledVector(n.vel, h);
        for (const b of this.arena.solids) {
          const e = 0.05;
          const inside = next.x > b.min.x - e && next.x < b.max.x + e && next.y > b.min.y - e && next.y < b.max.y + e && next.z > b.min.z - e && next.z < b.max.z + e;
          if (!inside) continue;
          // bounce off the face it came through
          if (n.pos.x <= b.min.x - e || n.pos.x >= b.max.x + e) n.vel.x *= -0.45;
          else if (n.pos.z <= b.min.z - e || n.pos.z >= b.max.z + e) n.vel.z *= -0.45;
          else n.vel.y *= -0.4;
          n.vel.multiplyScalar(0.75);
          next.copy(n.pos);
          if (n.vel.length() > 2) this.sfx.bounce(n.pos);
          break;
        }
        if (next.y < 0.05) {
          next.y = 0.05;
          if (Math.abs(n.vel.y) > 1.5) this.sfx.bounce(next);
          n.vel.y = -n.vel.y * 0.4;
          n.vel.x *= 0.7;
          n.vel.z *= 0.7;
        }
        n.pos.copy(next);
      }
      n.mesh.position.copy(n.pos);
      n.mesh.rotation.x += n.vel.length() * dt * 2;
      n.still = n.vel.length() < 0.3 ? n.still + dt : 0;
      const done = n.id === 'smoke' ? (n.still > 0.4 && n.age > 1) || n.age > 4 : n.age > 1.6;
      if (!done) continue;
      this.detonate(n);
      n.mesh.removeFromParent();
      disposeTree(n.mesh);
      this.nades.splice(i, 1);
    }
  }

  private detonate(n: Nade) {
    const at = n.pos.clone().setY(Math.max(0.3, n.pos.y));
    if (n.id === 'he') {
      this.effects.explosion(at);
      this.sfx.explosion(at);
      this.heard.push({ pos: at.clone(), squad: n.owner.squad, t: this.now });
      for (const a of this.agents) {
        if (!a.alive || (allied(a, n.owner) && a !== n.owner)) continue;
        const chest = a.chest();
        const dmg = heDamage(chest.distanceTo(at));
        if (dmg > 0 && this.canSee(at, chest, false)) this.damage(a, n.owner, 'he', dmg, 'chest', 0, false, chest, chest.clone().sub(at).normalize());
      }
    } else if (n.id === 'flash') {
      this.effects.flashbang(at);
      this.sfx.flashPop(at);
      for (const a of this.agents) {
        if (!a.alive) continue;
        const eye = a.eye();
        if (!this.canSee(at, eye, false)) continue;
        const to = at.clone().sub(eye);
        const dur = flashDuration(to.length(), a.forward().dot(to.normalize()));
        if (dur <= 0) continue;
        a.blindUntil = Math.max(a.blindUntil, this.now + dur);
        if (a === this.player) this.sfx.flashRing(dur);
      }
    } else {
      this.effects.smoke(at);
      this.sfx.smokeHiss(at);
    }
  }

  /* ───────────────────────── frame ───────────────────────── */

  private playerInput(dt: number) {
    const k = this.keys;
    const inp = this.player.input;
    inp.f = Number(k.has('forward')) - Number(k.has('back'));
    inp.r = Number(k.has('right')) - Number(k.has('left'));
    inp.walk = k.has('walk');
    inp.crouch = this.stance.value === 'crouch';
    inp.jump = k.has('jump');
    const ui = this.buyOpen || this.invOpen || this.mapOpen;
    inp.fire = !ui && (this.mouse[0] || this.touchFire);
    const w = activeWeapon(this.player.inv);
    const br = this.mode === 'br';
    const aimPressed = !ui && (this.mouse[1] || this.touchAlt);
    const mode = this.playerAim.step({
      dt, now: this.now, style: br ? 'pubg' : 'hold', perspective: this.thirdPerson ? 'tpp' : 'fpp', pressed: aimPressed, canAim: this.canAim(w, ui),
      freeLookHeld: k.has('freeLook') && this.player.alive, holdBreathHeld: k.has('sprint'), scoped: !!w && !!WEAPONS[w.id].scope, stance: this.stance.value,
    });
    // in battle royale the right button aims a gun (scoped ones too); it stays the secondary attack of knives, grenades and 5 vs 5 scopes
    inp.alt = aimPressed && !(br && !!w && WEAPONS[w.id].slot <= 2);
    if (br && w && WEAPONS[w.id].scope) w.zoom = mode === 'ADS' ? 1 : 0;
    // a shot or an aim ends a sprint at once (Shift holds the breath through a scope instead)
    inp.sprint = k.has('sprint') && inp.f > 0 && this.stance.value === 'stand' && !inp.fire && !inp.alt && !isAiming(mode);
    this.leanWant = Number(k.has('leanRight')) - Number(k.has('leanLeft'));
    inp.reload = this.reloadPressed;
    this.reloadPressed = false;
  }

  /** The player can raise the gun to aim: a gun in hand, ready, on the ground, not sprinting, no menu open. */
  private canAim(w: WeaponState | null, ui: boolean) {
    const p = this.player;
    if (!w || WEAPONS[w.id].slot > 2 || !p.alive || ui || this.phase === 'menu') return false;
    // 5 vs 5 scopes zoom with the button instead
    if (this.mode !== 'br') return !WEAPONS[w.id].scope;
    return w.reloadLeft <= 0 && w.deployLeft <= 0 && p.onGround && !p.sprinting && !p.healing;
  }

  /** Spread multiplier of the player's aim in battle royale (down the sights is steadier than from the hip). */
  private aimSpread(a: Agent) {
    return a.isPlayer && this.mode === 'br' ? aimSpreadFactor(this.playerAim.mode) : 1;
  }

  private step(dt: number) {
    this.now += dt;
    this.timer -= dt;
    if (this.mode === 'br') {
      this.brStep(dt);
      if (this.phase === 'matchEnd') return;
    } else if (this.phase === 'freeze' && this.timer <= 0) {
      this.phase = 'live';
      this.timer = ROUND.live;
      this.sfx.cue('start');
      this.say('Bắt đầu!', 1.5);
    } else if (this.phase === 'live' && this.timer <= 0) {
      this.endRound('CT', 'Hết giờ — CT giữ vững vị trí');
    } else if (this.phase === 'roundEnd' && this.timer <= 0) {
      if (this.matchWinner) {
        this.phase = 'matchEnd';
        this.buyOpen = false;
        if (document.pointerLockElement === this.renderer.domElement) document.exitPointerLock();
        this.emit();
        return;
      }
      this.startRound();
    }
    if (this.buyOpen && !this.canBuy(this.player)) this.toggleBuy(false);

    this.playerInput(dt);
    const world: AiWorld = {
      now: this.now, liveTime: this.now - this.liveAt, agents: this.agents, nav: this.nav, points: this.arena.points, heard: this.heard, skill: SKILLS[this.difficulty], canSee: this.canSee,
      objective: this.mode === 'br' ? this.royaleObjective : undefined
    };
    for (const a of this.agents) if (!a.isPlayer) think(a, world, dt);
    for (const a of this.agents) {
      if (!a.alive) continue;
      this.move(a, dt);
      this.updateWeapon(a, dt);
      a.body?.setWeapon(activeWeapon(a.inv)?.id ?? null);
    }
    // Death disables controls and combat, but airborne bodies still fall and
    // settle onto the terrain or the top of nearby props.
    for (const a of this.agents) {
      if (a.alive || a.onGround) continue;
      a.vel.y -= MOVE.gravity * dt;
      const nextY = a.pos.y + a.vel.y * dt;
      const ground = groundHeight(a.pos.x, a.pos.z, this.arena.solids, a.pos.y);
      if (nextY <= ground) {
        a.pos.y = ground;
        a.vel.y = 0;
        a.onGround = true;
      } else {
        a.pos.y = nextY;
      }
    }
    if (this.mode === 'br') this.syncBag();
    // bots grab a dropped rifle when they have none; anyone auto-picks a gun into an empty slot
    for (const a of this.agents) {
      if (!a.alive || this.mode === 'br') continue;
      const near = this.nearestPickup(a, a.isPlayer ? 1 : 1.4);
      if (!near) continue;
      const slot = WEAPONS[near.w.id].slot;
      if ((slot === 1 && !a.inv.primary) || (slot === 2 && !a.inv.secondary && a.isPlayer)) {
        this.removePickup(near);
        equip(a.inv, near.w);
        if (a.isPlayer) this.sfx.click(900, 0.2);
      }
    }
    this.updateNades(dt);
    this.heard = this.heard.filter((h) => this.now - h.t < 2);
    this.hurtDirs = this.hurtDirs.filter((h) => h.until > this.now);
    // enemies the player can see appear on the team radar
    this.spotTime += dt;
    if (this.spotTime > 0.1 && this.player.alive) {
      this.spotTime = 0;
      const eye = this.player.eye();
      const fwd = this.player.forward();
      for (const e of this.agents) {
        if (!e.alive || allied(e, this.player)) continue;
        const chest = e.chest();
        const to = chest.clone().sub(eye);
        if (to.length() < 120 && fwd.dot(to.normalize()) > 0.55 && this.canSee(eye, chest)) e.spottedUntil = this.now + 0.6;
      }
    }
    if (this.mode === 'cs') this.checkElimination();
  }

  private loop = (time: number) => {
    if (this.disposed) return;
    this.frame = requestAnimationFrame(this.loop);
    // `last` is set from performance.now() in start(), which can be later than the frame timestamp rAF passes in
    const dt = Math.max(0, Math.min(0.05, (time - this.last) / 1000));
    this.last = time;
    const running = this.active();
    if (running) this.step(dt);
    this.effects.update(running ? dt : 0);
    this.render(running ? dt : 0);
    if (running) this.adaptResolution(dt);
    this.hudTime += dt;
    if (this.hudTime > 0.1) {
      this.hudTime = 0;
      this.emit();
    }
  };

  /** Who the camera follows: the player, or a living teammate after death. */
  private viewTarget(): Agent | null {
    const p = this.player;
    if (p.alive || this.phase === 'menu') return p;
    const allies = this.agents.filter((a) => a.alive && (this.mode === 'br' || allied(a, p)) && a !== p);
    if (allies.length) return allies[this.spec % allies.length];
    return this.agents.find((a) => a.alive) ?? p;
  }

  private placeCamera(dt: number) {
    const p = this.player;
    const target = this.viewTarget();
    const w = activeWeapon(p.inv);
    const scope = p.alive && w && w.zoom > 0 ? WEAPONS[w.id].scope : undefined;
    if (!target) return { firstPerson: false, scoped: !!scope };
    const menu = this.phase === 'menu';
    const own = target === p && p.alive && !menu;
    const aim = this.playerAim;
    // a scope is down the sights whatever the aim mode (a 5 vs 5 scope zooms with the button)
    const mode: AimMode = !own ? 'TPP_HIP' : scope ? 'ADS' : aim.mode;
    const tw = activeWeapon(target.inv);
    const [px, py] = tw ? aimPunch(tw.id, tw.recoil) : [0, 0];
    const lookYaw = own ? aim.freeLook.yaw + aim.sway.yaw : 0;
    const lookPitch = own ? aim.freeLook.pitch + aim.sway.pitch : 0;
    const easing = mode === 'ADS' || aim.view.ads > 0.05 ? 'ADS' : 'TPP_SHOULDER';
    aim.view = aim.camera.place(this.camera, {
      // the view shows half of the aim punch; bullets follow all of it
      dt, mode, eye: target.eye(), yaw: target.yaw - px * 0.5 + lookYaw, pitch: THREE.MathUtils.clamp(target.pitch + py * 0.5 + lookPitch, -1.55, 1.55),
      roll: -target.lean * this.rig.leanAngle * this.rig.tuning.leanCameraRoll, transitionS: menu ? 0 : transitionSeconds(easing, gripOf(w)),
      eyeFov: VFOV, adsFov: scope ? scope[w!.zoom - 1] : IRON_SIGHT_FOV, menuDistance: menu ? TPP_MENU_DISTANCE : null,
      tuning: this.rig.tuning, solids: this.arena.solids,
    });
    return { firstPerson: aim.view.firstPersonView && p.alive && !menu, scoped: !!scope };
  }

  private render(dt: number) {
    const p = this.player;
    for (const a of this.agents) {
      if (!a.body) continue;
      a.body.group.position.copy(a.pos);
      a.body.group.rotation.y = a.yaw + Math.PI;
      a.body.update(dt, { speed: a.speed2d, crouch: a.crouch, pitch: a.pitch, alive: a.alive, dead: this.now - a.diedAt, airborne: !a.onGround });
    }
    const { firstPerson, scoped } = this.placeCamera(dt);
    this.playerAim.castView(this.camera, this.arena.solids, this.hitBody);
    // loot is small: past this distance its dozens of little meshes (and glints) are not worth a draw call
    if (this.mode === 'br') {
      const c = this.camera.position;
      for (const it of this.items) if (!it.crate) it.mesh.visible = Math.hypot(it.pos.x - c.x, it.pos.z - c.z) < LOOT_DRAW_DISTANCE;
    }
    // the shadow-casting sun follows the camera along the sky's sun direction
    this.arena.sun.target.position.set(this.camera.position.x, 0, this.camera.position.z);
    this.arena.sun.position.copy(this.arena.sun.target.position).addScaledVector(this.arena.sunDir, 70);
    this.maps.update(performance.now() / 1000, this.camera.position);
    if (this.zoneView && this.zoneNow) this.zoneView.update(performance.now() / 1000, this.zoneNow.cur, this.zoneNow.next);

    // the player's own character (drawn whenever the camera is outside it, also as a body after death); in the first-person
    // view the same character holds the gun there (see FirstPersonArms), and comes back to the world when that view ends
    const w = activeWeapon(p.inv);
    const viewModelShown = firstPerson && !scoped && !!w;
    if (!viewModelShown) this.fpArms.release(this.arena.scene);
    this.rig.update({
      dt, now: this.now, player: p, weapon: w, stance: this.stance.value, firstPerson, aimBlend: Math.max(this.playerAim.view.ads, this.playerAim.view.shoulder),
      clipAim: this.mode === 'br', aimPoint: this.mode === 'br' ? this.playerAim.point : null,
      swingAt: this.swingAt, swingHeavy: this.swingHeavy, solids: this.arena.solids,
    });
    this.playerAim.trackMuzzle(this.mode === 'br' && !firstPerson && p.alive ? this.rig.muzzle : null, this.arena.solids);

    const viewer = this.viewTarget();
    this.sfx.listener = { x: this.camera.position.x, y: this.camera.position.y, z: this.camera.position.z, yaw: viewer?.yaw ?? p.yaw };

    this.renderer.clear();
    this.renderer.render(this.arena.scene, this.camera);
    if (firstPerson && !scoped && w) {
      const forward = this.camera.getWorldDirection(new THREE.Vector3());
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
      let wallDistance = 2;
      for (const offset of [-0.24, 0, 0.24]) {
        const origin = this.camera.position.clone().addScaledVector(right, offset);
        for (const solid of this.arena.solids) {
          const hit = rayBox(origin.x, origin.y, origin.z, forward.x, forward.y, forward.z, solid, wallDistance);
          if (hit && hit[0] > 0.02) wallDistance = Math.min(wallDistance, hit[0]);
        }
      }
      this.gunObstruction = THREE.MathUtils.damp(this.gunObstruction, Math.max(0, 1.22 - wallDistance), 16, dt);
      const speed = p.speed2d;
      this.bob += speed * dt * 1.7;
      this.sway.x *= Math.exp(-dt * 10);
      this.sway.y *= Math.exp(-dt * 10);
      this.kick *= Math.exp(-dt * 16);
      const def = WEAPONS[w.id];
      this.vm.setWeapon(w.id);
      this.vm.update(
        dt,
        {
          bobPhase: this.bob,
          bobAmount: p.onGround ? Math.min(1, speed / 5) : 0.2,
          swayX: this.sway.x,
          swayY: this.sway.y,
          kick: this.kick,
          reload: w.reloadLeft > 0 ? 1 - w.reloadLeft / def.reload : 0,
          deploy: def.deploy ? 1 - w.deployLeft / def.deploy : 1,
          inspect: this.now - this.inspectAt < 2.4 ? this.now - this.inspectAt : -1,
          swing: this.now - this.swingAt < 0.35 ? (this.now - this.swingAt) / 0.35 : p.pin ? 0.15 : 0,
          swingHeavy: this.swingHeavy,
          crouch: p.crouch,
          aim: this.playerAim.view.ads,
          obstruction: this.gunObstruction
        },
        this.camera.aspect
      );
      // the player's character, posed by the combat clips, holds the gun here; the view's own gun and arms stand in until those
      // clips are loaded, and while aiming (their sights line up with the crosshair)
      const tuning = this.rig.tuning;
      const bodyHolds = this.fpArms.update({
        posed: this.rig.clipPosed, scene: this.vm.scene, home: this.arena.scene, pitch: this.rig.appliedPitch,
        side: tuning.fpSide, forward: tuning.fpForward, down: tuning.fpDown, tiltDeg: tuning.fpTiltDeg,
      });
      this.vm.setBodyHolds(bodyHolds ? this.rig.muzzle : null);
      this.renderer.clearDepth();
      this.renderer.render(this.vm.scene, this.vm.camera);
    }
    this.rig.resetToBind();

    // per-frame HUD values, too chatty for React: crosshair gap, flash and smoke whiteout
    const style = this.root.style;
    let gap = 5;
    if (w && WEAPONS[w.id].slot <= 2) {
      const inacc = inaccuracy(w, { speed: p.speed2d, crouched: p.crouch > 0.5, airborne: !p.onGround, prone: p.prone > 0.5 }) * this.aimSpread(p);
      // the lines open up only part of the way the real spread does: a moving crosshair that is too wide hides the target
      gap = THREE.MathUtils.clamp((Math.tan(inacc) / Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2))) * (this.host.clientHeight / 2) * 0.45, 3, 34);
    }
    style.setProperty('--ch-gap', `${gap.toFixed(1)}px`);
    // where cover in front of the muzzle would stop the shot, marked on the screen (PUBG's blocked-aim marker)
    const block = this.playerAim.blockedAt?.clone().project(this.camera);
    style.setProperty('--block-on', block && block.z < 1 ? '1' : '0');
    if (block) style.setProperty('--block-at', `${((block.x * this.host.clientWidth) / 2).toFixed(1)}px ${((-block.y * this.host.clientHeight) / 2).toFixed(1)}px`);
    style.setProperty('--flash', (p.alive ? Math.max(0, Math.min(1, (p.blindUntil - this.now) / 1.4)) : 0).toFixed(3));
    style.setProperty('--smoke', this.effects.smokeDensity(this.camera.position).toFixed(3));
  }

  /* ───────────────────────── agents per mode ───────────────────────── */

  /** Replace the bots: 4 + 5 soldiers for the team mode, 15 lone fighters for battle royale. */
  private setupAgents(mode: Mode) {
    for (const a of this.agents) {
      if (a.isPlayer || !a.body) continue;
      a.body.group.removeFromParent();
      disposeTree(a.body.group);
    }
    this.agents.length = 1;
    const add = (name: string, team: Team, squad?: number) => {
      const bot = new Agent(this.agents.length, name, team, false, squad);
      bot.body = new BotBody(team);
      bot.brain = newBrain();
      this.arena.scene.add(bot.body.group);
      this.agents.push(bot);
    };
    if (mode === 'cs') {
      this.player.squad = 0;
      (['CT', 'T'] as Team[]).forEach((team) => BOT_NAMES[team].forEach((name) => add(name, team)));
    } else {
      this.player.squad = 0;
      BR_BOTS.forEach((name, i) => add(name, i % 2 ? 'CT' : 'T', i + 1));
    }
    this.brTotal = this.agents.length;
  }

  /* ───────────────────────── battle royale ───────────────────────── */

  private startRoyale() {
    this.mode = 'br';
    this.nav = this.maps.use('br', this.camera);
    this.setupAgents('br');
    this.clearRoyale();
    this.clearBattlefield();
    this.killfeed = [];
    this.matchWinner = null;
    this.brPlacement = 0;
    this.brEndAt = 0;
    this.brPhaseSeen = '';
    const rand = Math.random;
    this.zones = planZones(rand, WORLD_LIMIT);
    this.zoneView = new ZoneView();
    this.arena.scene.add(this.zoneView.group);
    // loot: most building spots hold something, open ground less often
    const inside = (p: THREE.Vector3) => this.arena.buildings.some((b) => p.x > b.minX && p.x < b.maxX && p.z > b.minZ && p.z < b.maxZ);
    for (const spot of this.arena.lootSpots) {
      const indoor = inside(spot);
      if (rand() > (indoor ? 0.85 : 0.5)) continue;
      rollLoot(rand, indoor).forEach((l, i) => this.placeItem(l, spot.clone().add(new THREE.Vector3(((i % 2) - 0.5) * 0.7, 0, (Math.floor(i / 2) - 0.3) * 0.6))));
    }
    // everyone lands somewhere different with only a knife
    this.stance.stand();
    const taken: THREE.Vector3[] = [];
    for (const a of this.agents) {
      let p = new THREE.Vector3();
      for (let i = 0; i < 200; i++) {
        p = new THREE.Vector3((rand() * 2 - 1) * (WORLD_LIMIT - 24), 0, (rand() * 2 - 1) * (WORLD_LIMIT - 24));
        if (!blocked(p.x, p.z, this.arena.solids, 0.6) && taken.every((q) => q.distanceTo(p) > 24)) break;
      }
      taken.push(p);
      a.pos.copy(p);
      a.vel.set(0, 0, 0);
      a.yaw = rand() * Math.PI * 2;
      a.pitch = 0;
      a.crouch = 0;
      a.prone = 0;
      a.lean = 0;
      a.sprinting = false;
      a.onGround = true;
      a.alive = true;
      a.health = 100;
      a.kills = a.deaths = a.assists = a.headshots = a.mvps = a.roundKills = 0;
      a.inv = newInventory(a.team);
      a.inv.secondary = null;
      a.inv.active = 2;
      selectSlot(a.inv, 3);
      a.br = newBRInventory();
      a.boost = 0;
      a.healing = null;
      a.blindUntil = a.tagUntil = 0;
      a.damageFrom.clear();
      a.pin = '';
      a.fireLatch = false;
      if (a.brain) a.brain = newBrain();
      a.body?.setWeapon(null);
    }
    this.phase = 'live';
    this.brStart = this.now;
    this.liveAt = this.now;
    this.say('Nhặt vũ khí và trang bị! Bo bắt đầu thu hẹp sau 1:00 · F nhặt · Tab túi đồ · M bản đồ', 6);
  }

  private clearRoyale() {
    for (const it of this.items) {
      it.mesh.removeFromParent();
      disposeTree(it.mesh);
    }
    this.items = [];
    this.crates.forEach((c) => {
      c.removeFromParent();
      disposeTree(c);
    });
    this.crates.clear();
    if (this.zoneView) {
      this.zoneView.group.removeFromParent();
      disposeTree(this.zoneView.group);
      this.zoneView = null;
    }
    this.invOpen = this.mapOpen = false;
  }

  private placeItem(loot: Loot, pos: THREE.Vector3, crate = 0, weapon?: WeaponState) {
    const mesh = lootMesh(loot);
    mesh.position.copy(pos);
    mesh.rotation.y = Math.random() * Math.PI * 2;
    mesh.visible = !crate;
    const glint = crate ? null : sparkle();
    if (glint) mesh.add(glint);
    this.arena.scene.add(mesh);
    const it: GroundItem = { id: ++this.itemSeq, loot, weapon, pos: pos.clone(), mesh, glint, crate };
    this.items.push(it);
    return it;
  }

  private removeItem(it: GroundItem) {
    it.mesh.removeFromParent();
    disposeTree(it.mesh);
    this.items = this.items.filter((x) => x !== it);
    if (it.crate && !this.items.some((x) => x.crate === it.crate)) {
      const c = this.crates.get(it.crate);
      if (c) {
        c.removeFromParent();
        disposeTree(c);
      }
      this.crates.delete(it.crate);
    }
  }

  /** Drop something next to an agent. */
  private dropLoot(a: Agent, loot: Loot, weapon?: WeaponState) {
    const ang = Math.random() * Math.PI * 2;
    const p = new THREE.Vector3(a.pos.x + Math.cos(ang) * 0.8, 0, a.pos.z + Math.sin(ang) * 0.8);
    if (blocked(p.x, p.z, this.arena.solids, 0.15, a.pos.y)) p.set(a.pos.x, 0, a.pos.z);
    p.y = groundHeight(p.x, p.z, this.arena.solids, a.pos.y + 0.1, 0.2) + 0.03;
    this.placeItem(loot, p, 0, weapon);
  }

  /** Everything a dead fighter carried goes into a crate at their feet. */
  private deathCrate(a: Agent) {
    const b = a.br;
    if (!b) return;
    const crateId = ++this.itemSeq;
    const pos = a.pos.clone().setY(groundHeight(a.pos.x, a.pos.z, this.arena.solids, a.pos.y + 0.1, 0.3));
    const put = (l: Loot, w?: WeaponState) => this.placeItem(l, pos, crateId, w);
    for (const w of [a.inv.primary, a.inv.secondary]) if (w) put({ kind: 'weapon', id: w.id }, w);
    for (const g of a.inv.grenades) put({ kind: 'grenade', id: g as 'he' | 'flash' | 'smoke' });
    for (const [t, n] of Object.entries(b.ammo)) if (n > 0) put({ kind: 'ammo', ammo: t as AmmoType, count: n });
    for (const [m, n] of Object.entries(b.meds)) if (n > 0) put({ kind: 'med', med: m as MedId, count: n });
    if (b.vest) put({ kind: 'gear', gear: 'vest', level: b.vest.level, durability: b.vest.durability });
    if (b.helmet) put({ kind: 'gear', gear: 'helmet', level: b.helmet.level, durability: b.helmet.durability });
    if (b.backpack) put({ kind: 'gear', gear: 'backpack', level: b.backpack, durability: 0 });
    if (!this.items.some((x) => x.crate === crateId)) return;
    const mesh = crateMesh();
    mesh.position.copy(pos);
    mesh.rotation.y = a.yaw;
    this.arena.scene.add(mesh);
    this.crates.set(crateId, mesh);
    a.inv.primary = a.inv.secondary = null;
    a.inv.grenades = [];
    a.br = newBRInventory();
  }

  /** Put a ground item into an agent's inventory. Returns false when nothing could be taken. */
  private takeItem(a: Agent, it: GroundItem): boolean {
    const b = a.br;
    if (!b || !a.alive) return false;
    const l = it.loot;
    const grenades = a.inv.grenades.length;
    switch (l.kind) {
      case 'weapon': {
        const w = it.weapon ?? newWeapon(l.id);
        w.deployLeft = WEAPONS[l.id].deploy;
        this.removeItem(it);
        const old = equip(a.inv, w);
        if (old) this.dropLoot(a, { kind: 'weapon', id: old.id }, old);
        break;
      }
      case 'grenade': {
        if (!roomFor(b, l, grenades) || a.inv.grenades.filter((g) => g === l.id).length >= 3) return false;
        a.inv.grenades.push(l.id);
        this.removeItem(it);
        break;
      }
      case 'ammo':
      case 'med': {
        const n = roomFor(b, l, grenades);
        if (n <= 0) return false;
        if (l.kind === 'ammo') b.ammo[l.ammo] += n;
        else b.meds[l.med] += n;
        l.count -= n;
        if (l.count <= 0) this.removeItem(it);
        break;
      }
      case 'gear': {
        this.removeItem(it);
        if (l.gear === 'backpack') {
          if (b.backpack) this.dropLoot(a, { kind: 'gear', gear: 'backpack', level: b.backpack, durability: 0 });
          b.backpack = l.level;
        } else {
          const old = b[l.gear];
          if (old) this.dropLoot(a, { kind: 'gear', gear: l.gear, level: old.level, durability: old.durability });
          b[l.gear] = { level: l.level, durability: l.durability };
        }
        break;
      }
    }
    if (a.isPlayer) this.sfx.click(900, 0.2);
    return true;
  }

  /** Whether a bot would bother picking an item up. */
  private wants(a: Agent, l: Loot): boolean {
    const b = a.br!;
    switch (l.kind) {
      case 'weapon': {
        const slot = WEAPONS[l.id].slot;
        if (slot === 1) return !a.inv.primary || (GUN_TIER[l.id] ?? 0) > (GUN_TIER[a.inv.primary.id] ?? 0);
        return slot === 2 && !a.inv.secondary;
      }
      case 'ammo':
        return [a.inv.primary, a.inv.secondary].some((w) => w && AMMO_OF[w.id] === l.ammo) && b.ammo[l.ammo] < 150;
      case 'gear':
        return isUpgrade(b, l);
      case 'med':
        return b.meds[l.med] < ({ bandage: 10, firstaid: 3, medkit: 2, energy: 3, painkiller: 2 } as Record<MedId, number>)[l.med];
      case 'grenade':
        return a.inv.grenades.length < 2;
    }
  }

  /** Items in reach of an agent, nearest first. */
  private itemsNear(a: Agent, range = 2.4) {
    return this.items
      .map((it) => ({ it, d: Math.hypot(it.pos.x - a.pos.x, it.pos.z - a.pos.z) }))
      .filter(({ it, d }) => d < range && Math.abs(it.pos.y - a.pos.y) < 1.6)
      .sort((p, q) => p.d - q.d)
      .map(({ it }) => it);
  }

  /** F: pick up what the player looks at (or the nearest thing). */
  private pickupNearest() {
    const p = this.player;
    if (!p.alive) return;
    const near = this.itemsNear(p, 2.2);
    if (!near.length) return;
    const fwd = p.forward().setY(0).normalize();
    const score = (it: GroundItem) => {
      const to = it.pos.clone().sub(p.pos).setY(0);
      return to.length() * (1.5 - fwd.dot(to.normalize()));
    };
    const best = near.sort((x, y) => score(x) - score(y))[0];
    if (!this.takeItem(p, best)) this.say('Túi đồ đã đầy.', 2);
  }

  /** Inventory screen: take an item from the ground by id. */
  public brTake(id: number) {
    const it = this.items.find((x) => x.id === id);
    if (!it || !this.itemsNear(this.player, 2.6).includes(it)) return;
    if (!this.takeItem(this.player, it)) this.say('Túi đồ đã đầy.', 2);
    this.emit();
  }

  /** Inventory screen: drop ammo, meds, a grenade or worn gear. */
  public brDrop(what: { ammo?: AmmoType; med?: MedId; grenade?: WeaponId; gear?: 'vest' | 'helmet' | 'backpack' }) {
    const p = this.player;
    const b = p.br;
    if (!b || !p.alive) return;
    if (what.ammo && b.ammo[what.ammo] > 0) {
      this.dropLoot(p, { kind: 'ammo', ammo: what.ammo, count: b.ammo[what.ammo] });
      b.ammo[what.ammo] = 0;
    } else if (what.med && b.meds[what.med] > 0) {
      this.dropLoot(p, { kind: 'med', med: what.med, count: b.meds[what.med] });
      b.meds[what.med] = 0;
    } else if (what.grenade) {
      const i = p.inv.grenades.indexOf(what.grenade);
      if (i >= 0) {
        p.inv.grenades.splice(i, 1);
        if (p.inv.active === 4 && p.inv.grenade?.id === what.grenade) fallbackSlot(p.inv);
        this.dropLoot(p, { kind: 'grenade', id: what.grenade as 'he' | 'flash' | 'smoke' });
      }
    } else if (what.gear === 'backpack' && b.backpack) {
      this.dropLoot(p, { kind: 'gear', gear: 'backpack', level: b.backpack, durability: 0 });
      b.backpack = 0;
    } else if (what.gear === 'vest' || what.gear === 'helmet') {
      const g = b[what.gear];
      if (g) this.dropLoot(p, { kind: 'gear', gear: what.gear, level: g.level, durability: g.durability });
      b[what.gear] = null;
    }
    this.sfx.click(600, 0.12);
    this.emit();
  }

  /** Start using a med (H / J keys, inventory screen, bots). */
  public brUse(med: MedId, a: Agent = this.player) {
    const b = a.br;
    if (!b || !a.alive || a.healing || b.meds[med] <= 0) return false;
    const d = MEDS[med];
    if (d.heal && healAmount(med, a.health) <= 0) {
      if (a.isPlayer) this.say(med === 'medkit' ? 'Máu đã đầy.' : 'Chỉ hồi được tới 75 máu.', 2);
      return false;
    }
    a.healing = { med, left: d.use, total: d.use };
    if (a.isPlayer) {
      this.say(`Đang dùng ${d.name}…`, d.use);
      this.invOpen = false;
    }
    return true;
  }

  private finishHeal(a: Agent) {
    const h = a.healing!;
    a.healing = null;
    const b = a.br;
    if (!b || b.meds[h.med] <= 0) return;
    b.meds[h.med]--;
    const d = MEDS[h.med];
    a.health = Math.min(100, a.health + healAmount(h.med, a.health));
    a.boost = Math.min(100, a.boost + d.boost);
    if (a.isPlayer) this.sfx.cue('buy');
  }

  /** After weapons updated: what reloads took from a gun's reserve comes out of the bag. */
  private syncBag() {
    for (const a of this.agents) {
      if (!a.alive || !a.br) continue;
      for (const w of [a.inv.primary, a.inv.secondary]) {
        const at = w && AMMO_OF[w.id];
        if (w && at) a.br.ammo[at] = w.reserve;
      }
    }
  }

  /** Keep each gun's reserve equal to the matching ammo in the bag (reloads draw from it). */
  private syncReserve(a: Agent) {
    if (!a.br) return;
    for (const w of [a.inv.primary, a.inv.secondary]) {
      const t = w && AMMO_OF[w.id];
      if (w && t) w.reserve = a.br.ammo[t];
    }
  }

  /** Where a bot goes when nobody is in sight: into the zone, to loot it wants, or around the safe circle. */
  private royaleObjective = (a: Agent) => {
    const z = this.zoneNow;
    if (!z) return null;
    const target = z.next && z.next.r > 0 ? z.next : z.cur;
    const distTo = (c: Circle) => Math.hypot(a.pos.x - c.x, a.pos.z - c.z);
    const toward = (c: Circle) => {
      const d = distTo(c);
      const k = d > 0.1 ? Math.max(0, d - c.r * 0.6) / d : 0;
      return { x: a.pos.x + (c.x - a.pos.x) * k, z: a.pos.z + (c.z - a.pos.z) * k };
    };
    // outside (or about to be outside) the zone: run in
    if (distTo(z.cur) > z.cur.r - 3 || (z.timeLeft < 25 && distTo(target) > target.r)) return toward(target);
    // loot it wants within reach and inside the zone
    let best: GroundItem | null = null;
    let bd = 45;
    for (const it of this.items) {
      const d = Math.hypot(it.pos.x - a.pos.x, it.pos.z - a.pos.z);
      if (d < bd && Math.hypot(it.pos.x - z.cur.x, it.pos.z - z.cur.z) < z.cur.r - 2 && this.wants(a, it.loot)) {
        bd = d;
        best = it;
      }
    }
    if (best) return { x: best.pos.x, z: best.pos.z };
    // patrol inside the next circle
    const ang = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * target.r * 0.7;
    return { x: target.x + Math.cos(ang) * r, z: target.z + Math.sin(ang) * r };
  };

  private brStep(dt: number) {
    const t = this.now - this.brStart;
    const z = zoneAt(this.zones, t);
    this.zoneNow = z;
    const key = `${z.phase}:${z.shrinking}`;
    if (key !== this.brPhaseSeen && this.player.alive) {
      if (this.brPhaseSeen) {
        if (z.shrinking) this.say('Bo đang thu hẹp! Di chuyển vào vòng trắng.', 4);
        else if (z.next) this.say(`Vòng bo mới! Thu hẹp sau ${Math.ceil(z.timeLeft)} giây.`, 4);
      }
      this.brPhaseSeen = key;
    }
    for (const a of this.agents) {
      if (!a.alive) continue;
      this.syncReserve(a);
      // blue zone damage ignores armour
      if (Math.hypot(a.pos.x - z.cur.x, a.pos.z - z.cur.z) > z.cur.r) {
        a.health -= z.dps * dt;
        if (a === this.player) this.hurtDirs.push({ from: new THREE.Vector3(z.cur.x, 0, z.cur.z), until: this.now + 0.15 });
        if (a.health <= 0) {
          this.kill(a, a, 'zone', false, false);
          continue;
        }
      }
      if (a.boost > 0) {
        a.health = Math.min(100, a.health + boostEffect(a.boost).healPerSec * dt);
        a.boost = Math.max(0, a.boost - BOOST_DRAIN * dt);
      }
      if (a.healing) {
        // shooting, jumping or switching weapons interrupts it
        if (a.input.fire || (a.input.jump && a.onGround)) {
          a.healing = null;
          if (a.isPlayer) this.say('Đã huỷ.', 1.5);
        } else if ((a.healing.left -= dt) <= 0) this.finishHeal(a);
      }
      if (a.isPlayer) {
        // walk over ammo for your guns to grab it
        for (const it of this.itemsNear(a, 1)) if (it.loot.kind === 'ammo' && this.wants(a, it.loot) && !it.crate) this.takeItem(a, it);
        continue;
      }
      // bots: take what they want within reach, heal when it is quiet
      for (const it of this.itemsNear(a, 1.5)) if (this.wants(a, it.loot)) this.takeItem(a, it);
      const quiet = !a.brain?.target && this.now - (a.brain?.seenAt ?? -99) > 3;
      if (quiet && !a.healing) {
        const med = (a.health < 80 && bestHeal(a.br!, a.health)) || bestBoost(a.br!, a.boost);
        if (med) this.brUse(med, a);
      }
    }
    for (const it of this.items) if (it.glint) it.glint.material.opacity = 0.45 + 0.4 * Math.sin(this.now * 3 + it.id);
    this.checkRoyaleEnd();
    if (this.brEndAt && this.now >= this.brEndAt) {
      this.phase = 'matchEnd';
      this.invOpen = this.mapOpen = false;
      if (document.pointerLockElement === this.renderer.domElement) document.exitPointerLock();
      this.emit();
    }
  }

  private checkRoyaleEnd() {
    if (this.brEndAt) return;
    const alive = this.agents.filter((a) => a.alive).length;
    if (!this.player.alive) {
      this.brPlacement = alive + 1;
      this.brEndAt = this.now + 3.5;
      this.sfx.cue('lose');
    } else if (alive <= 1) {
      this.brPlacement = 1;
      this.brEndAt = this.now + 3;
      this.say('Chiến thắng! Tối nay ăn gà!', 4);
      this.sfx.cue('win');
    }
  }

  private royaleSnapshot(): RoyaleSnapshot | null {
    if (this.mode !== 'br') return null;
    const p = this.player;
    const b = p.br ?? newBRInventory();
    const z = this.zoneNow ?? zoneAt(this.zones.length ? this.zones : [{ x: 0, z: 0, r: 160 }], 0);
    const d = Math.hypot(p.pos.x - z.cur.x, p.pos.z - z.cur.z);
    const near = p.alive ? this.itemsNear(p, 2.6) : [];
    const name = (l: Loot) => lootName(l, (id) => WEAPONS[id].name);
    const hintItem = p.alive ? this.itemsNear(p, 2.2)[0] : undefined;
    return {
      alive: this.agents.filter((a) => a.alive).length,
      total: this.brTotal,
      kills: p.kills,
      placement: this.brPlacement,
      zone: { cur: z.cur, next: z.next, phase: z.phase, shrinking: z.shrinking, timeLeft: Math.ceil(z.timeLeft), dps: z.dps, outside: d > z.cur.r, distance: Math.max(0, d - z.cur.r) },
      vest: b.vest ? { level: b.vest.level, durability: b.vest.durability, max: GEAR.vest.durability[b.vest.level] } : null,
      helmet: b.helmet ? { level: b.helmet.level, durability: b.helmet.durability, max: GEAR.helmet.durability[b.helmet.level] } : null,
      backpack: b.backpack,
      boost: p.boost,
      healing: p.healing ? { name: MEDS[p.healing.med].name, progress: 1 - p.healing.left / p.healing.total } : null,
      meds: { ...b.meds },
      ammo: { ...b.ammo },
      grenades: [...p.inv.grenades],
      weight: Math.round(weight(b, p.inv.grenades.length)),
      capacity: capacity(b),
      invOpen: this.invOpen,
      mapOpen: this.mapOpen,
      near: near.map((it) => ({ id: it.id, name: name(it.loot), upgrade: isUpgrade(b, it.loot) || (it.loot.kind === 'weapon' && WEAPONS[it.loot.id].slot === 1 && !p.inv.primary), crate: !!it.crate })),
      hint: hintItem ? name(hintItem.loot) : '',
      me: { x: p.pos.x, z: p.pos.z, yaw: p.yaw },
      buildings: this.arena.buildings
    };
  }

  /** Inventory (Tab) and map (M) screens release the mouse like the buy menu. */
  public brToggle(screen: 'inv' | 'map', open?: boolean) {
    if (this.mode !== 'br') return;
    const next = open ?? (screen === 'inv' ? !this.invOpen : !this.mapOpen);
    if (screen === 'inv') {
      this.invOpen = next;
      if (next) this.mapOpen = false;
    } else {
      this.mapOpen = next;
      if (next) this.invOpen = false;
    }
    const ui = this.invOpen || this.mapOpen;
    if (ui && document.pointerLockElement === this.renderer.domElement) {
      this.unlocking = true;
      document.exitPointerLock();
    } else if (!ui && !this.paused && this.active()) this.lock();
    this.emit();
  }

  /* ───────────────────────── HUD snapshot ───────────────────────── */

  private emit() {
    const p = this.player;
    const w = activeWeapon(p.inv);
    const viewer = this.viewTarget() ?? p;
    const shopOpen = this.buyOpen && this.canBuy(p);
    const slots: GameSnapshot['slots'] = [];
    ([1, 2, 3] as SlotNo[]).forEach((s) => {
      const sw = s === 1 ? p.inv.primary : s === 2 ? p.inv.secondary : p.inv.knife;
      if (sw) slots.push({ slot: s, id: sw.id, name: WEAPONS[sw.id].name, active: p.inv.active === s });
    });
    p.inv.grenades.forEach((g) => slots.push({ slot: 4, id: g, name: WEAPONS[g].name, active: p.inv.active === 4 && p.inv.grenade?.id === g }));
    const near = p.alive ? this.nearestPickup(p, 2.2) : null;
    this.onState({
      phase: this.phase,
      paused: this.paused,
      loaded: this.model.ready,
      round: this.round,
      score: { ...this.score },
      timer: Math.max(0, Math.ceil(this.timer)),
      buyLeft: Math.max(0, Math.ceil(ROUND.freeze + ROUND.buy - (this.now - this.roundAt))),
      canBuy: this.canBuy(p),
      buyOpen: shopOpen,
      shop: shopOpen
        ? SHOP.map((item) => ({ item, name: item === 'kevlar' ? 'Giáp' : item === 'helmet' ? 'Giáp + Mũ' : WEAPONS[item].name, price: itemPrice(item, p.inv), block: buyBlock(item, p.inv, p.money, p.team) }))
        : [],
      health: Math.max(0, Math.round(p.health)),
      armor: p.inv.armor,
      helmet: p.inv.helmet,
      money: p.money,
      alive: p.alive,
      team: p.team,
      weapon: w ? { id: w.id, name: WEAPONS[w.id].name, ammo: w.ammo, reserve: w.reserve, reloading: w.reloadLeft > 0, mag: WEAPONS[w.id].magazine } : null,
      slots,
      killfeed: this.killfeed.filter((k) => this.now - k.t < 7),
      killConfirm: (() => {
        const recent = [...this.killfeed].reverse().find((k) => k.killer === p.name && this.now - k.t < 1.5);
        return recent ? { id: recent.id, headshot: recent.headshot } : null;
      })(),
      rows: this.agents.map((a) => ({ id: a.id, name: a.name, team: a.team, kills: a.kills, deaths: a.deaths, assists: a.assists, hs: a.headshots, mvps: a.mvps, money: a.money, alive: a.alive, me: a.isPlayer })),
      message: this.now < this.messageUntil ? this.message : '',
      banner: this.phase === 'roundEnd' ? this.banner : null,
      matchWinner: this.phase === 'matchEnd' ? this.matchWinner : null,
      radar: {
        me: { x: viewer.pos.x, z: viewer.pos.z, yaw: viewer.yaw },
        allies: this.agents.filter((a) => allied(a, p) && a !== viewer && a !== p).map((a) => ({ x: a.pos.x, z: a.pos.z, alive: a.alive })),
        enemies: this.agents.filter((a) => !allied(a, p) && a.alive && a.spottedUntil > this.now).map((a) => ({ x: a.pos.x, z: a.pos.z }))
      },
      hurt: this.hurtDirs.map((h) => THREE.MathUtils.radToDeg(-angleDiff(anglesTo(p.pos, h.from)[0], p.yaw))),
      pickup: near && this.mode === 'cs' ? WEAPONS[near.w.id].name : '',
      spectating: !p.alive && viewer !== p ? viewer.name : '',
      killedBy: p.alive ? '' : this.killedBy,
      scoreboard: this.mode === 'cs' && this.keys.has('scoreboard'),
      scope: p.alive && w && WEAPONS[w.id].scope ? w.zoom : 0,
      thirdPerson: this.thirdPerson,
      aiming: this.playerAim.view.shoulder > 0.5,
      ads: this.playerAim.view.ads > 0.5,
      alive5: {
        CT: this.agents.filter((a) => a.team === 'CT').map((a) => a.alive),
        T: this.agents.filter((a) => a.team === 'T').map((a) => a.alive)
      },
      mode: this.mode,
      br: this.royaleSnapshot()
    });
  }

  public dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    this.removers.forEach((remove) => remove());
    this.resizeObserver.disconnect();
    if (document.pointerLockElement === this.renderer.domElement) document.exitPointerLock();
    this.rig.dispose();
    this.model.dispose();
    this.vm.dispose();
    this.effects.dispose();
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

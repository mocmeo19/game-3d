import { configureRenderer, getRenderSettings } from '../../settings/renderSettings';
import * as THREE from 'three';
import { CharacterState } from '../../types/character';
import { CharacterModel } from '../../renderer/CharacterModel';
import { skillsFor } from '../../renderer/character/skills';
import { sound } from '../../audio/soundManager';
import {
  afterArmor, BAG_SIZE, campRoster, CHAMPION, ENEMIES, EnemyDef, EnemyKind, Gear, gainXp, Item, itemTitle, monsterDamage, monsterHp, monsterXp, playerStats, POTION, RARITIES, rollDamage,
  rollDrops, rollItem, salvageYield, seedItemIds, sellValue, Slot, Stats, tryEnhance, xpToNext
} from './torchRules';
import {
  BASIC, bind, learn, learnPassive, newBook, PassiveId, passiveBonus, setRune, SkillBook, SkillId, SkillRuntime, skillRuntime, SKILLS, SKILL_LIST, SLOT_KEYS
} from './torchSkills';
import { BOUND, buildWorld, FORGE, FOUNTAIN, paintTerrain, TERRAIN_EXTENT, TOWN_REACH, World } from './torchScene';
import { Camp, inVillage, levelAt, SPAWN, ZONES, zoneAt, ZoneId } from './torchWorld';
import { clearSave, loadSave, TorchSave, writeSave } from './torchSave';
import { makeMonster, Monster3D } from './monsters';

/**
 * Torchlight-style open world: a top-down camera follows the character from the village through four zones of monster camps.
 * Dead monsters drop gold, potions, essence and gear of five rarities; gear is kept in a bag, worn by hand and enhanced at the forge.
 * The hero's own skills are learned, ranked, runed and bound by the player (torchSkills.ts). Progress is saved in the browser.
 */

export type Panel = 'bag' | 'skills' | null;

export interface TorchSnapshot {
  phase: 'menu' | 'playing' | 'dead';
  paused: boolean;
  loaded: boolean;
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  level: number;
  xp: number;
  xpNext: number;
  gold: number;
  essence: number;
  kills: number;
  zone: { id: ZoneId; name: string; level: number };
  inTown: boolean;
  nearForge: boolean;
  nearFountain: boolean;
  banner: string;
  /** The five bound skills (null when a slot is empty). */
  bar: { slot: number; key: string; id: SkillId | null; name: string; icon: string; cost: number; cd: number; left: number; rank: number }[];
  basic: { name: string; icon: string };
  potions: { hp: number; mp: number; hpLeft: number; mpLeft: number };
  gear: Gear;
  bag: Item[];
  stats: Stats;
  book: SkillBook;
  shield: number;
  recall: number;
  toasts: { id: number; text: string; color: string }[];
  boss: { name: string; hp: number; max: number } | null;
  hover: { name: string; level: number; hp: number; max: number; champion: boolean } | null;
  hurt: number;
  panel: Panel;
  bigMap: boolean;
  /** A save of this hero exists (shown on the start screen). */
  save: { level: number; savedAt: number } | null;
}

interface Enemy {
  id: number;
  kind: EnemyKind;
  def: EnemyDef;
  name: string;
  level: number;
  champion: boolean;
  scale: number;
  hp: number;
  maxHp: number;
  dmg: number;
  speed: number;
  radius: number;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  yaw: number;
  mesh: Monster3D;
  bar: THREE.Group;
  fill: THREE.Mesh;
  cd: number;
  attackT: number;
  attackDur: number;
  hitDone: boolean;
  stun: number;
  walk: number;
  moving: number;
  flash: number;
  spawnT: number;
  dying: number;
  /** Where it lives, whether it is after the hero and whether it is walking back home. */
  home: THREE.Vector3;
  run: CampRun;
  aggro: boolean;
  returning: boolean;
  wanderT: number;
  wander: THREE.Vector3;
  slow: { t: number; k: number };
  burn: { t: number; dps: number; tick: number };
  /** boss only */
  slamCd: number;
  slamT: number;
  slamAt: THREE.Vector3;
  chargeCd: number;
  charge: number;
  chargeDir: THREE.Vector3;
}

interface CampRun {
  camp: Camp;
  active: boolean;
  alive: number;
  respawnAt: number;
}

interface Projectile {
  mesh: THREE.Mesh;
  pos: THREE.Vector3;
  dir: THREE.Vector3;
  speed: number;
  left: number;
  radius: number;
  dmg: number;
  level: number;
  friendly: boolean;
  crit: boolean;
  hit: Set<number>;
  trail: number;
  /** Status effects a friendly bolt brings along. */
  fx?: HitFx;
}

interface Fx {
  obj: THREE.Object3D;
  mat?: THREE.Material;
  tex?: THREE.Texture;
  geo?: THREE.BufferGeometry;
  life: number;
  max: number;
  update?: (k: number) => void;
}

interface Loot {
  mesh: THREE.Object3D;
  kind: 'gold' | 'hp' | 'mp' | 'gear' | 'essence';
  amount: number;
  item?: Item;
  phase: number;
  age: number;
  dispose: () => void;
}

/** What a skill hit does besides damage. */
interface HitFx {
  knock: number;
  stun: number;
  slow: number;
  burn: number;
  vamp: number;
}
const PLAIN: HitFx = { knock: 0.8, stun: 0, slow: 0, burn: 0, vamp: 0 };

const RAD = Math.PI / 180;
const CAM = new THREE.Vector3(0, 13, 9.6);
const PLAYER_R = 0.45;
const ACTIVATE = 55;
const DEACTIVATE = 88;
const LEASH = 36;
const easeOut = (k: number) => 1 - (1 - k) * (1 - k);
const tmp = new THREE.Vector3();
const angleBetween = (a: number, b: number) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));

export class TorchEngine {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly world: World;
  private readonly model: CharacterModel;
  private readonly classSkills: string[];
  private readonly saveName: string;
  private readonly resizeObserver: ResizeObserver;
  private readonly removers: (() => void)[] = [];
  private readonly ray = new THREE.Raycaster();
  private readonly camps: CampRun[];

  // shared geometry and materials for the effects
  private readonly ringGeo = new THREE.RingGeometry(0.86, 1, 56).rotateX(-Math.PI / 2);
  private readonly slashGeo = new THREE.RingGeometry(0.5, 1, 28, 1, -1.15, 2.3).rotateX(-Math.PI / 2);
  private readonly ballGeo = new THREE.SphereGeometry(1, 12, 8);
  private readonly barGeo = new THREE.PlaneGeometry(1, 1);
  private readonly barBg = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.65, depthTest: false });
  private readonly barFill = new THREE.MeshBasicMaterial({ color: 0xd8382c, depthTest: false });
  private readonly barBoss = new THREE.MeshBasicMaterial({ color: 0xffa028, depthTest: false });
  private readonly barChamp = new THREE.MeshBasicMaterial({ color: 0xe8c43a, depthTest: false });
  private readonly coinGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.06, 14);
  private readonly coinMat = new THREE.MeshStandardMaterial({ color: 0xffd34a, emissive: 0x806000, metalness: 0.8, roughness: 0.3 });
  private readonly potGeo = new THREE.SphereGeometry(0.2, 12, 8);
  private readonly gemGeo = new THREE.OctahedronGeometry(0.3);
  private readonly beamGeo = new THREE.CylinderGeometry(0.1, 0.18, 3.2, 8, 1, true);
  private readonly discGeo = new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2);
  private readonly boltGeo = new THREE.CylinderGeometry(0.07, 0.2, 14, 6);
  private readonly beamLineGeo = new THREE.CylinderGeometry(0.06, 0.06, 1, 5).rotateX(Math.PI / 2);
  private readonly essenceMat = new THREE.MeshStandardMaterial({ color: 0x9fe8ff, emissive: 0x3aa8e8, emissiveIntensity: 1.2, roughness: 0.2 });

  private phase: TorchSnapshot['phase'] = 'menu';
  private paused = false;
  private disposed = false;
  private frame = 0;
  private last = performance.now();
  private now = 0;
  private emitT = 0;
  private audio: AudioContext | null = null;
  private audioOutput: GainNode | null = null;
  private unsubscribeAudio = sound.subscribeSettings(() => {
    if (this.audio && this.audioOutput) this.audioOutput.gain.setTargetAtTime(sound.getEffectsLevel(), this.audio.currentTime, 0.025);
  });

  private readonly pos = new THREE.Vector3();
  private yaw = 0;
  private stats: Stats;
  private level = 1;
  private xp = 0;
  private hp = 0;
  private mp = 0;
  private gold = 0;
  private essence = 0;
  private kills = 0;
  private gear: Gear = {};
  private bag: Item[] = [];
  private book: SkillBook = newBook();
  private potions = { hp: POTION.start, mp: POTION.start, hpLeft: 0, mpLeft: 0 };
  private cd: Partial<Record<SkillId | 'basic', number>> = {};
  private lockT = 0;
  private combo = 0;
  private moveTo: THREE.Vector3 | null = null;
  private target: Enemy | null = null;
  private leap: { from: THREE.Vector3; to: THREE.Vector3; t: number; dur: number; arc: number } | null = null;
  private timers: { t: number; fn: () => void }[] = [];
  private speedNow = 0;
  private deadT = 0;
  private hurtAt = 0;
  private shake = 0;
  private panel: Panel = null;
  private bigMap = false;
  private zoom = 1;
  private lowManaAt = -9;
  private shield: { amount: number; max: number; t: number; mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial } | null = null;
  private recallT = 0;
  private saveT = 10;
  private zone: ZoneId = 'village';
  private campT = 0;
  private fountainAt = -9;
  private readonly camPos = new THREE.Vector3();
  private readonly camLook = new THREE.Vector3();

  private enemies: Enemy[] = [];
  private projectiles: Projectile[] = [];
  private fx: Fx[] = [];
  private loot: Loot[] = [];
  private seq = 0;
  private toasts: { id: number; text: string; color: string; t: number }[] = [];
  private bannerText = '';
  private bannerT = 0;

  private keys = new Set<string>();
  private mouse = [false, false, false];
  private pointer = new THREE.Vector2(0, 0);
  private hoverEnemy: Enemy | null = null;
  private cursor = new THREE.Vector3();

  private minimap: HTMLCanvasElement | null = null;
  private mapTex: HTMLCanvasElement | null = null;

  constructor(private readonly host: HTMLDivElement, state: CharacterState, private readonly onState: (s: TorchSnapshot) => void) {
    this.renderer = new THREE.WebGLRenderer({ antialias: getRenderSettings().antialias, powerPreference: 'high-performance' });
    configureRenderer(this.renderer, 1.5);
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    host.appendChild(this.renderer.domElement);

    this.saveName = state.name?.trim() || 'Hero';
    this.world = buildWorld();
    this.camps = this.world.camps.map((camp) => ({ camp, active: false, alive: 0, respawnAt: 0 }));
    this.camera = new THREE.PerspectiveCamera(36, 1, 0.5, 260);

    this.model = new CharacterModel({ ...state, pose: 'idle' });
    this.model.setWeaponsVisible(true);
    this.world.scene.add(this.model.group);
    this.classSkills = skillsFor(state.characterClass).map((s) => s.id);

    this.stats = playerStats(1, this.gear);
    this.hp = this.stats.maxHp;
    this.mp = this.stats.maxMp;
    this.pos.set(SPAWN.x, 0, SPAWN.z);
    this.yaw = Math.PI;
    this.snapCamera();

    this.bindInput();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(host);
    this.resize();
    this.loop(this.last);
  }

  /* ───────────────────────── public controls ───────────────────────── */

  /** Start the game: carry on with the saved hero, or begin a new journey (which replaces the save). */
  public start(fresh = false) {
    if (!this.model.ready) return;
    if (this.phase === 'menu' || this.phase === 'dead') this.newRun(fresh);
    this.paused = false;
    this.last = performance.now();
    void this.audioCtx()?.resume();
    this.emit();
  }

  public pause() {
    if (this.phase !== 'playing' || this.paused) return;
    this.paused = true;
    this.keys.clear();
    this.mouse = [false, false, false];
    this.save();
    this.emit();
  }

  public resume() {
    if (this.phase !== 'playing') return;
    this.paused = false;
    this.last = performance.now();
    this.emit();
  }

  public setPanel(p: Panel) {
    this.panel = this.panel === p ? null : p;
    this.emit();
  }

  public toggleMap() {
    this.bigMap = !this.bigMap;
    this.emit();
  }

  /** The canvas the minimap is drawn into (null to stop drawing). */
  public setMinimap(canvas: HTMLCanvasElement | null) {
    this.minimap = canvas;
  }

  public usePotion(kind: 'hp' | 'mp') {
    if (this.phase !== 'playing' || this.paused) return;
    const left = kind === 'hp' ? this.potions.hpLeft : this.potions.mpLeft;
    if (left > 0 || this.potions[kind] <= 0) return;
    if (kind === 'hp' ? this.hp >= this.stats.maxHp : this.mp >= this.stats.maxMp) return;
    this.potions[kind]--;
    if (kind === 'hp') {
      this.hp = Math.min(this.stats.maxHp, this.hp + this.stats.maxHp * POTION.hpHeal);
      this.potions.hpLeft = POTION.cooldown;
    } else {
      this.mp = Math.min(this.stats.maxMp, this.mp + this.stats.maxMp * POTION.mpHeal);
      this.potions.mpLeft = POTION.cooldown;
    }
    this.tone(kind === 'hp' ? 520 : 420, 0.25, 'sine', 0.07, 260);
    this.ring(this.pos, 1.6, kind === 'hp' ? '#ff5a5a' : '#5a8aff', 0.5, 0.3);
    this.emit();
  }

  /** Channel a return to the village (3 s); moving, casting or being hit breaks it. */
  public recall() {
    if (this.phase !== 'playing' || this.paused || this.recallT > 0) return;
    if (inVillage(this.pos.x, this.pos.z)) {
      this.toast('Bạn đã ở trong làng.', '#9ac8ff');
      return;
    }
    this.recallT = 0.001;
    this.toast('Đang trở về làng… đứng yên 3 giây.', '#9ac8ff');
    this.emit();
  }

  /** Wake up in the village after falling (a tenth of the gold stays behind). */
  public respawn() {
    if (this.phase !== 'dead') return;
    const lost = Math.floor(this.gold * 0.1);
    this.gold -= lost;
    this.phase = 'playing';
    this.pos.set(SPAWN.x, 0, SPAWN.z);
    this.hp = this.stats.maxHp;
    this.mp = this.stats.maxMp;
    this.moveTo = null;
    this.target = null;
    this.deadT = 0;
    this.model.group.rotation.set(0, 0, 0);
    this.snapCamera();
    this.toast(lost ? `Bạn tỉnh dậy ở làng, mất ${lost} vàng.` : 'Bạn tỉnh dậy ở làng.', '#ffe28a');
    this.save();
    this.emit();
  }

  /* ----- gear ----- */

  private recalc() {
    const ratio = this.stats && this.stats.maxHp ? this.hp / this.stats.maxHp : 1;
    this.stats = playerStats(this.level, this.gear, passiveBonus(this.book));
    this.hp = Math.min(this.stats.maxHp, Math.max(1, this.stats.maxHp * ratio));
    this.mp = Math.min(this.mp, this.stats.maxMp);
  }

  private changed() {
    this.recalc();
    this.save();
    this.emit();
  }

  public equip(itemId: number) {
    const i = this.bag.findIndex((x) => x.id === itemId);
    if (i < 0) return;
    const item = this.bag[i];
    const worn = this.gear[item.slot];
    this.gear[item.slot] = item;
    if (worn) this.bag[i] = worn;
    else this.bag.splice(i, 1);
    this.tone(640, 0.12, 'triangle', 0.05, 200);
    this.changed();
  }

  public unequip(slot: Slot) {
    const it = this.gear[slot];
    if (!it) return;
    if (this.bag.length >= BAG_SIZE) {
      this.toast('Túi đã đầy.', '#ff9a7a');
      return;
    }
    delete this.gear[slot];
    this.bag.push(it);
    this.changed();
  }

  private requireTown(): boolean {
    if (inVillage(this.pos.x, this.pos.z)) return true;
    this.toast('Chỉ làm được trong làng.', '#ff9a7a');
    return false;
  }

  /** Find an item by id in the bag or on the body. */
  private find(id: number): { item: Item; slot?: Slot; index: number } | null {
    const index = this.bag.findIndex((x) => x.id === id);
    if (index >= 0) return { item: this.bag[index], index };
    for (const [slot, it] of Object.entries(this.gear) as [Slot, Item][]) if (it && it.id === id) return { item: it, slot, index: -1 };
    return null;
  }

  public sell(itemId: number) {
    if (!this.requireTown()) return;
    const i = this.bag.findIndex((x) => x.id === itemId);
    if (i < 0) return;
    const gold = sellValue(this.bag[i]);
    this.gold += gold;
    this.bag.splice(i, 1);
    this.toast(`Bán đồ · +${gold} vàng`, '#ffd34a');
    this.tone(900, 0.08, 'sine', 0.04, 300);
    this.changed();
  }

  public salvage(itemId: number) {
    if (!this.requireTown()) return;
    const i = this.bag.findIndex((x) => x.id === itemId);
    if (i < 0) return;
    const got = salvageYield(this.bag[i]);
    this.essence += got;
    this.bag.splice(i, 1);
    this.toast(`Phân rã · +${got} tinh thạch`, '#9fe8ff');
    this.tone(420, 0.15, 'square', 0.04, -120);
    this.changed();
  }

  /** Sell every plain and magic item in the bag that is not enhanced. */
  public sellJunk() {
    if (!this.requireTown()) return;
    let gold = 0;
    let n = 0;
    this.bag = this.bag.filter((it) => {
      if ((it.rarity === 'common' || it.rarity === 'magic') && it.enhance === 0) {
        gold += sellValue(it);
        n++;
        return false;
      }
      return true;
    });
    if (n) {
      this.gold += gold;
      this.toast(`Bán ${n} món · +${gold} vàng`, '#ffd34a');
      this.tone(900, 0.1, 'sine', 0.05, 300);
    } else this.toast('Không có đồ Thường / Phép để bán.', '#9a9a9a');
    this.changed();
  }

  public enhance(itemId: number) {
    if (!this.requireTown()) return;
    const f = this.find(itemId);
    if (!f) return;
    const wallet = { gold: this.gold, essence: this.essence };
    const res = tryEnhance(f.item, wallet, Math.random);
    this.gold = wallet.gold;
    this.essence = wallet.essence;
    const name = itemTitle(f.item);
    if (res === 'success') {
      this.toast(`Rèn thành công: ${name}`, '#9bff9b');
      this.ring(this.pos, 2.4, '#ffd24a', 0.6, 0.3);
      this.tone(760, 0.3, 'triangle', 0.07, 400);
    } else if (res === 'fail') {
      this.toast(`Rèn thất bại: ${name}`, '#ff8a7a');
      this.tone(140, 0.3, 'sawtooth', 0.06, -60);
    } else if (res === 'poor') this.toast('Không đủ vàng hoặc tinh thạch.', '#ff9a7a');
    else this.toast('Đồ đã đạt cấp rèn tối đa.', '#9a9a9a');
    this.changed();
  }

  /* ----- skills ----- */

  public learnSkill(id: SkillId) {
    if (learn(this.book, id, this.level)) {
      this.tone(600, 0.15, 'triangle', 0.05, 240);
      this.changed();
    }
  }

  public learnTalent(id: PassiveId) {
    if (learnPassive(this.book, id, this.level)) {
      this.tone(600, 0.15, 'triangle', 0.05, 240);
      this.changed();
    }
  }

  public chooseRune(id: SkillId, index: number) {
    if (setRune(this.book, id, index)) this.changed();
  }

  public bindSkill(slot: number, id: SkillId | null) {
    if (bind(this.book, slot, id)) this.changed();
  }

  public dispose() {
    this.unsubscribeAudio();
    this.disposed = true;
    if (this.phase === 'playing' || this.phase === 'dead') this.save();
    cancelAnimationFrame(this.frame);
    this.removers.forEach((r) => r());
    this.resizeObserver.disconnect();
    this.enemies.forEach((e) => this.freeEnemy(e));
    this.fx.forEach((f) => this.freeFx(f));
    this.loot.forEach((l) => l.dispose());
    this.projectiles.forEach((p) => (p.mesh.material as THREE.Material).dispose());
    this.shield?.mat.dispose();
    this.model.dispose();
    this.world.dispose();
    [this.ringGeo, this.slashGeo, this.ballGeo, this.barGeo, this.coinGeo, this.potGeo, this.gemGeo, this.beamGeo, this.discGeo, this.boltGeo, this.beamLineGeo].forEach((g) => g.dispose());
    [this.barBg, this.barFill, this.barBoss, this.barChamp, this.coinMat, this.essenceMat].forEach((m) => m.dispose());
    this.renderer.dispose();
    this.renderer.domElement.remove();
    void this.audio?.close();
  }

  /* ───────────────────────── run setup and saving ───────────────────────── */

  private clearWorldState() {
    this.enemies.forEach((e) => this.freeEnemy(e));
    this.enemies = [];
    this.fx.forEach((f) => this.freeFx(f));
    this.fx = [];
    this.loot.forEach((l) => l.dispose());
    this.loot = [];
    this.projectiles.forEach((p) => {
      p.mesh.removeFromParent();
      (p.mesh.material as THREE.Material).dispose();
    });
    this.projectiles = [];
    this.timers = [];
    this.removeShield();
    for (const c of this.camps) {
      c.active = false;
      c.alive = 0;
      c.respawnAt = 0;
    }
  }

  private newRun(fresh: boolean) {
    this.clearWorldState();
    const save = fresh ? null : loadSave(this.saveName);
    if (fresh) clearSave(this.saveName);
    this.gear = {};
    this.bag = [];
    this.book = newBook();
    this.level = 1;
    this.xp = 0;
    this.gold = 0;
    this.essence = 0;
    this.kills = 0;
    this.potions = { hp: POTION.start, mp: POTION.start, hpLeft: 0, mpLeft: 0 };
    this.pos.set(SPAWN.x, 0, SPAWN.z);
    if (save) {
      this.level = save.level;
      this.xp = save.xp;
      this.gold = save.gold;
      this.essence = save.essence;
      this.kills = save.kills;
      this.gear = save.gear;
      this.bag = save.bag;
      this.book = save.book;
      this.potions.hp = save.potions.hp;
      this.potions.mp = save.potions.mp;
      seedItemIds([...this.bag, ...(Object.values(save.gear) as Item[])]);
      this.pos.set(THREE.MathUtils.clamp(save.pos.x, -BOUND, BOUND), 0, THREE.MathUtils.clamp(save.pos.z, -BOUND, BOUND));
      // never wake up inside a tree
      this.world.resolve(this.pos, PLAYER_R + 0.3);
    }
    // a new hero starts with a plain weapon and armour
    if (!save) {
      this.gear.weapon = rollItem(Math.random, 1, 'common', 'weapon');
      this.gear.armor = rollItem(Math.random, 1, 'common', 'armor');
    }
    this.cd = {};
    this.stats = playerStats(this.level, this.gear, passiveBonus(this.book));
    this.hp = this.stats.maxHp;
    this.mp = this.stats.maxMp;
    this.lockT = 0;
    this.leap = null;
    this.moveTo = null;
    this.target = null;
    this.deadT = 0;
    this.recallT = 0;
    this.toasts = [];
    this.panel = null;
    this.zone = zoneAt(this.pos.x, this.pos.z).id;
    this.banner(save ? `Chào mừng trở lại · ${ZONES[this.zone].name}` : 'Làng Hỏa Đăng · Hành trình bắt đầu', 3);
    this.yaw = Math.PI;
    this.model.group.rotation.set(0, 0, 0);
    this.phase = 'playing';
    this.snapCamera();
    if (!save) this.toast('Mở bảng Kỹ năng (K) và dùng điểm kỹ năng đầu tiên.', '#ffe28a');
    this.save();
  }

  private save() {
    if (this.phase === 'menu') return;
    const data: TorchSave = {
      v: 1,
      level: this.level,
      xp: this.xp,
      gold: this.gold,
      essence: this.essence,
      kills: this.kills,
      gear: this.gear,
      bag: this.bag,
      potions: { hp: this.potions.hp, mp: this.potions.mp },
      book: this.book,
      // a hero that fell wakes up in the village, not in the middle of the fight
      pos: this.phase === 'dead' ? { x: SPAWN.x, z: SPAWN.z } : { x: this.pos.x, z: this.pos.z },
      savedAt: Date.now()
    };
    writeSave(this.saveName, data);
  }

  /* ───────────────────────── input ───────────────────────── */

  private bindInput() {
    const el = this.renderer.domElement;
    const on = (t: EventTarget, type: string, fn: (e: never) => void, opt?: AddEventListenerOptions) => {
      t.addEventListener(type, fn as EventListener, opt);
      this.removers.push(() => t.removeEventListener(type, fn as EventListener, opt));
    };
    on(el, 'contextmenu', (e: MouseEvent) => e.preventDefault());
    on(el, 'mousedown', (e: MouseEvent) => {
      this.mouse[e.button] = true;
      this.setPointer(e);
      void this.audioCtx()?.resume();
    });
    on(window, 'mouseup', (e: MouseEvent) => {
      this.mouse[e.button] = false;
    });
    on(window, 'mousemove', (e: MouseEvent) => this.setPointer(e));
    on(el, 'wheel', (e: WheelEvent) => {
      e.preventDefault();
      this.zoom = Math.max(0.65, Math.min(1.6, this.zoom + e.deltaY * 0.001));
    }, { passive: false });
    on(window, 'keydown', (e: KeyboardEvent) => {
      if (e.repeat) return;
      const typing = (e.target as HTMLElement | null)?.tagName === 'INPUT';
      if (typing) return;
      this.keys.add(e.code);
      if (this.phase !== 'playing') return;
      if (e.code === 'Escape') {
        if (this.panel) this.setPanel(null);
        else if (this.paused) this.resume();
        else this.pause();
        return;
      }
      if (this.paused) return;
      if (e.code === 'Digit1') this.usePotion('hp');
      if (e.code === 'Digit2') this.usePotion('mp');
      if (e.code === 'Tab' || e.code === 'KeyC' || e.code === 'KeyI') {
        e.preventDefault();
        this.setPanel('bag');
      }
      if (e.code === 'KeyK') this.setPanel('skills');
      if (e.code === 'KeyM') this.toggleMap();
      if (e.code === 'KeyH') this.recall();
    });
    on(window, 'keyup', (e: KeyboardEvent) => this.keys.delete(e.code));
    on(window, 'blur', () => this.pause());
  }

  private setPointer(e: MouseEvent) {
    const r = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  }

  private resize() {
    const w = this.host.clientWidth || 1;
    const h = this.host.clientHeight || 1;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  /* ───────────────────────── loop ───────────────────────── */

  private loop = (time: number) => {
    if (this.disposed) return;
    this.frame = requestAnimationFrame(this.loop);
    const dt = Math.max(0, Math.min(0.05, (time - this.last) / 1000));
    this.last = time;
    const running = this.phase === 'playing' && !this.paused;
    if (running) this.step(dt);
    else if (this.phase !== 'playing') this.idleStep(dt);
    this.updateFx(running ? dt : 0);
    this.render(running ? dt : 0);
    this.drawMinimap();
    this.emitT -= dt;
    if (this.emitT <= 0) {
      this.emitT = 0.06;
      this.emit();
    }
  };

  /** Menu / death screens: keep the world alive. */
  private idleStep(dt: number) {
    this.now += dt;
    this.world.update(this.now, dt, this.pos);
    if (this.phase === 'dead') this.deadT += dt;
  }

  private step(dt: number) {
    this.now += dt;
    for (const k of Object.keys(this.cd) as (SkillId | 'basic')[]) this.cd[k] = Math.max(0, (this.cd[k] ?? 0) - dt);
    this.potions.hpLeft = Math.max(0, this.potions.hpLeft - dt);
    this.potions.mpLeft = Math.max(0, this.potions.mpLeft - dt);
    this.lockT = Math.max(0, this.lockT - dt);
    this.hp = Math.min(this.stats.maxHp, this.hp + this.stats.hpRegen * dt);
    this.mp = Math.min(this.stats.maxMp, this.mp + this.stats.mpRegen * dt);

    for (const t of this.timers) t.t -= dt;
    const due = this.timers.filter((t) => t.t <= 0);
    this.timers = this.timers.filter((t) => t.t > 0);
    due.forEach((t) => t.fn());

    this.updateCamps(dt);
    this.updateTown(dt);
    this.updatePointerTargets();
    this.updatePlayer(dt);
    this.updateRecall(dt);
    this.updateShield(dt);
    this.updateProjectiles(dt);
    for (const e of [...this.enemies]) this.updateEnemy(e, dt);
    this.separateEnemies();
    this.updateLoot(dt);
    this.toasts = this.toasts.filter((t) => this.now - t.t < 5.5);
    this.bannerT = Math.max(0, this.bannerT - dt);
    this.shake = Math.max(0, this.shake - dt * 2.5);
    this.world.update(this.now, dt, this.pos);

    const zone = zoneAt(this.pos.x, this.pos.z);
    if (zone.id !== this.zone) {
      this.zone = zone.id;
      this.banner(zone.id === 'village' ? zone.name : `${zone.name} · Cấp ${zone.lvMin}–${zone.lvMax}`, 3);
      this.save();
    }
    this.saveT -= dt;
    if (this.saveT <= 0) {
      this.saveT = 10;
      this.save();
    }
  }

  /* ───────────────────────── village ───────────────────────── */

  private updateTown(dt: number) {
    if (Math.hypot(this.pos.x - FOUNTAIN.x, this.pos.z - FOUNTAIN.z) < TOWN_REACH) {
      const need = this.hp < this.stats.maxHp || this.mp < this.stats.maxMp;
      if (need) {
        this.hp = Math.min(this.stats.maxHp, this.hp + this.stats.maxHp * 0.18 * dt);
        this.mp = Math.min(this.stats.maxMp, this.mp + this.stats.maxMp * 0.25 * dt);
        if (this.now - this.fountainAt > 1.2) {
          this.fountainAt = this.now;
          this.ring(this.pos, 1.4, '#7ad8ff', 0.8, 0.3);
        }
      }
    }
  }

  private updateRecall(dt: number) {
    if (this.recallT <= 0) return;
    const moving = this.keys.has('KeyW') || this.keys.has('KeyA') || this.keys.has('KeyS') || this.keys.has('KeyD') || this.speedNow > 0.1;
    if (moving || this.lockT > 0 || this.leap) {
      this.recallT = 0;
      this.toast('Việc trở về bị gián đoạn.', '#ff9a7a');
      return;
    }
    this.recallT += dt;
    if (Math.floor(this.recallT * 6) !== Math.floor((this.recallT - dt) * 6)) this.ring(this.pos, 1.2 + this.recallT * 0.5, '#9ac8ff', 0.5, 0.4);
    if (this.recallT >= 3) {
      this.recallT = 0;
      this.ring(this.pos, 3, '#9ac8ff', 0.6, 0.3, 0.06, 1);
      this.pos.set(SPAWN.x, 0, SPAWN.z);
      this.moveTo = null;
      this.target = null;
      this.snapCamera();
      this.ring(this.pos, 3, '#ffffff', 0.6, 0.3, 0.06, 1);
      this.tone(520, 0.5, 'sine', 0.07, 520);
      this.save();
    }
  }

  /* ───────────────────────── camps ───────────────────────── */

  private updateCamps(dt: number) {
    this.campT -= dt;
    if (this.campT > 0) return;
    this.campT = 0.3;
    for (const run of this.camps) {
      const d = Math.hypot(run.camp.x - this.pos.x, run.camp.z - this.pos.z);
      if (!run.active) {
        if (d < ACTIVATE && this.now >= run.respawnAt) this.spawnCamp(run);
      } else if (d > DEACTIVATE) this.despawnCamp(run);
    }
  }

  private spawnCamp(run: CampRun) {
    const c = run.camp;
    const roster = campRoster(c, Math.random);
    run.active = true;
    run.alive = roster.length;
    roster.forEach((entry, i) => {
      let x = c.x;
      let z = c.z;
      if (entry.kind !== 'boss') {
        for (let t = 0; t < 10; t++) {
          const a = Math.random() * Math.PI * 2;
          const r = (c.boss ? 4.5 : 1.2) + Math.random() * (c.boss ? 4 : 2.8);
          x = c.x + Math.cos(a) * r;
          z = c.z + Math.sin(a) * r;
          if (!this.world.hits(x, z)) break;
        }
      }
      this.spawnEnemy(entry.kind, entry.champion, run, new THREE.Vector3(x, 0, z), i * 0.06);
    });
  }

  private despawnCamp(run: CampRun) {
    for (const e of this.enemies.filter((x) => x.run === run)) this.removeEnemy(e);
    run.active = false;
    run.alive = 0;
    run.respawnAt = 0;
  }

  /* ───────────────────────── pointer → world ───────────────────────── */

  private updatePointerTargets() {
    this.ray.setFromCamera(this.pointer, this.camera);
    const o = this.ray.ray.origin;
    const d = this.ray.ray.direction;
    if (Math.abs(d.y) > 1e-4) {
      const t = -o.y / d.y;
      if (t > 0) this.cursor.copy(d).multiplyScalar(t).add(o);
    }
    // the enemy under the cursor: the nearest one whose body the ray passes through
    let best: Enemy | null = null;
    let bd = Infinity;
    const sphere = new THREE.Sphere();
    for (const e of this.enemies) {
      if (e.dying > 0) continue;
      const s = e.scale;
      sphere.center.set(e.pos.x, e.mesh.height * s * 0.5, e.pos.z);
      sphere.radius = Math.max(0.8, e.radius * 1.05, e.mesh.height * s * 0.38);
      const hit = this.ray.ray.intersectSphere(sphere, tmp);
      if (hit) {
        const dist = hit.distanceTo(o);
        if (dist < bd) {
          bd = dist;
          best = e;
        }
      }
    }
    this.hoverEnemy = best;
  }

  /* ───────────────────────── player ───────────────────────── */

  private facePoint(p: THREE.Vector3) {
    const dx = p.x - this.pos.x;
    const dz = p.z - this.pos.z;
    if (dx * dx + dz * dz > 1e-4) this.yaw = Math.atan2(dx, dz);
  }

  private updatePlayer(dt: number) {
    // leaping and dashing: the character flies along a path and nothing else is possible
    if (this.leap) {
      const l = this.leap;
      l.t += dt;
      const k = Math.min(1, l.t / l.dur);
      this.pos.lerpVectors(l.from, l.to, easeOut(k));
      this.pos.y = Math.sin(k * Math.PI) * l.arc;
      if (k >= 1) {
        this.pos.y = 0;
        this.leap = null;
      }
      this.speedNow = 7;
      return;
    }

    const fwd = (this.keys.has('KeyW') ? 1 : 0) - (this.keys.has('KeyS') ? 1 : 0);
    const side = (this.keys.has('KeyD') ? 1 : 0) - (this.keys.has('KeyA') ? 1 : 0);

    // bound skills: right button, Q, E, R, F
    if (this.lockT <= 0) {
      if (this.keys.has('KeyQ')) this.cast(1);
      else if (this.keys.has('KeyE')) this.cast(2);
      else if (this.keys.has('KeyR')) this.cast(3);
      else if (this.keys.has('KeyF')) this.cast(4);
      else if (this.mouse[2]) this.cast(0);
    }

    // mouse button: click to move, click an enemy to fight it, hold shift to stand and strike
    if (this.mouse[0] && this.lockT <= 0) {
      if (this.keys.has('ShiftLeft') || this.keys.has('ShiftRight')) {
        this.moveTo = null;
        this.target = null;
        this.facePoint(this.hoverEnemy ? this.hoverEnemy.pos : this.cursor);
        this.basic();
      } else if (this.hoverEnemy) {
        this.target = this.hoverEnemy;
        this.moveTo = null;
      } else {
        this.target = null;
        this.moveTo = this.cursor.clone();
      }
    }
    if (this.target && (this.target.dying > 0 || !this.enemies.includes(this.target))) this.target = null;

    let dir: THREE.Vector3 | null = null;
    if (this.lockT > 0) {
      dir = null;
    } else if (fwd || side) {
      dir = new THREE.Vector3(side, 0, -fwd).normalize();
      this.moveTo = null;
      this.target = null;
    } else if (this.target) {
      const e = this.target;
      const gap = Math.hypot(e.pos.x - this.pos.x, e.pos.z - this.pos.z) - e.radius * 0.6;
      if (gap <= BASIC.range - 0.3) {
        this.facePoint(e.pos);
        this.basic();
      } else dir = new THREE.Vector3(e.pos.x - this.pos.x, 0, e.pos.z - this.pos.z).normalize();
    } else if (this.moveTo) {
      const dx = this.moveTo.x - this.pos.x;
      const dz = this.moveTo.z - this.pos.z;
      if (dx * dx + dz * dz < 0.12) this.moveTo = null;
      else dir = new THREE.Vector3(dx, 0, dz).normalize();
    }

    if (dir) {
      const v = this.stats.speed;
      this.pos.x += dir.x * v * dt;
      this.pos.z += dir.z * v * dt;
      this.yaw = Math.atan2(dir.x, dir.z);
      this.speedNow = v;
    } else this.speedNow = 0;
    this.world.resolve(this.pos, PLAYER_R);
    this.pos.x = THREE.MathUtils.clamp(this.pos.x, -BOUND, BOUND);
    this.pos.z = THREE.MathUtils.clamp(this.pos.z, -BOUND, BOUND);
  }

  private toastLowMana() {
    if (this.now - this.lowManaAt > 1) {
      this.lowManaAt = this.now;
      this.toast('Không đủ năng lượng!', '#7fa8ff');
      this.tone(160, 0.12, 'square', 0.04);
    }
  }

  private basic(): boolean {
    if (this.lockT > 0 || (this.cd.basic ?? 0) > 0 || this.leap) return false;
    this.cd.basic = BASIC.cooldown;
    this.lockT = BASIC.lock;
    const n = Math.max(1, this.classSkills.length);
    const anim = this.classSkills[this.combo++ % n];
    if (anim) this.model.playSkill(anim, BASIC.anim);
    const yaw = this.yaw;
    this.timers.push({ t: BASIC.delay, fn: () => this.basicHit(yaw) });
    return true;
  }

  /** Cast the skill bound to a bar slot. */
  private cast(slot: number): boolean {
    const id = this.book.slots[slot];
    if (!id) return false;
    const def = SKILLS[id];
    const run = skillRuntime(this.book, id, this.stats.cdr);
    if (this.lockT > 0 || (this.cd[id] ?? 0) > 0 || this.leap) return false;
    if (this.mp < run.cost) {
      this.toastLowMana();
      return false;
    }
    this.mp -= run.cost;
    this.cd[id] = run.cooldown;
    this.lockT = def.lock;
    this.moveTo = null;
    this.recallT = 0;

    if (def.kind === 'projectile' || def.kind === 'leap' || def.kind === 'chain' || def.kind === 'dash' || def.kind === 'meteor') this.facePoint(this.cursor);
    const n = Math.max(1, this.classSkills.length);
    const anim = this.classSkills[(SKILL_LIST.indexOf(id) + 1) % n];
    if (anim) this.model.playSkill(anim, def.anim);

    const yaw = this.yaw;
    const from = this.pos.clone();
    const aim = this.cursor.clone();
    const go = (power: number) => this.skillEffect(id, run, yaw, from, aim, power);
    this.timers.push({ t: def.delay, fn: () => go(1) });
    if (run.echo) this.timers.push({ t: def.delay + 0.7, fn: () => go(0.5) });
    return true;
  }

  private statusOf(run: SkillRuntime, knock: number, stun = 0, slow = 0): HitFx {
    return { knock, stun: Math.max(stun, run.stun), slow: Math.max(slow, run.freeze), burn: run.burn, vamp: run.vamp };
  }

  /** What a skill does when its cast lands (also used by the echo rune, with less power). */
  private skillEffect(id: SkillId, run: SkillRuntime, yaw: number, from: THREE.Vector3, aim: THREE.Vector3, power: number) {
    const def = SKILLS[id];
    const mult = run.mult * power;
    switch (def.kind) {
      case 'projectile': {
        this.fireBolt(yaw, run, power);
        this.tone(300, 0.2, 'sawtooth', 0.05, 700);
        break;
      }
      case 'nova': {
        const isNova = id === 'nova';
        this.areaHit(this.pos, run.radius, mult, this.statusOf(run, isNova ? 1.2 : 0.8, isNova ? 1.6 : 0));
        this.ring(this.pos, run.radius, def.color, isNova ? 0.7 : 0.45, 0.6, 0.06, 1);
        this.ring(this.pos, run.radius * 0.65, '#ffffff', 0.35, 0.3);
        if (isNova) this.bolts(this.pos, run.radius, def.color);
        this.shake = Math.max(this.shake, isNova ? 0.8 : 0.25);
        this.tone(isNova ? 70 : 220, isNova ? 0.7 : 0.35, 'sawtooth', isNova ? 0.13 : 0.06, isNova ? 120 : -80);
        break;
      }
      case 'ring': {
        this.areaHit(this.pos, run.radius, mult, this.statusOf(run, 0.5, 0, 0.4));
        this.ring(this.pos, run.radius, def.color, 0.6, 0.5, 0.07, 1);
        this.ring(this.pos, run.radius * 0.7, '#ffffff', 0.45, 0.3);
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * Math.PI * 2;
          this.spark(new THREE.Vector3(this.pos.x + Math.cos(a) * run.radius * 0.8, 0.5, this.pos.z + Math.sin(a) * run.radius * 0.8), '#cfeeff', 0.28, 0.5);
        }
        this.shake = Math.max(this.shake, 0.2);
        this.tone(520, 0.4, 'triangle', 0.06, -300);
        break;
      }
      case 'leap': {
        const to = aim.clone().sub(from);
        to.y = 0;
        const len = Math.min(run.range, to.length());
        to.normalize().multiplyScalar(len).add(from);
        to.x = THREE.MathUtils.clamp(to.x, -BOUND, BOUND);
        to.z = THREE.MathUtils.clamp(to.z, -BOUND, BOUND);
        this.world.resolve(to, PLAYER_R + 0.3);
        const dur = Math.max(0.25, def.delay - 0.1);
        this.leap = { from: this.pos.clone(), to, t: 0, dur, arc: 2.2 };
        this.timers.push({
          t: dur,
          fn: () => {
            this.areaHit(this.pos, run.radius, mult, this.statusOf(run, 1.6, 0.5));
            this.ring(this.pos, run.radius + 0.5, def.color, 0.5, 0.5);
            this.ring(this.pos, (run.radius + 0.5) * 0.5, '#ffffff', 0.3, 0.3);
            this.shake = Math.max(this.shake, 0.5);
            this.tone(90, 0.4, 'triangle', 0.12, -30);
          }
        });
        break;
      }
      case 'dash': {
        const dir = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
        const to = from.clone().addScaledVector(dir, run.range);
        // stop in front of whatever blocks the way
        for (let s = 1; s <= 16; s++) {
          const p = from.clone().addScaledVector(dir, (run.range * s) / 16);
          if (this.world.hits(p.x, p.z, 1.15) || Math.abs(p.x) > BOUND || Math.abs(p.z) > BOUND) {
            to.copy(from).addScaledVector(dir, (run.range * (s - 1)) / 16);
            break;
          }
        }
        const hit = new Set<number>();
        const dur = 0.2;
        this.leap = { from: this.pos.clone(), to, t: 0, dur, arc: 0 };
        const steps = 6;
        for (let s = 0; s <= steps; s++)
          this.timers.push({
            t: (dur * s) / steps,
            fn: () => {
              const c = this.pos;
              this.spark(new THREE.Vector3(c.x, 0.9, c.z), def.color, 0.45, 0.35);
              for (const e of this.enemies) {
                if (e.dying > 0 || hit.has(e.id)) continue;
                if (Math.hypot(e.pos.x - c.x, e.pos.z - c.z) < run.radius + e.radius * 0.6) {
                  hit.add(e.id);
                  this.damageEnemy(e, this.stats.damage * mult, this.statusOf(run, 1.2), c);
                }
              }
            }
          });
        this.tone(640, 0.2, 'sawtooth', 0.06, -380);
        break;
      }
      case 'chain': {
        this.chainLightning(run, mult, def.color);
        break;
      }
      case 'drain': {
        const dealt = this.areaHit(this.pos, run.radius, mult, this.statusOf(run, 0.3));
        const heal = dealt * (0.3 + run.vamp);
        if (heal > 0) {
          this.hp = Math.min(this.stats.maxHp, this.hp + heal);
          this.popup(`+${Math.round(heal)}`, '#7aff9a', this.pos, 2.1, 1.1);
        }
        this.ring(this.pos, run.radius, def.color, 0.5, 0.5, 0.07, 1);
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * Math.PI * 2;
          this.spark(new THREE.Vector3(this.pos.x + Math.cos(a) * run.radius * 0.9, 0.6, this.pos.z + Math.sin(a) * run.radius * 0.9), '#ff4a6a', 0.3, 0.6);
        }
        this.tone(200, 0.5, 'sawtooth', 0.07, -100);
        break;
      }
      case 'guard': {
        this.raiseShield(this.stats.damage * run.mult * 0.55, 6, def.color);
        this.ring(this.pos, run.radius + 1, def.color, 0.5, 0.4, 0.06, 1);
        this.tone(420, 0.4, 'triangle', 0.07, 400);
        break;
      }
      case 'meteor': {
        // a warning ring, then the rock
        const target = aim.clone();
        const dist = Math.hypot(target.x - from.x, target.z - from.z);
        if (dist > run.range) target.copy(from).addScaledVector(target.sub(from).normalize(), run.range);
        target.y = 0;
        const mat = new THREE.MeshBasicMaterial({ color: 0xff5a1a, transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide });
        const warn = new THREE.Mesh(this.ringGeo, mat);
        warn.position.set(target.x, 0.07, target.z);
        warn.scale.setScalar(run.radius);
        this.addFx(warn, 1, (k) => (mat.opacity = 0.3 + Math.sin(k * 30) * 0.25), mat);
        const rockMat = new THREE.MeshBasicMaterial({ color: 0xffb060, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false });
        const rock = new THREE.Mesh(this.ballGeo, rockMat);
        rock.scale.setScalar(0.9);
        rock.position.set(target.x - 6, 22, target.z - 3);
        this.addFx(rock, 1, (k) => {
          rock.position.set(target.x - 6 * (1 - k), 22 * (1 - k * k) + 0.6, target.z - 3 * (1 - k));
          if (Math.random() < 0.6) this.spark(rock.position, '#ff8a2a', 0.5, 0.35);
        }, rockMat);
        this.timers.push({
          t: 1,
          fn: () => {
            this.areaHit(target, run.radius, mult, this.statusOf(run, 1.8, 0.8));
            this.ring(target, run.radius + 0.8, '#ff7a2a', 0.6, 0.6, 0.06, 1);
            this.ring(target, run.radius * 0.5, '#ffffff', 0.4, 0.3);
            this.bolts(target, run.radius * 0.8, '#ffb060');
            this.shake = Math.max(this.shake, 0.9);
            this.tone(60, 0.7, 'sawtooth', 0.15, 80);
          }
        });
        break;
      }
    }
  }

  private raiseShield(amount: number, seconds: number, color: string) {
    this.removeShield();
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(this.ballGeo, mat);
    mesh.scale.setScalar(1.25);
    this.world.scene.add(mesh);
    this.shield = { amount, max: amount, t: seconds, mesh, mat };
    this.toast(`Khiên thần: hấp thụ ${Math.round(amount)} sát thương`, color);
  }

  private removeShield() {
    if (!this.shield) return;
    this.shield.mesh.removeFromParent();
    this.shield.mat.dispose();
    this.shield = null;
  }

  private updateShield(dt: number) {
    const s = this.shield;
    if (!s) return;
    s.t -= dt;
    s.mesh.position.set(this.pos.x, this.pos.y + 1, this.pos.z);
    s.mat.opacity = 0.18 + 0.12 * (s.amount / s.max) + Math.sin(this.now * 8) * 0.03;
    if (s.t <= 0 || s.amount <= 0) {
      this.ring(this.pos, 1.8, '#ffe28a', 0.4, 0.8);
      this.removeShield();
    }
  }

  private chainLightning(run: SkillRuntime, mult: number, color: string) {
    const alive = this.enemies.filter((e) => e.dying <= 0 && e.spawnT <= 0);
    // the first target: the one under the cursor, or the nearest in reach
    let first: Enemy | null = this.hoverEnemy && alive.includes(this.hoverEnemy) && Math.hypot(this.hoverEnemy.pos.x - this.pos.x, this.hoverEnemy.pos.z - this.pos.z) < run.range + 3 ? this.hoverEnemy : null;
    if (!first) {
      let bd = run.range;
      for (const e of alive) {
        const d = Math.hypot(e.pos.x - this.pos.x, e.pos.z - this.pos.z);
        if (d < bd) {
          bd = d;
          first = e;
        }
      }
    }
    if (!first) {
      this.tone(200, 0.1, 'triangle', 0.03, -60);
      return;
    }
    const hit = new Set<number>();
    let prev = new THREE.Vector3(this.pos.x, 1.3, this.pos.z);
    let cur: Enemy | null = first;
    for (let i = 0; i < 5 && cur; i++) {
      hit.add(cur.id);
      const p = new THREE.Vector3(cur.pos.x, cur.mesh.height * cur.scale * 0.55, cur.pos.z);
      this.beam(prev, p, color, i * 0.05);
      const target: Enemy = cur;
      const m = mult * Math.pow(0.85, i);
      this.timers.push({ t: i * 0.05, fn: () => this.damageEnemy(target, this.stats.damage * m, this.statusOf(run, 0.4), target.pos) });
      prev = p;
      let next: Enemy | null = null;
      let bd = run.radius;
      for (const e of alive) {
        if (hit.has(e.id)) continue;
        const d = Math.hypot(e.pos.x - cur.pos.x, e.pos.z - cur.pos.z);
        if (d < bd) {
          bd = d;
          next = e;
        }
      }
      cur = next;
    }
    this.tone(900, 0.25, 'sawtooth', 0.05, -500);
  }

  /** A short bright line between two points (lightning). */
  private beam(a: THREE.Vector3, b: THREE.Vector3, color: string, delay = 0) {
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    const m = new THREE.Mesh(this.beamLineGeo, mat);
    const len = a.distanceTo(b);
    m.position.copy(a).lerp(b, 0.5);
    m.lookAt(b);
    m.scale.set(1, 1, len);
    this.timers.push({
      t: delay,
      fn: () =>
        this.addFx(m, 0.22, (k) => {
          mat.opacity = 0.95 * (1 - k);
          m.scale.x = m.scale.y = 1 + Math.sin(k * 40) * 0.4;
        }, mat)
    });
  }

  private basicHit(yaw: number) {
    const fx = Math.sin(yaw);
    const fz = Math.cos(yaw);
    const mat = new THREE.MeshBasicMaterial({ color: BASIC.color, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const arc = new THREE.Mesh(this.slashGeo, mat);
    arc.position.set(this.pos.x + fx * 0.6, 0.9, this.pos.z + fz * 0.6);
    arc.rotation.y = yaw - Math.PI / 2;
    arc.scale.setScalar(BASIC.radius);
    this.addFx(arc, 0.18, (k) => {
      mat.opacity = 0.8 * (1 - k);
      arc.scale.setScalar(BASIC.radius * (0.8 + k * 0.4));
    }, mat);
    let hits = 0;
    const cands = this.enemies
      .filter((e) => e.dying <= 0)
      .map((e) => ({ e, d: Math.hypot(e.pos.x - this.pos.x, e.pos.z - this.pos.z) - e.radius * 0.6, a: Math.atan2(e.pos.x - this.pos.x, e.pos.z - this.pos.z) }))
      .filter((c) => c.d <= BASIC.range && angleBetween(c.a, yaw) < 80 * RAD)
      .sort((a, b) => a.d - b.d);
    for (const c of cands) {
      if (hits >= 3) break;
      this.damageEnemy(c.e, this.stats.damage * BASIC.mult * (hits ? 0.6 : 1), { ...PLAIN, knock: 0.7 });
      hits++;
    }
    if (hits) {
      this.mp = Math.min(this.stats.maxMp, this.mp + BASIC.mana);
      this.tone(180, 0.1, 'square', 0.05, -60);
    } else this.tone(260, 0.08, 'triangle', 0.025, -80);
  }

  private fireBolt(yaw: number, run: SkillRuntime, power: number) {
    const { amount, crit } = rollDamage(this.stats.damage * run.mult * power, this.stats.crit, Math.random, this.stats.critDmg);
    const mat = new THREE.MeshBasicMaterial({ color: 0xff9a3a, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false });
    const mesh = new THREE.Mesh(this.ballGeo, mat);
    mesh.scale.setScalar(0.38);
    const dir = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    const p = this.pos.clone().addScaledVector(dir, 0.9);
    p.y = 1.1;
    mesh.position.copy(p);
    this.world.scene.add(mesh);
    this.projectiles.push({
      mesh, pos: p, dir, speed: 19, left: run.range, radius: run.radius, dmg: amount, level: this.level, friendly: true, crit, hit: new Set(), trail: 0, fx: this.statusOf(run, 0.6)
    });
  }

  /** Damage everything in a circle with the same status effects; returns the damage dealt. */
  private areaHit(c: THREE.Vector3, radius: number, mult: number, fx: HitFx): number {
    let total = 0;
    for (const e of [...this.enemies]) {
      if (e.dying > 0) continue;
      const d = Math.hypot(e.pos.x - c.x, e.pos.z - c.z) - e.radius * 0.5;
      if (d > radius) continue;
      total += this.damageEnemy(e, this.stats.damage * mult, fx, c);
    }
    return total;
  }

  private damageEnemy(e: Enemy, base: number, fx: HitFx, from: THREE.Vector3 = this.pos): number {
    if (e.dying > 0) return 0;
    const { amount, crit } = rollDamage(base, this.stats.crit, Math.random, this.stats.critDmg);
    this.hurtEnemy(e, amount, crit, fx, from);
    return amount;
  }

  private hurtEnemy(e: Enemy, amount: number, crit: boolean, fx: HitFx, from: THREE.Vector3) {
    if (e.dying > 0) return;
    e.hp -= amount;
    e.flash = 1;
    this.wake(e);
    const away = new THREE.Vector3(e.pos.x - from.x, 0, e.pos.z - from.z);
    if (away.lengthSq() > 1e-4) {
      away.normalize();
      const heavy = e.kind === 'boss' ? 0.2 : e.kind === 'brute' || e.champion ? 0.5 : 1;
      e.vel.addScaledVector(away, fx.knock * 4 * heavy);
    }
    if (fx.stun > 0 && e.kind !== 'boss') e.stun = Math.max(e.stun, fx.stun);
    if (fx.slow > 0) e.slow = { t: 3, k: Math.max(e.slow.t > 0 ? e.slow.k : 0, fx.slow) };
    if (fx.burn > 0) e.burn = { t: 4, dps: Math.max(e.burn.t > 0 ? e.burn.dps : 0, amount * fx.burn), tick: 0 };
    if (fx.vamp > 0) this.hp = Math.min(this.stats.maxHp, this.hp + amount * fx.vamp);
    if (this.stats.lifeSteal > 0) this.hp = Math.min(this.stats.maxHp, this.hp + amount * this.stats.lifeSteal);
    this.popup(`${amount}`, crit ? '#ffd24a' : '#ffffff', e.pos, e.mesh.height * e.scale, crit ? 1.35 : 1);
    this.tone(crit ? 520 : 340, 0.07, 'square', 0.035, -120);
    if (e.hp <= 0) this.killEnemy(e);
  }

  /** A monster that is hurt turns on the hero, and its camp comes with it. */
  private wake(e: Enemy) {
    if (inVillage(this.pos.x, this.pos.z)) return;
    e.aggro = true;
    e.returning = false;
    for (const o of this.enemies) if (o.run === e.run && !o.aggro && Math.hypot(o.pos.x - e.pos.x, o.pos.z - e.pos.z) < 18) o.aggro = true;
  }

  private hurtPlayer(raw: number, level: number) {
    if (this.phase !== 'playing' || this.leap) return;
    let dmg = Math.max(1, Math.round(afterArmor(raw, this.stats.armor, level)));
    this.recallT = 0;
    if (this.shield) {
      const taken = Math.min(this.shield.amount, dmg);
      this.shield.amount -= taken;
      dmg -= taken;
      this.popup(`${Math.round(taken)}`, '#ffe28a', this.pos, 1.9, 0.9);
      if (dmg <= 0) return;
    }
    this.hp -= dmg;
    this.hurtAt = performance.now();
    this.shake = Math.max(this.shake, 0.3);
    this.popup(`${dmg}`, '#ff5a4a', this.pos, 1.9, 1.1);
    this.tone(120, 0.15, 'sawtooth', 0.07, -40);
    if (this.hp <= 0) this.die();
  }

  private die() {
    this.hp = 0;
    this.phase = 'dead';
    this.deadT = 0;
    this.paused = false;
    this.keys.clear();
    this.mouse = [false, false, false];
    this.bannerT = 0;
    this.panel = null;
    this.recallT = 0;
    this.removeShield();
    this.save();
    this.tone(90, 1.2, 'sawtooth', 0.12, -60);
    this.emit();
  }

  /* ───────────────────────── enemies ───────────────────────── */

  private spawnEnemy(kind: EnemyKind, champion: boolean, run: CampRun, pos: THREE.Vector3, delay: number) {
    const def = ENEMIES[kind];
    const zone = ZONES[run.camp.zone];
    const level = run.camp.level + (champion ? 1 : 0);
    const mesh = makeMonster(kind, zone.tint);
    const scale = def.scale * (champion ? CHAMPION.scale : 1);
    mesh.group.scale.setScalar(0.01);
    this.world.scene.add(mesh.group);
    const bar = new THREE.Group();
    const bg = new THREE.Mesh(this.barGeo, this.barBg);
    bg.scale.set(1.3, 0.14, 1);
    const fill = new THREE.Mesh(this.barGeo, kind === 'boss' ? this.barBoss : champion ? this.barChamp : this.barFill);
    fill.scale.set(1.24, 0.1, 1);
    fill.position.z = 0.01;
    bg.renderOrder = 20;
    fill.renderOrder = 21;
    bar.add(bg, fill);
    bar.visible = false;
    this.world.scene.add(bar);
    const hp = Math.round(monsterHp(def, level) * (champion ? CHAMPION.hp : 1));
    const baseName = kind === 'boss' ? zone.names.boss : zone.names[kind] || def.name;
    const e: Enemy = {
      id: ++this.seq, kind, def, name: champion ? `Thủ lĩnh ${baseName}` : baseName, level, champion, scale, hp, maxHp: hp,
      dmg: monsterDamage(def, level) * (champion ? CHAMPION.damage : 1), speed: def.speed * Math.min(1.3, 1 + level * 0.012), radius: def.radius * (champion ? 1.1 : 1),
      pos, vel: new THREE.Vector3(), yaw: Math.random() * 6, mesh, bar, fill, cd: 0.6 + Math.random(), attackT: -1,
      attackDur: kind === 'brute' ? 1.1 : kind === 'boss' ? 1.2 : kind === 'archer' ? 0.9 : 0.75, hitDone: false, stun: 0, walk: Math.random() * 6, moving: 0, flash: 0,
      spawnT: 0.7 + delay, dying: 0, home: pos.clone(), run, aggro: false, returning: false, wanderT: Math.random() * 3, wander: new THREE.Vector3(),
      slow: { t: 0, k: 0 }, burn: { t: 0, dps: 0, tick: 0 }, slamCd: 5, slamT: -1, slamAt: new THREE.Vector3(), chargeCd: 8, charge: 0, chargeDir: new THREE.Vector3()
    };
    this.enemies.push(e);
    if (kind === 'boss' || champion) this.ring(pos, e.radius * 1.6 + 0.6, kind === 'boss' ? '#ff5a2a' : '#ffd24a', 0.7, 0.2);
  }

  private updateEnemy(e: Enemy, dt: number) {
    if (e.dying > 0) {
      e.dying += dt;
      const k = Math.min(1, e.dying / 1.1);
      e.mesh.group.rotation.x = (-Math.PI / 2) * easeOut(Math.min(1, e.dying / 0.35));
      e.mesh.group.position.y = -Math.max(0, k - 0.55) * 1.4;
      e.mesh.group.scale.setScalar(e.scale * Math.max(0.01, 1 - Math.max(0, k - 0.75) * 3));
      e.bar.visible = false;
      if (e.dying >= 1.1) this.removeEnemy(e);
      return;
    }
    e.flash = Math.max(0, e.flash - dt * 5);
    e.mesh.flash(e.flash);
    if (e.spawnT > 0) {
      e.spawnT -= dt;
      e.mesh.group.scale.setScalar(Math.max(0.01, e.scale * (1 - Math.max(0, e.spawnT) / 0.7)));
      this.placeEnemy(e);
      return;
    }
    e.mesh.group.scale.setScalar(e.scale);

    // burning
    if (e.burn.t > 0) {
      e.burn.t -= dt;
      e.burn.tick -= dt;
      if (e.burn.tick <= 0) {
        e.burn.tick = 0.5;
        const n = Math.max(1, Math.round(e.burn.dps * 0.5));
        e.hp -= n;
        this.popup(`${n}`, '#ff8a3a', e.pos, e.mesh.height * e.scale, 0.8);
        e.flash = Math.max(e.flash, 0.4);
        if (e.hp <= 0) {
          this.killEnemy(e);
          return;
        }
      }
    }
    if (e.slow.t > 0) e.slow.t -= dt;
    const speedMul = e.slow.t > 0 ? 1 - e.slow.k : 1;

    // knockback decays
    e.pos.addScaledVector(e.vel, dt);
    e.vel.multiplyScalar(Math.max(0, 1 - dt * 7));
    if (e.stun > 0) {
      e.stun -= dt;
      this.resolveEnemy(e);
      this.placeEnemy(e);
      return;
    }

    const safe = inVillage(this.pos.x, this.pos.z) || this.phase !== 'playing';
    const dx = this.pos.x - e.pos.x;
    const dz = this.pos.z - e.pos.z;
    const dist = Math.hypot(dx, dz);
    const toward = new THREE.Vector3(dx, 0, dz).normalize();

    // waking up, giving up and walking home
    if (!e.aggro && !e.returning && !safe && dist < (e.kind === 'boss' ? 17 : e.def.ranged ? 15 : 11)) {
      e.aggro = true;
      for (const o of this.enemies) if (o.run === e.run && !o.aggro && Math.hypot(o.pos.x - e.pos.x, o.pos.z - e.pos.z) < 16) o.aggro = true;
    }
    const homeDist = Math.hypot(e.pos.x - e.home.x, e.pos.z - e.home.z);
    if (e.aggro && (safe || Math.hypot(this.pos.x - e.home.x, this.pos.z - e.home.z) > LEASH + (e.kind === 'boss' ? 14 : 0))) {
      e.aggro = false;
      e.returning = true;
      e.attackT = -1;
      e.slamT = -1;
      e.charge = 0;
    }
    if (e.returning) {
      e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.12 * dt);
      const to = new THREE.Vector3(e.home.x - e.pos.x, 0, e.home.z - e.pos.z);
      if (homeDist < 1.2) {
        e.returning = false;
        e.hp = e.maxHp;
      } else {
        to.normalize();
        e.pos.addScaledVector(to, e.speed * 1.3 * speedMul * dt);
        e.yaw = Math.atan2(to.x, to.z);
        e.moving = THREE.MathUtils.lerp(e.moving, 1, Math.min(1, dt * 10));
        e.walk += dt * (4 + e.speed * 1.6) * e.moving;
        this.resolveEnemy(e);
        this.placeEnemy(e);
        return;
      }
    }
    if (!e.aggro) {
      // idle: loiter a little around home
      e.wanderT -= dt;
      if (e.wanderT <= 0) {
        e.wanderT = 2 + Math.random() * 3;
        const a = Math.random() * Math.PI * 2;
        const r = Math.random() * 2.6;
        e.wander.set(e.home.x + Math.cos(a) * r, 0, e.home.z + Math.sin(a) * r);
      }
      const wd = Math.hypot(e.wander.x - e.pos.x, e.wander.z - e.pos.z);
      let walking = 0;
      if (wd > 0.5 && e.kind !== 'boss') {
        const to = new THREE.Vector3(e.wander.x - e.pos.x, 0, e.wander.z - e.pos.z).normalize();
        e.pos.addScaledVector(to, e.speed * 0.35 * speedMul * dt);
        e.yaw = Math.atan2(to.x, to.z);
        walking = 1;
      }
      e.moving = THREE.MathUtils.lerp(e.moving, walking * 0.5, Math.min(1, dt * 6));
      e.walk += dt * (4 + e.speed * 1.2) * e.moving;
      this.resolveEnemy(e);
      this.placeEnemy(e);
      return;
    }

    let moveDir: THREE.Vector3 | null = null;
    let moveMul = 1;

    if (e.kind === 'boss') this.bossSpecials(e, dt, dist, toward);

    if (e.charge > 0) {
      e.charge -= dt;
      e.pos.addScaledVector(e.chargeDir, 15 * dt);
      e.yaw = Math.atan2(e.chargeDir.x, e.chargeDir.z);
      if (dist < e.radius * 0.7 + PLAYER_R + 0.4 && e.charge > 0) {
        this.hurtPlayer(e.dmg * 1.5, e.level);
        e.charge = 0;
      }
    } else if (e.slamT >= 0) {
      // telegraphed slam: nothing else until it lands
      e.yaw = Math.atan2(toward.x, toward.z);
    } else if (e.attackT >= 0) {
      const prev = e.attackT;
      e.attackT += dt / e.attackDur;
      e.yaw = Math.atan2(toward.x, toward.z);
      if (!e.hitDone && prev < 0.55 && e.attackT >= 0.55) {
        e.hitDone = true;
        this.enemyStrike(e, dist);
      }
      if (e.attackT >= 1) {
        e.attackT = -1;
        e.cd = e.def.attackCd * (0.85 + Math.random() * 0.3);
      }
    } else {
      e.cd -= dt;
      if (e.def.ranged) {
        if (dist > e.def.attackRange * 0.85) moveDir = toward;
        else if (dist < 6) {
          moveDir = toward.clone().negate();
          moveMul = 0.8;
        }
        if (dist <= e.def.attackRange && e.cd <= 0) this.beginAttack(e);
      } else if (dist > e.def.attackRange * 0.85 + PLAYER_R) moveDir = toward;
      else if (e.cd <= 0) this.beginAttack(e);
      if (moveDir) e.pos.addScaledVector(moveDir, e.speed * moveMul * speedMul * dt);
      e.yaw = Math.atan2(toward.x, toward.z);
    }
    e.moving = THREE.MathUtils.lerp(e.moving, moveDir || e.charge > 0 ? 1 : 0, Math.min(1, dt * 10));
    e.walk += dt * (4 + e.speed * 1.6) * e.moving;
    this.resolveEnemy(e);
    this.placeEnemy(e);
  }

  private beginAttack(e: Enemy) {
    e.attackT = 0;
    e.hitDone = false;
  }

  private enemyStrike(e: Enemy, dist: number) {
    if (e.def.ranged) {
      const dir = new THREE.Vector3(this.pos.x - e.pos.x, 0, this.pos.z - e.pos.z).normalize();
      const mat = new THREE.MeshBasicMaterial({ color: 0x9fe8ff, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false });
      const mesh = new THREE.Mesh(this.ballGeo, mat);
      mesh.scale.set(0.12, 0.12, 0.6);
      const p = e.pos.clone().addScaledVector(dir, 0.8);
      p.y = 1.3;
      mesh.position.copy(p);
      mesh.rotation.y = Math.atan2(dir.x, dir.z);
      this.world.scene.add(mesh);
      this.projectiles.push({ mesh, pos: p, dir, speed: 12.5, left: e.def.attackRange + 6, radius: 0.55, dmg: e.dmg, level: e.level, friendly: false, crit: false, hit: new Set(), trail: 0 });
      this.tone(520, 0.12, 'triangle', 0.03, -200);
      return;
    }
    if (dist <= e.def.attackRange + PLAYER_R + 0.5) {
      this.hurtPlayer(e.dmg, e.level);
      if (e.kind !== 'grunt') this.shake = Math.max(this.shake, 0.35);
    }
    if (e.kind !== 'grunt') {
      const at = e.pos.clone().addScaledVector(new THREE.Vector3(Math.sin(e.yaw), 0, Math.cos(e.yaw)), e.def.attackRange * 0.7);
      this.ring(at, e.def.attackRange * 0.8, '#ffb070', 0.3, 0.3);
    }
  }

  private bossSpecials(e: Enemy, dt: number, dist: number, toward: THREE.Vector3) {
    const R = 5.5;
    if (e.slamT >= 0) {
      e.slamT += dt;
      if (e.slamT >= 1.1) {
        e.slamT = -1;
        e.slamCd = 7 + Math.random() * 2;
        this.ring(e.slamAt, R, '#ff7a2a', 0.5, 0.5, 0.06, 1);
        this.shake = Math.max(this.shake, 0.7);
        this.tone(70, 0.5, 'triangle', 0.15, -20);
        if (Math.hypot(this.pos.x - e.slamAt.x, this.pos.z - e.slamAt.z) < R + PLAYER_R) this.hurtPlayer(e.dmg * 2, e.level);
      }
      return;
    }
    if (e.attackT >= 0 || e.charge > 0) return;
    e.slamCd -= dt;
    e.chargeCd -= dt;
    if (e.slamCd <= 0 && dist < 11) {
      e.slamT = 0;
      e.slamAt.copy(this.pos);
      const mat = new THREE.MeshBasicMaterial({ color: 0xff3a1a, transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide });
      const m = new THREE.Mesh(this.ringGeo, mat);
      m.position.set(e.slamAt.x, 0.07, e.slamAt.z);
      m.scale.setScalar(R);
      const dmat = new THREE.MeshBasicMaterial({ color: 0xff2a10, transparent: true, opacity: 0.18, depthWrite: false });
      const disc = new THREE.Mesh(this.discGeo, dmat);
      disc.position.set(e.slamAt.x, 0.06, e.slamAt.z);
      disc.scale.setScalar(R * 0.3);
      this.addFx(m, 1.1, (k) => {
        mat.opacity = 0.35 + Math.sin(k * 30) * 0.25;
      }, mat);
      this.addFx(disc, 1.1, (k) => {
        dmat.opacity = 0.1 + k * 0.3;
        disc.scale.setScalar(R * (0.3 + 0.7 * k));
      }, dmat);
      this.tone(160, 1.0, 'sawtooth', 0.07, 200);
    } else if (e.chargeCd <= 0 && dist > 6 && dist < 16) {
      e.chargeCd = 10 + Math.random() * 3;
      e.charge = 0.65;
      e.chargeDir.copy(toward);
      this.tone(110, 0.5, 'sawtooth', 0.1, 220);
    }
  }

  private killEnemy(e: Enemy) {
    e.dying = 0.001;
    e.hp = 0;
    this.kills++;
    this.tone(150, 0.25, 'sawtooth', 0.06, -90);
    // a monster far below the hero's level teaches little
    const gap = Math.max(0, this.level - e.level - 4);
    const xp = monsterXp(e.def, e.level) * (e.champion ? CHAMPION.xp : 1) * (1 + this.stats.xpPct) * Math.max(0.1, 1 - gap * 0.12);
    const prog = { level: this.level, xp: this.xp };
    const gained = gainXp(prog, xp);
    this.level = prog.level;
    this.xp = prog.xp;
    this.afterXp(gained);
    const drops = rollDrops(e.kind, e.level, Math.random, { champion: e.champion, goldFind: this.stats.goldFind });
    this.dropLoot('gold', e.pos, drops.gold);
    if (drops.hpPotion) this.dropLoot('hp', e.pos, 1);
    if (drops.mpPotion) this.dropLoot('mp', e.pos, 1);
    if (drops.essence) this.dropLoot('essence', e.pos, drops.essence);
    drops.items.forEach((it) => this.dropLoot('gear', e.pos, 1, it));
    if (e.kind === 'boss') {
      this.ring(e.pos, 7, '#ffd24a', 1, 0.5, 0.06, 1);
      this.shake = 1;
      this.banner(`${e.name} đã bị hạ!`, 3);
    }
    e.run.alive = Math.max(0, e.run.alive - 1);
    if (e.run.alive === 0) {
      e.run.active = false;
      e.run.respawnAt = this.now + (e.run.camp.boss ? 240 : 50);
    }
  }

  private removeEnemy(e: Enemy) {
    this.enemies = this.enemies.filter((x) => x !== e);
    if (this.target === e) this.target = null;
    this.freeEnemy(e);
  }

  private freeEnemy(e: Enemy) {
    e.mesh.group.removeFromParent();
    e.bar.removeFromParent();
    e.mesh.dispose();
  }

  private resolveEnemy(e: Enemy) {
    this.world.resolve(e.pos, e.radius * 0.7);
    e.pos.x = THREE.MathUtils.clamp(e.pos.x, -BOUND, BOUND);
    e.pos.z = THREE.MathUtils.clamp(e.pos.z, -BOUND, BOUND);
  }

  private separateEnemies() {
    const list = this.enemies;
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      if (a.dying > 0) continue;
      for (let j = i + 1; j < list.length; j++) {
        const b = list[j];
        if (b.dying > 0) continue;
        const dx = b.pos.x - a.pos.x;
        const dz = b.pos.z - a.pos.z;
        if (Math.abs(dx) > 3 || Math.abs(dz) > 3) continue;
        const min = (a.radius + b.radius) * 0.7;
        const d2 = dx * dx + dz * dz;
        if (d2 < min * min && d2 > 1e-6) {
          const d = Math.sqrt(d2);
          const push = (min - d) * 0.5;
          const wa = b.kind === 'boss' ? 1 : a.kind === 'boss' ? 0 : 0.5;
          a.pos.x -= (dx / d) * push * 2 * wa;
          a.pos.z -= (dz / d) * push * 2 * wa;
          b.pos.x += (dx / d) * push * 2 * (1 - wa);
          b.pos.z += (dz / d) * push * 2 * (1 - wa);
        }
      }
      // the hero is solid too
      const px = this.pos.x - a.pos.x;
      const pz = this.pos.z - a.pos.z;
      const min = a.radius * 0.7 + PLAYER_R;
      const d2 = px * px + pz * pz;
      if (d2 < min * min && d2 > 1e-6 && !this.leap) {
        const d = Math.sqrt(d2);
        const push = min - d;
        a.pos.x -= (px / d) * push * 0.7;
        a.pos.z -= (pz / d) * push * 0.7;
        this.pos.x += (px / d) * push * 0.3;
        this.pos.z += (pz / d) * push * 0.3;
      }
    }
  }

  private placeEnemy(e: Enemy) {
    e.mesh.group.position.set(e.pos.x, e.mesh.group.position.y * 0, e.pos.z);
    e.mesh.group.rotation.y = e.yaw;
    e.mesh.animate(e.walk, e.moving, e.attackT, this.now + e.id);
    const named = e.kind === 'boss' || e.champion;
    const show = (e.hp < e.maxHp || this.hoverEnemy === e || (named && e.aggro)) && e.kind !== 'boss' && e.dying <= 0 && e.spawnT <= 0;
    e.bar.visible = show;
    if (show) {
      e.bar.position.set(e.pos.x, e.mesh.height * e.scale + 0.45, e.pos.z);
      e.bar.quaternion.copy(this.camera.quaternion);
      e.bar.scale.setScalar(e.kind === 'brute' || e.champion ? 1.5 : 1);
      const k = Math.max(0, e.hp / e.maxHp);
      e.fill.scale.x = 1.24 * k;
      e.fill.position.x = -0.62 * (1 - k);
    }
  }

  /* ───────────────────────── projectiles ───────────────────────── */

  private updateProjectiles(dt: number) {
    for (const p of [...this.projectiles]) {
      const step = p.speed * dt;
      p.pos.addScaledVector(p.dir, step);
      p.left -= step;
      p.mesh.position.copy(p.pos);
      let dead = p.left <= 0 || Math.abs(p.pos.x) > BOUND + 6 || Math.abs(p.pos.z) > BOUND + 6;
      if (!dead && this.world.hits(p.pos.x, p.pos.z, 0.9)) dead = true;
      if (p.friendly) {
        p.trail -= dt;
        if (p.trail <= 0) {
          p.trail = 0.035;
          this.spark(p.pos, '#ff8a2a', 0.22, 0.28);
        }
        for (const e of this.enemies) {
          if (e.dying > 0 || p.hit.has(e.id)) continue;
          if (Math.hypot(e.pos.x - p.pos.x, e.pos.z - p.pos.z) < e.radius * 0.8 + p.radius) {
            p.hit.add(e.id);
            this.hurtEnemy(e, p.dmg, p.crit, p.fx ?? PLAIN, p.pos);
            this.ring(p.pos, 1.1, '#ff8a2a', 0.25, 0.2, 0.9);
          }
        }
      } else if (!this.leap && Math.hypot(this.pos.x - p.pos.x, this.pos.z - p.pos.z) < PLAYER_R + p.radius) {
        this.hurtPlayer(p.dmg, p.level);
        dead = true;
      }
      if (dead) {
        p.mesh.removeFromParent();
        (p.mesh.material as THREE.Material).dispose();
        this.projectiles = this.projectiles.filter((x) => x !== p);
        if (p.friendly) this.ring(p.pos, 1.4, '#ff8a2a', 0.3, 0.3, 0.9);
      }
    }
  }

  /* ───────────────────────── loot ───────────────────────── */

  private dropLoot(kind: Loot['kind'], at: THREE.Vector3, amount: number, item?: Item) {
    const group = new THREE.Group();
    const own: { dispose(): void }[] = [];
    const pos = new THREE.Vector3(at.x + (Math.random() - 0.5) * 2.4, 0, at.z + (Math.random() - 0.5) * 2.4);
    pos.x = THREE.MathUtils.clamp(pos.x, -BOUND, BOUND);
    pos.z = THREE.MathUtils.clamp(pos.z, -BOUND, BOUND);
    group.position.set(pos.x, 0.45, pos.z);
    if (kind === 'gold') {
      const coin = new THREE.Mesh(this.coinGeo, this.coinMat);
      group.add(coin);
      const n = Math.min(4, 1 + Math.floor(amount / 25));
      for (let i = 1; i < n; i++) {
        const c = coin.clone();
        c.position.set((Math.random() - 0.5) * 0.5, 0, (Math.random() - 0.5) * 0.5);
        group.add(c);
      }
    } else if (kind === 'essence') {
      const gem = new THREE.Mesh(this.gemGeo, this.essenceMat);
      gem.scale.set(0.8, 1.2, 0.8);
      group.add(gem);
    } else if (kind === 'hp' || kind === 'mp') {
      const mat = new THREE.MeshStandardMaterial({ color: kind === 'hp' ? 0xe03a3a : 0x3a6ae0, emissive: kind === 'hp' ? 0x701010 : 0x102070, roughness: 0.25 });
      own.push(mat);
      group.add(new THREE.Mesh(this.potGeo, mat));
    } else if (item) {
      const color = new THREE.Color(RARITIES[item.rarity].color);
      const mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.9, roughness: 0.3, metalness: 0.4 });
      const beamMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
      own.push(mat, beamMat);
      group.add(new THREE.Mesh(this.gemGeo, mat));
      const beam = new THREE.Mesh(this.beamGeo, beamMat);
      beam.position.y = 1.4;
      group.add(beam);
      const label = this.labelSprite(item);
      label.sprite.position.y = 1.1;
      group.add(label.sprite);
      own.push(label.mat, label.tex);
    }
    this.world.scene.add(group);
    this.loot.push({ mesh: group, kind, amount, item, phase: Math.random() * 6, age: 0, dispose: () => (group.removeFromParent(), own.forEach((o) => o.dispose())) });
  }

  private updateLoot(dt: number) {
    for (const l of [...this.loot]) {
      l.age += dt;
      const p = l.mesh.position;
      p.y = 0.5 + Math.sin(this.now * 2.5 + l.phase) * 0.12;
      l.mesh.rotation.y += dt * 2;
      const d = Math.hypot(this.pos.x - p.x, this.pos.z - p.z);
      // gold, essence and potions fly to the hero
      if (l.age > 0.5 && l.kind !== 'gear' && d < 4) {
        const k = Math.min(1, dt * 7);
        p.x += (this.pos.x - p.x) * k;
        p.z += (this.pos.z - p.z) * k;
      }
      if (l.age > 0.4 && d < 1.2) this.pickUp(l);
      // loot left behind for good does not pile up: it fades after five minutes
      else if (l.age > 300) {
        l.dispose();
        this.loot = this.loot.filter((x) => x !== l);
      }
    }
  }

  private pickUp(l: Loot) {
    switch (l.kind) {
      case 'gold':
        this.gold += l.amount;
        this.tone(900, 0.07, 'sine', 0.04, 300);
        break;
      case 'essence':
        this.essence += l.amount;
        this.toast(`Nhặt ${l.amount} tinh thạch`, '#9fe8ff');
        this.tone(800, 0.12, 'sine', 0.05, 300);
        break;
      case 'hp':
        this.potions.hp = Math.min(POTION.max, this.potions.hp + 1);
        this.toast('Nhặt bình máu', '#ff7a7a');
        this.tone(500, 0.1, 'sine', 0.05, 200);
        break;
      case 'mp':
        this.potions.mp = Math.min(POTION.max, this.potions.mp + 1);
        this.toast('Nhặt bình năng lượng', '#7a9aff');
        this.tone(500, 0.1, 'sine', 0.05, 200);
        break;
      case 'gear': {
        const it = l.item!;
        const col = RARITIES[it.rarity].color;
        if (!this.gear[it.slot]) {
          this.gear[it.slot] = it;
          this.recalc();
          this.toast(`Trang bị: ${it.name} (${RARITIES[it.rarity].name})`, col);
        } else if (this.bag.length < BAG_SIZE) {
          this.bag.push(it);
          this.toast(`Nhặt: ${it.name} (${RARITIES[it.rarity].name})`, col);
        } else {
          const gold = sellValue(it);
          this.gold += gold;
          this.toast(`Túi đầy · bán ${it.name} +${gold} vàng`, '#9a9a9a');
        }
        this.ring(this.pos, 1.5, col, 0.5, 0.3);
        this.tone(it.rarity === 'legend' || it.rarity === 'epic' ? 880 : 700, 0.2, 'triangle', 0.06, 300);
        break;
      }
    }
    l.dispose();
    this.loot = this.loot.filter((x) => x !== l);
  }

  private afterXp(gained: number) {
    if (!gained) return;
    this.book.points += gained;
    this.recalc();
    this.hp = this.stats.maxHp;
    this.mp = this.stats.maxMp;
    this.toast(`Lên cấp ${this.level}! +${gained} điểm kỹ năng (K)`, '#ffe28a');
    this.ring(this.pos, 3, '#ffe28a', 0.8, 0.4, 0.06, 1);
    this.ring(this.pos, 2, '#ffffff', 0.6, 0.2);
    this.tone(523, 0.5, 'triangle', 0.08, 520);
    this.save();
  }

  /* ───────────────────────── effects ───────────────────────── */

  private addFx(obj: THREE.Object3D, life: number, update?: (k: number) => void, mat?: THREE.Material, tex?: THREE.Texture, geo?: THREE.BufferGeometry) {
    if (!obj.parent) this.world.scene.add(obj);
    this.fx.push({ obj, mat, tex, geo, life, max: life, update });
  }

  private freeFx(f: Fx) {
    f.obj.removeFromParent();
    f.mat?.dispose();
    f.tex?.dispose();
    f.geo?.dispose();
  }

  private updateFx(dt: number) {
    for (const f of [...this.fx]) {
      f.life -= dt;
      const k = 1 - Math.max(0, f.life) / f.max;
      f.update?.(k);
      if (f.life <= 0) {
        this.freeFx(f);
        this.fx = this.fx.filter((x) => x !== f);
      }
    }
  }

  private ring(at: THREE.Vector3, radius: number, color: string, life: number, startR: number, y = 0.06, opacity = 0.9) {
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const m = new THREE.Mesh(this.ringGeo, mat);
    m.position.set(at.x, y, at.z);
    m.scale.setScalar(startR);
    this.addFx(m, life, (k) => {
      m.scale.setScalar(startR + (radius - startR) * easeOut(k));
      mat.opacity = opacity * (1 - k);
    }, mat);
  }

  private spark(at: THREE.Vector3, color: string, size: number, life: number) {
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false });
    const m = new THREE.Mesh(this.ballGeo, mat);
    m.position.set(at.x + (Math.random() - 0.5) * 0.2, at.y, at.z + (Math.random() - 0.5) * 0.2);
    m.scale.setScalar(size);
    this.addFx(m, life, (k) => {
      m.scale.setScalar(Math.max(0.001, size * (1 - k)));
      m.position.y += 0.02;
      mat.opacity = 0.8 * (1 - k);
    }, mat);
  }

  /** Lightning strikes around a point. */
  private bolts(c: THREE.Vector3, radius: number, color: string) {
    for (let i = 0; i < 14; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * radius;
      const x = c.x + Math.cos(a) * r;
      const z = c.z + Math.sin(a) * r;
      const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
      const beam = new THREE.Mesh(this.boltGeo, mat);
      beam.position.set(x, 7, z);
      this.addFx(beam, 0.25 + Math.random() * 0.2, (k) => {
        mat.opacity = 0.9 * (1 - k);
        beam.scale.x = beam.scale.z = 1 - k * 0.6;
      }, mat);
      this.ring(new THREE.Vector3(x, 0, z), 1.2, '#ffffff', 0.3, 0.2);
    }
  }

  private popup(text: string, color: string, at: THREE.Vector3, height: number, size: number) {
    const c = document.createElement('canvas');
    c.width = 160;
    c.height = 72;
    const g = c.getContext('2d')!;
    g.font = `bold ${Math.round(46 * size)}px sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineWidth = 8;
    g.strokeStyle = 'rgba(0,0,0,0.85)';
    g.strokeText(text, 80, 36);
    g.fillStyle = color;
    g.fillText(text, 80, 36);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
    const s = new THREE.Sprite(mat);
    s.scale.set(1.9 * size, 0.85 * size, 1);
    s.position.set(at.x + (Math.random() - 0.5) * 0.6, height, at.z);
    s.renderOrder = 30;
    const vx = (Math.random() - 0.5) * 0.8;
    this.addFx(s, 0.9, (k) => {
      s.position.y += 0.025 * (1 - k);
      s.position.x += vx * 0.01;
      mat.opacity = k < 0.6 ? 1 : 1 - (k - 0.6) / 0.4;
    }, mat, tex);
  }

  private labelSprite(item: Item) {
    const c = document.createElement('canvas');
    c.width = 320;
    c.height = 64;
    const g = c.getContext('2d')!;
    g.font = 'bold 28px sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineWidth = 7;
    g.strokeStyle = 'rgba(0,0,0,0.9)';
    g.strokeText(item.name, 160, 32);
    g.fillStyle = RARITIES[item.rarity].color;
    g.fillText(item.name, 160, 32);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(3.2, 0.64, 1);
    sprite.renderOrder = 25;
    return { sprite, mat, tex };
  }

  /* ───────────────────────── minimap ───────────────────────── */

  /** Draws the map into the canvas the HUD gave us: the area around the hero, or the whole world when the big map is on. */
  private drawMinimap() {
    const cv = this.minimap;
    if (!cv || this.phase !== 'playing') return;
    const g = cv.getContext('2d');
    if (!g) return;
    this.mapTex ??= paintTerrain(256);
    const W = cv.width;
    const range = this.bigMap ? TERRAIN_EXTENT : 62;
    const cx = this.bigMap ? 0 : this.pos.x;
    const cz = this.bigMap ? 0 : this.pos.z;
    const scale = W / (range * 2);
    const px = (x: number) => (x - cx) * scale + W / 2;
    const pz = (z: number) => (z - cz) * scale + W / 2;
    g.clearRect(0, 0, W, W);
    g.save();
    g.beginPath();
    g.arc(W / 2, W / 2, W / 2 - 1, 0, Math.PI * 2);
    g.clip();
    g.fillStyle = '#0a0a0e';
    g.fillRect(0, 0, W, W);
    const T = this.mapTex.width;
    const u0 = ((cx - range + TERRAIN_EXTENT) / (TERRAIN_EXTENT * 2)) * T;
    const v0 = ((cz - range + TERRAIN_EXTENT) / (TERRAIN_EXTENT * 2)) * T;
    const span = (range * 2 * T) / (TERRAIN_EXTENT * 2);
    g.imageSmoothingEnabled = true;
    g.globalAlpha = 0.9;
    g.drawImage(this.mapTex, u0, v0, span, span, 0, 0, W, W);
    g.globalAlpha = 1;
    // camps: orange, red for a boss, grey while the camp is cleared
    for (const run of this.camps) {
      const c = run.camp;
      const cleared = !run.active && this.now < run.respawnAt;
      g.fillStyle = cleared ? '#777' : c.boss ? '#ff3a2a' : '#ffa23a';
      g.beginPath();
      g.arc(px(c.x), pz(c.z), c.boss ? 4.5 : 2.6, 0, Math.PI * 2);
      g.fill();
      if (c.boss) {
        g.strokeStyle = '#fff';
        g.lineWidth = 1;
        g.stroke();
      }
    }
    g.fillStyle = '#ff5a5a';
    for (const e of this.enemies) {
      if (e.dying > 0) continue;
      g.fillRect(px(e.pos.x) - 1.3, pz(e.pos.z) - 1.3, 2.6, 2.6);
    }
    // forge and fountain
    g.fillStyle = '#ffd24a';
    g.fillRect(px(FORGE.x) - 2.5, pz(FORGE.z) - 2.5, 5, 5);
    g.fillStyle = '#7ad8ff';
    g.fillRect(px(FOUNTAIN.x) - 2.5, pz(FOUNTAIN.z) - 2.5, 5, 5);
    // the hero: an arrow towards where it faces
    g.translate(px(this.pos.x), pz(this.pos.z));
    g.rotate(-this.yaw + Math.PI);
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.moveTo(0, -6);
    g.lineTo(4.5, 5);
    g.lineTo(0, 2.5);
    g.lineTo(-4.5, 5);
    g.closePath();
    g.fill();
    g.restore();
    g.strokeStyle = 'rgba(217,178,95,0.9)';
    g.lineWidth = 2;
    g.beginPath();
    g.arc(W / 2, W / 2, W / 2 - 1, 0, Math.PI * 2);
    g.stroke();
  }

  /* ───────────────────────── HUD plumbing ───────────────────────── */

  private banner(text: string, seconds: number) {
    this.bannerText = text;
    this.bannerT = seconds;
  }

  private toast(text: string, color: string) {
    this.toasts.push({ id: ++this.seq, text, color, t: this.now });
    if (this.toasts.length > 6) this.toasts.shift();
  }

  private emit() {
    if (this.disposed) return;
    const boss = this.enemies.find((e) => e.kind === 'boss' && e.aggro && e.dying <= 0);
    const hov = this.hoverEnemy && this.hoverEnemy.dying <= 0 ? this.hoverEnemy : null;
    const zone = zoneAt(this.pos.x, this.pos.z);
    const save = this.phase === 'menu' ? loadSave(this.saveName) : null;
    this.onState({
      phase: this.phase,
      paused: this.paused,
      loaded: this.model.ready,
      hp: Math.ceil(Math.max(0, this.hp)),
      maxHp: Math.round(this.stats.maxHp),
      mp: Math.floor(this.mp),
      maxMp: Math.round(this.stats.maxMp),
      level: this.level,
      xp: this.xp,
      xpNext: xpToNext(this.level),
      gold: this.gold,
      essence: this.essence,
      kills: this.kills,
      zone: { id: zone.id, name: zone.name, level: levelAt(this.pos.x, this.pos.z) },
      inTown: inVillage(this.pos.x, this.pos.z),
      nearForge: Math.hypot(this.pos.x - FORGE.x, this.pos.z - FORGE.z) < TOWN_REACH + 2,
      nearFountain: Math.hypot(this.pos.x - FOUNTAIN.x, this.pos.z - FOUNTAIN.z) < TOWN_REACH,
      banner: this.bannerT > 0 ? this.bannerText : '',
      bar: this.book.slots.map((id, slot) => {
        if (!id) return { slot, key: SLOT_KEYS[slot], id: null, name: '', icon: '', cost: 0, cd: 1, left: 0, rank: 0 };
        const run = skillRuntime(this.book, id, this.stats.cdr);
        return { slot, key: SLOT_KEYS[slot], id, name: SKILLS[id].name, icon: SKILLS[id].icon, cost: run.cost, cd: run.cooldown, left: this.cd[id] ?? 0, rank: this.book.ranks[id] ?? 0 };
      }),
      basic: { name: BASIC.name, icon: BASIC.icon },
      potions: { ...this.potions },
      gear: { ...this.gear },
      bag: [...this.bag],
      stats: this.stats,
      book: { ...this.book, ranks: { ...this.book.ranks }, runes: { ...this.book.runes }, slots: [...this.book.slots], passives: { ...this.book.passives } },
      shield: this.shield ? Math.round(this.shield.amount) : 0,
      recall: this.recallT > 0 ? Math.min(1, this.recallT / 3) : 0,
      toasts: this.toasts.map(({ id, text, color }) => ({ id, text, color })),
      boss: boss ? { name: boss.name, hp: boss.hp, max: boss.maxHp } : null,
      hover: hov ? { name: hov.name, level: hov.level, hp: hov.hp, max: hov.maxHp, champion: hov.champion } : null,
      hurt: this.hurtAt,
      panel: this.panel,
      bigMap: this.bigMap,
      save: save ? { level: save.level, savedAt: save.savedAt } : null
    });
  }

  /* ───────────────────────── camera & render ───────────────────────── */

  private snapCamera() {
    this.camLook.set(this.pos.x, 0.8, this.pos.z);
    this.camPos.copy(this.camLook).addScaledVector(CAM, this.zoom);
  }

  private render(dt: number) {
    // hero
    const anchors = this.model.getAnchors();
    this.model.setYaw(this.yaw);
    // a fallen hero lies on the ground: the model's origin is above the feet, so it comes down as the body tips over
    const tip = this.phase === 'dead' ? easeOut(Math.min(1, this.deadT / 0.6)) : 0;
    this.model.group.position.set(this.pos.x, this.pos.y + THREE.MathUtils.lerp(-anchors.feetY, 0.2, tip), this.pos.z);
    this.model.group.rotation.x = (-Math.PI / 2) * tip;
    this.model.animateGame(dt, { speed: this.speedNow, armed: false, crouch: 0, pitch: 0, airborne: !!this.leap && this.leap.arc > 0, keepWeapons: true });

    // the camera follows with a little lag and shakes after heavy hits (it snaps while the game is not running)
    const follow = dt === 0 ? 1 : 1 - Math.exp(-dt * 7);
    this.camLook.lerp(tmp.set(this.pos.x, 0.8, this.pos.z), follow);
    const want = this.camLook.clone().addScaledVector(CAM, this.zoom);
    this.camPos.lerp(want, dt === 0 ? 1 : 1 - Math.exp(-dt * 9));
    this.camera.position.copy(this.camPos);
    if (this.shake > 0) this.camera.position.add(tmp.set((Math.random() - 0.5) * this.shake * 0.5, (Math.random() - 0.5) * this.shake * 0.5, (Math.random() - 0.5) * this.shake * 0.5));
    this.camera.lookAt(this.camLook);
    this.world.scene.updateMatrixWorld();
    this.renderer.render(this.world.scene, this.camera);
  }

  /* ───────────────────────── sound ───────────────────────── */

  private audioCtx() {
    if (!this.audio) {
      try {
        this.audio = new AudioContext();
        this.audioOutput = this.audio.createGain();
        this.audioOutput.gain.value = sound.getEffectsLevel();
        this.audioOutput.connect(this.audio.destination);
      } catch {
        return null;
      }
    }
    return this.audio;
  }

  private tone(freq: number, dur: number, type: OscillatorType, vol: number, slide = 0) {
    if (sound.getMuted()) return;
    const ctx = this.audioCtx();
    if (!ctx || ctx.state !== 'running') return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slide) osc.frequency.linearRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(this.audioOutput!);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }
}

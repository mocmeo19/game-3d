import type * as THREE from 'three';
import type { CharacterState } from '../../types/character';
import type { Agent } from '../core/agents/agent';
import type { AiWorld } from '../core/agents/ai';
import type { P2 } from '../core/agents/nav';
import type { GameSnapshot } from '../core/engine/snapshotTypes';
import { GameEngine } from '../core/GameEngine';
import { activeWeapon, WEAPONS, type WeaponId, type WeaponState } from '../core/rules';
import { CarJobs, JOB_KINDS, JOB_MAX_M, JOB_MIN_M } from './activities/carJobs';
import { buy, GUN_SHOP, isOwned } from './activities/gunShop';
import { StoreRobberies, STORES } from './activities/storeRobberies';
import { collectBlips } from './cityBlips';
import { CityMenus } from './cityMenus';
import { CITY_CONTROLS, CITY_RULES, type CityAction } from './cityRules';
import type { CityBanner, CityView, MapBlip } from './citySnapshot';
import type { CitySource } from './map/cityAssets';
import { CityMarkers } from './map/cityMarkers';
import { placeNameNear, snapToStreet, type PlaceId } from './map/cityPlaces';
import { buildCityMap, type CityMap } from './map/cityWorld';
import { distance2d, randomStreetPoint, yawToward } from './map/streetSampling';
import { CityNpcs, isHostile } from './npc/cityNpcs';
import { Civilians } from './npc/civilians';
import { civilianLook, gangLook } from './npc/npcLooks';
import { CityGear } from './player/cityGear';
import { PlayerDriving } from './player/playerDriving';
import { CrimeWatch } from './police/crimeWatch';
import { PoliceForce } from './police/policeForce';
import { isSearching, newWanted, reportCrime, setStars, tickWanted, type Crime } from './police/wanted';
import { loadCitySave, writeCitySave } from './story/citySave';
import { HeroRoster } from './story/heroRoster';
import { MissionRunner, type MissionOutcome, type MissionWorld } from './story/missionRunner';
import { PROTAGONIST_ORDER, PROTAGONISTS, isUnlocked, protagonistLook, type ProtagonistId } from './story/protagonists';
import { availableMissions, STORY } from './story/storyMissions';
import { newCarAi } from './vehicles/carDriver';
import { VehicleFleet } from './vehicles/fleet';
import { Traffic } from './vehicles/traffic';
import type { Vehicle } from './vehicles/Vehicle';
import type { VehicleKind } from './vehicles/vehicleSpecs';

export type CityGameSnapshot = GameSnapshot<CityView>;


/** How close (m) to a marker the player stands to use it (the marker's glowing ring is 1.6 m wide). */
const REACH_M = 3;
const CAR_REACH_M = 2.6;
const MAINTAIN_S = 0.25;
const ROUTE_S = 1.5;
const SAVE_S = 30;
const BANNER_S = 4;
const DOWN_S = 4.5;
const WITNESS_M = 45;
const SCARE_M = 40;
const PAINT_PRICE = 300;
const PAINT_REACH_M = 8;
const HOSPITAL_BILL = 0.08;
const BAIL_BILL = 0.1;
const MAX_BILL = 2500;
const GANG_CASH_MIN = 20;
const GANG_CASH_RANGE = 60;
const BOSS_CASH = 500;
const BOSS_HEALTH = 250;
const GANG_SPREAD_MIN_M = 5;
const GANG_SPREAD_MAX_M = 20;
const HORN_HZ = 380;
const WAYPOINT_REACHED_M = 15;
/** At one star the police shoot only if the player fired this recently (s); otherwise they try to arrest. */
const ARREST_ONLY_AFTER_FIRE_S = 8;
const OPEN_VIEW_DIRECTIONS = 16;
const OPEN_VIEW_REACH_M = 60;
/** How often the street markers move to the current marks (s). */
const MARKERS_S = 0.25;

/** The open world: drive and walk the city, take story missions as three protagonists, rob shops, run from the police. */
export class CityEngine extends GameEngine<CityMap, CityView, CityAction> {
  private readonly menus: CityMenus;
  private readonly npcs: CityNpcs;
  private readonly fleet: VehicleFleet;
  private readonly traffic: Traffic;
  private readonly civilians: Civilians;
  private readonly police: PoliceForce;
  private readonly wanted = newWanted();
  private readonly gear: CityGear;
  private readonly driving: PlayerDriving;
  private readonly missions: MissionRunner;
  private readonly robberies = new StoreRobberies();
  private readonly jobs = new CarJobs();
  private readonly crimes = new CrimeWatch();
  private readonly roster: HeroRoster;
  private readonly guardPosts = new Map<Agent, P2>();
  private readonly bosses = new WeakSet<Agent>();
  private readonly random = Math.random;
  private banner: CityBanner | null = null;
  private bannerUntil = 0;
  private waypoint: P2 | null = null;
  private route: P2[] = [];
  private routeAt = 0;
  private firedAt = -99;
  private down: { kind: 'wasted' | 'busted'; until: number } | null = null;
  private progress: CityView['progress'] = null;
  private maintainAt = 0;
  private saveAt = SAVE_S;
  private frameDt = 1 / 60;
  private readonly mapBounds: CityView['mapBounds'];
  private readonly mapImageUrl: string;
  private readonly markers: CityMarkers;
  private markersAt = -1;

  constructor(host: HTMLDivElement, private readonly baseLook: CharacterState, source: CitySource, onState: (s: CityGameSnapshot) => void, sensitivity = 1) {
    const menus = new CityMenus();
    super({ buildMap: (renderer) => buildCityMap(renderer, source), rules: CITY_RULES, controls: CITY_CONTROLS, menus }, host, baseLook, onState, sensitivity);
    this.menus = menus;
    this.npcs = new CityNpcs(this.ctx);
    this.fleet = new VehicleFleet(this.arena);
    this.traffic = new Traffic(this.arena, this.fleet, () => this.ctx.agents, this.random);
    this.civilians = new Civilians(this.arena, this.npcs, this.random);
    this.police = new PoliceForce(this.arena, this.fleet, this.traffic, this.npcs, this.random, (a, b) => this.combat.canSee(a, b));
    this.gear = new CityGear(() => this.player.inv);
    this.player.gear = this.gear;
    this.driving = new PlayerDriving(this.arena, this.gear);
    this.missions = new MissionRunner(this.missionWorld());
    this.roster = new HeroRoster(loadCitySave(), (id) => this.place(id));
    const { grid } = source.ground;
    this.mapImageUrl = source.mapImageUrl;
    this.mapBounds = { x0: grid.originX, z0: grid.originZ, x1: grid.maxX, z1: grid.maxZ };
    this.markers = new CityMarkers(this.arena.scene, (x, z) => this.arena.groundAt(x, z));
    this.boot();
  }

  /* ───────────────────────── controls from the HUD ───────────────────────── */

  public switchHero(id: ProtagonistId) {
    const reason = this.switchBlocked(id);
    if (reason) {
      this.ctx.say(reason, 2.5);
      return;
    }
    this.roster.store(this.player);
    this.applyHero(id);
    this.closeMenu();
    this.showBanner('info', PROTAGONISTS[id].name, PROTAGONISTS[id].role);
    this.save();
  }

  public buyItem(id: string) {
    const item = GUN_SHOP.find((i) => i.id === id);
    if (!item || this.menus.open !== 'shop') return;
    const hero = this.roster.current;
    const result = buy(item, this.player.inv, hero.money);
    if (result.ok) {
      hero.money = result.money;
      this.sfx.cue('buy');
      this.save();
    } else this.sfx.cue('deny');
    this.ctx.say(result.message, 2);
  }

  public setWaypoint(at: P2 | null) {
    this.waypoint = at ? snapToStreet(this.arena.ground, at, true) : null;
    this.routeAt = 0;
    this.emit();
  }

  public toggleMenu(menu: 'map' | 'wheel', open?: boolean) {
    const next = open ?? this.menus.open !== menu;
    this.menus.open = next ? menu : 'none';
    this.releasePointerForMenu(this.menus.anyOpen);
    this.emit();
  }

  public closeMenu() {
    this.menus.closeAll();
    this.releasePointerForMenu(false);
    this.emit();
  }

  /* ───────────────────────── game hooks ───────────────────────── */

  protected startMatch() {
    this.clearBattlefield();
    this.missions.fail('');
    this.police.clear();
    this.npcs.clear();
    this.traffic.clear();
    for (const v of [...this.fleet.vehicles]) this.fleet.remove(v);
    this.driving.vehicle = null;
    this.gear.isDriving = false;
    setStars(this.wanted, 0, null);
    this.ctx.phase = 'live';
    this.ctx.liveAt = this.ctx.now;
    this.applyHero(this.roster.active);
    const hero = PROTAGONISTS[this.roster.active];
    this.showBanner('info', 'Thành phố Thiên Lộc', `${hero.name} · ${hero.role}`);
  }

  protected stepRules(dt: number) {
    const ctx = this.ctx;
    const p = this.player;
    this.frameDt = dt;
    if (this.down) {
      if (ctx.now >= this.down.until) this.recover();
      return false;
    }
    if (this.driving.vehicle?.isWrecked) this.driving.eject(p);
    this.driving.steer(this.input.keys);
    this.traffic.drive(ctx.now, dt);
    this.fleet.step(dt, performance.now() / 1000, ctx.agents, (v, victim, dmg) => this.runOver(v, victim, dmg));
    this.fleet.writeSolids(this.arena.solids);
    this.driving.follow(p);
    this.watchCrimes();
    const report = this.police.update(dt, p, this.wanted, this.firedAt, ctx.now);
    if (tickWanted(this.wanted, dt, report.seen, p.pos)) ctx.say('Đã cắt đuôi cảnh sát', 2.5);
    this.progress = report.bust > 0 ? { label: 'Đang bị bắt…', share: report.bust } : null;
    if (report.bust >= 1) this.goDown('busted');
    this.runMission(dt);
    this.runActivities(dt);
    this.maintainAt -= dt;
    if (this.maintainAt <= 0) {
      this.maintainAt = MAINTAIN_S;
      this.civilians.maintain(p.pos, ctx.now);
      this.traffic.maintain(p.pos);
    }
    this.saveAt -= dt;
    if (this.saveAt <= 0) this.save();
    return false;
  }

  protected stepWorld() {
    if (this.ctx.now - this.routeAt > ROUTE_S) this.planRoute();
    if (this.banner && this.ctx.now > this.bannerUntil) this.banner = null;
  }

  protected afterBotsThink() {
    if (!this.down && !this.driving.isDriving) return;
    const input = this.player.input;
    input.f = input.r = 0;
    input.fire = input.alt = false;
  }

  protected thinkBot(bot: Agent, world: AiWorld, dt: number) {
    if (this.npcs.roleOf(bot) === 'civilian') this.civilians.think(bot, this.ctx.now, dt);
    else super.thinkBot(bot, world, dt);
  }

  protected afterDeath(victim: Agent, attacker: Agent) {
    if (victim.isPlayer) {
      this.goDown('wasted');
      return;
    }
    this.civilians.scare(victim.pos, SCARE_M, this.ctx.now);
    if (!attacker.isPlayer) return;
    const role = this.npcs.roleOf(victim);
    if (role === 'civilian') this.crime('murder');
    else if (role === 'police') this.crime('copKill');
    else if (role === 'gang') this.pay(this.bosses.has(victim) ? BOSS_CASH : Math.round(GANG_CASH_MIN + this.random() * GANG_CASH_RANGE));
  }

  protected leaveGear() {}

  /** A weapon taken out of the inventory is simply gone: the city has no pick-ups. */
  protected placeDroppedWeapon(_a: Agent, _w: WeaponState) {}

  protected canAimWith(w: WeaponState) {
    return !this.driving.isDriving && !this.down && w.reloadLeft <= 0 && this.player.onGround;
  }

  protected handleGameKey(action: CityAction) {
    if (this.menus.open === 'wheel' && (action === 'slot1' || action === 'slot2' || action === 'slot3')) {
      this.switchHero(PROTAGONIST_ORDER[Number(action.slice(4)) - 1]);
      return true;
    }
    switch (action) {
      case 'interact':
        this.interaction()?.run();
        return true;
      case 'switchHero':
        this.toggleMenu('wheel');
        return true;
      case 'map':
        this.toggleMenu('map');
        return true;
      case 'skip':
        this.missions.skipLine();
        return true;
      case 'horn':
        if (this.driving.isDriving) {
          this.sfx.click(HORN_HZ, 0.3);
          this.civilians.scare(this.player.pos, 12, this.ctx.now);
        }
        return true;
      case 'jump':
        return this.driving.isDriving;
      default:
        return this.driving.isDriving && action.startsWith('slot');
    }
  }

  protected closeOpenMenu() {
    if (!this.menus.anyOpen) return false;
    this.closeMenu();
    return true;
  }

  protected aiGoals(): Pick<AiWorld, 'objective' | 'climbs' | 'isHostile'> {
    return {
      climbs: [],
      objective: (a) => (this.npcs.roleOf(a) === 'police' ? this.police.objective(a, this.wanted) : this.guardPosts.get(a) ?? { x: a.pos.x, z: a.pos.z }),
      isHostile: (a, e) => isHostile(this.npcs.roleOf(a), e, this.npcs.roleOf(e), this.shootingStars(e)),
    };
  }

  /**
   * The stars the police act on against `target`: at one star they come to arrest the player and hold their fire unless the
   * player has been shooting; from two stars they shoot on sight.
   */
  private shootingStars(target: Agent) {
    const stars = this.wanted.stars;
    if (!target.isPlayer || stars !== 1) return stars;
    return this.ctx.now - this.firedAt < ARREST_ONLY_AFTER_FIRE_S ? stars : 0;
  }

  protected placeGameCamera(_target: Agent, camera: THREE.PerspectiveCamera) {
    if (!this.driving.isDriving) return false;
    this.driving.placeCamera(this.player, camera, this.ctx.now, this.frameDt);
    return true;
  }

  protected updateWorldView(camera: THREE.Vector3, timeS: number) {
    this.markers.animate(timeS);
    if (timeS - this.markersAt < MARKERS_S) return;
    this.markersAt = timeS;
    this.markers.place(this.blips(), camera);
  }

  protected onPause() {
    this.menus.closeAll();
  }

  /* ───────────────────────── the player ───────────────────────── */

  private applyHero(id: ProtagonistId) {
    const p = this.player;
    this.roster.apply(p, id, (x, z) => this.arena.groundAt(x, z));
    if (!this.arena.isStreet(p.pos.x, p.pos.z)) {
      const safe = snapToStreet(this.arena.ground, p.pos);
      p.pos.set(safe.x, this.arena.groundAt(safe.x, safe.z), safe.z);
    }
    p.alive = true;
    p.onGround = true;
    p.yaw = this.openestYaw(p.pos);
    this.restyleCharacter(protagonistLook(this.baseLook, id));
    this.resetPlayerStance();
  }

  /** The view direction down the longest open stretch of street, so the player never starts facing a wall. */
  private openestYaw(at: P2): number {
    let bestYaw = 0;
    let bestRun = -1;
    for (let i = 0; i < OPEN_VIEW_DIRECTIONS; i++) {
      const yaw = (i / OPEN_VIEW_DIRECTIONS) * Math.PI * 2;
      let run = 0;
      while (run < OPEN_VIEW_REACH_M && this.arena.isStreet(at.x - Math.sin(yaw) * (run + 2), at.z - Math.cos(yaw) * (run + 2))) run += 2;
      if (run > bestRun) {
        bestRun = run;
        bestYaw = yaw;
      }
    }
    return bestYaw;
  }

  private switchBlocked(id: ProtagonistId): string {
    if (id === this.roster.active) return 'Bạn đang điều khiển nhân vật này.';
    if (!isUnlocked(id, this.roster.completed)) return 'Nhân vật này chưa xuất hiện trong câu chuyện.';
    if (this.missions.isActive) return 'Không thể đổi nhân vật khi đang làm nhiệm vụ.';
    if (this.wanted.stars) return 'Không thể đổi nhân vật khi đang bị truy nã.';
    if (this.driving.isDriving) return 'Hãy xuống xe trước khi đổi nhân vật.';
    return '';
  }

  private pay(amount: number) {
    this.roster.current.money += amount;
    this.ctx.say(`+${amount.toLocaleString('vi-VN')} $`, 1.5);
  }

  private charge(share: number) {
    const hero = this.roster.current;
    const bill = Math.min(MAX_BILL, Math.round(hero.money * share));
    hero.money -= bill;
    return bill;
  }

  /** Wasted or busted: the screen says so, then the player wakes up at the hospital or walks out of the police station. */
  private goDown(kind: 'wasted' | 'busted') {
    if (this.down) return;
    this.down = { kind, until: this.ctx.now + DOWN_S };
    const failed = this.missions.fail(kind === 'wasted' ? 'Bạn đã gục ngã.' : 'Bạn đã bị bắt.');
    this.jobs.cancel();
    this.closeMenu();
    const subtitle = failed ? `Nhiệm vụ thất bại: ${failed.mission.title}` : '';
    this.showBanner(kind, kind === 'wasted' ? 'GỤC NGÃ' : 'BỊ BẮT', subtitle);
  }

  private recover() {
    const kind = this.down?.kind ?? 'wasted';
    this.down = null;
    this.driving.eject(this.player);
    this.police.clear();
    setStars(this.wanted, 0, null);
    const bill = this.charge(kind === 'wasted' ? HOSPITAL_BILL : BAIL_BILL);
    const at = this.place(kind === 'wasted' ? 'hospital' : 'policeHq');
    const p = this.player;
    p.alive = true;
    p.health = 100;
    p.damageFrom.clear();
    p.blindUntil = p.tagUntil = 0;
    p.vel.set(0, 0, 0);
    p.pos.set(at.x, this.arena.groundAt(at.x, at.z), at.z);
    p.onGround = true;
    this.ctx.killedBy = '';
    this.resetPlayerStance();
    this.ctx.say(kind === 'wasted' ? `Viện phí: ${bill} $` : `Tiền bảo lãnh: ${bill} $`, 4);
    this.save();
  }

  /* ───────────────────────── F: what the player can do here ───────────────────────── */

  private interaction(): { label: string; run: () => void } | null {
    const p = this.player;
    if (!p.alive || this.down) return null;
    if (this.driving.isDriving) return { label: 'Xuống xe', run: () => this.leaveCar() };
    const near = (id: PlaceId) => distance2d(p.pos, this.place(id)) < REACH_M;
    const mission = this.missions.isActive ? null : availableMissions(this.roster.completed).find((m) => near(m.start));
    if (mission) {
      if (mission.protagonist !== this.roster.active) return { label: `Nhiệm vụ của ${PROTAGONISTS[mission.protagonist].name} (Tab để đổi)`, run: () => this.toggleMenu('wheel', true) };
      return { label: `Bắt đầu: ${mission.title}`, run: () => this.beginMission(mission.id) };
    }
    if (near('gunShopWest') || near('gunShopNorth')) return { label: 'Mở tiệm súng', run: () => this.openShop() };
    if (!this.jobs.isActive && !this.missions.isActive && near('jobGarage')) return { label: 'Nhận việc giao xe', run: () => this.takeCarJob() };
    const car = this.fleet.nearestEnterable(p.pos.x, p.pos.z, CAR_REACH_M);
    if (car) return { label: car.driver === 'ai' ? `Cướp xe: ${car.spec.name}` : `Lên xe: ${car.spec.name}`, run: () => this.enterCar(car) };
    return null;
  }

  private enterCar(car: Vehicle) {
    if (car.driver === 'ai') {
      this.traffic.release(car);
      const s = car.state;
      const driver = this.npcs.spawn('civilian', 'Tài xế', civilianLook(this.random), s.x + Math.cos(s.heading) * 2.2, s.z - Math.sin(s.heading) * 2.2, s.heading, null);
      this.civilians.scare(driver.pos, 6, this.ctx.now);
      if (car.spec.kind === 'police' || this.policeNear(this.player.pos)) this.crime('carjack');
    } else if (car.spec.kind === 'police' && !this.missions.isActive) this.crime('carjack');
    this.driving.enter(this.player, car);
  }

  private leaveCar() {
    const own = this.driving.vehicle;
    const inOtherCar = (x: number, z: number) => this.fleet.vehicles.some((v) => v !== own && v.solid.min.x < x && v.solid.max.x > x && v.solid.min.z < z && v.solid.max.z > z);
    const blocked = (x: number, z: number, y: number) => !this.arena.isStreet(x, z) || !!this.arena.terrain.blocksStep?.(x, z, y) || inOtherCar(x, z);
    if (!this.driving.exit(this.player, blocked)) this.ctx.say('Không xuống xe được ở đây.', 1.5);
  }

  private openShop() {
    this.menus.open = 'shop';
    this.releasePointerForMenu(true);
    this.emit();
  }

  private takeCarJob() {
    const at = randomStreetPoint(this.arena, this.place('jobGarage'), JOB_MIN_M, JOB_MAX_M, this.random, true);
    if (!at) {
      this.ctx.say('Chưa có khách đặt xe, thử lại sau.', 2);
      return;
    }
    const kind = JOB_KINDS[Math.floor(this.random() * JOB_KINDS.length)] ?? 'sedan';
    this.jobs.begin(this.fleet.spawn(kind, at.x, at.z, this.random() * Math.PI * 2, this.random));
    this.showBanner('mission', 'Giao xe', 'Tìm chiếc xe được đánh dấu và mang về Bãi giao xe');
  }

  /* ───────────────────────── missions and activities ───────────────────────── */

  private beginMission(id: string) {
    const mission = STORY.find((m) => m.id === id);
    if (!mission) return;
    this.jobs.cancel();
    this.missions.start(mission);
    this.showBanner('mission', mission.title, PROTAGONISTS[mission.protagonist].name);
  }

  private runMission(dt: number) {
    const outcome = this.missions.update(dt);
    if (outcome) this.missionEnded(outcome);
  }

  private missionEnded(outcome: MissionOutcome) {
    if (outcome.kind === 'failed') {
      this.showBanner('failed', 'NHIỆM VỤ THẤT BẠI', outcome.reason);
      return;
    }
    const { mission } = outcome;
    this.roster.completed.add(mission.id);
    this.roster.current.money += mission.reward;
    const joined = PROTAGONIST_ORDER.find((h) => PROTAGONISTS[h].joinsAfter === mission.id);
    const extra = joined ? ` · ${PROTAGONISTS[joined].name} đã tham gia (Tab)` : '';
    this.showBanner('passed', 'NHIỆM VỤ HOÀN THÀNH', `${mission.title} · +${mission.reward.toLocaleString('vi-VN')} $${extra}`);
    this.sfx.cue('win');
    this.save();
  }

  private runActivities(dt: number) {
    const p = this.player;
    const w = activeWeapon(p.inv);
    const armedOnFoot = !this.driving.isDriving && !!w && WEAPONS[w.id].slot <= 2;
    const robbery = this.robberies.update(dt, this.ctx.now, p.pos, armedOnFoot, (id) => this.place(id), this.random);
    if (robbery?.kind === 'progress') this.progress = { label: 'Đang vét két…', share: robbery.share };
    if (robbery?.kind === 'robbed') {
      this.pay(robbery.cash);
      this.crime('robbery');
    }
    const job = this.jobs.update(this.driving.vehicle, this.place('jobGarage'));
    if (job?.kind === 'paid') {
      this.pay(job.cash);
      this.showBanner('passed', 'GIAO XE THÀNH CÔNG', `+${job.cash.toLocaleString('vi-VN')} $`);
      this.save();
    } else if (job?.kind === 'lost') this.showBanner('failed', 'GIAO XE THẤT BẠI', 'Chiếc xe đã bị phá huỷ.');
    this.paintJob();
  }

  /** Driving into the paint shop while wanted and out of police sight loses the stars for a fee. */
  private paintJob() {
    if (!this.driving.isDriving || !isSearching(this.wanted)) return;
    if (distance2d(this.player.pos, this.place('paintShop')) > PAINT_REACH_M) return;
    const hero = this.roster.current;
    if (hero.money < PAINT_PRICE) {
      this.ctx.say(`Sơn xe cần ${PAINT_PRICE} $`, 2);
      return;
    }
    hero.money -= PAINT_PRICE;
    setStars(this.wanted, 0, null);
    this.showBanner('info', 'Sơn xe mới', `Cảnh sát mất dấu bạn · -${PAINT_PRICE} $`);
  }

  /* ───────────────────────── crimes ───────────────────────── */

  private crime(kind: Crime) {
    reportCrime(this.wanted, kind, this.player.pos);
  }

  private policeNear(at: P2) {
    const officer = this.npcs.all('police').some((o) => o.alive && distance2d(o.pos, at) < WITNESS_M);
    return officer || this.fleet.vehicles.some((v) => v.spec.kind === 'police' && v.driver === 'ai' && distance2d(v.state, at) < WITNESS_M);
  }

  private watchCrimes() {
    const p = this.player;
    if (this.crimes.playerFired(p)) {
      this.firedAt = this.ctx.now;
      this.civilians.scare(p.pos, SCARE_M, this.ctx.now);
      const witnessed = this.ctx.agents.some((a) => !a.isPlayer && a.alive && this.npcs.roleOf(a) !== 'gang' && distance2d(a.pos, p.pos) < WITNESS_M);
      if (witnessed && !this.missions.isActive) this.crime('gunfire');
    }
    for (const victim of this.crimes.newVictims(this.ctx.agents, p)) {
      const role = this.npcs.roleOf(victim);
      if (role === 'police') this.crime('copAssault');
      else if (role === 'civilian') this.crime('assault');
    }
  }

  private runOver(vehicle: Vehicle, victim: Agent, damage: number) {
    this.civilians.scare(victim.pos, SCARE_M / 2, this.ctx.now);
    const byPlayer = vehicle.driver === 'player';
    victim.health -= victim.isPlayer ? damage * 0.5 : damage;
    if (byPlayer) victim.damageFrom.set(this.player, (victim.damageFrom.get(this.player) ?? 0) + damage);
    if (victim.health <= 0) this.combat.kill(victim, byPlayer ? this.player : victim, 'knife', false, false);
  }

  /* ───────────────────────── the mission's world ───────────────────────── */

  private missionWorld(): MissionWorld {
    return {
      player: () => this.player,
      playerVehicle: () => this.driving.vehicle,
      place: (id) => this.place(id),
      wantedStars: () => this.wanted.stars,
      raiseWanted: (stars) => setStars(this.wanted, Math.max(this.wanted.stars, stars), this.player.pos),
      spawnGang: (at, count, weapon, boss) => this.spawnGang(at, count, weapon, boss),
      removeNpc: (a) => {
        this.guardPosts.delete(a);
        this.npcs.remove(a);
      },
      spawnMissionVehicle: (kind, at) => this.spawnMissionVehicle(kind, at),
      runAway: (v) => this.traffic.assign(v, newCarAi('flee', randomStreetPoint(this.arena, v.state, 300, 600, this.random, true))),
      giveUp: (v, driverName) => {
        this.traffic.release(v);
        const s = v.state;
        const thug = this.npcs.spawn('gang', driverName, gangLook(this.random), s.x + Math.cos(s.heading) * 2.2, s.z - Math.sin(s.heading) * 2.2, s.heading, 'glock');
        this.guardPosts.set(thug, { x: thug.pos.x, z: thug.pos.z });
      },
      releaseVehicle: (v) => {
        v.isKept = false;
        if (v.driver === 'ai') this.traffic.release(v);
      },
    };
  }

  private spawnGang(at: P2, count: number, weapon: WeaponId, boss: string | undefined): Agent[] {
    const out: Agent[] = [];
    for (let i = 0; i < count; i++) {
      const spot = randomStreetPoint(this.arena, at, GANG_SPREAD_MIN_M, GANG_SPREAD_MAX_M, this.random) ?? at;
      const isBoss = i === 0 && !!boss;
      const a = this.npcs.spawn('gang', isBoss && boss ? boss : 'Rắn Lục', gangLook(this.random), spot.x, spot.z, yawToward(spot, this.player.pos), weapon);
      if (isBoss) {
        a.health = BOSS_HEALTH;
        this.bosses.add(a);
      }
      this.guardPosts.set(a, spot);
      out.push(a);
    }
    return out;
  }

  private spawnMissionVehicle(kind: VehicleKind, at: P2): Vehicle {
    const spot = snapToStreet(this.arena.ground, at, true);
    const v = this.fleet.spawn(kind, spot.x, spot.z, this.random() * Math.PI * 2, this.random);
    v.isKept = true;
    return v;
  }

  /* ───────────────────────── view ───────────────────────── */

  private place(id: PlaceId): P2 {
    return this.arena.places[id];
  }

  private showBanner(kind: CityBanner['kind'], title: string, subtitle: string) {
    this.banner = { id: (this.banner?.id ?? 0) + 1, kind, title, subtitle };
    this.bannerUntil = this.ctx.now + BANNER_S;
  }

  /** Where the GPS points: the waypoint, else the mission's target, else the job's car or the yard. */
  private routeTarget(): P2 | null {
    if (this.waypoint) return this.waypoint;
    const target = this.missions.targets()[0];
    if (target) return target;
    if (this.jobs.vehicle) return this.driving.vehicle === this.jobs.vehicle ? this.place('jobGarage') : this.jobs.vehicle.state;
    return null;
  }

  private planRoute() {
    this.routeAt = this.ctx.now;
    if (this.waypoint && distance2d(this.player.pos, this.waypoint) < WAYPOINT_REACHED_M) this.waypoint = null;
    const target = this.routeTarget();
    this.route = target ? [{ x: this.player.pos.x, z: this.player.pos.z }, ...this.arena.carNav.path(this.player.pos, target)] : [];
  }

  private blips(): MapBlip[] {
    return collectBlips({
      place: (id) => this.place(id),
      missions: availableMissions(this.roster.completed),
      missionActive: this.missions.isActive,
      targets: this.missions.targets(),
      police: this.npcs.all('police'),
      openStores: STORES.filter((s) => this.robberies.isOpen(s, this.ctx.now)),
      jobTarget: this.jobs.vehicle && this.driving.vehicle !== this.jobs.vehicle ? this.jobs.vehicle.state : null,
      waypoint: this.waypoint,
    });
  }

  protected gameView(): CityView {
    const p = this.player;
    const hero = this.roster.current;
    const vehicle = this.driving.vehicle;
    return {
      hero: { id: this.roster.active, name: PROTAGONISTS[this.roster.active].name },
      money: hero.money,
      wanted: { stars: this.wanted.stars, isSearching: isSearching(this.wanted) },
      vehicle: vehicle ? { name: vehicle.spec.name, speedKmh: Math.round(Math.abs(vehicle.state.speed) * 3.6), health: vehicle.health / vehicle.spec.health } : null,
      prompt: this.menus.anyOpen ? '' : this.interaction()?.label ?? '',
      progress: this.progress,
      missionTitle: this.missions.mission?.title ?? '',
      objective: this.missions.objective() || (this.jobs.isActive ? 'Mang chiếc xe được đánh dấu về Bãi giao xe' : ''),
      dialogue: this.missions.dialogue,
      banner: this.banner,
      menu: this.menus.open,
      shop: this.menus.open === 'shop'
        ? { title: 'Tiệm súng', items: GUN_SHOP.map((i) => ({ id: i.id, name: i.name, detail: i.detail, price: i.price, isOwned: isOwned(i, p.inv), canAfford: hero.money >= i.price })) }
        : null,
      heroes: PROTAGONIST_ORDER.map((id) => {
        const isActive = id === this.roster.active;
        const h = isActive ? { money: hero.money, pos: p.pos } : this.roster.hero(id);
        return { id, name: PROTAGONISTS[id].name, role: PROTAGONISTS[id].role, money: h.money, place: placeNameNear(this.arena.places, h.pos.x, h.pos.z), isActive, isUnlocked: isUnlocked(id, this.roster.completed) };
      }),
      me: { x: p.pos.x, z: p.pos.z, yaw: p.yaw },
      blips: this.blips(),
      waypoint: this.waypoint,
      route: this.route,
      placeName: placeNameNear(this.arena.places, p.pos.x, p.pos.z),
      story: { passed: this.roster.completed.size, total: STORY.length },
      mapBounds: this.mapBounds,
      mapImageUrl: this.mapImageUrl,
      isAreaReady: this.arena.scenery.isDrawnAround(p.pos.x, p.pos.z),
    };
  }

  private save() {
    this.saveAt = SAVE_S;
    if (this.player.alive) this.roster.store(this.player);
    if (!writeCitySave(this.roster.toSave())) this.ctx.say('Không lưu được tiến trình trên trình duyệt này.', 3);
  }

  public dispose() {
    if (this.ctx.phase === 'live') this.save();
    this.fleet.dispose();
    this.markers.dispose();
    super.dispose();
  }
}

import type { Agent } from '../../core/agents/agent';
import type { P2 } from '../../core/agents/nav';
import type { WeaponId } from '../../core/rules';
import type { PlaceId } from '../map/cityPlaces';
import { distance2d } from '../map/streetSampling';
import type { Vehicle } from '../vehicles/Vehicle';
import type { VehicleKind } from '../vehicles/vehicleSpecs';
import type { DialogueLine, Mission, MissionStep } from './missionTypes';

/** What a mission needs from the game around it. */
export interface MissionWorld {
  player(): Agent;
  /** The car the player sits in, or null on foot. */
  playerVehicle(): Vehicle | null;
  place(id: PlaceId): P2;
  wantedStars(): number;
  raiseWanted(stars: number): void;
  spawnGang(at: P2, count: number, weapon: WeaponId, boss: string | undefined): Agent[];
  removeNpc(agent: Agent): void;
  spawnMissionVehicle(kind: VehicleKind, at: P2): Vehicle;
  /** A city driver takes the car and runs from the player. */
  runAway(vehicle: Vehicle): void;
  /** The runaway gives up: the car stops and its driver gets out and fights. */
  giveUp(vehicle: Vehicle, driverName: string): void;
  releaseVehicle(vehicle: Vehicle): void;
}

export type MissionOutcome = { kind: 'passed'; mission: Mission } | { kind: 'failed'; mission: Mission; reason: string };

/** Something on the map the mission points at. */
export interface MissionTarget {
  kind: 'objective' | 'enemy' | 'vehicle';
  x: number;
  z: number;
  label: string;
}

const ARRIVE_ON_FOOT_M = 8;
const ARRIVE_IN_CAR_M = 12;
const COLLECT_REACH_M = 2.5;
const DELIVER_SPEED = 6;
/** Gang members wait at their place (and a runaway car stays parked) until the player comes this close (m). */
const ENEMIES_APPEAR_M = 140;
const CHASE_CLOSE_M = 18;
const CHASE_HOLD_S = 6;
const CHASE_LOST_M = 380;
const LINE_BASE_S = 1.8;
const LINE_PER_CHAR_S = 0.045;

/** Runs the story mission being played: one step after another, its conversation, its enemies and cars, pass or fail. */
export class MissionRunner {
  mission: Mission | null = null;
  private stepIndex = 0;
  private lineIndex = 0;
  private lineLeft = 0;
  private enemies: Agent[] = [];
  private enemiesSpawned = false;
  /** The car the mission is about (taken, chased, to deliver); it carries over to the next step. */
  private vehicle: Vehicle | null = null;
  private chaseCloseFor = 0;
  /** The runaway has seen the player coming and is on the move (until then it waits parked, and cannot be lost). */
  private chaseStarted = false;

  constructor(private readonly world: MissionWorld) {}

  get step(): MissionStep | null {
    return this.mission?.steps[this.stepIndex] ?? null;
  }

  get isActive() {
    return this.mission !== null;
  }

  start(mission: Mission) {
    this.mission = mission;
    this.stepIndex = -1;
    this.nextStep();
  }

  /** The line being spoken, or null. */
  get dialogue(): DialogueLine | null {
    const s = this.step;
    return s?.kind === 'talk' ? s.lines[this.lineIndex] ?? null : null;
  }

  /** Skips to the next line of the conversation. */
  skipLine() {
    if (this.step?.kind === 'talk') this.lineLeft = 0;
  }

  /** What to do now, shown at the bottom of the screen. */
  objective(): string {
    const s = this.step;
    if (!s || s.kind === 'talk') return '';
    const inCar = this.world.playerVehicle();
    switch (s.kind) {
      case 'goto':
        return s.inVehicle && !inCar ? `Lên một chiếc xe rồi: ${s.text.toLowerCase()}` : s.text;
      case 'deliver':
        return this.vehicle && inCar !== this.vehicle ? 'Quay lại chiếc xe' : s.text;
      case 'eliminate': {
        const left = this.enemies.filter((e) => e.alive).length;
        return this.enemiesSpawned ? `${s.text} (còn ${left})` : s.text;
      }
      case 'evade':
        return this.world.wantedStars() ? s.text : '';
      default:
        return s.text;
    }
  }

  targets(): MissionTarget[] {
    const s = this.step;
    if (!s || s.kind === 'talk' || s.kind === 'evade') return [];
    if (s.kind === 'eliminate' && this.enemiesSpawned)
      return this.enemies.filter((e) => e.alive).map((e) => ({ kind: 'enemy', x: e.pos.x, z: e.pos.z, label: e.name }));
    if ((s.kind === 'chase' || s.kind === 'takeVehicle' || s.kind === 'deliver') && this.vehicle && this.world.playerVehicle() !== this.vehicle)
      return [{ kind: 'vehicle', x: this.vehicle.state.x, z: this.vehicle.state.z, label: this.vehicle.spec.name }];
    if (s.kind === 'chase') return [];
    const at = this.world.place(s.place);
    return [{ kind: 'objective', x: at.x, z: at.z, label: s.text }];
  }

  /** Advances the mission; returns its outcome on the frame it passes or fails. */
  update(dt: number): MissionOutcome | null {
    const mission = this.mission;
    const s = this.step;
    if (!mission || !s) return null;
    const failure = this.failure(s);
    if (failure) return this.end({ kind: 'failed', mission, reason: failure });
    if (this.isStepDone(s, dt)) {
      this.nextStep();
      if (!this.step) return this.end({ kind: 'passed', mission });
    }
    return null;
  }

  /** The mission fails from outside (the player died or was arrested). */
  fail(reason: string): MissionOutcome | null {
    const mission = this.mission;
    return mission ? this.end({ kind: 'failed', mission, reason }) : null;
  }

  private nextStep() {
    this.stepIndex++;
    this.lineIndex = 0;
    this.chaseCloseFor = 0;
    this.chaseStarted = false;
    this.enemiesSpawned = false;
    this.enemies = [];
    const s = this.step;
    if (!s) return;
    if (s.kind === 'talk') this.lineLeft = lineSeconds(s.lines[0]);
    if (s.kind === 'evade') this.world.raiseWanted(s.stars);
    if (s.kind === 'takeVehicle') this.vehicle = this.world.spawnMissionVehicle(s.vehicle, this.world.place(s.place));
    if (s.kind === 'chase') this.vehicle = this.world.spawnMissionVehicle(s.vehicle, this.world.place(s.place));
  }

  private isStepDone(s: MissionStep, dt: number): boolean {
    const player = this.world.player();
    const inCar = this.world.playerVehicle();
    switch (s.kind) {
      case 'talk':
        this.lineLeft -= dt;
        if (this.lineLeft > 0) return false;
        this.lineIndex++;
        if (this.lineIndex >= s.lines.length) return true;
        this.lineLeft = lineSeconds(s.lines[this.lineIndex]);
        return false;
      case 'goto': {
        if (s.inVehicle && !inCar) return false;
        return distance2d(player.pos, this.world.place(s.place)) < (inCar ? ARRIVE_IN_CAR_M : ARRIVE_ON_FOOT_M);
      }
      case 'takeVehicle':
        return !!this.vehicle && inCar === this.vehicle;
      case 'deliver':
        return !!this.vehicle && inCar === this.vehicle && Math.abs(this.vehicle.state.speed) < DELIVER_SPEED &&
          distance2d(this.vehicle.state, this.world.place(s.place)) < ARRIVE_IN_CAR_M;
      case 'eliminate':
        return this.eliminate(s, player);
      case 'evade':
        return this.world.wantedStars() === 0;
      case 'collect':
        return !inCar && distance2d(player.pos, this.world.place(s.place)) < COLLECT_REACH_M;
      case 'chase':
        return this.chase(s, player, dt);
    }
  }

  private eliminate(s: Extract<MissionStep, { kind: 'eliminate' }>, player: Agent) {
    const at = this.world.place(s.place);
    if (!this.enemiesSpawned) {
      if (distance2d(player.pos, at) > ENEMIES_APPEAR_M) return false;
      this.enemies = this.world.spawnGang(at, s.count, s.weapon, s.boss);
      this.enemiesSpawned = true;
    }
    return this.enemies.every((e) => !e.alive);
  }

  private chase(s: Extract<MissionStep, { kind: 'chase' }>, player: Agent, dt: number) {
    const v = this.vehicle;
    if (!v) return false;
    if (!this.chaseStarted) {
      if (distance2d(player.pos, v.state) > ENEMIES_APPEAR_M) return false;
      this.chaseStarted = true;
      this.world.runAway(v);
    }
    this.chaseCloseFor = distance2d(player.pos, v.state) < CHASE_CLOSE_M ? this.chaseCloseFor + dt : Math.max(0, this.chaseCloseFor - dt * 0.5);
    if (this.chaseCloseFor < CHASE_HOLD_S) return false;
    this.world.giveUp(v, s.driver);
    return true;
  }

  private failure(s: MissionStep): string | null {
    const v = this.vehicle;
    const needsCar = s.kind === 'takeVehicle' || s.kind === 'deliver' || s.kind === 'chase';
    if (needsCar && v?.isWrecked) return 'Chiếc xe đã bị phá huỷ.';
    if (s.kind === 'chase' && v && this.chaseStarted && distance2d(this.world.player().pos, v.state) > CHASE_LOST_M) return 'Đã mất dấu chiếc xe.';
    return null;
  }

  private end(outcome: MissionOutcome): MissionOutcome {
    for (const e of this.enemies) if (e.alive) this.world.removeNpc(e);
    if (this.vehicle) this.world.releaseVehicle(this.vehicle);
    this.enemies = [];
    this.vehicle = null;
    this.mission = null;
    this.stepIndex = 0;
    return outcome;
  }
}

const lineSeconds = (line: DialogueLine | undefined) => (line ? LINE_BASE_S + line.text.length * LINE_PER_CHAR_S : 0);

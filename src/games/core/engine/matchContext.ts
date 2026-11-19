import type * as THREE from 'three';
import { allied, type Agent } from '../agents/agent';
import type { AiWorld } from '../agents/ai';
import type { Effects } from '../effects';
import { groundHeight } from '../rules';
import type { Sfx } from '../sfx';
import type { ShooterMap } from '../world/shooterMap';
import type { HitMarkerKind, KillEvent, Phase } from './snapshotTypes';

/** The game's own screens that free the mouse (the buy menu, the inventory, the big map). */
export interface GameMenus {
  readonly anyOpen: boolean;
  closeAll(): void;
}

/** How a shooter game plays besides its map and its own rules code. */
export interface ShooterRules {
  /** The right button aims guns in the aim style the settings pick (otherwise it aims only while held, and scopes zoom). */
  rightButtonAimsGuns: boolean;
  /** A dead player can watch anyone left (every fighter alone) instead of only teammates. */
  spectateAnyone: boolean;
  /** The camera is kept above the ground (a map with hills). */
  cameraClearsTerrain: boolean;
}

/** What the player's first-person view plays next: the recoil kick, the inspect and knife-swing animations. */
export interface ViewFeedback {
  kick: number;
  inspectAt: number;
  swingAt: number;
  swingHeavy: boolean;
}

/** The state of a match that every part of the engine reads and updates. */
export class MatchContext<TMap extends ShooterMap = ShooterMap> {
  now = 0;
  phase: Phase = 'menu';
  /** When the current round (or the battle royale match) went live. */
  liveAt = 0;
  readonly agents: Agent[] = [];
  heard: AiWorld['heard'] = [];
  hurtDirs: { from: THREE.Vector3; until: number }[] = [];
  killfeed: (KillEvent & { t: number })[] = [];
  killedBy = '';
  /** Which living fighter the dead player watches (counts up on each click). */
  spectate = 0;
  message = '';
  messageUntil = 0;
  readonly feedback: ViewFeedback = { kick: 0, inspectAt: -99, swingAt: -99, swingHeavy: false };
  /** The player's last hit on someone, for the hit marker on the crosshair. */
  lastHit: { id: number; kind: HitMarkerKind; at: number } = { id: 0, kind: 'body', at: -99 };

  constructor(
    readonly arena: TMap,
    readonly rules: ShooterRules,
    readonly menus: GameMenus,
    readonly effects: Effects,
    readonly sfx: Sfx,
    readonly player: Agent,
    private readonly changed: () => void,
  ) {
    this.agents.push(player);
  }

  get solids() {
    return this.arena.solids;
  }

  /** The ground of the map: hills and water on the island, a flat floor on the ship. */
  get terrain() {
    return this.arena.terrain;
  }

  get menuOpen() {
    return this.menus.anyOpen;
  }

  /** Shows a line on the HUD for a few seconds. */
  say(message: string, seconds = 3) {
    this.message = message;
    this.messageUntil = this.now + seconds;
    this.changed();
  }

  /** The player's bullet (or grenade) landed: show the hit marker at once. */
  markHit(kind: HitMarkerKind) {
    this.lastHit = { id: this.lastHit.id + 1, kind, at: this.now };
    this.changed();
  }

  /** Sends the HUD state at once (it is otherwise refreshed ten times a second). */
  notify() {
    this.changed();
  }

  /** Who the camera follows: the player, or a living teammate after death (anyone left when the rules allow it). */
  viewTarget(): Agent | null {
    const p = this.player;
    if (p.alive || this.phase === 'menu') return p;
    const allies = this.agents.filter((a) => a.alive && (this.rules.spectateAnyone || allied(a, p)) && a !== p);
    if (allies.length) return allies[this.spectate % allies.length];
    return this.agents.find((a) => a.alive) ?? p;
  }

  /** Where something dropped comes to rest: on a box top or the ground, sinking to the bed in water. */
  itemFloor(x: number, z: number, y: number, radius: number) {
    return groundHeight(x, z, this.solids, y, radius, this.terrain.heightAt(x, z));
  }
}

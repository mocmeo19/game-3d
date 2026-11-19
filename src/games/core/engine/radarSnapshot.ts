import { allied, type Agent } from '../agents/agent';
import { activeWeapon } from '../rules';
import type { MatchContext } from './matchContext';
import type { RadarFighter, RadarView } from './snapshotTypes';

/** A teammate's blip flashes for this long (s) after each shot. */
const FIRING_FLASH_S = 0.12;
/** An enemy the team lost sight of stays on the radar as a "?" this long (s). */
const LAST_SEEN_S = 3;

const fighterOf = (a: Agent): RadarFighter => ({ x: a.pos.x, y: a.pos.y, z: a.pos.z, yaw: a.yaw });

/** What the radar shows, centred on `viewer` (the player, or the teammate being watched after death). */
export function buildRadarView(ctx: MatchContext, viewer: Agent): RadarView {
  const p = ctx.player;
  // every teammate keeps one colour for the whole match: the slot is their place in the team, ordered by id
  const team = ctx.agents.filter((a) => allied(a, p)).sort((a, b) => a.id - b.id);
  const colorSlotOf = (a: Agent) => Math.max(0, team.indexOf(a));
  const enemies = ctx.agents.filter((a) => !allied(a, p) && a.alive);
  return {
    me: { ...fighterOf(viewer), colorSlot: colorSlotOf(viewer) },
    allies: team
      .filter((a) => a !== viewer)
      .map((a) => ({
        ...fighterOf(a),
        id: a.id,
        colorSlot: colorSlotOf(a),
        alive: a.alive,
        isFiring: a.alive && (activeWeapon(a.inv)?.idle ?? Infinity) < FIRING_FLASH_S,
      })),
    enemies: enemies.filter((a) => a.spottedUntil > ctx.now).map((a) => ({ id: a.id, x: a.pos.x, y: a.pos.y, z: a.pos.z })),
    lastSeen: enemies
      .filter((a) => a.spottedUntil > 0 && a.spottedUntil <= ctx.now && ctx.now - a.spottedUntil < LAST_SEEN_S)
      .map((a) => ({ id: a.id, x: a.spottedPos.x, z: a.spottedPos.z, ageS: ctx.now - a.spottedUntil })),
  };
}

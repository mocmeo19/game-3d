import { Agent } from '../../core/agents/agent';
import { newBrain } from '../../core/agents/ai';
import { BotBody, disposeTree, type BodyLook } from '../../core/models';
import { equip, newWeapon, type Team, type WeaponId } from '../../core/rules';
import type { MatchContext } from '../../core/engine/matchContext';

/** What a person in the city is there for. */
export type NpcRole = 'civilian' | 'police' | 'gang' | 'ally';

/** Fighters on one side share a squad; every passer-by is alone, so nobody counts them as a teammate. */
const SQUAD: Record<Exclude<NpcRole, 'civilian'>, number> = { ally: 0, police: 2, gang: 3 };
const CIVILIAN_SQUAD_BASE = 100;
const TEAM: Record<NpcRole, Team> = { civilian: 'T', police: 'CT', gang: 'T', ally: 'CT' };

let nextNpcId = 1000;

/** The people of the city besides the player: who they are, spawning them with a look and a gun, and removing them. */
export class CityNpcs {
  private readonly roles = new Map<Agent, NpcRole>();

  constructor(private readonly ctx: MatchContext) {}

  spawn(role: NpcRole, name: string, look: BodyLook, x: number, z: number, yaw: number, weapon: WeaponId | null): Agent {
    const id = nextNpcId++;
    const squad = role === 'civilian' ? CIVILIAN_SQUAD_BASE + id : SQUAD[role];
    const agent = new Agent(id, name, TEAM[role], false, squad);
    agent.inv.secondary = null;
    agent.inv.active = 1;
    if (weapon) equip(agent.inv, newWeapon(weapon));
    agent.body = new BotBody(TEAM[role], look);
    agent.brain = newBrain();
    agent.pos.set(x, this.ctx.terrain.heightAt(x, z), z);
    agent.yaw = yaw;
    this.ctx.arena.scene.add(agent.body.group);
    this.ctx.agents.push(agent);
    this.roles.set(agent, role);
    return agent;
  }

  remove(agent: Agent) {
    if (!this.roles.delete(agent)) return;
    const i = this.ctx.agents.indexOf(agent);
    if (i >= 0) this.ctx.agents.splice(i, 1);
    if (agent.body) {
      agent.body.group.removeFromParent();
      disposeTree(agent.body.group);
    }
  }

  /** The role of an agent; the player is told apart by `isPlayer`, so this is 'ally' for them. */
  roleOf(agent: Agent): NpcRole {
    return agent.isPlayer ? 'ally' : this.roles.get(agent) ?? 'civilian';
  }

  all(role: NpcRole): Agent[] {
    const out: Agent[] = [];
    for (const [agent, r] of this.roles) if (r === role) out.push(agent);
    return out;
  }

  count(role: NpcRole) {
    let n = 0;
    for (const r of this.roles.values()) if (r === role) n++;
    return n;
  }

  clear() {
    for (const agent of [...this.roles.keys()]) this.remove(agent);
  }
}

/**
 * Who fights whom: police go after the player only while wanted, and after gangs always; gangs fight the player, the
 * player's crew and the police; nobody picks a fight with passers-by.
 */
export function isHostile(attackerRole: NpcRole, target: Agent, targetRole: NpcRole, wantedStars: number): boolean {
  if (attackerRole === 'civilian' || targetRole === 'civilian') return false;
  if (attackerRole === 'police') return target.isPlayer ? wantedStars > 0 : targetRole === 'gang';
  if (attackerRole === 'gang') return targetRole !== 'gang';
  return targetRole === 'gang';
}

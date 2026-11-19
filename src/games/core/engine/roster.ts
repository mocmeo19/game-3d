import { Agent } from '../agents/agent';
import { newBrain } from '../agents/ai';
import { BotBody, disposeTree } from '../models';
import type { Team } from '../rules';
import type { MatchContext } from './matchContext';

/** A bot to put in the match; fighters share a side when they share a squad (by default their team). */
export interface BotSpec {
  name: string;
  team: Team;
  squad?: number;
}

/** Replaces the bots with the game's lineup. Returns how many fight, the player included. */
export function replaceBots(ctx: MatchContext, bots: readonly BotSpec[]): number {
  for (const a of ctx.agents) {
    if (a.isPlayer || !a.body) continue;
    a.body.group.removeFromParent();
    disposeTree(a.body.group);
  }
  ctx.agents.length = 1;
  ctx.player.squad = 0;
  for (const { name, team, squad } of bots) {
    const bot = new Agent(ctx.agents.length, name, team, false, squad);
    bot.body = new BotBody(team);
    bot.brain = newBrain();
    ctx.arena.scene.add(bot.body.group);
    ctx.agents.push(bot);
  }
  return ctx.agents.length;
}

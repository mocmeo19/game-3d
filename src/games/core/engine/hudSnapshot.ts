import * as THREE from 'three';
import { angleDiff, anglesTo } from '../agents/agent';
import { activeWeapon, WEAPONS, type SlotNo } from '../rules';
import type { MatchContext } from './matchContext';
import { buildRadarView } from './radarSnapshot';
import type { GameSnapshot } from './snapshotTypes';

/** How long (s) a hit marker stays on the crosshair. */
const HIT_MARKER_S = 0.3;

/** What the HUD snapshot reads besides the match context. */
export interface SnapshotSources<TView> {
  paused: boolean;
  /** The player's character model has loaded. */
  loaded: boolean;
  thirdPerson: boolean;
  aimView: { shoulder: number; ads: number };
  /** The part only the game being played fills. */
  view: TView;
}

/** The HUD's view of the match. */
export function buildSnapshot<TView>(ctx: MatchContext, src: SnapshotSources<TView>): GameSnapshot<TView> {
  const p = ctx.player;
  const w = activeWeapon(p.inv);
  const viewer = ctx.viewTarget() ?? p;
  const slots: GameSnapshot<TView>['slots'] = [];
  ([1, 2, 3] as SlotNo[]).forEach((s) => {
    const sw = s === 1 ? p.inv.primary : s === 2 ? p.inv.secondary : p.inv.knife;
    if (sw) slots.push({ slot: s, id: sw.id, name: WEAPONS[sw.id].name, active: p.inv.active === s });
  });
  p.inv.grenades.forEach((g) => slots.push({ slot: 4, id: g, name: WEAPONS[g].name, active: p.inv.active === 4 && p.inv.grenade?.id === g }));
  return {
    phase: ctx.phase,
    paused: src.paused,
    loaded: src.loaded,
    health: Math.max(0, Math.round(p.health)),
    armor: p.inv.armor,
    helmet: p.inv.helmet,
    money: p.money,
    alive: p.alive,
    team: p.team,
    weapon: w ? { id: w.id, name: WEAPONS[w.id].name, ammo: w.ammo, reserve: w.reserve, reloading: w.reloadLeft > 0, mag: WEAPONS[w.id].magazine } : null,
    slots,
    killfeed: ctx.killfeed.filter((k) => ctx.now - k.t < 7),
    killConfirm: (() => {
      const recent = [...ctx.killfeed].reverse().find((k) => k.killer === p.name && ctx.now - k.t < 1.5);
      return recent ? { id: recent.id, headshot: recent.headshot } : null;
    })(),
    hitMarker: ctx.now - ctx.lastHit.at < HIT_MARKER_S ? { id: ctx.lastHit.id, kind: ctx.lastHit.kind } : null,
    rows: ctx.agents.map((a) => ({ id: a.id, name: a.name, team: a.team, kills: a.kills, deaths: a.deaths, assists: a.assists, hs: a.headshots, mvps: a.mvps, money: a.money, alive: a.alive, me: a.isPlayer })),
    message: ctx.now < ctx.messageUntil ? ctx.message : '',
    radar: buildRadarView(ctx, viewer),
    hurt: ctx.hurtDirs.map((h) => THREE.MathUtils.radToDeg(-angleDiff(anglesTo(p.pos, h.from)[0], p.yaw))),
    spectating: !p.alive && viewer !== p ? viewer.name : '',
    killedBy: p.alive ? '' : ctx.killedBy,
    scope: p.alive && w && WEAPONS[w.id].scope ? w.zoom : 0,
    thirdPerson: src.thirdPerson,
    aiming: src.aimView.shoulder > 0.5,
    ads: src.aimView.ads > 0.5,
    alive5: {
      CT: ctx.agents.filter((a) => a.team === 'CT').map((a) => a.alive),
      T: ctx.agents.filter((a) => a.team === 'T').map((a) => a.alive)
    },
    view: src.view,
  };
}

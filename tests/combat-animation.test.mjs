import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';
import { configurationTestStore } from './configuration-test-store.mjs';

async function loadModule(path) {
  const bundle = await build({ entryPoints: [path], bundle: true, write: false, format: 'esm', platform: 'node', plugins: [configurationTestStore] });
  return import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
}

const settings = await loadModule('src/game/combat/combatSettings.ts');
const machine = await loadModule('src/game/combat/combatStateMachine.ts');
const catalog = await loadModule('src/game/combat/combatCatalog.ts');

test('combat settings: every slot gets a default, saved changes reload unchanged', async () => {
  const defaults = settings.defaultCombatSettings();
  assert.equal(Object.keys(defaults.slots).length, catalog.COMBAT_SLOTS.length);
  const changed = structuredClone(defaults);
  changed.slots.Rifle_Idle = { ...changed.slots.Rifle_Idle, file: 'rifle-aiming-idle.fbx', speed: 1.4, blendMs: 300 };
  changed.slots.Rifle_Sprint.file = null;
  changed.tuning.recoilKickDeg = 6;
  await settings.saveCombatSettings(changed);
  assert.deepEqual(settings.loadCombatSettings(), changed);
});

test('combat settings: untrusted stored values are dropped or clamped', () => {
  const normalized = settings.normalizeCombatSettings({
    enabled: 'yes',
    slots: { Rifle_Idle: { file: '../secret.fbx', speed: 99, blendMs: -5, mirror: 'no' }, Bogus_Slot: { file: 'x.fbx' } },
    tuning: { recoilKickDeg: 1000, hitWeight: Number.NaN, shoulderDistance: 0.1, cameraFov: 80 },
  });
  assert.equal(normalized.tuning.shoulderDistance, 0.6);
  assert.equal(normalized.tuning.cameraFov, 80);
  assert.equal(normalized.tuning.shoulderFov, settings.DEFAULT_COMBAT_TUNING.shoulderFov);
  assert.equal(normalized.enabled, true);
  assert.equal(normalized.slots.Rifle_Idle.file, 'rifle-idle.fbx');
  assert.equal(normalized.slots.Rifle_Idle.speed, 3);
  assert.equal(normalized.slots.Rifle_Idle.blendMs, 0);
  assert.equal(normalized.slots.Rifle_Idle.mirror, false);
  assert.equal('Bogus_Slot' in normalized.slots, false);
  assert.equal(normalized.tuning.recoilKickDeg, 15);
  assert.equal(normalized.tuning.hitWeight, settings.DEFAULT_COMBAT_TUNING.hitWeight);
  assert.deepEqual(settings.normalizeCombatSettings(null), settings.defaultCombatSettings());
});

test('combat catalog: every default clip is listed in the animation manifest', async () => {
  const { readFile } = await import('node:fs/promises');
  const manifest = JSON.parse(await readFile('public/animations/manifest.json', 'utf8'));
  const files = new Set(manifest.map((entry) => entry.file));
  const missing = catalog.COMBAT_SLOTS.filter((def) => def.defaultFile && !files.has(def.defaultFile)).map((def) => def.id);
  assert.deepEqual(missing, []);
});

test('dance poses: every dance clip is in the animation manifest', async () => {
  const { readFile } = await import('node:fs/promises');
  const { DANCE_POSES } = await loadModule('src/constants/dancePoses.ts');
  const manifest = JSON.parse(await readFile('public/animations/manifest.json', 'utf8'));
  const dances = new Set(manifest.filter((entry) => entry.ctx === 'dance').map((entry) => entry.file));
  assert.deepEqual(DANCE_POSES.map((dance) => dance.file).filter((file) => !dances.has(file)), []);
  assert.equal(DANCE_POSES.length, dances.size);
});

test('weapon state follows the gameplay weapon (game.md 6.1)', () => {
  const base = { alive: true, holdsGun: true, unequipping: false, deployLeft: 0, reloadLeft: 0, sinceShot: 9, aiming: false };
  assert.equal(machine.weaponPhase({ ...base, alive: false }), 'DISABLED');
  assert.equal(machine.weaponPhase({ ...base, holdsGun: false }), 'UNARMED');
  assert.equal(machine.weaponPhase({ ...base, unequipping: true }), 'UNEQUIPPING');
  assert.equal(machine.weaponPhase({ ...base, deployLeft: 0.2 }), 'EQUIPPING');
  assert.equal(machine.weaponPhase({ ...base, reloadLeft: 1 }), 'RELOADING');
  assert.equal(machine.weaponPhase({ ...base, sinceShot: 0.05 }), 'FIRING');
  assert.equal(machine.weaponPhase({ ...base, aiming: true }), 'AIMING');
  assert.equal(machine.weaponPhase(base), 'READY');
});

test('directional blend splits the move over the two nearest direction clips', () => {
  const slots = ['F', 'B', 'L', 'R'];
  assert.deepEqual(machine.directionalTracks(2, 0, slots).map((t) => [t.slot, t.weight]), [['F', 1]]);
  const diagonal = machine.directionalTracks(1, 1, slots);
  assert.deepEqual(diagonal.map((t) => t.slot).sort(), ['F', 'R']);
  assert.ok(Math.abs(diagonal[0].weight - 0.5) < 1e-9);
  assert.deepEqual(machine.directionalTracks(-2, 0, slots).map((t) => t.slot), ['B']);
  assert.deepEqual(machine.directionalTracks(0, -2, slots).map((t) => t.slot), ['L']);
  assert.equal(machine.hitSideOf(0, 1), 'front');
  assert.equal(machine.hitSideOf(-1, 0.2), 'left');
});

const frame = (patch = {}) => ({
  now: 10, alive: true, diedAt: 0, deathSide: 'front', stance: 'stand', stanceFrom: 'stand', stanceAt: -99,
  forward: 0, right: 0, sprinting: false, airborne: false, vy: 0, airAt: -99, landedAt: -99, turnRate: 0,
  phase: 'READY', aiming: false, aimChangedAt: -99, reloadProgress: 0, reloadEmpty: false, deployProgress: 1,
  unequipAt: -99, hitAt: -99, hitSide: 'front', ...patch,
});
const length = () => 1;
const pick = (patch) => machine.selectCombatTracks(frame(patch), length, 0.45);

test('animation state: locomotion, sprint, stances and their transitions', () => {
  assert.equal(pick({}).base[0].slot, 'Rifle_Idle');
  assert.equal(pick({ forward: 1.5 }).base[0].slot, 'Rifle_Walk_Fwd');
  assert.equal(pick({ forward: 4.5 }).base[0].slot, 'Rifle_Run');
  assert.equal(pick({ forward: 6, sprinting: true }).base[0].slot, 'Rifle_Sprint');
  assert.equal(pick({ forward: 6, sprinting: true, phase: 'AIMING', aiming: true }).upper, null);
  assert.equal(pick({ stance: 'crouch', stanceFrom: 'stand', stanceAt: 9.5 }).base[0].slot, 'Stand_To_Crouch');
  assert.equal(pick({ stance: 'crouch', stanceFrom: 'stand', stanceAt: 8 }).base[0].slot, 'Crouch_Idle');
  assert.equal(pick({ stance: 'prone', stanceFrom: 'stand', stanceAt: 8, forward: 0.8 }).base[0].slot, 'Prone_Crawl_Fwd');
  assert.equal(pick({ phase: 'UNARMED', forward: 1.5 }).base[0].slot, 'Unarmed_Walk');
  assert.equal(pick({ airborne: true, vy: 3, airAt: 9.8 }).base[0].slot, 'Rifle_Jump');
});

test('animation state: upper body layer for aim, fire, reload and equip', () => {
  assert.equal(pick({ phase: 'AIMING', aiming: true, aimChangedAt: 9.8 }).upper.slot, 'Rifle_Aim_Enter');
  assert.equal(pick({ phase: 'AIMING', aiming: true, aimChangedAt: 5 }).upper.slot, 'Rifle_Aim_Idle');
  assert.equal(pick({ phase: 'READY', aimChangedAt: 9.8 }).upper.slot, 'Rifle_Aim_Exit');
  assert.equal(pick({ phase: 'FIRING' }).upper.slot, 'Rifle_Fire_Hip');
  assert.equal(pick({ phase: 'FIRING', aiming: true }).upper.slot, 'Rifle_Fire_ADS');
  const reload = pick({ phase: 'RELOADING', reloadProgress: 0.4, reloadEmpty: true }).upper;
  assert.deepEqual([reload.slot, reload.mode, reload.progress], ['Rifle_Reload_Empty', 'fit', 0.4]);
  assert.equal(pick({ phase: 'RELOADING', reloadProgress: 0.4 }).upper.slot, 'Rifle_Reload_Tactical');
  assert.equal(pick({ phase: 'RELOADING', forward: 2 }).upper.slot, 'Rifle_Reload_Moving');
  assert.equal(pick({ phase: 'RELOADING', forward: 4.5 }).upper.slot, 'Rifle_Reload_Run');
  assert.equal(pick({ phase: 'RELOADING', firstPerson: true, forward: 2 }).upper.slot, 'FP_Reload');
  assert.equal(pick({ phase: 'RELOADING', firstPerson: true, stance: 'crouch', stanceAt: 0 }).upper.slot, 'FP_Reload');
  assert.equal(pick({ phase: 'RELOADING', stance: 'prone', stanceAt: 0 }).base[0].slot, 'Rifle_Reload_Prone');
  assert.equal(pick({ phase: 'EQUIPPING', deployProgress: 0.3 }).upper.slot, 'Rifle_Equip');
});

test('animation state: hits react by direction, death disables combat layers', () => {
  const hit = pick({ hitAt: 9.9, hitSide: 'left' });
  assert.equal(hit.overlay.slot, 'Hit_Left');
  assert.equal(pick({ hitAt: 9.9, stance: 'prone', stanceAt: 0 }).base[0].slot, 'Hit_Prone');
  const dead = pick({ alive: false, diedAt: 9, deathSide: 'back', phase: 'DISABLED' });
  assert.deepEqual([dead.dead, dead.base[0].slot, dead.upper, dead.overlay], [true, 'Death_Back', null, null]);
  assert.equal(pick({ alive: false, stance: 'prone', phase: 'DISABLED' }).base[0].slot, 'Death_Prone');
});

test('pistols use their own clips, first person holds a ready gun up', () => {
  for (const [rifle, pistol] of Object.entries(catalog.PISTOL_VARIANT)) {
    assert.ok(catalog.combatSlot(rifle), `${rifle} is a slot`);
    assert.ok(catalog.combatSlot(pistol), `${pistol} is a slot`);
    assert.equal(catalog.combatSlot(rifle).layer === 'upper', catalog.combatSlot(pistol).layer === 'upper', `${rifle} and ${pistol} drive the same bones`);
  }
  assert.equal(pick({ phase: 'READY', firstPerson: true }).upper.slot, 'Rifle_Aim_Idle');
  assert.equal(pick({ phase: 'READY', firstPerson: true, stance: 'crouch', stanceAt: 0 }).upper.slot, 'Crouch_Aim_Idle');
  assert.equal(pick({ phase: 'READY' }).upper, null, 'third person keeps the clip of the stance');
});

test('aiming while moving steps with the gun raised, standing and crouched', () => {
  assert.equal(pick({ phase: 'AIMING', aiming: true, forward: 1.5 }).base[0].slot, 'Rifle_Aim_Walk_Fwd');
  assert.equal(pick({ phase: 'AIMING', aiming: true, right: -1.2 }).base[0].slot, 'Rifle_Aim_Walk_Left');
  assert.equal(pick({ phase: 'AIMING', aiming: true, forward: -1.2, stance: 'crouch', stanceAt: 0 }).base[0].slot, 'Crouch_Aim_Walk_Bwd');
  assert.equal(pick({ phase: 'READY', forward: 1.5 }).base[0].slot, 'Rifle_Walk_Fwd', 'not aiming: the ordinary walk');
  assert.equal(catalog.combatSlot('Rifle_Aim_Walk_Right').defaultMirror, true);
});

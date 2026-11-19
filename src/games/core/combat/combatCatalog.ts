/**
 * The animations of the shooter's combat system (see game.md), each a slot that a clip of public/animations fills. The defaults
 * here are what a fresh install plays; the player changes them in Settings → Chiến đấu (see combatSettings.ts).
 */

export type CombatGroup = 'locomotion' | 'aim' | 'reload' | 'stance' | 'handling' | 'impact' | 'pistol' | 'unarmed';

/**
 * Which bones a slot drives: `full` the whole body, `upper` the trunk and arms over the legs of another slot, `lower` only the legs
 * (the arms keep the built-in pose of the weapon in hand).
 */
export type CombatLayer = 'full' | 'upper' | 'lower';

/** How a slot's clip is timed: looped, played once, or stretched to the length of a game action (reload, drawing the gun). */
export type CombatPlayback = 'loop' | 'once' | 'fitReload' | 'fitDeploy';

export interface CombatSlotDef {
  id: string;
  group: CombatGroup;
  label: string;
  priority: 'required' | 'recommended' | 'advanced';
  layer: CombatLayer;
  playback: CombatPlayback;
  defaultFile: string | null;
  /** Ground speed (m/s) at which a movement clip plays at its own pace; faster or slower movement scales the clip. */
  refSpeed?: number;
  defaultMirror?: boolean;
  /** Cancel the turn the clip gives the hips, so a turn or strafe clip does not twist the whole body away from the aim. */
  lockFacing?: boolean;
}

const slot = (
  id: string, group: CombatGroup, label: string, layer: CombatLayer, playback: CombatPlayback, defaultFile: string | null,
  extra: Partial<CombatSlotDef> = {},
): CombatSlotDef => ({ id, group, label, layer, playback, defaultFile, priority: 'required', ...extra });

const move = (id: string, label: string, file: string, refSpeed: number, extra: Partial<CombatSlotDef> = {}) =>
  slot(id, 'locomotion', label, 'full', 'loop', file, { refSpeed, lockFacing: true, ...extra });

const aimMove = (id: string, label: string, file: string, refSpeed: number, extra: Partial<CombatSlotDef> = {}) =>
  slot(id, 'aim', label, 'full', 'loop', file, { refSpeed, lockFacing: true, priority: 'recommended', ...extra });

export const COMBAT_SLOTS: readonly CombatSlotDef[] = [
  move('Rifle_Idle', 'Đứng yên cầm súng', 'rifle-idle.fbx', 0),
  move('Rifle_Walk_Fwd', 'Đi tới', 'rifle-walk-forward.fbx', 1.7),
  move('Rifle_Walk_Bwd', 'Đi lùi', 'rifle-walk-backward.fbx', 1.5),
  move('Rifle_Walk_Left', 'Đi ngang trái', 'rifle-walk-left.fbx', 1.5),
  move('Rifle_Walk_Right', 'Đi ngang phải', 'rifle-walk-right.fbx', 1.5),
  move('Rifle_Run', 'Chạy tới', 'rifle-run-forward.fbx', 4.2),
  move('Rifle_Run_Bwd', 'Chạy lùi', 'rifle-run-backward.fbx', 3.6, { priority: 'recommended' }),
  move('Rifle_Run_Left', 'Chạy ngang trái', 'rifle-run-left.fbx', 3.8, { priority: 'recommended' }),
  move('Rifle_Run_Right', 'Chạy ngang phải', 'rifle-run-right.fbx', 3.8, { priority: 'recommended' }),
  move('Rifle_Sprint', 'Chạy nước rút', 'rifle-sprint-forward.fbx', 6.2),
  move('Sprint_Gun_On_Back', 'Chạy nước rút (súng đã cất sau lưng)', 'fast-run.fbx', 6.5),
  move('Rifle_Turn_Left', 'Xoay tại chỗ sang trái', 'rifle-turn-left.fbx', 0, { priority: 'advanced' }),
  move('Rifle_Turn_Right', 'Xoay tại chỗ sang phải', 'rifle-turn-right.fbx', 0, { priority: 'advanced' }),
  slot('Rifle_Jump', 'locomotion', 'Bật nhảy', 'full', 'once', 'rifle-jump-up.fbx', { priority: 'recommended' }),
  slot('Rifle_Fall', 'locomotion', 'Đang rơi', 'full', 'loop', 'rifle-jump-loop.fbx', { priority: 'recommended' }),
  slot('Rifle_Land', 'locomotion', 'Tiếp đất', 'full', 'once', 'rifle-jump-down.fbx', { priority: 'recommended' }),

  slot('Rifle_Aim_Enter', 'aim', 'Đưa súng lên ngắm', 'upper', 'once', 'rifle-down-to-aim.fbx'),
  slot('Rifle_Aim_Idle', 'aim', 'Giữ tư thế ngắm', 'upper', 'loop', 'rifle-aim-idle.fbx'),
  slot('Rifle_Aim_Exit', 'aim', 'Hạ súng khỏi tư thế ngắm', 'upper', 'once', 'rifle-aim-to-down.fbx'),
  slot('Rifle_Fire_Hip', 'aim', 'Bắn không ngắm', 'upper', 'loop', 'firing-rifle.fbx'),
  slot('Rifle_Fire_ADS', 'aim', 'Bắn khi ngắm (ADS)', 'upper', 'loop', 'rifle-fire-standing.fbx'),
  slot('Crouch_Aim_Idle', 'aim', 'Ngắm khi ngồi', 'upper', 'loop', 'rifle-crouch-aim-idle.fbx', { priority: 'recommended' }),
  slot('Prone_Fire', 'aim', 'Bắn khi nằm', 'full', 'loop', 'prone-firing-rifle.fbx', { priority: 'recommended' }),
  // walking with the gun raised (PUBG aim and ADS walk): the legs step slowly in eight directions while the sights stay level
  aimMove('Rifle_Aim_Walk_Fwd', 'Đi tới khi ngắm', 'rifle-aim-walk-forward.fbx', 1.3),
  aimMove('Rifle_Aim_Walk_Bwd', 'Đi lùi khi ngắm', 'rifle-aim-walk-backward.fbx', 1.2),
  aimMove('Rifle_Aim_Walk_Left', 'Đi ngang trái khi ngắm', 'rifle-aim-strafe-left.fbx', 1.2),
  aimMove('Rifle_Aim_Walk_Right', 'Đi ngang phải khi ngắm', 'rifle-aim-strafe-left.fbx', 1.2, { defaultMirror: true }),
  aimMove('Crouch_Aim_Walk_Fwd', 'Ngồi đi tới khi ngắm', 'rifle-crouch-aim-walk-forward.fbx', 1.1),
  aimMove('Crouch_Aim_Walk_Bwd', 'Ngồi đi lùi khi ngắm', 'rifle-crouch-aim-walk-backward.fbx', 1),
  aimMove('Crouch_Aim_Walk_Left', 'Ngồi đi ngang trái khi ngắm', 'rifle-crouch-aim-strafe-left.fbx', 1.6),
  aimMove('Crouch_Aim_Walk_Right', 'Ngồi đi ngang phải khi ngắm', 'rifle-crouch-aim-strafe-left.fbx', 1.6, { defaultMirror: true }),

  slot('Rifle_Reload_Tactical', 'reload', 'Thay băng khi còn đạn', 'upper', 'fitReload', 'reloading.fbx'),
  slot('Rifle_Reload_Empty', 'reload', 'Thay băng khi hết đạn', 'upper', 'fitReload', 'reloading.fbx'),
  slot('Rifle_Reload_Moving', 'reload', 'Thay đạn khi di chuyển', 'upper', 'fitReload', 'rifle-reload-walk.fbx', { priority: 'recommended' }),
  slot('Rifle_Reload_Run', 'reload', 'Thay đạn khi chạy', 'upper', 'fitReload', 'rifle-reload-run.fbx', { priority: 'recommended' }),
  slot('FP_Reload', 'reload', 'Thay đạn (góc nhìn thứ nhất)', 'upper', 'fitReload', 'reloading.fbx', { priority: 'recommended' }),
  slot('Rifle_Reload_Crouch', 'reload', 'Thay đạn khi ngồi', 'upper', 'fitReload', 'rifle-reload-crouch.fbx', { priority: 'recommended' }),
  slot('Rifle_Reload_Prone', 'reload', 'Thay đạn khi nằm', 'full', 'fitReload', 'prone-reloading.fbx', { priority: 'recommended' }),

  slot('Stand_To_Crouch', 'stance', 'Đứng → ngồi', 'full', 'once', 'stand-to-crouch.fbx'),
  slot('Crouch_Idle', 'stance', 'Ngồi yên cầm súng', 'full', 'loop', 'rifle-crouch-idle.fbx', { lockFacing: true }),
  move('Crouch_Walk', 'Đi khom tới', 'rifle-crouch-walk-forward.fbx', 1.5, { group: 'stance' }),
  move('Crouch_Walk_Bwd', 'Đi khom lùi', 'rifle-crouch-walk-backward.fbx', 1.4, { group: 'stance', priority: 'recommended' }),
  move('Crouch_Walk_Left', 'Đi khom sang trái', 'rifle-crouch-walk-left.fbx', 1.4, { group: 'stance', priority: 'recommended' }),
  move('Crouch_Walk_Right', 'Đi khom sang phải', 'rifle-crouch-walk-right.fbx', 1.4, { group: 'stance', priority: 'recommended' }),
  slot('Crouch_To_Stand', 'stance', 'Ngồi → đứng', 'full', 'once', 'crouch-to-stand-rifle.fbx'),
  slot('Stand_To_Prone', 'stance', 'Đứng → nằm', 'full', 'once', 'crouch-to-prone.fbx'),
  slot('Crouch_To_Prone', 'stance', 'Ngồi → nằm', 'full', 'once', 'crouch-to-prone.fbx', { priority: 'recommended' }),
  slot('Prone_Idle', 'stance', 'Nằm yên cầm súng', 'full', 'loop', 'prone-idle.fbx'),
  move('Prone_Crawl_Fwd', 'Bò tới', 'prone-forward.fbx', 0.9, { group: 'stance', lockFacing: false }),
  move('Prone_Crawl_Bwd', 'Bò lùi', 'prone-crawl-backward.fbx', 0.7, { group: 'stance', lockFacing: false, priority: 'recommended' }),
  slot('Prone_To_Stand', 'stance', 'Nằm → đứng', 'full', 'once', 'prone-to-stand.fbx'),
  slot('Prone_To_Crouch', 'stance', 'Nằm → ngồi', 'full', 'once', 'prone-to-crouch.fbx', { priority: 'recommended' }),
  slot('Prone_Turn_Left', 'stance', 'Xoay khi nằm (trái)', 'full', 'loop', 'prone-left-turn.fbx', { priority: 'advanced', lockFacing: true }),
  slot('Prone_Turn_Right', 'stance', 'Xoay khi nằm (phải)', 'full', 'loop', 'prone-right-turn.fbx', { priority: 'advanced', lockFacing: true }),

  slot('Rifle_Equip', 'handling', 'Lấy súng ra', 'upper', 'fitDeploy', 'rifle-pull-out.fbx'),
  slot('Rifle_Unequip', 'handling', 'Cất súng', 'upper', 'once', 'rifle-put-away.fbx'),
  slot('Rifle_Stow_Back', 'handling', 'Cất súng ra sau lưng (khi chạy nước rút)', 'upper', 'once', 'combat/put-back-rifle-behind-shoulder.fbx'),
  slot('Rifle_Draw_Back', 'handling', 'Lấy súng từ sau lưng', 'upper', 'fitDeploy', 'combat/grab-rifle-from-behind-shoulder.fbx'),

  slot('Hit_Front', 'impact', 'Trúng đạn phía trước', 'upper', 'once', 'rifle-hit-reaction.fbx'),
  slot('Hit_Back', 'impact', 'Trúng đạn phía sau', 'upper', 'once', 'rifle-hit-reaction.fbx'),
  slot('Hit_Left', 'impact', 'Trúng đạn bên trái', 'upper', 'once', 'rifle-hit-reaction.fbx'),
  slot('Hit_Right', 'impact', 'Trúng đạn bên phải', 'upper', 'once', 'rifle-hit-reaction.fbx', { defaultMirror: true }),
  slot('Hit_Crouch', 'impact', 'Trúng đạn khi ngồi', 'upper', 'once', 'rifle-hit-reaction-crouch.fbx', { priority: 'recommended' }),
  slot('Hit_Prone', 'impact', 'Trúng đạn khi nằm', 'full', 'once', 'rifle-hit-reaction-prone.fbx', { priority: 'recommended' }),
  slot('Death_Front', 'impact', 'Chết (trúng phía trước)', 'full', 'once', 'rifle-death-front.fbx'),
  slot('Death_Back', 'impact', 'Chết (trúng phía sau)', 'full', 'once', 'rifle-death-back.fbx'),
  slot('Death_Left', 'impact', 'Chết (trúng bên trái)', 'full', 'once', 'rifle-death-right.fbx', { defaultMirror: true }),
  slot('Death_Right', 'impact', 'Chết (trúng bên phải)', 'full', 'once', 'rifle-death-right.fbx'),
  slot('Death_Crouch', 'impact', 'Chết khi ngồi', 'full', 'once', 'crouch-death.fbx', { priority: 'recommended' }),
  slot('Death_Prone', 'impact', 'Chết khi nằm', 'full', 'once', 'prone-death.fbx', { priority: 'recommended' }),

  slot('Pistol_Idle', 'pistol', 'Đứng yên cầm súng lục', 'full', 'loop', 'pistol-idle.fbx', { refSpeed: 0, lockFacing: true }),
  slot('Pistol_Walk_Fwd', 'pistol', 'Đi tới', 'full', 'loop', 'pistol-walk-forward.fbx', { refSpeed: 1.4, lockFacing: true }),
  slot('Pistol_Walk_Bwd', 'pistol', 'Đi lùi', 'full', 'loop', 'pistol-walk-backward.fbx', { refSpeed: 1.3, lockFacing: true }),
  slot('Pistol_Walk_Left', 'pistol', 'Đi ngang trái', 'full', 'loop', 'pistol-strafe-left.fbx', { refSpeed: 1.3, lockFacing: true }),
  slot('Pistol_Walk_Right', 'pistol', 'Đi ngang phải', 'full', 'loop', 'pistol-strafe-right.fbx', { refSpeed: 1.3, lockFacing: true }),
  slot('Pistol_Run', 'pistol', 'Chạy tới', 'full', 'loop', 'pistol-run-forward.fbx', { refSpeed: 3.8, lockFacing: true }),
  slot('Pistol_Run_Bwd', 'pistol', 'Chạy lùi', 'full', 'loop', 'pistol-run-backward.fbx', { refSpeed: 3.2, lockFacing: true, priority: 'recommended' }),
  slot('Pistol_Run_Left', 'pistol', 'Chạy ngang trái', 'full', 'loop', 'pistol-strafe-left.fbx', { refSpeed: 1.8, lockFacing: true, priority: 'recommended' }),
  slot('Pistol_Run_Right', 'pistol', 'Chạy ngang phải', 'full', 'loop', 'pistol-strafe-right.fbx', { refSpeed: 1.8, lockFacing: true, priority: 'recommended' }),
  slot('Pistol_Sprint', 'pistol', 'Chạy nước rút', 'full', 'loop', 'pistol-run-forward.fbx', { refSpeed: 4.6, lockFacing: true }),
  slot('Pistol_Jump', 'pistol', 'Bật nhảy', 'full', 'once', 'pistol-jump.fbx', { priority: 'recommended' }),
  slot('Pistol_Aim_Idle', 'pistol', 'Giữ tư thế ngắm', 'upper', 'loop', 'pistol-aim-idle.fbx'),
  slot('Pistol_Fire', 'pistol', 'Bắn', 'upper', 'loop', 'pistol-shooting.fbx'),
  slot('Pistol_Reload', 'pistol', 'Thay đạn', 'upper', 'fitReload', 'pistol-reload.fbx'),
  slot('Pistol_FP_Reload', 'pistol', 'Thay đạn (góc nhìn thứ nhất)', 'upper', 'fitReload', 'reloading.fbx', { priority: 'recommended' }),
  slot('Pistol_Equip', 'pistol', 'Rút súng', 'upper', 'fitDeploy', 'pistol-draw.fbx'),
  slot('Pistol_Unequip', 'pistol', 'Cất súng', 'upper', 'once', 'pistol-holster.fbx'),
  slot('Pistol_Crouch_Idle', 'pistol', 'Quỳ cầm súng lục', 'full', 'loop', 'pistol-kneel-idle.fbx', { lockFacing: true }),
  slot('Pistol_Crouch_Aim', 'pistol', 'Ngắm khi quỳ', 'upper', 'loop', 'pistol-kneel-idle.fbx', { priority: 'recommended' }),
  slot('Pistol_Stand_To_Crouch', 'pistol', 'Đứng → quỳ', 'full', 'once', 'pistol-stand-to-kneel.fbx'),
  slot('Pistol_Crouch_To_Stand', 'pistol', 'Quỳ → đứng', 'full', 'once', 'pistol-kneel-to-stand.fbx'),
  slot('Pistol_Hit', 'pistol', 'Trúng đạn', 'upper', 'once', 'pistol-hit-reaction.fbx'),
  slot('Pistol_Hit_Left', 'pistol', 'Trúng đạn bên trái', 'upper', 'once', 'pistol-hit-reaction-left.fbx'),

  slot('Unarmed_Idle', 'unarmed', 'Đứng yên', 'lower', 'loop', 'neutral-idle.fbx', { refSpeed: 0, lockFacing: true }),
  slot('Unarmed_Walk', 'unarmed', 'Đi', 'lower', 'loop', 'walking.fbx', { refSpeed: 1.6, lockFacing: true }),
  slot('Unarmed_Run', 'unarmed', 'Chạy', 'lower', 'loop', 'running.fbx', { refSpeed: 4.6, lockFacing: true }),
  slot('Unarmed_Sprint', 'unarmed', 'Chạy nước rút', 'lower', 'loop', 'fast-run.fbx', { refSpeed: 6.5, lockFacing: true }),
  slot('Unarmed_Crouch_Idle', 'unarmed', 'Ngồi yên', 'lower', 'loop', 'idle-crouching.fbx', { refSpeed: 0, lockFacing: true }),
  slot('Unarmed_Crouch_Walk', 'unarmed', 'Đi khom', 'lower', 'loop', 'crouch-walking.fbx', { refSpeed: 1.4, lockFacing: true }),
];

const BY_ID = new Map(COMBAT_SLOTS.map((def) => [def.id, def]));
export const combatSlot = (id: string): CombatSlotDef | undefined => BY_ID.get(id);

export const COMBAT_GROUPS: { id: CombatGroup; label: string; detail: string }[] = [
  { id: 'locomotion', label: 'Di chuyển', detail: 'Blend theo hướng; tốc độ clip khớp tốc độ di chuyển thực tế' },
  { id: 'aim', label: 'Ngắm & bắn', detail: 'Lớp thân trên phủ lên chân đang di chuyển' },
  { id: 'reload', label: 'Thay đạn', detail: 'Tự kéo dài cho khớp thời gian nạp đạn của súng' },
  { id: 'stance', label: 'Tư thế', detail: 'Đứng, ngồi (C), nằm (Z) và chuyển tư thế' },
  { id: 'handling', label: 'Trang bị', detail: 'Lấy súng khớp thời gian rút súng' },
  { id: 'impact', label: 'Trúng đạn & chết', detail: 'Chọn theo hướng nhận sát thương' },
  { id: 'pistol', label: 'Súng lục', detail: 'Thay các mục súng trường khi cầm súng lục; mục để trống dùng lại clip súng trường' },
  { id: 'unarmed', label: 'Tay không / dao', detail: 'Chỉ điều khiển chân; tay giữ tư thế của vũ khí' },
];

/**
 * The pistol version of a rifle slot: holding a pistol, each state plays this slot instead (when it has a clip). States without a
 * pistol version (crouch walking, prone, death) keep the rifle clip.
 */
export const PISTOL_VARIANT: Readonly<Record<string, string>> = {
  Rifle_Idle: 'Pistol_Idle', Rifle_Walk_Fwd: 'Pistol_Walk_Fwd', Rifle_Walk_Bwd: 'Pistol_Walk_Bwd', Rifle_Walk_Left: 'Pistol_Walk_Left',
  Rifle_Walk_Right: 'Pistol_Walk_Right', Rifle_Run: 'Pistol_Run', Rifle_Run_Bwd: 'Pistol_Run_Bwd', Rifle_Run_Left: 'Pistol_Run_Left',
  Rifle_Run_Right: 'Pistol_Run_Right', Rifle_Sprint: 'Pistol_Sprint', Rifle_Jump: 'Pistol_Jump',
  Rifle_Aim_Enter: 'Pistol_Aim_Idle', Rifle_Aim_Idle: 'Pistol_Aim_Idle', Rifle_Aim_Exit: 'Pistol_Aim_Idle', Crouch_Aim_Idle: 'Pistol_Crouch_Aim',
  Rifle_Fire_Hip: 'Pistol_Fire', Rifle_Fire_ADS: 'Pistol_Fire',
  Rifle_Aim_Walk_Fwd: 'Pistol_Walk_Fwd', Rifle_Aim_Walk_Bwd: 'Pistol_Walk_Bwd', Rifle_Aim_Walk_Left: 'Pistol_Walk_Left', Rifle_Aim_Walk_Right: 'Pistol_Walk_Right',
  Rifle_Reload_Tactical: 'Pistol_Reload', Rifle_Reload_Empty: 'Pistol_Reload', Rifle_Reload_Moving: 'Pistol_Reload', Rifle_Reload_Crouch: 'Pistol_Reload',
  Rifle_Reload_Run: 'Pistol_Reload', FP_Reload: 'Pistol_FP_Reload',
  Rifle_Equip: 'Pistol_Equip', Rifle_Unequip: 'Pistol_Unequip',
  Crouch_Idle: 'Pistol_Crouch_Idle', Stand_To_Crouch: 'Pistol_Stand_To_Crouch', Crouch_To_Stand: 'Pistol_Crouch_To_Stand',
  Hit_Front: 'Pistol_Hit', Hit_Back: 'Pistol_Hit', Hit_Right: 'Pistol_Hit', Hit_Left: 'Pistol_Hit_Left', Hit_Crouch: 'Pistol_Hit',
};

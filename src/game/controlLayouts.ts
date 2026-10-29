/** What a key does in the battle game; each mode binds keys to these through its own layout. */
export type ControlAction =
  | 'forward' | 'back' | 'left' | 'right' | 'jump' | 'walk' | 'sprint'
  | 'crouchHold' | 'crouchToggle' | 'prone' | 'leanLeft' | 'leanRight'
  | 'reload' | 'interact' | 'inspect' | 'drop' | 'lastWeapon' | 'slot1' | 'slot2' | 'slot3' | 'slot4'
  | 'buy' | 'scoreboard' | 'inventory' | 'map' | 'heal' | 'boost' | 'camera' | 'freeLook';

export type ControlLayoutId = 'pubg' | 'crossfire';

/** Battle royale plays with PUBG keys, the 5v5 mode with CrossFire (Đột kích) keys. */
export const layoutForMode = (mode: 'cs' | 'br'): ControlLayoutId => (mode === 'br' ? 'pubg' : 'crossfire');

/** One line of the controls help; `binds` are the keys (KeyboardEvent.code) behind it, none for mouse or Esc lines. */
interface ControlRow {
  key: string;
  label: string;
  binds: Partial<Record<ControlAction, string[]>>;
}

const row = (key: string, label: string, binds: ControlRow['binds'] = {}): ControlRow => ({ key, label, binds });

const MOVE = { forward: ['KeyW', 'ArrowUp'], back: ['KeyS', 'ArrowDown'], left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'] };
const SHIFT = ['ShiftLeft', 'ShiftRight'];
const CTRL = ['ControlLeft', 'ControlRight'];
const SLOTS = { slot1: ['Digit1'], slot2: ['Digit2'], slot3: ['Digit3'], slot4: ['Digit4'] };

/** PUBG defaults: Shift sprints (holds the breath when scoped), Ctrl walks, C / Z crouch / prone, Q / E lean, Alt free look, F picks up. */
const PUBG: ControlRow[] = [
  row('WASD', 'Di chuyển', MOVE),
  row('Shift', 'Chạy nước rút (giữ) · nín thở khi ngắm ống', { sprint: SHIFT }),
  row('Ctrl', 'Đi bộ chậm (giữ)', { walk: CTRL }),
  row('Alt', 'Nhìn tự do (giữ)', { freeLook: ['AltLeft', 'AltRight'] }),
  row('C', 'Ngồi / đứng', { crouchToggle: ['KeyC'] }),
  row('Z', 'Nằm / đứng', { prone: ['KeyZ'] }),
  row('Q / E', 'Nghiêng trái / phải (giữ)', { leanLeft: ['KeyQ'], leanRight: ['KeyE'] }),
  row('Space', 'Nhảy (đang ngồi hoặc nằm thì đứng dậy)', { jump: ['Space'] }),
  row('Chuột trái', 'Bắn'),
  row('Chuột phải', 'Bấm: ngắm ADS · giữ: ngắm qua vai'),
  row('F', 'Nhặt đồ', { interact: ['KeyF'] }),
  row('Tab', 'Túi đồ', { inventory: ['Tab'] }),
  row('M', 'Bản đồ', { map: ['KeyM'] }),
  row('H', 'Hồi máu', { heal: ['KeyH'] }),
  row('J', 'Tăng lực', { boost: ['KeyJ'] }),
  row('R', 'Nạp đạn', { reload: ['KeyR'] }),
  row('1 2 3 4 · X', 'Đổi vũ khí', { ...SLOTS, lastWeapon: ['KeyX'] }),
  row('G', 'Vứt súng', { drop: ['KeyG'] }),
  row('V', 'Góc nhìn thứ nhất / thứ ba', { camera: ['KeyV'] }),
  row('Esc', 'Tạm dừng'),
];

/** CrossFire (Đột kích) defaults: Shift walks, holding Ctrl crouches, Q swaps to the last weapon, E picks up, no lean or prone. */
const CROSSFIRE: ControlRow[] = [
  row('WASD', 'Di chuyển', MOVE),
  row('Shift', 'Đi bộ (im lặng, chính xác)', { walk: SHIFT }),
  row('Ctrl', 'Ngồi (giữ)', { crouchHold: CTRL }),
  row('Space', 'Nhảy', { jump: ['Space'] }),
  row('Chuột trái', 'Bắn / chém / ném xa'),
  row('Chuột phải', 'Ngắm / đâm mạnh / ném gần'),
  row('R', 'Nạp đạn', { reload: ['KeyR'] }),
  row('1 2 3 4 · lăn chuột', 'Súng chính · súng phụ · dao · lựu đạn', SLOTS),
  row('Q', 'Đổi nhanh về vũ khí trước', { lastWeapon: ['KeyQ'] }),
  row('E', 'Nhặt súng', { interact: ['KeyE'] }),
  row('F', 'Xem súng', { inspect: ['KeyF'] }),
  row('G', 'Vứt súng', { drop: ['KeyG'] }),
  row('B', 'Mua đồ', { buy: ['KeyB'] }),
  row('Tab', 'Bảng điểm (giữ)', { scoreboard: ['Tab'] }),
  row('V', 'Góc nhìn thứ nhất / thứ ba', { camera: ['KeyV'] }),
  row('Esc', 'Tạm dừng'),
];

const LAYOUTS: Record<ControlLayoutId, ControlRow[]> = { pubg: PUBG, crossfire: CROSSFIRE };

const keyMaps = new Map<ControlLayoutId, Map<string, ControlAction>>();

function keyMap(layout: ControlLayoutId) {
  let map = keyMaps.get(layout);
  if (map) return map;
  map = new Map();
  for (const { binds } of LAYOUTS[layout]) {
    for (const [action, codes] of Object.entries(binds) as [ControlAction, string[]][]) codes.forEach((code) => map!.set(code, action));
  }
  keyMaps.set(layout, map);
  return map;
}

/** The action a key (KeyboardEvent.code) triggers in a layout, or null when the layout leaves it free. */
export const actionForKey = (layout: ControlLayoutId, code: string): ControlAction | null => keyMap(layout).get(code) ?? null;

/** The controls help of a layout as [key, what it does] lines. */
export const controlHelp = (layout: ControlLayoutId): [string, string][] => LAYOUTS[layout].map(({ key, label }) => [key, label]);

import type { ShooterRules } from '../core/engine/matchContext';
import { CTRL_KEYS, defineLayout, MOVE_KEYS, row, SHARED_HELP_ROWS, SHIFT_KEYS, SLOT_KEYS, type CoreAction } from '../core/input/controlLayouts';

/** The right button aims in the style the settings pick; the camera stays above the streets. */
export const CITY_RULES: ShooterRules = { rightButtonAimsGuns: true, spectateAnyone: true, cameraClearsTerrain: true };

/** Keys of the open world besides the shared ones: get in and out, the protagonists, the map, skipping a line, the horn. */
export type CityAction = CoreAction | 'interact' | 'switchHero' | 'map' | 'skip' | 'horn';

export const CITY_CONTROLS = defineLayout<CityAction>([
  row('WASD', 'Đi bộ · lái xe', MOVE_KEYS),
  row('Shift', 'Chạy nhanh (giữ)', { sprint: SHIFT_KEYS }),
  row('Ctrl', 'Đi chậm (giữ)', { walk: CTRL_KEYS }),
  row('Space', 'Nhảy · phanh tay khi lái', { jump: ['Space'] }),
  row('C', 'Ngồi / đứng', { crouchToggle: ['KeyC'] }),
  row('Q / E', 'Nghiêng trái / phải (giữ)', { leanLeft: ['KeyQ'], leanRight: ['KeyE'] }),
  row('Alt', 'Nhìn tự do (giữ)', { freeLook: ['AltLeft', 'AltRight'] }),
  row('Chuột trái', 'Bắn'),
  row('Chuột phải', 'Ngắm'),
  row('F', 'Lên / xuống xe · tương tác', { interact: ['KeyF'] }),
  row('H', 'Bóp còi', { horn: ['KeyH'] }),
  row('Tab', 'Chọn nhân vật', { switchHero: ['Tab'] }),
  row('M', 'Bản đồ · đặt điểm đến', { map: ['KeyM'] }),
  row('Enter', 'Bỏ qua lời thoại', { skip: ['Enter', 'NumpadEnter'] }),
  row('R', 'Nạp đạn', { reload: ['KeyR'] }),
  row('1 2 3 4 · X', 'Đổi vũ khí', { ...SLOT_KEYS, lastWeapon: ['KeyX'] }),
  row('V', 'Góc nhìn thứ nhất / thứ ba', { camera: ['KeyV'] }),
  ...SHARED_HELP_ROWS,
]);

const CORE_ACTIONS = [
  'forward', 'back', 'left', 'right', 'jump', 'walk', 'sprint',
  'crouchHold', 'crouchToggle', 'prone', 'leanLeft', 'leanRight',
  'reload', 'inspect', 'drop', 'lastWeapon', 'slot1', 'slot2', 'slot3', 'slot4', 'camera', 'freeLook',
] as const;

/** What a key does in every shooter game; each game adds its own actions (buy, inventory…) on top. */
export type CoreAction = (typeof CORE_ACTIONS)[number];

const CORE_ACTION_SET: ReadonlySet<string> = new Set(CORE_ACTIONS);

export const isCoreAction = (action: string): action is CoreAction => CORE_ACTION_SET.has(action);

/** One line of the controls help; `binds` are the keys (KeyboardEvent.code) behind it, none for mouse or Esc lines. */
export interface ControlRow<A extends string> {
  key: string;
  label: string;
  binds: Partial<Record<A, string[]>>;
}

/** A game's keys: the controls help in order, and which action each key triggers. */
export interface ControlLayout<A extends string> {
  readonly rows: readonly ControlRow<A>[];
  readonly keyMap: ReadonlyMap<string, A>;
}

export const row = <A extends string>(key: string, label: string, binds: Partial<Record<A, string[]>> = {}): ControlRow<A> => ({ key, label, binds });

export const MOVE_KEYS = { forward: ['KeyW', 'ArrowUp'], back: ['KeyS', 'ArrowDown'], left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'] };
export const SHIFT_KEYS = ['ShiftLeft', 'ShiftRight'];
export const CTRL_KEYS = ['ControlLeft', 'ControlRight'];
export const SLOT_KEYS = { slot1: ['Digit1'], slot2: ['Digit2'], slot3: ['Digit3'], slot4: ['Digit4'] };

/** The last help lines every game shares: Esc pauses, Ctrl + Alt lets the mouse go (see inputController.ts). */
export const SHARED_HELP_ROWS = [row('Esc', 'Tạm dừng'), row('Ctrl + Alt', 'Thả chuột (bấm vào màn hình để khoá lại)')];

export function defineLayout<A extends string>(rows: readonly ControlRow<A>[]): ControlLayout<A> {
  const keyMap = new Map<string, A>();
  for (const { binds } of rows) {
    for (const action of Object.keys(binds) as A[]) binds[action]?.forEach((code) => keyMap.set(code, action));
  }
  return { rows, keyMap };
}

/** The action a key (KeyboardEvent.code) triggers in a layout, or null when the layout leaves it free. */
export const actionForKey = <A extends string>(layout: ControlLayout<A>, code: string): A | null => layout.keyMap.get(code) ?? null;

/** The controls help of a layout as [key, what it does] lines. */
export const controlHelp = <A extends string>(layout: ControlLayout<A>): [string, string][] => layout.rows.map(({ key, label }) => [key, label]);

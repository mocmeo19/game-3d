/** One choice of a Select. `group` puts it under a heading; `hint` is a second, dimmer line. */
export interface SelectOption<V extends string = string> {
  value: V;
  label: string;
  hint?: string;
  group?: string;
  disabled?: boolean;
}

/** Lists longer than this get a search box. */
export const SEARCH_THRESHOLD = 8;

/** Lower case without Vietnamese accents, so "nhay" finds "Nhảy" and "dung" finds "Đứng". */
export const foldText = (text: string) =>
  text.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[đĐ]/g, 'd').toLowerCase();

/** Options whose label, hint or group contain every word of the query (in any order). */
export function filterOptions<V extends string>(options: SelectOption<V>[], query: string): SelectOption<V>[] {
  const words = foldText(query).split(/\s+/).filter(Boolean);
  if (!words.length) return options;
  return options.filter((option) => {
    const text = foldText(`${option.label} ${option.hint ?? ''} ${option.group ?? ''} ${option.value}`);
    return words.every((word) => text.includes(word));
  });
}

/** Next selectable index from `from` moving by `step` (wrapping), or -1 when nothing can be chosen. */
export function stepIndex(options: SelectOption[], from: number, step: 1 | -1): number {
  const count = options.length;
  for (let i = 1; i <= count; i++) {
    const index = (((from + step * i) % count) + count) % count;
    if (!options[index].disabled) return index;
  }
  return -1;
}

/** First selectable option whose label starts with the typed letters (type-ahead), searching after `from`. */
export function typeAheadIndex(options: SelectOption[], typed: string, from: number): number {
  const prefix = foldText(typed);
  const count = options.length;
  for (let i = 1; i <= count; i++) {
    const index = (from + i) % count;
    if (!options[index].disabled && foldText(options[index].label).startsWith(prefix)) return index;
  }
  return -1;
}

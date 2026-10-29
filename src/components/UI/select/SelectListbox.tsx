import { useEffect, useRef, type CSSProperties, type KeyboardEvent } from 'react';
import { Check, Search } from 'lucide-react';
import type { SelectOption } from './selectModel';

export type SelectTone = 'sky' | 'game';

interface Props {
  id: string;
  options: SelectOption[];
  value: string;
  activeIndex: number;
  query: string | null;
  tone: SelectTone;
  style: CSSProperties;
  onQuery: (query: string) => void;
  onActivate: (index: number) => void;
  onPick: (option: SelectOption) => void;
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
}

const TONE = {
  sky: {
    panel: 'border-sky-200/20 bg-[#0f2230] text-slate-100',
    search: 'border-white/10 bg-black/25 focus-within:border-sky-300/60',
    group: 'text-sky-200/60',
    active: 'bg-sky-400/15',
    selected: 'text-sky-200',
  },
  game: {
    panel: 'border-[#555] bg-[#101010] text-[#f0f0f0]',
    search: 'border-[#444] bg-black focus-within:border-gp-hot',
    group: 'text-gp-hot/70',
    active: 'bg-white/10',
    selected: 'text-gp-hot',
  },
} as const;

/** The open list of a Select: an optional search box, group headings and the options (shown in a portal by Select). */
export function SelectListbox({ id, options, value, activeIndex, query, tone, style, onQuery, onActivate, onPick, onKeyDown }: Props) {
  const list = useRef<HTMLUListElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const colors = TONE[tone];
  // the list is hidden until it has been placed, and a hidden element can take neither focus nor scrolling
  const placed = style.visibility !== 'hidden';
  useEffect(() => {
    if (placed) (search.current ?? list.current)?.focus({ preventScroll: true });
  }, [placed]);
  useEffect(() => {
    if (placed) list.current?.querySelector(`[data-index="${activeIndex}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, placed]);
  return (
    <div style={style} className={`z-1000 flex flex-col overflow-hidden rounded-xl border shadow-2xl shadow-black/60 ${colors.panel}`}>
      {query !== null && <label className={`m-1.5 flex items-center gap-2 rounded-lg border px-2.5 py-1.5 ${colors.search}`}>
        <Search size={13} className="shrink-0 opacity-60" aria-hidden />
        <input ref={search} value={query} onChange={(event) => onQuery(event.target.value)} onKeyDown={onKeyDown}
          placeholder="Tìm…" aria-label="Tìm trong danh sách" aria-controls={id} aria-activedescendant={activeIndex >= 0 ? `${id}-${activeIndex}` : undefined}
          className="w-full min-w-0 bg-transparent text-xs outline-hidden placeholder:opacity-50" />
      </label>}
      <ul ref={list} id={id} role="listbox" tabIndex={-1} onKeyDown={onKeyDown}
        aria-activedescendant={activeIndex >= 0 ? `${id}-${activeIndex}` : undefined}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-1 text-xs outline-hidden">
        {!options.length && <li className="px-3 py-3 text-center opacity-50">Không có kết quả</li>}
        {options.map((option, index) => {
          const heading = option.group && option.group !== options[index - 1]?.group;
          const selected = option.value === value;
          return [
            heading && <li key={`group-${option.group}-${index}`} role="presentation"
              className={`px-2.5 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider ${colors.group}`}>{option.group}</li>,
            <li key={option.value} id={`${id}-${index}`} data-index={index} role="option" aria-selected={selected} aria-disabled={option.disabled || undefined}
              onPointerMove={() => !option.disabled && index !== activeIndex && onActivate(index)}
              onPointerDown={(event) => event.preventDefault()}
              onClick={() => !option.disabled && onPick(option)}
              className={`flex cursor-pointer items-start gap-2 rounded-lg px-2.5 py-2 ${index === activeIndex ? colors.active : ''} ${option.disabled ? 'cursor-default opacity-40' : ''}`}>
              <span className="min-w-0 flex-1">
                <span className={`block wrap-break-word ${selected ? `font-semibold ${colors.selected}` : ''}`}>{option.label}</span>
                {option.hint && <span className="mt-0.5 block wrap-break-word text-[10px] opacity-55">{option.hint}</span>}
              </span>
              {selected && <Check size={13} className={`mt-0.5 shrink-0 ${colors.selected}`} aria-hidden />}
            </li>,
          ];
        })}
      </ul>
    </div>
  );
}

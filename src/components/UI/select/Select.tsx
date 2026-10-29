import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';
import { filterOptions, SEARCH_THRESHOLD, stepIndex, typeAheadIndex, type SelectOption } from './selectModel';
import { SelectListbox, type SelectTone } from './SelectListbox';
import { usePopoverPosition } from './usePopoverPosition';

interface Props<V extends string> {
  value: V;
  options: SelectOption<V>[];
  onChange: (value: V) => void;
  /** For a `<label htmlFor>` outside; a wrapping `<label>` also works. */
  id?: string;
  'aria-label'?: string;
  /** Look of the closed box; each screen keeps its own field style. */
  className?: string;
  tone?: SelectTone;
  disabled?: boolean;
  placeholder?: string;
  /** Search box in the open list; on by default for long lists. */
  searchable?: boolean;
}

const PAGE_STEP = 8;
const TYPE_AHEAD_RESET_MS = 700;
const DEFAULT_CLASS: Record<SelectTone, string> = {
  sky: 'rounded-lg border border-white/15 bg-[#142c35] px-3 py-2 text-xs text-white',
  game: 'gp-input',
};

/**
 * A drop-down list that replaces the browser's `<select>`: same look on every system, a search box for long lists, option hints
 * and groups, and full keyboard use (arrows, Home / End, Page Up / Down, Enter, Esc, type-ahead).
 */
export function Select<V extends string>({
  value, options, onChange, id, 'aria-label': ariaLabel, className, tone = 'sky', disabled, placeholder = 'Chọn…', searchable,
}: Props<V>) {
  const listId = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const typed = useRef({ text: '', at: 0 });
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(-1);
  const withSearch = searchable ?? options.length > SEARCH_THRESHOLD;
  const shown = useMemo(() => filterOptions(options, withSearch ? query : ''), [options, query, withSearch]);
  const style = usePopoverPosition(trigger, open);
  const current = options.find((option) => option.value === value);

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!trigger.current?.contains(target) && !popup.current?.contains(target)) setOpen(false);
    };
    document.addEventListener('pointerdown', closeOutside, true);
    return () => document.removeEventListener('pointerdown', closeOutside, true);
  }, [open]);

  const openList = () => {
    if (disabled) return;
    setQuery('');
    setActiveIndex(options.findIndex((option) => option.value === value));
    setOpen(true);
  };
  const close = (refocus: boolean) => {
    setOpen(false);
    if (refocus) trigger.current?.focus();
  };
  const pick = (option: SelectOption) => {
    if (option.value !== value) onChange(option.value as V);
    close(true);
  };
  const updateQuery = (next: string) => {
    setQuery(next);
    const matches = filterOptions(options, next);
    setActiveIndex(matches.length ? stepIndex(matches, -1, 1) : -1);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
        event.preventDefault();
        openList();
      }
      return;
    }
    const move = (index: number) => {
      event.preventDefault();
      if (index >= 0) setActiveIndex(index);
    };
    switch (event.key) {
      case 'ArrowDown': return move(stepIndex(shown, activeIndex, 1));
      case 'ArrowUp': return move(stepIndex(shown, activeIndex < 0 ? shown.length : activeIndex, -1));
      case 'Home': return move(stepIndex(shown, -1, 1));
      case 'End': return move(stepIndex(shown, shown.length, -1));
      case 'PageDown': return move(Math.min(shown.length - 1, Math.max(0, activeIndex) + PAGE_STEP));
      case 'PageUp': return move(Math.max(0, activeIndex - PAGE_STEP));
      case 'Enter':
        event.preventDefault();
        if (shown[activeIndex] && !shown[activeIndex].disabled) pick(shown[activeIndex]);
        return;
      case 'Escape':
        event.preventDefault();
        event.stopPropagation();
        return close(true);
      case 'Tab': return close(false);
    }
    // without a search box, typing jumps to the option that starts with the letters typed
    if (!withSearch && event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const now = performance.now();
      typed.current = { text: now - typed.current.at > TYPE_AHEAD_RESET_MS ? event.key : typed.current.text + event.key, at: now };
      move(typeAheadIndex(shown, typed.current.text, typed.current.text.length > 1 ? activeIndex - 1 : activeIndex));
    }
  };

  return (
    <>
      <button ref={trigger} id={id} type="button" disabled={disabled} role="combobox" aria-label={ariaLabel}
        aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? listId : undefined}
        onClick={() => (open ? close(false) : openList())} onKeyDown={onKeyDown}
        className={`flex w-full min-w-0 items-center justify-between gap-2 text-left disabled:cursor-not-allowed disabled:opacity-50 ${className ?? DEFAULT_CLASS[tone]}`}>
        <span className={`min-w-0 flex-1 truncate ${current ? '' : 'opacity-50'}`}>{current?.label ?? placeholder}</span>
        <ChevronDown size={14} aria-hidden className={`shrink-0 opacity-60 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && createPortal(
        <div ref={popup}>
          <SelectListbox id={listId} options={shown} value={value} activeIndex={activeIndex} query={withSearch ? query : null} tone={tone}
            style={style} onQuery={updateQuery} onActivate={setActiveIndex} onPick={pick} onKeyDown={onKeyDown} />
        </div>,
        document.body,
      )}
    </>
  );
}

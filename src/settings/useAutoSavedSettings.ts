import { useCallback, useEffect, useRef, useState } from 'react';

export type AutoSaveStatus = 'idle' | 'saving' | 'saved' | 'error';

/** A settings object edited in place: every change is shown at once and saved shortly after. */
export interface AutoSavedSettings<T> {
  value: T;
  status: AutoSaveStatus;
  patch: (changes: Partial<T>) => void;
}

/** Sliders fire on every pixel; waiting this long after the last change writes storage once per gesture. */
const SAVE_DELAY_MS = 350;

/**
 * `save` must be a stable module function. A newer change supersedes the save in flight (only the latest result sets the
 * status), and a change still waiting when the component unmounts is saved straight away.
 */
export function useAutoSavedSettings<T extends object>(load: () => T, save: (value: T) => Promise<unknown>): AutoSavedSettings<T> {
  const [value, setValue] = useState(load);
  const [status, setStatus] = useState<AutoSaveStatus>('idle');
  const latestValue = useRef(value);
  const pendingValue = useRef<T | null>(null);
  const saveTimer = useRef<number | null>(null);
  const saveRequestId = useRef(0);

  const flush = useCallback(() => {
    if (saveTimer.current !== null) {
      window.clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    const next = pendingValue.current;
    if (!next) return;
    pendingValue.current = null;
    const requestId = ++saveRequestId.current;
    save(next).then(
      () => { if (requestId === saveRequestId.current) setStatus('saved'); },
      () => { if (requestId === saveRequestId.current) setStatus('error'); },
    );
  }, [save]);

  useEffect(() => flush, [flush]);

  const patch = useCallback((changes: Partial<T>) => {
    const next: T = { ...latestValue.current, ...changes };
    latestValue.current = next;
    pendingValue.current = next;
    setValue(next);
    setStatus('saving');
    if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(flush, SAVE_DELAY_MS);
  }, [flush]);

  return { value, status, patch };
}

const STATUS_SEVERITY: Record<AutoSaveStatus, number> = { idle: 0, saved: 1, saving: 2, error: 3 };

/** The status to show for a screen saving several stores: an error beats a save in progress, which beats a finished one. */
export const combineSaveStatus = (...statuses: AutoSaveStatus[]): AutoSaveStatus =>
  statuses.reduce((worst, status) => (STATUS_SEVERITY[status] > STATUS_SEVERITY[worst] ? status : worst), 'idle');

import { useSyncExternalStore } from 'react';
import type { UvEditorState, UvEditorStore } from './uvEditorStore';

/** The editor state for a panel; while something is dragged it refreshes at the store's slower UI pace. */
export const useUvEditorState = (store: UvEditorStore): UvEditorState => useSyncExternalStore(store.subscribe, store.getState);

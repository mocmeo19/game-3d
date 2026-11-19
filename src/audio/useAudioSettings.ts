import { useSyncExternalStore } from 'react';
import { sound } from './soundManager';

export const useAudioSettings = () => useSyncExternalStore(sound.subscribeSettings, sound.getSettings, sound.getSettings);

export const useAudioSaveState = () => useSyncExternalStore(
  sound.subscribeSettings, sound.getSettingsSaveState, sound.getSettingsSaveState,
);

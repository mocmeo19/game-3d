import React, { lazy, Suspense, useState, useRef, useEffect, useCallback, useReducer, useMemo } from 'react';
import { CharacterCanvas, CharacterCanvasRef } from './renderer/CharacterCanvas';
import { TitleBar } from './components/UI/TitleBar';
import { DetailsPanel, CharacterPanel, VoicePanel } from './components/UI/LeftPanels';
import { RightPanel } from './components/UI/RightPanel';
import { BottomControls } from './components/UI/BottomControls';
import { HomeScreen, GameKind } from './components/UI/HomeScreen';
import { useStances } from './lib/useStances';
import { PhotoModal } from './components/UI/PhotoModal';
import { Toast, SlotsModal, ShortcutsModal, ModalShell } from './components/UI/Overlays';
import { CharacterState, CameraViewPreset } from './types/character';
import {
  getInitialCharacter,
  HAIR_COLORS,
  FACE_MARKINGS
} from './constants/presets';
import { assetsOf, skinsOf } from './constants/equipment';
import { loadAutosave, saveAutosave, sanitizeState, makeThumb, isValidName, loadSlots, saveSlot, deleteSlot, Slot } from './lib/persistence';
import { CharacterSelect } from './components/UI/CharacterSelect';
import { BODY_SLIDERS, FACE_SLIDERS, SliderDef } from './constants/sliders';
import { sound } from './audio/soundManager';
import { GameLoadingScreen } from './loading/GameLoadingScreen';
import { loadLastPlayedGame } from './loading/lastPlayedGame';
import { SHOOTER_LOBBY_WEAPON_STYLE } from './constants/weaponStyles';

const GameScreen = lazy(() => import('./game/GameScreen').then(module => ({ default: module.GameScreen })));
const TorchScreen = lazy(() => import('./game/torch/TorchScreen').then(module => ({ default: module.TorchScreen })));
const TestLabScreen = lazy(() => import('./game/testlab/TestLabScreen').then(module => ({ default: module.TestLabScreen })));

const HISTORY_LIMIT = 50;
/** The profile keeps the character centred like a game lobby; its panels open over the right side only when asked for. */
const HOME_VIEW_SHIFT = 0;
/** Slider drags fire many updates; merge changes made within this window into one undo step. */
const COALESCE_MS = 500;
const CAMERA_KEYS: CameraViewPreset[] = ['face', 'portrait', 'waist', 'full', 'shoes'];

const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const rand = (min: number, span: number) => Number((min + Math.random() * span).toFixed(2));

/** Nudge every slider randomly around its default, staying inside its own range. */
const randomSet = <T extends object>(defs: SliderDef[], base: T): T => {
  const next = { ...base } as Record<string, number>;
  defs.forEach((d) => {
    const v = d.def + (Math.random() - 0.5) * (d.max - d.min) * 0.5;
    next[d.key] = Number(Math.min(d.max, Math.max(d.min, v)).toFixed(2));
  });
  return next as unknown as T;
};

type Screen = 'creator' | 'select' | 'home' | 'game';

/** Enter the profile at rest without changing the character's saved environment. */
const homeStage = (s: CharacterState): CharacterState => ({ ...s, pose: 'idle' });

export const App: React.FC = () => {
  // Start-up: no saved character → create one; exactly one → its home screen, ready to play; several → choose one.
  const [boot] = useState(() => {
    const slots = loadSlots();
    const filled = slots.flatMap((sl, i) => (sl ? [i] : []));
    const screen: Screen = filled.length === 0 ? 'creator' : filled.length === 1 ? 'home' : 'select';
    const first = filled.length ? slots[filled[0]]!.state : null;
    const state = first ? (screen === 'home' ? homeStage(first) : first) : loadAutosave() ?? getInitialCharacter();
    return { slots, screen, slot: filled.length ? filled[0] : null, state };
  });
  const [slots, setSlots] = useState<(Slot | null)[]>(boot.slots);
  /** The save slot the current character came from / is saved to. */
  const activeSlot = useRef<number | null>(boot.slot);
  const [initial] = useState<CharacterState>(boot.state);
  const [characterState, setCharacterState] = useState<CharacterState>(initial);

  // Undo/redo stack lives in a ref (mutated synchronously, so coalescing is exact); `bump` re-renders.
  const historyRef = useRef<{ stack: CharacterState[]; index: number }>({ stack: [initial], index: 0 });
  const lastPushRef = useRef<number>(0);
  const [, bump] = useReducer((n: number) => n + 1, 0);

  const [cameraView, setCameraView] = useState<CameraViewPreset>('full');
  const [turntableOn, setTurntableOn] = useState<boolean>(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [isSlotsOpen, setIsSlotsOpen] = useState<boolean>(false);
  const [isHelpOpen, setIsHelpOpen] = useState<boolean>(false);
  const [deleteCharacterSlot, setDeleteCharacterSlot] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  // After the character is created the app switches to the hero "home" screen
  const [screen, setScreen] = useState<Screen>(boot.screen);
  const [gameKind, setGameKind] = useState<GameKind>(loadLastPlayedGame);
  const [savingOutfit, setSavingOutfit] = useState(false);
  const [savingWeapon, setSavingWeapon] = useState(false);
  // stance poses on the home / select screens: shown on the stage only, never saved into the character
  const stances = useStances(screen === 'home' || screen === 'select');
  const stageState = useMemo(
    () => {
      const posedState = stances.pose && (screen === 'home' || screen === 'select')
        ? { ...characterState, pose: stances.pose }
        : characterState;
      return screen === 'home' && gameKind === 'arena'
        ? { ...posedState, environment: 'survival_lobby' as const, weaponStyle: SHOOTER_LOBBY_WEAPON_STYLE }
        : posedState;
    },
    [characterState, stances.pose, screen, gameKind]
  );
  const [createdAt, setCreatedAt] = useState<string | null>(null);

  const canvasRef = useRef<CharacterCanvasRef>(null);
  const toastTimer = useRef<number | undefined>(undefined);

  const notify = useCallback((message: string) => {
    setToast(message);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2600);
  }, []);

  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

  useEffect(() => {
    const unlock = () => sound.unlock();
    const click = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      const control = target?.closest('button, [role="button"], input[type="checkbox"], input[type="radio"]');
      if (control && !control.matches(':disabled, [aria-disabled="true"]') && !control.closest('[data-ui-sound="off"]')) sound.playFallbackClick();
    };
    const input = (event: Event) => {
      const target = event.target;
      if (target instanceof HTMLInputElement && ['range', 'color'].includes(target.type) && !target.closest('[data-ui-sound="off"]')) sound.playSliderTick();
      if (target instanceof HTMLSelectElement && !target.closest('[data-ui-sound="off"]')) sound.playFallbackClick();
    };
    const visibility = () => sound.setPageVisible(!document.hidden);
    document.addEventListener('pointerdown', unlock, true);
    document.addEventListener('keydown', unlock, true);
    document.addEventListener('click', click);
    document.addEventListener('input', input);
    document.addEventListener('visibilitychange', visibility);
    visibility();
    return () => {
      document.removeEventListener('pointerdown', unlock, true);
      document.removeEventListener('keydown', unlock, true);
      document.removeEventListener('click', click);
      document.removeEventListener('input', input);
      document.removeEventListener('visibilitychange', visibility);
      sound.setPageVisible(false);
    };
  }, []);

  useEffect(() => sound.setMusicScene(screen === 'game' ? gameKind : 'menu'), [screen, gameKind]);

  // Autosave (debounced) so a refresh never loses work
  useEffect(() => {
    const id = window.setTimeout(() => saveAutosave(characterState), 400);
    return () => window.clearTimeout(id);
  }, [characterState]);

  const updateCharacterState = useCallback((newState: CharacterState, recordHistory = true) => {
    setCharacterState(newState);
    if (!recordHistory) return;

    const hist = historyRef.current;
    const now = Date.now();
    const atTip = hist.index === hist.stack.length - 1;
    const coalesce = atTip && hist.index > 0 && now - lastPushRef.current < COALESCE_MS;
    lastPushRef.current = now;

    const stack = hist.stack.slice(0, hist.index + 1);
    if (coalesce) stack[stack.length - 1] = newState;
    else stack.push(newState);
    while (stack.length > HISTORY_LIMIT) stack.shift();
    historyRef.current = { stack, index: stack.length - 1 };
    bump();
  }, []);

  const goToHistory = useCallback((index: number) => {
    const hist = historyRef.current;
    if (index < 0 || index >= hist.stack.length) return;
    historyRef.current = { ...hist, index };
    lastPushRef.current = 0;
    // Name and lighting are never part of undo history, so keep the current ones
    setCharacterState((cur) => ({ ...hist.stack[index], name: cur.name, lightAngle: cur.lightAngle }));
    bump();
  }, []);

  const handleUndo = useCallback(() => goToHistory(historyRef.current.index - 1), [goToHistory]);
  const handleRedo = useCallback(() => goToHistory(historyRef.current.index + 1), [goToHistory]);

  const handleRandomize = useCallback(() => {
    const g = characterState.gender;
    const skin = pick(skinsOf(g).filter((x) => x.id !== 'toon01' && !x.id.includes('special_suit') && !x.id.startsWith('old_')));
    const randomized: CharacterState = {
      ...characterState,
      costume: pick(assetsOf('outfit', g)).id,
      shoes: pick(assetsOf('shoes', g)).id,
      skin: skin.id,
      body: randomSet(BODY_SLIDERS, { ...characterState.body }),
      face: randomSet(FACE_SLIDERS, { ...characterState.face }),
      cosmetics: {
        ...characterState.cosmetics,
        skinTone: skin.color,
        skinGloss: rand(0.4, 0.55),
        hairStyle: pick(assetsOf('hair', g)).id,
        hairColorPrimary: pick(HAIR_COLORS).hex,
        hairColorTips: pick(HAIR_COLORS).hex,
        faceMarking: pick(FACE_MARKINGS).id as CharacterState['cosmetics']['faceMarking']
      }
    };
    updateCharacterState(randomized);
  }, [characterState, updateCharacterState]);

  const handleExportPreset = () => {
    const exportData = {
      game: "Nam's Battle Royal",
      version: '2.0.0',
      exportedAt: new Date().toISOString(),
      ...characterState
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `${characterState.name || 'NamsBattleRoyal'}_appearance.bns`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
    notify('Đã xuất tệp cấu hình');
  };

  // Slot / code states are already sanitized; re-sanitize defensively
  const handleLoadState = (imported: CharacterState) => {
    const clean = sanitizeState(imported);
    if (clean) updateCharacterState(clean);
  };

  const handleImportFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const state = sanitizeState(JSON.parse(String(event.target?.result)));
        if (state) {
          sound.playTriumph();
          updateCharacterState(state);
          notify(`Đã nạp cấu hình "${state.name}"`);
        } else {
          notify('Tệp cấu hình ngoại hình không hợp lệ');
        }
      } catch {
        notify('Không đọc được tệp cấu hình');
      }
    };
    reader.readAsText(file);
  };

  const handleTakeScreenshot = useCallback(() => {
    const url = canvasRef.current?.takeScreenshot();
    if (url) setPhotoUrl(url);
  }, []);

  const handleCameraChange = useCallback((preset: CameraViewPreset) => {
    setCameraView(preset);
    canvasRef.current?.setCameraView(preset);
  }, []);

  const getThumb = async () => makeThumb(canvasRef.current?.takeScreenshot() ?? '');

  const anyModalOpen = !!photoUrl || isSlotsOpen || isHelpOpen || deleteCharacterSlot !== null;

  const handleSave = () => {
    if (!isValidName(characterState.name)) {
      notify('Hãy nhập tên nhân vật hợp lệ trước (2–18 chữ cái hoặc số)');
      return;
    }
    sound.playTriumph();
    void handleSaveCharacter();
  };

  const resetHistory = useCallback((state: CharacterState) => {
    historyRef.current = { stack: [state], index: 0 };
    lastPushRef.current = 0;
    bump();
  }, []);

  /** Open the profile while keeping saved character settings intact. */
  const enterHome = useCallback((state: CharacterState) => {
    setTurntableOn(false);
    setCharacterState(homeStage(state));
    resetHistory(state);
    setScreen('home');
    setCameraView('full');
    canvasRef.current?.setViewShift(HOME_VIEW_SHIFT);
    canvasRef.current?.setCameraView('full');
  }, [resetHistory]);

  // the stage framing of the screen the app started on
  useEffect(() => {
    if (boot.screen === 'home') {
      canvasRef.current?.setViewShift(HOME_VIEW_SHIFT);
      canvasRef.current?.setCameraView('full');
    } else if (boot.screen === 'select') {
      canvasRef.current?.setViewShift(0.08);
      canvasRef.current?.setCameraView('full');
    }
  }, [boot.screen]);

  const pickSlot = (i: number) => {
    const sl = slots[i];
    if (!sl) return;
    activeSlot.current = i;
    setCharacterState(sl.state);
  };

  const enterSelected = () => {
    const sl = activeSlot.current !== null ? slots[activeSlot.current] : null;
    if (sl) enterHome(sl.state);
  };

  /** Open a saved character in the creator; "Lưu" writes it back into the same slot, "Huỷ" returns to the list unchanged. */
  const editCharacter = (i: number) => {
    const sl = slots[i];
    if (!sl) return;
    activeSlot.current = i;
    setCharacterState(sl.state);
    resetHistory(sl.state);
    setScreen('creator');
    canvasRef.current?.setViewShift(0);
    canvasRef.current?.setCameraView('full');
  };

  const startNewCharacter = () => {
    const fresh = getInitialCharacter();
    activeSlot.current = null;
    setCharacterState(fresh);
    resetHistory(fresh);
    setScreen('creator');
    canvasRef.current?.setViewShift(0);
    canvasRef.current?.setCameraView('full');
  };

  const removeSlot = (i: number) => {
    deleteSlot(i);
    const next = loadSlots();
    setSlots(next);
    setScreen('select');
    const left = next.flatMap((sl, k) => (sl ? [k] : []));
    if (left.length === 0) return startNewCharacter();
    // keep the selection unless the deleted character was the selected one
    const keep = activeSlot.current !== null && left.includes(activeSlot.current) ? activeSlot.current : left[0];
    activeSlot.current = keep;
    setCharacterState(next[keep]!.state);
  };

  const showSelect = () => {
    const current = loadSlots();
    setSlots(current);
    const left = current.flatMap((sl, k) => (sl ? [k] : []));
    const i = activeSlot.current !== null && current[activeSlot.current] ? activeSlot.current : left[0];
    if (i !== undefined) {
      activeSlot.current = i;
      setCharacterState(current[i]!.state);
    } else {
      activeSlot.current = null;
    }
    setScreen('select');
    canvasRef.current?.setViewShift(0.08);
    canvasRef.current?.setCameraView('full');
  };

  const handleSaveCharacter = async () => {
    // Save into the slot being edited, or the first free slot for a new character.
    const thumb = await getThumb();
    const free = slots.findIndex((sl) => !sl);
    const idx = activeSlot.current ?? free;
    if (idx >= 0 && saveSlot(idx, characterState, thumb)) {
      activeSlot.current = idx;
      setSlots(loadSlots());
      sound.playCue('save');
      notify('Đã lưu nhân vật');
      enterHome(characterState);
    } else {
      notify('Đã hết ô lưu — nhân vật chưa được lưu');
      sound.playCue('error');
    }
  };

  const handleSaveOutfit = async () => {
    const index = activeSlot.current;
    const saved = index !== null ? loadSlots()[index] : null;
    if (index === null || !saved) {
      notify('Không tìm thấy ô lưu của nhân vật');
      return;
    }
    if (savingOutfit) return;
    setSavingOutfit(true);
    const state: CharacterState = {
      ...saved.state,
      costume: characterState.costume,
      shoes: characterState.shoes,
      hat: characterState.hat,
      gear: characterState.gear,
      cosmetics: {
        ...saved.state.cosmetics,
        wearColors: characterState.cosmetics.wearColors,
        outfitMain: characterState.cosmetics.outfitMain,
        outfitAccent: characterState.cosmetics.outfitAccent
      }
    };
    try {
      const thumb = await getThumb();
      if (saveSlot(index, state, thumb || saved.thumb)) {
        setSlots(loadSlots());
        sound.playCue('save');
        notify('Đã lưu trang phục cho nhân vật');
      } else {
        sound.playCue('error');
        notify('Không thể lưu trang phục. Bộ nhớ trình duyệt đã đầy hoặc không khả dụng.');
      }
    } catch {
      sound.playCue('error');
      notify('Không thể lưu trang phục. Vui lòng thử lại.');
    } finally {
      setSavingOutfit(false);
    }
  };

  const handleSaveWeapon = async () => {
    if (savingWeapon) return;
    const index = activeSlot.current;
    const saved = index !== null ? loadSlots()[index] : null;
    if (index === null || !saved) {
      sound.playCue('error');
      notify('Không tìm thấy ô lưu của nhân vật');
      return;
    }
    const state = { ...saved.state, weapon: characterState.weapon, weaponStyle: characterState.weaponStyle };
    setSavingWeapon(true);
    try {
      const thumb = await getThumb();
      if (saveSlot(index, state, thumb || saved.thumb)) {
        setSlots(loadSlots());
        sound.playCue('save');
        notify('Đã lưu vũ khí cho nhân vật');
      } else {
        sound.playCue('error');
        notify('Không thể lưu vũ khí. Bộ nhớ trình duyệt đã đầy hoặc không khả dụng.');
      }
    } catch {
      sound.playCue('error');
      notify('Không thể lưu vũ khí. Vui lòng thử lại.');
    } finally {
      setSavingWeapon(false);
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (screen !== 'creator') return;
      const el = e.target as HTMLElement | null;
      const typing = !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
      const mod = e.ctrlKey || e.metaKey;

      if (mod && !typing && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
        return;
      }
      if (mod && !typing && (e.key === 'y' || e.key === 'Y')) {
        e.preventDefault();
        handleRedo();
        return;
      }
      if (mod || e.altKey || typing || anyModalOpen) return;

      switch (e.key) {
        case 'r': case 'R': sound.playDiceRoll(); handleRandomize(); break;
        case 't': case 'T': setTurntableOn((v) => !v); break;
        case 's': case 'S': setIsSlotsOpen(true); break;
        case 'p': case 'P': sound.playCameraShutter(); handleTakeScreenshot(); break;
        case '?': setIsHelpOpen(true); break;
        case '1': case '2': case '3': case '4': case '5':
          handleCameraChange(CAMERA_KEYS[Number(e.key) - 1]);
          break;
        default: return;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleUndo, handleRedo, handleRandomize, handleTakeScreenshot, handleCameraChange, anyModalOpen, screen]);

  const hist = historyRef.current;

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black select-none">
      {/* Full-bleed 3D stage */}
      <div className={`absolute inset-0 ${screen === 'game' ? 'invisible pointer-events-none' : ''}`}>
        <CharacterCanvas ref={canvasRef} characterState={stageState} identity={activeSlot.current ?? 'new'} active={screen !== 'game'} autoRotate={turntableOn} lockView={screen === 'home'} showWeapons={screen === 'home'} />
      </div>

      {screen === 'creator' && (
        <>
      <TitleBar />

      {/* Left column: Nhân vật + Xem chi tiết + Giọng nói */}
      <div className="absolute left-4 top-16 bottom-28 w-64 z-10 flex flex-col gap-2 animate-rise-in">
        <div className="shrink-0">
          <CharacterPanel
            characterState={characterState}
            onNameChange={(name) => updateCharacterState({ ...characterState, name }, false)}
            onDelete={activeSlot.current !== null ? () => setDeleteCharacterSlot(activeSlot.current) : undefined}
          />
        </div>
        <div className="flex-1 min-h-0 flex flex-col gap-2 overflow-y-auto pr-0.5">
          <DetailsPanel
            characterState={characterState}
            onUpdateState={updateCharacterState}
            activeView={cameraView}
            onCameraChange={handleCameraChange}
            turntableOn={turntableOn}
            onToggleTurntable={() => setTurntableOn((v) => !v)}
            onTakeScreenshot={handleTakeScreenshot}
            onUpdateLightAngle={(angle) => updateCharacterState({ ...characterState, lightAngle: angle }, false)}
          />
          <VoicePanel characterState={characterState} onUpdateState={updateCharacterState} />
        </div>
      </div>

      {/* Right column: tabs and designer presets */}
      <div className="absolute right-4 top-4 bottom-28 w-72 z-10 flex flex-col animate-rise-in">
        <RightPanel
          characterState={characterState}
          onUpdateState={updateCharacterState}
          onCameraChange={handleCameraChange}
          onUndo={handleUndo}
          onRedo={handleRedo}
          canUndo={hist.index > 0}
          canRedo={hist.index < hist.stack.length - 1}
          onRandomize={handleRandomize}
        />
      </div>

      <BottomControls
        onCancel={showSelect}
        onSave={handleSave}
        onManage={() => setIsSlotsOpen(true)}
        onShowHelp={() => setIsHelpOpen(true)}
      />
        </>
      )}

      {screen === 'select' && (
        <CharacterSelect slots={slots} selected={activeSlot.current} onPick={pickSlot} onEnter={enterSelected} onEdit={editCharacter} onCreate={startNewCharacter} />
      )}


      {screen === 'home' && (
        <HomeScreen
          selectedGame={gameKind}
          onSelectGame={setGameKind}
          characterState={characterState}
          onUpdateState={updateCharacterState}
          onSaveOutfit={handleSaveOutfit}
          savingOutfit={savingOutfit}
          onSaveWeapon={handleSaveWeapon}
          savingWeapon={savingWeapon}
          onChooseCharacter={showSelect}
          onNotify={notify}
          createdAt={createdAt}
          turntableOn={turntableOn}
          onToggleTurntable={() => setTurntableOn((v) => !v)}
          stancePose={stances.pose}
          onStanceChoose={stances.choose}
          onStanceRandom={stances.random}
          onTryPlay={(game) => { sound.stopVoice(); setTurntableOn(false); setGameKind(game); setScreen('game'); }}
        />
      )}

      {screen === 'game' && <Suspense fallback={<GameLoadingScreen gameKind={gameKind} message="Đang mở màn chơi…" />}>
        {gameKind === 'torch' ? (
          <TorchScreen characterState={characterState} onExit={() => setScreen('home')} />
        ) : gameKind === 'testlab' ? (
          <TestLabScreen characterState={characterState} onExit={() => setScreen('home')} />
        ) : (
          <GameScreen characterState={characterState} onExit={() => setScreen('home')} />
        )}
      </Suspense>}

      <PhotoModal photoUrl={photoUrl} characterName={characterState.name} onClose={() => setPhotoUrl(null)} />

      {deleteCharacterSlot !== null && slots[deleteCharacterSlot] && <ModalShell title="Xoá nhân vật?" onClose={() => setDeleteCharacterSlot(null)}>
        <p className="text-sm text-gp-text">Bạn có chắc muốn xoá nhân vật <strong className="text-white">{slots[deleteCharacterSlot]!.state.name}</strong>? Thao tác này không thể hoàn tác.</p>
        <div className="flex justify-end gap-2 mt-4">
          <button className="gp-btn" onClick={() => setDeleteCharacterSlot(null)}>Huỷ</button>
          <button className="gp-btn border-rose-400/60! text-rose-200! hover:bg-rose-950/50!" onClick={() => {
            const slot = deleteCharacterSlot;
            setDeleteCharacterSlot(null);
            removeSlot(slot);
          }}>Xoá nhân vật</button>
        </div>
      </ModalShell>}

      <SlotsModal
        isOpen={isSlotsOpen}
        characterState={characterState}
        getThumb={getThumb}
        onLoad={handleLoadState}
        onExport={handleExportPreset}
        onImportFile={handleImportFile}
        onNotify={notify}
        onClose={() => {
          setIsSlotsOpen(false);
          setSlots(loadSlots());
        }}
      />

      <ShortcutsModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />

      <Toast message={toast} />
    </div>
  );
};

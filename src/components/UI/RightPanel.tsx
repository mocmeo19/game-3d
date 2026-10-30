import { SkinLibrary } from './SkinLibrary';
import { BodyTypeEditor } from './BodyTypeEditor';
import { GenderPicker } from './GenderPicker';
import React, { useEffect, useState } from 'react';
import { Dices, RotateCcw } from 'lucide-react';
import { CharacterState, CameraViewPreset } from '../../types/character';
import {
  FACE_MARKINGS,
  SKIN_TONES,
  HAIR_PALETTE,
  DEFAULT_BODY,
  DEFAULT_FACE,
  DEFAULT_COSMETICS
} from '../../constants/presets';
import { BODY_SLIDERS, FACE_SLIDERS, BODY_GROUPS, FACE_GROUPS, FACE_BASE_KEYS, BODY_BASE_KEYS, SliderDef, SliderGroup } from '../../constants/sliders';
import { Bi, Collapsible, ColorPicker, SliderRow, round2 } from './Panels';
import { EYE_STYLES, eyeStyleIcon } from '../../constants/eyes';
import { equipped, SLOTS, FACE_HAIR_SLOTS, FaceHairSlot, defaultFaceHairColor } from '../../constants/equipment';
import { EquipmentGrid, MarkingIcon } from './EquipmentGrid';
import { CostumeEditor } from './CostumeEditor';
import { sound } from '../../audio/soundManager';

type Tab = 'basic' | 'style' | 'face' | 'body';

interface RightPanelProps {
  characterState: CharacterState;
  onUpdateState: (s: CharacterState) => void;
  onCameraChange: (p: CameraViewPreset) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onRandomize: () => void;
}

const TABS: { key: Tab; ko: string; en: string; camera: CameraViewPreset }[] = [
  { key: 'basic', ko: 'Cơ bản', en: 'Basic', camera: 'portrait' },
  { key: 'style', ko: 'Trang điểm mặt', en: 'Styling', camera: 'face' },
  { key: 'face', ko: 'Chỉnh chi tiết mặt', en: 'Face detail', camera: 'face' },
  { key: 'body', ko: 'Chỉnh chi tiết cơ thể', en: 'Body detail', camera: 'full' }
];

type MakeupKey = 'eyeIrisColor' | 'eyeshadowColor' | 'lipColor' | 'blushColor' | 'faceMarkingColor';
const MAKEUP_TARGETS: [MakeupKey, string][] = [
  ['eyeshadowColor', 'Phấn mắt'],
  ['blushColor', 'Má hồng'],
  ['lipColor', 'Môi']
];


const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export const RightPanel: React.FC<RightPanelProps> = ({
  characterState,
  onUpdateState,
  onCameraChange,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onRandomize
}) => {
  const [tab, setTab] = useState<Tab>('basic');
  const [open, setOpen] = useState<string>('');
  const [hairTarget, setHairTarget] = useState<'root' | 'tip'>('root');
  const [makeupTarget, setMakeupTarget] = useState<MakeupKey>('lipColor');

  const cos = characterState.cosmetics;

  const toggle = (id: string) => setOpen((cur) => (cur === id ? '' : id));

  const setBody = (key: string, v: number) => {
    sound.playSliderTick();
    onUpdateState({ ...characterState, body: { ...characterState.body, [key]: Number(v.toFixed(3)) } });
  };
  const setFace = (key: string, v: number) => {
    sound.playSliderTick();
    onUpdateState({ ...characterState, face: { ...characterState.face, [key]: round2(v) } });
  };
  const setCos = (key: keyof CharacterState['cosmetics'], v: unknown) =>
    onUpdateState({ ...characterState, cosmetics: { ...cos, [key]: v } });

  const randomizeGroup = (group: 'body' | 'face', defs: SliderDef[]) => {
    sound.playDiceRoll();
    const next: Record<string, number> = { ...characterState[group] };
    defs.forEach((d) => {
      next[d.key] = round2(clamp(d.def + (Math.random() - 0.5) * (d.max - d.min) * 0.5, d.min, d.max));
    });
    onUpdateState({ ...characterState, [group]: next });
  };
  const resetGroup = (group: 'body' | 'face') => {
    sound.playClick();
    onUpdateState({ ...characterState, [group]: group === 'body' ? { ...DEFAULT_BODY } : { ...DEFAULT_FACE } });
  };

  /** Palette + custom picker for one of the make-up / marking colours. */
  const renderMakeupColor = (key: MakeupKey) => {
    const current = cos[key].toLowerCase();
    // "Không" (first cell): the make-up layer behind this colour switched off; picking a colour again switches it back on
    const none: { off: boolean; set: Partial<CharacterState['cosmetics']>; on: Partial<CharacterState['cosmetics']> } | null =
      key === 'eyeshadowColor' ? { off: !cos.eyeshadowIntensity, set: { eyeshadowIntensity: 0 }, on: { eyeshadowIntensity: DEFAULT_COSMETICS.eyeshadowIntensity } }
      : key === 'blushColor' ? { off: !cos.blushIntensity, set: { blushIntensity: 0 }, on: { blushIntensity: DEFAULT_COSMETICS.blushIntensity } }
      : key === 'lipColor' ? { off: !!cos.lipOff, set: { lipOff: true }, on: { lipOff: false } }
      : key === 'faceMarkingColor' ? { off: cos.faceMarking === 'none', set: { faceMarking: 'none' }, on: {} }
      : null;
    const isCustom = !HAIR_PALETTE.some((c) => c.toLowerCase() === current);
    return (
      <>
        <div className="mt-1.5 grid grid-cols-12 gap-[3px] bg-black/40 p-1.5 border border-gp-line">
          {none && (
            <button
              aria-label="Không"
              title="Không"
              aria-pressed={none.off}
              onClick={() => {
                sound.playClick();
                onUpdateState({ ...characterState, cosmetics: { ...cos, ...none.set } });
              }}
              className={`aspect-square border relative overflow-hidden bg-[#15161a] ${none.off ? 'border-white ring-2 ring-gp-hot z-10 scale-110' : 'border-black/60'} transition-transform`}
            >
              <span className="absolute left-[-20%] top-1/2 w-[140%] h-[2px] bg-red-500 -rotate-45" />
            </button>
          )}
          {HAIR_PALETTE.map((c, i) => (
            <button
              key={`${c}-${i}`}
              aria-label={c}
              aria-pressed={!none?.off && current === c.toLowerCase()}
              onClick={() => {
                sound.playClick();
                onUpdateState({ ...characterState, cosmetics: { ...cos, ...(none?.on ?? {}), [key]: c } });
              }}
              className={`aspect-square border ${!none?.off && current === c.toLowerCase() ? 'border-white ring-2 ring-gp-hot z-10 scale-110' : 'border-black/60'} transition-transform`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
        <label className="mt-2 flex items-center gap-2 text-[11px] text-gp-text cursor-pointer">
          <input
            type="color"
            value={cos[key]}
            onChange={(e) => setCos(key, e.target.value)}
            aria-label="Màu tùy chọn"
            className={`gp-color w-6 h-6 rounded-full border ${isCustom ? 'border-gp-hot' : 'border-gp-line'}`}
          />
          Tùy chọn
        </label>
      </>
    );
  };

  /** Palette + custom picker for a brow / lash / beard colour; no pick = follow the hair (lashes: near-black). */
  const renderFaceHairColor = (slot: FaceHairSlot, label: string) => {
    const own = cos.wearColors?.[slot];
    const value = own || defaultFaceHairColor(cos, slot);
    const current = value.toLowerCase();
    const disabled = slot === 'beard' && !equipped(characterState, 'beard');
    const setColor = (hex: string | undefined) => {
      const next = { ...(cos.wearColors ?? {}) };
      if (hex) next[slot] = hex;
      else delete next[slot];
      onUpdateState({ ...characterState, cosmetics: { ...cos, wearColors: next } });
    };
    return (
      <div className={`mt-1.5 ${disabled ? 'opacity-40 pointer-events-none' : ''}`}>
        <div className="grid grid-cols-12 gap-[3px] bg-black/40 p-1.5 border border-gp-line">
          {HAIR_PALETTE.slice(0, 24).map((c, i) => (
            <button
              key={`${c}-${i}`}
              aria-label={`${label} ${c}`}
              aria-pressed={current === c.toLowerCase()}
              onClick={() => {
                sound.playClick();
                setColor(c);
              }}
              className={`aspect-square border ${current === c.toLowerCase() ? 'border-white ring-2 ring-gp-hot z-10 scale-110' : 'border-black/60'} transition-transform`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
        <div className="mt-1.5 flex items-center justify-between gap-1.5">
          <label className="flex items-center gap-2 text-[11px] text-gp-text cursor-pointer">
            <input
              type="color"
              value={value}
              onChange={(e) => setColor(e.target.value)}
              aria-label={`Màu ${label} tùy chọn`}
              className={`gp-color w-6 h-6 rounded-full border ${own ? 'border-gp-hot' : 'border-gp-line'}`}
            />
            Tùy chọn
          </label>
          <button
            className="gp-btn py-0.5! px-2! text-[10px]"
            disabled={!own}
            title={slot === 'eyelashes' ? 'Trả lông mi về màu gốc' : `${label} theo màu tóc`}
            onClick={() => {
              sound.playClick();
              setColor(undefined);
            }}
          >
            {slot === 'eyelashes' ? 'Đặt lại' : 'Theo tóc'}
          </button>
        </div>
      </div>
    );
  };

  const bodyDefs = (keys: string[]) => BODY_SLIDERS.filter((s) => keys.includes(s.key));
  const faceDefs = (keys: string[]) => FACE_SLIDERS.filter((s) => keys.includes(s.key));
  const bodyRow = (s: SliderDef) => (
    <SliderRow key={s.key} def={s} value={characterState.body[s.key as keyof CharacterState['body']]} onChange={(v) => setBody(s.key, v)} />
  );
  const faceRow = (s: SliderDef) => (
    <SliderRow key={s.key} def={s} value={characterState.face[s.key as keyof CharacterState['face']]} onChange={(v) => setFace(s.key, v)} />
  );

  /** One bordered group box (Mũi / Miệng / Cằm …) with its sliders, as in the game. */
  const renderGroup = (g: SliderGroup, row: (s: SliderDef) => React.ReactNode) => (
    <div key={g.id} className="border border-gp-line bg-black/30">
      <div className="px-2 py-1 text-[12px] text-white bg-linear-to-b from-[#2b2b2b] to-[#1e1e1e] border-b border-gp-line">
        <Bi ko={g.ko} en={g.en} />
      </div>
      <div className="px-2 py-1">{g.sliders.map(row)}</div>
    </div>
  );

  /* ───────── Appearance step ───────── */
  return (
    <section className="flex flex-col max-h-full">
      <div className="flex gap-0.5 px-0.5" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => {
              sound.playClick();
              setTab(t.key);
              onCameraChange(t.camera);
            }}
            className={`gp-tab ${tab === t.key ? 'is-on' : ''} leading-tight`}
          >
            <span className="block">{t.ko}</span>
          </button>
        ))}
      </div>

      <div className="gp flex flex-col min-h-0 rounded-t-none">
        <div className="overflow-y-auto min-h-0">
          {/* ===== Cơ bản Basic ===== */}
          {tab === 'basic' && (
            <>
              <div className="p-2 border-b border-gp-line">
                <GenderPicker gender={characterState.gender} onChange={(gender) => onUpdateState({ ...characterState, gender })} />
              </div>
              <Collapsible title={<Bi ko="Khuôn mặt cơ bản" en="Face base" />} open={open === 'faceBase'} onToggle={() => toggle('faceBase')}>
                {faceDefs(FACE_BASE_KEYS).map(faceRow)}
              </Collapsible>

              <Collapsible title={<Bi ko="Da" en="Skin" />} open={open === 'skin'} onToggle={() => toggle('skin')}>
                <div className="text-[11px] text-white mb-1">Kiểu da</div>
                <SkinLibrary state={characterState} onPick={(id, color) => {
                  sound.playClick();
                  onUpdateState({ ...characterState, skin: id, cosmetics: { ...cos, skinTone: color } });
                }} />
                <div className="text-[11px] text-white mt-2 mb-1">Sắc độ da</div>
                <ColorPicker tile colors={SKIN_TONES} value={cos.skinTone} onPick={(hex) => setCos('skinTone', hex)} />
                <div className="mt-2">
                  <SliderRow
                    def={{ key: 'skinGloss', label: 'Độ bóng', ko: 'Độ bóng da', min: 0, max: 1, step: 0.02, def: 0.75 }}
                    value={cos.skinGloss}
                    onChange={(v) => setCos('skinGloss', round2(v))}
                  />
                </div>
              </Collapsible>

              <Collapsible title={<Bi ko="Kiểu tóc" en="Hairstyle" />} open={open === 'hair'} onToggle={() => toggle('hair')}>
                <EquipmentGrid slot="hair" state={characterState} onChange={onUpdateState} cols={5} noneLabel="Hói" />

                <div className="mt-3 flex items-center justify-between">
                  <span className="text-[11px] text-white">
                    <Bi ko="Màu tóc" en="Hair Color" />
                  </span>
                  <div className="flex gap-1">
                    {(['root', 'tip'] as const).map((t) => (
                      <button key={t} onClick={() => setHairTarget(t)} className={`gp-btn py-0.5! px-2! text-[10px] ${hairTarget === t ? 'is-on' : ''}`}>
                        {t === 'root' ? 'Gốc' : 'Ngọn'}
                      </button>
                    ))}
                  </div>
                </div>
                {(() => {
                  const key = hairTarget === 'root' ? 'hairColorPrimary' : 'hairColorTips';
                  const current = cos[key].toLowerCase();
                  const isCustom = !HAIR_PALETTE.some((c) => c.toLowerCase() === current);
                  return (
                    <>
                      <div className="mt-1 grid grid-cols-12 gap-[3px] bg-black/40 p-1.5 border border-gp-line">
                        {HAIR_PALETTE.map((c, i) => (
                          <button
                            key={`${c}-${i}`}
                            aria-label={c}
                            aria-pressed={current === c.toLowerCase()}
                            onClick={() => {
                              sound.playClick();
                              setCos(key, c);
                            }}
                            className={`aspect-square border ${current === c.toLowerCase() ? 'border-white ring-2 ring-gp-hot z-10 scale-110' : 'border-black/60'} transition-transform`}
                            style={{ backgroundColor: c }}
                          />
                        ))}
                      </div>
                      <label className="mt-2 flex items-center gap-2 text-[11px] text-gp-text cursor-pointer">
                        <input
                          type="color"
                          value={cos[key]}
                          onChange={(e) => setCos(key, e.target.value)}
                          aria-label="Màu tóc tùy chọn"
                          className={`gp-color w-6 h-6 rounded-full border ${isCustom ? 'border-gp-hot' : 'border-gp-line'}`}
                        />
                        Tùy chọn
                      </label>
                    </>
                  );
                })()}
                <div className="mt-2">
                  <SliderRow
                    def={{ key: 'hairGloss', label: 'Hair gloss', ko: 'Độ bóng tóc', min: 0, max: 1, step: 0.02, def: 0.85 }}
                    value={cos.hairGloss}
                    onChange={(v) => setCos('hairGloss', round2(v))}
                  />
                </div>
              </Collapsible>

              <Collapsible title={<Bi ko="Lông mày, lông mi, râu" en="Brows, lashes, beard" />} open={open === 'facePartsSel'} onToggle={() => toggle('facePartsSel')}>
                {SLOTS.filter((sl) => sl.group === 'face').map((sl) => (
                  <div key={sl.id} className="mb-2">
                    <div className="text-[11px] text-white mb-1">{sl.label}</div>
                    <EquipmentGrid slot={sl.id} state={characterState} onChange={onUpdateState} cols={5} tall={false} maxHeight={150} noneLabel={sl.id === 'beard' ? 'Không' : 'Mặc định'} />
                    {(FACE_HAIR_SLOTS as string[]).includes(sl.id) && renderFaceHairColor(sl.id as FaceHairSlot, sl.label)}
                  </div>
                ))}
              </Collapsible>

              <Collapsible title={<Bi ko="Trang phục" en="Costume" />} open={open === 'costume'} onToggle={() => toggle('costume')}>
                <CostumeEditor characterState={characterState} onUpdateState={onUpdateState} />
              </Collapsible>

              <Collapsible title={<Bi ko="Thể hình" en="Body type" />} open={open === 'body'} onToggle={() => toggle('body')}>
                <BodyTypeEditor body={characterState.body} onChange={setBody} />
              </Collapsible>

            </>
          )}

          {/* ===== Trang điểm mặt Styling ===== */}
          {tab === 'style' && (
            <>
              <Collapsible title={<Bi ko="Họa tiết" en="Face marking" />} open={open !== 'makeup'} onToggle={() => setOpen('')}>
                <div className="grid grid-cols-3 gap-1 bg-black/40 p-1 border border-gp-line">
                  {FACE_MARKINGS.map((fm) => {
                    const selected = cos.faceMarking === fm.id;
                    return (
                      <button
                        key={fm.id}
                        title={fm.name}
                        aria-label={fm.name}
                        aria-pressed={selected}
                        onClick={() => {
                          sound.playClick();
                          setCos('faceMarking', fm.id);
                        }}
                        className={`gp-thumb ${selected ? 'is-sel' : ''} aspect-square overflow-hidden relative`}
                      >
                        <MarkingIcon id={fm.id} state={characterState} />
                        <span className="absolute inset-x-0 bottom-0 bg-black/60 text-[9px] leading-tight text-gp-text py-0.5 px-1 truncate">{fm.name}</span>
                      </button>
                    );
                  })}
                </div>
                <p className="mt-1 text-[11px] text-gp-text">{FACE_MARKINGS.find((fm) => fm.id === cos.faceMarking)?.name}</p>
                {cos.faceMarking !== 'none' && (
                  <>
                    <div className="mt-2 text-[11px] text-white flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full border border-white/50 shrink-0" style={{ backgroundColor: cos.faceMarkingColor }} />
                      Màu họa tiết
                    </div>
                    {renderMakeupColor('faceMarkingColor')}
                  </>
                )}
              </Collapsible>

              <Collapsible title={<Bi ko="Trang điểm" en="Makeup" />} open={open === 'makeup'} onToggle={() => toggle('makeup')}>
                <button
                  onClick={() => {
                    sound.playClick();
                    onUpdateState({ ...characterState, cosmetics: { ...cos, eyeshadowIntensity: 0, blushIntensity: 0, lipOff: true, faceMarking: 'none' } });
                  }}
                  className={`gp-btn w-full mb-2 py-1! text-[11px] ${!cos.eyeshadowIntensity && !cos.blushIntensity && cos.lipOff && cos.faceMarking === 'none' ? 'is-on' : ''}`}
                >
                  Không trang điểm
                </button>
                <div className="text-[11px] text-white mb-1">
                  <Bi ko="Màu trang điểm" en="Makeup colour" />
                </div>
                <div className="grid grid-cols-3 gap-1">
                  {MAKEUP_TARGETS.map(([key, label]) => (
                    <button
                      key={key}
                      aria-pressed={makeupTarget === key}
                      onClick={() => setMakeupTarget(key)}
                      className={`gp-btn py-1! px-1! text-[10px] flex items-center justify-center gap-1 ${makeupTarget === key ? 'is-on' : ''}`}
                    >
                      <span className="w-2.5 h-2.5 rounded-full border border-white/50 shrink-0" style={{ backgroundColor: cos[key] }} />
                      {label}
                    </button>
                  ))}
                </div>
                {renderMakeupColor(makeupTarget)}
                <div className="mt-2 text-[11px] text-white mb-1">Kiểu mắt có sẵn ({EYE_STYLES.length})</div>
                <div className="grid grid-cols-6 gap-1 max-h-40 overflow-y-auto p-0.5" role="radiogroup" aria-label="Kiểu mắt có sẵn">
                  <button
                    role="radio"
                    aria-checked={!cos.eyeStyle}
                    title="Mắt mặc định: tự chọn màu mống mắt và hình đồng tử"
                    onClick={() => {
                      sound.playClick();
                      setCos('eyeStyle', undefined);
                    }}
                    className={`aspect-square border text-[9px] leading-tight ${!cos.eyeStyle ? 'border-gp-hot text-gp-hot' : 'border-gp-line text-gp-mute'}`}
                  >
                    Tự chỉnh
                  </button>
                  {EYE_STYLES.map((e) => (
                    <button
                      key={e.id}
                      role="radio"
                      aria-checked={cos.eyeStyle === e.id}
                      title={`${e.name} · ${e.author}`}
                      onClick={() => {
                        sound.playClick();
                        setCos('eyeStyle', e.id);
                      }}
                      className={`aspect-square border p-0.5 bg-black/40 ${cos.eyeStyle === e.id ? 'border-gp-hot ring-1 ring-gp-hot' : 'border-gp-line hover:border-white/50'}`}
                    >
                      <img src={eyeStyleIcon(e.id)} alt={e.name} loading="lazy" className="w-full h-full object-contain" />
                    </button>
                  ))}
                </div>
                <div className="mt-2">
                  {(
                    [
                      ['eyeshadowIntensity', 'Eyeshadow', 'Độ đậm phấn mắt'],
                      ['blushIntensity', 'Blush', 'Độ đậm má hồng'],
                      ['lipIntensity', 'Lipstick', 'Độ đậm son môi'],
                      ['lipGloss', 'Lip gloss', 'Độ bóng môi']
                    ] as const
                  ).map(([key, label, ko]) => (
                    <SliderRow
                      key={key}
                      def={{ key, label, ko, min: 0, max: 1, step: 0.02, def: 0.4 }}
                      value={cos[key]}
                      onChange={(v) => setCos(key, round2(v))}
                    />
                  ))}
                </div>
              </Collapsible>
            </>
          )}

          {/* ===== Chỉnh chi tiết mặt ===== */}
          {tab === 'face' && (
            <div className="p-2 space-y-2">
              <div className="grid grid-cols-2 gap-1.5">
                <button className="gp-btn flex items-center justify-center gap-1" onClick={() => randomizeGroup('face', FACE_SLIDERS)}>
                  <Dices size={12} /> Ngẫu nhiên
                </button>
                <button className="gp-btn flex items-center justify-center gap-1" onClick={() => resetGroup('face')}>
                  <RotateCcw size={12} /> Đặt lại
                </button>
              </div>
              {FACE_GROUPS.map((g) => renderGroup(g, faceRow))}
            </div>
          )}

          {/* ===== Chỉnh chi tiết cơ thể ===== */}
          {tab === 'body' && (
            <div className="p-2 space-y-2">
              <div className="grid grid-cols-2 gap-1.5">
                <button className="gp-btn flex items-center justify-center gap-1" onClick={() => randomizeGroup('body', BODY_SLIDERS)}>
                  <Dices size={12} /> Ngẫu nhiên
                </button>
                <button className="gp-btn flex items-center justify-center gap-1" onClick={() => resetGroup('body')}>
                  <RotateCcw size={12} /> Đặt lại
                </button>
              </div>
              {BODY_GROUPS.map((g) => renderGroup(g, bodyRow))}
            </div>
          )}
        </div>

        {/* Footer: Hoàn tác / Làm lại / Ngẫu nhiên */}
        <div className="flex items-center gap-1.5 p-2 border-t border-gp-line bg-black/40 shrink-0">
          <button className="gp-btn" disabled={!canUndo} onClick={onUndo} title="Ctrl+Z">
            Hoàn tác
          </button>
          <button className="gp-btn" disabled={!canRedo} onClick={onRedo} title="Ctrl+Y">
            Làm lại
          </button>
          <button
            className="gp-btn ml-auto"
            onClick={() => {
              sound.playDiceRoll();
              onRandomize();
            }}
            title="R"
          >
            Ngẫu nhiên
          </button>
        </div>
      </div>
    </section>
  );
};

import { SkinLibrary } from './SkinLibrary';
import { BodyTypeEditor } from './BodyTypeEditor';
import { LynAppearanceEditor } from './LynAppearanceEditor';
import React, { useEffect, useState } from 'react';
import { Dices, RotateCcw } from 'lucide-react';
import {
  CharacterState,
  CameraViewPreset,
  RaceType,
  ClassType,
  GenderType
} from '../../types/character';
import {
  RACES,
  CLASSES,
  MASTER_PRESETS,
  FACE_MARKINGS,
  SKIN_TONES,
  HAIR_PALETTE,
  DEFAULT_BODY,
  DEFAULT_FACE,
  DEFAULT_COSMETICS
} from '../../constants/presets';
import { BODY_SLIDERS, FACE_SLIDERS, BODY_GROUPS, FACE_GROUPS, FACE_BASE_KEYS, BODY_BASE_KEYS, SliderDef, SliderGroup } from '../../constants/sliders';
import { DESIGNER_PRESETS, DesignerPreset } from '../../constants/designerPresets';
import { Bi, Collapsible, ColorPicker, FaceAvatar, GamePanel, SliderRow, round2 } from './Panels';
import { EYE_STYLES, eyeStyleIcon } from '../../constants/eyes';
import { weaponModelIcon } from '../../constants/weaponModels';
import { weaponStyles, weaponStyleOf } from '../../constants/weaponStyles';
import { equipped, skinsOf, skinUrl, skinThumbUrl, skinInfo, defaultSkin, SLOTS, withClassLoadout, FACE_HAIR_SLOTS, FaceHairSlot, defaultFaceHairColor } from '../../constants/equipment';
import { EquipmentGrid, MarkingIcon } from './EquipmentGrid';
import { CostumeEditor } from './CostumeEditor';
import { sound } from '../../audio/soundManager';
import { RACE_MOD, STAT_LABELS, StatKey, heroStats, CLASS_SKILLS as HERO_SKILLS } from '../../constants/heroInfo';
import { SKILL_EVENT, skillsFor } from '../../renderer/character/skills';

export type Step = 'race' | 'class' | 'appearance';

/** Accent colour of each race (matches the glow in its card art). */
const RACE_ACCENT: Record<string, string> = { jin: '#2dd4bf', gon: '#c9a227', lyn: '#f59e0b', yun: '#f0a6c0' };
type Tab = 'basic' | 'style' | 'face' | 'body';

interface RightPanelProps {
  characterState: CharacterState;
  onUpdateState: (s: CharacterState) => void;
  onCameraChange: (p: CameraViewPreset) => void;
  step: Step;
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
  step,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onRandomize
}) => {
  const [tab, setTab] = useState<Tab>('basic');
  const [open, setOpen] = useState<string>('');
  const [designerId, setDesignerId] = useState<string | null>(null);
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

  // pre-rendered photographs of every designer preset on the avatar of the current race and gender (public/designer/<race>_<gender>/<id>.webp)
  const [missingShots, setMissingShots] = useState<Record<string, boolean>>({});
  // one set per skin (public/designer/<race>_<gender>/<skin>/<id>.webp); the default-skin set in the folder above is the fallback
  const shotSkin = skinInfo(characterState.skin, characterState.gender)?.id ?? defaultSkin(characterState.gender);
  const shotKey = (id: string, level: 0 | 1) => `${characterState.race}_${characterState.gender}/${level ? '' : shotSkin + '/'}${id}`;
  const shotUrl = (id: string) => `/designer/${shotKey(id, missingShots[shotKey(id, 0)] ? 1 : 0)}.webp`;

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

  const applyDesigner = (p: DesignerPreset) => {
    sound.playPluck(440);
    setDesignerId(p.id);
    onUpdateState({
      ...characterState,
      face: { ...p.face },
      cosmetics: {
        ...cos,
        skinTone: p.skinTone,
        hairStyle: p.hairStyle,
        hairColorPrimary: p.hairColorPrimary,
        hairColorTips: p.hairColorTips,
        lipColor: p.lipColor
      }
    });
  };

  const applyHero = (id: string) => {
    const p = MASTER_PRESETS.find((m) => m.id === id);
    if (!p) return;
    sound.playTriumph();
    onUpdateState({
      ...characterState,
      name: p.name,
      race: p.race,
      gender: p.gender,
      characterClass: p.characterClass,
      costume: p.costume,
      body: { ...DEFAULT_BODY, ...p.body },
      face: { ...DEFAULT_FACE, ...p.face },
      cosmetics: { ...p.cosmetics }
    });
  };

  const selectRace = (race: RaceType) => {
    sound.playPluck(330);
    const r = RACES[race];
    const next = {
      ...characterState,
      race,
      gender: r.availableGenders.includes(characterState.gender) ? characterState.gender : r.availableGenders[0]
    };
    // a class the new race cannot take is replaced by its first class, dressed in that class's starting gear
    onUpdateState(r.availableClasses.includes(characterState.characterClass) ? next : withClassLoadout(next, r.availableClasses[0]));
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

  /* ───────── Race step ───────── */
  if (step === 'race') {
    const race = RACES[characterState.race];
    const accent = RACE_ACCENT[race.id] ?? '#f0c64a';
    const mods = Object.entries(RACE_MOD[race.id] ?? {}) as [StatKey, number][];
    return (
      <GamePanel title={<Bi ko="Chủng tộc" en="Race" />} className="flex flex-col max-h-full">
        <div className="p-2 space-y-2 overflow-y-auto min-h-0">
          <div className="grid grid-cols-2 gap-1.5">
            {Object.values(RACES).map((r) => {
              const sel = characterState.race === r.id;
              const ac = RACE_ACCENT[r.id] ?? '#f0c64a';
              return (
                <button
                  key={r.id}
                  onClick={() => selectRace(r.id)}
                  aria-pressed={sel}
                  aria-label={`${r.name} — ${r.title}`}
                  className="group relative aspect-3/4 overflow-hidden border transition-all duration-200"
                  style={{
                    borderColor: sel ? '#f0c64a' : 'rgba(255,255,255,0.12)',
                    boxShadow: sel ? `0 0 0 1px #f0c64a, 0 0 14px ${ac}88` : undefined
                  }}
                >
                  <img
                    src={`/races/${r.id}.jpg`}
                    alt=""
                    draggable={false}
                    className={`absolute inset-0 w-full h-full object-cover transition-transform duration-300 ${sel ? 'scale-105' : 'group-hover:scale-105 opacity-80 group-hover:opacity-100'}`}
                  />
                  <span className="absolute inset-0 bg-linear-to-t from-black/90 via-black/20 to-transparent" />
                  <span className="absolute top-1 left-1 text-sm drop-shadow-sm">{r.emblem}</span>
                  <span className="absolute top-1 right-1 flex gap-0.5 text-[9px]">
                    {(['female', 'male'] as GenderType[]).map((g) => (
                      <span
                        key={g}
                        className="px-1 leading-4 bg-black/60 border border-white/15"
                        style={{ opacity: r.availableGenders.includes(g) ? 1 : 0.3 }}
                        title={g === 'female' ? 'Nữ' : 'Nam'}
                      >
                        {g === 'female' ? '♀' : '♂'}
                      </span>
                    ))}
                  </span>
                  <span className="absolute bottom-0 inset-x-0 p-1.5 text-left">
                    <span className="block text-[14px] font-semibold tracking-wide text-white drop-shadow-sm" style={{ color: sel ? '#f8dc84' : undefined }}>
                      {r.name}
                    </span>
                    <span className="block text-[9.5px] leading-tight text-white/70">{r.title}</span>
                    <span className="mt-1 block h-0.5 w-8" style={{ background: ac }} />
                  </span>
                </button>
              );
            })}
          </div>

          <div className="p-2 bg-black/45 border border-gp-line space-y-2" style={{ borderLeft: `2px solid ${accent}` }}>
            <div className="flex items-baseline justify-between">
              <span className="text-[14px] font-semibold text-gp-hot">
                {race.name}
              </span>
              <span className="text-[10px] text-gp-mute">{race.title}</span>
            </div>
            <p className="text-[11px] leading-relaxed text-gp-text">{race.lore}</p>
            <div className="flex flex-wrap gap-1">
              {race.traits.map((t) => (
                <span key={t} className="px-1.5 py-0.5 border text-[10px]" style={{ borderColor: `${accent}88`, color: accent, background: `${accent}14` }}>
                  {t}
                </span>
              ))}
            </div>

            <div>
              <div className="text-[10px] uppercase tracking-widest text-gp-mute mb-1">Thiên phú chỉ số</div>
              {mods.length ? (
                <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
                  {mods.map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between text-[11px]">
                      <span className="text-gp-text">{STAT_LABELS[k]}</span>
                      <span className={v > 0 ? 'text-emerald-400' : 'text-rose-400'}>{v > 0 ? `+${v}` : v}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-gp-text">Cân bằng — không cộng trừ chỉ số nào.</p>
              )}
            </div>

            <div>
              <div className="text-[10px] uppercase tracking-widest text-gp-mute mb-1">
                Lớp nhân vật ({race.availableClasses.length}/{Object.keys(CLASSES).length})
              </div>
              <div className="flex flex-wrap gap-1">
                {race.availableClasses.map((id) => {
                  const c = CLASSES[id];
                  if (!c) return null;
                  return (
                    <span
                      key={id}
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] border"
                      style={{ borderColor: `${c.color}77`, background: `${c.color}1a`, color: '#e8e2d4' }}
                      title={c.role}
                    >
                      <span>{c.badge}</span>
                      {c.name}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            {(['female', 'male'] as GenderType[]).map((g) => {
              const ok = race.availableGenders.includes(g);
              const on = characterState.gender === g;
              return (
                <button
                  key={g}
                  disabled={!ok}
                  onClick={() => {
                    sound.playClick();
                    // the class's starting gear differs per gender (many pieces exist for one gender only)
                    if (g !== characterState.gender) onUpdateState(withClassLoadout({ ...characterState, gender: g }, characterState.characterClass));
                  }}
                  className={`gp-btn h-9 flex items-center justify-center gap-1.5 ${on ? 'is-on' : ''}`}
                  title={ok ? undefined : `${race.name} không có giới tính này`}
                >
                  <span className="text-base leading-none">{g === 'female' ? '♀' : '♂'}</span>
                  {g === 'female' ? 'Nữ' : 'Nam'}
                </button>
              );
            })}
          </div>
          {race.availableGenders.length < 2 && <p className="text-[10px] text-gp-mute">{race.name} chỉ có nhân vật nữ.</p>}
        </div>
      </GamePanel>
    );
  }

  /* ───────── Class step ───────── */
  if (step === 'class') {
    const race = RACES[characterState.race];
    const available = race.availableClasses;
    const cls = CLASSES[characterState.characterClass];
    const { stats, power } = heroStats(cls.id, race.id);
    const field = HERO_SKILLS[cls.id]?.field ?? [];
    const moves = skillsFor(cls.id);
    const stars = (n: number) => '★'.repeat(n) + '☆'.repeat(5 - n);
    return (
      <GamePanel title={<Bi ko="Lớp nhân vật" en="Class" />} className="flex flex-col max-h-full">
        <div className="p-2 space-y-2 overflow-y-auto min-h-0">
          <div className="grid grid-cols-3 gap-1.5">
            {Object.values(CLASSES).map((c) => {
              const ok = available.includes(c.id as ClassType);
              const sel = characterState.characterClass === c.id;
              return (
                <button
                  key={c.id}
                  disabled={!ok}
                  aria-pressed={sel}
                  aria-label={c.name}
                  title={ok ? `${c.name} — ${c.role}` : `${c.name}: không có cho ${race.name}`}
                  onClick={() => {
                    sound.playBladeWhoosh();
                    onUpdateState(withClassLoadout(characterState, c.id));
                  }}
                  className="group relative aspect-4/5 overflow-hidden border text-left transition-all duration-200 disabled:cursor-not-allowed"
                  style={{
                    borderColor: sel ? '#f0c64a' : ok ? `${c.color}55` : 'rgba(255,255,255,0.08)',
                    background: `radial-gradient(circle at 50% 35%, ${c.color}${ok ? '55' : '22'} 0%, #121318 72%)`,
                    boxShadow: sel ? `0 0 0 1px #f0c64a, 0 0 12px ${c.color}99` : undefined,
                    opacity: ok ? 1 : 0.38
                  }}
                >
                  <span className={`absolute inset-x-0 top-[14%] text-center text-[26px] leading-none drop-shadow-sm transition-transform duration-200 ${sel ? 'scale-110' : 'group-hover:scale-110'}`}>
                    {c.badge}
                  </span>
                  {!ok && <span className="absolute top-1 right-1 text-[11px]">🔒</span>}
                  <span className="absolute inset-x-0 bottom-0 p-1 bg-linear-to-t from-black/90 to-transparent">
                    <span className="block text-[10.5px] font-semibold leading-tight truncate" style={{ color: sel ? '#f8dc84' : '#fff' }}>
                      {c.name}
                    </span>
                    <span className="block text-[8.5px] tracking-tight text-gp-hot/90">{stars(c.difficulty)}</span>
                  </span>
                </button>
              );
            })}
          </div>

          <div className="p-2 bg-black/45 border border-gp-line space-y-2" style={{ borderLeft: `2px solid ${cls.color}` }}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-[14px] font-semibold text-gp-hot">
                  {cls.badge} {cls.name}
                </div>
                <div className="text-[10px] text-gp-mute">
                  {cls.title} · {cls.role}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-[9px] uppercase tracking-widest text-gp-mute">Lực chiến</div>
                <div className="text-[13px] font-semibold text-gp-hot">{power.toLocaleString('vi-VN')}</div>
              </div>
            </div>
            <p className="text-[11px] leading-relaxed text-gp-text">{cls.description}</p>
            <div className="grid grid-cols-2 gap-1 text-[10px]">
              <span className="px-1.5 py-0.5 border border-gp-line text-gp-text">⚔ {cls.weaponName}</span>
              <span className="px-1.5 py-0.5 border border-gp-line text-gp-text">✦ {cls.primaryElement}</span>
            </div>

            <div>
              <div className="text-[10px] uppercase tracking-widest text-gp-mute mb-1">Vũ khí ({race.name})</div>
              <div className="grid grid-cols-2 gap-1" role="radiogroup" aria-label="Vũ khí">
                {weaponStyles(race.id, cls.id).map((w) => {
                  const on = weaponStyleOf(race.id, cls.id, characterState.weaponStyle).id === w.id;
                  return (
                    <button
                      key={w.id}
                      role="radio"
                      aria-checked={on}
                      title={w.desc}
                      onClick={() => {
                        sound.playClick();
                        onUpdateState({ ...characterState, weaponStyle: w.id });
                      }}
                      className={`text-left p-1.5 border text-[10px] leading-tight transition-colors ${on ? 'border-gp-hot bg-white/10 text-gp-hot' : 'border-gp-line text-gp-text hover:border-white/40'}`}
                    >
                      <span className="flex items-center gap-1.5">
                        {w.model ? (
                          <img src={weaponModelIcon(w.model)} alt="" loading="lazy" className="w-9 h-7 object-contain shrink-0 bg-black/40" />
                        ) : (
                          <span className="w-2.5 h-2.5 rounded-full shrink-0 border border-black/50" style={{ background: w.metal, boxShadow: `0 0 5px ${w.glow}` }} />
                        )}
                        <span className="font-semibold">{w.name}</span>
                      </span>
                      <span className="block mt-0.5 text-gp-mute">{w.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="text-[10px] uppercase tracking-widest text-gp-mute mb-1">Chỉ số ({race.name})</div>
              <div className="space-y-0.5">
                {(Object.keys(stats) as StatKey[]).map((k) => (
                  <div key={k} className="flex items-center gap-1.5 text-[10px]">
                    <span className="w-14 text-gp-text">{STAT_LABELS[k]}</span>
                    <span className="flex-1 h-1.5 bg-white/10 overflow-hidden">
                      <span className="block h-full" style={{ width: `${stats[k]}%`, background: `linear-gradient(90deg, ${cls.color}, #f0c64a)` }} />
                    </span>
                    <span className="w-6 text-right text-gp-mute">{stats[k]}</span>
                  </div>
                ))}
              </div>
            </div>

            {field.length > 0 && (
              <div>
                <div className="text-[10px] uppercase tracking-widest text-gp-mute mb-1">Kỹ năng tiêu biểu</div>
                <div className="space-y-1">
                  {field.map((sk) => (
                    <div key={sk.id} className="flex gap-1.5 text-[10.5px] leading-snug">
                      <span className="w-5 h-5 shrink-0 flex items-center justify-center border text-[11px]" style={{ borderColor: `${cls.color}88`, background: `${cls.color}22` }}>
                        {sk.icon}
                      </span>
                      <span>
                        <span className="text-white">{sk.name}</span>
                        <span className="text-gp-mute"> — {sk.desc}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {moves.length > 0 && (
              <div className="flex flex-wrap items-center gap-1">
                <span className="text-[10px] text-gp-mute">Chiêu biểu diễn:</span>
                {moves.map((m) => (
                  <button
                    key={m.id}
                    className="px-1.5 py-0.5 text-[10px] border border-gp-line text-gp-text hover:border-gp-hot hover:text-gp-hot"
                    onClick={() => {
                      sound.playBladeWhoosh();
                      window.dispatchEvent(new CustomEvent(SKILL_EVENT, { detail: m.id }));
                    }}
                  >
                    ▶ {m.ko}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </GamePanel>
    );
  }

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
              <Collapsible title={<Bi ko="Mẫu thiết kế" en="Designer presets" />} open={open === 'designer'} onToggle={() => toggle('designer')}>
                <div className="grid grid-cols-4 gap-1">
                  {DESIGNER_PRESETS.map((p, i) =>
                    !missingShots[shotKey(p.id, 1)] ? (
                      <button
                        key={p.id}
                        title={`Mẫu ${i + 1}`}
                        aria-label={`Mẫu ${i + 1}`}
                        aria-pressed={designerId === p.id}
                        onClick={() => applyDesigner(p)}
                        className={`gp-thumb ${designerId === p.id ? 'is-sel' : ''} relative aspect-square p-0 overflow-hidden bg-linear-to-b from-[#3b3f4a] to-[#15171c]`}
                      >
                        <img src={shotUrl(p.id)} alt="" draggable={false} loading="lazy" className="w-full h-full object-cover" onError={() => setMissingShots((m) => ({ ...m, [shotKey(p.id, missingShots[shotKey(p.id, 0)] ? 1 : 0)]: true }))} />
                        <span className="absolute bottom-0 right-0 px-1 text-[9px] leading-4 bg-black/55 text-white/80">{i + 1}</span>
                      </button>
                    ) : (
                      <FaceAvatar
                        key={p.id}
                        skin={p.skinTone}
                        hair={p.hairColorPrimary}
                        tip={p.hairColorTips}
                        lip={p.lipColor}
                        selected={designerId === p.id}
                        title={`Mẫu ${i + 1}`}
                        onClick={() => applyDesigner(p)}
                      />
                    )
                  )}
                </div>
              </Collapsible>

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
                {characterState.race === 'lyn' && <LynAppearanceEditor cosmetics={cos} onChange={(cosmetics) => {
                  const gear = { ...characterState.gear };
                  const wearColors = { ...cosmetics.wearColors };
                  if (cosmetics.tailType !== cos.tailType) delete gear.tail;
                  if (cosmetics.furColorPrimary !== cos.furColorPrimary) delete wearColors.tail;
                  onUpdateState({ ...characterState, gear, cosmetics: { ...cosmetics, wearColors } });
                }} />}
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

              <Collapsible title={<Bi ko="Mẫu anh hùng" en="Hero templates" />} open={open === 'heroes'} onToggle={() => toggle('heroes')}>
                <div className="space-y-1">
                  {MASTER_PRESETS.map((m) => (
                    <button key={m.id} onClick={() => applyHero(m.id)} className="gp-row" title={m.description}>
                      <span className="flex-1">
                        <span className="block text-[12px]">{m.name}</span>
                        <span className="block text-[10px] text-gp-mute">{m.characterTitle}</span>
                      </span>
                      <span className="text-[9px] text-gp-hot uppercase">{m.race}</span>
                    </button>
                  ))}
                </div>
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

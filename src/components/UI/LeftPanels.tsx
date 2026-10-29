import React, { useState } from 'react';
import { Camera, Dices, RefreshCw, Trash2 } from 'lucide-react';
import { CharacterState, CameraViewPreset, BuiltinPose, EnvironmentType, ExpressionId } from '../../types/character';
import { MPFB_PREFIX, POSE_GROUPS, poseTitle, useMpfbPoses } from '../../constants/mpfbPoses';
import { MIXAMO_GROUPS, MIXAMO_PREFIX, useMixamoClips } from '../../constants/mixamoPoses';
import { ENVIRONMENTS } from '../../constants/presets';
import { isValidName, randomName } from '../../lib/persistence';
import { Bi, Collapsible, GamePanel } from './Panels';
import { LightingCompass } from './LightingCompass';
import { voicesFor, resolveVoice } from '../../constants/voices';
import { sound } from '../../audio/soundManager';
import { VoicePreview } from './VoicePreview';
import { Select } from './select/Select';

const VIEWS: { id: CameraViewPreset; ko: string }[] = [
  { id: 'face', ko: 'Mặt' },
  { id: 'portrait', ko: 'Nửa trên' },
  { id: 'waist', ko: 'Eo' },
  { id: 'full', ko: 'Toàn thân' },
  { id: 'shoes', ko: 'Chân' }
];

/** Region of the body (top / bottom in the 0–40 icon space) each camera view frames. */
const VIEW_BAND: Record<CameraViewPreset, [number, number]> = {
  face: [1, 10],
  portrait: [1, 19],
  waist: [11, 26],
  full: [0.5, 39.5],
  shoes: [31, 39.5]
};

/** Camera view thumbnail: a figure with the framed part lit and a viewfinder around it. */
const ViewIcon: React.FC<{ view: CameraViewPreset; on: boolean }> = ({ view, on }) => {
  const [y0, y1] = VIEW_BAND[view];
  const id = `vb-${view}`;
  const figure = (
    <>
      <circle cx="12" cy="5" r="3.6" />
      <path d="M12 9.6c-3.6 0-5.6 1.6-6.2 4.4l-1.4 7.6c-.2 1 .5 1.6 1.3 1.4l1.4-.4.5-5.2.6 7.6-1 13.8c0 .8.5 1.2 1.2 1.2h1.3l1.4-12h1.8l1.4 12h1.3c.7 0 1.2-.4 1.2-1.2l-1-13.8.6-7.6.5 5.2 1.4.4c.8.2 1.5-.4 1.3-1.4L18.2 14c-.6-2.8-2.6-4.4-6.2-4.4z" />
    </>
  );
  const c = on ? '#f8dc84' : '#d9d2c3';
  return (
    <svg viewBox="0 0 24 40" className="h-7 w-5" aria-hidden>
      <defs>
        <clipPath id={id}>
          <rect x="0" y={y0} width="24" height={y1 - y0} />
        </clipPath>
      </defs>
      <g fill={c} opacity="0.22">{figure}</g>
      <g fill={c} clipPath={`url(#${id})`}>{figure}</g>
      <path
        d={`M1.5 ${y0 + 2.5}V${y0}H4.5 M19.5 ${y0}H22.5V${y0 + 2.5} M22.5 ${y1 - 2.5}V${y1}H19.5 M4.5 ${y1}H1.5V${y1 - 2.5}`}
        fill="none"
        stroke={on ? '#f0c64a' : '#9a9080'}
        strokeWidth="1"
      />
    </svg>
  );
};

const POSES: { id: BuiltinPose; ko: string; en: string }[] = [
  { id: 'idle', ko: 'Đứng nghỉ', en: 'Idle' },
  { id: 'combat_ready', ko: 'Tư thế chiến đấu', en: 'Combat ready' },
  { id: 'dance', ko: 'Nhảy múa', en: 'Dance' },
  { id: 'jump', ko: 'Nhảy', en: 'Jump' },
  { id: 'vault', ko: 'Vượt chướng ngại', en: 'Vault' },
  { id: 'bow', ko: 'Cúi chào', en: 'Bow' },
  { id: 'walk', ko: 'Đi bộ', en: 'Walk' },
  { id: 'run', ko: 'Chạy', en: 'Run' },
  { id: 'meditate', ko: 'Thiền định', en: 'Meditate' },
];

/** Stick-figure icons (48×64) for the pose thumbnail row. Each limb is a polyline of joints. */
const POSE_ICONS: Record<BuiltinPose, { head: [number, number]; torso: number[][]; limbs: number[][][] }> = {
  idle: { head: [24, 10], torso: [[24, 17], [24, 36]], limbs: [[[20, 20], [16, 29], [15, 38]], [[28, 20], [32, 29], [33, 38]], [[22, 36], [21, 48], [21, 60]], [[26, 36], [27, 48], [27, 60]]] },
  combat_ready: { head: [26, 10], torso: [[25, 17], [24, 36]], limbs: [[[21, 20], [14, 27], [21, 30]], [[28, 20], [35, 24], [31, 17]], [[22, 37], [14, 48], [12, 60]], [[26, 37], [34, 47], [37, 60]]] },
  victory: { head: [24, 10], torso: [[24, 17], [24, 36]], limbs: [[[28, 20], [33, 10], [35, 2]], [[20, 20], [12, 28], [21, 36]], [[22, 36], [18, 48], [17, 60]], [[26, 36], [31, 48], [32, 60]]] },
  dance: { head: [25, 10], torso: [[24, 17], [24, 36]], limbs: [[[20, 20], [10, 14], [6, 22]], [[28, 20], [38, 26], [42, 16]], [[22, 36], [16, 47], [20, 60]], [[26, 36], [30, 50], [34, 58]]] },
  jump: { head: [24, 8], torso: [[24, 15], [24, 32]], limbs: [[[20, 18], [13, 10], [10, 3]], [[28, 18], [35, 10], [38, 3]], [[22, 32], [15, 40], [12, 49]], [[26, 32], [32, 38], [38, 43]]] },
  vault: { head: [28, 10], torso: [[27, 17], [23, 35]], limbs: [[[23, 20], [16, 14], [11, 12]], [[30, 20], [24, 14], [19, 12]], [[22, 35], [15, 42], [8, 43]], [[26, 35], [32, 44], [39, 48]]] },
  cute: { head: [27, 10], torso: [[24, 17], [24, 36]], limbs: [[[28, 20], [35, 22], [29, 12]], [[20, 20], [16, 30], [16, 38]], [[22, 36], [21, 48], [21, 60]], [[26, 36], [33, 44], [28, 53]]] },
  bow: { head: [37, 22], torso: [[24, 36], [32, 24]], limbs: [[[32, 25], [36, 33], [33, 38]], [[22, 36], [21, 48], [21, 60]], [[26, 36], [27, 48], [27, 60]]] },
  walk: { head: [25, 10], torso: [[24, 17], [24, 36]], limbs: [[[20, 20], [15, 28], [13, 35]], [[28, 20], [32, 28], [35, 33]], [[22, 36], [16, 47], [13, 59]], [[26, 36], [30, 48], [32, 60]]] },
  run: { head: [28, 9], torso: [[26, 16], [23, 35]], limbs: [[[22, 19], [16, 25], [22, 30]], [[29, 19], [36, 23], [33, 29]], [[21, 35], [12, 42], [8, 53]], [[25, 35], [34, 44], [28, 56]]] },
  meditate: { head: [24, 14], torso: [[24, 21], [24, 40]], limbs: [[[20, 24], [14, 34], [17, 42]], [[28, 24], [34, 34], [31, 42]], [[22, 40], [10, 46], [26, 47]], [[26, 40], [38, 46], [22, 47]]] },
};

const EXPRESSION_LIST: { id: ExpressionId; label: string; icon: string }[] = [
  { id: 'neutral', label: 'Bình thường', icon: '😐' },
  { id: 'smile', label: 'Mỉm cười', icon: '🙂' },
  { id: 'joy', label: 'Vui vẻ', icon: '😄' },
  { id: 'wink', label: 'Nháy mắt', icon: '😉' },
  { id: 'sad', label: 'Buồn', icon: '😢' },
  { id: 'angry', label: 'Tức giận', icon: '😠' },
  { id: 'surprise', label: 'Ngạc nhiên', icon: '😮' },
  { id: 'pout', label: 'Chu môi', icon: '😗' },
  { id: 'sneer', label: 'Khinh bỉ', icon: '😒' }
];

const PoseIcon: React.FC<{ pose: BuiltinPose }> = ({ pose }) => {
  const ic = POSE_ICONS[pose];
  const line = (pts: number[][]) => pts.map((p) => p.join(',')).join(' ');
  return (
    <svg viewBox="0 0 48 64" className="w-full h-full block" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <circle cx={ic.head[0]} cy={ic.head[1]} r="5.5" fill="currentColor" stroke="none" />
      <polyline points={line(ic.torso)} />
      {ic.limbs.map((l, i) => (
        <polyline key={i} points={line(l)} />
      ))}
    </svg>
  );
};

interface DetailsPanelProps {
  characterState: CharacterState;
  onUpdateState: (s: CharacterState) => void;
  activeView: CameraViewPreset;
  onCameraChange: (p: CameraViewPreset) => void;
  turntableOn: boolean;
  onToggleTurntable: () => void;
  onTakeScreenshot: () => void;
  onUpdateLightAngle: (angle: number) => void;
}

/** "Xem chi tiết" — the collapsible view-settings panel on the left. */
export const DetailsPanel: React.FC<DetailsPanelProps> = ({
  characterState,
  onUpdateState,
  activeView,
  onCameraChange,
  turntableOn,
  onToggleTurntable,
  onTakeScreenshot,
  onUpdateLightAngle
}) => {
  const [open, setOpen] = useState<string>('');
  const mpfbPoses = useMpfbPoses();
  const [poseGroup, setPoseGroup] = useState('all');
  const shownPoses = mpfbPoses.filter(POSE_GROUPS.find((g) => g.id === poseGroup)?.match ?? (() => true));
  const mixamoClips = useMixamoClips();
  const [mixGroup, setMixGroup] = useState('all');
  const shownClips = mixamoClips.filter(MIXAMO_GROUPS.find((g) => g.id === mixGroup)?.match ?? (() => true));
  const toggle = (id: string) => setOpen((cur) => (cur === id ? '' : id));

  return (
    <GamePanel title={<Bi ko="Xem chi tiết" en="View details" />}>
      <Collapsible title={<Bi ko="Nền và camera" en="Background & camera" />} open={open === 'bg'} onToggle={() => toggle('bg')}>
        <div className="grid grid-cols-3 gap-1.5">
          {ENVIRONMENTS.map((env) => {
            const sel = characterState.environment === env.id;
            return (
              <button
                key={env.id}
                title={env.name}
                aria-label={env.name}
                aria-pressed={sel}
                onClick={() => {
                  sound.playClick();
                  onUpdateState({ ...characterState, environment: env.id as EnvironmentType });
                }}
                className={`gp-thumb group relative overflow-hidden aspect-4/3 p-0 ${sel ? 'is-sel' : ''}`}
                style={{ background: env.skyColor }}
              >
                <img
                  src={`/backdrops/thumbs/${env.id}.jpg`}
                  alt=""
                  draggable={false}
                  className={`absolute inset-0 w-full h-full object-cover transition-transform duration-300 ${sel ? 'scale-110' : 'opacity-75 group-hover:opacity-100 group-hover:scale-110'}`}
                />
                <span className="absolute inset-x-0 bottom-0 px-1 pt-3 pb-0.5 bg-linear-to-t from-black/85 to-transparent text-[9.5px] leading-tight text-left text-white/90 truncate">
                  {env.name.split(' (')[0]}
                </span>
              </button>
            );
          })}
        </div>

        <p className="mt-2 text-[10px] leading-relaxed text-white/60">Kéo để xoay nhân vật · Cuộn để thu phóng · Bật Xoay để xem tự động.</p>
        <div className="mt-2 grid grid-cols-5 gap-1">
          {VIEWS.map((v, i) => (
            <button
              key={v.id}
              title={`${v.ko} [${i + 1}]`}
              aria-label={v.ko}
              aria-pressed={activeView === v.id}
              onClick={() => {
                sound.playClick();
                onCameraChange(v.id);
              }}
              className={`gp-btn px-0! py-1! flex flex-col items-center gap-0.5 ${activeView === v.id ? 'is-on' : ''}`}
            >
              <ViewIcon view={v.id} on={activeView === v.id} />
              <span className="text-[10px] leading-none">{v.ko}</span>
            </button>
          ))}
        </div>

        <div className="mt-1.5 grid grid-cols-2 gap-1">
          <button
            className={`gp-btn flex items-center justify-center gap-1 ${turntableOn ? 'is-on' : ''}`}
            aria-pressed={turntableOn}
            title="[T]"
            onClick={() => {
              sound.playClick();
              onToggleTurntable();
            }}
          >
            <RefreshCw size={11} className={turntableOn ? 'animate-spin [animation-duration:3s]' : ''} /> Xoay
          </button>
          <button
            className="gp-btn flex items-center justify-center gap-1"
            title="[P]"
            onClick={() => {
              sound.playCameraShutter();
              onTakeScreenshot();
            }}
          >
            <Camera size={11} /> Chụp ảnh
          </button>
        </div>
      </Collapsible>

      <Collapsible title={<Bi ko="Tư thế" en="Pose" />} open={open === 'pose'} onToggle={() => toggle('pose')}>
        <div className="grid grid-cols-6 gap-1">
          {POSES.map((p) => (
            <button
              key={p.id}
              title={p.ko}
              aria-label={p.ko}
              aria-pressed={characterState.pose === p.id}
              onClick={() => {
                if (p.id === 'combat_ready') sound.playBladeWhoosh();
                else sound.playClick();
                onUpdateState({ ...characterState, pose: p.id });
              }}
              className={`gp-thumb ${characterState.pose === p.id ? 'is-sel text-gp-hot' : 'text-gp-text/80'} aspect-3/4 p-0.5 bg-linear-to-b from-[#2a2d33] to-[#101114]`}
            >
              <PoseIcon pose={p.id} />
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-[11px] text-gp-text">
          {characterState.pose.startsWith(MIXAMO_PREFIX) ? (
            <>{mixamoClips.find((c) => MIXAMO_PREFIX + c.file === characterState.pose)?.label ?? ''} · Mixamo</>
          ) : characterState.pose.startsWith(MPFB_PREFIX) ? (
            <>
              {(() => {
                const p = mpfbPoses.find((x) => MPFB_PREFIX + x.id === characterState.pose);
                return p ? `${poseTitle(p)} · ${p.author}` : '';
              })()}
            </>
          ) : (
            <Bi ko={POSES.find((p) => p.id === characterState.pose)?.ko ?? ''} en={POSES.find((p) => p.id === characterState.pose)?.en ?? ''} />
          )}
        </p>

        {mpfbPoses.length > 0 && (
          <div className="mt-2 pt-2 border-t border-gp-line">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] uppercase tracking-widest text-gp-mute">Tư thế MPFB</span>
              <span className="text-[10px] text-gp-mute">{shownPoses.length}</span>
            </div>
            <div className="flex flex-wrap gap-1 mb-1.5">
              {POSE_GROUPS.map((g) => (
                <button
                  key={g.id}
                  onClick={() => setPoseGroup(g.id)}
                  className={`px-1.5 py-0.5 text-[10px] border ${poseGroup === g.id ? 'border-gp-hot text-gp-hot bg-gp-hot/10' : 'border-gp-line text-gp-text hover:border-white/30'}`}
                >
                  {g.ko}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-4 gap-1 max-h-56 overflow-y-auto pr-0.5">
              {shownPoses.map((p) => {
                const id = MPFB_PREFIX + p.id;
                const sel = characterState.pose === id;
                return (
                  <button
                    key={p.id}
                    title={`${poseTitle(p)} — ${p.author} (${p.license})`}
                    aria-label={poseTitle(p)}
                    aria-pressed={sel}
                    onClick={() => {
                      sound.playClick();
                      onUpdateState({ ...characterState, pose: id as CharacterState['pose'] });
                    }}
                    className={`gp-thumb ${sel ? 'is-sel' : ''} aspect-square p-0 overflow-hidden bg-linear-to-b from-[#3a3d44] to-[#17181c]`}
                  >
                    <img src={`/poses/${p.id}.webp`} alt="" loading="lazy" draggable={false} className="w-full h-full object-contain" />
                  </button>
                );
              })}
            </div>
            <p className="mt-1 text-[10px] text-gp-mute">Tư thế tĩnh từ gói MakeHuman/MPFB (CC0).</p>
          </div>
        )}

        {mixamoClips.length > 0 && (
          <div className="mt-2 pt-2 border-t border-gp-line">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] uppercase tracking-widest text-gp-mute">Animation</span>
              <span className="text-[10px] text-gp-mute">{shownClips.length}</span>
            </div>
            <div className="flex flex-wrap gap-1 mb-1.5">
              {MIXAMO_GROUPS.map((g) => (
                <button
                  key={g.id}
                  onClick={() => setMixGroup(g.id)}
                  className={`px-1.5 py-0.5 text-[10px] border ${mixGroup === g.id ? 'border-gp-hot text-gp-hot bg-gp-hot/10' : 'border-gp-line text-gp-text hover:border-white/30'}`}
                >
                  {g.ko}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-1 max-h-56 overflow-y-auto pr-0.5">
              {shownClips.map((c) => {
                const id = MIXAMO_PREFIX + c.file;
                const sel = characterState.pose === id;
                return (
                  <button
                    key={c.file}
                    title={c.label}
                    aria-label={c.label}
                    aria-pressed={sel}
                    onClick={() => {
                      sound.playClick();
                      onUpdateState({ ...characterState, pose: id as CharacterState['pose'] });
                    }}
                    className={`gp-btn py-1! px-1.5! text-[11px] text-left leading-tight ${sel ? 'is-on' : ''}`}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>
            <p className="mt-1 text-[10px] text-gp-mute">Chuyển động từ mixamo.com, phát lặp trên nhân vật.</p>
          </div>
        )}
      </Collapsible>

      <Collapsible title={<Bi ko="Biểu cảm" en="Expression" />} open={open === 'expr'} onToggle={() => toggle('expr')}>
        <div className="grid grid-cols-3 gap-1" role="radiogroup" aria-label="Biểu cảm">
          {EXPRESSION_LIST.map((x) => {
            const on = (characterState.expression ?? 'neutral') === x.id;
            return (
              <button
                key={x.id}
                role="radio"
                aria-checked={on}
                onClick={() => {
                  sound.playClick();
                  onUpdateState({ ...characterState, expression: x.id });
                }}
                className={`gp-btn py-1.5! px-1! text-[11px] flex flex-col items-center gap-0.5 ${on ? 'is-on' : ''}`}
              >
                <span className="text-[18px] leading-none">{x.icon}</span>
                {x.label}
              </button>
            );
          })}
        </div>
        <p className="mt-1.5 text-[11px] text-gp-text">Khi giọng nói đang phát, miệng nhép theo âm thanh (a, e, o, u, f, m).</p>
      </Collapsible>

      <Collapsible title={<Bi ko="Ánh sáng" en="Lighting" />} open={open === 'light'} onToggle={() => toggle('light')}>
        <div className="flex justify-center">
          <LightingCompass lightAngle={characterState.lightAngle} onAngleChange={onUpdateLightAngle} />
        </div>
      </Collapsible>
    </GamePanel>
  );
};

interface CharacterPanelProps {
  characterState: CharacterState;
  onNameChange: (name: string) => void;
  /** Only a saved character can be deleted. */
  onDelete?: () => void;
}

/** Stands where the client shows the Giọng nói (voice) panel: who you are creating. */
export const CharacterPanel: React.FC<CharacterPanelProps> = ({ characterState, onNameChange, onDelete }) => {
  const ok = isValidName(characterState.name);
  return (
    <GamePanel title={<Bi ko="Nhân vật" en="Character" />}>
      <div className="p-2.5 space-y-2">
        <div>
          <label className="block text-[11px] text-gp-mute mb-1" htmlFor="char-name">
            <Bi ko="Tên" en="Name" />
          </label>
          <div className="flex gap-1.5">
            <input
              id="char-name"
              type="text"
              value={characterState.name}
              maxLength={18}
              placeholder="Tên nhân vật"
              aria-invalid={!ok}
              onChange={(e) => onNameChange(e.target.value.replace(/\s/g, ''))}
              className={`gp-input flex-1 min-w-0 ${ok ? '' : 'is-invalid'}`}
            />
            <button
              className="gp-btn px-2!"
              title="Tạo tên ngẫu nhiên"
              aria-label="Tạo tên ngẫu nhiên"
              onClick={() => {
                sound.playDiceRoll();
                onNameChange(randomName());
              }}
            >
              <Dices size={13} />
            </button>
          </div>
          {!ok && <p className="mt-1 text-[10px] text-gp-bad">2–18 chữ cái hoặc số, không dấu cách.</p>}
        </div>

        {onDelete && (
          <button
            className="gp-btn w-full flex items-center justify-center gap-1 border-rose-400/50! text-rose-200! hover:bg-rose-950/50!"
            onClick={() => {
              sound.playClick();
              onDelete();
            }}
          >
            <Trash2 size={11} /> Xoá nhân vật
          </button>
        )}
      </div>
    </GamePanel>
  );
};

interface VoicePanelProps {
  characterState: CharacterState;
  onUpdateState: (s: CharacterState) => void;
}

/** Giọng nói: pick a voice card and audition its spoken line and battle cries. */
export const VoicePanel: React.FC<VoicePanelProps> = ({ characterState, onUpdateState }) => {
  const list = voicesFor(characterState.gender);
  const voice = resolveVoice(characterState.voice, characterState.gender);
  const [showEn, setShowEn] = useState(false);
  const [open, setOpen] = useState(false);

  return (
    <GamePanel>
      <Collapsible title={<Bi ko="Giọng nói" en="Voice" />} open={open} onToggle={() => setOpen((value) => !value)}>
      <div className="space-y-2">
        <div className="grid grid-cols-[34px_1fr] items-center gap-x-2 gap-y-2 text-[11px]">
          <span className="text-gp-mute">Chọn</span>
          <Select
            tone="game"
            value={voice.id}
            aria-label="Giọng nói"
            onChange={(id) => {
              const next = list.find((v) => v.id === id);
              onUpdateState({ ...characterState, voice: id });
              if (next) void sound.playVoice(next);
            }}
            options={list.map((v) => ({ value: v.id, label: v.ko, hint: v.en }))}
            className="gp-input w-full"
          />

          <span className="text-gp-mute self-start pt-1">Mô tả</span>
          <button
            type="button"
            onClick={() => setShowEn((v) => !v)}
            title="Bấm để đổi ngôn ngữ"
            className="text-left bg-black/50 border border-gp-line px-2 py-1.5 leading-relaxed text-gp-text min-h-[48px]"
          >
            {showEn ? voice.descEn : voice.desc}
            <span className="block text-gp-mute text-[10px]">({characterState.gender === 'female' ? 'Nữ' : 'Nam'} cơ bản)</span>
          </button>

          <span className="text-gp-mute">Nghe</span>
          <VoicePreview voice={voice} />
        </div>
        <p className="text-[10px] text-gp-mute">Giọng tiếng Việt · MP3</p>
      </div>
      </Collapsible>
    </GamePanel>
  );
};

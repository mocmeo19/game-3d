import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Info, BarChart3, MapPin, Shirt, Mic, Copy, Play, Flame, FlaskConical, Sparkles, Save, ChevronDown, Check, Swords } from 'lucide-react';
import { CharacterState, PoseType } from '../../types/character';
import { PosePicker } from './PosePicker';
import { RACES, CLASSES } from '../../constants/presets';
import { VOICES, voicesFor, resolveVoice } from '../../constants/voices';
import { CLASS_SKILLS, heroStats } from '../../constants/heroInfo';
import { encodeShareCode } from '../../lib/persistence';
import { CostumeEditor } from './CostumeEditor';
import { sound } from '../../audio/soundManager';
import { VoicePreview } from './VoicePreview';
import { ProfileCard } from './ProfileCard';
import { ProfileRadarChart } from './ProfileRadarChart';
import { WeaponPicker } from './WeaponPicker';

type Tab = 'info' | 'stats' | 'source' | 'outfit' | 'poses' | 'sound' | 'weapons';

const NAV: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: 'info', label: 'Thông tin', icon: <Info size={22} /> },
  { key: 'stats', label: 'Chỉ số', icon: <BarChart3 size={22} /> },
  { key: 'source', label: 'Nguồn gốc', icon: <MapPin size={22} /> },
  { key: 'outfit', label: 'Trang phục', icon: <Shirt size={22} /> },
  { key: 'poses', label: 'Tạo dáng', icon: <Sparkles size={22} /> },
  { key: 'sound', label: 'Giọng nói', icon: <Mic size={22} /> },
  { key: 'weapons', label: 'Vũ khí', icon: <Swords size={22} /> }
];

export type GameKind = 'arena' | 'torch' | 'testlab';

const LAST_GAME_KEY = 'bns.last-played-game.v1';
const GAMES = [
  { id: 'arena', name: "Nam's Battle Royal", description: 'Sinh tồn · Đấu đội với bot', Icon: Play, color: 'text-sky-200 bg-sky-400/10 border-sky-300/20' },
  { id: 'torch', name: 'Torchlight', description: 'Action RPG · Chém quái', Icon: Flame, color: 'text-amber-200 bg-amber-400/10 border-amber-300/20' },
  { id: 'testlab', name: 'Test Nhân Vật', description: 'Sân thử · Pose, vũ khí, parkour', Icon: FlaskConical, color: 'text-emerald-200 bg-emerald-400/10 border-emerald-300/20' }
] as const;

const lastPlayedGame = (): GameKind => {
  try {
    const saved = localStorage.getItem(LAST_GAME_KEY);
    return GAMES.find((game) => game.id === saved)?.id ?? 'arena';
  } catch {
    return 'arena';
  }
};


interface HomeScreenProps {
  characterState: CharacterState;
  onUpdateState: (s: CharacterState) => void;
  onSaveOutfit: () => Promise<void>;
  savingOutfit: boolean;
  onSaveWeapon: () => Promise<void>;
  savingWeapon: boolean;
  onChooseCharacter: () => void;
  onNotify: (message: string) => void;
  createdAt: string | null;
  turntableOn: boolean;
  onToggleTurntable: () => void;
  onTryPlay: (game: GameKind) => void;
  /** Pose the character is holding right now (`null` = at rest) and the controls of the "Tạo dáng" menu. */
  stancePose: PoseType | null;
  onStanceChoose: (pose: PoseType | null) => void;
  onStanceRandom: () => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  characterState,
  onUpdateState,
  onSaveOutfit,
  savingOutfit,
  onSaveWeapon,
  savingWeapon,
  onChooseCharacter,
  onNotify,
  createdAt,
  turntableOn,
  onToggleTurntable,
  onTryPlay,
  stancePose,
  onStanceChoose,
  onStanceRandom
}) => {
  const [selectedGame, setSelectedGame] = useState<GameKind>(lastPlayedGame);
  const [gameMenuOpen, setGameMenuOpen] = useState(false);
  const gamePickerRef = useRef<HTMLElement>(null);
  const gameToggleRef = useRef<HTMLButtonElement>(null);
  const gameOptionsRef = useRef<(HTMLButtonElement | null)[]>([]);
  const game = GAMES.find((item) => item.id === selectedGame)!;
  useEffect(() => {
    if (!gameMenuOpen) return;
    gameOptionsRef.current[GAMES.findIndex((item) => item.id === selectedGame)]?.focus();
    const outside = (event: PointerEvent) => {
      if (!gamePickerRef.current?.contains(event.target as Node)) setGameMenuOpen(false);
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [gameMenuOpen, selectedGame]);
  const startGame = () => {
    sound.playCue('start');
    try { localStorage.setItem(LAST_GAME_KEY, selectedGame); } catch { /* Playing still works when storage is unavailable. */ }
    onTryPlay(selectedGame);
  };
  const [tab, setTab] = useState<Tab>('info');
  const skillTab = 'field' as const;
  const [skillIdx, setSkillIdx] = useState(0);

  const race = RACES[characterState.race];
  const cls = CLASSES[characterState.characterClass];
  const voice = resolveVoice(characterState.voice, characterState.gender);
  const { stats, power } = heroStats(characterState.characterClass, characterState.race);
  const skills = CLASS_SKILLS[characterState.characterClass] ?? CLASS_SKILLS.blade_master;
  const list = skills[skillTab];
  const skill = list[Math.min(skillIdx, list.length - 1)];
  const range = cls.role.startsWith('Cận chiến') ? 'Cận chiến' : 'Tầm xa';

  useEffect(() => setSkillIdx(0), [skillTab, characterState.characterClass]);
  useEffect(() => () => sound.stopVoice(), [voice.id]);


  const created = createdAt ? new Date(createdAt).toLocaleString('vi-VN') : '—';

  return (
    <div className="absolute inset-0 z-20 pointer-events-none select-none animate-fade-in">
      <div className="absolute inset-x-0 top-0 h-28 bg-linear-to-b from-black/45 to-transparent" />

      {/* top bar */}
      <div className="absolute top-4 left-5 right-5 flex items-center justify-between">
        <div className="flex items-center gap-3 pointer-events-auto">
          <button onClick={onChooseCharacter} aria-label="Chọn nhân vật" title="Chọn nhân vật" className="text-white/90 hover:text-white">
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-[20px] font-medium text-white text-shadow">Hồ sơ nhân vật</h1>
          <button
            role="switch"
            aria-checked={turntableOn}
            aria-label="Xoay nhân vật"
            title="Xoay nhân vật"
            onClick={onToggleTurntable}
            className={`relative w-11 h-5 shrink-0 rounded-full border border-white/30 transition-colors ${turntableOn ? 'bg-sky-400/70' : 'bg-white/15'}`}
          >
            <span aria-hidden="true" className={`absolute top-1/2 left-px -translate-y-1/2 w-4 h-4 rounded-full bg-white transition-transform ${turntableOn ? 'translate-x-6' : 'translate-x-0'}`} />
          </button>
        </div>
      </div>

      {/* left navigation */}
      <nav className="absolute left-6 top-24 bottom-8 flex flex-col gap-5 overflow-y-auto pointer-events-auto" aria-label="Mục hồ sơ">
        {NAV.map((n) => (
          <button
            key={n.key}
            aria-current={tab === n.key ? 'page' : undefined}
            onClick={() => {
              sound.playClick();
              setTab(n.key);
            }}
            className={`flex shrink-0 flex-col items-center gap-1 w-20 text-[13px] transition-colors ${tab === n.key ? 'text-white' : 'text-white/55 hover:text-white/85'}`}
          >
            <span className={tab === n.key ? 'drop-shadow-[0_0_8px_rgba(150,210,255,0.9)]' : ''}>{n.icon}</span>
            {n.label}
            <span className={`h-px w-12 ${tab === n.key ? 'bg-white/70' : 'bg-white/15'}`} />
          </button>
        ))}
      </nav>

      {/* Profile content scrolls above a game launcher with its own reserved space. */}
      <div className="absolute right-10 top-24 bottom-8 w-[430px] max-w-[40vw] flex flex-col min-h-0">
        <div className="flex-1 min-h-0 flex flex-col gap-4 overflow-y-auto pr-1">
        {tab === 'info' && (
          <>
            <div className="pointer-events-auto text-white pt-1">
              <p className="text-[15px] text-white/85">{cls.title}</p>
              <h2 className="text-[40px] leading-tight font-semibold text-sky-100 text-shadow">{characterState.name || 'Chưa đặt tên'}</h2>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 text-[13px] text-white/85">
                <span className="w-3 h-3 rounded-full bg-sky-300 shadow-[0_0_8px_#7cc8ff]" />
                <span>{cls.primaryElement}</span>
                <span className="text-white/35">|</span>
                <span>{cls.role.split(' / ')[0]}</span>
                <span className="text-white/35">|</span>
                <span>{range}</span>
              </div>
              <div className="my-3 h-px bg-white/30" />
              <p className="text-[14px] leading-relaxed text-white/90">
                {cls.description} {race ? `Chủng tộc ${race.name} — ${race.title}.` : ''}
              </p>
            </div>

            <ProfileCard className="mt-2">
              <div className="p-4">
                <div className="flex items-end gap-4">
                  {list.map((s, i) => (
                    <button
                      key={s.id}
                      title={s.name}
                      aria-label={s.name}
                      aria-pressed={i === skillIdx}
                      onClick={() => {
                        sound.playClick();
                        setSkillIdx(i);
                      }}
                      className={`flex items-center justify-center text-2xl border-2 transition-all ${
                        i === 0 ? 'w-[68px] h-[68px] rounded-full' : 'w-[52px] h-[52px] [clip-path:polygon(25%_3%,75%_3%,100%_50%,75%_97%,25%_97%,0_50%)]'
                      } ${
                        i === skillIdx
                          ? 'border-amber-300 bg-linear-to-br from-[#d85a3a] to-[#6a1b1b] shadow-[0_0_14px_rgba(255,190,90,0.7)]'
                          : 'border-white/30 bg-linear-to-br from-[#7a2a2a] to-[#2a0e18] opacity-85 hover:opacity-100'
                      }`}
                    >
                      {s.icon}
                    </button>
                  ))}
                </div>
                <div className="mt-3 text-white">
                  <div className="text-[14px] font-medium text-amber-200">{skill.name}</div>
                  <p className="text-[12.5px] leading-relaxed text-white/80">{skill.desc}</p>
                </div>
              </div>
            </ProfileCard>
            <p className="pointer-events-none text-[10px] text-white/45 -mt-2">Kỹ năng và chỉ số chỉ mang tính minh họa.</p>
          </>
        )}

        {tab === 'stats' && (
          <ProfileCard className="p-5 text-white">
            <h2 className="text-[18px] font-medium">Chỉ số</h2>
            <div className="mt-1 text-[13px] text-white/70">Sức mạnh chiến đấu</div>
            <div className="text-[34px] font-semibold text-amber-200 leading-none mb-1">{power.toLocaleString('vi-VN')}</div>
            <ProfileRadarChart stats={stats} />
            <p className="mt-4 text-[10px] text-white/45">Chỉ số tính từ lớp nhân vật và chủng tộc, chỉ mang tính minh họa.</p>
          </ProfileCard>
        )}

        {tab === 'source' && (
          <ProfileCard className="p-5 text-white">
            <h2 className="text-[18px] font-medium mb-3">Nguồn gốc</h2>
            <dl className="grid grid-cols-[110px_1fr] gap-y-2 text-[13.5px]">
              <dt className="text-white/60">Tên</dt>
              <dd>{characterState.name}</dd>
              <dt className="text-white/60">Chủng tộc</dt>
              <dd>
                {race?.name} · {characterState.gender === 'female' ? 'Nữ' : 'Nam'}
              </dd>
              <dt className="text-white/60">Lớp nhân vật</dt>
              <dd>{cls.name}</dd>
              <dt className="text-white/60">Nơi tạo</dt>
              <dd>Quảng trường Hồng Môn</dd>
              <dt className="text-white/60">Ngày tạo</dt>
              <dd>{created}</dd>
              <dt className="text-white/60">Giọng nói</dt>
              <dd>{voice.ko}</dd>
            </dl>
            <button
              className="mt-4 px-3 py-1.5 text-[13px] bg-white/10 border border-white/25 hover:bg-white/20 flex items-center gap-2"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(encodeShareCode(characterState));
                  onNotify('Đã sao chép mã nhân vật');
                } catch {
                  onNotify('Không dùng được clipboard');
                }
              }}
            >
              <Copy size={13} /> Sao chép mã nhân vật
            </button>
          </ProfileCard>
        )}

        {tab === 'outfit' && (
          <ProfileCard className="p-4 text-white">
            <div className="flex items-center justify-between gap-2 mb-3">
              <h2 className="text-[18px] font-medium">Trang phục</h2>
              <button
                type="button"
                disabled={savingOutfit}
                onClick={() => { sound.playClick(); void onSaveOutfit(); }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-amber-100 border border-amber-300/60 bg-amber-300/10 hover:bg-amber-300/20 disabled:opacity-50 disabled:cursor-wait"
              >
                <Save size={14} />
                {savingOutfit ? 'Đang lưu…' : 'Lưu trang phục'}
              </button>
            </div>
            <CostumeEditor characterState={characterState} onUpdateState={onUpdateState} maxHeight={330} />
          </ProfileCard>
        )}

        {tab === 'poses' && (
          <ProfileCard className="p-4 text-white">
            <PosePicker pose={stancePose} onChoose={onStanceChoose} onRandom={onStanceRandom} />
          </ProfileCard>
        )}

        {tab === 'sound' && (
          <ProfileCard className="p-4 text-white">
            <h2 className="text-[18px] font-medium mb-3">Giọng nói</h2>
            <div className="space-y-2">
              {voicesFor(characterState.gender).map((v) => {
                const selected = v.id === voice.id;
                return (
                  <div key={v.id} className={`p-3 border ${selected ? 'border-amber-300 bg-white/10' : 'border-white/15 bg-white/5'}`}>
                    <button className="w-full text-left" onClick={() => { sound.stopVoice(); onUpdateState({ ...characterState, voice: v.id }); }}>
                      <div className="text-[14px] font-medium">{v.ko}</div>
                      <div className="text-[12px] text-white/70">{v.desc}</div>
                    </button>
                    <div className="mt-2"><VoicePreview voice={v} /></div>
                  </div>
                );
              })}
            </div>
            <p className="mt-2 text-[10px] text-white/45">{VOICES.length} giọng nói có sẵn</p>
          </ProfileCard>
        )}
        {tab === 'weapons' && (
          <ProfileCard className="p-4 text-white">
            <WeaponPicker
              state={characterState}
              onChange={onUpdateState}
              onPreview={() => onStanceChoose('combat_ready')}
              onSave={onSaveWeapon}
              saving={savingWeapon}
            />
          </ProfileCard>
        )}
        </div>
        <section
          ref={gamePickerRef}
          className="pointer-events-auto relative z-30 shrink-0 mt-4"
          aria-label="Chọn game"
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setGameMenuOpen(false);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape' && gameMenuOpen) {
              event.preventDefault();
              setGameMenuOpen(false);
              gameToggleRef.current?.focus();
            }
          }}
        >
          {gameMenuOpen && (
            <div id="profile-game-menu" role="menu" aria-label="Đổi game" className="absolute bottom-full inset-x-0 mb-3 max-h-[55vh] overflow-y-auto rounded-2xl border border-slate-500/40 bg-[#0d192b] p-2 shadow-[0_16px_60px_rgba(0,0,0,0.65)] animate-fade-in">
              <div className="px-3 pt-2 pb-3 border-b border-white/10 mb-1">
                <p className="text-sm font-semibold text-white">Chọn trải nghiệm</p>
                <p className="mt-1 text-xs text-slate-400">Đổi game, sau đó bấm Chơi để bắt đầu.</p>
              </div>
              {GAMES.map((item, index) => {
                const selected = item.id === selectedGame;
                return (
                  <button
                    key={item.id}
                    ref={(element) => { gameOptionsRef.current[index] = element; }}
                    type="button"
                    role="menuitemradio"
                    aria-checked={selected}
                    tabIndex={-1}
                    onKeyDown={(event) => {
                      let next: number | undefined;
                      if (event.key === 'ArrowDown') next = (index + 1) % GAMES.length;
                      if (event.key === 'ArrowUp') next = (index + GAMES.length - 1) % GAMES.length;
                      if (event.key === 'Home') next = 0;
                      if (event.key === 'End') next = GAMES.length - 1;
                      if (next !== undefined) {
                        event.preventDefault();
                        gameOptionsRef.current[next]?.focus();
                      }
                    }}
                    onClick={() => {
                      sound.playClick();
                      setSelectedGame(item.id);
                      setGameMenuOpen(false);
                      gameToggleRef.current?.focus();
                    }}
                    className={`flex w-full items-center gap-3 p-3 my-1 rounded-xl text-left border transition focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-sky-300 ${selected ? 'bg-sky-400/10 border-sky-300/30' : 'border-transparent hover:bg-white/5 hover:border-white/10'}`}
                  >
                    <span className={`grid place-items-center w-11 h-11 rounded-xl shrink-0 border ${item.color}`}><item.Icon size={21} /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-white">{item.name}</span>
                      <span className="block mt-1 text-xs leading-relaxed text-slate-400">{item.description}</span>
                    </span>
                    {selected && <Check size={18} className="text-sky-300 shrink-0" aria-hidden="true" />}
                  </button>
                );
              })}
            </div>
          )}
          <p className="mb-2 ml-1 text-[10px] tracking-[0.16em] text-slate-400 uppercase">Sẵn sàng trải nghiệm</p>
          <div className="flex items-stretch rounded-2xl border border-sky-200/25 bg-linear-to-br from-[#152e4b] to-[#0b192c] shadow-[0_8px_24px_rgba(0,0,0,0.3)] text-white">
            <button type="button" aria-label={`Bắt đầu ${game.name}`} onClick={startGame} className="flex min-w-0 flex-1 items-center gap-3 p-3 text-left rounded-l-2xl hover:bg-white/5 focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-sky-200 transition">
              <span className={`grid place-items-center w-11 h-11 rounded-xl shrink-0 border ${game.color}`}><game.Icon size={21} /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold truncate">{game.name}</span>
                <span className="block mt-1 text-xs text-white/65 truncate">{game.description}</span>
              </span>
              <span className="rounded-md bg-sky-200/10 px-2 py-1.5 text-[10px] font-semibold tracking-widest text-sky-100">{selectedGame === 'testlab' ? 'THỬ' : 'CHƠI'}</span>
            </button>
            <button ref={gameToggleRef} type="button" aria-label="Đổi game" aria-haspopup="menu" aria-expanded={gameMenuOpen} aria-controls="profile-game-menu" onClick={() => { sound.playClick(); setGameMenuOpen((open) => !open); }} onKeyDown={(event) => { if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setGameMenuOpen(true); } }} className={`w-12 shrink-0 flex flex-col items-center justify-center gap-1 border-l border-white/10 rounded-r-2xl hover:bg-white/10 focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-sky-200 transition ${gameMenuOpen ? 'bg-white/10 text-sky-200' : 'text-slate-300'}`}>
              <ChevronDown size={18} aria-hidden="true" className={`transition-transform ${gameMenuOpen ? 'rotate-180' : ''}`} />
              <span className="text-[10px]">Đổi</span>
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};

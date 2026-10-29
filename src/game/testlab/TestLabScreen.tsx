import { useAudioSettings } from '../../audio/useAudioSettings';
import { useEffect, useMemo, useRef, useState } from 'react';
import { FileUp, LogOut, Volume2, VolumeX } from 'lucide-react';
import { CharacterState, PoseType } from '../../types/character';
import { sound } from '../../audio/soundManager';
import { skillsFor } from '../../renderer/character/skills';
import { MPFB_PREFIX, poseTitle, POSE_GROUPS, useMpfbPoses } from '../../constants/mpfbPoses';
import { STANCES } from '../../lib/useStances';
import { LabAction, LabSnapshot, LAB_WEAPONS, LAB_ZONES, TestLabEngine } from './TestLabEngine';
import { PropCollide } from './labProps';
import { Select } from '../../components/UI/select/Select';
import { AnimationSettingsPanel } from './AnimationSettingsPanel';
import { GameSettingsPanel } from './GameSettingsPanel';
import { loadGameSettings, saveGameSettings } from './gameSettings';
import { GameLoadingScreen } from '../../loading/GameLoadingScreen';
import { WEAPON_KINDS } from '../../constants/weaponKinds';

const initial: LabSnapshot = {
  loaded: false, weapon: 'none', mag: 0, magMax: 0, reloading: false, stance: 'Đứng', action: 'Đứng yên', speed: 0, hint: '', toast: '', aiming: false, pose: null, slow: 1,
  debug: false, hits: 0, carrying: false, gun: false, props: [], mixamo: [], mixamoOn: true, mixamoManual: null, animationSettings: {}
};

type Tab = 'move' | 'pose' | 'weapon' | 'props' | 'mixamo' | 'settings' | 'gameSettings' | 'world' | 'keys';
const TABS: { id: Tab; label: string }[] = [
  { id: 'move', label: 'Động tác' },
  { id: 'pose', label: 'Dáng' },
  { id: 'weapon', label: 'Vũ khí' },
  { id: 'props', label: 'Vật thể' },
  { id: 'mixamo', label: 'Mixamo' },
  { id: 'settings', label: 'Animation' },
  { id: 'gameSettings', label: 'Cấu hình game' },
  { id: 'world', label: 'Sân' },
  { id: 'keys', label: 'Phím' }
];

const MOVES: { id: LabAction; label: string; key: string }[] = [
  { id: 'jump', label: 'Nhảy', key: 'Space' },
  { id: 'crouch', label: 'Ngồi xổm', key: 'C' },
  { id: 'prone', label: 'Nằm sấp · bò', key: 'Z' },
  { id: 'sit', label: 'Ngồi', key: 'X' },
  { id: 'lie', label: 'Nằm ngửa', key: 'L' },
  { id: 'roll', label: 'Lăn', key: 'Q' },
  { id: 'vault', label: 'Vượt / leo', key: 'V' },
  { id: 'interact', label: 'Tương tác', key: 'E' }
];

const CONTROLS: [string, string][] = [
  ['W A S D', 'Di chuyển (đi bộ)'], ['Shift', 'Chạy nhanh'], ['Space', 'Nhảy · vượt chướng ngại khi đứng gần'], ['C', 'Ngồi xổm'], ['Z', 'Nằm sấp, bò (chui hầm thấp)'],
  ['X · L', 'Ngồi · nằm ngửa'], ['Q', 'Lăn'], ['V', 'Vượt (≤1,35 m) hoặc leo (≤2,6 m)'], ['E', 'Ghế · giường · cửa · bê thùng'], ['1 – 9 · 0', 'Đổi vũ khí (0 = lựu đạn)'],
  ['Chuột trái', 'Bắn · chém · ném · chiêu (Vũ khí lớp)'], ['Chuột phải', 'Giữ để ngắm và xoay camera'], ['R', 'Nạp đạn'], ['Con lăn', 'Thu phóng'],
  ['B', 'Hiện hộp va chạm'], ['T', 'Chạy chậm 0,3×'], ['Y', 'Đặt lại vật thể']
];

const btn = 'px-2.5 py-1.5 text-[13px] text-left border border-white/20 bg-white/5 hover:bg-white/15 transition-colors';
const btnOn = 'border-sky-300 bg-sky-400/25 text-white';

export function TestLabScreen({ characterState, onExit }: { characterState: CharacterState; onExit: () => void }) {
  const host = useRef<HTMLDivElement>(null);
  const engine = useRef<TestLabEngine | null>(null);
  const [s, setS] = useState(initial);
  const [tab, setTab] = useState<Tab>('move');
  const [gameSettings, setGameSettings] = useState(loadGameSettings);
  const [error, setError] = useState('');
  const [group, setGroup] = useState('all');
  const { muted } = useAudioSettings();
  const [fileError, setFileError] = useState('');
  const [dropping, setDropping] = useState(false);
  const [split, setSplit] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const mixInput = useRef<HTMLInputElement>(null);
  const poses = useMpfbPoses();
  const skills = useMemo(() => skillsFor(characterState.weapon), [characterState.weapon]);

  useEffect(() => {
    if (!host.current) return;
    setError('');
    try {
      engine.current = new TestLabEngine(host.current, characterState, setS);
    } catch (e) {
      setError('Không khởi tạo được màn chơi 3D. Hãy thử tải lại trang.');
      console.error(e);
    }
    return () => {
      engine.current?.dispose();
      engine.current = null;
    };
  }, [characterState]);

  const eng = engine.current;
  const g = POSE_GROUPS.find((x) => x.id === group) ?? POSE_GROUPS[0];
  const shown = poses.filter(g.match);
  const pick = (p: PoseType | null) => eng?.setPose(p);
  /** Load the .glb files the user chose or dropped as objects in the sandbox. */
  const openFiles = async (files: FileList | File[] | null | undefined) => {
    const list = Array.from(files ?? []);
    if (!list.length || !eng) return;
    setFileError('');
    for (const file of list) {
      // .fbx files are animations; a .glb is an object, unless the Mixamo tab is open (then it is a clip file)
      const clip = /\.fbx$/i.test(file.name) || (tab === 'mixamo' && /\.glb$/i.test(file.name));
      if (!clip && !/\.glb$/i.test(file.name)) {
        setFileError('Chỉ nạp được file .glb (vật thể) hoặc .fbx / .glb (animation).');
        continue;
      }
      try {
        if (clip) {
          setTab('mixamo');
          await eng.addMixamo(file);
        } else {
          setTab('props');
          await eng.addProps(file, split);
        }
      } catch (e) {
        console.error(e);
        setFileError(clip ? `${file.name}: không phải animation (cần bộ xương mixamorig).` : `Không đọc được ${file.name}. Hãy thử file .glb khác.`);
      }
    }
  };
  const COLLIDE: { id: PropCollide; label: string }[] = [
    { id: 'box', label: 'Hộp bao (khối đặc)' },
    { id: 'trunk', label: 'Chỉ phần thân (cây)' },
    { id: 'none', label: 'Không va chạm' }
  ];

  return (
    <div
      className="absolute inset-0 z-50 bg-[#10201f] text-white select-none overflow-hidden"
      onDragOver={(e) => {
        e.preventDefault();
        setDropping(true);
      }}
      onDragLeave={() => setDropping(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDropping(false);
        void openFiles(e.dataTransfer.files);
      }}
    >
      {dropping && <div className="absolute inset-0 z-50 grid place-items-center bg-black/60 border-2 border-dashed border-sky-300 text-lg pointer-events-none">Thả file .glb để nạp vật thể vào sân</div>}
      <div ref={host} className="absolute inset-0" />
      {error && <div className="absolute inset-0 grid place-items-center bg-black/70">{error}</div>}
      {!s.loaded && !error && <GameLoadingScreen gameKind="testlab" message="Đang tải nhân vật…" />}

      <div className="absolute left-4 top-4 flex items-center gap-2">
        <button className={`${btn} flex items-center gap-1.5 bg-black/50`} onClick={onExit}>
          <LogOut size={14} /> Thoát
        </button>
        <button
          className={`${btn} bg-black/50`}
          aria-label={muted ? 'Bật âm thanh' : 'Tắt âm thanh'}
          onClick={() => {
            sound.setMuted(!muted);
          }}
        >
          {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
        </button>
        <span className="ml-2 text-sm tracking-wide text-white/80">Test Nhân Vật</span>
        <a href="/settings" className={`${btn} bg-black/50`}>Cài đặt ứng dụng</a>
      </div>

      {/* status */}
      <div className="absolute left-4 bottom-4 text-[13px] leading-6 bg-black/45 border border-white/15 px-3 py-2 min-w-[190px]">
        <div>Tư thế: <b>{s.stance}</b></div>
        <div>Hoạt động: <b>{s.action}</b></div>
        <div>Tốc độ: <b>{s.speed.toFixed(1)} m/s</b></div>
        {s.hits > 0 && <div>Trúng bia: <b>{s.hits}</b></div>}
        {s.slow < 1 && <div className="text-amber-200">Chạy chậm {s.slow}×</div>}
      </div>

      {/* crosshair + ammo */}
      {s.gun && <div className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full border border-white/90 ${s.aiming ? 'scale-50' : ''} transition-transform`} aria-hidden />}
      {s.weapon !== 'none' && s.weapon !== 'class' && (
        <div className="absolute right-[332px] bottom-4 text-right bg-black/45 border border-white/15 px-3 py-2">
          <div className="text-[13px] text-white/70">{LAB_WEAPONS.find((w) => w.id === s.weapon)?.label}</div>
          {s.magMax > 0 && <div className="text-xl font-semibold">{s.reloading ? 'Đang nạp…' : `${s.mag} / ${s.magMax}`}</div>}
        </div>
      )}
      {s.hint && <div className="absolute left-1/2 bottom-16 -translate-x-1/2 px-4 py-2 text-sm bg-black/65 border border-sky-200/50 pointer-events-none">{s.hint}</div>}

      {/* side panel */}
      <aside className={`absolute right-0 top-0 bottom-0 z-10 ${(tab === 'settings' || tab === 'gameSettings') ? 'w-[min(560px,100vw)]' : 'w-[316px]'} bg-[#0b1a22] bg-[linear-gradient(160deg,#152c3c_0%,#0b1a22_45%,#08121b_100%)] border-l border-sky-200/20 shadow-[-12px_0_32px_rgba(0,0,0,0.3)] flex flex-col`}>
        <div className="grid grid-cols-3 shrink-0 bg-black/25 border-b border-white/15 text-[11px]">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} className={`py-2.5 ${tab === t.id ? 'text-white bg-sky-300/10 border-b-2 border-sky-300' : 'text-white/55 hover:text-white/85 hover:bg-white/5'}`}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-3 flex flex-col gap-3">
          {tab === 'move' && (
            <>
              <p className="text-xs text-white/60">Bấm nút hoặc dùng phím. Di chuyển bằng W A S D, Shift để chạy.</p>
              <div className="grid grid-cols-2 gap-1.5">
                {MOVES.map((m) => (
                  <button key={m.id} className={btn} onClick={() => eng?.action(m.id)}>
                    {m.label} <span className="text-white/45 text-[11px]">· {m.key}</span>
                  </button>
                ))}
              </div>
              <p className="text-xs text-white/60 mt-1">Chuyển nhanh tới</p>
              <div className="grid grid-cols-2 gap-1.5">
                {LAB_ZONES.map((z) => (
                  <button key={z.id} className={btn} onClick={() => eng?.teleport(z.id)}>
                    {z.label}
                  </button>
                ))}
              </div>
            </>
          )}

          {tab === 'pose' && (
            <>
              <div className="grid grid-cols-2 gap-1.5">
                {STANCES.map((st) => (
                  <button key={st.label} className={`${btn} ${st.pose === s.pose ? btnOn : ''}`} onClick={() => pick(st.pose)}>
                    {st.label}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-1">
                {POSE_GROUPS.map((x) => (
                  <button key={x.id} onClick={() => setGroup(x.id)} className={`px-2 py-1 text-xs border ${group === x.id ? 'border-sky-300 bg-sky-400/25' : 'border-white/20 bg-white/5'}`}>
                    {x.ko}
                  </button>
                ))}
              </div>
              {poses.length === 0 && <p className="text-xs text-white/50">Đang tải thư viện dáng…</p>}
              <div className="grid grid-cols-3 gap-1.5">
                {shown.map((p) => {
                  const id = `${MPFB_PREFIX}${p.id}` as PoseType;
                  return (
                    <button key={p.id} title={poseTitle(p)} onClick={() => pick(id)} className={`border text-[10px] leading-tight p-1 text-center ${s.pose === id ? 'border-sky-300 bg-sky-400/25' : 'border-white/15 bg-white/5 hover:bg-white/12'}`}>
                      <img src={`/poses/${p.id}.webp`} alt="" loading="lazy" className="w-full aspect-square object-cover bg-black/30" />
                      <span className="block mt-1 truncate">{poseTitle(p)}</span>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {tab === 'weapon' && (
            <>
              <div className="grid grid-cols-2 gap-1.5">
                {LAB_WEAPONS.map((w, i) => (
                  <button key={w.id} className={`${btn} ${s.weapon === w.id ? btnOn : ''}`} onClick={() => eng?.setWeapon(w.id)}>
                    {w.label} <span className="text-white/45 text-[11px]">· {(i + 1) % 10}</span>
                  </button>
                ))}
              </div>
              <p className="text-xs text-white/60">Chuột trái: bắn / chém / ném · Chuột phải: ngắm · R: nạp đạn</p>
              <p className="text-xs text-white/60 mt-1">Chiêu thức của vũ khí ({WEAPON_KINDS[characterState.weapon].name})</p>
              <div className="flex flex-col gap-1.5">
                {skills.length === 0 && <span className="text-xs text-white/45">Lớp này chưa có chiêu thức.</span>}
                {skills.map((k) => (
                  <button key={k.id} className={btn} onClick={() => eng?.playSkill(k.id)}>
                    {k.ko}
                  </button>
                ))}
              </div>
            </>
          )}

          {tab === 'props' && (
            <>
              <input ref={fileInput} type="file" multiple accept=".glb,model/gltf-binary" className="hidden" onChange={(e) => { void openFiles(e.target.files); e.target.value = ''; }} />
              <button className={`${btn} flex items-center gap-2`} onClick={() => fileInput.current?.click()}>
                <FileUp size={15} /> Nạp vật thể từ file .glb…
              </button>
              <label className="text-xs text-white/70 flex items-start gap-2">
                <input type="checkbox" checked={split} onChange={(e) => setSplit(e.target.checked)} className="mt-0.5" />
                <span>Tách mỗi vật thể trong file thành một món riêng (dùng cho gói nhiều cây, đá, đồ vật xếp cạnh nhau)</span>
              </label>
              <p className="text-xs text-white/50">Hoặc kéo thả file .glb vào cửa sổ. Vật thể hiện trước mặt nhân vật, đứng trên sàn, chạm vào được, leo lên hoặc vượt qua được.</p>
              {fileError && <p className="text-xs text-red-300">{fileError}</p>}
              {s.props.length === 0 && <p className="text-xs text-white/45">Chưa có vật thể nào được nạp.</p>}
              {s.props.map((p) => (
                <div key={p.id} className="border border-white/20 bg-white/5 p-2 flex flex-col gap-1.5">
                  <div className="text-[13px] break-all"><b>{p.name}</b></div>
                  <label className="text-xs text-white/70 flex items-center gap-2">
                    Cạnh dài nhất
                    <input
                      key={p.size}
                      type="number" min={0.1} max={60} step={0.1} defaultValue={p.size}
                      onBlur={(e) => eng?.setPropSize(p.id, Number(e.target.value))}
                      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                      className="w-20 bg-black/40 border border-white/25 px-1.5 py-0.5 text-white"
                    /> m
                  </label>
                  <Select<PropCollide> value={p.collide} onChange={(collide) => eng?.setPropCollide(p.id, collide)} aria-label="Va chạm"
                    options={COLLIDE.map((c) => ({ value: c.id, label: c.label }))}
                    className="bg-black/40 border border-white/25 px-1.5 py-1 text-xs text-white" />
                  <div className="grid grid-cols-4 gap-1">
                    <button className={btn} title="Dời sang trái" onClick={() => eng?.movePropView(p.id, -0.5, 0)}>◀</button>
                    <button className={btn} title="Dời ra xa" onClick={() => eng?.movePropView(p.id, 0, 0.5)}>▲</button>
                    <button className={btn} title="Dời lại gần" onClick={() => eng?.movePropView(p.id, 0, -0.5)}>▼</button>
                    <button className={btn} title="Dời sang phải" onClick={() => eng?.movePropView(p.id, 0.5, 0)}>▶</button>
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    <button className={btn} onClick={() => eng?.rotateProp(p.id)}>Xoay 90°</button>
                    <button className={btn} onClick={() => eng?.placePropFront(p.id)}>Về trước mặt</button>
                    {p.clips > 0 && <button className={`${btn} ${p.playing ? btnOn : ''}`} onClick={() => eng?.togglePropAnimation(p.id)}>{p.playing ? '■ Dừng animation' : '▶ Phát animation'}</button>}
                    <button className={btn} onClick={() => eng?.removeProp(p.id)}>Xoá</button>
                  </div>
                </div>
              ))}
              {s.props.length > 1 && <button className={btn} onClick={() => eng?.clearProps()}>Xoá tất cả vật thể</button>}
            </>
          )}

          {tab === 'mixamo' && (
            <>
              <input ref={mixInput} type="file" multiple accept=".fbx,.glb" className="hidden" onChange={(e) => { void openFiles(e.target.files); e.target.value = ''; }} />
              <button className={`${btn} flex items-center gap-2`} onClick={() => mixInput.current?.click()}>
                <FileUp size={15} /> Nạp animation Mixamo (.fbx / .glb)…
              </button>
              <p className="text-xs text-white/50">
                Tải clip từ mixamo.com (bộ xương mixamorig, nên chọn &ldquo;In Place&rdquo;, định dạng FBX). Các clip đi kèm dự án đã được gán sẵn cho đi, chạy, nhảy, ngồi, bò, lăn, vượt, leo, cầm súng, dao, nạp đạn… Clip bạn nạp thêm được gán theo tên.
              </p>
              {fileError && <p className="text-xs text-red-300">{fileError}</p>}
              {s.mixamo.length === 0 && <p className="text-xs text-white/45">Chưa có animation nào được nạp.</p>}
              {s.mixamo.length > 0 && (
                <>
                  <button className={`${btn} ${s.mixamoOn ? btnOn : ''}`} onClick={() => eng?.setMixamoOn(!s.mixamoOn)}>
                    {s.mixamoOn ? 'Đang dùng animation Mixamo' : 'Đang dùng chuyển động có sẵn'}
                  </button>
                  <button className={`${btn} ${s.mixamoManual === null ? btnOn : ''}`} onClick={() => eng?.playMixamo(null)}>Tự chọn theo hành động (đi, chạy, nhảy…)</button>
                  {([['Tự dùng khi nhân vật…', s.mixamo.filter((m) => m.use)], ['Chỉ phát tay', s.mixamo.filter((m) => !m.use)]] as const).map(([title, list]) =>
                    list.length ? (
                      <div key={title} className="flex flex-col gap-1.5">
                        <p className="text-xs text-white/60 mt-1">{title} ({list.length})</p>
                        {list.map((m) => (
                          <button key={m.id} className={`${btn} ${s.mixamoManual === m.id ? btnOn : ''}`} onClick={() => eng?.playMixamo(m.id)}>
                            ▶ {m.label}
                            <span className="block text-[11px] text-white/55">
                              {m.use ?? 'không gán cho hành động nào'}
                              {m.playing ? ' · đang phát' : ''}
                              {!m.ready ? ' · chưa tải' : ''}
                            </span>
                          </button>
                        ))}
                      </div>
                    ) : null
                  )}
                  <button className={btn} onClick={() => eng?.clearMixamo()}>Xoá animation tôi đã nạp thêm</button>
                  <button className={`${btn} border-sky-300/60`} onClick={() => setTab('settings')}>Cấu hình animation mặc định →</button>
                </>
              )}
            </>
          )}

          {tab === 'settings' && <AnimationSettingsPanel snapshot={s}
            onChange={(role, context, file) => eng?.setAnimationDefault(role, context, file)}
            onPreview={(id) => eng?.playMixamo(id)} onEnable={() => eng?.setMixamoOn(true)}
            onReset={() => eng?.resetAnimationDefaults()} />}

          {tab === 'gameSettings' && <GameSettingsPanel settings={gameSettings} onSave={async (settings) => {
            const saved = await saveGameSettings(settings);
            setGameSettings(saved);
            eng?.applyGameSettings(saved);
          }} />}

          {tab === 'world' && (
            <>
              <div className="flex flex-col gap-1.5">
                <button className={btn} onClick={() => eng?.action('reset')}>Đặt lại vật thể (Y)</button>
                <button className={`${btn} ${s.debug ? btnOn : ''}`} onClick={() => eng?.toggleDebug()}>Hiện hộp va chạm (B)</button>
                <button className={`${btn} ${s.slow < 1 ? btnOn : ''}`} onClick={() => eng?.setSlow(s.slow < 1 ? 1 : 0.3)}>Chạy chậm 0,3× (T)</button>
              </div>
              <p className="text-xs text-white/60 leading-relaxed">
                Sân có: rào 0,45 m · bục 0,9 m · bục 1,25 m · tường leo 2 m · hầm bò cao 0,75 m (chỉ nằm sấp mới chui được) · cầu thang · tường 3 m để kiểm tra tay chân không xuyên tường ·
                ghế dài, giường, cửa trượt, thùng nhẹ (đẩy hoặc bê), bóng (đi vào để đá) và 5 bia tập.
              </p>
            </>
          )}

          {tab === 'keys' && (
            <dl className="text-[13px] flex flex-col gap-1.5">
              {CONTROLS.map(([k, v]) => (
                <div key={k} className="grid grid-cols-[96px_1fr] gap-2">
                  <dt className="text-sky-200">{k}</dt>
                  <dd className="text-white/80">{v}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </aside>
    </div>
  );
}

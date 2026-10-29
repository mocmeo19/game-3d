import { useState } from 'react';
import { Play, Pause } from 'lucide-react';
import { LAB_WEAPONS, LAB_ZONES } from '../game/testlab/labCatalog';
import { normalizeGameSettings, type GameSettings } from '../game/testlab/gameSettings';
import { gamePreview } from './gamePreview';

export function GameSettingsPreview({ settings }: { settings: GameSettings }) {
  const [playing, setPlaying] = useState(true);
  const preview = gamePreview(settings);
  const safe = normalizeGameSettings(settings);
  return (
    <section aria-label="Preview thông số game" className="rounded-2xl border border-sky-300/20 bg-[#102430] p-4">
      <div className="flex items-center justify-between gap-3">
        <div><p className="text-[10px] uppercase tracking-widest text-sky-300">Mô phỏng trực tiếp</p>
          <h3 className="mt-1 text-sm font-semibold text-white">Chạy & nhảy</h3></div>
        <button type="button" onClick={() => setPlaying((value) => !value)}
          aria-label={playing ? 'Tạm dừng mô phỏng' : 'Phát mô phỏng'} className="rounded-lg border border-white/10 p-2 text-sky-200">
          {playing ? <Pause size={14} /> : <Play size={14} />}
        </button>
      </div>
      <svg viewBox="0 0 340 180" role="img" aria-label={`Quỹ đạo nhảy: cao ${preview.height.toFixed(2)} mét, xa ${preview.distance.toFixed(2)} mét`}
        className="mt-3 w-full rounded-xl bg-black/15">
        <path d="M24 150 H320 M24 25 V150" fill="none" stroke="#385566" />
        {[50, 100].map((y) => <path key={y} d={`M24 ${y} H320`} stroke="#223e4c" strokeDasharray="3 5" />)}
        <path d={preview.path} fill="none" stroke="#7dd3fc" strokeWidth="2" strokeDasharray="5 4" />
        <circle key={`${preview.path}-${preview.seconds}-${playing}`} r="6" cx={playing ? 0 : 24} cy={playing ? 0 : 150} fill="#bae6fd">
          {playing && <animateMotion dur={`${preview.seconds.toFixed(2)}s`} repeatCount="indefinite" path={preview.path} />}
        </circle>
        <text x="24" y="170" fill="#7d99a9" fontSize="9">Bắt đầu</text>
        <text x="242" y="170" fill="#7d99a9" fontSize="9">Quãng đường</text>
      </svg>
      <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
        {[
          ['Độ cao', `${preview.height.toFixed(2)} m`], ['Khoảng nhảy', `${preview.distance.toFixed(1)} m`],
          ['Thời gian thực', `${preview.seconds.toFixed(2)} s`],
        ].map(([label, value]) => <div key={label} className="rounded-lg border border-white/10 py-2">
          <dt className="text-[10px] text-slate-500">{label}</dt><dd className="mt-1 text-xs text-sky-100">{value}</dd>
        </div>)}
      </dl>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-black/10 p-3">
          <p className="text-[10px] text-slate-500">Vị trí xuất hiện</p>
          <svg viewBox="-25 -28 50 45" className="mt-2 h-24 w-full" role="img" aria-label={`Vị trí: ${LAB_ZONES.find((zone) => zone.id === safe.startZone)?.label}`}>
            <rect x="-23" y="-26" width="46" height="41" rx="3" fill="#122e3a" stroke="#365765" />
            {LAB_ZONES.map((zone) => <g key={zone.id}>
              <circle cx={zone.at[0]} cy={zone.at[1]} r={zone.id === safe.startZone ? 2.4 : 1.2}
                fill={zone.id === safe.startZone ? '#7dd3fc' : '#48697a'} />
              <text x={zone.at[0]} y={zone.at[1] + 5} textAnchor="middle" fill="#94aebd" fontSize="2.4">{zone.label}</text>
            </g>)}
          </svg>
        </div>
        <div className="space-y-3 rounded-xl border border-white/10 bg-black/10 p-3 text-xs">
          <div><p className="text-[10px] text-slate-500">Trang bị ban đầu</p>
            <p className="mt-1 text-sky-100">{LAB_WEAPONS.find((weapon) => weapon.id === safe.startWeapon)?.label}</p></div>
          <div><p className="text-[10px] text-slate-500">Camera</p><p className="mt-1 text-slate-300">{safe.cameraFov}° · {safe.cameraDistance} m</p></div>
          <div><p className="text-[10px] text-slate-500">Độ nhạy chuột</p><p className="mt-1 text-slate-300">100 px ≈ {(100 * 0.005 * safe.mouseSensitivity * 180 / Math.PI).toFixed(0)}° xoay</p></div>
        </div>
      </div>
      <p className="mt-3 text-[10px] leading-relaxed text-slate-500">Mô phỏng lý thuyết trên mặt phẳng, chưa tính thể hình, chướng ngại và gia tốc.</p>
    </section>
  );
}

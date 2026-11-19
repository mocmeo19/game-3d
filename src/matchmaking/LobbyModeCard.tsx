import { Users } from 'lucide-react';
import type { MatchmakingContent } from './matchmakingContent';

interface LobbyModeCardProps {
  gameTitle: string;
  content: MatchmakingContent;
  /** Players found so far, the player included. */
  joined: number;
}

/** The mode being searched for, over a picture of its map, with how full the lobby is. */
export function LobbyModeCard({ gameTitle, content, joined }: LobbyModeCardProps) {
  const fill = Math.min(1, joined / content.capacity);
  return (
    <section
      aria-label="Chế độ chơi"
      className="relative w-[280px] overflow-hidden border-l-2 border-[#ffd34d] bg-[#0b1118] bg-cover bg-center shadow-[0_6px_18px_rgba(0,0,0,0.45)]"
      style={content.mapImage ? { backgroundImage: `url(${content.mapImage})` } : { backgroundImage: 'linear-gradient(135deg, #3b1d2a, #0b1118)' }}
    >
      <div className="bg-linear-to-r from-black/85 via-black/60 to-black/30 px-3 pt-2 pb-2.5">
        <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.18em]">
          <span className="text-white/60">Ngoại tuyến · Bot</span>
          <span className="text-[#ffd34d]">{gameTitle}</span>
        </div>
        <p className="mt-1.5 text-[22px] leading-none font-black italic text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.8)]">
          {content.modeName} <span className="align-middle text-[12px] font-bold not-italic text-white/75">({content.perspective})</span>
        </p>
        <div className="mt-2 flex items-center justify-between text-[12px]">
          <span className="text-white/80">Bản đồ: <span className="font-semibold text-white">{content.mapName}</span></span>
          <span className="flex items-center gap-1 text-white/80" aria-label={`Đội ${content.squadSize} người`}>
            <Users size={14} aria-hidden /> {content.squadSize}
          </span>
        </div>
        <div className="mt-2">
          <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-white/55">
            <span>Người chơi</span>
            <span className="font-mono tracking-normal text-white/85">{joined}/{content.capacity}</span>
          </div>
          <div className="mt-1 h-[3px] overflow-hidden rounded-full bg-white/15" role="progressbar" aria-valuemin={0} aria-valuemax={content.capacity} aria-valuenow={joined} aria-label="Người chơi đã tìm được">
            <div className="h-full rounded-full bg-[#ffd34d] transition-[width] duration-300" style={{ width: `${fill * 100}%` }} />
          </div>
        </div>
      </div>
    </section>
  );
}

import { formatClock } from './matchmakingContent';

interface LobbyReadyButtonProps {
  elapsedMs: number;
  found: boolean;
  onCancel: () => void;
}

/** The lobby's big corner button: the search clock while looking for a match (pressing it cancels), green once found. */
export function LobbyReadyButton({ elapsedMs, found, onCancel }: LobbyReadyButtonProps) {
  return (
    <button
      type="button"
      onClick={onCancel}
      disabled={found}
      aria-label={found ? 'Đã tìm thấy trận' : `Huỷ tìm trận, đã chờ ${formatClock(elapsedMs)}`}
      className={`group relative flex h-[76px] w-[280px] flex-col justify-center overflow-hidden pr-10 pl-5 text-left shadow-[0_6px_18px_rgba(0,0,0,0.45)] transition [clip-path:polygon(0_0,100%_0,calc(100%-18px)_100%,0_100%)] ${
        found ? 'bg-linear-to-r from-emerald-500 to-emerald-400' : 'bg-linear-to-r from-[#f0a91f] to-[#ffd34d] hover:brightness-110'
      }`}
    >
      <span aria-hidden className="absolute inset-0 bg-[repeating-linear-gradient(115deg,rgba(255,255,255,0.08)_0_8px,transparent_8px_16px)]" />
      <span className="relative text-[30px] leading-none font-black uppercase italic tracking-wide text-[#1d1405] drop-shadow-[0_1px_0_rgba(255,255,255,0.35)]">
        {found ? 'Đã tìm thấy' : 'Huỷ'}
      </span>
      <span className="relative mt-1 flex items-center gap-2 text-[12px] font-bold text-[#1d1405]/80">
        {found ? 'Đang vào trận…' : <>Đang tìm trận · <span className="font-mono tabular-nums">{formatClock(elapsedMs)}</span></>}
        {!found && <kbd className="rounded-sm bg-black/15 px-1 font-mono text-[10px]">Esc</kbd>}
      </span>
    </button>
  );
}

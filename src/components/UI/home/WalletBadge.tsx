import { Coins, Gem, Plus } from 'lucide-react';
import { useWalletBalances } from '../../../wallet/useWalletBalances';
import { formatAmount } from '../../../wallet/walletStore';
import { sound } from '../../../audio/soundManager';

interface WalletBadgeProps {
  onOpenTopUp: () => void;
}

const pillClassName = 'flex h-9 shrink-0 items-center gap-2 rounded-full border bg-black/55 pl-2.5 text-xs';

/** Lobby balances: gold earned by playing, and diamonds whose plus button opens the top-up dialog. */
export function WalletBadge({ onOpenTopUp }: WalletBadgeProps) {
  const { gold, diamonds } = useWalletBalances();
  return (
    <div className="flex items-center gap-2">
      <div className={`${pillClassName} border-[#ffd34d]/40 pr-3`} title="Vàng nhận được khi chơi game">
        <Coins size={16} className="text-[#ffd34d]" aria-hidden />
        <span className="min-w-8 font-bold text-[#ffe9a6]" aria-label={`${formatAmount(gold)} Vàng`}>{formatAmount(gold)}</span>
      </div>
      <div className={`${pillClassName} border-[#6fd8ff]/40 pr-1`}>
        <Gem size={16} className="text-[#6fd8ff]" aria-hidden />
        <span className="min-w-8 font-bold text-[#c9f1ff]" aria-label={`${formatAmount(diamonds)} Kim cương`}>{formatAmount(diamonds)}</span>
        <button
          type="button"
          aria-haspopup="dialog"
          aria-label="Nạp Kim cương"
          title="Nạp Kim cương"
          onClick={() => { sound.playClick(); onOpenTopUp(); }}
          className="grid h-7 w-7 place-items-center rounded-full bg-[#ffd34d] text-[#1a1306] hover:bg-[#ffdc6b] focus-visible:outline-2 focus-visible:outline-white"
        >
          <Plus size={16} strokeWidth={3} />
        </button>
      </div>
    </div>
  );
}

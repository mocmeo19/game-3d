import { Gem } from 'lucide-react';
import { formatVnd, totalDiamonds, type TopUpPackage } from '../../../wallet/topUpPackages';
import { formatAmount } from '../../../wallet/walletStore';

interface TopUpPackageCardProps {
  pack: TopUpPackage;
  isSelected: boolean;
  onSelect: () => void;
}

export function TopUpPackageCard({ pack, isSelected, onSelect }: TopUpPackageCardProps) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={isSelected}
      aria-label={`${formatAmount(totalDiamonds(pack))} Kim cương, giá ${formatVnd(pack.priceVnd)}`}
      onClick={onSelect}
      className={`relative flex flex-col items-center gap-1 rounded-md border px-2 pb-2 pt-4 text-center transition focus-visible:outline-2 focus-visible:outline-[#ffd34d] ${isSelected ? 'border-[#ffd34d] bg-[#ffd34d]/15' : 'border-white/15 bg-black/30 hover:border-white/40'}`}
    >
      {pack.isPopular && (
        <span className="absolute -top-2 rounded-sm bg-[#e8463a] px-1.5 text-[9px] font-bold uppercase tracking-wider text-white">Phổ biến</span>
      )}
      <Gem size={26} className="text-[#6fd8ff] drop-shadow-[0_0_6px_rgba(111,216,255,0.55)]" aria-hidden />
      <span className="text-[15px] font-bold text-white">{formatAmount(pack.diamonds)}</span>
      <span className={`text-[10px] ${pack.bonusDiamonds > 0 ? 'text-[#7ee08a]' : 'text-transparent'}`} aria-hidden={pack.bonusDiamonds === 0}>
        +{formatAmount(pack.bonusDiamonds)} thưởng
      </span>
      <span className="mt-1 w-full rounded-sm bg-white/10 py-1 text-[11px] font-semibold text-[#ffe9a6]">{formatVnd(pack.priceVnd)}</span>
    </button>
  );
}

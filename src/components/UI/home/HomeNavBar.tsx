import { Backpack, ShoppingBag } from 'lucide-react';
import { sound } from '../../../audio/soundManager';

interface HomeNavBarProps {
  onOpenInventory: () => void;
  onOpenShop: () => void;
}

/** Bottom-right menu bar opening the shop and the locker. */
export function HomeNavBar({ onOpenInventory, onOpenShop }: HomeNavBarProps) {
  return (
    <nav aria-label="Mục hồ sơ" className="pointer-events-auto flex items-end gap-1 overflow-x-auto no-scrollbar">
      <button
        type="button"
        aria-haspopup="dialog"
        onClick={() => { sound.playClick(); onOpenShop(); }}
        className="group relative flex min-w-[76px] shrink-0 flex-col items-center gap-1 px-2 pt-1.5 pb-2 text-[12px] font-bold uppercase tracking-wide text-[#ffd34d] transition-colors hover:text-[#ffe9a6]"
      >
        <ShoppingBag size={24} className="drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] transition-transform group-hover:-translate-y-0.5" />
        <span className="text-shadow whitespace-nowrap">Cửa hàng</span>
      </button>
      <button
        type="button"
        aria-haspopup="dialog"
        onClick={() => { sound.playClick(); onOpenInventory(); }}
        className="group relative flex min-w-[76px] shrink-0 flex-col items-center gap-1 px-2 pt-1.5 pb-2 text-[12px] font-bold uppercase tracking-wide text-white/90 transition-colors hover:text-white"
      >
        <Backpack size={24} className="drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] transition-transform group-hover:-translate-y-0.5" />
        <span className="text-shadow whitespace-nowrap">Kho đồ</span>
      </button>
    </nav>
  );
}

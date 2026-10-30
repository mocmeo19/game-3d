import { useEffect, useRef, useState } from 'react';
import { Gem, X } from 'lucide-react';
import { TOP_UP_PACKAGES, formatVnd, totalDiamonds } from '../../../wallet/topUpPackages';
import { creditWallet, formatAmount } from '../../../wallet/walletStore';
import { useWalletBalances } from '../../../wallet/useWalletBalances';
import { TopUpPackageCard } from './TopUpPackageCard';
import { sound } from '../../../audio/soundManager';

/** There is no payment backend yet, so a purchase is simulated with a short delay before the diamonds are credited. */
const SIMULATED_PAYMENT_MS = 900;
const DEFAULT_PACKAGE_ID = TOP_UP_PACKAGES.find((pack) => pack.isPopular)?.id ?? TOP_UP_PACKAGES[0].id;

interface TopUpDialogProps {
  onClose: () => void;
  onNotify: (message: string) => void;
}

export function TopUpDialog({ onClose, onNotify }: TopUpDialogProps) {
  const { diamonds: balance } = useWalletBalances();
  const [selectedId, setSelectedId] = useState(DEFAULT_PACKAGE_ID);
  const [isProcessing, setIsProcessing] = useState(false);
  const paymentTimer = useRef<number | null>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const selected = TOP_UP_PACKAGES.find((pack) => pack.id === selectedId) ?? TOP_UP_PACKAGES[0];

  useEffect(() => {
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.current?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus();
    return () => {
      if (paymentTimer.current !== null) window.clearTimeout(paymentTimer.current);
      previouslyFocused?.focus();
    };
  }, []);

  const close = () => {
    if (!isProcessing) onClose();
  };

  const confirmTopUp = () => {
    if (isProcessing) return;
    sound.playClick();
    setIsProcessing(true);
    paymentTimer.current = window.setTimeout(() => {
      paymentTimer.current = null;
      const diamonds = totalDiamonds(selected);
      if (creditWallet('diamonds', diamonds)) {
        sound.playCue('start');
        onNotify(`Nạp thành công ${formatAmount(diamonds)} Kim cương`);
        onClose();
        return;
      }
      setIsProcessing(false);
      onNotify('Không thể nạp Kim cương. Bộ nhớ trình duyệt đã đầy, không khả dụng hoặc số dư đã đạt mức tối đa.');
    }, SIMULATED_PAYMENT_MS);
  };

  return (
    <div
      className="pointer-events-auto fixed inset-0 z-50 grid place-items-center bg-black/65 p-4 animate-fade-in"
      onPointerDown={(event) => { if (event.target === event.currentTarget) close(); }}
    >
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="top-up-title"
        aria-busy={isProcessing}
        onKeyDown={(event) => {
          if (event.key !== 'Escape') return;
          event.stopPropagation();
          close();
        }}
        className="flex max-h-full w-[520px] max-w-full flex-col overflow-hidden rounded-lg border border-white/15 bg-linear-to-b from-[#0d1826] to-[#08101a] text-white shadow-[0_16px_50px_rgba(0,0,0,0.6)] animate-rise-in"
      >
        <header className="flex items-center gap-2 border-b border-white/10 bg-black/30 px-4 py-3">
          <span aria-hidden className="h-4 w-1 rounded-full bg-[#ffd34d]" />
          <h2 id="top-up-title" className="flex-1 text-[15px] font-bold uppercase tracking-wider">Nạp Kim cương</h2>
          <span className="flex items-center gap-1.5 text-xs text-white/70">
            Số dư <Gem size={14} className="text-[#6fd8ff]" aria-hidden />
            <strong className="text-[#c9f1ff]">{formatAmount(balance)}</strong>
          </span>
          <button type="button" aria-label="Đóng" disabled={isProcessing} onClick={close} className="grid h-7 w-7 place-items-center rounded text-white/60 hover:bg-white/10 hover:text-white disabled:opacity-40">
            <X size={16} />
          </button>
        </header>

        <div className="overflow-y-auto p-4">
          <div role="radiogroup" aria-label="Gói nạp" className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {TOP_UP_PACKAGES.map((pack) => (
              <TopUpPackageCard key={pack.id} pack={pack} isSelected={pack.id === selectedId} onSelect={() => { sound.playClick(); setSelectedId(pack.id); }} />
            ))}
          </div>
          <p className="mt-4 rounded-sm border border-white/10 bg-white/5 px-3 py-2 text-[11px] leading-relaxed text-white/60">
            Chế độ thử nghiệm: chưa kết nối cổng thanh toán, không có khoản tiền thật nào bị trừ. Kim cương được lưu trong trình duyệt này.
          </p>
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-white/10 bg-black/30 px-4 py-3">
          <span className="text-xs text-white/70">
            Nhận <strong className="text-[#ffe9a6]">{formatAmount(totalDiamonds(selected))} Kim cương</strong>
          </span>
          <button
            type="button"
            disabled={isProcessing}
            onClick={confirmTopUp}
            className="rounded-sm bg-[#ffd34d] px-5 py-2 text-sm font-bold uppercase tracking-wide text-[#1a1306] shadow-[0_4px_14px_rgba(255,211,77,0.35)] hover:bg-[#ffdc6b] disabled:cursor-wait disabled:opacity-60"
          >
            {isProcessing ? 'Đang xử lý…' : `Nạp ${formatVnd(selected.priceVnd)}`}
          </button>
        </footer>
      </div>
    </div>
  );
}

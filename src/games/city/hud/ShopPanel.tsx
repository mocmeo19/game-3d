import { X } from 'lucide-react';
import type { CityView } from '../citySnapshot';

interface ShopPanelProps {
  shop: NonNullable<CityView['shop']>;
  money: number;
  onBuy: (id: string) => void;
  onClose: () => void;
}

/** The gun shop: guns, ammo and armour, with what the player can afford. */
export function ShopPanel({ shop, money, onBuy, onClose }: ShopPanelProps) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/55 p-4" role="dialog" aria-modal="true" aria-label={shop.title}>
      <section className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-lg border border-white/15 bg-[#0d1218] text-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <div>
            <h2 className="text-lg font-bold">{shop.title}</h2>
            <p className="text-sm tabular-nums text-[#7bd88f]">${money.toLocaleString('vi-VN')}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-2 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white" aria-label="Đóng tiệm">
            <X size={20} />
          </button>
        </header>
        <ul className="overflow-y-auto">
          {shop.items.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-3 border-b border-white/5 px-4 py-2.5">
              <div className="min-w-0">
                <p className="font-semibold">{item.name}</p>
                <p className="text-xs text-white/55">{item.detail}</p>
              </div>
              <button
                type="button"
                disabled={item.isOwned || !item.canAfford}
                onClick={() => onBuy(item.id)}
                className="min-w-24 rounded-md bg-[#f5c542] px-3 py-1.5 text-sm font-bold text-[#1a1406] transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-white disabled:bg-white/10 disabled:text-white/40"
              >
                {item.isOwned ? 'Đã có' : `$${item.price.toLocaleString('vi-VN')}`}
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

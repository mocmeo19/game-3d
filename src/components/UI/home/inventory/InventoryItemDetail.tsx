import { Save, Swords } from 'lucide-react';
import { RARITY_META, type InventoryItem } from './inventoryItems';

interface InventoryItemDetailProps {
  item: InventoryItem;
  isEquipped: boolean;
  isSaving: boolean;
  onToggleEquip: () => void;
  onSave: () => void;
}

/** Selected-item card: preview, rarity and slot, equip / take-off and save buttons. */
export function InventoryItemDetail({ item, isEquipped, isSaving, onToggleEquip, onSave }: InventoryItemDetailProps) {
  const rarity = RARITY_META[item.rarity];
  const canTakeOff = item.kind === 'wear' || item.id !== 'standard';
  return (
    <section aria-label="Chi tiết vật phẩm" className="w-[300px] max-w-full overflow-hidden rounded-md border border-white/15 bg-[#0b1420]/90 text-white shadow-[0_12px_40px_rgba(0,0,0,0.55)] backdrop-blur-sm">
      <div className="relative flex h-36 items-center justify-center" style={{ background: `radial-gradient(circle at 50% 60%, ${rarity.color}55, transparent 70%)` }}>
        {item.thumbUrl
          ? <img src={item.thumbUrl} alt="" draggable={false} className="h-full object-contain p-2" />
          : <Swords aria-hidden size={56} className="text-white/70" />}
        <span className="absolute left-2 top-2 rounded-sm px-1.5 py-0.5 text-[10px] font-bold uppercase text-[#0b1420]" style={{ background: rarity.color }}>{rarity.label}</span>
      </div>
      <div className="px-3 py-2.5">
        <h3 className="truncate text-[16px] font-extrabold uppercase italic">{item.name}</h3>
        <p className="text-[11px] text-white/55">{item.slotLabel}{isEquipped ? ' · Đang trang bị' : ''}</p>
        {item.kind === 'weapon' && <p className="mt-1.5 text-[11px] leading-relaxed text-white/65">{item.description}</p>}
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            disabled={isEquipped && !canTakeOff}
            onClick={onToggleEquip}
            className={`h-9 flex-1 rounded-sm text-[13px] font-black uppercase tracking-wide transition disabled:opacity-40 ${isEquipped ? 'border border-white/30 text-white hover:bg-white/10' : 'bg-linear-to-b from-[#ffe066] to-[#f2b705] text-[#1a1306] hover:brightness-110'}`}
          >
            {isEquipped ? 'Tháo ra' : 'Trang bị'}
          </button>
          <button
            type="button"
            disabled={isSaving}
            onClick={onSave}
            title={item.kind === 'weapon' ? 'Lưu vũ khí cho nhân vật' : 'Lưu trang phục cho nhân vật'}
            className="flex h-9 items-center gap-1.5 rounded-sm border border-[#ffd34d]/60 bg-[#ffd34d]/10 px-3 text-[12px] font-semibold text-[#ffe9a6] hover:bg-[#ffd34d]/20 disabled:cursor-wait disabled:opacity-50"
          >
            <Save size={14} /> {isSaving ? 'Đang lưu…' : 'Lưu'}
          </button>
        </div>
      </div>
    </section>
  );
}

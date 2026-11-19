import { Coins, Gem } from 'lucide-react';
import type { Price } from '../../../../shop/shopCatalog';
import { CURRENCY_LABEL, formatAmount } from '../../../../wallet/walletStore';

interface PriceTagProps {
  price: Price;
  size?: 'sm' | 'md';
}

/** An amount with its currency icon: gold coins or diamonds. */
export function PriceTag({ price, size = 'sm' }: PriceTagProps) {
  const Icon = price.currency === 'gold' ? Coins : Gem;
  const color = price.currency === 'gold' ? 'text-[#ffd34d]' : 'text-[#6fd8ff]';
  const iconSize = size === 'sm' ? 12 : 16;
  return (
    <span className={`inline-flex items-center gap-1 font-bold ${size === 'sm' ? 'text-[11px]' : 'text-[14px]'} ${color}`} aria-label={`${formatAmount(price.amount)} ${CURRENCY_LABEL[price.currency]}`}>
      <Icon size={iconSize} aria-hidden />
      <span aria-hidden>{formatAmount(price.amount)}</span>
    </span>
  );
}

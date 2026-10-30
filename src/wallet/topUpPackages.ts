export interface TopUpPackage {
  id: string;
  diamonds: number;
  bonusDiamonds: number;
  priceVnd: number;
  isPopular?: boolean;
}

export const TOP_UP_PACKAGES: readonly TopUpPackage[] = [
  { id: 'diamonds-60', diamonds: 60, bonusDiamonds: 0, priceVnd: 20_000 },
  { id: 'diamonds-300', diamonds: 300, bonusDiamonds: 25, priceVnd: 100_000 },
  { id: 'diamonds-600', diamonds: 600, bonusDiamonds: 60, priceVnd: 200_000, isPopular: true },
  { id: 'diamonds-1500', diamonds: 1500, bonusDiamonds: 200, priceVnd: 500_000 },
  { id: 'diamonds-3000', diamonds: 3000, bonusDiamonds: 500, priceVnd: 1_000_000 },
  { id: 'diamonds-6000', diamonds: 6000, bonusDiamonds: 1200, priceVnd: 2_000_000 }
];

export const totalDiamonds = (pack: TopUpPackage): number => pack.diamonds + pack.bonusDiamonds;

export const formatVnd = (amount: number): string =>
  amount.toLocaleString('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 });

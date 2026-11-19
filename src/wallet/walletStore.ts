export type Currency = 'gold' | 'diamonds';
export type WalletBalances = Readonly<Record<Currency, number>>;

export const CURRENCY_LABEL: Record<Currency, string> = { gold: 'Vàng', diamonds: 'Kim cương' };
export const MAX_CURRENCY_BALANCE = 999_999_999;

const WALLET_KEY = 'bns.wallet.v1';
const EMPTY_WALLET: WalletBalances = { gold: 0, diamonds: 0 };

type Listener = () => void;
const listeners = new Set<Listener>();
let cachedBalances: WalletBalances | null = null;

const isValidAmount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= MAX_CURRENCY_BALANCE;

const amountOr = (value: unknown, fallback: number): number => (isValidAmount(value) ? value : fallback);

function readStoredBalances(): WalletBalances {
  try {
    const text = localStorage.getItem(WALLET_KEY);
    if (!text) return EMPTY_WALLET;
    const parsed: unknown = JSON.parse(text);
    if (!parsed || typeof parsed !== 'object') return EMPTY_WALLET;
    const record = parsed as Record<string, unknown>;
    // Wallets saved before gold existed held only the topped-up coins in `balance`; those become diamonds.
    return { gold: amountOr(record.gold, 0), diamonds: amountOr(record.diamonds, amountOr(record.balance, 0)) };
  } catch {
    return EMPTY_WALLET;
  }
}

export function getWalletBalances(): WalletBalances {
  if (cachedBalances === null) cachedBalances = readStoredBalances();
  return cachedBalances;
}

function notifyListeners(): void {
  listeners.forEach((listener) => listener());
}

/** Adds `amount` of one currency and persists it; returns false (nothing changed) when storage fails or the cap would be exceeded. */
export function creditWallet(currency: Currency, amount: number): boolean {
  if (!Number.isSafeInteger(amount) || amount <= 0) return false;
  const current = readStoredBalances();
  const nextAmount = current[currency] + amount;
  if (nextAmount > MAX_CURRENCY_BALANCE) return false;
  const next: WalletBalances = { ...current, [currency]: nextAmount };
  try {
    localStorage.setItem(WALLET_KEY, JSON.stringify(next));
  } catch {
    return false;
  }
  cachedBalances = next;
  notifyListeners();
  return true;
}

/** Takes `amount` of one currency and persists it; returns false (nothing changed) when the balance is short or storage fails. */
export function debitWallet(currency: Currency, amount: number): boolean {
  if (!Number.isSafeInteger(amount) || amount <= 0) return false;
  const current = readStoredBalances();
  if (current[currency] < amount) return false;
  const next: WalletBalances = { ...current, [currency]: current[currency] - amount };
  try {
    localStorage.setItem(WALLET_KEY, JSON.stringify(next));
  } catch {
    return false;
  }
  cachedBalances = next;
  notifyListeners();
  return true;
}

const onStorage = (event: StorageEvent) => {
  if (event.key !== WALLET_KEY && event.key !== null) return;
  cachedBalances = readStoredBalances();
  notifyListeners();
};

/** Subscribes to balance changes in this tab and in other tabs of the same browser. */
export function subscribeWallet(listener: Listener): () => void {
  if (listeners.size === 0) window.addEventListener('storage', onStorage);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener('storage', onStorage);
  };
}

export const formatAmount = (amount: number): string => amount.toLocaleString('vi-VN');

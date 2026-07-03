export type Currency = 'HTG' | 'USD' | 'HTD';

// Enfòmasyon sou chak devise
export const CURRENCIES: Record<Currency, { label: string; symbol: string; name: string }> = {
  HTG: { label: 'Goud Ayisyen', symbol: 'HTG', name: 'Goud' },
  USD: { label: 'Dola Ameriken', symbol: 'USD', name: 'Dola US' },
  HTD: { label: 'Dola Ayisyen', symbol: '$HT', name: 'Dola Ayisyen' },
};

// Fòma yon montan selon devise a
export function formatMoney(amount: number, currency?: string | null): string {
  const cur = (currency as Currency) || 'HTG';
  const info = CURRENCIES[cur] || CURRENCIES.HTG;
  const formatted = new Intl.NumberFormat('fr-HT').format(amount ?? 0);
  return `${formatted} ${info.symbol}`;
}

// Jwenn sèlman senbòl la
export function currencySymbol(currency?: string | null): string {
  const cur = (currency as Currency) || 'HTG';
  return (CURRENCIES[cur] || CURRENCIES.HTG).symbol;
}
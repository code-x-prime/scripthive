export const DEFAULT_APC_USD = 140;
export const DEFAULT_APC_INR = 11500;

export type ApcSettings = { apc_usd?: string; apc_inr?: string };

export function parseApcSettings(settings?: ApcSettings): { usd: number; inr: number } {
  const usd = parseFloat(settings?.apc_usd ?? "") || DEFAULT_APC_USD;
  const inr = parseFloat(settings?.apc_inr ?? "") || DEFAULT_APC_INR;
  return { usd, inr };
}

export function apcAmountForCurrency(currency: string, rates: { usd: number; inr: number }): number {
  return currency === "INR" ? rates.inr : rates.usd;
}

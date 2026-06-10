import { prisma } from "../config/prisma.js";

export const DEFAULT_APC_USD = 140;
export const DEFAULT_APC_INR = 11500;

export interface AddonService {
  id: string;
  label: string;
  price: number;
  priceUsd?: number | null;
  currency: "INR";
  enabled: boolean;
}

export const DEFAULT_ADDONS: AddonService[] = [
  { id: "doi_only",           label: "DOI Only",                        price: 350,  currency: "INR", enabled: true },
  { id: "fast_review",        label: "Fast Review",                     price: 699,  currency: "INR", enabled: true },
  { id: "plagiarism_report",  label: "Plagiarism Report (350 words)",   price: 150,  currency: "INR", enabled: true },
  { id: "certificate_soft",   label: "Certificate Soft Copy",           price: 200,  currency: "INR", enabled: true },
  { id: "certificate_hard",   label: "Certificate Hard Copy (Speed Post)", price: 350, currency: "INR", enabled: true },
  { id: "featured_paper",     label: "Featured Paper",                  price: 1000, currency: "INR", enabled: true },
  { id: "paper_hard_copy",    label: "Paper Hard Copy (Speed Post)",    price: 999,  currency: "INR", enabled: true }
];

export async function loadAddonServices(): Promise<AddonService[]> {
  const row = await prisma.setting.findUnique({ where: { key: "addon_services" } });
  if (!row?.value) return DEFAULT_ADDONS;
  try {
    return JSON.parse(row.value) as AddonService[];
  } catch {
    return DEFAULT_ADDONS;
  }
}

export async function loadApcRates(): Promise<{ usd: number; inr: number }> {
  const [apcUsdRow, apcInrRow] = await Promise.all([
    prisma.setting.findUnique({ where: { key: "apc_usd" } }),
    prisma.setting.findUnique({ where: { key: "apc_inr" } })
  ]);
  const usd = parseFloat(apcUsdRow?.value ?? String(DEFAULT_APC_USD)) || DEFAULT_APC_USD;
  const inr = parseFloat(apcInrRow?.value ?? String(DEFAULT_APC_INR)) || DEFAULT_APC_INR;
  return { usd, inr };
}

export function apcAmountForCurrency(currency: string, rates: { usd: number; inr: number }): number {
  const cur = (currency ?? "USD").trim().toUpperCase();
  return cur === "INR" ? Math.round(rates.inr) : rates.usd;
}

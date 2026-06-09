import type { Request, Response } from "express";
import { prisma } from "../config/prisma.js";
import {
  getPaymentGatewaySettingsForAdmin,
  updatePaymentGatewaySettings
} from "../services/paymentGatewaySettings.service.js";
import { DEFAULT_ADDONS, loadAddonServices, loadApcRates } from "../services/apcSettings.service.js";

const KEYS = ["doi_prefix", "apc_usd", "apc_inr", "site_name", "site_email", "addon_services"] as const;

export const listSettings = async (_req: Request, res: Response): Promise<void> => {
  const rows = await prisma.setting.findMany({ where: { key: { in: [...KEYS] } } });
  const map: Record<string, string> = {};
  for (const k of KEYS) map[k] = "";
  for (const r of rows) map[r.key] = r.value;
  if (!map.addon_services) map.addon_services = JSON.stringify(DEFAULT_ADDONS);
  const paymentGateways = await getPaymentGatewaySettingsForAdmin();
  const addonServices = await loadAddonServices();
  res.json({ ...map, ...paymentGateways, addon_services_parsed: addonServices });
};

export const updateSettings = async (req: Request, res: Response): Promise<void> => {
  const body = req.body as Record<string, string>;
  const pgBody = Object.fromEntries(Object.entries(body).filter(([k]) => k.startsWith("pg_")));
  const entries = Object.entries(body).filter(([k]) => KEYS.includes(k as (typeof KEYS)[number]));

  if (body.apc_usd !== undefined) {
    const usd = parseFloat(String(body.apc_usd));
    if (Number.isNaN(usd) || usd <= 0) {
      res.status(400).json({ message: "USD APC price must be a positive number" });
      return;
    }
  }
  if (body.apc_inr !== undefined) {
    const inr = Math.round(parseFloat(String(body.apc_inr)));
    if (Number.isNaN(inr) || inr <= 0) {
      res.status(400).json({ message: "INR APC price must be a positive number" });
      return;
    }
    body.apc_inr = String(inr);
  }

  for (const [key, value] of entries) {
    const stored =
      key === "apc_inr" ? String(Math.round(parseFloat(String(value ?? "")) || 0)) : String(value ?? "");
    await prisma.setting.upsert({
      where: { key },
      update: { value: stored },
      create: { key, value: stored }
    });
  }

  if (Object.keys(pgBody).length > 0) {
    await updatePaymentGatewaySettings(pgBody);
  }

  const rows = await prisma.setting.findMany({ where: { key: { in: [...KEYS] } } });
  const map: Record<string, string> = {};
  for (const k of KEYS) map[k] = "";
  for (const r of rows) map[r.key] = r.value;
  if (!map.addon_services) map.addon_services = JSON.stringify(DEFAULT_ADDONS);
  const paymentGateways = await getPaymentGatewaySettingsForAdmin();
  const addonServices = await loadAddonServices();
  res.json({ ...map, ...paymentGateways, addon_services_parsed: addonServices });
};

// Public — no auth required, used by client website
export const listPublicAddons = async (_req: Request, res: Response): Promise<void> => {
  const [addons, apcRates] = await Promise.all([loadAddonServices(), loadApcRates()]);
  res.json({
    addons: addons.filter((a) => a.enabled),
    apc: { inr: apcRates.inr, usd: apcRates.usd }
  });
};

import { prisma } from "../config/prisma.js";
import { env } from "../config/env.js";
import { decryptSecret, encryptSecret, isEncryptedSecret, maskSecret } from "../utils/secretCrypto.js";

export const PG_KEYS = {
  razorpayEnabled:    "pg_razorpay_enabled",
  razorpayMode:       "pg_razorpay_mode",
  razorpayKeyId:      "pg_razorpay_key_id",
  razorpayKeySecret:  "pg_razorpay_key_secret",
  smepayEnabled:      "pg_smepay_enabled",
  smepayMode:         "pg_smepay_mode",
  smepayClientId:     "pg_smepay_client_id",
  smepayClientSecret: "pg_smepay_client_secret",
  inrProvider:        "pg_inr_provider",
  paypalEnabled:      "pg_paypal_enabled",
  paypalMode:         "pg_paypal_mode",
  paypalClientId:     "pg_paypal_client_id",
  paypalClientSecret: "pg_paypal_client_secret"
} as const;

const SECRET_DB_KEYS = new Set<string>([
  PG_KEYS.razorpayKeySecret,
  PG_KEYS.smepayClientSecret,
  PG_KEYS.paypalClientSecret
]);

const ALL_KEYS = Object.values(PG_KEYS);

async function readMap(): Promise<Record<string, string>> {
  const rows = await prisma.setting.findMany({ where: { key: { in: ALL_KEYS } } });
  const map: Record<string, string> = {};
  for (const row of rows) map[row.key] = row.value;
  return map;
}

function boolVal(v: string | undefined, fallback = false): boolean {
  if (v === undefined || v === "") return fallback;
  return v === "true" || v === "1";
}

function resolveSecret(dbVal: string | undefined, envVal: string): string {
  if (dbVal?.trim()) {
    return isEncryptedSecret(dbVal) ? decryptSecret(dbVal) : dbVal;
  }
  return envVal;
}

export type PaymentGatewayAdminView = {
  pg_razorpay_enabled: string;
  pg_razorpay_mode: string;
  pg_razorpay_key_id: string;
  pg_razorpay_key_secret: string;
  pg_razorpay_key_secret_set: boolean;
  pg_smepay_enabled: string;
  pg_smepay_mode: string;
  pg_smepay_client_id: string;
  pg_smepay_client_secret: string;
  pg_smepay_client_secret_set: boolean;
  pg_inr_provider: string;
  pg_paypal_enabled: string;
  pg_paypal_mode: string;
  pg_paypal_client_id: string;
  pg_paypal_client_secret: string;
  pg_paypal_client_secret_set: boolean;
};

export async function getPaymentGatewaySettingsForAdmin(): Promise<PaymentGatewayAdminView> {
  const map = await readMap();
  const rSecret  = map[PG_KEYS.razorpayKeySecret];
  const sSecret  = map[PG_KEYS.smepayClientSecret];
  const ppSecret = map[PG_KEYS.paypalClientSecret];

  return {
    pg_razorpay_enabled:        map[PG_KEYS.razorpayEnabled] ?? (env.RAZORPAY_KEY_ID ? "true" : "false"),
    pg_razorpay_mode:           map[PG_KEYS.razorpayMode] ?? "test",
    pg_razorpay_key_id:         map[PG_KEYS.razorpayKeyId] ?? env.RAZORPAY_KEY_ID ?? "",
    pg_razorpay_key_secret:     rSecret ? maskSecret(rSecret) : env.RAZORPAY_KEY_SECRET ? maskSecret(env.RAZORPAY_KEY_SECRET) : "",
    pg_razorpay_key_secret_set: !!(rSecret || env.RAZORPAY_KEY_SECRET),
    pg_smepay_enabled:          map[PG_KEYS.smepayEnabled] ?? "false",
    pg_smepay_mode:             map[PG_KEYS.smepayMode] ?? "test",
    pg_smepay_client_id:        map[PG_KEYS.smepayClientId] ?? "",
    pg_smepay_client_secret:    sSecret ? maskSecret(sSecret) : "",
    pg_smepay_client_secret_set: !!sSecret,
    pg_inr_provider:            map[PG_KEYS.inrProvider] ?? "razorpay",
    pg_paypal_enabled:          map[PG_KEYS.paypalEnabled] ?? (env.PAYPAL_CLIENT_ID ? "true" : "false"),
    pg_paypal_mode:             map[PG_KEYS.paypalMode] ?? env.PAYPAL_MODE ?? "sandbox",
    pg_paypal_client_id:        map[PG_KEYS.paypalClientId] ?? env.PAYPAL_CLIENT_ID ?? "",
    pg_paypal_client_secret:    ppSecret ? maskSecret(ppSecret) : env.PAYPAL_CLIENT_SECRET ? maskSecret(env.PAYPAL_CLIENT_SECRET) : "",
    pg_paypal_client_secret_set: !!(ppSecret || env.PAYPAL_CLIENT_SECRET)
  };
}

export async function updatePaymentGatewaySettings(body: Record<string, string>): Promise<PaymentGatewayAdminView> {
  for (const [key, raw] of Object.entries(body)) {
    if (!ALL_KEYS.includes(key as (typeof ALL_KEYS)[number])) continue;
    const value = String(raw ?? "").trim();
    if (SECRET_DB_KEYS.has(key)) {
      if (!value || value.includes("••••")) continue;
      await prisma.setting.upsert({
        where: { key },
        update: { value: encryptSecret(value) },
        create: { key, value: encryptSecret(value) }
      });
      continue;
    }
    await prisma.setting.upsert({ where: { key }, update: { value }, create: { key, value } });
  }
  return getPaymentGatewaySettingsForAdmin();
}

export type ResolvedPaymentConfig = {
  razorpay: { enabled: boolean; mode: "test" | "live"; keyId: string; keySecret: string };
  smepay:   { enabled: boolean; mode: "test" | "live"; clientId: string; clientSecret: string };
  paypal:   { enabled: boolean; mode: "sandbox" | "live"; clientId: string; clientSecret: string };
  inrProvider: "razorpay" | "smepay";
};

export async function resolvePaymentConfig(): Promise<ResolvedPaymentConfig> {
  const map = await readMap();

  const razorpayKeyId     = map[PG_KEYS.razorpayKeyId] || env.RAZORPAY_KEY_ID;
  const razorpayKeySecret = resolveSecret(map[PG_KEYS.razorpayKeySecret], env.RAZORPAY_KEY_SECRET);
  const razorpayEnabled   = boolVal(map[PG_KEYS.razorpayEnabled], !!razorpayKeyId) && !!razorpayKeyId && !!razorpayKeySecret;

  const smepayClientId     = map[PG_KEYS.smepayClientId] ?? "";
  const smepayClientSecret = resolveSecret(map[PG_KEYS.smepayClientSecret], "");
  const smepayEnabled      = boolVal(map[PG_KEYS.smepayEnabled]) && !!smepayClientId && !!smepayClientSecret;

  const paypalClientId     = map[PG_KEYS.paypalClientId] || env.PAYPAL_CLIENT_ID;
  const paypalClientSecret = resolveSecret(map[PG_KEYS.paypalClientSecret], env.PAYPAL_CLIENT_SECRET);
  const paypalEnabled      = boolVal(map[PG_KEYS.paypalEnabled], !!paypalClientId) && !!paypalClientId && !!paypalClientSecret;

  const inrRaw = map[PG_KEYS.inrProvider] ?? "razorpay";
  let inrProvider: "razorpay" | "smepay" = inrRaw === "smepay" ? "smepay" : "razorpay";
  if (inrProvider === "smepay"   && !smepayEnabled   && razorpayEnabled) inrProvider = "razorpay";
  if (inrProvider === "razorpay" && !razorpayEnabled && smepayEnabled)   inrProvider = "smepay";

  return {
    razorpay: {
      enabled:   razorpayEnabled,
      mode:      map[PG_KEYS.razorpayMode] === "live" ? "live" : "test",
      keyId:     razorpayKeyId,
      keySecret: razorpayKeySecret
    },
    smepay: {
      enabled:      smepayEnabled,
      mode:         map[PG_KEYS.smepayMode] === "live" ? "live" : "test",
      clientId:     smepayClientId,
      clientSecret: smepayClientSecret
    },
    paypal: {
      enabled:      paypalEnabled,
      mode:         (map[PG_KEYS.paypalMode] ?? env.PAYPAL_MODE) === "live" ? "live" : "sandbox",
      clientId:     paypalClientId,
      clientSecret: paypalClientSecret
    },
    inrProvider
  };
}

export async function getPublicPaymentConfig() {
  const cfg = await resolvePaymentConfig();
  return {
    razorpay: { enabled: cfg.razorpay.enabled, keyId: cfg.razorpay.keyId, mode: cfg.razorpay.mode },
    smepay:   { enabled: cfg.smepay.enabled, clientId: cfg.smepay.clientId, mode: cfg.smepay.mode },
    paypal:   { enabled: cfg.paypal.enabled, clientId: cfg.paypal.clientId, mode: cfg.paypal.mode },
    inrProvider: cfg.inrProvider
  };
}

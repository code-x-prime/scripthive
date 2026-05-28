import { env } from "../config/env.js";
import { resolvePaymentConfig } from "./paymentGatewaySettings.service.js";

const getPayPalBase = (mode: "sandbox" | "live") =>
  mode === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";

let cachedToken: { token: string; expiresAt: number; clientId: string } | null = null;

const getAccessToken = async (): Promise<string> => {
  const cfg = await resolvePaymentConfig();
  if (!cfg.paypal.enabled) {
    throw new Error("PayPal is not configured. Add keys in Admin → Settings → Payment gateways.");
  }

  if (cachedToken && cachedToken.expiresAt > Date.now() && cachedToken.clientId === cfg.paypal.clientId) {
    return cachedToken.token;
  }

  const encoded = Buffer.from(`${cfg.paypal.clientId}:${cfg.paypal.clientSecret}`).toString("base64");
  const response = await fetch(`${getPayPalBase(cfg.paypal.mode)}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${encoded}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: "grant_type=client_credentials"
  });
  if (!response.ok) {
    throw new Error("Unable to authenticate PayPal");
  }
  const body = (await response.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    token: body.access_token,
    expiresAt: Date.now() + (body.expires_in - 60) * 1000,
    clientId: cfg.paypal.clientId
  };
  return body.access_token;
};

export const createPayPalOrder = async (invoiceId: string, amount: number): Promise<string> => {
  const cfg = await resolvePaymentConfig();
  const access = await getAccessToken();
  const response = await fetch(`${getPayPalBase(cfg.paypal.mode)}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${access}`,
      "Content-Type": "application/json",
      "PayPal-Request-Id": invoiceId
    },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: invoiceId,
          amount: { currency_code: "USD", value: amount.toFixed(2) },
          description: `ScriptHive APC for ${invoiceId}`
        }
      ]
    })
  });
  if (!response.ok) {
    throw new Error("Failed to create PayPal order");
  }
  const body = (await response.json()) as { id: string };
  return body.id;
};

export const capturePayPalOrder = async (orderId: string): Promise<{ captureId: string; status: string }> => {
  const cfg = await resolvePaymentConfig();
  const access = await getAccessToken();
  const response = await fetch(`${getPayPalBase(cfg.paypal.mode)}/v2/checkout/orders/${orderId}/capture`, {
    method: "POST",
    headers: { Authorization: `Bearer ${access}`, "Content-Type": "application/json" }
  });
  if (!response.ok) {
    throw new Error("Failed to capture PayPal order");
  }
  const body = (await response.json()) as {
    status: string;
    purchase_units?: Array<{ payments?: { captures?: Array<{ id: string }> } }>;
  };
  const captureId = body.purchase_units?.[0]?.payments?.captures?.[0]?.id;
  if (!captureId) {
    throw new Error("PayPal capture id missing");
  }
  return { captureId, status: body.status };
};

export const getPayPalClientId = async (): Promise<string> => {
  const cfg = await resolvePaymentConfig();
  return cfg.paypal.clientId;
};

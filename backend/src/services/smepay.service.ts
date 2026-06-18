import { resolvePaymentConfig } from "./paymentGatewaySettings.service.js";
import { env } from "../config/env.js";

function baseUrl(mode: "test" | "live"): string {
  return mode === "live" ? "https://extranet.smepay.in" : "https://staging.smepay.in";
}

async function getAccessToken(clientId: string, clientSecret: string, mode: "test" | "live"): Promise<string> {
  const res = await fetch(`${baseUrl(mode)}/api/wiz/external/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret })
  });
  const json = (await res.json()) as { access_token?: string; message?: string };
  if (!res.ok || !json.access_token) {
    throw new Error(json.message ?? "SMEPay auth failed");
  }
  return json.access_token;
}

export async function createSmepayOrder(
  invoiceId: string,
  amountInRupees: number,
  customerEmail: string,
  customerName: string,
  submissionId?: string
): Promise<{ orderSlug: string; paymentUrl: string; orderId: string }> {
  const cfg = await resolvePaymentConfig();
  if (!cfg.smepay.enabled) throw new Error("SMEPay is not configured");

  const token = await getAccessToken(cfg.smepay.clientId, cfg.smepay.clientSecret, cfg.smepay.mode);
  // callback_url must be a backend API endpoint — SMEPay POSTs to it
  const backendBase = env.BACKEND_PUBLIC_URL ?? env.FRONTEND_URL ?? "http://localhost:3001";
  const callbackUrl = `${backendBase}/api/payments/smepay/webhook`;
  // ref_id shown in SMEPay dashboard — use submission ID if available
  const safeOrderId = submissionId
    ? submissionId.replace(/[^A-Za-z0-9_-]/g, "-")
    : `INV-${invoiceId.replace(/[^A-Za-z0-9_-]/g, "-")}-${Date.now()}`;

  const res = await fetch(`${baseUrl(cfg.smepay.mode)}/api/wiz/external/order/create`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      client_id: cfg.smepay.clientId,
      amount: String(Math.round(amountInRupees)),
      order_id: safeOrderId,
      callback_url: callbackUrl,
      customer_details: {
        email: customerEmail,
        mobile: "9999999999",
        name: customerName || "Customer"
      }
    })
  });

  const json = (await res.json()) as {
    status?: boolean;
    message?: string;
    order_slug?: string;
    payment_url?: string;
    order_id?: string;
  };

  if (!res.ok || !json.status || !json.order_slug) {
    throw new Error(json.message ?? "SMEPay order creation failed");
  }

  return {
    orderSlug: json.order_slug,
    paymentUrl: json.payment_url ?? "",
    orderId: json.order_id ?? ""
  };
}

export async function validateSmepayOrder(
  orderSlug: string,
  amountInRupees: number
): Promise<"SUCCESS" | "FAILED" | "PENDING"> {
  const cfg = await resolvePaymentConfig();
  if (!cfg.smepay.enabled) throw new Error("SMEPay is not configured");

  const token = await getAccessToken(cfg.smepay.clientId, cfg.smepay.clientSecret, cfg.smepay.mode);

  const res = await fetch(`${baseUrl(cfg.smepay.mode)}/api/wiz/external/order/validate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      client_id: cfg.smepay.clientId,
      amount: amountInRupees,
      slug: orderSlug
    })
  });

  const json = (await res.json()) as {
    status?: boolean;
    payment_status?: string;
    message?: string;
  };

  if (!res.ok) return "FAILED";
  if (json.status && json.payment_status === "SUCCESS") return "SUCCESS";
  if (json.payment_status === "FAILED") return "FAILED";
  return "PENDING";
}

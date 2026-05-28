import type { PaymentsListPayload } from "@/types";
import { apiJson } from "./api";

export type PublicPaymentConfig = {
  razorpay: { enabled: boolean; keyId: string; mode: "test" | "live" };
  smepay:   { enabled: boolean; clientId: string; mode: "test" | "live" };
  paypal:   { enabled: boolean; clientId: string; mode: "sandbox" | "live" };
  inrProvider: "razorpay" | "smepay";
};

export const paymentService = {
  getConfig: () => apiJson<{ status: string; data: PublicPaymentConfig }>("/payments/config"),

  createPaypalOrder: (invoiceId: string) =>
    apiJson<{ data: { orderId: string } }>("/payments/paypal/create-order", {
      method: "POST", body: JSON.stringify({ invoiceId })
    }),
  capturePaypal: (orderId: string, invoiceId: string) =>
    apiJson<{ data: { transactionId: string } }>("/payments/paypal/capture", {
      method: "POST", body: JSON.stringify({ orderId, invoiceId })
    }),

  createRazorpayOrder: (invoiceId: string) =>
    apiJson<{ data: { orderId: string; amount: number; keyId?: string } }>("/payments/razorpay/create-order", {
      method: "POST", body: JSON.stringify({ invoiceId })
    }),
  verifyRazorpay: (payload: Record<string, string>) =>
    apiJson<{ data: { transactionId: string } }>("/payments/razorpay/verify", {
      method: "POST", body: JSON.stringify(payload)
    }),

  createSmepayOrder: (invoiceId: string) =>
    apiJson<{ data: { orderSlug: string; paymentUrl: string } }>("/payments/smepay/create-order", {
      method: "POST", body: JSON.stringify({ invoiceId })
    }),
  verifySmepay: (invoiceId: string, orderSlug: string) =>
    apiJson<{ data: { transactionId?: string; alreadyPaid?: boolean } }>("/payments/smepay/verify", {
      method: "POST", body: JSON.stringify({ invoiceId, orderSlug })
    }),

  listAdmin: () => apiJson<{ status: string; data: PaymentsListPayload }>("/payments", { method: "GET" })
};

import crypto from "crypto";
import Razorpay from "razorpay";
import { resolvePaymentConfig } from "./paymentGatewaySettings.service.js";

async function getClient(): Promise<Razorpay> {
  const cfg = await resolvePaymentConfig();
  if (!cfg.razorpay.enabled) {
    throw new Error("Razorpay is not configured. Add keys in Admin → Settings → Payment gateways.");
  }
  return new Razorpay({
    key_id: cfg.razorpay.keyId,
    key_secret: cfg.razorpay.keySecret
  });
}

export const createRazorpayOrder = async (
  invoiceId: string,
  amountInPaise: number
): Promise<{ orderId: string; amount: number; currency: string; keyId: string }> => {
  const cfg = await resolvePaymentConfig();
  const razorpay = await getClient();
  const order = await razorpay.orders.create({
    amount: amountInPaise,
    currency: "INR",
    receipt: invoiceId
  });
  return {
    orderId: order.id,
    amount: order.amount as number,
    currency: order.currency,
    keyId: cfg.razorpay.keyId
  };
};

export const verifyRazorpayPayment = async (
  orderId: string,
  paymentId: string,
  signature: string
): Promise<boolean> => {
  const cfg = await resolvePaymentConfig();
  const body = `${orderId}|${paymentId}`;
  const expected = crypto.createHmac("sha256", cfg.razorpay.keySecret).update(body).digest("hex");
  return signature === expected;
};

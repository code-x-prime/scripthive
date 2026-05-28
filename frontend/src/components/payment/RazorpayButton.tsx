import { useEffect, useState } from "react";

interface RazorpayProps {
  invoiceId: string;
  razorpayKeyId?: string;
  onSuccess: (transactionId: string) => void;
  onError: () => void;
}

declare global {
  interface Window {
    Razorpay: new (options: {
      key: string;
      amount: number;
      currency: string;
      name: string;
      description: string;
      order_id: string;
      handler: (response: {
        razorpay_payment_id: string;
        razorpay_order_id: string;
        razorpay_signature: string;
      }) => void;
    }) => { open: () => void };
  }
}

let razorpayScriptPromise: Promise<void> | null = null;

function loadRazorpayScript(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  if (razorpayScriptPromise) return razorpayScriptPromise;
  razorpayScriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Razorpay script failed")));
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Razorpay script failed"));
    document.body.appendChild(script);
  });
  return razorpayScriptPromise;
}

export const RazorpayButton = ({ invoiceId, razorpayKeyId, onSuccess, onError }: RazorpayProps) => {
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void loadRazorpayScript().catch(() => undefined);
  }, []);

  const handleClick = async () => {
    setBusy(true);
    try {
      await loadRazorpayScript();
      const orderRes = await fetch("/api/payments/razorpay/create-order", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId })
      });
      const orderJson = (await orderRes.json()) as {
        status?: string;
        message?: string;
        data?: { orderId: string; amount: number; keyId?: string };
      };
      if (!orderRes.ok || !orderJson.data) {
        throw new Error(orderJson.message ?? "Could not create Razorpay order");
      }
      const key = orderJson.data.keyId ?? razorpayKeyId;
      if (!key) throw new Error("Razorpay key not configured");

      const razorpay = new window.Razorpay({
        key,
        amount: orderJson.data.amount,
        currency: "INR",
        name: "ScriptHive Publication House",
        description: `Invoice ${invoiceId}`,
        order_id: orderJson.data.orderId,
        handler: async (response) => {
          const verifyRes = await fetch("/api/payments/razorpay/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...response, invoiceId })
          });
          const verifyJson = (await verifyRes.json()) as {
            status: string;
            data?: { transactionId: string };
            message?: string;
          };
          if (verifyJson.status === "success" && verifyJson.data) {
            onSuccess(verifyJson.data.transactionId);
            return;
          }
          onError();
        }
      });
      razorpay.open();
    } catch {
      onError();
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => void handleClick()}
      className="w-full rounded-lg bg-green-600 px-4 py-3 text-white hover:bg-green-700 disabled:opacity-50"
    >
      {busy ? "Opening Razorpay…" : "Pay with Razorpay"}
    </button>
  );
};

import { useState, useEffect, useRef } from "react";
import { paymentService } from "@/services/payment.service";

declare global {
  interface Window {
    smepayCheckout?: (opts: {
      slug: string;
      onSuccess?: (data: { callback_url?: string }) => void;
      onFailure?: () => void;
    }) => void;
  }
}

interface Props {
  invoiceId: string;
  onSuccess: (transactionId: string) => void;
  onError: () => void;
}

export const SMEPayButton = ({ invoiceId, onSuccess, onError }: Props) => {
  const [loading, setLoading]   = useState(false);
  const scriptLoaded            = useRef(false);

  useEffect(() => {
    if (scriptLoaded.current) return;
    scriptLoaded.current = true;
    const s = document.createElement("script");
    s.src = "https://typof.co/smepay/checkout-v2.js";
    s.async = true;
    document.body.appendChild(s);
  }, []);

  const handlePay = async () => {
    setLoading(true);
    try {
      const res = await paymentService.createSmepayOrder(invoiceId);
      const { orderSlug } = res.data;

      if (!window.smepayCheckout) {
        onError();
        return;
      }

      window.smepayCheckout({
        slug: orderSlug,
        onSuccess: async () => {
          try {
            const verify = await paymentService.verifySmepay(invoiceId, orderSlug);
            if (verify.data?.transactionId || verify.data?.alreadyPaid) {
              onSuccess(verify.data.transactionId ?? orderSlug);
            } else {
              onError();
            }
          } catch {
            onError();
          } finally {
            setLoading(false);
          }
        },
        onFailure: () => {
          setLoading(false);
          onError();
        }
      });
    } catch {
      setLoading(false);
      onError();
    }
  };

  return (
    <button
      type="button"
      disabled={loading}
      onClick={() => void handlePay()}
      className="w-full rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
    >
      {loading ? (
        <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />Opening SMEPay…</>
      ) : (
        "Pay with SMEPay (UPI / QR)"
      )}
    </button>
  );
};

import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import toast from "react-hot-toast";
import { CardSkeleton } from "../../components/skeletons/CardSkeleton";
import { PayPalButton } from "../../components/payment/PayPalButton";
import { RazorpayButton } from "../../components/payment/RazorpayButton";
import { SMEPayButton } from "../../components/payment/SMEPayButton";
import { paymentService, type PublicPaymentConfig } from "../../services/payment.service";
import type { Invoice } from "../../types";

const paidStatuses = new Set(["paid", "Paid", "PAID"]);

export const PaymentPage = () => {
  const { id } = useParams<{ id: string }>();
  const [invoice, setInvoice]   = useState<Invoice | null>(null);
  const [payConfig, setPayConfig] = useState<PublicPaymentConfig | null>(null);
  const [loading, setLoading]   = useState(true);
  const [result, setResult]     = useState<string | null>(null);
  const [error, setError]       = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!id) { setLoading(false); return; }
      setLoading(true);
      setError(null);
      try {
        const [invoiceRes, configRes] = await Promise.all([
          fetch(`/api/invoices/${encodeURIComponent(id)}`),
          paymentService.getConfig().catch(() => null)
        ]);
        if (invoiceRes.status === 404) { setInvoice(null); setError("Invoice not found."); return; }
        if (!invoiceRes.ok) throw new Error("Something went wrong. Please try again.");
        setInvoice((await invoiceRes.json()) as Invoice);
        if (configRes?.data) setPayConfig(configRes.data);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Something went wrong.");
        setError("Could not load invoice.");
        setInvoice(null);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [id]);

  const inrProvider = useMemo(() => payConfig?.inrProvider ?? "razorpay", [payConfig]);

  if (loading) return <main className="mx-auto max-w-2xl p-6"><CardSkeleton /></main>;

  if (error && !invoice) {
    return <main className="mx-auto max-w-2xl p-6"><h1 className="text-xl font-semibold text-gray-900">Payment</h1><p className="mt-4 text-gray-600">{error}</p></main>;
  }
  if (!invoice) {
    return <main className="mx-auto max-w-2xl p-6"><h1 className="text-xl font-semibold text-gray-900">Payment</h1><p className="mt-4 text-gray-600">Invoice not found.</p></main>;
  }
  if (paidStatuses.has(invoice.status)) {
    return <main className="mx-auto max-w-2xl p-6"><h1 className="text-xl font-semibold text-gray-900">Already paid</h1><p className="mt-2 text-gray-600">This invoice has been settled. Thank you.</p></main>;
  }
  if (result) {
    return <main className="mx-auto max-w-2xl p-6"><h1 className="text-xl font-semibold text-green-800">Payment successful</h1><p className="mt-2 text-gray-700">{result}</p></main>;
  }

  const payable = invoice.total;
  const cur = (invoice.currency || "").toUpperCase();

  if (cur !== "USD" && cur !== "INR") {
    return <main className="mx-auto max-w-2xl p-6"><h1 className="text-xl font-semibold text-gray-900">Unsupported currency</h1><p className="mt-2 text-gray-600">Contact the journal office.</p></main>;
  }

  const showRazorpay = cur === "INR" && payConfig?.razorpay.enabled && (inrProvider === "razorpay" || !payConfig.smepay.enabled);
  const showSmepay   = cur === "INR" && payConfig?.smepay.enabled   && (inrProvider === "smepay"   || !payConfig.razorpay.enabled);
  const showPayPal   = cur === "USD" && payConfig?.paypal.enabled;

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="text-2xl font-semibold text-gray-900">Invoice payment</h1>
      <p className="mt-2 text-slate-600">Invoice: {invoice.id}</p>
      <p className="text-slate-700">
        Amount: {cur === "INR" ? "₹" : "$"}
        {payable.toLocaleString(cur === "INR" ? "en-IN" : "en-US", {
          minimumFractionDigits: cur === "INR" ? 0 : 2,
          maximumFractionDigits: cur === "INR" ? 0 : 2
        })}
      </p>
      {payConfig && cur === "INR" && (
        <p className="mt-1 text-xs text-gray-500">
          Gateway: {inrProvider === "smepay" ? "SMEPay" : "Razorpay"} ({payConfig[inrProvider].mode} mode)
        </p>
      )}

      <div className="mt-6 space-y-4">
        {showPayPal && (
          <PayPalButton
            invoiceId={invoice.id}
            clientId={payConfig?.paypal.clientId ?? ""}
            onSuccess={(tid) => setResult(`Transaction ID: ${tid}`)}
            onError={() => toast.error("PayPal payment failed.")}
          />
        )}
        {cur === "USD" && !showPayPal && (
          <p className="text-sm text-amber-700">PayPal is not configured. Contact the journal office.</p>
        )}
        {showRazorpay && (
          <RazorpayButton
            invoiceId={invoice.id}
            razorpayKeyId={payConfig?.razorpay.keyId}
            onSuccess={(tid) => setResult(`Payment ID: ${tid}`)}
            onError={() => toast.error("Razorpay payment failed.")}
          />
        )}
        {showSmepay && (
          <SMEPayButton
            invoiceId={invoice.id}
            onSuccess={(tid) => setResult(`Transaction ID: ${tid}`)}
            onError={() => toast.error("SMEPay payment failed.")}
          />
        )}
        {cur === "INR" && !showRazorpay && !showSmepay && (
          <p className="text-sm text-amber-700">
            No INR payment gateway is configured. Add Razorpay or SMEPay keys in Admin → Settings → Payment gateways.
          </p>
        )}
      </div>
    </main>
  );
};

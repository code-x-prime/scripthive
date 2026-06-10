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

  if (loading) return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="w-full max-w-lg"><CardSkeleton /></div>
    </main>
  );

  if (error && !invoice) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="w-full max-w-lg bg-white border border-slate-200 shadow-sm p-8 text-center">
          <div className="text-4xl mb-4">⚠️</div>
          <h1 className="text-xl font-bold text-slate-900">Invoice Not Found</h1>
          <p className="mt-2 text-slate-500 text-sm">{error}</p>
        </div>
      </main>
    );
  }

  if (!invoice) return null;

  if (paidStatuses.has(invoice.status)) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="w-full max-w-lg bg-white border border-slate-200 shadow-sm p-8 text-center">
          <div className="text-5xl mb-4">✅</div>
          <h1 className="text-2xl font-bold text-green-800">Payment Complete</h1>
          <p className="mt-2 text-slate-500">This invoice has already been settled. Thank you!</p>
          {invoice.submissionId && (
            <p className="mt-3 text-xs text-slate-400 font-mono">Submission ID: {invoice.submissionId}</p>
          )}
        </div>
      </main>
    );
  }

  if (result) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="w-full max-w-lg bg-white border border-slate-200 shadow-sm p-8 text-center">
          <div className="text-5xl mb-4">🎉</div>
          <h1 className="text-2xl font-bold text-green-800">Payment Successful!</h1>
          <p className="mt-2 text-slate-600 text-sm">{result}</p>
          {invoice.submissionId && (
            <p className="mt-3 text-xs text-slate-400 font-mono">Submission ID: {invoice.submissionId}</p>
          )}
        </div>
      </main>
    );
  }

  const payable = invoice.total;
  const cur = (invoice.currency || "").toUpperCase();
  const sym = cur === "INR" ? "₹" : "$";
  const items = Array.isArray(invoice.items) ? invoice.items as { description: string; amount: number }[] : [];

  if (cur !== "USD" && cur !== "INR") {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="w-full max-w-lg bg-white border border-slate-200 p-8 text-center">
          <p className="text-slate-600">Unsupported currency. Contact the journal office.</p>
        </div>
      </main>
    );
  }

  const showRazorpay = cur === "INR" && payConfig?.razorpay.enabled && (inrProvider === "razorpay" || !payConfig.smepay.enabled);
  const showSmepay   = cur === "INR" && payConfig?.smepay.enabled   && (inrProvider === "smepay"   || !payConfig.razorpay.enabled);
  const showPayPal   = cur === "USD" && payConfig?.paypal.enabled;

  const fmtAmt = (n: number) => n.toLocaleString(cur === "INR" ? "en-IN" : "en-US", {
    minimumFractionDigits: cur === "INR" ? 0 : 2,
    maximumFractionDigits: cur === "INR" ? 0 : 2
  });

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">

        {/* Header */}
        <div className="bg-[#0f172a] px-8 py-6">
          <div className="text-white font-bold text-xl tracking-tight">ScriptHive Publication</div>
          <div className="text-[#93c5fd] text-xs font-semibold tracking-widest uppercase mt-1">Article Processing Charge</div>
        </div>

        {/* Blue title bar */}
        <div className="bg-[#1d4ed8] px-8 py-3">
          <div className="text-white font-bold text-sm tracking-wide">SECURE PAYMENT</div>
        </div>

        {/* Body */}
        <div className="bg-white border-x border-[#dde3ed] px-8 py-7 space-y-5">

          {/* Submission info */}
          <div className="border border-[#dde3ed]">
            <div className="bg-[#0f172a] px-4 py-2.5">
              <span className="text-[#93c5fd] text-xs font-bold uppercase tracking-widest">Invoice Details</span>
            </div>
            <table className="w-full text-sm">
              {invoice.submissionId && (
                <tr className="bg-slate-50">
                  <td className="px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-slate-500 border-b border-[#e8edf4] w-[42%] border-r border-r-[#e8edf4]">Submission ID</td>
                  <td className="px-4 py-2.5 font-bold text-[#1d4ed8] font-mono border-b border-[#e8edf4]">{invoice.submissionId}</td>
                </tr>
              )}
              <tr className="bg-white">
                <td className="px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-slate-500 border-b border-[#e8edf4] border-r border-r-[#e8edf4]">Invoice No.</td>
                <td className="px-4 py-2.5 font-mono text-slate-700 border-b border-[#e8edf4]">{invoice.id}</td>
              </tr>
              {invoice.customerName && (
                <tr className="bg-slate-50">
                  <td className="px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-slate-500 border-b border-[#e8edf4] border-r border-r-[#e8edf4]">Author</td>
                  <td className="px-4 py-2.5 font-semibold text-slate-800 border-b border-[#e8edf4]">{invoice.customerName}</td>
                </tr>
              )}
              {invoice.submission?.title && (
                <tr className="bg-white">
                  <td className="px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-slate-500 border-r border-r-[#e8edf4]">Paper Title</td>
                  <td className="px-4 py-2.5 text-slate-700 leading-snug">{invoice.submission.title}</td>
                </tr>
              )}
            </table>
          </div>

          {/* Line items */}
          {items.length > 0 && (
            <div className="border border-[#dde3ed]">
              <div className="bg-[#0f172a] px-4 py-2.5">
                <span className="text-[#93c5fd] text-xs font-bold uppercase tracking-widest">Breakdown</span>
              </div>
              {items.map((item, i) => (
                <div key={i} className={`flex justify-between items-center px-4 py-2.5 border-b border-[#e8edf4] ${i % 2 === 0 ? "bg-slate-50" : "bg-white"}`}>
                  <span className="text-sm text-slate-600">{item.description}</span>
                  <span className="font-mono font-semibold text-slate-800">{sym}{fmtAmt(item.amount)}</span>
                </div>
              ))}
            </div>
          )}

          {/* Total */}
          <div className="bg-[#eff6ff] border border-[#bfdbfe] px-5 py-4 flex justify-between items-center">
            <span className="font-bold text-[#1d4ed8] text-sm uppercase tracking-wide">Total Payable</span>
            <span className="font-mono font-extrabold text-[#1d4ed8] text-2xl">{sym}{fmtAmt(payable)}</span>
          </div>

          {/* Gateway info */}
          {payConfig && cur === "INR" && (
            <p className="text-xs text-slate-400 text-center">
              Gateway: {inrProvider === "smepay" ? "SMEPay" : "Razorpay"} · {payConfig[inrProvider as "razorpay" | "smepay"]?.mode} mode
            </p>
          )}

          {/* Payment buttons */}
          <div className="space-y-3 pt-1">
            {showPayPal && (
              <PayPalButton
                invoiceId={invoice.id}
                clientId={payConfig?.paypal.clientId ?? ""}
                onSuccess={(tid) => setResult(`Transaction ID: ${tid}`)}
                onError={() => toast.error("PayPal payment failed.")}
              />
            )}
            {cur === "USD" && !showPayPal && (
              <p className="text-sm text-amber-700 text-center">PayPal not configured. Contact journal office.</p>
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
              <p className="text-sm text-amber-700 text-center">No INR gateway configured. Add keys in Admin → Settings.</p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-100 border border-[#dde3ed] border-t-[3px] border-t-[#1d4ed8] px-8 py-5">
          <div className="text-sm font-bold text-slate-800">ScriptHive Publication</div>
          <div className="text-xs text-slate-500 mt-1">
            scripthive.org · info@scripthive.org · +91 9899916683
          </div>
          <div className="text-xs text-slate-400 mt-2">Secure payment via TLS encryption. Your data is protected.</div>
        </div>
        <div className="bg-[#0f172a] h-1" />

      </div>
    </main>
  );
};

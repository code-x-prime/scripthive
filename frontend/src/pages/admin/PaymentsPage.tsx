import { fmtDate } from "@/utils/formatDate";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import toast from "react-hot-toast";
import { Download, FileText, Mail, Plus, Search, Send, Star, X } from "lucide-react";
import { apiJson } from "@/services/api";
import { paymentService } from "@/services/payment.service";
import { apcAmountForCurrency } from "@/utils/apcAmounts";
import type { Invoice, PaymentStats } from "@/types";
import { StatusBadge } from "@/components/common/StatusBadge";
import { usePermissions } from "@/hooks/usePermissions";
import { buildCsv, downloadCsv } from "@/utils/exportCsv";

function formatDate(iso?: string | null): string {
  if (!iso) return "—";
  return fmtDate(iso);
}

const STATUS_OPTIONS = ["Draft", "Pending", "Paid"] as const;

export const PaymentsPage = () => {
  const { pathname } = useLocation();
  const isCompleted = pathname.includes("/completed");
  const { hasPermission } = usePermissions();
  const canWriteInvoice = hasPermission("invoices:write");

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<PaymentStats>({
    totalRevenueUsd: 0,
    totalRevenueInr: 0,
    pendingCount: 0,
    overdueCount: 0,
    totalInvoices: 0
  });
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [modalInvoice, setModalInvoice] = useState<Invoice | null>(null);
  const [formCurrency, setFormCurrency] = useState("USD");
  const [formTotal, setFormTotal] = useState("");
  const [formDue, setFormDue] = useState("");
  const [formStatus, setFormStatus] = useState("Draft");
  const [saving, setSaving] = useState(false);
  const [apcRates, setApcRates] = useState({ usd: 140, inr: 11500 });

  const [search, setSearch] = useState("");
  const [markPaidModal, setMarkPaidModal] = useState<Invoice | null>(null);
  const [payMethod, setPayMethod] = useState("UPI");
  const [payUTR, setPayUTR] = useState("");
  const [payRemarks, setPayRemarks] = useState("");
  const [manualInvModal, setManualInvModal] = useState(false);
  const [manualSubId, setManualSubId] = useState("");
  const [manualAmt, setManualAmt] = useState("");
  const [manualCur, setManualCur] = useState("INR");
  const [manualSaving, setManualSaving] = useState(false);
  const [subList, setSubList] = useState<{id: string; title: string; authorName: string}[]>([]);

  // inline amount editing state: invoiceId -> draft value
  const [editingAmount, setEditingAmount] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await paymentService.listAdmin();
      console.log("Loaded invoices from listAdmin API:", res.data.invoices);
      if (res.data.apc) setApcRates(res.data.apc);
      setStats(res.data.stats);
      setInvoices(res.data.invoices);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong. Please try again.");
      setStats({ totalRevenueUsd: 0, totalRevenueInr: 0, pendingCount: 0, overdueCount: 0, totalInvoices: 0 });
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  const tableRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = invoices
      .filter((i) => isCompleted ? i.status === "Paid" : (i.status === "Draft" || i.status === "Pending"))
      .filter((i) => !q || (
        i.submissionId?.toLowerCase().includes(q) ||
        i.submission?.title?.toLowerCase().includes(q) ||
        i.customerName?.toLowerCase().includes(q) ||
        i.customerEmail?.toLowerCase().includes(q)
      ));
    return [...filtered].sort((a, b) => (b.submission?.priority ? 1 : 0) - (a.submission?.priority ? 1 : 0));
  }, [invoices, isCompleted, search]);

  const onPriorityToggle = async (submissionId: string, current: boolean) => {
    try {
      await apiJson(`/submissions/${encodeURIComponent(submissionId)}/priority`, {
        method: "PUT",
        body: JSON.stringify({ priority: !current })
      });
      setInvoices((prev) =>
        prev.map((inv) =>
          inv.submissionId === submissionId && inv.submission
            ? { ...inv, submission: { ...inv.submission, priority: !current } }
            : inv
        )
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    }
  };

  // inline amount save on blur
  const onAmountBlur = async (inv: Invoice) => {
    const raw = editingAmount[inv.id];
    if (raw === undefined) return;
    const val = parseFloat(raw);
    if (Number.isNaN(val) || val <= 0) {
      toast.error("Invalid amount");
      setEditingAmount((p) => { const n = { ...p }; delete n[inv.id]; return n; });
      return;
    }
    if (val === inv.total) {
      setEditingAmount((p) => { const n = { ...p }; delete n[inv.id]; return n; });
      return;
    }
    try {
      await apiJson(`/invoices/${encodeURIComponent(inv.id)}`, {
        method: "PUT",
        body: JSON.stringify({ total: val })
      });
      setInvoices((prev) => prev.map((i) => i.id === inv.id ? { ...i, total: val, subtotal: val } : i));
      toast.success("Amount updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    } finally {
      setEditingAmount((p) => { const n = { ...p }; delete n[inv.id]; return n; });
    }
  };


  const openModal = (inv: Invoice) => {
    console.log("openModal input inv:", inv, "apcRates:", apcRates);
    setModalInvoice(inv);
    setFormCurrency(inv.currency || "USD");
    const initialTotal = inv.total > 0 ? inv.total : apcAmountForCurrency(inv.currency || "USD", apcRates);
    console.log("openModal initialTotal computed:", initialTotal);
    setFormTotal(String(initialTotal ?? ""));
    setFormDue(inv.dueDate ? inv.dueDate.slice(0, 10) : "");
    setFormStatus(inv.status);
  };

  const closeModal = () => setModalInvoice(null);

  const onCurrencyChange = (currency: string) => {
    setFormCurrency(currency);
    setFormTotal(String(apcAmountForCurrency(currency, apcRates)));
  };

  const saveAndSend = async () => {
    if (!modalInvoice) return;
    const total = parseFloat(formTotal);
    if (Number.isNaN(total) || total <= 0) { toast.error("Enter a valid amount"); return; }
    setSaving(true);
    try {
      await apiJson(`/invoices/${encodeURIComponent(modalInvoice.id)}`, {
        method: "PUT",
        body: JSON.stringify({ total, currency: formCurrency, dueDate: formDue || null, status: formStatus })
      });
      await apiJson(`/invoices/${encodeURIComponent(modalInvoice.id)}/send-link`, { method: "POST" });
      toast.success("Saved and payment link sent to author");
      closeModal();
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  };

  const openMarkPaid = (inv: Invoice) => {
    setMarkPaidModal(inv);
    setPayMethod("UPI");
    setPayUTR("");
    setPayRemarks("");
  };

  const confirmMarkPaid = async () => {
    if (!markPaidModal) return;
    setSaving(true);
    try {
      await apiJson(`/invoices/${encodeURIComponent(markPaidModal.id)}/mark-paid`, {
        method: "POST",
        body: JSON.stringify({ method: payMethod, utr: payUTR, remarks: payRemarks })
      });
      toast.success(`Marked as paid via ${payMethod}`);
      setMarkPaidModal(null);
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to mark as paid");
    } finally {
      setSaving(false);
    }
  };

  const sendLink = async (inv: Invoice) => {
    if (!canWriteInvoice) { toast.error("No permission to send payment links."); return; }
    try {
      await apiJson(`/invoices/${encodeURIComponent(inv.id)}/send-link`, { method: "POST" });
      toast.success("Payment link sent");
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Send failed");
    }
  };

  return (
    <section className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl text-gray-900">{isCompleted ? "Completed payments" : "Pending payments"}</h1>
          <p className="mt-1 text-sm text-gray-500">
            {isCompleted ? "Paid invoices and settled APC records." : "Draft and pending invoices."}
          </p>
          <p className="mt-2 text-xs text-gray-500">
            Current APC rates: ${apcRates.usd.toLocaleString("en-US")} (USD · PayPal) · ₹
            {apcRates.inr.toLocaleString("en-IN")} (INR · Razorpay / SMEPay). Change in Settings → APC pricing.
          </p>
        </div>
        <button
          type="button"
          disabled={tableRows.length === 0}
          onClick={() => {
            const csv = buildCsv(tableRows, [
              { key: "id", label: "Invoice No.", getValue: (r) => r.id },
              { key: "submissionId", label: "Submission ID", getValue: (r) => r.submissionId ?? "" },
              { key: "title", label: "Paper Title", getValue: (r) => r.submission?.title ?? "" },
              { key: "customerName", label: "Author", getValue: (r) => r.customerName },
              { key: "customerEmail", label: "Email", getValue: (r) => r.customerEmail },
              { key: "address", label: "Address", getValue: (r) => (r.submission as unknown as {authorUser?: {address?: string | null}})?.authorUser?.address ?? "" },
              { key: "state", label: "State", getValue: (r) => (r.submission as unknown as {authorUser?: {state?: string | null}})?.authorUser?.state ?? "" },
              { key: "addons", label: "Add-On Services", getValue: (r) => {
                const addons = (r.submission as unknown as {addons?: {label?: string}[]})?.addons;
                if (!Array.isArray(addons) || addons.length === 0) return "";
                return addons.map((a) => a.label ?? "").filter(Boolean).join(", ");
              }},
              { key: "total", label: "Amount", getValue: (r) => String(r.total) },
              { key: "currency", label: "Currency", getValue: (r) => r.currency },
              { key: "method", label: "Payment Method", getValue: (r) => r.method ?? "" },
              { key: "gatewayPayId", label: "UTR / Ref", getValue: (r) => r.gatewayPayId ?? "" },
              { key: "notes", label: "Remarks", getValue: (r) => r.notes ?? "" },
              { key: "status", label: "Status", getValue: (r) => r.status },
              { key: "paidAt", label: "Paid Date", getValue: (r) => r.paidAt ? fmtDate(r.paidAt) : "" },
              { key: "createdAt", label: "Created", getValue: (r) => fmtDate(r.createdAt) },
            ]);
            downloadCsv(csv, `payments-${isCompleted ? "completed" : "pending"}-${new Date().toISOString().slice(0, 10)}.csv`);
          }}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 shrink-0"
        >
          <Download className="h-4 w-4" />
          Export CSV
        </button>
        {isCompleted && canWriteInvoice && (
          <button
            type="button"
            onClick={() => setManualInvModal(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 shrink-0"
          >
            <Plus className="h-4 w-4" />
            Create Manual Invoice
          </button>
        )}
      </div>

      {loading ? (
        <div className="grid animate-pulse gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((k) => (
            <div key={k} className="h-28 rounded-xl border border-gray-200 bg-white p-4">
              <div className="h-4 w-24 rounded bg-gray-100" />
              <div className="mt-4 h-8 w-32 rounded bg-gray-50" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Total revenue (USD)</p>
            <p className="mt-2 font-mono text-2xl font-semibold text-green-700">${stats.totalRevenueUsd.toFixed(2)}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Total revenue (INR)</p>
            <p className="mt-2 font-mono text-2xl font-semibold text-green-700">
              ₹{stats.totalRevenueInr.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              {isCompleted ? "Paid invoices" : "Pending (draft + sent)"}
            </p>
            <p className="mt-2 text-2xl font-semibold text-gray-900">{isCompleted ? tableRows.length : stats.pendingCount}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Total invoices</p>
            <p className="mt-2 text-2xl font-semibold text-gray-900">{stats.totalInvoices}</p>
          </div>
        </div>
      )}

      {/* Search bar */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Search by ID, title, author..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        />
      </div>

      {loading ? (
        <div className="animate-pulse space-y-3 rounded-xl border border-gray-200 bg-white p-4">
          <div className="h-8 w-full rounded bg-gray-100" />
          <div className="h-10 w-full rounded bg-gray-50" />
          <div className="h-10 w-full rounded bg-gray-50" />
        </div>
      ) : tableRows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-200 bg-white py-12 text-center text-sm text-gray-500">
          No invoices in this view.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="min-w-[1000px] w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
                <th className="px-3 py-3"></th>
                {isCompleted && <th className="px-3 py-3">Invoice No.</th>}
                <th className="px-3 py-3">Submission ID</th>
                <th className="px-3 py-3">Customer</th>
                <th className="px-3 py-3">Amount</th>
                {isCompleted && <th className="px-3 py-3">Payment Method</th>}
                {isCompleted && <th className="px-3 py-3">UTR / Ref</th>}
                <th className="px-3 py-3">Date</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.map((inv) => (
                <tr key={inv.id} className={`border-b border-gray-100 hover:bg-gray-50/80 ${inv.submission?.priority ? "bg-amber-50/40" : ""}`}>
                  {/* star */}
                  <td className="px-3 py-2">
                    {inv.submissionId && (
                      <button
                        type="button"
                        title={inv.submission?.priority ? "High priority — click to unmark" : "Mark as high priority"}
                        onClick={() => void onPriorityToggle(inv.submissionId, inv.submission?.priority ?? false)}
                        className="flex items-center justify-center"
                      >
                        <Star className={`h-4 w-4 transition-colors ${inv.submission?.priority ? "fill-amber-400 text-amber-400" : "text-gray-300 hover:text-amber-300"}`} />
                      </button>
                    )}
                  </td>
                  {isCompleted && <td className="whitespace-nowrap px-3 py-2 font-mono text-xs font-semibold text-blue-700">{inv.id}</td>}
                  <td className="whitespace-nowrap px-3 py-2 font-mono text-gray-700">{inv.submissionId}</td>
                  <td className="max-w-[200px] px-3 py-2">
                    <p className="font-medium text-gray-900">{inv.customerName}</p>
                    <p className="text-xs text-gray-500">{inv.customerEmail}</p>
                  </td>
                  {/* inline editable amount */}
                  <td className="px-3 py-2">
                    {inv.status !== "Paid" && canWriteInvoice ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={editingAmount[inv.id] ?? inv.total}
                          onChange={(e) => setEditingAmount((p) => ({ ...p, [inv.id]: e.target.value }))}
                          onBlur={() => void onAmountBlur(inv)}
                          className="w-24 rounded border border-gray-200 px-2 py-1 text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500"
                        />
                        <span className="text-xs font-semibold text-gray-500">{inv.currency}</span>
                      </div>
                    ) : (
                      <span className="font-medium text-gray-900">
                        {inv.total} <span className="text-xs font-semibold text-gray-500">{inv.currency}</span>
                      </span>
                    )}
                    {!editingAmount[inv.id] && Array.isArray(inv.items) && (inv.items as {description:string;amount:number}[]).length > 1 && (
                      <div className="mt-0.5 space-y-0.5">
                        {(inv.items as {description:string;amount:number}[]).map((item, i) => (
                          <p key={i} className="text-xs text-gray-400 whitespace-nowrap">{item.description}: {inv.currency === "INR" ? "₹" : "$"}{item.amount}</p>
                        ))}
                      </div>
                    )}
                  </td>
                  {/* payment method — completed only */}
                  {isCompleted && (
                    <td className="px-3 py-2">
                      {inv.method ? (
                        <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
                          {inv.method}
                        </span>
                      ) : "—"}
                    </td>
                  )}
                  {/* transaction ID — completed only */}
                  {isCompleted && (
                    <td className="px-3 py-2 font-mono text-xs text-gray-600">
                      {inv.gatewayPayId || inv.gatewayOrderId || "—"}
                    </td>
                  )}
                  <td className="whitespace-nowrap px-3 py-2 text-gray-600">{formatDate(inv.createdAt)}</td>
                  {/* status + tracking */}
                  <td className="px-3 py-2">
                    <StatusBadge status={inv.status} />
                    {inv.status === "Draft" && (
                      <p className="mt-0.5 text-xs text-slate-400">Not sent yet</p>
                    )}
                    {inv.status === "Pending" && (
                      <p className="mt-0.5 text-xs text-amber-600">Link sent — awaiting payment</p>
                    )}
                    {inv.status === "Paid" && inv.paidAt && (
                      <p className="mt-0.5 text-xs text-green-600">Paid {formatDate(inv.paidAt)}</p>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right">
                    <div className="flex justify-end gap-2">
                      {inv.status === "Paid" ? (
                        <Link
                          to={`/admin/invoices/${encodeURIComponent(inv.id)}`}
                          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 text-xs font-semibold text-blue-800 hover:bg-blue-100"
                          title="View / print invoice PDF"
                        >
                          <FileText className="h-3.5 w-3.5" />
                          PDF
                        </Link>
                      ) : inv.status === "Draft" ? (
                        /* Draft — send button */
                        canWriteInvoice ? (
                          <button
                            type="button"
                            title="Set amount & send payment link"
                            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-green-600 px-3 text-xs font-semibold text-white hover:bg-green-700"
                            onClick={() => openModal(inv)}
                          >
                            <Send className="h-3.5 w-3.5" />
                            Send link
                          </button>
                        ) : null
                      ) : (
                        /* Pending — resend + manual mark paid */
                        canWriteInvoice ? (
                          <div className="flex gap-1.5">
                            <button
                              type="button"
                              title="Resend payment link"
                              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 text-xs font-medium text-amber-900 hover:bg-amber-100"
                              onClick={() => void sendLink(inv)}
                            >
                              <Mail className="h-3.5 w-3.5" />
                              Resend
                            </button>
                            <button
                              type="button"
                              title="Mark as paid manually (cash/offline)"
                              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-green-300 bg-green-50 px-3 text-xs font-semibold text-green-800 hover:bg-green-100"
                              onClick={() => openMarkPaid(inv)}
                            >
                              ✓ Mark Paid
                            </button>
                          </div>
                        ) : null
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal — only "Save & send" */}
      {modalInvoice ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-gray-200 bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-heading text-xl text-gray-900">Send payment link</h2>

                {modalInvoice.submission ? (
                  <div className="mt-2 rounded-lg bg-gray-50 px-3 py-2">
                    <p className="text-sm font-medium text-gray-800">{modalInvoice.submission.title}</p>
                    <p className="text-xs text-gray-500">by {modalInvoice.customerName} · {modalInvoice.customerEmail}</p>
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
                onClick={closeModal}
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5 space-y-4">
              {/* Line items breakdown */}
              {Array.isArray(modalInvoice.items) && (modalInvoice.items as {description:string;amount:number}[]).length > 0 && (
                <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-xs text-gray-700">
                  <p className="mb-1.5 font-semibold uppercase tracking-wide text-gray-500">Breakdown</p>
                  {(modalInvoice.items as {description:string;amount:number}[]).map((item, i) => (
                    <div key={i} className="flex justify-between gap-4 py-0.5">
                      <span>{item.description}</span>
                      <span className="font-mono font-medium">{formCurrency === "INR" ? "₹" : "$"}{item.amount.toLocaleString()}</span>
                    </div>
                  ))}
                  <div className="mt-1.5 flex justify-between gap-4 border-t border-gray-200 pt-1.5 font-semibold">
                    <span>Total</span>
                    <span className="font-mono">{formCurrency === "INR" ? "₹" : "$"}{(modalInvoice.items as {description:string;amount:number}[]).reduce((s,i)=>s+i.amount,0).toLocaleString()}</span>
                  </div>
                </div>
              )}
              <label className="flex flex-col gap-1 text-xs font-medium text-gray-600">
                Currency
                <select
                  value={formCurrency}
                  onChange={(e) => onCurrencyChange(e.target.value)}
                  className="h-10 rounded-lg border border-gray-200 px-3 text-sm"
                >
                  <option value="USD">🇺🇸 USD (PayPal) — ${apcRates.usd}</option>
                  <option value="INR">🇮🇳 INR (Razorpay / SMEPay) — ₹{apcRates.inr.toLocaleString("en-IN")}</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium text-gray-600">
                Total amount
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={formTotal}
                  onChange={(e) => setFormTotal(e.target.value)}
                  className="h-10 rounded-lg border border-gray-200 px-3 text-sm"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium text-gray-600">
                Status
                <select
                  value={formStatus}
                  onChange={(e) => setFormStatus(e.target.value)}
                  className="h-10 rounded-lg border border-gray-200 px-3 text-sm"
                >
                  {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium text-gray-600">
                Due date
                <input
                  type="date"
                  value={formDue}
                  onChange={(e) => setFormDue(e.target.value)}
                  className="h-10 rounded-lg border border-gray-200 px-3 text-sm"
                />
              </label>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                disabled={saving}
                onClick={() => void saveAndSend()}
                className="flex items-center gap-2 rounded-lg bg-green-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
                {saving ? "Sending…" : "Save & send payment link"}
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={closeModal}
                className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Mark Paid Modal */}
      {markPaidModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-heading text-lg text-gray-900">Mark as Paid</h2>
              <button type="button" onClick={() => setMarkPaidModal(null)} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-1">Invoice: <span className="font-mono font-semibold text-gray-800">{markPaidModal.id}</span></p>
            {markPaidModal.submission?.title && (
              <p className="text-xs text-gray-500 mb-4 line-clamp-1">{markPaidModal.submission.title}</p>
            )}
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Payment Method</label>
            <select
              value={payMethod}
              onChange={(e) => setPayMethod(e.target.value)}
              className="w-full h-10 rounded-lg border border-gray-200 px-3 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="UPI">UPI</option>
              <option value="Cash">Cash</option>
              <option value="NEFT/RTGS">NEFT / RTGS</option>
              <option value="Cheque/DD">Cheque / DD</option>
              <option value="Other">Other</option>
            </select>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">
              Remarks / Reference Number
            </label>
            <input
              type="text"
              value={payUTR}
              onChange={(e) => setPayUTR(e.target.value)}
              placeholder="UTR / Transaction ID / Cheque No. / any reference"
              className="w-full h-10 rounded-lg border border-gray-200 px-3 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Remarks (optional)</label>
            <input
              type="text"
              value={payRemarks}
              onChange={(e) => setPayRemarks(e.target.value)}
              placeholder="Any additional notes"
              className="w-full h-10 rounded-lg border border-gray-200 px-3 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <div className="flex gap-3">
              <button
                type="button"
                disabled={saving}
                onClick={() => void confirmMarkPaid()}
                className="flex-1 rounded-lg bg-green-600 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
              >
                {saving ? "Saving…" : `✓ Confirm — ${payMethod}`}
              </button>
              <button
                type="button"
                onClick={() => setMarkPaidModal(null)}
                className="rounded-lg border border-gray-200 px-4 text-sm text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Invoice Modal */}
      {manualInvModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-heading text-lg text-gray-900">Create Manual Invoice</h2>
              <button type="button" onClick={() => setManualInvModal(false)} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-3">
              <label className="flex flex-col gap-1 text-xs font-medium text-gray-600">
                Select Submission
                <select value={manualSubId} onChange={(e) => setManualSubId(e.target.value)}
                  onFocus={async () => {
                    if (subList.length === 0) {
                      try {
                        const data = await apiJson<{id:string;title:string;authorName:string}[]>("/submissions?status=Accepted&limit=200");
                        setSubList(Array.isArray(data) ? data : []);
                      } catch { /* ignore */ }
                    }
                  }}
                  className="h-10 rounded-lg border border-gray-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                  <option value="">— Select submission —</option>
                  {subList.map(s => (
                    <option key={s.id} value={s.id}>{s.id} — {s.authorName} — {s.title?.slice(0,40)}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium text-gray-600">
                Amount
                <input type="number" min={0} step="0.01" value={manualAmt} onChange={(e) => setManualAmt(e.target.value)}
                  placeholder="0"
                  className="h-10 rounded-lg border border-gray-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium text-gray-600">
                Currency
                <select value={manualCur} onChange={(e) => setManualCur(e.target.value)}
                  className="h-10 rounded-lg border border-gray-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                  <option value="INR">INR</option>
                  <option value="USD">USD</option>
                </select>
              </label>
            </div>
            <div className="mt-5 flex gap-3">
              <button type="button" disabled={manualSaving || !manualSubId.trim() || !manualAmt}
                onClick={async () => {
                  setManualSaving(true);
                  try {
                    await apiJson(`/invoices`, {
                      method: "POST",
                      body: JSON.stringify({ submissionId: manualSubId.trim(), total: parseFloat(manualAmt), currency: manualCur, status: "Paid" })
                    });
                    toast.success("Invoice created");
                    setManualInvModal(false);
                    setManualSubId(""); setManualAmt(""); setManualCur("INR");
                    void load();
                  } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
                  finally { setManualSaving(false); }
                }}
                className="flex-1 rounded-lg bg-green-600 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50">
                {manualSaving ? "Creating…" : "Create Invoice"}
              </button>
              <button type="button" onClick={() => setManualInvModal(false)}
                className="rounded-lg border border-gray-200 px-4 text-sm text-gray-600 hover:bg-gray-50">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

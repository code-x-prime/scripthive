import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import { Download } from "lucide-react";
import { apiJson } from "@/services/api";
import type { Invoice } from "@/types";

function formatDate(iso?: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export const InvoiceViewPage = () => {
  const { id } = useParams<{ id: string }>();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!id) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const data = await apiJson<Invoice>(`/invoices/${encodeURIComponent(id)}`);
        setInvoice(data);
      } catch (e) {
        setInvoice(null);
        toast.error(e instanceof Error ? e.message : "Could not load invoice");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [id]);

  const items = useMemo(() => {
    const raw = invoice?.items;
    if (Array.isArray(raw)) {
      return raw.map((row) => {
        const item = row as { description?: string; amount?: number };
        return {
          description: item.description ?? "Item",
          amount: typeof item.amount === "number" ? item.amount : 0
        };
      });
    }
    return [];
  }, [invoice?.items]);

  const printPage = () => window.print();

  if (loading) {
    return (
      <section className="mx-auto max-w-4xl animate-pulse space-y-4 px-2">
        <div className="h-8 w-40 rounded bg-gray-100" />
        <div className="h-64 rounded-2xl bg-gray-50" />
      </section>
    );
  }

  const isAuthor = window.location.pathname.startsWith("/author/");

  if (!invoice) {
    return (
      <section className="mx-auto max-w-4xl space-y-4 px-2">
        <h1 className="font-heading text-3xl text-gray-900">Invoice</h1>
        <p className="text-sm text-gray-500">Invoice not found.</p>
        <Link to={isAuthor ? "/author/dashboard" : "/admin/payments/completed"} className="inline-flex text-sm font-medium text-green-700 hover:underline">
          {isAuthor ? "Back to dashboard" : "Back to payments"}
        </Link>
      </section>
    );
  }

  const backUrl = isAuthor ? `/author/submissions/${invoice.submissionId}` : "/admin/payments/completed";

  return (
    <section className="mx-auto max-w-4xl space-y-4 px-2 pb-8">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <h1 className="font-heading text-3xl text-gray-900">Invoice</h1>
          <p className="mt-1 font-mono text-sm text-gray-500">{invoice.id}</p>
        </div>
        <div className="flex gap-2">
          <Link
            to={backUrl}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            Back
          </Link>
          <button
            type="button"
            onClick={printPage}
            className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
          >
            <Download className="h-4 w-4" />
            Download PDF
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm print:shadow-none">
        <div className="flex flex-col gap-6 border-b border-gray-100 pb-6 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-green-700">ScriptHive Invoice</p>
            <h2 className="mt-1 text-2xl font-semibold text-gray-900">{invoice.customerName}</h2>
            <p className="mt-1 text-sm text-gray-500">{invoice.customerEmail}</p>
          </div>
          <div className="rounded-xl bg-gray-50 px-4 py-3 text-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Invoice No.</p>
            <p className="mt-1 font-mono text-lg font-semibold text-blue-700">{invoice.id}</p>
            <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Status</p>
            <p className="mt-1 font-semibold text-green-700">{invoice.status}</p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Submission ID</p>
            <p className="mt-1 font-mono text-sm font-semibold text-gray-900">{invoice.submissionId}</p>
          </div>
          <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Journal / ISSN</p>
            <p className="mt-1 text-sm font-semibold text-gray-900 leading-tight">
              {invoice.submission?.journal?.name || "—"}
              {invoice.submission?.journal?.issn || invoice.submission?.journal?.eIssn ? (
                <span className="mt-0.5 block font-mono text-xs font-normal text-gray-500">
                  {invoice.submission.journal.issn ? `ISSN: ${invoice.submission.journal.issn}` : ""}
                  {invoice.submission.journal.issn && invoice.submission.journal.eIssn ? " · " : ""}
                  {invoice.submission.journal.eIssn ? `e-ISSN: ${invoice.submission.journal.eIssn}` : ""}
                </span>
              ) : null}
            </p>
          </div>
          <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Payment method</p>
            <p className="mt-1 text-sm font-semibold text-gray-900">{invoice.method || "—"}</p>
          </div>
          <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Paid at</p>
            <p className="mt-1 text-sm font-semibold text-gray-900">{formatDate(invoice.paidAt)}</p>
          </div>
        </div>

        <div className="mt-6 overflow-hidden rounded-xl border border-gray-200">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {(items.length > 0 ? items : [{ description: "Article Processing Charge (APC)", amount: invoice.total }]).map((item, idx) => (
                <tr key={`${item.description}-${idx}`} className="border-t border-gray-100">
                  <td className="px-4 py-3 text-gray-800">{item.description}</td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">
                    {invoice.currency === "INR" ? "₹" : "$"}
                    {item.amount.toLocaleString(invoice.currency === "INR" ? "en-IN" : "en-US", {
                      minimumFractionDigits: invoice.currency === "INR" ? 0 : 2,
                      maximumFractionDigits: invoice.currency === "INR" ? 0 : 2
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-6 flex justify-end">
          <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-gray-50 p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Subtotal</span>
              <span className="font-medium text-gray-900">
                {invoice.currency === "INR" ? "₹" : "$"}
                {invoice.subtotal.toLocaleString(invoice.currency === "INR" ? "en-IN" : "en-US", {
                  minimumFractionDigits: invoice.currency === "INR" ? 0 : 2,
                  maximumFractionDigits: invoice.currency === "INR" ? 0 : 2
                })}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between text-sm">
              <span className="text-gray-500">Tax</span>
              <span className="font-medium text-gray-900">
                {invoice.currency === "INR" ? "₹" : "$"}
                {invoice.tax.toLocaleString(invoice.currency === "INR" ? "en-IN" : "en-US", {
                  minimumFractionDigits: invoice.currency === "INR" ? 0 : 2,
                  maximumFractionDigits: invoice.currency === "INR" ? 0 : 2
                })}
              </span>
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-gray-200 pt-3 text-base">
              <span className="font-semibold text-gray-900">Total</span>
              <span className="font-mono text-lg font-bold text-green-700">
                {invoice.currency === "INR" ? "₹" : "$"}
                {invoice.total.toLocaleString(invoice.currency === "INR" ? "en-IN" : "en-US", {
                  minimumFractionDigits: invoice.currency === "INR" ? 0 : 2,
                  maximumFractionDigits: invoice.currency === "INR" ? 0 : 2
                })}
              </span>
            </div>
          </div>
        </div>

        {invoice.notes ? (
          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50/60 p-4 text-sm text-amber-950">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">Reference / Remarks</p>
            <p className="mt-1 whitespace-pre-wrap">{invoice.notes}</p>
          </div>
        ) : null}
      </div>
    </section>
  );
};

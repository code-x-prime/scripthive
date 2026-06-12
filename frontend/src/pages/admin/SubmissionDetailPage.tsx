import { useCallback, useEffect, useState, type ComponentType, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import {
  ArrowLeft,
  Calendar,
  Download,
  ExternalLink,
  FileText,
  Mail,
  MapPin,
  Upload,
  User
} from "lucide-react";
import { apiFetch, apiJson } from "@/services/api";
import { submissionService } from "@/services/submission.service";
import type { Submission } from "@/types";
import { RichTextContent } from "@/components/common/RichTextContent";
import { StatusBadge } from "@/components/common/StatusBadge";
import { submissionAuthorsDisplay, submissionAuthorsList } from "@/utils/submissionAuthors";
import { parseKeywords } from "@/utils/formatKeywords";
import { usePermissions } from "@/hooks/usePermissions";

const STATUS_OPTIONS = ["Pending", "UnderReview", "Revision", "Accepted", "Rejected", "Published"] as const;
const LIST_SEGMENTS = new Set(["new", "under-review", "accepted", "rejected"]);

function pdfFileName(path?: string | null): string | null {
  if (!path) return null;
  const norm = path.replace(/\\/g, "/");
  const seg = norm.split("/").filter(Boolean);
  return seg.length ? seg[seg.length - 1] ?? null : null;
}

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

function backListPath(status: string): string {
  if (status === "UnderReview" || status === "Revision") return "/admin/submissions/under-review";
  if (status === "Accepted") return "/admin/submissions/accepted";
  if (status === "Rejected") return "/admin/submissions/rejected";
  return "/admin/submissions/new";
}

function Card({
  title,
  icon: Icon,
  children,
  className = ""
}: {
  title: string;
  icon?: ComponentType<{ className?: string }>;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5 ${className}`}>
      <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
        {Icon ? <Icon className="h-4 w-4 text-green-600" /> : null}
        {title}
      </h2>
      <div className="mt-3 sm:mt-4">{children}</div>
    </div>
  );
}

export const SubmissionDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const canWrite = hasPermission("submissions:write");
  const canApprove = hasPermission("submissions:approve");
  const canCreateInvoice = hasPermission("invoices:write");

  const [row, setRow] = useState<Submission | null>(null);
  const [loading, setLoading] = useState(true);
  const [remark, setRemark] = useState("");

  const load = useCallback(async () => {
    if (!id || LIST_SEGMENTS.has(id)) return;
    setLoading(true);
    try {
      const data = await submissionService.get(id);
      setRow(data);
      setRemark(data.editorNotes ?? "");
    } catch (e) {
      setRow(null);
      toast.error(e instanceof Error ? e.message : "Could not load submission");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (!id) return;
    if (LIST_SEGMENTS.has(id)) {
      navigate(`/admin/submissions/${id}`, { replace: true });
      return;
    }
    queueMicrotask(() => {
      void load();
    });
  }, [id, load, navigate]);

  const onStatusChange = async (status: string) => {
    if (!row) return;
    try {
      await apiJson(`/submissions/${encodeURIComponent(row.id)}/status`, {
        method: "PUT",
        body: JSON.stringify({ status })
      });
      toast.success("Status updated");
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    }
  };

  const onProductionChange = async (productionStatus: string) => {
    if (!row) return;
    try {
      await apiJson(`/submissions/${encodeURIComponent(row.id)}/production-status`, {
        method: "PUT",
        body: JSON.stringify({ productionStatus })
      });
      toast.success("Production stage updated");
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    }
  };

  const saveRemark = async () => {
    if (!row) return;
    try {
      await apiJson(`/submissions/${encodeURIComponent(row.id)}/remark`, {
        method: "PUT",
        body: JSON.stringify({ remark })
      });
      toast.success("Remark saved");
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    }
  };

  const downloadManuscript = async () => {
    if (!row) return;
    const name = pdfFileName(row.manuscriptPath);
    try {
      const res = await apiFetch(`/submissions/${encodeURIComponent(row.id)}/manuscript`);
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(body.message ?? "Download failed");
      }
      const ct = res.headers.get("content-type") ?? "";
      if (ct.includes("application/json")) {
        const data = await res.json() as { url: string; filename?: string };
        const a = document.createElement("a"); a.href = data.url; a.download = data.filename ?? name ?? `manuscript-${row.id}`; a.target = "_blank"; a.click();
      } else {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = name ?? `manuscript-${row.id}.pdf`; a.click();
        URL.revokeObjectURL(url);
      }
      toast.success("Download started");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Download failed");
    }
  };

  const uploadManuscriptFile = async (file: File) => {
    if (!row) return;
    const fd = new FormData();
    fd.append("manuscript", file);
    try {
      const res = await apiFetch(`/submissions/${encodeURIComponent(row.id)}/upload-manuscript`, { method: "POST", body: fd });
      if (!res.ok) { const b = await res.json().catch(() => ({})) as { message?: string }; throw new Error(b.message ?? "Upload failed"); }
      toast.success("Manuscript uploaded");
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    }
  };

  const onCreateInvoice = async () => {
    if (!row) return;
    try {
      await apiJson(`/invoices/from-submission/${encodeURIComponent(row.id)}`, { method: "POST" });
      toast.success("Invoice created");
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create invoice");
    }
  };

  if (!id) {
    return (
      <section className="px-1">
        <p className="text-sm text-gray-500">Missing submission ID.</p>
        <Link to="/admin/submissions/new" className="mt-4 inline-block text-sm text-green-700 hover:underline">
          Back to submissions
        </Link>
      </section>
    );
  }

  if (loading) {
    return (
      <section className="mx-auto max-w-6xl animate-pulse space-y-4 px-1">
        <div className="h-6 w-32 rounded bg-gray-100" />
        <div className="h-10 w-full max-w-2xl rounded bg-gray-100" />
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="h-48 rounded-xl bg-gray-50 lg:col-span-2" />
          <div className="h-64 rounded-xl bg-gray-50" />
        </div>
      </section>
    );
  }

  if (!row) {
    return (
      <section className="mx-auto max-w-6xl space-y-4 px-1">
        <Link
          to="/admin/submissions/new"
          className="inline-flex items-center gap-2 text-sm font-medium text-green-700 hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to submissions
        </Link>
        <div className="rounded-xl border border-dashed border-gray-200 bg-white py-16 text-center">
          <p className="font-mono text-lg text-gray-700">{id}</p>
          <p className="mt-2 text-sm text-gray-500">Submission not found or you do not have access.</p>
        </div>
      </section>
    );
  }

  const manuscript = pdfFileName(row.manuscriptPath);
  const invoice = row.invoices?.[0];
  const authors = submissionAuthorsList(row);
  const keywords = parseKeywords(row.keywords);
  const listBack = backListPath(row.status);

  return (
    <section className="mx-auto max-w-6xl space-y-4 px-1 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 border-b border-gray-100 pb-4 sm:gap-4 sm:pb-6">
        <Link
          to={listBack}
          className="inline-flex w-fit items-center gap-2 text-sm font-medium text-green-700 hover:underline"
        >
          <ArrowLeft className="h-4 w-4 shrink-0" />
          Back to list
        </Link>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <span className="inline-block rounded-full border border-green-200 bg-green-50 px-2.5 py-0.5 font-mono text-xs font-semibold text-green-800">
              {row.journal?.id ?? row.journalId}
            </span>
            <h1 className="mt-2 break-words font-heading text-xl font-semibold leading-snug text-gray-900 sm:text-2xl lg:text-3xl">
              {row.title}
            </h1>
            <p className="mt-1 font-mono text-xs text-gray-500 sm:text-sm">{row.id}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
            <StatusBadge status={row.status} />
            {row.productionStatus ? <StatusBadge status={row.productionStatus} /> : null}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-6">
        {/* Main column */}
        <div className="order-2 space-y-4 lg:order-1 lg:col-span-2 lg:space-y-6">
          <Card title="Authors & contact" icon={User}>
            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              <div className="sm:col-span-2">
                <dt className="text-xs font-medium text-gray-500">Authors</dt>
                <dd className="mt-1 font-medium text-gray-900">{submissionAuthorsDisplay(row)}</dd>
                {authors.length > 1 ? (
                  <ul className="mt-2 space-y-1 border-l-2 border-green-100 pl-3 text-gray-700">
                    {authors.map((a) => (
                      <li key={a} className="text-sm">
                        {a}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
              <div>
                <dt className="flex items-center gap-1 text-xs font-medium text-gray-500">
                  <Mail className="h-3.5 w-3.5" /> Email
                </dt>
                <dd className="mt-1 break-all text-gray-900">{row.authorEmail}</dd>
              </div>
              <div>
                <dt className="flex items-center gap-1 text-xs font-medium text-gray-500">
                  <MapPin className="h-3.5 w-3.5" /> Country / phone
                </dt>
                <dd className="mt-1 text-gray-900">
                  {[row.country, row.authorPhone].filter(Boolean).join(" · ") || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-gray-500">Journal</dt>
                <dd className="mt-1 text-gray-900">{row.journal?.name ?? row.journalId}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-gray-500">Article type</dt>
                <dd className="mt-1 text-gray-900">{row.articleType ?? "—"}</dd>
              </div>
              {row.affiliations ? (
                <div className="sm:col-span-2">
                  <dt className="text-xs font-medium text-gray-500">Affiliations</dt>
                  <dd className="mt-1">
                    <RichTextContent html={row.affiliations} />
                  </dd>
                </div>
              ) : null}
            </dl>
          </Card>

          <Card title="Abstract" icon={FileText}>
            <RichTextContent html={row.abstract} />
            {keywords.length > 0 ? (
              <div className="mt-5 border-t border-gray-100 pt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Keywords</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {keywords.map((kw) => (
                    <span
                      key={kw}
                      className="rounded-full border border-green-100 bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-900"
                    >
                      {kw}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <p className="mt-4 border-t border-gray-100 pt-4 text-sm text-gray-500">{row.keywords || "—"}</p>
            )}
          </Card>

          {row.reviewNotes ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 sm:p-5">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-amber-900">Review notes</h2>
              <div className="mt-3">
                <RichTextContent html={row.reviewNotes} className="text-amber-950" />
              </div>
            </div>
          ) : null}
        </div>

        {/* Sidebar — first on mobile for quick actions */}
        <div className="order-1 space-y-4 lg:order-2 lg:space-y-5">
          {canApprove ? (
            <Card title="Workflow" className="border-green-100 bg-green-50/30">
              <label className="flex flex-col gap-1.5 text-xs font-medium text-gray-600">
                Status
                <select
                  className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm"
                  value={row.status}
                  onChange={(e) => void onStatusChange(e.target.value)}
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
              <label className="mt-3 flex flex-col gap-1.5 text-xs font-medium text-gray-600">
                Production stage
                <select
                  className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm"
                  value={row.productionStatus ?? ""}
                  onChange={(e) => void onProductionChange(e.target.value)}
                >
                  <option value="">Not started</option>
                  <option value="ReadyForPreparation">Ready for Preparation</option>
                  <option value="ReadyForUpload">Ready for Upload</option>
                  <option value="ReadyToPublished">Ready to Published</option>
                </select>
              </label>
            </Card>
          ) : null}

          <Card title="Timeline" icon={Calendar}>
            <dl className="space-y-3 text-sm">
              <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-4">
                <dt className="text-gray-500">Submitted</dt>
                <dd className="font-medium text-gray-900 sm:text-right">{formatDate(row.createdAt)}</dd>
              </div>
              <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-4">
                <dt className="text-gray-500">Last updated</dt>
                <dd className="font-medium text-gray-900 sm:text-right">{formatDate(row.updatedAt)}</dd>
              </div>
              {row.paidAt ? (
                <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-4">
                  <dt className="text-gray-500">Paid</dt>
                  <dd className="font-medium text-gray-900 sm:text-right">{formatDate(row.paidAt)}</dd>
                </div>
              ) : null}
              {row.pubDate ? (
                <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-4">
                  <dt className="text-gray-500">Published</dt>
                  <dd className="font-medium text-gray-900 sm:text-right">{formatDate(row.pubDate)}</dd>
                </div>
              ) : null}
            </dl>
          </Card>

          <Card title="Files">
            {manuscript ? (
              <button
                type="button"
                onClick={() => void downloadManuscript()}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2.5 text-sm font-medium text-green-900 hover:bg-green-100"
              >
                <Download className="h-4 w-4 shrink-0" />
                <span className="truncate">{manuscript}</span>
              </button>
            ) : (
              <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50/80 px-3 py-6 text-center">
                <FileText className="mx-auto h-8 w-8 text-gray-300" />
                <p className="mt-2 text-sm text-gray-500">No manuscript uploaded</p>
              </div>
            )}
            <label className="mt-2 inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50">
              <Upload className="h-4 w-4" />
              {manuscript ? "Replace manuscript" : "Upload manuscript"}
              <input type="file" accept=".pdf,.doc,.docx" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadManuscriptFile(f); e.target.value = ""; }} />
            </label>
            {row.pdfPublicPath ? (
              <a
                href={row.pdfPublicPath.startsWith("/") ? row.pdfPublicPath : `/${row.pdfPublicPath}`}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                <ExternalLink className="h-4 w-4" />
                Public PDF
              </a>
            ) : null}
          </Card>

          <Card title="Payment">
            {/* Refund alert — advance paid but submission rejected */}
            {row.status === "Rejected" && row.advancePaid && invoice ? (
              <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-3">
                <p className="text-xs font-bold uppercase tracking-wide text-red-700 mb-1">⚠️ Refund Required</p>
                <p className="text-sm text-red-800 font-semibold">
                  Author paid {invoice.currency === "INR" ? "₹" : "$"}{invoice.total} in advance.
                </p>
                <p className="text-xs text-red-600 mt-1">Submission rejected — please process refund to author.</p>
                <p className="text-xs text-gray-500 mt-1">Author: {row.authorEmail}</p>
              </div>
            ) : null}
            {invoice ? (
              <div className="space-y-2 text-sm">
                <p>
                  <span className="text-gray-500">Invoice </span>
                  <span className="font-mono font-medium text-green-700">{invoice.id}</span>
                </p>
                <p>
                  <span className="text-gray-500">Amount </span>
                  <span className="font-semibold text-gray-900">
                    {invoice.currency === "INR" ? "₹" : "$"}
                    {invoice.total}
                  </span>
                </p>
                {row.advancePaid ? (
                  <span className="inline-block rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-700">Advance Paid</span>
                ) : null}
                <StatusBadge status={invoice.status} />
                <Link to="/admin/payments/pending" className="inline-block text-sm font-medium text-green-700 hover:underline">
                  Open payments →
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50/80 px-3 py-5 text-center">
                  <p className="text-sm text-gray-500">No invoice yet</p>
                  {row.status !== "Accepted" ? (
                    <p className="mt-1 text-xs text-gray-400">Accept the submission to create an APC invoice</p>
                  ) : null}
                </div>
                {canCreateInvoice && row.status === "Accepted" ? (
                  <button
                    type="button"
                    onClick={() => void onCreateInvoice()}
                    className="w-full rounded-lg bg-green-600 py-2.5 text-sm font-medium text-white hover:bg-green-700"
                  >
                    Create invoice
                  </button>
                ) : null}
              </div>
            )}
          </Card>

          {row.doiRecord?.doi ? (
            <Card title="DOI">
              <p className="break-all font-mono text-sm text-green-800">{row.doiRecord.doi}</p>
            </Card>
          ) : null}

          {canWrite ? (
            <Card title="Admin remark">
              <textarea
                value={remark}
                onChange={(e) => setRemark(e.target.value)}
                rows={4}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="Internal note for this submission"
              />
              <button
                type="button"
                onClick={() => void saveRemark()}
                className="mt-3 w-full rounded-lg bg-green-600 py-2.5 text-sm font-medium text-white hover:bg-green-700"
              >
                Save remark
              </button>
            </Card>
          ) : null}
        </div>
      </div>
    </section>
  );
};

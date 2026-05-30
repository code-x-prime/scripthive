import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import toast from "react-hot-toast";
import { Download, Eye, Loader2, Plus, Star, Trash2, Upload, X } from "lucide-react";
import { apiFetch, apiJson } from "@/services/api";
import type { Journal, Submission } from "@/types";
import { StatusBadge } from "@/components/common/StatusBadge";
import { submissionAuthorsDisplay } from "@/utils/submissionAuthors";
import { useDebounce } from "@/hooks/useDebounce";
import { Button } from "@/components/ui/button";
import { ExportCsvDialog } from "@/components/export/ExportCsvDialog";
import { SUBMISSION_EXPORT_COLUMNS } from "@/utils/submissionExportColumns";

const JOURNALS = [
  { id: "", label: "All journals" },
  { id: "SGJVSR", label: "SGJVSR" },
  { id: "SGMRJ", label: "SGMRJ" },
  { id: "SGJPLS", label: "SGJPLS" },
  { id: "SGJETR", label: "SGJETR" },
  { id: "SGJSSH", label: "SGJSSH" },
  { id: "SGJASH", label: "SGJASH" }
];

const PRODUCTION_FILTERS = [
  { id: "", label: "All production" },
  { id: "ReadyForPreparation", label: "Ready for Preparation" },
  { id: "ReadyForUpload", label: "Ready for Upload" },
  { id: "ReadyToPublished", label: "Ready to Published" }
];

const STATUS_OPTIONS = ["Pending", "UnderReview", "Revision", "Accepted", "Rejected", "Published"] as const;

function pdfFileName(path?: string | null): string | null {
  if (!path) return null;
  const norm = path.replace(/\\/g, "/");
  const seg = norm.split("/").filter(Boolean);
  return seg.length ? seg[seg.length - 1] ?? null : null;
}

function routeStatusFilter(pathname: string): string | undefined {
  if (pathname.includes("/submissions/new")) return "Pending";
  if (pathname.includes("/submissions/under-review")) return "UnderReview";
  if (pathname.includes("/submissions/accepted")) return "Accepted";
  if (pathname.includes("/submissions/rejected")) return "Rejected";
  return undefined;
}

function pageTitle(pathname: string): string {
  if (pathname.includes("/under-review")) return "Under review";
  if (pathname.includes("/accepted")) return "Accepted";
  if (pathname.includes("/rejected")) return "Rejected";
  return "New submissions";
}

/* ─── Admin Create Submission Modal ─────────────────────────────────────── */

interface AdminCreateModalProps {
  onClose: () => void;
  onCreated: () => void;
}

const EMPTY_FORM = {
  journalId: "", title: "", authorName: "", authorEmail: "",
  authorPhone: "", coAuthors: "", affiliations: "", abstract: "",
  keywords: "", articleType: "Research", country: "",
};

interface AddonService { id: string; label: string; price: number; currency: string; enabled: boolean }

const AdminCreateModal = ({ onClose, onCreated }: AdminCreateModalProps) => {
  const [journals, setJournals]     = useState<Journal[]>([]);
  const [addonServices, setAddonServices] = useState<AddonService[]>([]);
  const [selectedAddons, setSelectedAddons] = useState<string[]>([]);
  const [form, setForm]             = useState(EMPTY_FORM);
  const [file, setFile]             = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState("");
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void apiJson<Journal[]>("/journals").then(setJournals).catch(() => {});
    void apiJson<{ addon_services_parsed?: AddonService[] }>("/settings")
      .then((s) => { if (s.addon_services_parsed) setAddonServices(s.addon_services_parsed.filter((a) => a.enabled)); })
      .catch(() => {});
  }, []);

  const toggleAddon = (id: string) =>
    setSelectedAddons((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  const set = (k: keyof typeof EMPTY_FORM) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const onPickFile = (f: File | null) => {
    if (f && (f.type !== "application/pdf" || !f.name.toLowerCase().endsWith(".pdf"))) {
      toast.error("PDF only"); return;
    }
    if (f && f.size > 10 * 1024 * 1024) {
      toast.error("File too large. Maximum 10 MB."); return;
    }
    setFile(f);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!form.journalId || !form.title.trim() || !form.authorName.trim() || !form.authorEmail.trim() || !form.abstract.trim() || !form.keywords.trim()) {
      setError("Fill in all required fields."); return;
    }
    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => { if (v.trim()) fd.append(k, v.trim()); });
    if (file) fd.append("manuscript", file);
    if (selectedAddons.length > 0) {
      const picked = addonServices.filter((a) => selectedAddons.includes(a.id));
      fd.append("addons", JSON.stringify(picked));
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/submissions", { method: "POST", body: fd });
      const body = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) throw new Error(body.message ?? "Create failed");
      toast.success("Submission created");
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-10"
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div className="w-full max-w-2xl rounded-2xl border border-gray-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 className="font-heading text-lg font-semibold text-gray-900">Add submission</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:text-gray-700"><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5 px-6 py-5">
          {error && <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>}

          <section className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Manuscript</h3>
            <label className="block text-sm font-medium text-gray-700">
              Journal *
              <select value={form.journalId} onChange={set("journalId")} required
                className="mt-1 h-10 w-full rounded-lg border border-gray-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                <option value="">Select journal</option>
                {journals.map((j) => <option key={j.id} value={j.id}>{j.id} — {j.name}</option>)}
              </select>
            </label>
            <label className="block text-sm font-medium text-gray-700">
              Paper title *
              <input value={form.title} onChange={set("title")} required
                className="mt-1 h-10 w-full rounded-lg border border-gray-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-medium text-gray-700">
                Article type
                <select value={form.articleType} onChange={set("articleType")}
                  className="mt-1 h-10 w-full rounded-lg border border-gray-200 px-3 text-sm">
                  <option value="Research">Research</option>
                  <option value="Review">Review</option>
                  <option value="Case Study">Case Study</option>
                </select>
              </label>
              <label className="block text-sm font-medium text-gray-700">
                Country
                <input value={form.country} onChange={set("country")} placeholder="e.g. India"
                  className="mt-1 h-10 w-full rounded-lg border border-gray-200 px-3 text-sm" />
              </label>
            </div>
            <label className="block text-sm font-medium text-gray-700">
              Abstract *
              <textarea value={form.abstract} onChange={set("abstract")} rows={4} required
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            </label>
            <label className="block text-sm font-medium text-gray-700">
              Keywords *
              <input value={form.keywords} onChange={set("keywords")} placeholder="keyword1, keyword2"
                required className="mt-1 h-10 w-full rounded-lg border border-gray-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            </label>
            <div>
              <p className="text-sm font-medium text-gray-700">Manuscript PDF <span className="text-gray-400">(optional)</span></p>
              <label className="mt-1 flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50/50 px-4 py-4 hover:border-green-300 hover:bg-green-50/30">
                <Upload className="h-5 w-5 shrink-0 text-gray-400" />
                <span className="text-sm text-gray-500">{file ? file.name : "Click to attach PDF"}</span>
                <input type="file" accept="application/pdf,.pdf" className="hidden"
                  onChange={(e) => onPickFile(e.target.files?.[0] ?? null)} />
              </label>
              {file && (
                <button type="button" className="mt-1 text-xs text-red-500 hover:underline"
                  onClick={() => setFile(null)}>Remove file</button>
              )}
            </div>
          </section>

          <section className="space-y-4 border-t border-gray-100 pt-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Author details</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-medium text-gray-700">
                Author name *
                <input value={form.authorName} onChange={set("authorName")} required
                  className="mt-1 h-10 w-full rounded-lg border border-gray-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              </label>
              <label className="block text-sm font-medium text-gray-700">
                Author email *
                <input type="email" value={form.authorEmail} onChange={set("authorEmail")} required
                  className="mt-1 h-10 w-full rounded-lg border border-gray-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              </label>
              <label className="block text-sm font-medium text-gray-700">
                Phone
                <input value={form.authorPhone} onChange={set("authorPhone")}
                  className="mt-1 h-10 w-full rounded-lg border border-gray-200 px-3 text-sm" />
              </label>
              <label className="block text-sm font-medium text-gray-700">
                Co-authors
                <input value={form.coAuthors} onChange={set("coAuthors")} placeholder="Name1; Name2"
                  className="mt-1 h-10 w-full rounded-lg border border-gray-200 px-3 text-sm" />
              </label>
            </div>
            <label className="block text-sm font-medium text-gray-700">
              Affiliation
              <textarea value={form.affiliations} onChange={set("affiliations")} rows={2}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
            </label>
          </section>

          {addonServices.length > 0 && (
            <section className="space-y-3 border-t border-gray-100 pt-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Add-on services</h3>
              <p className="text-xs text-gray-400">Select optional paid services for this submission.</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {addonServices.map((addon) => {
                  const checked = selectedAddons.includes(addon.id);
                  return (
                    <button
                      key={addon.id}
                      type="button"
                      onClick={() => toggleAddon(addon.id)}
                      className={`flex items-center justify-between rounded-lg border px-3 py-2.5 text-left text-sm transition-colors ${
                        checked
                          ? "border-green-400 bg-green-50 text-green-900"
                          : "border-gray-200 bg-white text-gray-700 hover:border-green-300 hover:bg-green-50/40"
                      }`}
                    >
                      <span className="font-medium">{addon.label}</span>
                      <span className={`ml-2 shrink-0 font-mono text-xs ${checked ? "text-green-700" : "text-gray-400"}`}>
                        ₹{addon.price.toLocaleString("en-IN")}
                      </span>
                    </button>
                  );
                })}
              </div>
              {selectedAddons.length > 0 && (
                <p className="text-xs font-medium text-green-700">
                  Total add-ons: ₹{addonServices
                    .filter((a) => selectedAddons.includes(a.id))
                    .reduce((s, a) => s + a.price, 0)
                    .toLocaleString("en-IN")}
                </p>
              )}
            </section>
          )}

          <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>Cancel</Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving…</> : "Create submission"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────────────────── */

export const SubmissionsPage = () => {
  const { pathname } = useLocation();
  const fixedStatus = routeStatusFilter(pathname);
  const [rows, setRows] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [journalId, setJournalId] = useState("");
  const [productionStatus, setProductionStatus] = useState("");
  const [exportOpen, setExportOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (fixedStatus) params.set("status", fixedStatus);
      if (journalId) params.set("journalId", journalId);
      if (productionStatus) params.set("productionStatus", productionStatus);
      const q = params.toString();
      const data = await apiJson<Submission[]>(`/submissions${q ? `?${q}` : ""}`);
      setRows(data);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong. Please try again.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [fixedStatus, journalId, productionStatus]);

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  const display = useMemo(() => {
    const filtered = !debouncedSearch.trim()
      ? rows
      : (() => {
          const q = debouncedSearch.trim().toLowerCase();
          return rows.filter(
            (r) =>
              r.id.toLowerCase().includes(q) ||
              r.title.toLowerCase().includes(q) ||
              r.authorName.toLowerCase().includes(q) ||
              (r.authorEmail?.toLowerCase().includes(q) ?? false) ||
              submissionAuthorsDisplay(r).toLowerCase().includes(q)
          );
        })();
    return [...filtered].sort((a, b) => (b.priority ? 1 : 0) - (a.priority ? 1 : 0));
  }, [rows, debouncedSearch]);

  const exportSlug = useMemo(() => {
    if (pathname.includes("/under-review")) return "under-review";
    if (pathname.includes("/accepted")) return "accepted";
    if (pathname.includes("/rejected")) return "rejected";
    if (pathname.includes("/new")) return "new";
    return "all";
  }, [pathname]);

  const onStatusChange = async (id: string, status: string) => {
    try {
      await apiJson(`/submissions/${encodeURIComponent(id)}/status`, {
        method: "PUT",
        body: JSON.stringify({ status })
      });
      toast.success("Status updated");
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    }
  };

  const onProductionChange = async (id: string, productionStatusValue: string) => {
    try {
      await apiJson(`/submissions/${encodeURIComponent(id)}/production-status`, {
        method: "PUT",
        body: JSON.stringify({ productionStatus: productionStatusValue })
      });
      toast.success("Production stage updated");
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    }
  };

  const onRemarkBlur = async (id: string, remark: string) => {
    try {
      await apiJson(`/submissions/${encodeURIComponent(id)}/remark`, {
        method: "PUT",
        body: JSON.stringify({ remark })
      });
      toast.success("Remark saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    }
  };

  const downloadManuscript = async (id: string, suggestedName: string | null) => {
    try {
      const res = await apiFetch(`/submissions/${encodeURIComponent(id)}/manuscript`);
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(body.message ?? "Download failed");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = suggestedName ?? `manuscript-${id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Download started");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Download failed");
    }
  };

  const onDelete = async (id: string) => {
    if (!window.confirm("Delete this submission permanently?")) return;
    try {
      const res = await apiFetch(`/submissions/${encodeURIComponent(id)}`, { method: "DELETE" });
      const body = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) throw new Error(body.message ?? "Delete failed");
      toast.success("Deleted");
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  };

  const onPriorityToggle = async (id: string, current: boolean) => {
    try {
      await apiJson(`/submissions/${encodeURIComponent(id)}/priority`, {
        method: "PUT",
        body: JSON.stringify({ priority: !current })
      });
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, priority: !current } : r)));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    }
  };

  const onBulkStatus = async (status: "Accepted" | "Rejected") => {
    if (selected.size === 0) return;
    const label = status === "Accepted" ? "accept" : "reject";
    if (!window.confirm(`${label.charAt(0).toUpperCase() + label.slice(1)} ${selected.size} submission(s)?`)) return;
    setBulkLoading(true);
    try {
      await apiJson("/submissions/bulk-status", {
        method: "PUT",
        body: JSON.stringify({ ids: Array.from(selected), status })
      });
      toast.success(`${selected.size} submission(s) ${label}ed`);
      setSelected(new Set());
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Bulk update failed");
    } finally {
      setBulkLoading(false);
    }
  };

  const toggleSelect = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const allSelected = display.length > 0 && display.every((r) => selected.has(r.id));
  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(display.map((r) => r.id)));

  const isNewPage = pathname.includes("/submissions/new");
  const showProduction = false; // production column only in production pipeline pages
  const isUnderReview = pathname.includes("/under-review");
  const statusOptions = (isUnderReview || isNewPage)
    ? (["Pending", "UnderReview", "Accepted", "Rejected"] as const)
    : STATUS_OPTIONS;
  const showPriority = true;

  return (
    <section className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl text-gray-900">{pageTitle(pathname)}</h1>
          <p className="mt-1 text-sm text-gray-500">Filter, update status, and export the current list.</p>
        </div>
        {isNewPage && (
          <Button type="button" onClick={() => setCreateOpen(true)} className="shrink-0">
            <Plus className="mr-1 h-4 w-4" /> Add submission
          </Button>
        )}
      </div>

      {createOpen && (
        <AdminCreateModal onClose={() => setCreateOpen(false)} onCreated={() => void load()} />
      )}

      <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm lg:flex-row lg:flex-wrap lg:items-end">
        <label className="flex min-w-[200px] flex-1 flex-col gap-1 text-xs font-medium text-gray-600">
          Search (ID / title / author)
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 rounded-lg border border-gray-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            placeholder="Type to search…"
          />
        </label>
        <label className="flex min-w-[160px] flex-col gap-1 text-xs font-medium text-gray-600">
          Journal
          <select
            value={journalId}
            onChange={(e) => setJournalId(e.target.value)}
            className="h-10 rounded-lg border border-gray-200 px-3 text-sm"
          >
            {JOURNALS.map((j) => (
              <option key={j.id || "all"} value={j.id}>
                {j.label}
              </option>
            ))}
          </select>
        </label>
        {!isUnderReview && !isNewPage && (
          <label className="flex min-w-[200px] flex-col gap-1 text-xs font-medium text-gray-600">
            Production
            <select
              value={productionStatus}
              onChange={(e) => setProductionStatus(e.target.value)}
              className="h-10 rounded-lg border border-gray-200 px-3 text-sm"
            >
              {PRODUCTION_FILTERS.map((p) => (
                <option key={p.id || "all"} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
        )}
        <Button type="button" variant="outline" onClick={() => setExportOpen(true)} disabled={display.length === 0}>
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </div>

      <ExportCsvDialog
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        title="Export submissions"
        filename={`submissions-${exportSlug}.csv`}
        rows={display}
        columns={SUBMISSION_EXPORT_COLUMNS}
        defaultPermission="submissions:read"
      />

      {showProduction && selected.size > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-2 shadow-sm">
          <span className="text-sm text-gray-600">{selected.size} selected</span>
          <Button
            type="button"
            variant="outline"
            disabled={bulkLoading}
            className="border-green-300 text-green-700 hover:bg-green-50"
            onClick={() => void onBulkStatus("Accepted")}
          >
            Bulk Accept
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={bulkLoading}
            className="border-red-300 text-red-700 hover:bg-red-50"
            onClick={() => void onBulkStatus("Rejected")}
          >
            Bulk Reject
          </Button>
          <button
            type="button"
            className="ml-auto text-xs text-gray-400 hover:text-gray-600"
            onClick={() => setSelected(new Set())}
          >
            Clear
          </button>
        </div>
      )}

      {loading ? (
        <div className="animate-pulse space-y-3 rounded-xl border border-gray-200 bg-white p-4">
          <div className="h-8 w-full rounded bg-gray-100" />
          <div className="h-10 w-full rounded bg-gray-50" />
          <div className="h-10 w-full rounded bg-gray-50" />
        </div>
      ) : display.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-200 bg-white py-12 text-center text-sm text-gray-500">
          No results found.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="min-w-[960px] w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
                {showPriority && (
                  <th className="px-3 py-3">
                    <input type="checkbox" checked={allSelected} onChange={toggleAll} className="h-4 w-4 cursor-pointer accent-green-600" />
                  </th>
                )}
                {showPriority && <th className="px-3 py-3"></th>}
                <th className="px-3 py-3">ID</th>
                <th className="px-3 py-3">Paper title</th>
                <th className="px-3 py-3">Authors</th>
                <th className="px-3 py-3">Journal</th>
                <th className="px-3 py-3">Date</th>
                <th className="px-3 py-3">Status</th>
                {showProduction ? <th className="px-3 py-3">Production</th> : null}
                <th className="px-3 py-3">Status change</th>
                <th className="px-3 py-3">Remark</th>
                <th className="px-3 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {display.map((r) => (
                <tr key={r.id} className={`border-b border-gray-100 hover:bg-gray-50/80 ${r.priority ? "bg-amber-50/40" : ""}`}>
                  {showPriority && (
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={selected.has(r.id)}
                        onChange={() => toggleSelect(r.id)}
                        className="h-4 w-4 cursor-pointer accent-green-600"
                      />
                    </td>
                  )}
                  {showPriority && (
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        title={r.priority ? "High priority — click to unmark" : "Mark as high priority"}
                        onClick={() => void onPriorityToggle(r.id, r.priority ?? false)}
                        className="flex items-center justify-center"
                      >
                        <Star
                          className={`h-4 w-4 transition-colors ${r.priority ? "fill-amber-400 text-amber-400" : "text-gray-300 hover:text-amber-300"}`}
                        />
                      </button>
                    </td>
                  )}
                  <td className="whitespace-nowrap px-3 py-2 font-mono text-green-700">
                    <Link to={`/admin/submissions/${r.id}`} className="hover:underline">
                      {r.id}
                    </Link>
                  </td>
                  <td className="max-w-[220px] px-3 py-2">
                    <p className="font-medium text-gray-900">{r.title}</p>
                    {pdfFileName(r.manuscriptPath) ? (
                      <button
                        type="button"
                        className="mt-0.5 block w-full text-left text-xs text-green-700 hover:underline"
                        onClick={() => void downloadManuscript(r.id, pdfFileName(r.manuscriptPath))}
                      >
                        <span aria-hidden>📎 </span>
                        <span className="font-mono">{pdfFileName(r.manuscriptPath)}</span>
                      </button>
                    ) : null}
                  </td>
                  <td className="max-w-[180px] px-3 py-2 text-gray-800">{submissionAuthorsDisplay(r)}</td>
                  <td className="px-3 py-2">
                    <span className="rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-xs font-semibold text-green-700">
                      {r.journal?.id ?? r.journalId}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-gray-600">
                    {new Date(r.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge status={r.status} />
                  </td>
                  {showProduction ? (
                    <td className="px-3 py-2">
                      {r.productionStatus ? <StatusBadge status={r.productionStatus} /> : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                      <select
                        className="mt-1 block w-full rounded border border-gray-200 px-2 py-1 text-xs"
                        value={r.productionStatus ?? ""}
                        onChange={(e) => void onProductionChange(r.id, e.target.value)}
                      >
                        <option value="">—</option>
                        <option value="ReadyForPreparation">Ready for Preparation</option>
                        <option value="ReadyForUpload">Ready for Upload</option>
                        <option value="ReadyToPublished">Ready to Published</option>
                      </select>
                    </td>
                  ) : null}
                  <td className="px-3 py-2">
                    <select
                      className="rounded border border-gray-200 px-2 py-1 text-xs"
                      value={r.status}
                      onChange={(e) => void onStatusChange(r.id, e.target.value)}
                    >
                      {statusOptions.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="max-w-[160px] px-3 py-2">
                    <input
                      key={r.updatedAt}
                      defaultValue={r.editorNotes ?? ""}
                      className="w-full rounded border border-gray-200 px-2 py-1 text-xs"
                      placeholder="Admin remark"
                      onBlur={(e) => void onRemarkBlur(r.id, e.target.value)}
                    />
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right">
                    <div className="flex justify-end gap-2">
                      <Link
                        to={`/admin/submissions/${r.id}`}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50"
                        title="View"
                      >
                        <Eye className="h-4 w-4" />
                      </Link>
                      {pathname.includes("/under-review") ? (
                        <button
                          type="button"
                          title="Delete"
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-200 text-red-700 hover:bg-red-50"
                          onClick={() => void onDelete(r.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};

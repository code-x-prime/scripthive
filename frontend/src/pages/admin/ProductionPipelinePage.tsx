import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { Check, Download, Eye, FileText, Star, X, BookOpen } from "lucide-react";
import { apiFetch, apiJson } from "@/services/api";
import type { Submission } from "@/types";
import { submissionAuthorsDisplay } from "@/utils/submissionAuthors";
import { useDebounce } from "@/hooks/useDebounce";
import { Button } from "@/components/ui/button";
import { ExportCsvDialog } from "@/components/export/ExportCsvDialog";
import { SUBMISSION_EXPORT_COLUMNS } from "@/utils/submissionExportColumns";

function pdfName(path?: string | null): string | null {
  if (!path) return null;
  const n = path.replace(/\\/g, "/").split("/").filter(Boolean);
  return n.length ? n[n.length - 1] ?? null : null;
}

const STAGES = [
  { key: "ReadyForPreparation", label: "Ready for preparation", path: "preparation" },
  { key: "ReadyForUpload",      label: "Ready for upload",      path: "upload"       },
  { key: "ReadyToPublished",    label: "Ready to published",    path: "ready-published" }
] as const;

export const ProductionPipelinePage = () => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const stage = useMemo(() => {
    if (pathname.includes("ready-published")) return STAGES[2];
    if (pathname.includes("upload"))          return STAGES[1];
    return STAGES[0];
  }, [pathname]);

  const isPreparation    = stage.key === "ReadyForPreparation";
  const isUpload         = stage.key === "ReadyForUpload";


  const [rows, setRows]       = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState("");
  const debouncedSearch       = useDebounce(search, 300);
  const [exportOpen, setExportOpen]       = useState(false);
  const [dialogRow, setDialogRow]         = useState<Submission | null>(null);
  const [downloading, setDownloading]     = useState<"sample" | "author" | null>(null);
  const [uploadRow, setUploadRow]         = useState<Submission | null>(null);
  const [uploading, setUploading]         = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiJson<Submission[]>(`/production/${stage.path}`);
      setRows(data);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load production queue");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [stage.path]);

  useEffect(() => {
    queueMicrotask(() => { void load(); });
  }, [load]);

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

  const downloadFile = async (endpoint: string, fallbackName: string, kind: "sample" | "author" | "production") => {
    setDownloading(kind === "production" ? "author" : kind);
    try {
      const res = await apiFetch(endpoint);
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(body.message ?? "Download failed");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fallbackName;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Download started");
      // author manuscript download → auto-moved to ReadyForUpload, reload
      if (kind === "author") {
        setDialogRow(null);
        void load();
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Download failed");
    } finally {
      setDownloading(null);
    }
  };

  const handleProductionUpload = async (submissionId: string, file: File) => {
    setUploading(true);
    try {
      const fd = new window.FormData();
      fd.append("file", file);
      const res = await apiFetch(`/submissions/${encodeURIComponent(submissionId)}/upload-production`, {
        method: "POST",
        body: fd
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(err.message ?? "Upload failed");
      }
      toast.success("Uploaded — moved to Ready to Publish");
      setUploadRow(null);
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const changeStage = async (id: string, newStage: string) => {
    try {
      await apiJson(`/submissions/${encodeURIComponent(id)}/production-status`, {
        method: "PUT",
        body: JSON.stringify({ productionStatus: newStage })
      });
      toast.success(`Moved to ${STAGES.find(s => s.key === newStage)?.label ?? newStage}`);
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    }
  };

  const display = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    const filtered = !q
      ? rows
      : rows.filter(
          (r) =>
            r.id.toLowerCase().includes(q) ||
            r.title.toLowerCase().includes(q) ||
            submissionAuthorsDisplay(r).toLowerCase().includes(q)
        );
    return [...filtered].sort((a, b) => (b.priority ? 1 : 0) - (a.priority ? 1 : 0));
  }, [rows, debouncedSearch]);

  // Date column: preparation=paidAt, upload=updatedAt(=when moved to prep), ready-published=updatedAt(=when moved to upload)
  const dateLabel = isPreparation ? "Payment date" : isUpload ? "Preparation date" : "Upload date";
  const dateFor = (r: Submission): string => {
    if (isPreparation) {
      return r.paidAt ? new Date(r.paidAt).toLocaleDateString() : "—";
    }
    return new Date(r.updatedAt).toLocaleDateString();
  };

  return (
    <section className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-heading text-3xl text-gray-900">
            {stage.label}{" "}
            <span className="text-lg font-normal text-gray-400">({display.length} manuscript{display.length === 1 ? "" : "s"})</span>
          </h1>
        </div>
        <Button type="button" variant="outline" disabled={display.length === 0} onClick={() => setExportOpen(true)}>
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </div>

      <ExportCsvDialog
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        title={`Export — ${stage.label}`}
        filename={`production-${stage.path}.csv`}
        rows={display}
        columns={SUBMISSION_EXPORT_COLUMNS}
        defaultPermission="publish:read"
      />

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <label className="flex flex-col gap-1 text-xs font-medium text-gray-600">
          Search (ID / title / author)
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Type to search…"
            className="h-10 max-w-md rounded-lg border border-gray-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </label>
      </div>

      {/* Stage progress bar */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Production Stage</p>
        <div className="flex items-center gap-0">
          {STAGES.map((s, idx) => {
            const currentIdx = STAGES.findIndex((st) => st.key === stage.key);
            const isActive = idx === currentIdx;
            const isPast   = idx < currentIdx;
            return (
              <div key={s.key} className="flex flex-1 items-center">
                <div className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ${
                  isActive ? "bg-green-600 text-white" : isPast ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-400"
                }`}>
                  <span className="flex h-4 w-4 items-center justify-center rounded-full border-2 border-current text-[10px]">
                    {isPast ? <Check className="h-3 w-3" /> : idx + 1}
                  </span>
                  {s.label}
                </div>
                {idx < STAGES.length - 1 && (
                  <div className={`mx-1 h-0.5 flex-1 ${isPast ? "bg-green-400" : "bg-slate-200"}`} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {loading ? (
        <div className="animate-pulse space-y-3 rounded-xl border border-gray-200 bg-white p-4">
          <div className="h-8 w-full rounded bg-gray-100" />
        </div>
      ) : display.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-200 bg-white py-12 text-center text-sm text-gray-500">
          {rows.length === 0 ? "No manuscripts in this stage." : "No results match your search."}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="min-w-[900px] w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
                <th className="px-3 py-3"></th>
                <th className="px-3 py-3">ID</th>
                <th className="px-3 py-3">Paper + PDF</th>
                <th className="px-3 py-3">Authors</th>
                <th className="px-3 py-3">Journal</th>
                <th className="px-3 py-3">{dateLabel}</th>
                <th className="px-3 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {display.map((r) => (
                <tr key={r.id} className={`border-b border-gray-100 hover:bg-gray-50/80 ${r.priority ? "bg-amber-50/40" : ""}`}>
                  {/* star */}
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      title={r.priority ? "High priority — click to unmark" : "Mark as high priority"}
                      onClick={() => void onPriorityToggle(r.id, r.priority ?? false)}
                      className="flex items-center justify-center"
                    >
                      <Star className={`h-4 w-4 transition-colors ${r.priority ? "fill-amber-400 text-amber-400" : "text-gray-300 hover:text-amber-300"}`} />
                    </button>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 font-mono text-green-700">{r.id}</td>
                  <td className="max-w-[200px] px-3 py-2">
                    <p className="font-medium text-gray-900">{r.title}</p>
                    {pdfName(r.manuscriptPath) ? (
                      <p className="mt-0.5 font-mono text-xs text-gray-500">📎 {pdfName(r.manuscriptPath)}</p>
                    ) : null}
                  </td>
                  <td className="max-w-[160px] px-3 py-2 text-gray-800">{submissionAuthorsDisplay(r)}</td>
                  <td className="px-3 py-2">
                    <span className="rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-xs font-semibold text-green-700">
                      {r.journal?.id ?? r.journalId}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-gray-600">{dateFor(r)}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right">
                    <div className="flex justify-end gap-2">
                      {isPreparation ? (
                        /* Preparation: only Download dialog button */
                        <button
                          type="button"
                          title="Download files"
                          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-green-200 bg-green-50 px-3 text-xs font-medium text-green-900 hover:bg-green-100"
                          onClick={() => setDialogRow(r)}
                        >
                          <Download className="h-3.5 w-3.5" />
                          Download
                        </button>
                      ) : isUpload ? (
                        /* Upload stage: only Upload button */
                        <button
                          type="button"
                          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 text-xs font-medium text-blue-900 hover:bg-blue-100"
                          onClick={() => setUploadRow(r)}
                        >
                          <Download className="h-3.5 w-3.5 rotate-180" />
                          Upload
                        </button>
                      ) : (
                        /* Ready-published: Eye + production file download + Publish */
                        <>
                          <Link
                            to={`/admin/submissions/${r.id}`}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50"
                            title="View detail"
                          >
                            <Eye className="h-4 w-4" />
                          </Link>
                          {r.pdfPublicPath && (
                            <button
                              type="button"
                              title="Download uploaded article file"
                              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50"
                              onClick={() => void downloadFile(
                                `/submissions/${encodeURIComponent(r.id)}/production-file`,
                                pdfName(r.pdfPublicPath) ?? `article-${r.id}`,
                                "production"
                              )}
                            >
                              <Download className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            type="button"
                            title="Go to publish"
                            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-green-200 bg-green-50 px-3 text-xs font-medium text-green-900 hover:bg-green-100"
                            onClick={() => void navigate(`/admin/production/publish?id=${encodeURIComponent(r.id)}`)}
                          >
                            <BookOpen className="h-3.5 w-3.5" />
                            Publish
                          </button>
                        </>
                      )}
                    {/* Manual stage change */}
                    <select
                      className="h-9 rounded-lg border border-gray-200 bg-white px-2 text-xs text-gray-600 cursor-pointer hover:border-gray-300"
                      value=""
                      title="Move to stage"
                      onChange={(e) => { if (e.target.value) void changeStage(r.id, e.target.value); e.target.value = ""; }}
                    >
                      <option value="" disabled>Move to…</option>
                      {STAGES.filter(s => s.key !== stage.key).map(s => (
                        <option key={s.key} value={s.key}>{s.label}</option>
                      ))}
                    </select>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {/* Download dialog */}
      {dialogRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-heading text-lg text-gray-900">Download files</h2>
                <p className="mt-0.5 font-mono text-xs text-gray-500">{dialogRow.id}</p>
                <p className="mt-1 text-sm text-gray-700 line-clamp-2">{dialogRow.title}</p>
              </div>
              <button type="button" onClick={() => setDialogRow(null)}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-5 space-y-3">
              {/* Sample template */}
              <button
                type="button"
                disabled={downloading !== null}
                onClick={() => void downloadFile(
                  `/submissions/${encodeURIComponent(dialogRow.id)}/sample`,
                  `sample-${dialogRow.journalId ?? dialogRow.id}.docx`,
                  "sample"
                )}
                className="flex w-full items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-left hover:bg-blue-100 disabled:opacity-50"
              >
                <FileText className="h-5 w-5 shrink-0 text-blue-600" />
                <div>
                  <p className="text-sm font-semibold text-blue-900">Sample template</p>
                  <p className="text-xs text-blue-600">Journal format template (.docx)</p>
                </div>
                {downloading === "sample" && <span className="ml-auto h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />}
              </button>
              {/* Author manuscript — auto-advances to ReadyForUpload */}
              <button
                type="button"
                disabled={downloading !== null}
                onClick={() => void downloadFile(
                  `/submissions/${encodeURIComponent(dialogRow.id)}/manuscript-advance`,
                  pdfName(dialogRow.manuscriptPath) ?? `manuscript-${dialogRow.id}.pdf`,
                  "author"
                )}
                className="flex w-full items-center gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-left hover:bg-green-100 disabled:opacity-50"
              >
                <Download className="h-5 w-5 shrink-0 text-green-600" />
                <div>
                  <p className="text-sm font-semibold text-green-900">Author manuscript</p>
                  <p className="text-xs text-green-600">Original submission · moves to Ready for Upload</p>
                </div>
                {downloading === "author" && <span className="ml-auto h-4 w-4 animate-spin rounded-full border-2 border-green-600 border-t-transparent" />}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Upload dialog */}
      {uploadRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-heading text-lg text-gray-900">Upload article file</h2>
                <p className="mt-0.5 font-mono text-xs text-gray-500">{uploadRow.id}</p>
                <p className="mt-1 text-sm text-gray-700 line-clamp-2">{uploadRow.title}</p>
              </div>
              <button type="button" onClick={() => setUploadRow(null)} disabled={uploading}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 disabled:opacity-50">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-5">
              <label className={`flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed px-4 py-6 transition-colors ${uploading ? "border-blue-300 bg-blue-50" : "border-gray-300 hover:border-blue-400 hover:bg-blue-50"}`}>
                <Download className="h-8 w-8 rotate-180 text-blue-400" />
                <div className="text-center">
                  <p className="text-sm font-semibold text-gray-800">Click to select file</p>
                  <p className="text-xs text-gray-400">PDF or Word (.doc / .docx) — max 50 MB</p>
                </div>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  className="hidden"
                  disabled={uploading}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (file.size > 50 * 1024 * 1024) { toast.error("File too large — max 50 MB"); return; }
                    void handleProductionUpload(uploadRow.id, file);
                  }}
                />
              </label>
              {uploading && (
                <div className="mt-3 flex items-center gap-2 text-sm text-blue-700">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                  Uploading… moving to Ready to Publish
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

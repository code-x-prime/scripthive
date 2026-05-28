import { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import {
  Check,
  Copy,
  FileSpreadsheet,
  FileText,
  Image as ImageIcon,
  Loader2,
  Trash2,
  Upload
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  deleteMediaFile,
  listMediaFiles,
  type MediaFileRecord,
  setMediaTokenGetter,
  uploadMediaFile
} from "@/services/media.service";

type UploadQueueItem = {
  id: string;
  file: File;
  progress: number;
  status: "pending" | "uploading" | "done" | "error";
  error?: string;
};

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function fileKind(mime: string, name: string): "image" | "pdf" | "sheet" | "other" {
  if (mime.startsWith("image/")) return "image";
  if (mime === "application/pdf" || name.endsWith(".pdf")) return "pdf";
  if (
    mime.includes("spreadsheet") ||
    mime.includes("excel") ||
    mime === "text/csv" ||
    /\.(xlsx?|csv)$/i.test(name)
  ) {
    return "sheet";
  }
  return "other";
}

function KindIcon({ kind }: { kind: ReturnType<typeof fileKind> }) {
  if (kind === "image") return <ImageIcon className="h-8 w-8 text-green-600" />;
  if (kind === "sheet") return <FileSpreadsheet className="h-8 w-8 text-emerald-600" />;
  if (kind === "pdf") return <FileText className="h-8 w-8 text-red-600" />;
  return <FileText className="h-8 w-8 text-gray-500" />;
}

export const MediaLibraryPanel = () => {
  const { accessToken } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [files, setFiles] = useState<MediaFileRecord[]>([]);
  const [queue, setQueue] = useState<UploadQueueItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    setMediaTokenGetter(() => accessToken);
  }, [accessToken]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await listMediaFiles();
      setFiles(rows);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load files");
      setFiles([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  const processQueue = async (items: UploadQueueItem[]) => {
    setUploading(true);
    let success = 0;
    let failed = 0;

    for (const item of items) {
      setQueue((prev) =>
        prev.map((q) => (q.id === item.id ? { ...q, status: "uploading", progress: 0 } : q))
      );
      try {
        const uploaded = await uploadMediaFile(item.file, (percent) => {
          setQueue((prev) => prev.map((q) => (q.id === item.id ? { ...q, progress: percent } : q)));
        });
        setQueue((prev) =>
          prev.map((q) => (q.id === item.id ? { ...q, status: "done", progress: 100 } : q))
        );
        const created = uploaded[0];
        if (created) {
          setFiles((prev) => [created, ...prev]);
        }
        success += 1;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Upload failed";
        setQueue((prev) =>
          prev.map((q) => (q.id === item.id ? { ...q, status: "error", error: msg } : q))
        );
        failed += 1;
      }
    }

    setUploading(false);
    if (success > 0) toast.success(`${success} file(s) uploaded`);
    if (failed > 0) toast.error(`${failed} file(s) failed`);

    setTimeout(() => {
      setQueue((prev) => prev.filter((q) => q.status === "error"));
    }, 4000);
  };

  const onPickFiles = (picked: FileList | null) => {
    if (!picked?.length) return;
    const items: UploadQueueItem[] = Array.from(picked).map((file) => ({
      id: `${file.name}-${file.size}-${Date.now()}-${Math.random()}`,
      file,
      progress: 0,
      status: "pending" as const
    }));
    setQueue((prev) => [...items, ...prev]);
    void processQueue(items);
  };

  const onDelete = async (row: MediaFileRecord) => {
    if (!window.confirm(`Delete "${row.originalName}"?`)) return;
    try {
      await deleteMediaFile(row.id);
      setFiles((prev) => prev.filter((f) => f.id !== row.id));
      toast.success("File deleted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  };

  const copyUrl = async (row: MediaFileRecord) => {
    const full = row.url.startsWith("http") ? row.url : `${window.location.origin}${row.url}`;
    try {
      await navigator.clipboard.writeText(full);
      setCopiedId(row.id);
      toast.success("Link copied");
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error("Could not copy link");
    }
  };

  return (
    <div className="space-y-6 p-6" role="tabpanel">
      <p className="text-sm text-gray-600">
        Upload images, PDFs, Excel, Word, and more. Files are stored in your media panel — copy the link to use them
        anywhere.
      </p>

      <div
        className={`relative rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
          uploading ? "border-green-300 bg-green-50/40" : "border-gray-200 bg-gray-50/50 hover:border-green-300"
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          e.currentTarget.classList.add("border-green-400", "bg-green-50/60");
        }}
        onDragLeave={(e) => {
          e.currentTarget.classList.remove("border-green-400", "bg-green-50/60");
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.currentTarget.classList.remove("border-green-400", "bg-green-50/60");
          onPickFiles(e.dataTransfer.files);
        }}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.svg,.xlsx,.xls,.csv,.doc,.docx,.ppt,.pptx,.zip"
          onChange={(e) => {
            onPickFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <Upload className="mx-auto h-10 w-10 text-green-600" />
        <p className="mt-3 text-sm font-medium text-gray-800">Drag & drop files here</p>
        <p className="mt-1 text-xs text-gray-500">PDF, images, Excel, Word, PPT, ZIP — up to 25 MB each, multiple at once</p>
        <button
          type="button"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          className="mt-4 rounded-lg bg-green-600 px-5 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
        >
          {uploading ? "Uploading…" : "Choose files"}
        </button>
      </div>

      {queue.length > 0 ? (
        <div className="space-y-2 rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Upload progress</p>
          {queue.map((item) => (
            <div key={item.id} className="rounded-lg border border-gray-100 bg-gray-50/80 px-3 py-2">
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate font-medium text-gray-800">{item.file.name}</span>
                <span className="shrink-0 text-xs text-gray-500">
                  {item.status === "error" ? (
                    <span className="text-red-600">{item.error}</span>
                  ) : item.status === "done" ? (
                    <span className="inline-flex items-center gap-1 text-green-700">
                      <Check className="h-3.5 w-3.5" /> Done
                    </span>
                  ) : (
                    `${item.progress}%`
                  )}
                </span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-200">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    item.status === "error"
                      ? "bg-red-500"
                      : item.status === "done"
                        ? "bg-green-600"
                        : "bg-green-500"
                  }`}
                  style={{ width: `${item.progress}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-gray-500">
          <Loader2 className="h-5 w-5 animate-spin text-green-600" />
          Loading library…
        </div>
      ) : files.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-200 py-12 text-center text-sm text-gray-500">
          No files yet. Upload your first file above.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {files.map((row) => {
            const kind = fileKind(row.mimeType, row.originalName);
            const isImage = kind === "image";
            return (
              <div
                key={row.id}
                className="flex gap-3 rounded-xl border border-gray-200 bg-white p-3 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gray-50">
                  {isImage ? (
                    <img src={row.url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <KindIcon kind={kind} />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-900" title={row.originalName}>
                    {row.originalName}
                  </p>
                  <p className="text-xs text-gray-500">{formatBytes(row.size)}</p>
                  <p className="truncate font-mono text-[10px] text-gray-400">{row.url}</p>
                  <div className="mt-2 flex gap-1">
                    <button
                      type="button"
                      title="Copy link"
                      onClick={() => void copyUrl(row)}
                      className="inline-flex h-8 items-center gap-1 rounded-lg border border-gray-200 px-2 text-xs text-gray-700 hover:bg-gray-50"
                    >
                      {copiedId === row.id ? (
                        <Check className="h-3.5 w-3.5 text-green-600" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                      Copy
                    </button>
                    <a
                      href={row.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-8 items-center rounded-lg border border-gray-200 px-2 text-xs text-gray-700 hover:bg-gray-50"
                    >
                      Open
                    </a>
                    <button
                      type="button"
                      title="Delete"
                      onClick={() => void onDelete(row)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-200 text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

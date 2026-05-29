import { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import {
  ArrowDown,
  ArrowUp,
  Eye,
  EyeOff,
  GripVertical,
  ImagePlus,
  Loader2,
  Pencil,
  Plus,
  Save,
  Trash2,
  Upload,
  X
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  type CarouselSlide,
  createCarouselSlide,
  deleteCarouselSlide,
  listCarouselSlidesAdmin,
  reorderCarouselSlides,
  setCarouselTokenGetter,
  updateCarouselSlide
} from "@/services/carousel.service";
import { listMediaFiles, setMediaTokenGetter, type MediaFileRecord } from "@/services/media.service";

type FormState = {
  imageUrl: string;
  title: string;
  subtitle: string;
  linkUrl: string;
  isActive: boolean;
};

const EMPTY_FORM: FormState = {
  imageUrl: "",
  title: "",
  subtitle: "",
  linkUrl: "",
  isActive: true
};

function SlideForm({
  initial,
  onSave,
  onCancel,
  saving,
  mediaFiles
}: {
  initial: FormState;
  onSave: (f: FormState) => void;
  onCancel: () => void;
  saving: boolean;
  mediaFiles: MediaFileRecord[];
}) {
  const [form, setForm] = useState<FormState>(initial);
  const [showPicker, setShowPicker] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const images = mediaFiles.filter((f) => f.mimeType.startsWith("image/"));

  const uploadImageFile = async (file: File) => {
    if (!file.type.startsWith("image/")) { toast.error("Only image files allowed"); return; }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("files", file);
      const res = await fetch("/api/media/upload", { method: "POST", body: fd, credentials: "include" });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json() as { files: { url: string }[] };
      const url = data.files?.[0]?.url ?? "";
      if (url) setForm((f) => ({ ...f, imageUrl: url }));
      toast.success("Image uploaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4 rounded-xl border border-green-200 bg-green-50/40 p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-green-800">
        {initial.imageUrl ? "Edit slide" : "New slide"}
      </p>

      {/* Image picker */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-gray-600">Image *</label>
        {form.imageUrl ? (
          <div className="relative w-full overflow-hidden rounded-xl border border-gray-200 bg-gray-100" style={{ height: 160 }}>
            <img src={form.imageUrl} alt="" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, imageUrl: "" }))}
              className="absolute right-2 top-2 rounded-full bg-white/80 p-1 text-gray-700 hover:bg-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div
            className={`rounded-xl border-2 border-dashed transition-colors ${dragOver ? "border-green-400 bg-green-50" : "border-gray-300"}`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) void uploadImageFile(f); }}
          >
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadImageFile(f); }} />
            <div className="flex flex-col items-center gap-3 py-6">
              {uploading ? (
                <Loader2 className="h-6 w-6 animate-spin text-green-600" />
              ) : (
                <Upload className="h-6 w-6 text-gray-400" />
              )}
              <p className="text-sm text-gray-500">
                {uploading ? "Uploading…" : "Drag & drop image here, or"}
              </p>
              <div className="flex gap-2">
                <button type="button" disabled={uploading} onClick={() => fileInputRef.current?.click()}
                  className="rounded-lg border border-green-300 bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100 disabled:opacity-50">
                  Upload from PC
                </button>
                <button type="button" disabled={uploading} onClick={() => setShowPicker((v) => !v)}
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50">
                  <ImagePlus className="mr-1 inline h-3.5 w-3.5" />
                  Media library
                </button>
              </div>
            </div>
          </div>
        )}

        {showPicker && !form.imageUrl && (
          <div className="max-h-56 overflow-y-auto rounded-xl border border-gray-200 bg-white p-3">
            {images.length === 0 ? (
              <p className="py-4 text-center text-xs text-gray-400">
                No images in media library. Upload images first in the Media library tab.
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {images.map((img) => (
                  <button
                    key={img.id}
                    type="button"
                    onClick={() => {
                      setForm((f) => ({ ...f, imageUrl: img.url }));
                      setShowPicker(false);
                    }}
                    className="group relative aspect-video overflow-hidden rounded-lg border-2 border-transparent hover:border-green-500"
                    title={img.originalName}
                  >
                    <img src={img.url} alt="" className="h-full w-full object-cover" />
                    <span className="absolute inset-x-0 bottom-0 truncate bg-black/50 px-1 py-0.5 text-[9px] text-white opacity-0 group-hover:opacity-100">
                      {img.originalName}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <label className="flex flex-col gap-1.5 text-xs font-medium text-gray-600">
        Title (optional)
        <input
          value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          placeholder="Welcome to ScriptHive"
          className="h-10 rounded-lg border border-gray-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        />
      </label>

      <label className="flex flex-col gap-1.5 text-xs font-medium text-gray-600">
        Subtitle (optional)
        <input
          value={form.subtitle}
          onChange={(e) => setForm((f) => ({ ...f, subtitle: e.target.value }))}
          placeholder="Publish your research with us"
          className="h-10 rounded-lg border border-gray-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        />
      </label>

      <label className="flex flex-col gap-1.5 text-xs font-medium text-gray-600">
        Link URL (optional)
        <input
          value={form.linkUrl}
          onChange={(e) => setForm((f) => ({ ...f, linkUrl: e.target.value }))}
          placeholder="https://example.com"
          className="h-10 rounded-lg border border-gray-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        />
      </label>

      <label className="flex cursor-pointer items-center gap-3 text-sm text-gray-700">
        <div
          className={`relative h-5 w-9 rounded-full transition-colors ${form.isActive ? "bg-green-500" : "bg-gray-300"}`}
          onClick={() => setForm((f) => ({ ...f, isActive: !f.isActive }))}
        >
          <span
            className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${form.isActive ? "translate-x-4" : "translate-x-0.5"}`}
          />
        </div>
        Active (show on site)
      </label>

      <div className="flex gap-2">
        <button
          type="button"
          disabled={saving || !form.imageUrl}
          onClick={() => onSave(form)}
          className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? "Saving…" : "Save slide"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export const CarouselPanel = () => {
  const { accessToken } = useAuth();
  const [slides, setSlides] = useState<CarouselSlide[]>([]);
  const [mediaFiles, setMediaFiles] = useState<MediaFileRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [reordering, setReordering] = useState(false);

  useEffect(() => {
    setCarouselTokenGetter(() => accessToken);
    setMediaTokenGetter(() => accessToken);
  }, [accessToken]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, m] = await Promise.all([listCarouselSlidesAdmin(), listMediaFiles()]);
      setSlides(s);
      setMediaFiles(m);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  const handleCreate = async (form: FormState) => {
    setSaving(true);
    try {
      const slide = await createCarouselSlide({
        imageUrl: form.imageUrl,
        title: form.title || null,
        subtitle: form.subtitle || null,
        linkUrl: form.linkUrl || null,
        isActive: form.isActive,
        position: slides.length
      });
      setSlides((prev) => [...prev, slide]);
      setAdding(false);
      toast.success("Slide added");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (id: string, form: FormState) => {
    setSaving(true);
    try {
      const updated = await updateCarouselSlide(id, {
        imageUrl: form.imageUrl,
        title: form.title || null,
        subtitle: form.subtitle || null,
        linkUrl: form.linkUrl || null,
        isActive: form.isActive
      });
      setSlides((prev) => prev.map((s) => (s.id === id ? updated : s)));
      setEditingId(null);
      toast.success("Slide updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (slide: CarouselSlide) => {
    if (!window.confirm(`Delete this slide?`)) return;
    try {
      await deleteCarouselSlide(slide.id);
      const remaining = slides.filter((s) => s.id !== slide.id);
      setSlides(remaining);
      // fix positions
      await reorderCarouselSlides(remaining.map((s) => s.id));
      toast.success("Slide deleted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete");
    }
  };

  const handleToggleActive = async (slide: CarouselSlide) => {
    try {
      const updated = await updateCarouselSlide(slide.id, { isActive: !slide.isActive });
      setSlides((prev) => prev.map((s) => (s.id === slide.id ? updated : s)));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update");
    }
  };

  const moveSlide = async (idx: number, dir: -1 | 1) => {
    const next = [...slides];
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= next.length) return;
    const tmp = next[idx];
    next[idx] = next[swapIdx]!;
    next[swapIdx] = tmp!;
    setSlides(next);
    setReordering(true);
    try {
      await reorderCarouselSlides(next.map((s) => s.id));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Reorder failed");
      void load();
    } finally {
      setReordering(false);
    }
  };

  return (
    <div className="space-y-6 p-6" role="tabpanel">
      <div className="flex items-start justify-between gap-4">
        <p className="text-sm text-gray-600">
          Manage homepage image carousel. Upload images from the{" "}
          <span className="font-medium text-gray-800">Media library</span> tab first, then add them here.
          Reorder with arrows. Position is saved automatically.
        </p>
        {!adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="flex shrink-0 items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
          >
            <Plus className="h-4 w-4" />
            Add slide
          </button>
        )}
      </div>

      {adding && (
        <SlideForm
          initial={EMPTY_FORM}
          mediaFiles={mediaFiles}
          saving={saving}
          onSave={handleCreate}
          onCancel={() => setAdding(false)}
        />
      )}

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-gray-500">
          <Loader2 className="h-5 w-5 animate-spin text-green-600" />
          Loading slides…
        </div>
      ) : slides.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-200 py-16 text-center text-sm text-gray-500">
          No slides yet. Click "Add slide" to create your first carousel item.
        </p>
      ) : (
        <div className="space-y-3">
          {reordering && (
            <p className="text-xs text-gray-400">Saving order…</p>
          )}
          {slides.map((slide, idx) =>
            editingId === slide.id ? (
              <SlideForm
                key={slide.id}
                initial={{
                  imageUrl: slide.imageUrl,
                  title: slide.title ?? "",
                  subtitle: slide.subtitle ?? "",
                  linkUrl: slide.linkUrl ?? "",
                  isActive: slide.isActive
                }}
                mediaFiles={mediaFiles}
                saving={saving}
                onSave={(form) => void handleUpdate(slide.id, form)}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <div
                key={slide.id}
                className={`flex gap-3 rounded-xl border bg-white p-3 shadow-sm transition-all ${
                  slide.isActive ? "border-gray-200" : "border-dashed border-gray-200 opacity-60"
                }`}
              >
                {/* Drag handle / position indicator */}
                <div className="flex shrink-0 flex-col items-center gap-1 pt-1">
                  <GripVertical className="h-4 w-4 text-gray-300" />
                  <span className="text-[10px] font-mono text-gray-400">{idx + 1}</span>
                </div>

                {/* Thumbnail */}
                <div className="h-20 w-32 shrink-0 overflow-hidden rounded-lg border border-gray-100 bg-gray-50">
                  <img src={slide.imageUrl} alt="" className="h-full w-full object-cover" />
                </div>

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-900">
                    {slide.title || <span className="italic text-gray-400">No title</span>}
                  </p>
                  {slide.subtitle && (
                    <p className="truncate text-xs text-gray-500">{slide.subtitle}</p>
                  )}
                  {slide.linkUrl && (
                    <p className="truncate font-mono text-[10px] text-gray-400">{slide.linkUrl}</p>
                  )}
                  <span
                    className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      slide.isActive
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {slide.isActive ? (
                      <><Eye className="h-3 w-3" /> Active</>
                    ) : (
                      <><EyeOff className="h-3 w-3" /> Hidden</>
                    )}
                  </span>
                </div>

                {/* Actions */}
                <div className="flex shrink-0 flex-col items-end justify-between gap-1">
                  <div className="flex gap-1">
                    <button
                      type="button"
                      title="Move up"
                      disabled={idx === 0 || reordering}
                      onClick={() => void moveSlide(idx, -1)}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30"
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      title="Move down"
                      disabled={idx === slides.length - 1 || reordering}
                      onClick={() => void moveSlide(idx, 1)}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30"
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      title={slide.isActive ? "Hide slide" : "Show slide"}
                      onClick={() => void handleToggleActive(slide)}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50"
                    >
                      {slide.isActive ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                    <button
                      type="button"
                      title="Edit"
                      onClick={() => setEditingId(slide.id)}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      title="Delete"
                      onClick={() => void handleDelete(slide)}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-red-200 text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
};

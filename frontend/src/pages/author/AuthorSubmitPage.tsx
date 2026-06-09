import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { FileText, Loader2, Upload, X, CheckCircle2, AlertCircle } from "lucide-react";
import { useAuthorAuth } from "@/contexts/AuthorAuthContext";
import { authorService } from "@/services/author.service";
import { journalService } from "@/services/journal.service";
import { settingsService } from "@/services/settings.service";
import { parseApiError } from "@/utils/parseApiError";
import type { Journal } from "@/types";

interface AddonService { id: string; label: string; price: number; currency: string; enabled: boolean }

const inputCls = "w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500/20 transition-colors";
const labelCls = "block text-sm font-semibold text-slate-700 mb-1.5";

export function AuthorSubmitPage() {
  const navigate   = useNavigate();
  const { author } = useAuthorAuth();

  const [journals, setJournals]       = useState<Journal[]>([]);
  const [addons, setAddons]           = useState<AddonService[]>([]);
  const [selectedAddons, setSelected] = useState<string[]>([]);
  const [loadingInit, setLoadingInit] = useState(true);
  const [submitting, setSubmitting]   = useState(false);

  // form fields
  const [journalId, setJournalId]     = useState("");
  const [title, setTitle]             = useState("");
  const [coAuthors, setCoAuthors]     = useState("");
  const [abstract, setAbstract]       = useState("");
  const [keywords, setKeywords]       = useState("");
  const [articleType, setArticleType] = useState("Research");
  const [country, setCountry]         = useState("");
  const [authorAddress, setAuthorAddress] = useState("");
  const [authorState, setAuthorState] = useState("");
  const [affiliations, setAffiliations] = useState("");
  const [file, setFile]               = useState<File | null>(null);
  const [authorSeed, setAuthorSeed]   = useState<string | null>(null);

  // pre-fill from author context
  if (author && author.id !== authorSeed) {
    setAuthorSeed(author.id);
    setCountry(author.country ?? "");
    setAffiliations(author.affiliations ?? "");
  }

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      journalService.list(),
      settingsService.get().catch(() => ({} as Record<string, string>))
    ]).then(([jList, settings]) => {
      if (cancelled) return;
      setJournals(jList);
      if (settings.addon_services_parsed) {
        const all = settings.addon_services_parsed as unknown as AddonService[];
        setAddons(all.filter((a) => a.enabled));
      }
    }).catch(() => {
      if (!cancelled) toast.error("Could not load form data. Please refresh.");
    }).finally(() => {
      if (!cancelled) setLoadingInit(false);
    });
    return () => { cancelled = true; };
  }, []);

  const toggleAddon = (id: string) =>
    setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  const onPickFile = (f: File | null) => {
    if (!f) { setFile(null); return; }
    const allowed = ["application/pdf", "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
    const allowedExt = [".pdf", ".doc", ".docx"];
    const ext = "." + f.name.split(".").pop()!.toLowerCase();
    if (!allowed.includes(f.type) && !allowedExt.includes(ext)) {
      toast.error("Only PDF, DOC, or DOCX files are allowed.");
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      toast.error("File too large. Maximum 10 MB.");
      return;
    }
    setFile(f);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!journalId.trim()) { toast.error("Please select a journal."); return; }
    if (!title.trim())     { toast.error("Paper title is required."); return; }
    if (!abstract.trim())  { toast.error("Abstract is required."); return; }
    if (!keywords.trim())  { toast.error("Keywords are required."); return; }
    if (!file)             { toast.error("Please attach your manuscript file."); return; }

    const fd = new FormData();
    fd.append("journalId",   journalId.trim());
    fd.append("title",       title.trim());
    fd.append("abstract",    abstract.trim());
    fd.append("keywords",    keywords.trim());
    fd.append("articleType", articleType);
    if (country.trim())      fd.append("country",      country.trim());
    if (authorAddress.trim()) fd.append("author_address", authorAddress.trim());
    if (authorState.trim())   fd.append("author_state",   authorState.trim());
    if (coAuthors.trim())    fd.append("coAuthors",    coAuthors.trim());
    if (affiliations.trim()) fd.append("affiliations", affiliations.trim());
    if (selectedAddons.length > 0) {
      const picked = addons.filter((a) => selectedAddons.includes(a.id));
      fd.append("addons", JSON.stringify(picked));
    }
    fd.append("manuscript", file);

    setSubmitting(true);
    try {
      const res  = await authorService.createSubmission(fd);
      const body = (await res.json().catch(() => ({}))) as { submissionId?: string; id?: string; message?: string };
      if (!res.ok) throw new Error(body.message ?? await parseApiError(res, "Submission failed"));
      const id = body.submissionId ?? body.id;
      toast.success("Manuscript submitted successfully!");
      navigate(id ? `/author/submissions/${id}` : "/author/dashboard");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Submission failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const addonTotal = addons.filter((a) => selectedAddons.includes(a.id)).reduce((s, a) => s + a.price, 0);

  if (loadingInit) {
    return (
      <div className="flex items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white p-16 text-slate-400">
        <Loader2 className="h-6 w-6 animate-spin text-green-600" />
        <span className="text-sm">Loading form…</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="font-heading text-2xl font-bold text-slate-900">Submit Manuscript</h1>
        <p className="mt-1 text-sm text-slate-500">
          Submitting as <strong>{author?.name}</strong> ({author?.email})
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Journal + article type */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="font-semibold text-slate-900 mb-4">Journal & Article Type</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className={labelCls}>Select Journal *</label>
              <select value={journalId} onChange={(e) => setJournalId(e.target.value)}
                className={inputCls} required>
                <option value="">— Choose a journal —</option>
                {journals.map((j) => (
                  <option key={j.id} value={j.id}>{j.id} — {j.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Article Type</label>
              <select value={articleType} onChange={(e) => setArticleType(e.target.value)} className={inputCls}>
                <option value="Research">Research Article</option>
                <option value="Review">Review Article</option>
                <option value="Case Study">Case Study</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Country</label>
              <input value={country} onChange={(e) => setCountry(e.target.value)}
                placeholder="e.g. India" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>State / Province</label>
              <input value={authorState} onChange={(e) => setAuthorState(e.target.value)}
                placeholder="e.g. Maharashtra" className={inputCls} />
            </div>
            <div className="md:col-span-2">
              <label className={labelCls}>Address</label>
              <input value={authorAddress} onChange={(e) => setAuthorAddress(e.target.value)}
                placeholder="Full postal address" className={inputCls} />
            </div>
          </div>
        </div>

        {/* Manuscript details */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="font-semibold text-slate-900 mb-4">Manuscript Details</h2>
          <div className="space-y-4">
            <div>
              <label className={labelCls}>Paper Title *</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)}
                placeholder="Full title of your manuscript" className={inputCls} required />
            </div>
            <div>
              <label className={labelCls}>Co-Authors</label>
              <input value={coAuthors} onChange={(e) => setCoAuthors(e.target.value)}
                placeholder="Author A; Author B; Author C"
                className={inputCls} />
              <p className="mt-1 text-xs text-slate-400">Separate multiple authors with semicolons</p>
            </div>
            <div>
              <label className={labelCls}>Affiliation / Institution</label>
              <textarea value={affiliations} onChange={(e) => setAffiliations(e.target.value)}
                rows={2} placeholder="Department, University, City, Country"
                className={`${inputCls} resize-none`} />
            </div>
            <div>
              <label className={labelCls}>Abstract *</label>
              <textarea value={abstract} onChange={(e) => setAbstract(e.target.value)}
                rows={6} placeholder="Provide a concise summary of your research (150–300 words)…"
                className={`${inputCls} resize-y`} required />
            </div>
            <div>
              <label className={labelCls}>Keywords *</label>
              <input value={keywords} onChange={(e) => setKeywords(e.target.value)}
                placeholder="keyword1, keyword2, keyword3, keyword4, keyword5"
                className={inputCls} required />
              <p className="mt-1 text-xs text-slate-400">5–7 keywords, comma-separated</p>
            </div>
          </div>
        </div>

        {/* File upload */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="font-semibold text-slate-900 mb-4">Manuscript File *</h2>
          <label className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed cursor-pointer transition-colors ${
            file ? "border-green-400 bg-green-50/40" : "border-slate-300 bg-slate-50/50 hover:border-green-400 hover:bg-green-50/30"
          } px-6 py-8`}>
            {file ? (
              <div className="flex flex-col items-center gap-2 text-center">
                <FileText className="h-8 w-8 text-green-600" />
                <p className="font-semibold text-green-800 text-sm">{file.name}</p>
                <p className="text-xs text-green-600">{(file.size / 1024).toFixed(0)} KB</p>
                <button type="button" onClick={(e) => { e.preventDefault(); setFile(null); }}
                  className="mt-1 flex items-center gap-1 rounded-lg border border-red-200 bg-white px-3 py-1 text-xs text-red-600 hover:bg-red-50">
                  <X className="h-3 w-3" /> Remove
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 text-center">
                <Upload className="h-8 w-8 text-slate-400" />
                <p className="font-semibold text-slate-700 text-sm">Click to upload or drag & drop</p>
                <p className="text-xs text-slate-400">PDF, DOC, DOCX — max 10 MB</p>
              </div>
            )}
            <input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx"
              onChange={(e) => onPickFile(e.target.files?.[0] ?? null)} className="hidden" />
          </label>
        </div>

        {/* Add-on services */}
        {addons.length > 0 && (
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4">
              <h2 className="font-semibold text-slate-900">Add-on Services</h2>
              <p className="mt-0.5 text-sm text-slate-500">Optional paid services for your submission</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {addons.map((addon) => {
                const checked = selectedAddons.includes(addon.id);
                return (
                  <button key={addon.id} type="button" onClick={() => toggleAddon(addon.id)}
                    className={`flex items-center justify-between rounded-xl border px-4 py-3 text-left text-sm transition-all ${
                      checked
                        ? "border-green-400 bg-green-50 ring-1 ring-green-400"
                        : "border-slate-200 bg-white hover:border-green-300 hover:bg-green-50/30"
                    }`}>
                    <div className="flex items-center gap-2.5">
                      <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                        checked ? "border-green-500 bg-green-500" : "border-slate-300"
                      }`}>
                        {checked && <CheckCircle2 className="h-3.5 w-3.5 text-white" />}
                      </div>
                      <span className={`font-medium ${checked ? "text-green-900" : "text-slate-800"}`}>{addon.label}</span>
                    </div>
                    {checked && (
                      <span className="shrink-0 font-mono text-sm font-semibold text-green-700">✓</span>
                    )}
                  </button>
                );
              })}
            </div>
            {selectedAddons.length > 0 && (
              <div className="mt-4 flex items-center justify-between rounded-lg bg-green-50 border border-green-200 px-4 py-3">
                <span className="text-sm font-medium text-green-800">Total add-ons</span>
                <span className="font-mono text-sm font-bold text-green-700">₹{addonTotal.toLocaleString("en-IN")}</span>
              </div>
            )}
          </div>
        )}

        {/* Submit */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start gap-3 mb-5 rounded-lg bg-amber-50 border border-amber-200 p-4">
            <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800">
              By submitting, you confirm this is original work and has not been published elsewhere. The editorial team will review your submission within 7–15 working days.
            </p>
          </div>
          <button type="submit" disabled={submitting || loadingInit}
            className="w-full rounded-xl bg-green-600 py-3.5 text-sm font-bold text-white hover:bg-green-700 disabled:opacity-60 transition-colors shadow-sm flex items-center justify-center gap-2">
            {submitting ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Submitting…</>
            ) : (
              <><Upload className="h-4 w-4" /> Submit Manuscript</>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import JoditEditor from "jodit-react";
import toast from "react-hot-toast";
import { Upload, FileText, ChevronDown } from "lucide-react";
import { apiFetch, apiJson } from "@/services/api";
import { settingsService } from "@/services/settings.service";
import type { Submission } from "@/types";
import { submissionAuthorsList } from "@/utils/submissionAuthors";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const JOURNALS = [
  { id: "SGJVSR" }, { id: "SGMRJ" }, { id: "SGJPLS" },
  { id: "SGJETR" }, { id: "SGJSSH" }, { id: "SGJASH" }
];

interface Part   { id: number; name: string }
interface Issue  { id: number; number: number; period?: string | null; parts: Part[] }
interface Volume { id: number; number: number; year: number; issues: Issue[] }

interface FormState {
  title: string; authorName: string; abstract: string; keywords: string;
  subject: string; country: string; doi: string; month: string;
  refNo: string; year: string;
  volumeId: string; issueId: string; partId: string;
  pageNo: string;
}

const INITIAL_FORM: FormState = {
  title: "", authorName: "", abstract: "", keywords: "",
  subject: "", country: "", doi: "", month: "",
  refNo: "", year: new Date().getFullYear().toString(),
  volumeId: "", issueId: "", partId: "", pageNo: ""
};

export const PublishArticlePage = () => {
  const [searchParams] = useSearchParams();
  const autoSelectId = searchParams.get("id") ?? "";

  const [form, setForm]               = useState<FormState>(INITIAL_FORM);
  const [articleNo, setArticleNo]     = useState<number | null>(null);
  const [pdfFile, setPdfFile]         = useState<File | null>(null);
  const [submissionId, setSubmissionId] = useState("");
  const [approvedList, setApprovedList] = useState<Submission[]>([]);
  const [filterJournalId, setFilterJournalId] = useState(JOURNALS[0]!.id);
  const [volumes, setVolumes]         = useState<Volume[]>([]);
  const [doiPrefix, setDoiPrefix]     = useState("10.33545/2664844X");
  const [assignDoiOnPublish, setAssignDoiOnPublish] = useState(false);
  const [loading, setLoading]         = useState(true);
  const [publishing, setPublishing]   = useState(false);

  const editorRef = useRef(null);

  const joditConfig = useMemo(() => ({
    readonly: false, height: 300,
    placeholder: "Enter article abstract here...",
    toolbarButtonSize: "small" as const,
    buttons: ["bold","italic","underline","strikethrough","|","fontsize","brush","align","|","ul","ol","|","outdent","indent","|","superscript","subscript","|","table","link","|","undo","redo","|","eraser","copyformat"],
    removeButtons: ["file","video","image","speechRecognize","spellcheck"],
    showXPathInStatusbar: false, showCharsCounter: false, showWordsCounter: false,
    askBeforePasteHTML: false, askBeforePasteFromWord: false,
    defaultActionOnPaste: "insert_clear_html" as const,
    style: { background: "#ffffff", color: "#0f172a", fontSize: "14px", fontFamily: "Poppins, sans-serif" }
  }), []);

  // derived from selected IDs
  const selectedVolume = useMemo(() => volumes.find((v) => String(v.id) === form.volumeId), [volumes, form.volumeId]);
  const selectedIssue  = useMemo(() => selectedVolume?.issues.find((i) => String(i.id) === form.issueId), [selectedVolume, form.issueId]);

  const doiLink = useMemo(() => {
    if (!assignDoiOnPublish || !selectedVolume || !selectedIssue || !articleNo) return "";
    const selectedPart = selectedIssue.parts.find((p) => String(p.id) === form.partId);
    const partRaw = (selectedPart?.name ?? "A").toLowerCase().replace(/[^a-z0-9]/g, "");
    // Special issue → s1, s2 etc; normal Part A = no suffix, Part B/AA = suffix
    const partSeg = partRaw === "a" ? "" : partRaw;
    const jid = filterJournalId.toLowerCase();
    const refNo = String(articleNo).padStart(3, "0");
    // Format: 10.55662/sgmrj.v1i1.001
    return `https://www.doi.org/${doiPrefix}/${jid}.v${selectedVolume.number}i${selectedIssue.number}${partSeg}.${refNo}`;
  }, [assignDoiOnPublish, selectedVolume, selectedIssue, form.partId, filterJournalId, articleNo, doiPrefix]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [approved, settings] = await Promise.all([
        apiJson<Submission[]>("/publish/approved-submissions"),
        settingsService.get().catch(() => ({} as Record<string, string>))
      ]);
      setApprovedList(approved);
      if (settings.doi_prefix) setDoiPrefix(settings.doi_prefix);
      // auto-select if ?id= param present
      if (autoSelectId) {
        const match = approved.find((s) => s.id === autoSelectId);
        if (match) {
          setSubmissionId(match.id);
          const authors = submissionAuthorsList(match);
          setForm((prev) => ({
            ...prev,
            title: match.title,
            authorName: authors.join(", "),
            abstract: match.abstract,
            keywords: match.keywords,
            country: match.country ?? "",
            doi: match.doiRecord?.doi ?? "",
            volumeId: "", issueId: "", partId: ""
          }));
          setFilterJournalId(match.journalId);
          void (async () => {
            try {
              const d = await apiJson<{ articleNo: number }>(`/publish/next-article-no?journalId=${encodeURIComponent(match.journalId)}`);
              setArticleNo(d.articleNo);
              setForm((prev) => ({ ...prev, refNo: String(d.articleNo) }));
            } catch { /* ignore */ }
          })();
        }
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSelectId]);

  useEffect(() => { queueMicrotask(() => { void loadData(); }); }, [loadData]);

  const loadVolumes = useCallback(async (jid: string) => {
    if (!jid) { setVolumes([]); return; }
    try {
      const data = await apiJson<Volume[]>(`/publish/volumes?journalId=${encodeURIComponent(jid)}`);
      setVolumes(data);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load volumes");
      setVolumes([]);
    }
  }, []);

  // reload volumes + reset selection when journal filter changes
  useEffect(() => {
    startTransition(() => setForm((p) => ({ ...p, volumeId: "", issueId: "", partId: "" })));
    queueMicrotask(() => void loadVolumes(filterJournalId));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterJournalId]);

  const fetchNextArticleNo = async (journalId: string) => {
    try {
      const data = await apiJson<{ articleNo: number }>(`/publish/next-article-no?journalId=${encodeURIComponent(journalId)}`);
      setArticleNo(data.articleNo);
      // pre-fill refNo with article no
      setForm((prev) => ({ ...prev, refNo: String(data.articleNo) }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not fetch article number");
      setArticleNo(null);
    }
  };

  const onSelectApproved = (sid: string) => {
    const sub = approvedList.find((s) => s.id === sid);
    if (!sub) { setSubmissionId(""); return; }
    setSubmissionId(sub.id);
    const authors = submissionAuthorsList(sub);
    setForm((prev) => ({
      ...prev,
      title: sub.title,
      authorName: authors.join(", "),
      abstract: sub.abstract,
      keywords: sub.keywords,
      country: sub.country ?? "",
      doi: sub.doiRecord?.doi ?? "",
      volumeId: "", issueId: "", partId: ""
    }));
    void fetchNextArticleNo(sub.journalId);
    // sync journal filter so volumes load for this submission's journal
    if (filterJournalId !== sub.journalId) {
      setFilterJournalId(sub.journalId);
      // effect will reload volumes; if same journal already loaded, reload manually
    } else {
      void loadVolumes(sub.journalId);
    }
  };

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const onPublish = async () => {
    if (!submissionId) { toast.error("Select an approved submission first"); return; }
    
    const latestTitle = form.title;
    const latestAuthor = form.authorName;
    const latestAbstract = (editorRef.current as any)?.value || form.abstract;

    if (!latestTitle)   { toast.error("Article title is required"); return; }
    if (!latestAuthor) { toast.error("Author name is required"); return; }
    if (!latestAbstract || latestAbstract.replace(/<[^>]*>/g, "").trim().length === 0) { toast.error("Abstract is required"); return; }
    if (!form.volumeId) { toast.error("Volume is required"); return; }
    if (!form.issueId)  { toast.error("Issue is required"); return; }
    if (!form.partId)   { toast.error("Part is required"); return; }
    if (!form.pageNo)   { toast.error("Page No is required"); return; }
    if (!pdfFile)       { toast.error("Please upload the article PDF"); return; }
    if (assignDoiOnPublish && !doiLink) {
      toast.error("Fill Volume, Issue, Part, Year and select a submission for DOI generation"); return;
    }

    const vol   = selectedVolume;
    const iss   = selectedIssue;
    const part  = selectedIssue?.parts.find((p) => String(p.id) === form.partId);
    if (!vol || !iss || !part) { toast.error("Select valid volume, issue and part"); return; }

    setPublishing(true);
    try {
      const fd = new window.FormData();
      fd.append("submissionId", submissionId);
      fd.append("title",        latestTitle);
      fd.append("authorName",   latestAuthor);
      fd.append("abstract",     latestAbstract);
      fd.append("keywords",     form.keywords);
      fd.append("subject",      form.subject);
      fd.append("country",      form.country);
      fd.append("doi",          form.doi);
      fd.append("month",        form.month);
      fd.append("refNo",        form.refNo);
      fd.append("year",         form.year);
      fd.append("volume",       String(vol.number));
      fd.append("issue",        String(iss.number));
      fd.append("part",         part.name);
      fd.append("pageNo",       form.pageNo);
      fd.append("articleNo",    String(articleNo ?? ""));
      fd.append("assignDoi",    String(assignDoiOnPublish));
      if (assignDoiOnPublish && doiLink) fd.append("doiLink", doiLink);
      fd.append("finalPdf", pdfFile);

      const res = await apiFetch("/publish", { method: "POST", body: fd });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Publish failed" })) as { message?: string };
        throw new Error(err.message ?? "Publish failed");
      }
      const result = (await res.json()) as { doiAssigned?: boolean; doiLink?: string | null };
      toast.success(result.doiAssigned ? "Article published with DOI assigned." : "Article published (no DOI assigned).");
      setForm(INITIAL_FORM);
      setSubmissionId("");
      setArticleNo(null);
      setAssignDoiOnPublish(false);
      setPdfFile(null);
      setVolumes([]);
      void loadData();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Publish failed");
    } finally {
      setPublishing(false);
    }
  };

  // filtered approved list by journal
  const filteredApproved = useMemo(() =>
    filterJournalId
      ? approvedList.filter((s) => s.journalId === filterJournalId)
      : approvedList,
    [approvedList, filterJournalId]
  );

  const approvedOptions = useMemo(() =>
    filteredApproved.map((s) => ({
      value: s.id,
      // show: ID — short title (max 40 chars)
      label: `${s.id} — ${s.title.slice(0, 40)}${s.title.length > 40 ? "…" : ""}`
    })),
    [filteredApproved]
  );

  const inputClass = "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent placeholder:text-slate-400";
  const labelClass = "block text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wide";

  if (loading) {
    return (
      <section className="mx-auto max-w-4xl space-y-6 p-6">
        <h1 className="font-heading text-2xl font-bold text-slate-800">Publish Article</h1>
        <div className="animate-pulse space-y-4">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-12 rounded-lg bg-gray-100" />)}
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-slate-800">Publish Article</h1>
        <p className="mt-1 text-sm text-slate-500">Fill in the details and publish the final article</p>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {/* Card header — journal filter + submission dropdown */}
        <div className="border-b border-slate-100 bg-slate-50 px-6 py-4">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="font-semibold text-slate-700 shrink-0">Load submission</h2>
            {/* journal filter */}
            <div className="relative">
              <select
                value={filterJournalId}
                onChange={(e) => { setFilterJournalId(e.target.value); setSubmissionId(""); setForm((p) => ({ ...p, volumeId: "", issueId: "", partId: "" })); }}
                className="h-9 appearance-none rounded-lg border border-slate-200 bg-white py-1 pl-3 pr-7 text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                {JOURNALS.map((j) => <option key={j.id} value={j.id}>{j.id}</option>)}
              </select>
              <ChevronDown size={12} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-400" />
            </div>
            {/* submission picker */}
            <div className="relative flex-1 min-w-[280px]">
              <select
                onChange={(e) => onSelectApproved(e.target.value)}
                value={submissionId}
                className="w-full appearance-none rounded-lg border border-slate-200 bg-white py-2 pl-3 pr-8 text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="">— Select approved submission —</option>
                {approvedOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <ChevronDown size={14} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-400" />
            </div>
          </div>
        </div>

        {/* Form body */}
        <div className="space-y-5 p-6">
          <div>
            <label className={labelClass}>Article Title <span className="text-red-400">*</span></label>
            <textarea
              value={form.title}
              onChange={(e) => setField("title", e.target.value)}
              placeholder="Enter full article title"
              rows={2}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500 resize-none"
            />
          </div>

          <div>
            <label className={labelClass}>Author Name <span className="text-red-400">*</span></label>
            <input
              type="text"
              value={form.authorName}
              onChange={(e) => setField("authorName", e.target.value)}
              placeholder="Author names separated by comma"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
            />
          </div>

          <div>
            <label className={labelClass}>Article Abstract <span className="text-red-400">*</span></label>
            <div className="overflow-hidden rounded-lg border border-slate-200">
              <JoditEditor ref={editorRef} value={form.abstract} config={joditConfig}
                onBlur={(c: string) => setField("abstract", c)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Keywords</label>
              <input value={form.keywords} onChange={(e) => setField("keywords", e.target.value)}
                placeholder="e.g. AI, Machine Learning" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Subject</label>
              <input value={form.subject} onChange={(e) => setField("subject", e.target.value)}
                placeholder="e.g. Computer Science" className={inputClass} />
            </div>
          </div>

          <div>
            <label className={labelClass}>Country</label>
            <input value={form.country} onChange={(e) => setField("country", e.target.value)}
              placeholder="Author's country" className={inputClass} />
          </div>

          {form.doi ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Existing DOI (minted earlier)</p>
              <p className="mt-1 font-mono text-sm text-slate-700">{form.doi}</p>
            </div>
          ) : null}

          <div className="rounded-xl border border-green-200 bg-green-50/50 p-4">
            <label className="flex cursor-pointer items-start gap-3">
              <input type="checkbox" checked={assignDoiOnPublish}
                onChange={(e) => setAssignDoiOnPublish(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-slate-300 text-green-600 focus:ring-green-500" />
              <span>
                <span className="text-sm font-semibold text-green-900">Generate &amp; assign DOI on publish</span>
                <span className="mt-0.5 block text-xs text-green-800">When checked, DOI is auto-generated and saved on publish.</span>
              </span>
            </label>
          </div>

          {/* Month + Year */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Month</label>
              <select value={form.month} onChange={(e) => setField("month", e.target.value)} className={inputClass}>
                <option value="">Select month</option>
                {MONTHS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Year <span className="text-red-400">*</span></label>
              <input value={form.year} onChange={(e) => setField("year", e.target.value)}
                placeholder="2026" className={inputClass} />
            </div>
          </div>

          {/* Volume + Issue + Part dropdowns + Page No */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <label className={labelClass}>Volume <span className="text-red-400">*</span></label>
              {volumes.length > 0 ? (
                <select value={form.volumeId}
                  onChange={(e) => setForm((p) => ({ ...p, volumeId: e.target.value, issueId: "", partId: "" }))}
                  className={inputClass}>
                  <option value="">Select</option>
                  {volumes.map((v) => <option key={v.id} value={String(v.id)}>Vol {v.number} ({v.year})</option>)}
                </select>
              ) : (
                <input value={form.volumeId} onChange={(e) => setField("volumeId", e.target.value)}
                  placeholder="No volumes — create in Volumes page" className={inputClass} />
              )}
            </div>
            <div>
              <label className={labelClass}>Issue <span className="text-red-400">*</span></label>
              <select value={form.issueId}
                onChange={(e) => setForm((p) => ({ ...p, issueId: e.target.value, partId: "" }))}
                className={inputClass} disabled={!selectedVolume}>
                <option value="">Select</option>
                {(selectedVolume?.issues ?? []).map((i) => (
                  <option key={i.id} value={String(i.id)}>
                    Issue {i.number}{i.period ? ` — ${i.period}` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Part <span className="text-red-400">*</span></label>
              <select value={form.partId} onChange={(e) => setField("partId", e.target.value)}
                className={inputClass} disabled={!selectedIssue}>
                <option value="">Select</option>
                {(selectedIssue?.parts ?? []).map((p) => (
                  <option key={p.id} value={String(p.id)}>{/^part\s/i.test(p.name) || /special\s*issue/i.test(p.name) ? p.name : `Part ${p.name}`}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Page No <span className="text-red-400">*</span></label>
              <input value={form.pageNo} onChange={(e) => setField("pageNo", e.target.value)}
                placeholder="e.g. 01-07" className={inputClass} />
            </div>
          </div>

          {/* Upload PDF */}
          <div>
            <label className={labelClass}>Upload Article PDF <span className="text-red-400">*</span></label>
            <label className="group flex cursor-pointer items-center gap-3 rounded-lg border-2 border-dashed border-slate-300 px-4 py-3 transition-colors hover:border-green-400 hover:bg-green-50">
              <Upload size={18} className="text-slate-400 group-hover:text-green-600" />
              <div>
                {pdfFile ? (
                  <div className="flex items-center gap-2">
                    <FileText size={14} className="text-green-600" />
                    <span className="text-sm font-medium text-green-700">{pdfFile.name}</span>
                    <span className="text-xs text-slate-400">({(pdfFile.size / 1024).toFixed(0)} KB)</span>
                  </div>
                ) : (
                  <span className="text-sm text-slate-400">Click to upload PDF file only</span>
                )}
              </div>
              <input type="file" accept="application/pdf" className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (file.type !== "application/pdf") { toast.error("Only PDF files are allowed"); return; }
                  if (file.size > 50 * 1024 * 1024) { toast.error("File too large. Maximum 50 MB."); return; }
                  setPdfFile(file);
                }} />
            </label>
          </div>

          {/* Reference No (article no) preview + DOI */}
          <div className={`grid gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 ${assignDoiOnPublish ? "grid-cols-2" : "grid-cols-1"}`}>
            <div>
              <label className={labelClass}>Reference No. (Auto)</label>
              <div className="font-mono text-2xl font-bold text-green-700">
                {articleNo ?? <span className="text-base font-normal text-slate-300">Select submission above</span>}
              </div>
            </div>
            {assignDoiOnPublish ? (
              <div>
                <label className={labelClass}>DOI Link (Auto)</label>
                {doiLink ? (
                  <a href={doiLink} target="_blank" rel="noopener noreferrer"
                    className="break-all font-mono text-sm text-blue-600 underline">{doiLink}</a>
                ) : (
                  <p className="text-xs text-slate-400">Select Volume, Issue, Part to generate</p>
                )}
              </div>
            ) : null}
          </div>

          {/* Add-ons summary */}
          {(() => {
            const sub = approvedList.find((s) => s.id === submissionId);
            const addons = sub?.addons;
            if (!addons || !Array.isArray(addons) || addons.length === 0) return null;
            const total = addons.reduce((s: number, a: { price: number }) => s + (a.price ?? 0), 0);
            return (
              <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-800">Add-on services selected</p>
                <div className="flex flex-wrap gap-2">
                  {addons.map((a: { id: string; label: string; price: number }) => (
                    <span key={a.id} className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-100 px-3 py-1 text-xs font-medium text-amber-900">
                      {a.label}
                      <span className="ml-1 font-mono text-amber-700">₹{a.price.toLocaleString("en-IN")}</span>
                    </span>
                  ))}
                </div>
                <p className="mt-2 text-xs font-semibold text-amber-800">Total add-ons: ₹{total.toLocaleString("en-IN")}</p>
              </div>
            );
          })()}

          {/* Actions */}
          <div className="flex gap-3 border-t border-slate-100 pt-5">
            <button type="button" onClick={() => void onPublish()} disabled={publishing}
              className="flex items-center gap-2 rounded-xl bg-green-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-green-700 disabled:opacity-50">
              {publishing ? (
                <><div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />Publishing...</>
              ) : "Publish Article"}
            </button>
            <button type="button"
              onClick={() => { setForm(INITIAL_FORM); setSubmissionId(""); setArticleNo(null); setAssignDoiOnPublish(false); setPdfFile(null); setVolumes([]); }}
              className="rounded-xl border border-slate-200 px-6 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50">
              Reset
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

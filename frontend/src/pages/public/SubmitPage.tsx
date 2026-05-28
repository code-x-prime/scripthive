import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { Loader2, Upload, UserCircle } from "lucide-react";
import { PublicNavbar } from "@/components/public/Navbar";
import { AuthAlert } from "@/components/author/AuthAlert";
import { useAuthorAuth } from "@/contexts/AuthorAuthContext";
import { journalService } from "@/services/journal.service";
import { parseApiError } from "@/utils/parseApiError";
import { isValidEmail } from "@/utils/passwordPolicy";
import type { Journal } from "@/types";

export const SubmitPage = () => {
  const navigate = useNavigate();
  const { author, isAuthenticated } = useAuthorAuth();
  const [journals, setJournals] = useState<Journal[]>([]);
  const [loadingJournals, setLoadingJournals] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [journalId, setJournalId] = useState("");
  const [title, setTitle] = useState("");
  const [authorName, setAuthorName] = useState("");
  const [authorEmail, setAuthorEmail] = useState("");
  const [authorPhone, setAuthorPhone] = useState("");
  const [coAuthors, setCoAuthors] = useState("");
  const [affiliations, setAffiliations] = useState("");
  const [abstract, setAbstract] = useState("");
  const [keywords, setKeywords] = useState("");
  const [articleType, setArticleType] = useState("Research");
  const [country, setCountry] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [authorSeed, setAuthorSeed] = useState<string | null>(null);

  if (isAuthenticated && author) {
    if (author.id !== authorSeed) {
      setAuthorSeed(author.id);
      setAuthorName(author.name);
      setAuthorEmail(author.email);
      setAuthorPhone(author.phone ?? "");
      setCountry(author.country ?? "");
      setAffiliations(author.affiliations ?? "");
    }
  } else if (authorSeed !== null) {
    setAuthorSeed(null);
  }

  useEffect(() => {
    let cancelled = false;
    void journalService
      .list()
      .then((rows) => {
        if (!cancelled) setJournals(rows);
      })
      .catch(() => {
        if (!cancelled) toast.error("Could not load journals");
      })
      .finally(() => {
        if (!cancelled) setLoadingJournals(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const onPickFile = (f: File | null) => {
    if (!f) { setFile(null); return; }
    if (f.type !== "application/pdf" || !f.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Please upload a PDF file only.");
      setFile(null);
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      toast.error("File too large. Maximum size is 10 MB.");
      setFile(null);
      return;
    }
    setFile(f);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!journalId.trim()) {
      setFormError("Please select a journal.");
      return;
    }
    if (!title.trim() || !authorName.trim() || !abstract.trim() || !keywords.trim()) {
      setFormError("Please fill in title, author name, abstract, and keywords.");
      return;
    }
    if (!authorEmail.trim() || !isValidEmail(authorEmail)) {
      setFormError("Enter a valid author email address.");
      return;
    }
    if (!file) {
      setFormError("Please attach your manuscript as a PDF.");
      return;
    }

    const fd = new FormData();
    fd.append("journalId", journalId.trim());
    fd.append("title", title.trim());
    fd.append("authorName", authorName.trim());
    fd.append("authorEmail", authorEmail.trim().toLowerCase());
    fd.append("abstract", abstract.trim());
    fd.append("keywords", keywords.trim());
    if (authorPhone.trim()) fd.append("authorPhone", authorPhone.trim());
    if (coAuthors.trim()) fd.append("coAuthors", coAuthors.trim());
    if (affiliations.trim()) fd.append("affiliations", affiliations.trim());
    if (articleType.trim()) fd.append("articleType", articleType.trim());
    if (country.trim()) fd.append("country", country.trim());
    fd.append("manuscript", file);

    setSubmitting(true);
    try {
      const res = await fetch("/api/submissions", { method: "POST", body: fd });
      const body = (await res.json().catch(() => ({}))) as { submissionId?: string; id?: string; message?: string };
      if (!res.ok) {
        throw new Error(await parseApiError(res, body.message ?? "Submission failed"));
      }
      const sid = body.submissionId ?? body.id;
      if (!sid) throw new Error("No submission ID returned from server");

      toast.success("Manuscript submitted successfully");
      navigate(
        { pathname: "/submit/success", search: `?id=${encodeURIComponent(sid)}` },
        {
          replace: true,
          state: {
            authorName: authorName.trim(),
            title: title.trim(),
            authorEmail: authorEmail.trim().toLowerCase(),
            submittedAt: new Date().toISOString()
          }
        }
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Submission failed";
      setFormError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <PublicNavbar />
      <div className="mx-auto max-w-3xl px-6 py-10">
        <div className="mb-6 text-xs text-gray-400">
          <Link to="/journals" className="hover:text-green-600">
            Journals
          </Link>{" "}
          / <span className="text-gray-600">Submit paper</span>
        </div>

        {isAuthenticated && author ? (
          <div className="mb-6 flex flex-col gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-sm text-green-900">
              <UserCircle className="h-5 w-5 shrink-0" />
              Signed in as <strong>{author.name}</strong> — this submission will appear in your author dashboard.
            </div>
            <Link
              to="/author/submit"
              className="text-sm font-medium text-green-700 hover:underline"
            >
              Use author portal →
            </Link>
          </div>
        ) : (
          <div className="mb-6 rounded-xl border border-gray-100 bg-white px-4 py-3 text-sm text-gray-600">
            Have an account?{" "}
            <Link to="/author/login" className="font-medium text-green-600 hover:underline">
              Sign in
            </Link>{" "}
            to track all submissions in one place.
          </div>
        )}

        <form
          onSubmit={(e) => void handleSubmit(e)}
          className="space-y-6 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm md:p-8"
        >
          <div className="border-b border-gray-100 pb-4">
            <h1 className="font-display text-2xl font-semibold text-gray-900 md:text-3xl">Submit your manuscript</h1>
            <p className="mt-1 text-sm text-gray-500">
              Real submission to the editorial office — you will receive a tracking ID and confirmation email.
            </p>
          </div>

          <AuthAlert message={formError} title="Could not submit" />

          <section className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Manuscript</h2>

            <label className="block text-sm font-medium text-gray-700">
              Journal *
              {loadingJournals ? (
                <div className="mt-2 flex items-center gap-2 text-sm text-gray-500">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading journals from database…
                </div>
              ) : (
                <select
                  value={journalId}
                  onChange={(e) => setJournalId(e.target.value)}
                  className="mt-1 h-11 w-full rounded-lg border border-gray-200 px-3 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                  required
                >
                  <option value="">Select a journal</option>
                  {journals.map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.id} — {j.name}
                    </option>
                  ))}
                </select>
              )}
            </label>

            <label className="block text-sm font-medium text-gray-700">
              Paper title *
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Title of your paper"
                className="mt-1 h-11 w-full rounded-lg border border-gray-200 px-3 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                required
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-medium text-gray-700">
                Article type
                <select
                  value={articleType}
                  onChange={(e) => setArticleType(e.target.value)}
                  className="mt-1 h-11 w-full rounded-lg border border-gray-200 px-3 text-sm"
                >
                  <option value="Research">Research</option>
                  <option value="Review">Review</option>
                  <option value="Case Study">Case Study</option>
                </select>
              </label>
              <label className="block text-sm font-medium text-gray-700">
                Country (optional)
                <input
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  placeholder="e.g. India"
                  className="mt-1 h-11 w-full rounded-lg border border-gray-200 px-3 text-sm"
                />
              </label>
            </div>

            <label className="block text-sm font-medium text-gray-700">
              Abstract *
              <textarea
                value={abstract}
                onChange={(e) => setAbstract(e.target.value)}
                rows={6}
                placeholder="Paste or type your abstract"
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                required
              />
            </label>

            <label className="block text-sm font-medium text-gray-700">
              Keywords *
              <input
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                placeholder="keyword1, keyword2, keyword3"
                className="mt-1 h-11 w-full rounded-lg border border-gray-200 px-3 text-sm"
                required
              />
            </label>

            <label className="block text-sm font-medium text-gray-700">
              Manuscript (PDF only) *
              <div className="mt-2 flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 bg-gray-50/50 px-4 py-8 hover:border-green-300 hover:bg-green-50/30">
                <Upload className="h-8 w-8 text-gray-400" />
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
                  className="mt-3 max-w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-green-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-green-800"
                  required
                />
                {file ? (
                  <p className="mt-2 text-xs font-medium text-green-700">{file.name}</p>
                ) : (
                  <p className="mt-2 text-xs text-gray-400">Maximum one PDF file</p>
                )}
              </div>
            </label>
          </section>

          <section className="space-y-4 border-t border-gray-100 pt-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Author details</h2>

            <label className="block text-sm font-medium text-gray-700">
              Corresponding author name *
              <input
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
                className="mt-1 h-11 w-full rounded-lg border border-gray-200 px-3 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                required
              />
            </label>

            <label className="block text-sm font-medium text-gray-700">
              Author email *
              <input
                type="email"
                value={authorEmail}
                onChange={(e) => setAuthorEmail(e.target.value)}
                placeholder="you@university.edu"
                className="mt-1 h-11 w-full rounded-lg border border-gray-200 px-3 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                required
              />
            </label>

            <label className="block text-sm font-medium text-gray-700">
              Phone (optional)
              <input
                value={authorPhone}
                onChange={(e) => setAuthorPhone(e.target.value)}
                className="mt-1 h-11 w-full rounded-lg border border-gray-200 px-3 text-sm"
              />
            </label>

            <label className="block text-sm font-medium text-gray-700">
              Co-authors (optional)
              <input
                value={coAuthors}
                onChange={(e) => setCoAuthors(e.target.value)}
                placeholder="Name1; Name2"
                className="mt-1 h-11 w-full rounded-lg border border-gray-200 px-3 text-sm"
              />
            </label>

            <label className="block text-sm font-medium text-gray-700">
              Affiliation (optional)
              <textarea
                value={affiliations}
                onChange={(e) => setAffiliations(e.target.value)}
                rows={2}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              />
            </label>
          </section>

          <button
            type="submit"
            disabled={submitting || loadingJournals}
            className="h-12 w-full rounded-lg bg-green-600 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:px-10"
          >
            {submitting ? "Submitting…" : "Submit manuscript"}
          </button>
        </form>
      </div>
    </div>
  );
};

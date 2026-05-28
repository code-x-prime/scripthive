import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import { Loader2 } from "lucide-react";
import { authorService } from "@/services/author.service";
import { parseApiError } from "@/utils/parseApiError";

export function AuthorEditSubmissionPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [abstract, setAbstract] = useState("");
  const [keywords, setKeywords] = useState("");
  const [coAuthors, setCoAuthors] = useState("");
  const [country, setCountry] = useState("");
  const [affiliations, setAffiliations] = useState("");
  const [articleType, setArticleType] = useState("Research");
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    if (!id) return;
    void (async () => {
      try {
        const row = await authorService.getSubmission(id);
        if (row.status !== "Pending") {
          toast.error("Only pending submissions can be edited");
          navigate(`/author/submissions/${id}`, { replace: true });
          return;
        }
        setTitle(row.title);
        setAbstract(stripHtml(row.abstract));
        setKeywords(row.keywords);
        setCoAuthors(row.coAuthors ?? "");
        setCountry(row.country ?? "");
        setAffiliations(row.affiliations ?? "");
        setArticleType(row.articleType ?? "Research");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Not found");
        navigate("/author/dashboard", { replace: true });
      } finally {
        setLoading(false);
      }
    })();
  }, [id, navigate]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !title.trim() || !abstract.trim() || !keywords.trim()) {
      toast.error("Title, abstract, and keywords are required");
      return;
    }
    const fd = new FormData();
    fd.append("title", title.trim());
    fd.append("abstract", abstract.trim());
    fd.append("keywords", keywords.trim());
    if (coAuthors.trim()) fd.append("coAuthors", coAuthors.trim());
    if (country.trim()) fd.append("country", country.trim());
    if (affiliations.trim()) fd.append("affiliations", affiliations.trim());
    fd.append("articleType", articleType);
    if (file) fd.append("manuscript", file);

    setSaving(true);
    try {
      const res = await authorService.updateSubmission(id, fd);
      if (!res.ok) throw new Error(await parseApiError(res));
      toast.success("Submission updated");
      navigate(`/author/submissions/${id}`, { replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-2xl border border-gray-100 bg-white p-12 text-sm text-gray-500 shadow-sm">
        <Loader2 className="h-5 w-5 animate-spin text-green-600" /> Loading…
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
      <div>
        <Link to={`/author/submissions/${id}`} className="text-sm text-green-600 hover:underline">
          ← Back to submission
        </Link>
        <h2 className="mt-2 font-display text-xl font-semibold text-gray-900">Edit submission</h2>
        <p className="text-sm text-gray-500">Only pending manuscripts can be changed</p>
      </div>

      <label className="block text-sm font-medium text-gray-700">
        Title *
        <input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" required />
      </label>

      <label className="block text-sm font-medium text-gray-700">
        Abstract *
        <textarea value={abstract} onChange={(e) => setAbstract(e.target.value)} rows={6} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" required />
      </label>

      <label className="block text-sm font-medium text-gray-700">
        Keywords *
        <input value={keywords} onChange={(e) => setKeywords(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" required />
      </label>

      <label className="block text-sm font-medium text-gray-700">
        Co-authors
        <input value={coAuthors} onChange={(e) => setCoAuthors(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium text-gray-700">
          Country
          <input value={country} onChange={(e) => setCountry(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
        </label>
        <label className="block text-sm font-medium text-gray-700">
          Article type
          <select value={articleType} onChange={(e) => setArticleType(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm">
            <option value="Research">Research</option>
            <option value="Review">Review</option>
            <option value="Case Study">Case Study</option>
          </select>
        </label>
      </div>

      <label className="block text-sm font-medium text-gray-700">
        Affiliation
        <textarea value={affiliations} onChange={(e) => setAffiliations(e.target.value)} rows={2} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
      </label>

      <label className="block text-sm font-medium text-gray-700">
        Replace manuscript (optional PDF)
        <input type="file" accept="application/pdf,.pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="mt-1 block w-full text-sm" />
      </label>

      <button type="submit" disabled={saving} className="rounded-lg bg-green-600 px-8 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60">
        {saving ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

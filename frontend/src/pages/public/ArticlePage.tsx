import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ExternalLink, FileText } from "lucide-react";
import { PublicNavbar } from "@/components/public/Navbar";
import { ArchiveBreadcrumb } from "@/components/public/ArchiveBreadcrumb";
import { archiveService, type ArchiveArticleResponse } from "@/services/archive.service";
import { journalArchivePath, issueArchivePath } from "@/utils/archiveUrls";

export const ArticlePage = () => {
  const { journalSlug, volumeIssueSlug, articleSlug } = useParams<{
    journalSlug: string;
    volumeIssueSlug: string;
    articleSlug: string;
  }>();

  const [data, setData] = useState<ArchiveArticleResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!journalSlug || !volumeIssueSlug || !articleSlug) return;
    queueMicrotask(() => setLoading(true));
    archiveService
      .getArticle(journalSlug, volumeIssueSlug, articleSlug)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Article not found"))
      .finally(() => setLoading(false));
  }, [journalSlug, volumeIssueSlug, articleSlug]);

  const journalId = data?.journal.id ?? journalSlug?.toUpperCase() ?? "";
  const vi = data?.volumeIssue;

  const crumbs = data
    ? [
        { label: "Journals", to: "/journals" },
        { label: data.journal.name, to: `/journals/${journalSlug}` },
        { label: "Archive", to: journalArchivePath(journalId) },
        ...(vi
          ? [{ label: vi.label, to: issueArchivePath(journalId, vi.volume, vi.issue) }]
          : []),
        { label: data.article.title }
      ]
    : [{ label: "Journals", to: "/journals" }, { label: "Article" }];

  return (
    <div className="min-h-screen bg-gray-50">
      <PublicNavbar />

      <article className="mx-auto max-w-3xl px-6 py-10">
        <ArchiveBreadcrumb items={crumbs} />

        {loading ? (
          <div className="animate-pulse space-y-4">
            <div className="h-8 w-3/4 rounded bg-gray-200" />
            <div className="h-4 w-1/2 rounded bg-gray-200" />
          </div>
        ) : error || !data ? (
          <p className="text-red-600">{error ?? "Article not found"}</p>
        ) : (
          <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
            {vi ? (
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-green-700">{vi.label}</p>
            ) : null}

            <h1 className="font-display text-2xl font-bold leading-snug text-gray-900">{data.article.title}</h1>
            <p className="mt-3 text-gray-700">{data.article.authorName}</p>

            <dl className="mt-6 grid gap-3 border-t border-gray-100 pt-6 text-sm sm:grid-cols-2">
              {data.article.pages ? (
                <div>
                  <dt className="text-xs font-semibold uppercase text-gray-400">Pages</dt>
                  <dd className="mt-0.5 text-gray-800">{data.article.pages}</dd>
                </div>
              ) : null}
              {data.article.doi ? (
                <div>
                  <dt className="text-xs font-semibold uppercase text-gray-400">DOI</dt>
                  <dd className="mt-0.5">
                    <a
                      href={data.article.doi}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-mono text-sm text-blue-600 hover:underline"
                    >
                      {data.article.doi.replace(/^https?:\/\/(www\.)?doi\.org\//i, "")}
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </dd>
                </div>
              ) : null}
            </dl>

            <div className="mt-6 flex flex-wrap gap-3">
              {data.article.pdfUrl ? (
                <a
                  href={data.article.pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-green-700"
                >
                  <FileText className="h-4 w-4" /> Download PDF
                </a>
              ) : null}
              {vi ? (
                <Link
                  to={issueArchivePath(journalId, vi.volume, vi.issue)}
                  className="inline-flex items-center rounded-lg border border-gray-200 px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Back to issue
                </Link>
              ) : null}
            </div>

            {data.article.abstract ? (
              <section className="mt-8 border-t border-gray-100 pt-8">
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Abstract</h2>
                <div
                  className="prose prose-sm max-w-none text-gray-700"
                  dangerouslySetInnerHTML={{ __html: data.article.abstract }}
                />
              </section>
            ) : null}

            {data.article.keywords ? (
              <p className="mt-6 text-sm text-gray-500">
                <span className="font-semibold text-gray-600">Keywords: </span>
                {data.article.keywords}
              </p>
            ) : null}

            <p className="mt-8 font-mono text-[11px] text-gray-400">
              Permanent URL: /journals/{journalSlug}/archive/{volumeIssueSlug}/{articleSlug}
            </p>
          </div>
        )}
      </article>
    </div>
  );
};

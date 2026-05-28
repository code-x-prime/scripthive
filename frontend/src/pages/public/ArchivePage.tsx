import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { PublicNavbar } from "@/components/public/Navbar";
import { ArchiveBreadcrumb } from "@/components/public/ArchiveBreadcrumb";
import { IssueArticlesTable } from "@/components/public/IssueArticlesTable";
import {
  archiveService,
  type ArchiveIndexResponse,
  type ArchiveIssueResponse
} from "@/services/archive.service";
import { issueArchivePath, journalArchivePath } from "@/utils/archiveUrls";

/** Public archive — no admin layout */
export const ArchivePage = () => {
  const { code, volumeIssueSlug } = useParams<{ code: string; volumeIssueSlug?: string }>();
  const journalSlugParam = code?.toLowerCase() ?? "";

  const [indexData, setIndexData] = useState<ArchiveIndexResponse | null>(null);
  const [issueData, setIssueData] = useState<ArchiveIssueResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!journalSlugParam) return;
    queueMicrotask(() => {
      setLoading(true);
      setError(null);
    });

    if (volumeIssueSlug) {
      archiveService
        .getIssue(journalSlugParam, volumeIssueSlug)
        .then(setIssueData)
        .catch((e) => setError(e instanceof Error ? e.message : "Failed to load issue"))
        .finally(() => setLoading(false));
    } else {
      archiveService
        .getIndex(journalSlugParam)
        .then(setIndexData)
        .catch((e) => setError(e instanceof Error ? e.message : "Failed to load archive"))
        .finally(() => setLoading(false));
    }
  }, [journalSlugParam, volumeIssueSlug]);

  const journal = issueData?.journal ?? indexData?.journal;
  const journalId = journal?.id ?? code?.toUpperCase() ?? "";

  const crumbs = volumeIssueSlug && issueData
    ? [
        { label: "Journals", to: "/journals" },
        { label: journal?.name ?? journalId, to: `/journals/${journalSlugParam}` },
        { label: "Archive", to: journalArchivePath(journalId) },
        { label: issueData.headerLabel ?? issueData.label }
      ]
    : [
        { label: "Journals", to: "/journals" },
        { label: journal?.name ?? journalId, to: `/journals/${journalSlugParam}` },
        { label: "Archive" }
      ];

  return (
    <div className="min-h-screen bg-white">
      <PublicNavbar />

      <section className="border-b border-gray-200 bg-gradient-to-b from-green-50/80 to-white px-4 py-8 sm:px-6 sm:py-10">
        <div className="mx-auto max-w-5xl">
          <ArchiveBreadcrumb items={crumbs} />
          <h1 className="mt-4 text-center font-serif text-2xl font-bold text-gray-900 sm:text-3xl">
            {issueData ? (issueData.headerLabel ?? issueData.label) : `${journal?.name ?? journalId}`}
          </h1>
          {!volumeIssueSlug && indexData?.journal ? (
            <p className="mt-2 text-center text-sm text-gray-600">
              Browse published volumes and issues ·{" "}
              {indexData.journal.issn ? `ISSN ${indexData.journal.issn}` : journalId}
            </p>
          ) : null}
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        {loading ? (
          <div className="animate-pulse space-y-3">
            <div className="h-12 rounded bg-gray-100" />
            <div className="h-40 rounded bg-gray-50" />
            <div className="h-40 rounded bg-gray-50" />
          </div>
        ) : error ? (
          <p className="text-center text-red-600">{error}</p>
        ) : issueData ? (
          <IssueArticlesTable
            journalId={journalId}
            volume={issueData.volume}
            issue={issueData.issue}
            articles={issueData.articles}
          />
        ) : indexData ? (
          <div className="space-y-4">
            {indexData.issues.length === 0 ? (
              <p className="rounded-lg border border-dashed border-gray-300 py-12 text-center text-sm text-gray-500">
                No published issues yet.
              </p>
            ) : (
              indexData.issues.map((iss) => (
                <Link
                  key={iss.slug}
                  to={issueArchivePath(journalId, iss.volume, iss.issue)}
                  className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-4 shadow-sm transition hover:border-green-300 hover:shadow-md sm:px-6"
                >
                  <div>
                    <p className="font-serif text-lg font-semibold text-gray-900">
                      {iss.headerLabel ?? iss.label}
                    </p>
                    <p className="mt-1 text-sm text-gray-500">
                      {iss.articleCount} article{iss.articleCount === 1 ? "" : "s"}
                    </p>
                  </div>
                  <ChevronRight className="h-5 w-5 shrink-0 text-green-600" />
                </Link>
              ))
            )}
          </div>
        ) : null}
      </section>
    </div>
  );
};

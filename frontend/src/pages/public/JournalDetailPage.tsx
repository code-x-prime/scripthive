import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Archive, BookOpen, ChevronRight } from "lucide-react";
import { PublicNavbar } from "@/components/public/Navbar";
import { ArchiveBreadcrumb } from "@/components/public/ArchiveBreadcrumb";
import { journalService } from "@/services/journal.service";
import { journalArchivePath } from "@/utils/archiveUrls";
import type { Journal } from "@/types";

export const JournalDetailPage = () => {
  const { code } = useParams<{ code: string }>();
  const [journal, setJournal] = useState<Journal | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const journalId = code?.trim().toUpperCase() ?? "";

  useEffect(() => {
    if (!journalId) return;
    queueMicrotask(() => setLoading(true));
    journalService
      .get(journalId)
      .then(setJournal)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load journal"))
      .finally(() => setLoading(false));
  }, [journalId]);

  return (
    <div className="min-h-screen bg-gray-50">
      <PublicNavbar />

      <section className="bg-green-800 px-6 py-12">
        <div className="mx-auto max-w-4xl">
          <ArchiveBreadcrumb
            items={[
              { label: "Journals", to: "/journals" },
              { label: journal?.name ?? (journalId || "Journal") }
            ]}
          />
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-white/10">
              <BookOpen className="h-7 w-7 text-white" />
            </div>
            <div>
              <p className="font-mono text-xs font-bold uppercase tracking-wider text-green-200">{journalId}</p>
              <h1 className="font-display text-2xl font-bold text-white md:text-3xl">
                {journal?.name ?? "ScriptHive Journal"}
              </h1>
              {journal?.issn || journal?.eIssn ? (
                <p className="mt-2 text-sm text-green-100">
                  {journal.issn ? <>ISSN: {journal.issn}</> : null}
                  {journal.issn && journal.eIssn ? " · " : null}
                  {journal.eIssn ? <>e-ISSN: {journal.eIssn}</> : null}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-6 py-10">
        {loading ? (
          <div className="animate-pulse space-y-3">
            <div className="h-4 w-2/3 rounded bg-gray-200" />
            <div className="h-4 w-full rounded bg-gray-200" />
          </div>
        ) : error ? (
          <p className="text-red-600">{error}</p>
        ) : (
          <>
            {journal?.description ? (
              <p className="mb-8 text-sm leading-relaxed text-gray-600">{journal.description}</p>
            ) : null}

            <Link
              to={journalArchivePath(journalId)}
              className="group flex items-center justify-between rounded-2xl border border-green-200 bg-white p-6 shadow-sm transition hover:border-green-400 hover:shadow-md"
            >
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-50">
                  <Archive className="h-6 w-6 text-green-700" />
                </div>
                <div>
                  <h2 className="font-semibold text-gray-900 group-hover:text-green-800">Journal Archive</h2>
                  <p className="text-sm text-gray-500">
                    Browse volumes, issues, and published articles with permanent links
                  </p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-green-600" />
            </Link>
          </>
        )}
      </section>
    </div>
  );
};

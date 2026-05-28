import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen, ChevronRight, Search } from "lucide-react";
import { PublicNavbar } from "@/components/public/Navbar";
import { journalService } from "@/services/journal.service";
import { journalArchivePath } from "@/utils/archiveUrls";
import type { Journal } from "@/types";

type PublicJournal = Journal & { slug?: string; publishedCount?: number };

const JOURNAL_ACCENTS: Record<string, { card: string; badge: string; icon: string }> = {
  SGJVSR: { card: "hover:border-amber-300", badge: "border-amber-200 bg-amber-50 text-amber-800", icon: "bg-amber-100" },
  SGMRJ: { card: "hover:border-blue-300", badge: "border-blue-200 bg-blue-50 text-blue-800", icon: "bg-blue-100" },
  SGJPLS: { card: "hover:border-purple-300", badge: "border-purple-200 bg-purple-50 text-purple-800", icon: "bg-purple-100" },
  SGJETR: { card: "hover:border-orange-300", badge: "border-orange-200 bg-orange-50 text-orange-800", icon: "bg-orange-100" },
  SGJSSH: { card: "hover:border-rose-300", badge: "border-rose-200 bg-rose-50 text-rose-800", icon: "bg-rose-100" },
  SGJASH: { card: "hover:border-teal-300", badge: "border-teal-200 bg-teal-50 text-teal-800", icon: "bg-teal-100" }
};

const DEFAULT_ACCENT = {
  card: "hover:border-green-300",
  badge: "border-green-200 bg-green-50 text-green-800",
  icon: "bg-green-100"
};

export const JournalsPage = () => {
  const [journals, setJournals] = useState<PublicJournal[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    queueMicrotask(() => {
      void (async () => {
        setLoading(true);
        try {
          const rows = await journalService.list();
          setJournals(rows);
        } catch {
          setJournals([]);
        } finally {
          setLoading(false);
        }
      })();
    });
  }, []);

  const filtered = journals.filter((journal) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      journal.name.toLowerCase().includes(q) ||
      journal.id.toLowerCase().includes(q) ||
      (journal.scope?.toLowerCase().includes(q) ?? false) ||
      (journal.description?.toLowerCase().includes(q) ?? false)
    );
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <PublicNavbar />

      <section className="bg-green-800 px-4 py-12 sm:px-6 sm:py-16">
        <div className="mx-auto max-w-4xl text-center">
          <h1 className="mb-3 font-display text-3xl font-bold text-white sm:text-4xl">Our Journals</h1>
          <p className="mb-8 text-sm text-green-100 sm:text-base">
            Peer-reviewed open-access journals — browse archives, DOI, and full-text PDFs
          </p>
          <div className="relative mx-auto max-w-md">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search journals..."
              className="w-full rounded-xl bg-white py-3 pl-10 pr-4 text-sm text-gray-800 outline-none ring-2 ring-transparent focus:ring-green-300"
            />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {[1, 2, 3, 4].map((k) => (
              <div key={k} className="h-40 animate-pulse rounded-2xl bg-gray-200" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-gray-500">
            <BookOpen className="mx-auto mb-3 h-12 w-12 opacity-30" />
            <p>No journals match your search.</p>
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2">
            {filtered.map((journal) => {
              const accent = JOURNAL_ACCENTS[journal.id] ?? DEFAULT_ACCENT;
              const slug = journal.slug ?? journal.id.toLowerCase();
              return (
                <article
                  key={journal.id}
                  className={`rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition sm:p-7 ${accent.card}`}
                >
                  <div className="flex items-start gap-4">
                    <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${accent.icon}`}>
                      <BookOpen className="h-5 w-5 text-gray-700" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className={`inline-block rounded border px-2 py-0.5 font-mono text-[11px] font-bold ${accent.badge}`}>
                        {journal.id}
                      </span>
                      <h2 className="mt-2 font-display text-base font-semibold leading-snug text-gray-900 sm:text-lg">
                        {journal.name}
                      </h2>
                      {journal.scope || journal.description ? (
                        <p className="mt-2 line-clamp-2 text-xs text-gray-500 sm:text-sm">
                          {journal.scope ?? journal.description}
                        </p>
                      ) : null}
                      <p className="mt-2 text-xs text-gray-400">
                        {journal.issn ? <>ISSN {journal.issn}</> : null}
                        {journal.issn && journal.eIssn ? " · " : null}
                        {journal.eIssn ? <>e-ISSN {journal.eIssn}</> : null}
                        {(journal.publishedCount ?? 0) > 0 ? (
                          <span className="ml-2 text-green-700">{journal.publishedCount} published</span>
                        ) : null}
                      </p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Link
                          to={`/journals/${slug}`}
                          className="inline-flex items-center rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                        >
                          Journal home
                        </Link>
                        <Link
                          to={journalArchivePath(journal.id)}
                          className="inline-flex items-center gap-1 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700"
                        >
                          View archive <ChevronRight className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};

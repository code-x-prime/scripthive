import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { ChevronDown, ChevronRight, Download, ExternalLink, FileText, Globe } from "lucide-react";
import { Link } from "react-router-dom";
import { apiJson } from "@/services/api";
import type { Submission } from "@/types";
import { articleArchivePath, issueArchivePath, journalArchivePath } from "@/utils/archiveUrls";
import { submissionAuthorsDisplay } from "@/utils/submissionAuthors";

interface VolumeIssueGroup {
  volNum: number;
  volYear: number;
  issueNum: number;
  articles: Submission[];
}

interface JournalGroup {
  journalId: string;
  journalName: string;
  groups: VolumeIssueGroup[];
  ungrouped: Submission[];
}

function padPage(n: number | null | undefined): string {
  if (n == null) return "??";
  return n < 10 ? `0${n}` : String(n);
}

function buildGroups(rows: Submission[]): JournalGroup[] {
  const journalMap = new Map<string, { name: string; subs: Submission[] }>();

  for (const s of rows) {
    const jid = s.journal?.id ?? s.journalId;
    const jname = s.journal?.name ?? jid;
    if (!journalMap.has(jid)) journalMap.set(jid, { name: jname, subs: [] });
    journalMap.get(jid)!.subs.push(s);
  }

  const result: JournalGroup[] = [];
  for (const [jid, { name, subs }] of [...journalMap.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const viMap = new Map<string, VolumeIssueGroup>();
    const ungrouped: Submission[] = [];

    for (const s of subs) {
      const vol = s.part?.issue?.volume;
      const iss = s.part?.issue;
      if (!vol || !iss) {
        ungrouped.push(s);
        continue;
      }
      const key = `${vol.number}-${iss.number}`;
      if (!viMap.has(key)) {
        viMap.set(key, { volNum: vol.number, volYear: vol.year, issueNum: iss.number, articles: [] });
      }
      viMap.get(key)!.articles.push(s);
    }

    const groups = [...viMap.values()].sort((a, b) => a.volNum - b.volNum || a.issueNum - b.issueNum);
    result.push({ journalId: jid, journalName: name, groups, ungrouped });
  }

  return result;
}

export const ArchivesAdminPage = () => {
  const [rows, setRows] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [openJournals, setOpenJournals] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await apiJson<Submission[]>("/archive/admin"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load archives");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  const journals = useMemo(() => buildGroups(rows), [rows]);

  const defaultOpen = useMemo(() => new Set(journals.map((j) => j.journalId)), [journals]);
  const effectiveOpen = openJournals.size > 0 ? openJournals : defaultOpen;

  const toggle = (jid: string) => {
    setOpenJournals((prev) => {
      const base = prev.size > 0 ? prev : defaultOpen;
      const next = new Set(base);
      if (next.has(jid)) {
        next.delete(jid);
      } else {
        next.add(jid);
      }
      return next;
    });
  };

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl text-gray-900">Archives</h1>
          <p className="mt-1 text-sm text-gray-500">Published articles grouped by Journal, Volume &amp; Issue.</p>
        </div>
        <Link
          to="/journals"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-2 text-sm font-medium text-green-800 hover:bg-green-100"
        >
          <Globe className="h-4 w-4" />
          Open public journal archives
        </Link>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="animate-pulse rounded-xl border border-gray-200 bg-white p-6">
              <div className="mb-4 h-6 w-48 rounded bg-gray-100" />
              <div className="space-y-3">
                <div className="h-4 w-full rounded bg-gray-100" />
                <div className="h-4 w-3/4 rounded bg-gray-100" />
                <div className="h-4 w-5/6 rounded bg-gray-100" />
              </div>
            </div>
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-200 bg-white py-12 text-center text-sm text-gray-500">
          No published articles yet.
        </p>
      ) : (
        <div className="space-y-4">
          {journals.map((j) => {
            const isOpen = effectiveOpen.has(j.journalId);
            return (
              <div key={j.journalId} className="rounded-xl border border-gray-200 bg-white shadow-sm">
                <button
                  type="button"
                  className="flex w-full items-center gap-3 px-6 py-4 text-left"
                  onClick={() => toggle(j.journalId)}
                >
                  {isOpen ? <ChevronDown className="h-5 w-5 text-green-600" /> : <ChevronRight className="h-5 w-5 text-gray-400" />}
                  <div className="flex-1">
                    <h2 className="font-heading text-lg text-gray-900">{j.journalId}</h2>
                    <p className="text-sm text-gray-500">{j.journalName}</p>
                    <Link
                      to={journalArchivePath(j.journalId)}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-green-700 hover:underline"
                    >
                      <Globe className="h-3 w-3" />
                      Public archive: /journals/{j.journalId.toLowerCase()}/archive
                    </Link>
                  </div>
                  <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
                    {j.groups.reduce((n, g) => n + g.articles.length, 0) + j.ungrouped.length} articles
                  </span>
                </button>

                {isOpen && (
                  <div className="border-t border-gray-100 px-6 pb-6 pt-4">
                    {j.groups.length === 0 && j.ungrouped.length === 0 && (
                      <p className="text-sm text-gray-400">No articles published yet.</p>
                    )}

                    {j.groups.map((g) => (
                      <div key={`${g.volNum}-${g.issueNum}`} className="mb-8 last:mb-0">
                        <div className="mb-4">
                          <h3 className="text-base font-semibold text-gray-800">
                            Vol. {g.volNum}, Issue {g.issueNum} ({g.volYear})
                          </h3>
                          <div className="mt-1 h-px bg-gray-200" />
                        </div>

                        <div className="space-y-5">
                          {g.articles.map((a, idx) => (
                            <ArticleCard key={a.id} article={a} sno={idx + 1} journalAbbr={j.journalId} group={g} />
                          ))}
                        </div>
                      </div>
                    ))}

                    {j.ungrouped.length > 0 && (
                      <div className="mb-8 last:mb-0">
                        <div className="mb-4">
                          <h3 className="text-base font-semibold text-gray-800">Unassigned to Volume/Issue</h3>
                          <div className="mt-1 h-px bg-gray-200" />
                        </div>
                        <div className="space-y-5">
                          {j.ungrouped.map((a, idx) => (
                            <ArticleCard key={a.id} article={a} sno={idx + 1} journalAbbr={j.journalId} group={null} />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};

function ArticleCard({
  article: a,
  sno,
  journalAbbr,
  group
}: {
  article: Submission;
  sno: number;
  journalAbbr: string;
  group: VolumeIssueGroup | null;
}) {
  const authors = submissionAuthorsDisplay(a);

  const citation = group
    ? `${journalAbbr}., ${group.volYear}; ${group.volNum}(${group.issueNum}): ${padPage(a.pageStart)}-${padPage(a.pageEnd)}`
    : null;

  const doiUrl = a.doiRecord?.doi ? `https://doi.org/${a.doiRecord.doi}` : null;
  const pdfPath = a.pdfPublicPath?.replace(/\\/g, "/");
  const downloadUrl = pdfPath
    ? pdfPath.includes("uploads/")
      ? `/${pdfPath.slice(pdfPath.indexOf("uploads/"))}`
      : `/uploads/manuscripts/${pdfPath.split("/").pop()}`
    : null;

  const publicArticleUrl =
    a.slug && group
      ? articleArchivePath(journalAbbr, group.volNum, group.issueNum, a.slug)
      : null;
  const publicIssueUrl = group
    ? issueArchivePath(journalAbbr, group.volNum, group.issueNum)
    : null;

  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50/50 px-5 py-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-100 text-xs font-bold text-green-700">
          {sno}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold leading-snug text-gray-900">
            {publicArticleUrl ? (
              <Link to={publicArticleUrl} target="_blank" rel="noopener noreferrer" className="hover:text-green-700 hover:underline">
                {a.title}
              </Link>
            ) : (
              a.title
            )}
          </p>
          <p className="mt-1 text-sm text-gray-700">{authors}</p>
          {(a.pageStart != null || a.pageEnd != null) && (
            <p className="mt-0.5 text-xs text-gray-500">
              pp. {String(a.pageStart ?? "").padStart(2, "0")}
              {a.pageEnd != null && a.pageEnd !== a.pageStart ? `–${String(a.pageEnd).padStart(2, "0")}` : ""}
            </p>
          )}
          {a.country && <p className="mt-0.5 text-xs text-gray-500">{a.country}</p>}

          {doiUrl && (
            <a
              className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-blue-700 underline decoration-blue-300 underline-offset-2 hover:text-blue-800"
              href={doiUrl}
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              {a.doiRecord!.doi}
            </a>
          )}

          {citation && (
            <p className="mt-2 text-xs italic text-gray-500">
              <span className="font-medium not-italic text-gray-600">Citation:</span> {citation}
            </p>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-gray-500">
            {a.abstract && (
              <details className="group">
                <summary className="cursor-pointer font-medium text-green-700 hover:text-green-800">
                  <FileText className="mr-1 inline h-3.5 w-3.5" />
                  Abstract
                </summary>
                <p className="mt-2 max-w-prose whitespace-pre-line text-sm leading-relaxed text-gray-700">{a.abstract}</p>
              </details>
            )}

            {downloadUrl ? (
              <a
                href={downloadUrl}
                className="inline-flex items-center gap-1 font-medium text-green-700 hover:text-green-800"
                target="_blank"
                rel="noreferrer"
              >
                <Download className="h-3.5 w-3.5" />
                PDF
              </a>
            ) : null}

            {publicArticleUrl ? (
              <Link
                to={publicArticleUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-medium text-blue-700 hover:text-blue-800"
              >
                <Globe className="h-3.5 w-3.5" />
                Public page
              </Link>
            ) : null}

            {publicIssueUrl ? (
              <Link
                to={publicIssueUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-medium text-gray-600 hover:text-gray-800"
              >
                View issue archive
              </Link>
            ) : null}

            {a.pubDate && (
              <span>Published: {new Date(a.pubDate).toLocaleDateString()}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

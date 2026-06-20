import { Link } from "react-router-dom";
import type { ArchiveArticleSummary } from "@/services/archive.service";
import { articleArchivePath } from "@/utils/archiveUrls";

async function trackAndDownload(articleId: string, pdfUrl: string) {
  try {
    await fetch(`/api/archive/download/${articleId}`, { method: "POST" });
  } catch { /* non-blocking */ }
  window.open(pdfUrl, "_blank");
}

function formatFileSize(kb: number | null | undefined): string {
  if (kb == null) return "";
  if (kb >= 1024) return `${(kb / 1024).toFixed(1)} MB`;
  return `${kb} KB`;
}

type IssueArticlesTableProps = {
  journalId: string;
  volume: number;
  issue: number;
  articles: ArchiveArticleSummary[];
};

export function IssueArticlesTable({ journalId, volume, issue, articles }: IssueArticlesTableProps) {
  if (articles.length === 0) {
    return (
      <p className="border border-gray-200 bg-white px-4 py-10 text-center text-sm text-gray-500">
        No published articles in this issue yet.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto border border-gray-300 bg-white shadow-sm">
      <table className="w-full min-w-[720px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-gray-300 bg-gray-50">
            <th className="w-14 border-r border-gray-200 px-3 py-2.5 text-center text-xs font-bold uppercase tracking-wide text-gray-700">
              S. No.
            </th>
            <th className="border-r border-gray-200 px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-gray-700">
              Title and Authors Name
            </th>
            <th className="w-28 px-3 py-2.5 text-center text-xs font-bold uppercase tracking-wide text-gray-700">
              Country
            </th>
          </tr>
        </thead>
        <tbody>
          {articles.map((article, idx) => {
            const sizeLabel = formatFileSize(article.fileSizeKb);
            const abstractHref = article.slug
              ? articleArchivePath(journalId, volume, issue, article.slug)
              : null;

            return (
              <tr key={article.id} className="border-b border-gray-200 align-top hover:bg-green-50/30">
                <td className="border-r border-gray-200 px-3 py-4 text-center font-medium text-gray-800">
                  {idx + 1}
                </td>
                <td className="border-r border-gray-200 px-4 py-4">
                  <p className="font-semibold leading-snug text-gray-900">
                    {article.slug ? (
                      <Link
                        to={articleArchivePath(journalId, volume, issue, article.slug)}
                        className="text-gray-900 hover:text-green-700 hover:underline"
                      >
                        {article.title}
                      </Link>
                    ) : (
                      article.title
                    )}
                  </p>
                  <p className="mt-2 text-gray-700">{article.authors ?? article.authorName}</p>
                  {article.doi ? (
                    <p className="mt-2 text-sm">
                      <span className="font-medium text-gray-600">DOI: </span>
                      <a
                        href={article.doi}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="break-all text-blue-700 underline hover:text-blue-900"
                      >
                        {article.doi}
                      </a>
                    </p>
                  ) : null}
                  {article.citation ? (
                    <p className="mt-1.5 text-sm italic text-gray-600">{article.citation}</p>
                  ) : null}
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                    {abstractHref ? (
                      <Link to={abstractHref} className="font-medium text-blue-700 underline hover:text-blue-900">
                        Abstract
                      </Link>
                    ) : null}
                    {article.pdfUrl ? (
                      <button
                        onClick={() => trackAndDownload(article.id, article.pdfUrl!)}
                        className="font-medium text-blue-700 underline hover:text-blue-900 cursor-pointer bg-transparent border-none p-0"
                      >
                        Download
                        {sizeLabel ? <span className="font-normal text-gray-600"> ({sizeLabel})</span> : null}
                      </button>
                    ) : (
                      <span className="text-gray-400">PDF not available</span>
                    )}
                    <span className="text-gray-600">
                      <span className="font-medium">Views:</span> {article.viewCount ?? 0}
                    </span>
                    <span className="text-gray-600">
                      <span className="font-medium">Downloads:</span> {article.downloadCount ?? 0}
                    </span>
                  </div>
                </td>
                <td className="px-3 py-4 text-center text-gray-800">{article.country ?? "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

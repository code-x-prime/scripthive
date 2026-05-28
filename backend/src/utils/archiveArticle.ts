import fs from "fs";
import path from "path";
import { formatArticleCitation, formatPages, pdfPublicUrl } from "./archiveSlug.js";

export function authorsDisplay(authorName: string, coAuthors: string | null): string {
  const parts: string[] = [];
  const primary = authorName?.trim();
  if (primary) parts.push(primary);
  const raw = coAuthors?.trim();
  if (raw) {
    for (const name of raw.split(/[,;\n|]+/)) {
      const t = name.trim();
      if (!t || t.toLowerCase() === "undefined") continue;
      if (!parts.some((p) => p.toLowerCase() === t.toLowerCase())) parts.push(t);
    }
  }
  return parts.length > 0 ? parts.join(", ") : "—";
}

export function pdfFileSizeKb(pdfPublicPath?: string | null): number | null {
  if (!pdfPublicPath) return null;
  try {
    const normalized = pdfPublicPath.replace(/\\/g, "/");
    const abs = path.isAbsolute(normalized) ? normalized : path.resolve(process.cwd(), normalized);
    if (!fs.existsSync(abs)) return null;
    return Math.max(1, Math.round(fs.statSync(abs).size / 1024));
  } catch {
    return null;
  }
}

type ArticleRow = {
  id: string;
  title: string;
  authorName: string;
  coAuthors: string | null;
  country: string | null;
  slug: string | null;
  pageStart: number | null;
  pageEnd: number | null;
  pubDate: Date | null;
  pdfPublicPath: string | null;
  abstract: string;
  keywords: string;
  viewCount: number;
  downloadCount: number;
  doiRecord: { doi: string | null; status: string } | null;
};

type ArticleContext = {
  journalId: string;
  volume: number;
  issue: number;
  year: number;
};

export function mapPublicArticle(row: ArticleRow, ctx: ArticleContext) {
  const pages = formatPages(row.pageStart, row.pageEnd);
  const doiRaw = row.doiRecord?.doi ?? null;
  const doiUrl = doiRaw
    ? doiRaw.startsWith("http")
      ? doiRaw
      : `https://doi.org/${doiRaw}`
    : null;

  return {
    id: row.id,
    title: row.title,
    authorName: row.authorName,
    coAuthors: row.coAuthors,
    authors: authorsDisplay(row.authorName, row.coAuthors),
    country: row.country?.trim() || "—",
    slug: row.slug,
    pages,
    pubDate: row.pubDate,
    pdfUrl: pdfPublicUrl(row.pdfPublicPath),
    fileSizeKb: pdfFileSizeKb(row.pdfPublicPath),
    doi: doiUrl,
    citation: formatArticleCitation(ctx.journalId, ctx.year, ctx.volume, ctx.issue, pages),
    viewCount: row.viewCount,
    downloadCount: row.downloadCount,
    abstract: row.abstract,
    keywords: row.keywords
  };
}

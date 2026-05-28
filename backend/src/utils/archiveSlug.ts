/** URL-safe slugs for public journal archive (ISSN-friendly permanent links). */

export const slugify = (text: string): string =>
  text
    .trim()
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120) || "article";

export const journalSlugFromId = (journalId: string): string => journalId.toLowerCase();

export const resolveJournalId = (slug: string): string => slug.trim().toUpperCase();

export const volumeIssueSlug = (volume: number, issue: number): string =>
  `volume-${volume}-issue-${issue}`;

export const parseVolumeIssueSlug = (
  slug: string
): { volume: number; issue: number } | null => {
  const m = /^volume-(\d+)-issue-(\d+)$/i.exec(slug.trim());
  if (!m) return null;
  return { volume: parseInt(m[1]!, 10), issue: parseInt(m[2]!, 10) };
};

export const formatPages = (pageStart?: number | null, pageEnd?: number | null): string | null => {
  if (pageStart == null) return null;
  if (pageEnd != null && pageEnd !== pageStart) {
    return `${String(pageStart).padStart(2, "0")}-${String(pageEnd).padStart(2, "0")}`;
  }
  return String(pageStart).padStart(2, "0");
};

export const formatIssueLabel = (
  volume: number,
  issue: number,
  year?: number | null,
  period?: string | null
): string => {
  const datePart = period && year ? ` (${period} ${year})` : year ? ` (${year})` : "";
  return `Volume ${volume} Issue ${issue}${datePart}`;
};

/** Public issue page heading, e.g. Vol. 8, Issue 5 (2026) */
export const formatVolIssueHeader = (volume: number, issue: number, year?: number | null): string =>
  year != null ? `Vol. ${volume}, Issue ${issue} (${year})` : `Vol. ${volume}, Issue ${issue}`;

const JOURNAL_CITATION_ABBREV: Record<string, string> = {
  SGJVSR: "Int. J. Vedic Sanskrit Res.",
  SGMRJ: "Int. J. Multidiscip. Res.",
  SGJPLS: "Int. J. Phys. Life Sci.",
  SGJETR: "Int. J. Eng. Technol. Res.",
  SGJSSH: "Int. J. Soc. Sci. Humanit.",
  SGJASH: "Int. J. Appl. Sci. Health"
};

export const journalCitationAbbrev = (journalId: string): string =>
  JOURNAL_CITATION_ABBREV[journalId.toUpperCase()] ?? journalId;

export const formatArticleCitation = (
  journalId: string,
  year: number,
  volume: number,
  issue: number,
  pages: string | null
): string => {
  const abbr = journalCitationAbbrev(journalId);
  return `${abbr}, ${year}; ${volume}(${issue}): ${pages ?? "—"}`;
};

/** Turn stored file path into a browser URL served by Express static. */
export const pdfPublicUrl = (pdfPublicPath?: string | null): string | null => {
  if (!pdfPublicPath) return null;
  const normalized = pdfPublicPath.replace(/\\/g, "/");
  if (normalized.startsWith("http://") || normalized.startsWith("https://")) {
    return normalized;
  }
  const idx = normalized.indexOf("uploads/");
  if (idx >= 0) {
    return `/${normalized.slice(idx)}`;
  }
  const base = normalized.split("/").pop();
  if (!base) return null;
  if (normalized.includes("articles")) return `/uploads/articles/${base}`;
  return `/uploads/manuscripts/${base}`;
};

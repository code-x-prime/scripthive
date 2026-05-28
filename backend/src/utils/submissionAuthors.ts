/**
 * Builds a display string for manuscript authors from primary author + co-authors text.
 */
export function formatSubmissionAuthors(authorName: string, coAuthors: string | null | undefined): string {
  const primary = authorName?.trim() ?? "";
  const parts: string[] = [];
  if (primary) parts.push(primary);
  if (coAuthors?.trim()) {
    const extra = coAuthors
      .split(/[,;\n|]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    for (const name of extra) {
      if (!parts.some((p) => p.toLowerCase() === name.toLowerCase())) {
        parts.push(name);
      }
    }
  }
  return parts.length > 0 ? parts.join(", ") : "—";
}

/** Ordered unique author names for APIs and dashboards (Prisma stores primary + co-authors as separate fields). */
export function submissionAuthorsArray(authorName: string, coAuthors: string | null | undefined): string[] {
  const s = formatSubmissionAuthors(authorName, coAuthors);
  if (s === "—") return [];
  return s
    .split(",")
    .map((x) => x.trim())
    .filter((x) => x.length > 0 && x.toLowerCase() !== "undefined");
}

import type { Submission } from "@/types";

/** Builds author list from Prisma `authorName` + optional `coAuthors` text (not a DB array). */
export function submissionAuthorsList(s: Pick<Submission, "authorName" | "coAuthors">): string[] {
  const primary = s.authorName?.trim() ?? "";
  const parts: string[] = [];
  if (primary) parts.push(primary);
  const raw = s.coAuthors?.trim();
  if (raw) {
    for (const name of raw.split(/[,;\n|]+/)) {
      const t = name.trim();
      if (!t || t.toLowerCase() === "undefined") continue;
      if (!parts.some((p) => p.toLowerCase() === t.toLowerCase())) parts.push(t);
    }
  }
  return parts;
}

export function submissionAuthorsDisplay(s: Pick<Submission, "authorName" | "coAuthors">): string {
  const list = submissionAuthorsList(s);
  return list.length > 0 ? list.join(", ") : "—";
}

import { prisma } from "../config/prisma.js";
import { slugify } from "./archiveSlug.js";

export const generateUniqueArticleSlug = async (
  title: string,
  journalId: string,
  excludeSubmissionId?: string
): Promise<string> => {
  const base = slugify(title);
  let candidate = base;
  let suffix = 2;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const existing = await prisma.submission.findFirst({
      where: {
        journalId,
        slug: candidate,
        ...(excludeSubmissionId ? { NOT: { id: excludeSubmissionId } } : {})
      },
      select: { id: true }
    });
    if (!existing) return candidate;
    candidate = `${base}-${suffix++}`;
  }
};

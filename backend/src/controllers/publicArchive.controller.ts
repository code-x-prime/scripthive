import type { Request, Response } from "express";
import { prisma } from "../config/prisma.js";
import { mapPublicArticle } from "../utils/archiveArticle.js";
import {
  formatIssueLabel,
  formatVolIssueHeader,
  journalSlugFromId,
  parseVolumeIssueSlug,
  resolveJournalId,
  volumeIssueSlug
} from "../utils/archiveSlug.js";

const publishedArticleSelect = {
  id: true,
  title: true,
  authorName: true,
  coAuthors: true,
  country: true,
  slug: true,
  pageStart: true,
  pageEnd: true,
  pubDate: true,
  pdfPublicPath: true,
  abstract: true,
  keywords: true,
  status: true,
  viewCount: true,
  downloadCount: true,
  doiRecord: { select: { doi: true, status: true } }
} as const;

const findJournal = async (journalSlug: string) => {
  const journalId = resolveJournalId(journalSlug);
  return prisma.journal.findFirst({
    where: {
      id: journalId,
      status: "Active"
    }
  });
};

/** GET /api/journals/:journalSlug/archive — journal archive index */
export const getJournalArchiveIndex = async (req: Request, res: Response): Promise<void> => {
  const journal = await findJournal(String(req.params.journalSlug));
  if (!journal) {
    res.status(404).json({ message: "Journal not found" });
    return;
  }

  const volumes = await prisma.volume.findMany({
    where: { journalId: journal.id },
    include: {
      issues: {
        include: {
          parts: {
            include: {
              articles: {
                where: { status: "Published" },
                select: publishedArticleSelect
              }
            }
          }
        },
        orderBy: { number: "desc" }
      }
    },
    orderBy: { number: "desc" }
  });

  const issues = volumes.flatMap((vol) =>
    vol.issues.map((iss) => {
      const ctx = { journalId: journal.id, volume: vol.number, issue: iss.number, year: vol.year };
      const articles = iss.parts.flatMap((p) => p.articles).map((a) => mapPublicArticle(a, ctx));
      return {
        volume: vol.number,
        issue: iss.number,
        year: vol.year,
        period: iss.period,
        slug: volumeIssueSlug(vol.number, iss.number),
        label: formatIssueLabel(vol.number, iss.number, vol.year, iss.period),
        headerLabel: formatVolIssueHeader(vol.number, iss.number, vol.year),
        articleCount: articles.length,
        articles
      };
    })
  );

  res.json({
    journal: {
      id: journal.id,
      slug: journalSlugFromId(journal.id),
      name: journal.name,
      issn: journal.issn,
      eIssn: journal.eIssn,
      description: journal.description
    },
    issues
  });
};

/** GET /api/journals/:journalSlug/archive/:volumeIssueSlug */
export const getArchiveIssue = async (req: Request, res: Response): Promise<void> => {
  const journal = await findJournal(String(req.params.journalSlug));
  if (!journal) {
    res.status(404).json({ message: "Journal not found" });
    return;
  }

  const parsed = parseVolumeIssueSlug(String(req.params.volumeIssueSlug));
  if (!parsed) {
    res.status(400).json({ message: "Invalid volume/issue URL" });
    return;
  }

  const volume = await prisma.volume.findFirst({
    where: { journalId: journal.id, number: parsed.volume },
    include: {
      issues: {
        where: { number: parsed.issue },
        include: {
          parts: {
            include: {
              articles: {
                where: { status: "Published" },
                select: publishedArticleSelect,
                orderBy: [{ pageStart: "asc" }, { title: "asc" }]
              }
            }
          }
        }
      }
    }
  });

  const issue = volume?.issues[0];
  if (!volume || !issue) {
    res.status(404).json({ message: "Volume/issue not found" });
    return;
  }

  const ctx = { journalId: journal.id, volume: volume.number, issue: issue.number, year: volume.year };
  const articles = issue.parts
    .flatMap((p) => p.articles)
    .map((a) => mapPublicArticle(a, ctx))
    .sort((a, b) => (a.pages ?? "").localeCompare(b.pages ?? ""));

  res.json({
    journal: {
      id: journal.id,
      slug: journalSlugFromId(journal.id),
      name: journal.name,
      issn: journal.issn,
      eIssn: journal.eIssn
    },
    volume: volume.number,
    issue: issue.number,
    year: volume.year,
    period: issue.period,
    slug: volumeIssueSlug(volume.number, issue.number),
    label: formatIssueLabel(volume.number, issue.number, volume.year, issue.period),
    headerLabel: formatVolIssueHeader(volume.number, issue.number, volume.year),
    articles
  });
};

/** GET /api/journals/:journalSlug/archive/:volumeIssueSlug/:articleSlug */
export const getArchiveArticle = async (req: Request, res: Response): Promise<void> => {
  const journal = await findJournal(String(req.params.journalSlug));
  if (!journal) {
    res.status(404).json({ message: "Journal not found" });
    return;
  }

  const parsed = parseVolumeIssueSlug(String(req.params.volumeIssueSlug));
  if (!parsed) {
    res.status(400).json({ message: "Invalid volume/issue URL" });
    return;
  }

  const articleSlug = String(req.params.articleSlug).trim();

  const article = await prisma.submission.findFirst({
    where: {
      journalId: journal.id,
      status: "Published",
      slug: articleSlug,
      part: {
        issue: {
          number: parsed.issue,
          volume: { number: parsed.volume, journalId: journal.id }
        }
      }
    },
    select: {
      ...publishedArticleSelect,
      part: {
        select: {
          issue: {
            select: {
              number: true,
              period: true,
              volume: { select: { number: true, year: true } }
            }
          }
        }
      }
    }
  });

  if (!article) {
    res.status(404).json({ message: "Article not found" });
    return;
  }

  const vol = article.part?.issue.volume;
  const iss = article.part?.issue;

  const ctx =
    vol && iss
      ? { journalId: journal.id, volume: vol.number, issue: iss.number, year: vol.year }
      : { journalId: journal.id, volume: parsed.volume, issue: parsed.issue, year: new Date().getFullYear() };

  res.json({
    journal: {
      id: journal.id,
      slug: journalSlugFromId(journal.id),
      name: journal.name,
      issn: journal.issn,
      eIssn: journal.eIssn
    },
    volumeIssue: vol && iss
      ? {
          volume: vol.number,
          issue: iss.number,
          year: vol.year,
          period: iss.period,
          slug: volumeIssueSlug(vol.number, iss.number),
          label: formatIssueLabel(vol.number, iss.number, vol.year, iss.period),
          headerLabel: formatVolIssueHeader(vol.number, iss.number, vol.year)
        }
      : null,
    article: mapPublicArticle(article, ctx)
  });
};

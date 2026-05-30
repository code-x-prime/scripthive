import type { Request, Response } from "express";
import { prisma } from "../config/prisma.js";

export const getArticleBySlug = async (req: Request, res: Response): Promise<void> => {
  const slug = String(req.params.slug).trim();

  // Try slug first
  let article = await prisma.submission.findFirst({
    where: { slug, status: "Published" },
    include: { journal: true, doiRecord: true, part: { include: { issue: { include: { volume: true } } } } }
  });

  // Fallback: citation-style lookup — format: YEAR-VOL(ISSUEpart):PAGES e.g. 2026-1(1aa):01-03
  if (!article) {
    const m = slug.match(/^(\d{4})-(\d+)\((\d+)([a-z]*)\):(\d+)-(\d+)$/i);
    if (m) {
      const year = parseInt(m[1] ?? "0");
      const vol = parseInt(m[2] ?? "0");
      const issue = parseInt(m[3] ?? "0");
      const pageStart = parseInt(m[5] ?? "0");
      const pageEnd = parseInt(m[6] ?? "0");
      article = await prisma.submission.findFirst({
        where: {
          status: "Published",
          pageStart,
          pageEnd,
          part: { issue: { number: issue, volume: { number: vol, year } } }
        },
        include: { journal: true, doiRecord: true, part: { include: { issue: { include: { volume: true } } } } }
      });
    }
  }

  if (!article) { res.status(404).json({ message: "Article not found" }); return; }

  void prisma.submission.update({ where: { id: article.id }, data: { viewCount: { increment: 1 } } });
  res.json(article);
};

export const incrementView = async (req: Request, res: Response): Promise<void> => {
  const id = String(req.params.id);
  await prisma.submission.updateMany({
    where: { id, status: "Published" },
    data: { viewCount: { increment: 1 } }
  });
  res.json({ ok: true });
};

export const incrementDownload = async (req: Request, res: Response): Promise<void> => {
  const id = String(req.params.id);
  await prisma.submission.updateMany({
    where: { id, status: "Published" },
    data: { downloadCount: { increment: 1 } }
  });
  res.json({ ok: true });
};

export const getArchiveAdmin = async (_req: Request, res: Response): Promise<void> => {
  const rows = await prisma.submission.findMany({
    where: { status: "Published" },
    include: {
      journal: true,
      doiRecord: true,
      part: { include: { issue: { include: { volume: true } } } }
    },
    orderBy: [{ journalId: "asc" }, { volumeId: "asc" }, { issueId: "asc" }]
  });
  res.json(rows);
};

export const getArchiveByJournal = async (req: Request, res: Response): Promise<void> => {
  const rows = await prisma.volume.findMany({
    where: { journalId: String(req.params.journalId) },
    orderBy: { number: "desc" },
    include: {
      issues: {
        orderBy: { number: "desc" },
        include: {
          parts: {
            orderBy: { name: "asc" },
            include: {
              articles: {
                where: { status: "Published" },
                orderBy: [{ pageStart: "asc" }, { createdAt: "asc" }],
                select: {
                  id: true, title: true, authorName: true, coAuthors: true,
                  country: true, pageStart: true, pageEnd: true, slug: true,
                  pdfPublicPath: true, viewCount: true, downloadCount: true,
                  doiRecord: true
                }
              }
            }
          }
        }
      }
    }
  });
  res.json(rows);
};

import type { Request, Response } from "express";
import path from "node:path";
import fs from "node:fs";
import { prisma } from "../config/prisma.js";
import { logger } from "../utils/logger.js";
import { sendArticlePublishedEmail } from "../services/email.service.js";
import { generateUniqueArticleSlug } from "../utils/uniqueArticleSlug.js";
import { writeAuditLog } from "../utils/auditLog.js";
import type { AuthRequest } from "../middlewares/auth.middleware.js";

export const listVolumesForJournal = async (req: Request, res: Response): Promise<void> => {
  const journalId = typeof req.query.journalId === "string" ? req.query.journalId : undefined;
  const where = journalId ? { journalId } : {};
  const volumes = await prisma.volume.findMany({
    where,
    include: { issues: { include: { parts: true } } },
    orderBy: { number: "desc" }
  });
  res.json(volumes);
};

export const createVolume = async (req: Request, res: Response): Promise<void> => {
  const { journalId, number, year } = req.body as { journalId: string; number: number; year: number };
  if (!journalId || !number || !year) { res.status(400).json({ message: "journalId, number, year required" }); return; }
  const vol = await prisma.volume.upsert({
    where: { journalId_number: { journalId, number: Number(number) } },
    update: { year: Number(year) },
    create: { journalId, number: Number(number), year: Number(year) }
  });
  res.json(vol);
};

export const createIssue = async (req: Request, res: Response): Promise<void> => {
  const { volumeId, number, period } = req.body as { volumeId: number; number: number; period?: string };
  if (!volumeId || !number) { res.status(400).json({ message: "volumeId, number required" }); return; }
  const iss = await prisma.issue.upsert({
    where: { volumeId_number: { volumeId: Number(volumeId), number: Number(number) } },
    update: { period: period ?? null },
    create: { volumeId: Number(volumeId), number: Number(number), period: period ?? null }
  });
  res.json(iss);
};

export const createPart = async (req: Request, res: Response): Promise<void> => {
  const { issueId, name } = req.body as { issueId: number; name: string };
  if (!issueId || !name) { res.status(400).json({ message: "issueId, name required" }); return; }
  const trimmed = name.trim();
  const part = await prisma.part.upsert({
    where: { issueId_name: { issueId: Number(issueId), name: trimmed } },
    update: {},
    create: { issueId: Number(issueId), name: trimmed }
  });
  res.json(part);
};

export const updateVolume = async (req: Request, res: Response): Promise<void> => {
  const id = Number(req.params.id);
  const { year } = req.body as { year?: number };
  const vol = await prisma.volume.update({ where: { id }, data: { ...(year ? { year: Number(year) } : {}) } });
  res.json(vol);
};

export const deleteVolume = async (req: Request, res: Response): Promise<void> => {
  const id = Number(req.params.id);
  const articles = await prisma.submission.count({ where: { volumeId: id } });
  if (articles > 0) { res.status(400).json({ message: `Cannot delete — ${articles} published article(s) linked` }); return; }
  await prisma.volume.delete({ where: { id } });
  res.json({ message: "Volume deleted" });
};

export const updateIssue = async (req: Request, res: Response): Promise<void> => {
  const id = Number(req.params.id);
  const { period } = req.body as { period?: string | null };
  const iss = await prisma.issue.update({ where: { id }, data: { period: period ?? null } });
  res.json(iss);
};

export const deleteIssue = async (req: Request, res: Response): Promise<void> => {
  const id = Number(req.params.id);
  const articles = await prisma.submission.count({ where: { issueId: id } });
  if (articles > 0) { res.status(400).json({ message: `Cannot delete — ${articles} published article(s) linked` }); return; }
  await prisma.issue.delete({ where: { id } });
  res.json({ message: "Issue deleted" });
};

export const updatePart = async (req: Request, res: Response): Promise<void> => {
  const id = Number(req.params.id);
  const { name } = req.body as { name: string };
  if (!name?.trim()) { res.status(400).json({ message: "name required" }); return; }
  const part = await prisma.part.update({ where: { id }, data: { name: name.trim() } });
  res.json(part);
};

export const deletePart = async (req: Request, res: Response): Promise<void> => {
  const id = Number(req.params.id);
  const articles = await prisma.submission.count({ where: { partId: id } });
  if (articles > 0) { res.status(400).json({ message: `Cannot delete — ${articles} published article(s) linked` }); return; }
  await prisma.part.delete({ where: { id } });
  res.json({ message: "Part deleted" });
};

export const listApprovedUnpublished = async (_req: Request, res: Response): Promise<void> => {
  const rows = await prisma.submission.findMany({
    where: { status: "Accepted", paymentStatus: "Paid" },
    include: { journal: true, doiRecord: true },
    orderBy: { updatedAt: "desc" }
  });
  res.json(rows);
};

export const getNextArticleNo = async (req: Request, res: Response): Promise<void> => {
  const journalId = req.query.journalId as string;
  if (!journalId) {
    res.status(400).json({ message: "journalId is required" });
    return;
  }
  const count = await prisma.submission.count({
    where: { journalId, status: "Published" }
  });
  const articleNo = 1474 + count + 1;
  res.json({ articleNo });
};

export const publishArticle = async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body as Record<string, string>;
    const {
      submissionId, title, authorName, abstract: _abstract, keywords: _keywords,
      subject: _subject, country: _country, doi: _doi, month: _month,
      refNo: _refNo,
      year, volume, issue, part, pageNo, articleNo: articleNoRaw, doiLink: doiLinkFromClient
    } = body;
    const assignDoi = body.assignDoi === "true" || body.assignDoi === "1";

    if (!submissionId || !title || !authorName || !year || !volume || !issue || !part || !pageNo) {
      res.status(400).json({ message: "Missing required fields" });
      return;
    }

    const submission = await prisma.submission.findUnique({
      where: { id: submissionId },
      include: { journal: true, doiRecord: true }
    });
    if (!submission) {
      res.status(404).json({ message: "Submission not found" });
      return;
    }

    const volNum = parseInt(volume);
    const yearNum = parseInt(year);
    let volumeRecord = await prisma.volume.findFirst({
      where: { journalId: submission.journalId, number: volNum }
    });
    if (!volumeRecord) {
      volumeRecord = await prisma.volume.create({
        data: { journalId: submission.journalId, number: volNum, year: yearNum }
      });
    }

    const issNum = parseInt(issue);
    let issueRecord = await prisma.issue.findFirst({
      where: { volumeId: volumeRecord.id, number: issNum }
    });
    if (!issueRecord) {
      issueRecord = await prisma.issue.create({
        data: { volumeId: volumeRecord.id, number: issNum }
      });
    }
    if (_month?.trim()) {
      await prisma.issue.update({
        where: { id: issueRecord.id },
        data: { period: _month.trim() }
      });
      issueRecord.period = _month.trim();
    }

    const partLabel = (part || "A").replace(/[^A-Ca-c]/gi, "").toUpperCase() || "A";
    let partRecord = await prisma.part.findFirst({
      where: { issueId: issueRecord.id, name: partLabel }
    });
    if (!partRecord) {
      partRecord = await prisma.part.create({
        data: { issueId: issueRecord.id, name: partLabel }
      });
    }

    const pageParts = pageNo.split("-");
    const pageStart = parseInt(pageParts[0] ?? "1") || 1;
    const pageEnd = parseInt(pageParts[1] ?? String(pageStart)) || pageStart;

    let finalDoiLink: string | null = null;
    if (assignDoi) {
      const partLower = partLabel.toLowerCase();
      let articleNo = parseInt(articleNoRaw ?? "", 10);
      if (!Number.isFinite(articleNo)) {
        const publishedCount = await prisma.submission.count({
          where: { journalId: submission.journalId, status: "Published" }
        });
        articleNo = 1474 + publishedCount + 1;
      }

      const prefixRow = await prisma.setting.findUnique({ where: { key: "doi_prefix" } });
      const doiPrefix = prefixRow?.value ?? "10.33545/2664844X";
      const builtLink = `https://www.doi.org/${doiPrefix}.${year}.v${volume}i${issue}${partLower}.${articleNo}`;

      finalDoiLink =
        doiLinkFromClient?.trim() && doiLinkFromClient.includes("doi.org")
          ? doiLinkFromClient.trim()
          : builtLink;

      const doiIdentifier = finalDoiLink.replace(/^https?:\/\/(www\.)?doi\.org\//i, "");

      await prisma.doiRecord.upsert({
        where: { submissionId },
        update: { doi: doiIdentifier, status: "Minted" },
        create: { submissionId, doi: doiIdentifier, status: "Minted" }
      });
    }

    const articleSlug = await generateUniqueArticleSlug(
      title || submission.title,
      submission.journalId,
      submissionId
    );

    let pdfStored: string | null = null;
    if (req.file) {
      const newName = `${submissionId}.pdf`;
      const newPath = path.join(path.dirname(req.file.path), newName);
      try {
        fs.renameSync(req.file.path, newPath);
        pdfStored = newPath.replace(/\\/g, "/").replace(/^.*uploads\//, "uploads/");
      } catch {
        pdfStored = req.file.path.replace(/\\/g, "/").replace(/^.*uploads\//, "uploads/");
      }
    }

    const updated = await prisma.submission.update({
      where: { id: submissionId },
      data: {
        status: "Published",
        partId: partRecord.id,
        volumeId: volumeRecord.id,
        issueId: issueRecord.id,
        pageStart,
        pageEnd,
        pubDate: new Date(),
        pdfPublicPath: pdfStored,
        slug: articleSlug
      }
    });

    try {
      await sendArticlePublishedEmail(
        submission.authorEmail,
        authorName || submission.authorName,
        title || submission.title,
        assignDoi ? (finalDoiLink ?? "") : "",
        submission.journal?.name ?? ""
      );
    } catch (err) {
      logger.warn({ message: "Article published email failed", submissionId, err });
    }

    void writeAuditLog({
      adminId: (req as AuthRequest).admin?.adminId,
      action: "article_published",
      resource: "publish",
      resourceId: submissionId,
      details: { title, assignDoi, doiLink: finalDoiLink, slug: articleSlug },
      ipAddress: req.ip
    });
    res.json({
      success: true,
      article: updated,
      articleSlug,
      doiAssigned: assignDoi,
      doiLink: assignDoi ? finalDoiLink : null
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to publish article";
    logger.error({ message: "Publish article error", error });
    res.status(500).json({ message: msg });
  }
};

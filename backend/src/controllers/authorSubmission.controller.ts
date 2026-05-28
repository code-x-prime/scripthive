import type { Response } from "express";
import path from "node:path";
import fs from "node:fs";
import { prisma } from "../config/prisma.js";
import { generateSubmissionId } from "../utils/generateId.js";
import {
  sendMail,
  sendSubmissionConfirmationEmail
} from "../services/email.service.js";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";
import type { AuthorRequest } from "../middlewares/author.middleware.js";

const submissionScope = (authorId: string, email: string) => ({
  OR: [{ authorUserId: authorId }, { authorEmail: email, authorUserId: null }]
});

const PENDING_ONLY_MSG = "Only pending submissions can be edited or deleted.";

async function findOwnedSubmission(authorId: string, email: string, id: string) {
  return prisma.submission.findFirst({
    where: { id, ...submissionScope(authorId, email) }
  });
}

export const getAuthorStats = async (req: AuthorRequest, res: Response): Promise<void> => {
  const authorId = req.author!.authorId;
  const email = req.author!.email;
  const where = submissionScope(authorId, email);
  const [total, grouped] = await Promise.all([
    prisma.submission.count({ where }),
    prisma.submission.groupBy({ by: ["status"], where, _count: { _all: true } })
  ]);
  const byStatus = Object.fromEntries(grouped.map((g) => [g.status, g._count._all]));
  res.json({
    total,
    pending: byStatus.Pending ?? 0,
    underReview: byStatus.UnderReview ?? 0,
    revision: byStatus.Revision ?? 0,
    accepted: byStatus.Accepted ?? 0,
    rejected: byStatus.Rejected ?? 0,
    published: byStatus.Published ?? 0
  });
};

export const listAuthorSubmissions = async (req: AuthorRequest, res: Response): Promise<void> => {  const authorId = req.author!.authorId;
  const email = req.author!.email;
  const rows = await prisma.submission.findMany({
    where: submissionScope(authorId, email),
    include: { journal: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" }
  });
  res.json(
    rows.map((s) => ({
      id: s.id,
      title: s.title,
      journalId: s.journalId,
      journalName: s.journal.name,
      status: s.status,
      productionStatus: s.productionStatus,
      paymentStatus: s.paymentStatus,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt
    }))
  );
};

export const getAuthorSubmission = async (req: AuthorRequest, res: Response): Promise<void> => {
  const authorId = req.author!.authorId;
  const email = req.author!.email;
  const row = await prisma.submission.findFirst({
    where: { id: String(req.params.id), ...submissionScope(authorId, email) },
    include: { journal: true, invoices: true, doiRecord: true }
  });
  if (!row) {
    res.status(404).json({ message: "Submission not found" });
    return;
  }
  res.json(row);
};

export const createAuthorSubmission = async (req: AuthorRequest, res: Response): Promise<void> => {
  const authorId = req.author!.authorId;
  const author = await prisma.author.findUnique({ where: { id: authorId } });
  if (!author) {
    res.status(401).json({ message: "Account not found" });
    return;
  }

  const data = req.body as Record<string, string>;
  if (!data.journalId || !data.title || !data.abstract || !data.keywords) {
    res.status(400).json({ message: "Missing required submission fields" });
    return;
  }

  const count = await prisma.submission.count();
  const submissionId = generateSubmissionId(new Date(), count + 1);

  let manuscriptPath: string | null = null;
  if (req.file) {
    const ext = path.extname(req.file.originalname).toLowerCase() || ".pdf";
    const newName = `${submissionId}${ext}`;
    const newFilePath = path.join(path.dirname(req.file.path), newName);
    try {
      fs.renameSync(req.file.path, newFilePath);
      manuscriptPath = newFilePath.replace(/\\/g, "/");
    } catch {
      manuscriptPath = req.file.path.replace(/\\/g, "/");
    }
  }

  const created = await prisma.submission.create({
    data: {
      id: submissionId,
      journalId: data.journalId,
      authorUserId: author.id,
      title: data.title.trim(),
      country: data.country?.trim() || author.country,
      authorName: data.authorName?.trim() || author.name,
      authorEmail: author.email,
      authorPhone: data.authorPhone?.trim() || author.phone,
      affiliations: data.affiliations?.trim() || author.affiliations,
      coAuthors: data.coAuthors?.trim() || null,
      abstract: data.abstract,
      keywords: data.keywords,
      articleType: data.articleType ?? "Research",
      manuscriptPath
    }
  });

  try {
    await sendSubmissionConfirmationEmail(created.authorEmail, created.authorName, created.id);
  } catch (err) {
    logger.warn({ message: "Author confirmation email failed", submissionId: created.id, err });
  }
  try {
    await sendMail({
      to: env.ADMIN_EMAIL,
      subject: `New submission received: ${created.id}`,
      html: `<p>New submission from ${created.authorName} (${created.authorEmail}).</p><p>ID: <strong>${created.id}</strong></p>`
    });
  } catch (err) {
    logger.warn({ message: "Admin alert email failed", submissionId: created.id, err });
  }

  res.status(201).json({
    submissionId: created.id,
    id: created.id,
    title: created.title,
    submittedAt: created.createdAt,
    message: "Submitted successfully"
  });
};

export const updateAuthorProfile = async (req: AuthorRequest, res: Response): Promise<void> => {
  const authorId = req.author!.authorId;
  const { name, phone, country, affiliations } = req.body as {
    name?: string;
    phone?: string;
    country?: string;
    affiliations?: string;
  };
  const updated = await prisma.author.update({
    where: { id: authorId },
    data: {
      ...(name?.trim() ? { name: name.trim() } : {}),
      ...(phone !== undefined ? { phone: phone.trim() || null } : {}),
      ...(country !== undefined ? { country: country.trim() || null } : {}),
      ...(affiliations !== undefined ? { affiliations: affiliations.trim() || null } : {})
    }
  });
  res.json({
    id: updated.id,
    name: updated.name,
    email: updated.email,
    phone: updated.phone,
    country: updated.country,
    affiliations: updated.affiliations
  });
};

export const updateAuthorSubmission = async (req: AuthorRequest, res: Response): Promise<void> => {
  const authorId = req.author!.authorId;
  const email = req.author!.email;
  const id = String(req.params.id);
  const existing = await findOwnedSubmission(authorId, email, id);
  if (!existing) {
    res.status(404).json({ message: "Submission not found" });
    return;
  }
  if (existing.status !== "Pending") {
    res.status(403).json({ message: PENDING_ONLY_MSG });
    return;
  }

  const data = req.body as Record<string, string>;
  if (!data.title?.trim() || !data.abstract?.trim() || !data.keywords?.trim()) {
    res.status(400).json({ message: "Title, abstract, and keywords are required" });
    return;
  }

  const updated = await prisma.submission.update({
    where: { id },
    data: {
      title: data.title.trim(),
      abstract: data.abstract,
      keywords: data.keywords,
      coAuthors: data.coAuthors?.trim() || null,
      country: data.country?.trim() || null,
      affiliations: data.affiliations?.trim() || null,
      articleType: data.articleType?.trim() || existing.articleType,
      ...(req.file
        ? (() => {
            const ext = path.extname(req.file.originalname).toLowerCase() || ".pdf";
            const newName = `${id}${ext}`;
            const newFilePath = path.join(path.dirname(req.file.path), newName);
            try {
              if (existing.manuscriptPath && fs.existsSync(existing.manuscriptPath)) fs.unlinkSync(existing.manuscriptPath);
              fs.renameSync(req.file.path, newFilePath);
              return { manuscriptPath: newFilePath.replace(/\\/g, "/") };
            } catch {
              return { manuscriptPath: req.file.path.replace(/\\/g, "/") };
            }
          })()
        : {})
    },
    include: { journal: true, invoices: true, doiRecord: true }
  });

  res.json(updated);
};

export const deleteAuthorSubmission = async (req: AuthorRequest, res: Response): Promise<void> => {
  const authorId = req.author!.authorId;
  const email = req.author!.email;
  const id = String(req.params.id);
  const existing = await findOwnedSubmission(authorId, email, id);
  if (!existing) {
    res.status(404).json({ message: "Submission not found" });
    return;
  }
  if (existing.status !== "Pending") {
    res.status(403).json({ message: PENDING_ONLY_MSG });
    return;
  }

  if (existing.manuscriptPath && fs.existsSync(existing.manuscriptPath)) {
    try {
      fs.unlinkSync(existing.manuscriptPath);
    } catch {
      // continue delete row even if file removal fails
    }
  }

  await prisma.invoice.deleteMany({ where: { submissionId: id } });
  await prisma.submission.delete({ where: { id } });
  res.json({ message: "Submission deleted" });
};
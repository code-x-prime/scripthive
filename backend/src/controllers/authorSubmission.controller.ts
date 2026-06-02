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
import { uploadToR2, deleteFromR2 } from "../utils/r2Upload.js";

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
    const r2Key = `manuscripts/${submissionId}${ext}`;
    try {
      manuscriptPath = await uploadToR2(req.file.path, r2Key);
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
      subject: `New Paper Submission: ${created.id} | ScriptHive`,
      replyTo: created.authorEmail,
      html: `
        <p>A new manuscript has been submitted.</p>
        <table style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:14px;">
          <tr><td style="padding:6px 12px;color:#555;">Submission ID</td><td style="padding:6px 12px;font-weight:bold;">${created.id}</td></tr>
          <tr><td style="padding:6px 12px;color:#555;">Author Name</td><td style="padding:6px 12px;">${created.authorName}</td></tr>
          <tr><td style="padding:6px 12px;color:#555;">Author Email</td><td style="padding:6px 12px;"><a href="mailto:${created.authorEmail}">${created.authorEmail}</a></td></tr>
          <tr><td style="padding:6px 12px;color:#555;">Title</td><td style="padding:6px 12px;">${created.title}</td></tr>
          <tr><td style="padding:6px 12px;color:#555;">Journal</td><td style="padding:6px 12px;">${created.journalId}</td></tr>
          <tr><td style="padding:6px 12px;color:#555;">Submitted At</td><td style="padding:6px 12px;">${created.createdAt.toUTCString()}</td></tr>
        </table>
        <p style="margin-top:16px;color:#888;font-size:12px;">Replying to this email will go directly to the author.</p>
      `
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

  let newManuscriptPath: string | undefined;
  if (req.file) {
    const ext = path.extname(req.file.originalname).toLowerCase() || ".pdf";
    const r2Key = `manuscripts/${id}${ext}`;
    try {
      if (existing.manuscriptPath?.startsWith("http")) {
        const oldKey = existing.manuscriptPath.split(".r2.dev/")[1];
        if (oldKey) await deleteFromR2(oldKey).catch(() => {});
      }
      newManuscriptPath = await uploadToR2(req.file.path, r2Key);
    } catch {
      newManuscriptPath = req.file.path.replace(/\\/g, "/");
    }
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
      ...(newManuscriptPath ? { manuscriptPath: newManuscriptPath } : {})
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

  if (existing.manuscriptPath) {
    try {
      if (existing.manuscriptPath.startsWith("http")) {
        const oldKey = existing.manuscriptPath.split(".r2.dev/")[1];
        if (oldKey) await deleteFromR2(oldKey);
      } else if (fs.existsSync(existing.manuscriptPath)) {
        fs.unlinkSync(existing.manuscriptPath);
      }
    } catch {
      // continue
    }
  }

  await prisma.invoice.deleteMany({ where: { submissionId: id } });
  await prisma.submission.delete({ where: { id } });
  res.json({ message: "Submission deleted" });
};
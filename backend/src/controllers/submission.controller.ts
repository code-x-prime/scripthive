import type { Request, Response } from "express";
import { Prisma } from "@prisma/client";
import path from "node:path";
import fs from "node:fs";
import { prisma } from "../config/prisma.js";
import { generateSubmissionId } from "../utils/generateId.js";
import { ensureDraftInvoiceForSubmission } from "../services/invoiceDraft.service.js";
import {
  sendAcceptedEmail,
  sendMail,
  sendRejectedEmail,
  sendSubmissionConfirmationEmail,
  sendUnderReviewEmail
} from "../services/email.service.js";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";
import { writeAuditLog } from "../utils/auditLog.js";
import type { AuthRequest } from "../middlewares/auth.middleware.js";
import { uploadToR2 } from "../utils/r2Upload.js";

export const listPublishedArticles = async (_req: Request, res: Response): Promise<void> => {
  const rows = await prisma.submission.findMany({
    where: { status: "Published" },
    include: { journal: true, doiRecord: true },
    orderBy: { updatedAt: "desc" }
  });
  res.json(rows);
};

export const updatePublishedArticle = async (req: Request, res: Response): Promise<void> => {
  const id = String(req.params.id);
  const { title, authorName, coAuthors, abstract, keywords, pdfPublicPath, country, affiliations, pageStart, pageEnd, slug } = req.body as {
    title?: string; authorName?: string; coAuthors?: string; abstract?: string; keywords?: string;
    pdfPublicPath?: string; country?: string; affiliations?: string;
    pageStart?: number | null; pageEnd?: number | null; slug?: string;
  };
  const data: Record<string, unknown> = {};
  if (title !== undefined) data.title = title;
  if (authorName !== undefined) data.authorName = authorName;
  if (coAuthors !== undefined) data.coAuthors = coAuthors || null;
  if (abstract !== undefined) data.abstract = abstract;
  if (keywords !== undefined) data.keywords = keywords;
  if (pdfPublicPath !== undefined) data.pdfPublicPath = pdfPublicPath || null;
  if (country !== undefined) data.country = country || null;
  if (affiliations !== undefined) data.affiliations = affiliations || null;
  if (pageStart !== undefined) data.pageStart = pageStart;
  if (pageEnd !== undefined) data.pageEnd = pageEnd;
  if (slug !== undefined) data.slug = slug || null;
  const updated = await prisma.submission.update({ where: { id }, data });
  void writeAuditLog({
    adminId: (req as AuthRequest).admin?.adminId,
    action: "update_published_article",
    resource: "submission",
    resourceId: id,
    details: data,
    ipAddress: req.ip
  });
  res.json(updated);
};

export const createSubmission = async (req: Request, res: Response): Promise<void> => {
  const data = req.body as Record<string, string>;
  if (!data.journalId || !data.title || !data.authorName || !data.authorEmail || !data.abstract || !data.keywords) {
    res.status(400).json({ message: "Missing required submission fields" });
    return;
  }

  const authorEmail = data.authorEmail.trim().toLowerCase();
  const journalId = data.journalId.trim().toUpperCase();
  const title = data.title.trim();
  const authorName = String(data.authorName ?? "").trim();
  const authorPhone = String(data.authorPhone ?? "").trim();
  const country = String(data.country ?? "").trim();
  const affiliations = String(data.affiliations ?? "").trim();
  const coAuthors = String(data.coAuthors ?? "").trim();
  const abstract = String(data.abstract ?? "").trim();
  const keywords = String(data.keywords ?? "").trim();
  const duplicateWindowMs = 10 * 60 * 1000;
  const duplicateKey = `${authorEmail}|${journalId}|${title.toLowerCase()}`;

  const { created, duplicate } = await prisma.$transaction(async (tx) => {
    // Serialize duplicate checks for the same paper so double-click / retry requests can't create twins.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${duplicateKey}))`;

    const recentDuplicate = await tx.submission.findFirst({
      where: {
        authorEmail,
        journalId,
        title,
        createdAt: { gte: new Date(Date.now() - duplicateWindowMs) }
      }
    });
    if (recentDuplicate) {
      return { created: recentDuplicate, duplicate: true as const };
    }

    const linkedAuthor = await tx.author.findUnique({ where: { email: authorEmail } });
    const submissionId = generateSubmissionId(new Date());

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

    let addonsJson: object | null = null;
    if (data.addons) {
      try { addonsJson = JSON.parse(data.addons) as object; } catch { addonsJson = null; }
    }

    const submission = await tx.submission.create({
      data: {
        id: submissionId,
        journalId,
        authorUserId: linkedAuthor?.id ?? null,
        title,
        country: country || linkedAuthor?.country || null,
        authorName,
        authorEmail,
        authorPhone: authorPhone || linkedAuthor?.phone || null,
        affiliations: affiliations || linkedAuthor?.affiliations || null,
        coAuthors: coAuthors || null,
        abstract,
        keywords,
        articleType: data.articleType ?? "Research",
        manuscriptPath,
        addons: addonsJson ?? Prisma.JsonNull
      }
    });

    return { created: submission, duplicate: false as const };
  });

  if (duplicate) {
    res.json({ id: created.id, submissionId: created.id, _duplicate: true });
    return;
  }
  try {
    await sendSubmissionConfirmationEmail(created.authorEmail, created.authorName, created.id);
  } catch (err) {
    logger.warn({ message: "Author confirmation email failed", submissionId: created.id, err });
  }
  try {
    await sendMail({
      to: env.ADMIN_EMAIL,
      subject: `New Paper Submission: ${created.id}`,
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

export const trackSubmission = async (req: Request, res: Response): Promise<void> => {
  const s = await prisma.submission.findUnique({ where: { id: String(req.params.id) } });
  if (!s) {
    res.status(404).json({ message: "Submission not found" });
    return;
  }
  res.json({ id: s.id, status: s.status, reviewNotes: s.reviewNotes, updatedAt: s.updatedAt });
};

export const listSubmissions = async (req: Request, res: Response): Promise<void> => {
  const status = typeof req.query.status === "string" ? req.query.status : undefined;
  const journalId =
    typeof req.query.journalId === "string"
      ? req.query.journalId
      : typeof req.query.journal === "string"
        ? req.query.journal
        : undefined;
  const productionStatus = typeof req.query.productionStatus === "string" ? req.query.productionStatus : undefined;
  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";

  const where: Prisma.SubmissionWhereInput = {};
  if (status) where.status = status;
  if (journalId) where.journalId = journalId;
  if (productionStatus) where.productionStatus = productionStatus;
  if (search) {
    where.OR = [
      { id: { contains: search, mode: "insensitive" } },
      { title: { contains: search, mode: "insensitive" } },
      { authorName: { contains: search, mode: "insensitive" } },
      { authorEmail: { contains: search, mode: "insensitive" } }
    ];
  }

  const rows = await prisma.submission.findMany({
    where,
    include: { journal: true, invoices: true },
    orderBy: { createdAt: "desc" }
  });
  res.json(rows);
};

export const getSubmission = async (req: Request, res: Response): Promise<void> => {
  const row = await prisma.submission.findUnique({
    where: { id: String(req.params.id) },
    include: { journal: true, invoices: true, doiRecord: true }
  });
  if (!row) {
    res.status(404).json({ message: "Submission not found" });
    return;
  }
  res.json(row);
};

export const updateSubmissionStatus = async (req: Request, res: Response): Promise<void> => {
  const { status } = req.body as { status: string };
  const allowed = ["Pending", "UnderReview", "Revision", "Accepted", "Rejected", "Published"];
  if (!allowed.includes(status)) {
    res.status(400).json({ message: "Invalid status" });
    return;
  }
  const id = String(req.params.id);
  const prev = await prisma.submission.findUnique({ where: { id } });
  if (!prev) {
    res.status(404).json({ message: "Submission not found" });
    return;
  }
  const row = await prisma.submission.update({ where: { id }, data: { status } });
  const adminId = (req as AuthRequest).admin?.adminId;
  void writeAuditLog({
    adminId,
    action: "status_change",
    resource: "submission",
    resourceId: id,
    details: { from: prev.status, to: status },
    ipAddress: req.ip
  });
  if (prev.status !== status) {
    try {
      if (status === "UnderReview") {
        await sendUnderReviewEmail(row.authorEmail, row.authorName, row.title);
      } else if (status === "Accepted") {
        await sendAcceptedEmail(row.authorEmail, row.authorName, row.title);
        try {
          await ensureDraftInvoiceForSubmission(id);
        } catch (err) {
          logger.warn({ message: "Draft invoice auto-create failed", submissionId: id, err });
        }
      } else if (status === "Rejected") {
        await sendRejectedEmail(row.authorEmail, row.authorName, row.title);
      }
    } catch (err) {
      logger.warn({ message: "Status notification email failed", submissionId: id, err });
    }
  }
  res.json(row);
};

export const downloadManuscript = async (req: Request, res: Response): Promise<void> => {
  const id = String(req.params.id);
  const s = await prisma.submission.findUnique({ where: { id } });
  if (!s?.manuscriptPath) {
    res.status(404).json({ message: "Manuscript not found" });
    return;
  }
  const raw = s.manuscriptPath;
  // R2 URL — return URL so frontend downloads directly (avoids CORS with auth headers)
  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    res.json({ url: raw, filename: raw.split("/").pop() ?? `manuscript-${id}` });
    return;
  }
  const abs = path.normalize(path.isAbsolute(raw) ? raw : path.resolve(process.cwd(), raw));
  const root = path.normalize(path.resolve(process.cwd(), "uploads", "manuscripts"));
  if (!abs.toLowerCase().startsWith(root.toLowerCase())) {
    res.status(403).json({ message: "Forbidden" });
    return;
  }
  if (!fs.existsSync(abs)) {
    res.status(404).json({ message: "File missing on server" });
    return;
  }
  const filename = path.basename(abs);
  res.download(abs, filename);
};

export const uploadManuscript = async (req: Request, res: Response): Promise<void> => {
  const id = String(req.params.id);
  if (!req.file) { res.status(400).json({ message: "No file uploaded" }); return; }
  const s = await prisma.submission.findUnique({ where: { id } });
  if (!s) { res.status(404).json({ message: "Submission not found" }); return; }
  const ext = path.extname(req.file.originalname).toLowerCase() || ".pdf";
  const r2Key = `manuscripts/${id}${ext}`;
  let manuscriptPath: string;
  try {
    manuscriptPath = await uploadToR2(req.file.path, r2Key);
  } catch {
    manuscriptPath = req.file.path.replace(/\\/g, "/");
  }
  await prisma.submission.update({ where: { id }, data: { manuscriptPath } });
  res.json({ success: true, manuscriptPath });
};

export const updateProductionStatus = async (req: Request, res: Response): Promise<void> => {
  const { productionStatus } = req.body as { productionStatus: string | null };
  const allowed = ["ReadyForPreparation", "ReadyForUpload", "ReadyToPublished"];
  if (productionStatus !== null && productionStatus !== "" && !allowed.includes(productionStatus)) {
    res.status(400).json({ message: "Invalid production status" });
    return;
  }
  const id = String(req.params.id);
  const row = await prisma.submission.update({
    where: { id },
    data: { productionStatus: productionStatus === null || productionStatus === "" ? null : productionStatus }
  });
  void writeAuditLog({
    adminId: (req as AuthRequest).admin?.adminId,
    action: "production_stage",
    resource: "submission",
    resourceId: id,
    details: { productionStatus },
    ipAddress: req.ip
  });
  res.json(row);
};

export const updateRemark = async (req: Request, res: Response): Promise<void> => {
  const { remark } = req.body as { remark: string };
  const id = String(req.params.id);
  const row = await prisma.submission.update({
    where: { id },
    data: { editorNotes: remark ?? "" }
  });
  res.json(row);
};

export const updateReviewNotes = async (req: Request, res: Response): Promise<void> => {
  const { reviewNotes } = req.body as { reviewNotes: string };
  const row = await prisma.submission.update({ where: { id: String(req.params.id) }, data: { reviewNotes } });
  res.json(row);
};

export const deleteSubmission = async (req: Request, res: Response): Promise<void> => {
  await prisma.submission.delete({ where: { id: String(req.params.id) } });
  res.json({ message: "Deleted" });
};

export const updatePriority = async (req: Request, res: Response): Promise<void> => {
  const { priority } = req.body as { priority: boolean };
  const row = await prisma.submission.update({
    where: { id: String(req.params.id) },
    data: { priority: Boolean(priority) }
  });
  res.json(row);
};

export const bulkUpdateStatus = async (req: Request, res: Response): Promise<void> => {
  const { ids, status } = req.body as { ids: string[]; status: string };
  const allowed = ["Pending", "UnderReview", "Revision", "Accepted", "Rejected", "Published"];
  if (!Array.isArray(ids) || ids.length === 0 || !allowed.includes(status)) {
    res.status(400).json({ message: "Invalid ids or status" });
    return;
  }
  const submissions = await prisma.submission.findMany({ where: { id: { in: ids } } });
  await prisma.submission.updateMany({ where: { id: { in: ids } }, data: { status } });
  const adminId = (req as AuthRequest).admin?.adminId;
  for (const sub of submissions) {
    void writeAuditLog({ adminId, action: "bulk_status_change", resource: "submission", resourceId: sub.id, details: { from: sub.status, to: status }, ipAddress: req.ip });
    if (sub.status === status) continue;
    try {
      if (status === "Accepted") {
        await sendAcceptedEmail(sub.authorEmail, sub.authorName, sub.title);
        try { await ensureDraftInvoiceForSubmission(sub.id); } catch (_) { /* ignore */ }
      } else if (status === "Rejected") {
        await sendRejectedEmail(sub.authorEmail, sub.authorName, sub.title);
      }
    } catch (err) {
      logger.warn({ message: "Bulk status email failed", submissionId: sub.id, err });
    }
  }
  res.json({ updated: ids.length });
};

// Upload production file (PDF or Word) and auto-advance to ReadyToPublished
export const uploadProductionFile = async (req: Request, res: Response): Promise<void> => {
  const id = String(req.params.id);
  if (!req.file) { res.status(400).json({ message: "No file uploaded" }); return; }

  const s = await prisma.submission.findUnique({ where: { id } });
  if (!s) { res.status(404).json({ message: "Submission not found" }); return; }

  const ext = path.extname(req.file.originalname).toLowerCase() || ".pdf";
  const r2Key = `production/${id}${ext}`;
  let finalPath: string;
  try {
    finalPath = await uploadToR2(req.file.path, r2Key);
  } catch {
    finalPath = req.file.path.replace(/\\/g, "/");
  }

  await prisma.submission.update({
    where: { id },
    data: { productionStatus: "ReadyToPublished", pdfPublicPath: finalPath }
  });
  void writeAuditLog({
    adminId: (req as AuthRequest).admin?.adminId,
    action: "production_stage",
    resource: "submission",
    resourceId: id,
    details: { from: "ReadyForUpload", to: "ReadyToPublished", file: finalPath },
    ipAddress: req.ip
  });
  res.json({ success: true, productionStatus: "ReadyToPublished", filePath: finalPath });
};

// Download the production-uploaded file (pdfPublicPath)
export const downloadProductionFile = async (req: Request, res: Response): Promise<void> => {
  const id = String(req.params.id);
  const s = await prisma.submission.findUnique({ where: { id }, select: { pdfPublicPath: true } });
  if (!s?.pdfPublicPath) { res.status(404).json({ message: "Production file not found" }); return; }

  const raw = s.pdfPublicPath;
  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    res.redirect(raw);
    return;
  }
  const abs = path.normalize(path.isAbsolute(raw) ? raw : path.resolve(process.cwd(), raw));
  const root = path.normalize(path.resolve(process.cwd(), "uploads"));
  if (!abs.toLowerCase().startsWith(root.toLowerCase())) { res.status(403).json({ message: "Forbidden" }); return; }
  if (!fs.existsSync(abs)) { res.status(404).json({ message: "File missing on server" }); return; }
  res.download(abs, path.basename(abs));
};

// Sample journal template download — serves uploads/samples/<journalId>.docx (or .pdf)
export const downloadSample = async (req: Request, res: Response): Promise<void> => {
  const id = String(req.params.id);
  const s = await prisma.submission.findUnique({ where: { id }, select: { journalId: true } });
  if (!s) { res.status(404).json({ message: "Submission not found" }); return; }

  const samplesRoot = path.resolve(process.cwd(), "uploads", "samples");
  const exts = [".docx", ".doc", ".pdf"];
  let found: string | null = null;
  for (const ext of exts) {
    const candidate = path.join(samplesRoot, `${s.journalId}${ext}`);
    if (fs.existsSync(candidate)) { found = candidate; break; }
  }
  if (!found) { res.status(404).json({ message: "Sample template not found for this journal" }); return; }
  res.download(found, path.basename(found));
};

// Author manuscript download AND auto-advance production stage to ReadyForUpload
export const downloadManuscriptAndAdvance = async (req: Request, res: Response): Promise<void> => {
  const id = String(req.params.id);
  const s = await prisma.submission.findUnique({ where: { id } });
  if (!s?.manuscriptPath) { res.status(404).json({ message: "Manuscript not found" }); return; }

  // auto-advance from ReadyForPreparation → ReadyForUpload
  if (s.productionStatus === "ReadyForPreparation") {
    await prisma.submission.update({ where: { id }, data: { productionStatus: "ReadyForUpload" } });
    void writeAuditLog({
      adminId: (req as AuthRequest).admin?.adminId,
      action: "production_stage",
      resource: "submission",
      resourceId: id,
      details: { from: "ReadyForPreparation", to: "ReadyForUpload", trigger: "manuscript_download" },
      ipAddress: req.ip
    });
  }

  const raw = s.manuscriptPath;
  // R2 URL — return URL for direct download
  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    res.json({ url: raw, filename: raw.split("/").pop() ?? `manuscript-${id}` });
    return;
  }
  const abs = path.normalize(path.isAbsolute(raw) ? raw : path.resolve(process.cwd(), raw));
  const root = path.normalize(path.resolve(process.cwd(), "uploads", "manuscripts"));
  if (!abs.toLowerCase().startsWith(root.toLowerCase())) { res.status(403).json({ message: "Forbidden" }); return; }
  if (!fs.existsSync(abs)) { res.status(404).json({ message: "File missing on server" }); return; }

  res.download(abs, path.basename(abs));
};

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

export const createSubmission = async (req: Request, res: Response): Promise<void> => {
  const count = await prisma.submission.count();
  const data = req.body as Record<string, string>;
  if (!data.journalId || !data.title || !data.authorName || !data.authorEmail || !data.abstract || !data.keywords) {
    res.status(400).json({ message: "Missing required submission fields" });
    return;
  }

  const authorEmail = data.authorEmail.trim().toLowerCase();
  const linkedAuthor = await prisma.author.findUnique({ where: { email: authorEmail } });

  const submissionId = generateSubmissionId(new Date(), count + 1);

  // rename uploaded file to submissionId before saving path
  let manuscriptPath: string | null = null;
  if (req.file) {
    const ext = path.extname(req.file.originalname).toLowerCase() || ".pdf";
    const newName = `${submissionId}${ext}`;
    const newPath = path.join(path.dirname(req.file.path), newName);
    try {
      fs.renameSync(req.file.path, newPath);
      manuscriptPath = newPath.replace(/\\/g, "/");
    } catch {
      manuscriptPath = req.file.path.replace(/\\/g, "/");
    }
  }

  let addonsJson: object | null = null;
  if (data.addons) {
    try { addonsJson = JSON.parse(data.addons) as object; } catch { addonsJson = null; }
  }

  const created = await prisma.submission.create({
    data: {
      id: submissionId,
      journalId: data.journalId.trim(),
      authorUserId: linkedAuthor?.id ?? null,
      title: data.title.trim(),
      country: data.country?.trim() || linkedAuthor?.country || null,
      authorName: data.authorName.trim(),
      authorEmail,
      authorPhone: data.authorPhone?.trim() || linkedAuthor?.phone || null,
      affiliations: data.affiliations?.trim() || linkedAuthor?.affiliations || null,
      coAuthors: data.coAuthors?.trim() || null,
      abstract: data.abstract,
      keywords: data.keywords,
      articleType: data.articleType ?? "Research",
      manuscriptPath,
      addons: addonsJson ?? Prisma.JsonNull
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
      html: `<p>New submission received from ${created.authorName} (${created.authorEmail}).</p><p>ID: <strong>${created.id}</strong></p>`
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

  const ext = path.extname(req.file.originalname).toLowerCase() || path.extname(req.file.path) || ".pdf";
  const newName = `${id}${ext}`;
  const newPath = path.join(path.dirname(req.file.path), newName);
  try { fs.renameSync(req.file.path, newPath); } catch { /* keep tmp name */ }
  const finalPath = (fs.existsSync(newPath) ? newPath : req.file.path)
    .replace(/\\/g, "/").replace(/^.*uploads\//, "uploads/");

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

  const raw = s.manuscriptPath;
  const abs = path.normalize(path.isAbsolute(raw) ? raw : path.resolve(process.cwd(), raw));
  const root = path.normalize(path.resolve(process.cwd(), "uploads", "manuscripts"));
  if (!abs.toLowerCase().startsWith(root.toLowerCase())) { res.status(403).json({ message: "Forbidden" }); return; }
  if (!fs.existsSync(abs)) { res.status(404).json({ message: "File missing on server" }); return; }

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

  res.download(abs, path.basename(abs));
};

import type { Request, Response } from "express";
import { prisma } from "../config/prisma.js";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";
import { sendDoiAssignedEmail } from "../services/email.service.js";
import { writeAuditLog } from "../utils/auditLog.js";
import type { AuthRequest } from "../middlewares/auth.middleware.js";

export const listDoiPending = async (_req: Request, res: Response): Promise<void> => {
  const rows = await prisma.submission.findMany({
    where: {
      status: "Accepted",
      paymentStatus: "Paid",
      OR: [{ doiRecord: null }, { doiRecord: { doi: null } }]
    },
    include: { journal: true, doiRecord: true, invoices: true },
    orderBy: { updatedAt: "desc" }
  });
  res.json(rows);
};

export const listDoiMinted = async (_req: Request, res: Response): Promise<void> => {
  const rows = await prisma.doiRecord.findMany({
    where: { doi: { not: null } },
    include: { submission: { include: { journal: true } } },
    orderBy: { updatedAt: "desc" }
  });
  res.json(rows);
};

export const assignDoi = async (req: Request, res: Response): Promise<void> => {
  const { submissionId, journalId, volume, issue } = req.body as {
    submissionId: string;
    journalId: string;
    volume: number;
    issue: number;
  };
  if (!submissionId || !journalId || typeof volume !== "number" || typeof issue !== "number") {
    res.status(400).json({ message: "submissionId, journalId, volume, and issue are required" });
    return;
  }
  const doi = `${env.DOI_PREFIX}/${journalId}.v${volume}i${issue}.${submissionId}`;
  const row = await prisma.doiRecord.upsert({
    where: { submissionId },
    update: { doi, status: "Submitted" },
    create: { submissionId, doi, status: "Submitted" }
  });
  const sub = await prisma.submission.findUnique({ where: { id: submissionId } });
  if (sub) {
    try {
      await sendDoiAssignedEmail(sub.authorEmail, sub.authorName, sub.title, doi);
    } catch (err) {
      logger.warn({ message: "DOI assigned email failed", submissionId, err });
    }
  }
  void writeAuditLog({
    adminId: (req as AuthRequest).admin?.adminId,
    action: "doi_assigned",
    resource: "doi",
    resourceId: submissionId,
    details: { doi },
    ipAddress: req.ip
  });
  res.status(201).json(row);
};

export const listDoiNone = async (_req: Request, res: Response): Promise<void> => {
  const rows = await prisma.submission.findMany({
    where: {
      status: "Published",
      OR: [{ doiRecord: null }, { doiRecord: { doi: null } }]
    },
    include: { journal: true, doiRecord: true },
    orderBy: { updatedAt: "desc" }
  });
  res.json(rows);
};

/** @deprecated Prefer GET /pending — kept for older clients */
export const listDois = async (_req: Request, res: Response): Promise<void> => {
  const rows = await prisma.doiRecord.findMany({ include: { submission: true } });
  res.json(rows);
};

/** @deprecated Prefer POST /assign */
export const generateDoi = assignDoi;

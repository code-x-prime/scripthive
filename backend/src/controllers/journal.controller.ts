import type { Request, Response } from "express";
import type { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma.js";

export const listJournalsAdmin = async (_req: Request, res: Response): Promise<void> => {
  const publishedCounts = await prisma.submission.groupBy({
    by: ["journalId"],
    where: { status: "Published" },
    _count: { _all: true }
  });
  const countMap = Object.fromEntries(publishedCounts.map((c) => [c.journalId, c._count._all]));
  const journals = await prisma.journal.findMany({
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    include: { editorialBoard: { orderBy: { sortOrder: "asc" } } } as never
  });
  res.json(
    journals.map((j) => ({
      ...j,
      publishedPaperCount: countMap[j.id] ?? 0
    }))
  );
};

export const updateJournalIssn = async (req: Request, res: Response): Promise<void> => {
  const journalId = String(req.params.journalId);
  const { issn, eIssn } = req.body as { issn?: string | null; eIssn?: string | null };
  const data: Prisma.JournalUpdateInput = {};
  if (issn !== undefined) data.issn = issn;
  if (eIssn !== undefined) data.eIssn = eIssn;
  const updated = await prisma.journal.update({
    where: { id: journalId },
    data
  });
  res.json(updated);
};

export const listJournals = async (_req: Request, res: Response): Promise<void> => {
  const [journals, publishedCounts] = await Promise.all([
    prisma.journal.findMany({
      where: { status: "Active" },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }]
    }),
    prisma.submission.groupBy({
      by: ["journalId"],
      where: { status: "Published" },
      _count: { _all: true }
    })
  ]);
  const countMap = Object.fromEntries(publishedCounts.map((c) => [c.journalId, c._count._all]));
  res.json(
    journals.map((j) => ({
      ...j,
      slug: j.id.toLowerCase(),
      publishedCount: countMap[j.id] ?? 0
    }))
  );
};

export const getJournal = async (req: Request, res: Response): Promise<void> => {
  const journalId = String(req.params.abbr).trim().toUpperCase();
  const journal = await prisma.journal.findFirst({
    where: { id: journalId, status: "Active" },
    include: { volumes: { include: { issues: { include: { parts: true } } } } }
  });
  if (!journal) {
    res.status(404).json({ message: "Journal not found" });
    return;
  }
  res.json(journal);
};

export const getJournalArchive = async (req: Request, res: Response): Promise<void> => {
  const journalId = String(req.params.abbr).trim().toUpperCase();
  const archive = await prisma.volume.findMany({
    where: { journalId },
    include: {
      issues: {
        include: {
          parts: {
            include: {
              articles: { where: { status: "Published" } }
            }
          }
        }
      }
    },
    orderBy: { number: "desc" }
  });
  res.json(archive);
};

export const createJournal = async (req: Request, res: Response): Promise<void> => {
  const created = await prisma.journal.create({ data: req.body });
  res.status(201).json(created);
};

function normalizeOptionalEmail(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    throw new Error("Invalid email address");
  }
  return trimmed.toLowerCase();
}

function normalizeOptionalPhone(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  return trimmed || null;
}

function parseEditorialMemberBody(body: Record<string, unknown>, requireAll = false) {
  const name = String(body.name ?? "").trim();
  const role = String(body.role ?? "").trim();
  const institution = String(body.institution ?? "").trim();
  if (requireAll && (!name || !role || !institution)) {
    throw new Error("Name, role, and institution are required");
  }
  let email: string | null = null;
  let phone: string | null = null;
  try {
    if (body.email !== undefined) email = normalizeOptionalEmail(body.email);
    if (body.phone !== undefined) phone = normalizeOptionalPhone(body.phone);
  } catch (e) {
    throw e instanceof Error ? e : new Error("Invalid member data");
  }
  return { name, role, institution, email, phone, photoUrl: body.photoUrl };
}

export const listEditorialBoard = async (req: Request, res: Response): Promise<void> => {
  const journalId = String(req.params.journalId);
  const members = await prisma.editorialBoardMember.findMany({
    where: { journalId },
    orderBy: { sortOrder: "asc" }
  });
  res.json(members);
};

export const addEditorialMember = async (req: Request, res: Response): Promise<void> => {
  const journalId = String(req.params.journalId);
  const journal = await prisma.journal.findUnique({ where: { id: journalId } });
  if (!journal) {
    res.status(404).json({ message: "Journal not found" });
    return;
  }
  try {
    const parsed = parseEditorialMemberBody(req.body as Record<string, unknown>, true);
    const count = await prisma.editorialBoardMember.count({ where: { journalId } });
    const member = await prisma.editorialBoardMember.create({
      data: {
        journalId,
        name: parsed.name,
        role: parsed.role,
        institution: parsed.institution,
        email: parsed.email,
        phone: parsed.phone,
        photoUrl: parsed.photoUrl ? String(parsed.photoUrl).trim() || null : null,
        sortOrder: count
      }
    });
    res.status(201).json(member);
  } catch (e) {
    res.status(400).json({ message: e instanceof Error ? e.message : "Invalid member data" });
  }
};

export const updateEditorialMember = async (req: Request, res: Response): Promise<void> => {
  const journalId = String(req.params.journalId);
  const memberId = String(req.params.memberId);
  const existing = await prisma.editorialBoardMember.findFirst({
    where: { id: memberId, journalId }
  });
  if (!existing) {
    res.status(404).json({ message: "Member not found" });
    return;
  }
  try {
    const body = req.body as Record<string, unknown>;
    const data: Prisma.EditorialBoardMemberUpdateInput = {};
    if (body.name !== undefined) {
      const name = String(body.name).trim();
      if (!name) throw new Error("Name is required");
      data.name = name;
    }
    if (body.role !== undefined) {
      const role = String(body.role).trim();
      if (!role) throw new Error("Role is required");
      data.role = role;
    }
    if (body.institution !== undefined) {
      const institution = String(body.institution).trim();
      if (!institution) throw new Error("Institution is required");
      data.institution = institution;
    }
    if (body.email !== undefined) data.email = normalizeOptionalEmail(body.email);
    if (body.phone !== undefined) data.phone = normalizeOptionalPhone(body.phone);
    if (body.photoUrl !== undefined) {
      data.photoUrl = body.photoUrl ? String(body.photoUrl).trim() || null : null;
    }
    const updated = await prisma.editorialBoardMember.update({ where: { id: memberId }, data });
    res.json(updated);
  } catch (e) {
    res.status(400).json({ message: e instanceof Error ? e.message : "Invalid member data" });
  }
};

export const removeEditorialMember = async (req: Request, res: Response): Promise<void> => {
  const journalId = String(req.params.journalId);
  const memberId = String(req.params.memberId);
  const existing = await prisma.editorialBoardMember.findFirst({
    where: { id: memberId, journalId }
  });
  if (!existing) {
    res.status(404).json({ message: "Member not found" });
    return;
  }
  await prisma.editorialBoardMember.delete({ where: { id: memberId } });
  res.json({ message: "Removed" });
};

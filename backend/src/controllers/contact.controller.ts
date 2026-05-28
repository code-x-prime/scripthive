import type { Request, Response } from "express";
import { prisma } from "../config/prisma.js";

export const createContactQuery = async (req: Request, res: Response): Promise<void> => {
  const { name, email, phone, subject, message } = req.body as Record<string, string>;
  if (!name?.trim() || !email?.trim() || !subject?.trim() || !message?.trim()) {
    res.status(400).json({ message: "name, email, subject, message required" });
    return;
  }
  const queryId = `QRY-${Math.floor(10000 + Math.random() * 90000)}`;
  const query = await prisma.contactQuery.create({
    data: {
      queryId,
      name:    name.trim(),
      email:   email.trim().toLowerCase(),
      phone:   phone?.trim() || null,
      subject: subject.trim(),
      message: message.trim(),
      status:  "New",
      ipAddress: req.ip ?? null
    }
  });
  res.status(201).json({ success: true, queryId: query.queryId });
};

export const listContactQueries = async (req: Request, res: Response): Promise<void> => {
  const status = typeof req.query.status === "string" ? req.query.status : undefined;
  const rows = await prisma.contactQuery.findMany({
    where: status ? { status } : {},
    orderBy: { createdAt: "desc" }
  });
  res.json(rows);
};

export const getContactQuery = async (req: Request, res: Response): Promise<void> => {
  const row = await prisma.contactQuery.findUnique({ where: { id: String(req.params.id) } });
  if (!row) { res.status(404).json({ message: "Not found" }); return; }
  res.json(row);
};

export const updateContactQueryStatus = async (req: Request, res: Response): Promise<void> => {
  const allowed = ["New", "In Progress", "Resolved", "Closed"];
  const { status } = req.body as { status: string };
  if (!allowed.includes(status)) { res.status(400).json({ message: "Invalid status" }); return; }
  const row = await prisma.contactQuery.update({
    where: { id: String(req.params.id) },
    data: { status }
  });
  res.json(row);
};

export const deleteContactQuery = async (req: Request, res: Response): Promise<void> => {
  await prisma.contactQuery.delete({ where: { id: String(req.params.id) } });
  res.json({ message: "Deleted" });
};

import type { Request, Response } from "express";
import { computeReports } from "../services/reports.service.js";
import { prisma } from "../config/prisma.js";

export const getReports = async (_req: Request, res: Response): Promise<void> => {
  const data = await computeReports();
  res.json(data);
};

/** @deprecated Use GET / */
export const overview = async (_req: Request, res: Response): Promise<void> => {
  const data = await computeReports();
  res.json({
    totalSubmissions: data.summary.totalSubmissions,
    published: data.summary.published,
    totalInvoices: data.summary.paidInvoices + data.summary.pendingInvoices
  });
};

export const getActivityReport = async (req: Request, res: Response): Promise<void> => {
  const days = Math.min(parseInt(String(req.query.days ?? "30"), 10) || 30, 90);
  const since = new Date(Date.now() - days * 86400000);

  const logs = await prisma.auditLog.findMany({
    where: { createdAt: { gte: since } },
    include: { admin: { select: { id: true, name: true, role: { select: { name: true, displayName: true } } } } },
    orderBy: { createdAt: "desc" }
  });

  // per-day counts
  const dayMap = new Map<string, number>();
  for (let i = 0; i < days; i++) {
    const d = new Date(Date.now() - i * 86400000);
    const key = d.toISOString().slice(0, 10);
    dayMap.set(key, 0);
  }
  for (const log of logs) {
    const key = log.createdAt.toISOString().slice(0, 10);
    if (dayMap.has(key)) dayMap.set(key, (dayMap.get(key) ?? 0) + 1);
  }
  const dailyActivity = Array.from(dayMap.entries())
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // per-user summary
  const userMap = new Map<string, { adminId: string; name: string; role: string; actions: Record<string, number>; total: number }>();
  for (const log of logs) {
    const uid = log.adminId ?? "__system__";
    const name = log.admin?.name ?? "System";
    const role = log.admin?.role?.displayName ?? log.admin?.role?.name ?? "—";
    if (!userMap.has(uid)) userMap.set(uid, { adminId: uid, name, role, actions: {}, total: 0 });
    const entry = userMap.get(uid)!;
    entry.total += 1;
    entry.actions[log.action] = (entry.actions[log.action] ?? 0) + 1;
  }
  const userSummary = Array.from(userMap.values()).sort((a, b) => b.total - a.total);

  res.json({ days, dailyActivity, userSummary, recentLogs: logs.slice(0, 200) });
};

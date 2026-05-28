import { prisma } from "../config/prisma.js";

export interface ReportsSummary {
  totalSubmissions: number;
  published: number;
  underReview: number;
  accepted: number;
  pending: number;
  rejected: number;
  totalRevenueUsd: number;
  totalRevenueInr: number;
  pendingInvoices: number;
  paidInvoices: number;
  mintedDoi: number;
  pendingDoi: number;
}

export interface LabelCount {
  label: string;
  count: number;
}

export interface MonthlySubmissions {
  month: string;
  submissions: number;
  published: number;
}

export interface MonthlyRevenue {
  month: string;
  usd: number;
  inr: number;
}

export interface ReportsPayload {
  summary: ReportsSummary;
  submissionsByStatus: LabelCount[];
  submissionsByJournal: LabelCount[];
  monthlySubmissions: MonthlySubmissions[];
  monthlyRevenue: MonthlyRevenue[];
  productionPipeline: LabelCount[];
  paymentsByStatus: LabelCount[];
}

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string): string {
  const [y, m] = key.split("-");
  const mi = parseInt(m ?? "1", 10) - 1;
  return `${MONTH_LABELS[mi] ?? m} ${y?.slice(2) ?? ""}`;
}

function lastNMonthKeys(n: number): string[] {
  const keys: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    keys.push(monthKey(d));
  }
  return keys;
}

export async function computeReports(): Promise<ReportsPayload> {
  const monthKeys = lastNMonthKeys(6);
  const oldestMonth = new Date(`${monthKeys[0]}-01T00:00:00.000Z`);

  const [
    totalSubmissions,
    published,
    underReview,
    accepted,
    pending,
    rejected,
    statusGroups,
    journalGroups,
    allSubsSince,
    publishedSince,
    paidInvoices,
    pendingInvoiceCount,
    paidInvoiceCount,
    mintedDoi,
    pendingDoiCount,
    productionGroups,
    invoiceStatusGroups
  ] = await Promise.all([
    prisma.submission.count(),
    prisma.submission.count({ where: { status: "Published" } }),
    prisma.submission.count({ where: { status: "UnderReview" } }),
    prisma.submission.count({ where: { status: "Accepted" } }),
    prisma.submission.count({ where: { status: "Pending" } }),
    prisma.submission.count({ where: { status: "Rejected" } }),
    prisma.submission.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.submission.groupBy({ by: ["journalId"], _count: { _all: true } }),
    prisma.submission.findMany({
      where: { createdAt: { gte: oldestMonth } },
      select: { createdAt: true, status: true }
    }),
    prisma.submission.findMany({
      where: { status: "Published", pubDate: { gte: oldestMonth } },
      select: { pubDate: true }
    }),
    prisma.invoice.findMany({
      where: { status: "Paid", paidAt: { gte: oldestMonth } },
      select: { paidAt: true, total: true, currency: true }
    }),
    prisma.invoice.count({ where: { status: { in: ["Draft", "Pending"] } } }),
    prisma.invoice.count({ where: { status: "Paid" } }),
    prisma.doiRecord.count({ where: { doi: { not: null } } }),
    prisma.submission.count({
      where: {
        status: "Accepted",
        paymentStatus: "Paid",
        OR: [{ doiRecord: null }, { doiRecord: { doi: null } }]
      }
    }),
    prisma.submission.groupBy({
      by: ["productionStatus"],
      where: { productionStatus: { not: null } },
      _count: { _all: true }
    }),
    prisma.invoice.groupBy({ by: ["status"], _count: { _all: true } })
  ]);

  const [revUsdAgg, revInrAgg] = await Promise.all([
    prisma.invoice.aggregate({
      where: { status: "Paid", currency: "USD" },
      _sum: { total: true }
    }),
    prisma.invoice.aggregate({
      where: { status: "Paid", currency: "INR" },
      _sum: { total: true }
    })
  ]);

  const journals = await prisma.journal.findMany({ select: { id: true, name: true } });
  const journalNameMap = Object.fromEntries(journals.map((j) => [j.id, j.name]));

  const submissionsByStatus = statusGroups
    .map((g) => ({ label: g.status, count: g._count._all }))
    .sort((a, b) => b.count - a.count);

  const submissionsByJournal = journalGroups
    .map((g) => ({
      label: g.journalId,
      count: g._count._all
    }))
    .sort((a, b) => b.count - a.count)
    .map((g) => ({
      label: journalNameMap[g.label] ? `${g.label}` : g.label,
      count: g.count
    }));

  const subMonthMap = new Map<string, { submissions: number; published: number }>();
  for (const k of monthKeys) subMonthMap.set(k, { submissions: 0, published: 0 });

  for (const s of allSubsSince) {
    const k = monthKey(s.createdAt);
    if (!subMonthMap.has(k)) continue;
    subMonthMap.get(k)!.submissions += 1;
  }
  for (const s of publishedSince) {
    const d = s.pubDate ?? new Date();
    const k = monthKey(d);
    if (!subMonthMap.has(k)) continue;
    subMonthMap.get(k)!.published += 1;
  }

  const monthlySubmissions = monthKeys.map((k) => ({
    month: monthLabel(k),
    submissions: subMonthMap.get(k)?.submissions ?? 0,
    published: subMonthMap.get(k)?.published ?? 0
  }));

  const revMonthMap = new Map<string, { usd: number; inr: number }>();
  for (const k of monthKeys) revMonthMap.set(k, { usd: 0, inr: 0 });

  for (const inv of paidInvoices) {
    if (!inv.paidAt) continue;
    const k = monthKey(inv.paidAt);
    if (!revMonthMap.has(k)) continue;
    const bucket = revMonthMap.get(k)!;
    if (inv.currency === "INR") bucket.inr += inv.total;
    else bucket.usd += inv.total;
  }

  const monthlyRevenue = monthKeys.map((k) => ({
    month: monthLabel(k),
    usd: Math.round((revMonthMap.get(k)?.usd ?? 0) * 100) / 100,
    inr: Math.round(revMonthMap.get(k)?.inr ?? 0)
  }));

  const productionLabels: Record<string, string> = {
    ReadyForPreparation: "Ready for preparation",
    ReadyForUpload: "Ready for upload",
    ReadyToPublished: "Ready to publish"
  };

  const productionPipeline = productionGroups.map((g) => ({
    label: productionLabels[g.productionStatus ?? ""] ?? g.productionStatus ?? "Unknown",
    count: g._count._all
  }));

  const paymentsByStatus = invoiceStatusGroups
    .map((g) => ({ label: g.status, count: g._count._all }))
    .sort((a, b) => b.count - a.count);

  return {
    summary: {
      totalSubmissions,
      published,
      underReview,
      accepted,
      pending,
      rejected,
      totalRevenueUsd: revUsdAgg._sum.total ?? 0,
      totalRevenueInr: revInrAgg._sum.total ?? 0,
      pendingInvoices: pendingInvoiceCount,
      paidInvoices: paidInvoiceCount,
      mintedDoi,
      pendingDoi: pendingDoiCount
    },
    submissionsByStatus,
    submissionsByJournal,
    monthlySubmissions,
    monthlyRevenue,
    productionPipeline,
    paymentsByStatus
  };
}

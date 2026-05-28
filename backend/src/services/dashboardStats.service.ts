import { prisma } from "../config/prisma.js";
import { submissionAuthorsArray } from "../utils/submissionAuthors.js";

export interface DashboardChanges {
  totalSubmissionsPercent: number | null;
  pendingReviewsPercent: number | null;
  pendingPreparationPercent: number | null;
  pendingPublishedPercent: number | null;
}

export interface DashboardStatsPayload {
  totalSubmissions: number;
  pendingReviews: number;
  pendingPreparation: number;
  /** Paid APC, manuscript not yet published. */
  pendingPublished: number;
  changes: DashboardChanges;
  recentManuscripts: Array<{
    id: string;
    title: string;
    journalCode: string;
    journalName: string;
    authors: string[];
    status: string;
  }>;
}

function utcMonthStart(year: number, monthIndex: number): Date {
  return new Date(Date.UTC(year, monthIndex, 1, 0, 0, 0, 0));
}

function pctChange(current: number, previous: number): number | null {
  if (previous === 0 && current === 0) return null;
  if (previous === 0) return current > 0 ? 100 : null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

export async function computeDashboardStats(): Promise<DashboardStatsPayload> {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const thisMonthStart = utcMonthStart(y, m);
  const nextMonthStart = utcMonthStart(y, m + 1);
  const lastMonthStart = m === 0 ? utcMonthStart(y - 1, 11) : utcMonthStart(y, m - 1);
  const lastMonthEnd = thisMonthStart;

  const [
    totalSubmissions,
    pendingReviews,
    pendingPreparation,
    recentRows,
    pendingPublished,
    paidAwaitingPublishThisMonth,
    paidAwaitingPublishLastMonth,
    newSubsThisMonth,
    newSubsLastMonth,
    underReviewActivityThisMonth,
    underReviewActivityLastMonth,
    prepThisMonth,
    prepLastMonth
  ] = await Promise.all([
    prisma.submission.count(),
    prisma.submission.count({ where: { status: "UnderReview" } }),
    // pendingPreparation = in active production pipeline (preparation or upload stage)
    prisma.submission.count({
      where: {
        status: { not: "Published" },
        productionStatus: { in: ["ReadyForPreparation", "ReadyForUpload"] }
      }
    }),
    prisma.submission.findMany({
      include: { journal: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
      take: 10
    }),
    // pendingPublished = ready to publish (awaiting final publish action)
    prisma.submission.count({
      where: {
        status: { not: "Published" },
        productionStatus: "ReadyToPublished"
      }
    }),
    // paidAwaitingPublishThisMonth — ReadyToPublished moved this month
    prisma.submission.count({
      where: {
        status: { not: "Published" },
        productionStatus: "ReadyToPublished",
        updatedAt: { gte: thisMonthStart, lt: nextMonthStart }
      }
    }),
    // paidAwaitingPublishLastMonth
    prisma.submission.count({
      where: {
        status: { not: "Published" },
        productionStatus: "ReadyToPublished",
        updatedAt: { gte: lastMonthStart, lt: lastMonthEnd }
      }
    }),
    prisma.submission.count({
      where: { createdAt: { gte: thisMonthStart, lt: nextMonthStart } }
    }),
    prisma.submission.count({
      where: { createdAt: { gte: lastMonthStart, lt: lastMonthEnd } }
    }),
    // MoM % for "Pending reviews": submissions still UnderReview that were updated in each month
    // (proxy for review-stage activity; true backlog deltas need a status history table).
    prisma.submission.count({
      where: {
        status: "UnderReview",
        updatedAt: { gte: thisMonthStart, lt: nextMonthStart }
      }
    }),
    prisma.submission.count({
      where: {
        status: "UnderReview",
        updatedAt: { gte: lastMonthStart, lt: lastMonthEnd }
      }
    }),
    prisma.submission.count({
      where: {
        updatedAt: { gte: thisMonthStart, lt: nextMonthStart },
        status: { not: "Published" },
        productionStatus: { in: ["ReadyForPreparation", "ReadyForUpload"] }
      }
    }),
    prisma.submission.count({
      where: {
        updatedAt: { gte: lastMonthStart, lt: lastMonthEnd },
        status: { not: "Published" },
        productionStatus: { in: ["ReadyForPreparation", "ReadyForUpload"] }
      }
    })
  ]);

  const changes: DashboardChanges = {
    totalSubmissionsPercent: pctChange(newSubsThisMonth, newSubsLastMonth),
    pendingReviewsPercent: pctChange(underReviewActivityThisMonth, underReviewActivityLastMonth),
    pendingPreparationPercent: pctChange(prepThisMonth, prepLastMonth),
    pendingPublishedPercent: pctChange(paidAwaitingPublishThisMonth, paidAwaitingPublishLastMonth)
  };

  const recentManuscripts = recentRows.map((s) => ({
    id: s.id,
    title: s.title,
    journalCode: s.journal.id,
    journalName: s.journal.name,
    authors: submissionAuthorsArray(s.authorName, s.coAuthors),
    status: s.status
  }));

  return {
    totalSubmissions,
    pendingReviews,
    pendingPreparation,
    pendingPublished,
    changes,
    recentManuscripts
  };
}

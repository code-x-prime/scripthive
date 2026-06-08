import type { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma.js";
import { apcAmountForCurrency, loadApcRates } from "./apcSettings.service.js";
import { generateInvoiceId, getFinancialYear } from "../utils/generateId.js";

/** Creates a Draft APC invoice when a submission is accepted, if none exists yet. */
export async function ensureDraftInvoiceForSubmission(submissionId: string): Promise<void> {
  const existing = await prisma.invoice.findFirst({
    where: { submissionId },
    orderBy: { createdAt: "desc" }
  });
  if (existing) return;

  const sub = await prisma.submission.findUnique({ where: { id: submissionId } });
  if (!sub) return;

  const apc = await loadApcRates();
  const country = (sub.country ?? "").trim().toLowerCase();
  const isIndia = country === "india" || country === "in";
  const currency = isIndia ? "INR" : "USD";
  const total = apcAmountForCurrency(currency, apc);
  const now = new Date();
  const fy = getFinancialYear(now);
  const fyCount = await prisma.invoice.count({
    where: {
      createdAt: { gte: fy.start, lte: fy.end },
      id: { startsWith: "SH/" }
    }
  });
  const items = [{ description: "Article Processing Charge (APC)", amount: total }] as unknown as Prisma.InputJsonValue;

  await prisma.invoice.create({
    data: {
      id: generateInvoiceId(now, fyCount + 1),
      submissionId: sub.id,
      customerName: sub.authorName,
      customerEmail: sub.authorEmail,
      items,
      subtotal: total,
      tax: 0,
      total,
      currency,
      status: "Draft"
    }
  });
}

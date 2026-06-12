import type { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma.js";
import { apcAmountForCurrency, loadApcRates } from "./apcSettings.service.js";
import { generateInvoiceId, getFinancialYear } from "../utils/generateId.js";
import { sendPaymentLinkEmail } from "./email.service.js";
import { env } from "../config/env.js";

/** Creates advance invoice immediately after submission (before accept/reject). */
export async function createAdvanceInvoice(submissionId: string): Promise<{ invoiceId: string; total: number; currency: string }> {
  const existing = await prisma.invoice.findFirst({
    where: { submissionId },
    orderBy: { createdAt: "desc" }
  });
  if (existing) return { invoiceId: existing.id, total: existing.total, currency: existing.currency };

  const sub = await prisma.submission.findUnique({ where: { id: submissionId } });
  if (!sub) throw new Error("Submission not found");

  const apc = await loadApcRates();
  const country = (sub.country ?? "").trim().toLowerCase();
  const isIndia = country === "india" || country === "in";
  const currency = isIndia ? "INR" : "USD";
  const apcAmount = apcAmountForCurrency(currency, apc);

  let addonsTotal = 0;
  const addonItems: { description: string; amount: number }[] = [];
  if (sub.addons && Array.isArray(sub.addons)) {
    for (const addon of sub.addons as { label?: string; price?: number; priceUsd?: number }[]) {
      if (addon.price && addon.label) {
        const addonAmt = isIndia ? addon.price : (addon.priceUsd ?? Math.round((addon.price / 83) * 100) / 100);
        addonItems.push({ description: addon.label, amount: addonAmt });
        addonsTotal += addonAmt;
      }
    }
  }

  const total = apcAmount + addonsTotal;
  const lineItems = [
    { description: "Article Processing Charge (APC)", amount: apcAmount },
    ...addonItems
  ] as unknown as Prisma.InputJsonValue;

  const now = new Date();
  const fy = getFinancialYear(now);
  const fyCount = await prisma.invoice.count({
    where: { createdAt: { gte: fy.start, lte: fy.end }, id: { startsWith: "SH/" } }
  });

  const invoice = await prisma.invoice.create({
    data: {
      id: generateInvoiceId(now, fyCount + 1),
      submissionId: sub.id,
      customerName: sub.authorName,
      customerEmail: sub.authorEmail,
      items: lineItems,
      subtotal: total,
      tax: 0,
      total,
      currency,
      status: "Pending"
    }
  });

  return { invoiceId: invoice.id, total, currency };
}

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
  const apcAmount = apcAmountForCurrency(currency, apc);

  // Parse addons from submission — addons stored in INR, convert if USD
  let addonsTotal = 0;
  const addonItems: { description: string; amount: number }[] = [];
  if (sub.addons && Array.isArray(sub.addons)) {
    for (const addon of sub.addons as { label?: string; price?: number; priceUsd?: number; currency?: string }[]) {
      if (addon.price && addon.label) {
        const addonAmt = isIndia
          ? addon.price
          : (addon.priceUsd ?? Math.round((addon.price / 83) * 100) / 100);
        addonItems.push({ description: addon.label, amount: addonAmt });
        addonsTotal += addonAmt;
      }
    }
  }

  const total = apcAmount + addonsTotal;
  const lineItems = [
    { description: "Article Processing Charge (APC)", amount: apcAmount },
    ...addonItems
  ] as unknown as Prisma.InputJsonValue;

  const now = new Date();
  const fy = getFinancialYear(now);
  const fyCount = await prisma.invoice.count({
    where: {
      createdAt: { gte: fy.start, lte: fy.end },
      id: { startsWith: "SH/" }
    }
  });

  await prisma.invoice.create({
    data: {
      id: generateInvoiceId(now, fyCount + 1),
      submissionId: sub.id,
      customerName: sub.authorName,
      customerEmail: sub.authorEmail,
      items: lineItems,
      subtotal: total,
      tax: 0,
      total,
      currency,
      status: "Pending"
    }
  });

  // Auto-send payment link email
  const paymentLink = `${env.FRONTEND_URL}/pay/${sub.id}`;
  const journalRec = await prisma.journal.findUnique({ where: { id: sub.journalId } }).catch(() => null);
  void sendPaymentLinkEmail(
    sub.authorEmail,
    sub.authorName,
    sub.id,
    paymentLink,
    journalRec?.name,
    journalRec?.issn,
    journalRec?.eIssn
  ).catch(() => { /* non-blocking */ });
}

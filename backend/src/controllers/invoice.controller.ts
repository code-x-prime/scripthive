import { Prisma } from "@prisma/client";
import type { Request, Response } from "express";
import { prisma } from "../config/prisma.js";
import { env } from "../config/env.js";
import { sendPaymentLinkEmail, sendPaymentReceiptEmail } from "../services/email.service.js";
import { generateInvoiceId, getFinancialYear } from "../utils/generateId.js";
import { apcAmountForCurrency, loadApcRates } from "../services/apcSettings.service.js";
import { ensureDraftInvoiceForSubmission } from "../services/invoiceDraft.service.js";
import { writeAuditLog } from "../utils/auditLog.js";
import type { AuthRequest } from "../middlewares/auth.middleware.js";
import { generateInvoicePdf } from "../services/invoicePdf.service.js";

export const createInvoice = async (req: Request, res: Response): Promise<void> => {
  const body = req.body as {
    submissionId: string;
    customerName?: string;
    customerEmail?: string;
    subtotal?: number;
    tax?: number;
    total: number;
    items?: Prisma.InputJsonValue;
    currency: string;
    status?: string;
  };

  if (!body.submissionId || !body.total || !body.currency) {
    res.status(400).json({ message: "submissionId, total, currency required" });
    return;
  }

  // Auto-fill customerName/customerEmail from submission if not provided
  let customerName = body.customerName;
  let customerEmail = body.customerEmail;
  if (!customerName || !customerEmail) {
    const sub = await prisma.submission.findUnique({ where: { id: body.submissionId }, select: { authorName: true, authorEmail: true } });
    if (!sub) { res.status(404).json({ message: "Submission not found" }); return; }
    customerName = customerName || sub.authorName;
    customerEmail = customerEmail || sub.authorEmail;
  }

  const now = new Date();
  const fy = getFinancialYear(now);
  const fyCount = await prisma.invoice.count({
    where: { createdAt: { gte: fy.start, lte: fy.end }, id: { startsWith: "SH/" } }
  });
  const invoice = await prisma.invoice.create({
    data: {
      id: generateInvoiceId(now, fyCount + 1),
      submissionId: body.submissionId,
      customerName: customerName!,
      customerEmail: customerEmail!,
      items: body.items ?? [],
      subtotal: body.subtotal ?? body.total,
      tax: body.tax ?? 0,
      total: body.total,
      currency: body.currency,
      status: body.status ?? "Paid"
    }
  });
  res.status(201).json(invoice);
};

export const listInvoices = async (_req: Request, res: Response): Promise<void> => {
  res.json(await prisma.invoice.findMany({ include: { submission: true }, orderBy: { createdAt: "desc" } }));
};

export const getInvoice = async (req: Request, res: Response): Promise<void> => {
  const id = String(req.params.id);
  let invoice = await prisma.invoice.findUnique({
    where: { id },
    include: { submission: { include: { journal: true } } }
  });
  if (!invoice) {
    invoice = await prisma.invoice.findFirst({
      where: { submissionId: id },
      orderBy: { createdAt: "desc" },
      include: { submission: { include: { journal: true } } }
    });
  }
  if (!invoice) {
    res.status(404).json({ message: "Invoice not found" });
    return;
  }
  res.json(invoice);
};

export const sendInvoiceLink = async (req: Request, res: Response): Promise<void> => {
  const invoiceId = String(req.params.id);
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { submission: { include: { journal: true } } }
  });
  if (!invoice) {
    res.status(404).json({ message: "Invoice not found" });
    return;
  }
  const paymentLink = `${env.FRONTEND_URL}/pay/${invoice.submissionId}`;
  const journal = invoice.submission?.journal;
  await sendPaymentLinkEmail(
    invoice.customerEmail,
    invoice.customerName,
    invoice.submissionId,
    paymentLink,
    journal?.name,
    journal?.issn,
    journal?.eIssn
  );
  const nextStatus =
    invoice.status === "Draft" ? "Pending" : invoice.status === "Pending" ? "Pending" : invoice.status;
  const updated = await prisma.invoice.update({
    where: { id: invoiceId },
    data: { status: nextStatus }
  });
  res.json({ message: "Payment link email sent", paymentLink, invoice: updated });
};

export const createDraftFromSubmission = async (req: Request, res: Response): Promise<void> => {
  const submissionId = String(req.params.submissionId);
  const sub = await prisma.submission.findUnique({ where: { id: submissionId } });
  if (!sub) {
    res.status(404).json({ message: "Submission not found" });
    return;
  }
  if (!["Accepted", "Published"].includes(sub.status)) {
    res.status(400).json({ message: "Only accepted or published submissions can have an APC invoice" });
    return;
  }
  await ensureDraftInvoiceForSubmission(submissionId);
  const inv = await prisma.invoice.findFirst({
    where: { submissionId },
    orderBy: { createdAt: "desc" },
    include: { submission: true }
  });
  if (!inv) {
    res.status(500).json({ message: "Could not create invoice" });
    return;
  }
  res.status(201).json(inv);
};

export const updateInvoice = async (req: Request, res: Response): Promise<void> => {
  const invoiceId = String(req.params.id);
  const body = req.body as {
    total?: number;
    currency?: string;
    dueDate?: string | null;
    status?: string;
  };
  const data: Prisma.InvoiceUpdateInput = {};
  const currencyChanged = typeof body.currency === "string";
  if (currencyChanged) {
    data.currency = body.currency!.toUpperCase();
  }
  if (typeof body.total === "number") {
    data.total = body.total;
    data.subtotal = body.total;
    data.items = [{ description: "Article Processing Charge (APC)", amount: body.total }] as Prisma.InputJsonValue;
  } else if (currencyChanged && typeof data.currency === "string") {
    const apc = await loadApcRates();
    const total = apcAmountForCurrency(data.currency, apc);
    data.total = total;
    data.subtotal = total;
    data.items = [{ description: "Article Processing Charge (APC)", amount: total }] as Prisma.InputJsonValue;
  }
  if (body.dueDate !== undefined) {
    data.dueDate = body.dueDate ? new Date(body.dueDate) : null;
  }
  if (typeof body.status === "string") data.status = body.status;
  const invoice = await prisma.invoice.update({
    where: { id: invoiceId },
    data
  });
  res.json(invoice);
};

// Manual mark-as-paid by admin → also moves submission to ReadyForPreparation
export const markInvoicePaidManual = async (req: Request, res: Response): Promise<void> => {
  const invoiceId = String(req.params.id);
  const { method: paymentMethod, remarks, utr } = req.body as { method?: string; remarks?: string; utr?: string };
  const resolvedMethod = paymentMethod?.trim() || "Manual";
  const noteParts = [`Method: ${resolvedMethod}`];
  if (utr?.trim()) noteParts.push(`Ref/UTR: ${utr.trim()}`);
  if (remarks?.trim()) noteParts.push(`Remarks: ${remarks.trim()}`);
  const resolvedNotes = noteParts.join(" | ");

  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) { res.status(404).json({ message: "Invoice not found" }); return; }
  if (invoice.status === "Paid") { res.status(400).json({ message: "Already paid" }); return; }

  let finalInvoiceId = invoiceId;
  if (!invoiceId.startsWith("SH/")) {
    const now = new Date();
    const fy = getFinancialYear(now);
    const fyCount = await prisma.invoice.count({
      where: {
        createdAt: { gte: fy.start, lte: fy.end },
        id: { startsWith: "SH/" }
      }
    });
    finalInvoiceId = generateInvoiceId(now, fyCount + 1);
    await prisma.$executeRawUnsafe(
      `UPDATE "Invoice" SET "id" = $1 WHERE "id" = $2`,
      finalInvoiceId,
      invoiceId
    );
  }

  const now = new Date();
  await prisma.invoice.update({
    where: { id: finalInvoiceId },
    data: { status: "Paid", paidAt: now, method: resolvedMethod, notes: resolvedNotes, ...(utr?.trim() ? { gatewayPayId: utr.trim() } : {}) }
  });

  // move submission to ReadyForPreparation + mark payment paid
  if (invoice.submissionId) {
    await prisma.submission.update({
      where: { id: invoice.submissionId },
      data: {
        paymentStatus: "Paid",
        paymentMethod: resolvedMethod,
        paidAt: now,
        productionStatus: "ReadyForPreparation"
      }
    });
  }

  void writeAuditLog({
    adminId: (req as AuthRequest).admin?.adminId,
    action: "payment_manual_paid",
    resource: "invoice",
    resourceId: finalInvoiceId,
    details: { submissionId: invoice.submissionId, method: "Manual" },
    ipAddress: req.ip
  });

  // send receipt email non-blocking
  if (invoice.submissionId) {
    const sub = await prisma.submission.findUnique({
      where: { id: invoice.submissionId },
      include: { journal: true }
    });
    if (sub) {
      void sendPaymentReceiptEmail(
        sub.authorEmail,
        finalInvoiceId,
        invoice.total,
        invoice.currency,
        "MANUAL",
        invoice.submissionId,
        sub.journal?.name,
        sub.journal?.issn,
        sub.journal?.eIssn
      ).catch(() => { });
      void sendPaymentReceiptEmail(
        env.ADMIN_EMAIL,
        finalInvoiceId,
        invoice.total,
        invoice.currency,
        "MANUAL",
        invoice.submissionId,
        sub.journal?.name,
        sub.journal?.issn,
        sub.journal?.eIssn
      ).catch(() => { });
    }
  }

  res.json({ success: true, message: "Marked as paid — submission moved to Ready for Preparation", invoiceId: finalInvoiceId });
};

export const createManualInvoice = async (req: Request, res: Response): Promise<void> => {
  const { submissionId, total, currency, customerName, customerEmail, method, notes } = req.body as {
    submissionId?: string;
    total: number;
    currency: string;
    customerName?: string;
    customerEmail?: string;
    method?: string;
    notes?: string;
  };

  if (!total || !currency) {
    res.status(400).json({ message: "total and currency required" });
    return;
  }
  if (!customerName && !submissionId) {
    res.status(400).json({ message: "customerName or submissionId required" });
    return;
  }

  let resolvedName = customerName;
  let resolvedEmail = customerEmail ?? "";

  if (submissionId) {
    const sub = await prisma.submission.findUnique({ where: { id: submissionId } });
    if (!sub) { res.status(404).json({ message: "Submission not found" }); return; }
    resolvedName = resolvedName ?? sub.authorName;
    resolvedEmail = resolvedEmail || sub.authorEmail;
  }

  const now = new Date();
  const fy = getFinancialYear(now);
  const fyCount = await prisma.invoice.count({
    where: { createdAt: { gte: fy.start, lte: fy.end }, id: { startsWith: "SH/" } }
  });
  const invoiceId = generateInvoiceId(now, fyCount + 1);

  const invoice = await prisma.invoice.create({
    data: {
      id: invoiceId,
      ...(submissionId ? { submissionId } : {}),
      customerName: resolvedName!,
      customerEmail: resolvedEmail,
      items: [{ description: "Article Processing Charge (APC)", amount: total }],
      subtotal: total,
      tax: 0,
      total,
      currency: currency.toUpperCase(),
      status: "Paid",
      paidAt: now,
      method: method ?? "Manual",
      notes: notes ?? "Manual invoice created by admin"
    }
  });

  if (submissionId) {
    await prisma.submission.update({
      where: { id: submissionId },
      data: { paymentStatus: "Paid", paymentMethod: method ?? "Manual", paidAt: now }
    });
  }

  res.status(201).json(invoice);
};

export const downloadInvoicePdf = async (req: Request, res: Response): Promise<void> => {
  const id = String(req.params.id);
  let invoice = await prisma.invoice.findUnique({
    where: { id },
    include: { submission: { include: { journal: true } } }
  });
  if (!invoice) {
    invoice = await prisma.invoice.findFirst({
      where: { submissionId: id },
      orderBy: { createdAt: "desc" },
      include: { submission: { include: { journal: true } } }
    });
  }
  if (!invoice) {
    res.status(404).json({ message: "Invoice not found" });
    return;
  }

  const items = Array.isArray(invoice.items)
    ? (invoice.items as { description: string; amount: number }[])
    : [];

  const pdfBuffer = await generateInvoicePdf({
    invoiceId: invoice.id,
    submissionId: invoice.submissionId,
    customerName: invoice.customerName,
    customerEmail: invoice.customerEmail,
    items,
    subtotal: invoice.subtotal,
    tax: invoice.tax,
    total: invoice.total,
    currency: invoice.currency,
    status: invoice.status,
    createdAt: invoice.createdAt,
    paidAt: invoice.paidAt,
    method: invoice.method,
    journalName: invoice.submission?.journal?.name,
    issn: invoice.submission?.journal?.issn,
    eIssn: invoice.submission?.journal?.eIssn,
    paperTitle: invoice.submission?.title
  });

  const safeId = invoice.id.replace(/\//g, "-");
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="invoice-${safeId}.pdf"`);
  res.send(pdfBuffer);
};

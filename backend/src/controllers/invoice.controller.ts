import { Prisma } from "@prisma/client";
import type { Request, Response } from "express";
import { prisma } from "../config/prisma.js";
import { env } from "../config/env.js";
import { sendPaymentLinkEmail, sendPaymentReceiptEmail } from "../services/email.service.js";
import { generateInvoiceId } from "../utils/generateId.js";
import { apcAmountForCurrency, loadApcRates } from "../services/apcSettings.service.js";
import { ensureDraftInvoiceForSubmission } from "../services/invoiceDraft.service.js";
import { writeAuditLog } from "../utils/auditLog.js";
import type { AuthRequest } from "../middlewares/auth.middleware.js";

export const createInvoice = async (req: Request, res: Response): Promise<void> => {
  const count = await prisma.invoice.count();
  const body = req.body as {
    submissionId: string;
    customerName: string;
    customerEmail: string;
    subtotal: number;
    tax: number;
    total: number;
    items: Prisma.InputJsonValue;
    currency: string;
  };
  const invoice = await prisma.invoice.create({
    data: {
      id: generateInvoiceId(new Date(), count + 1),
      ...body
    }
  });
  res.status(201).json(invoice);
};

export const listInvoices = async (_req: Request, res: Response): Promise<void> => {
  res.json(await prisma.invoice.findMany({ include: { submission: true }, orderBy: { createdAt: "desc" } }));
};

export const getInvoice = async (req: Request, res: Response): Promise<void> => {
  const invoice = await prisma.invoice.findUnique({
    where: { id: String(req.params.id) },
    include: { submission: true }
  });
  if (!invoice) {
    res.status(404).json({ message: "Invoice not found" });
    return;
  }
  res.json(invoice);
};

export const sendInvoiceLink = async (req: Request, res: Response): Promise<void> => {
  const invoiceId = String(req.params.id);
  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) {
    res.status(404).json({ message: "Invoice not found" });
    return;
  }
  const paymentLink = `${env.FRONTEND_URL}/pay/${invoice.id}`;
  await sendPaymentLinkEmail(invoice.customerEmail, invoice.customerName, invoice.id, paymentLink);
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
  if (sub.status !== "Accepted") {
    res.status(400).json({ message: "Only accepted submissions can have an APC invoice" });
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
  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) { res.status(404).json({ message: "Invoice not found" }); return; }
  if (invoice.status === "Paid") { res.status(400).json({ message: "Already paid" }); return; }

  const now = new Date();
  await prisma.invoice.update({
    where: { id: invoiceId },
    data: { status: "Paid", paidAt: now, method: "Manual", notes: "Marked as paid manually by admin" }
  });

  // move submission to ReadyForPreparation + mark payment paid
  if (invoice.submissionId) {
    await prisma.submission.update({
      where: { id: invoice.submissionId },
      data: {
        paymentStatus: "Paid",
        paymentMethod: "Manual",
        paidAt: now,
        productionStatus: "ReadyForPreparation"
      }
    });
  }

  void writeAuditLog({
    adminId: (req as AuthRequest).admin?.adminId,
    action: "payment_manual_paid",
    resource: "invoice",
    resourceId: invoiceId,
    details: { submissionId: invoice.submissionId, method: "Manual" },
    ipAddress: req.ip
  });

  // send receipt email non-blocking
  if (invoice.submissionId) {
    const sub = await prisma.submission.findUnique({ where: { id: invoice.submissionId }, select: { authorEmail: true, authorName: true } });
    if (sub) {
      void sendPaymentReceiptEmail(sub.authorEmail, invoiceId, invoice.total, invoice.currency, "MANUAL").catch(() => {});
      void sendPaymentReceiptEmail(env.ADMIN_EMAIL, invoiceId, invoice.total, invoice.currency, "MANUAL").catch(() => {});
    }
  }

  res.json({ success: true, message: "Marked as paid — submission moved to Ready for Preparation" });
};

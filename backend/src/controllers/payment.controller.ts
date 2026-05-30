import type { Request, Response } from "express";
import { prisma } from "../config/prisma.js";
import { env } from "../config/env.js";
import { writeAuditLog } from "../utils/auditLog.js";
import { capturePayPalOrder, createPayPalOrder } from "../services/paypal.service.js";
import { createRazorpayOrder, verifyRazorpayPayment } from "../services/razorpay.service.js";
import { createSmepayOrder, validateSmepayOrder } from "../services/smepay.service.js";
import { getPublicPaymentConfig } from "../services/paymentGatewaySettings.service.js";
import { sendPaymentReceiptEmail } from "../services/email.service.js";
import { loadApcRates } from "../services/apcSettings.service.js";

const paidStatuses = new Set(["Paid", "paid", "PAID"]);

function normalizeCurrency(currency: string): string {
  return (currency ?? "USD").trim().toUpperCase();
}

async function assertPayableInvoice(invoiceId: string) {
  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) return { error: { status: 404, message: "Invoice not found" } as const };
  if (paidStatuses.has(invoice.status)) {
    return { error: { status: 400, message: "Invoice is already paid" } as const };
  }
  return { invoice };
}

async function markInvoicePaid(
  invoice: { id: string; submissionId: string; customerEmail: string; total: number; currency: string },
  method: string,
  paymentId: string,
  notes: string
) {
  await prisma.invoice.update({
    where: { id: invoice.id },
    data: { status: "Paid", paidAt: new Date(), method, notes, gatewayPayId: paymentId }
  });
  await prisma.submission.updateMany({
    where: { id: invoice.submissionId },
    data: { paymentStatus: "Paid", paymentMethod: method, paymentId, paidAt: new Date(), productionStatus: "ReadyForPreparation" }
  });
  void writeAuditLog({
    action: "payment_received",
    resource: "invoice",
    resourceId: invoice.id,
    details: { method, paymentId, amount: invoice.total, currency: invoice.currency, submissionId: invoice.submissionId }
  });
  await sendPaymentReceiptEmail(invoice.customerEmail, invoice.id, invoice.total, invoice.currency, paymentId);
  await sendPaymentReceiptEmail(env.ADMIN_EMAIL, invoice.id, invoice.total, invoice.currency, paymentId);
}

export const getPaymentConfigController = async (_req: Request, res: Response): Promise<void> => {
  const config = await getPublicPaymentConfig();
  res.json({ status: "success", data: config });
};

/* ── Auto-create addon invoice for submission ──────────────────────────── */
async function getOrCreateAddonInvoice(submissionId: string, amount: number, currency: string): Promise<string> {
  // Check if invoice already exists for this submission
  const existing = await prisma.invoice.findFirst({
    where: { submissionId, status: { in: ["Draft", "Pending"] } }
  });
  if (existing) return existing.id;

  const submission = await prisma.submission.findUnique({ where: { id: submissionId } });
  if (!submission) throw new Error("Submission not found");

  const invoice = await prisma.invoice.create({
    data: {
      id: `INV-ADDON-${submissionId}-${Date.now()}`,
      submissionId,
      customerName: submission.authorName,
      customerEmail: submission.authorEmail,
      items: [],
      total: amount,
      subtotal: amount,
      currency: currency.toUpperCase(),
      status: "Pending"
    }
  });
  return invoice.id;
}

/* ── PayPal ─────────────────────────────────────────────────────────────── */
export const createPayPalOrderController = async (req: Request, res: Response): Promise<void> => {
  const { invoiceId, submissionId, amount, currency } = req.body as { invoiceId?: string; submissionId?: string; amount?: number; currency?: string };
  let resolvedInvoiceId = invoiceId;
  if (!resolvedInvoiceId && submissionId && amount) {
    try { resolvedInvoiceId = await getOrCreateAddonInvoice(submissionId, amount, currency || "USD"); }
    catch (e) { res.status(400).json({ message: e instanceof Error ? e.message : "Invoice creation failed" }); return; }
  }
  if (!resolvedInvoiceId) { res.status(400).json({ message: "invoiceId or submissionId+amount required" }); return; }
  const check = await assertPayableInvoice(resolvedInvoiceId);
  if ("error" in check) { res.status(check.error.status).json({ message: check.error.message }); return; }
  const { invoice } = check;
  const orderId = await createPayPalOrder(invoice.id, invoice.total);
  await prisma.invoice.update({
    where: { id: invoice.id },
    data: { method: "PayPal", notes: `paypal_order_id:${orderId}`, gatewayOrderId: orderId }
  });
  res.json({ status: "success", data: { orderId, invoiceId: invoice.id }, approvalUrl: null });
};

export const capturePayPalOrderController = async (req: Request, res: Response): Promise<void> => {
  const { orderId, invoiceId } = req.body as { orderId: string; invoiceId: string };
  const check = await assertPayableInvoice(invoiceId);
  if ("error" in check) { res.status(check.error.status).json({ message: check.error.message }); return; }
  const { invoice } = check;
  const captured = await capturePayPalOrder(orderId);
  await markInvoicePaid(invoice, "PayPal", captured.captureId, `paypal_capture_id:${captured.captureId}`);
  res.json({ status: "success", data: { transactionId: captured.captureId } });
};

/* ── Razorpay ────────────────────────────────────────────────────────────── */
export const createRazorpayOrderController = async (req: Request, res: Response): Promise<void> => {
  const { invoiceId, submissionId, amount, currency } = req.body as { invoiceId?: string; submissionId?: string; amount?: number; currency?: string };
  let resolvedInvoiceId = invoiceId;
  if (!resolvedInvoiceId && submissionId && amount) {
    try { resolvedInvoiceId = await getOrCreateAddonInvoice(submissionId, amount, currency || "INR"); }
    catch (e) { res.status(400).json({ message: e instanceof Error ? e.message : "Invoice creation failed" }); return; }
  }
  if (!resolvedInvoiceId) { res.status(400).json({ message: "invoiceId or submissionId+amount required" }); return; }
  const check = await assertPayableInvoice(resolvedInvoiceId);
  if ("error" in check) { res.status(check.error.status).json({ message: check.error.message }); return; }
  const { invoice } = check;
  const order = await createRazorpayOrder(invoice.id, Math.round(invoice.total * 100));
  await prisma.invoice.update({
    where: { id: invoice.id },
    data: { method: "Razorpay", notes: `razorpay_order_id:${order.orderId}`, gatewayOrderId: order.orderId }
  });
  res.json({ status: "success", data: { ...order, invoiceId: invoice.id }, keyId: order.keyId });
};

export const verifyRazorpayPaymentController = async (req: Request, res: Response): Promise<void> => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, invoiceId } = req.body as {
    razorpay_order_id: string; razorpay_payment_id: string;
    razorpay_signature: string; invoiceId: string;
  };
  const check = await assertPayableInvoice(invoiceId);
  if ("error" in check) { res.status(check.error.status).json({ message: check.error.message }); return; }
  const { invoice } = check;
  const valid = await verifyRazorpayPayment(razorpay_order_id, razorpay_payment_id, razorpay_signature);
  if (!valid) { res.status(400).json({ message: "Invalid Razorpay signature" }); return; }
  await markInvoicePaid(invoice, "Razorpay", razorpay_payment_id, `razorpay_payment_id:${razorpay_payment_id}`);
  res.json({ status: "success", data: { transactionId: razorpay_payment_id } });
};

/* ── SMEPay ──────────────────────────────────────────────────────────────── */
export const createSmepayOrderController = async (req: Request, res: Response): Promise<void> => {
  const { invoiceId, submissionId, amount, currency } = req.body as { invoiceId?: string; submissionId?: string; amount?: number; currency?: string };
  let resolvedInvoiceId = invoiceId;
  if (!resolvedInvoiceId && submissionId && amount) {
    try { resolvedInvoiceId = await getOrCreateAddonInvoice(submissionId, amount, currency || "INR"); }
    catch (e) { res.status(400).json({ message: e instanceof Error ? e.message : "Invoice creation failed" }); return; }
  }
  if (!resolvedInvoiceId) { res.status(400).json({ message: "invoiceId or submissionId+amount required" }); return; }
  const check = await assertPayableInvoice(resolvedInvoiceId);
  if ("error" in check) { res.status(check.error.status).json({ message: check.error.message }); return; }
  const { invoice } = check;
  const sub = await prisma.submission.findUnique({
    where: { id: invoice.submissionId },
    select: { authorName: true, authorEmail: true }
  });
  const order = await createSmepayOrder(
    invoice.id,
    Math.round(invoice.total),
    sub?.authorEmail ?? invoice.customerEmail,
    sub?.authorName ?? "Customer"
  );
  await prisma.invoice.update({
    where: { id: invoice.id },
    data: { method: "SMEPay", notes: `smepay_slug:${order.orderSlug}`, gatewayOrderId: order.orderSlug }
  });
  res.json({ status: "success", data: { orderSlug: order.orderSlug, paymentUrl: order.paymentUrl } });
};

export const verifySmepayOrderController = async (req: Request, res: Response): Promise<void> => {
  const { invoiceId, orderSlug } = req.body as { invoiceId: string; orderSlug: string };
  const check = await assertPayableInvoice(invoiceId);
  if ("error" in check) {
    if (check.error.message === "Invoice is already paid") {
      res.json({ status: "success", data: { alreadyPaid: true } }); return;
    }
    res.status(check.error.status).json({ message: check.error.message }); return;
  }
  const { invoice } = check;
  const payStatus = await validateSmepayOrder(orderSlug, Math.round(invoice.total));
  if (payStatus !== "SUCCESS") {
    res.status(400).json({ message: payStatus === "PENDING" ? "Payment still pending" : "Payment failed" }); return;
  }
  await markInvoicePaid(invoice, "SMEPay", orderSlug, `smepay_slug:${orderSlug}`);
  res.json({ status: "success", data: { transactionId: orderSlug } });
};

/* ── Admin list ──────────────────────────────────────────────────────────── */
export const listPayments = async (_req: Request, res: Response): Promise<void> => {
  const [invoices, paidUsd, paidInr, pendingCount, overdueCount, totalInvoices, apc] = await Promise.all([
    prisma.invoice.findMany({
      include: { submission: { include: { journal: true } } },
      orderBy: { updatedAt: "desc" }
    }),
    prisma.invoice.aggregate({ where: { status: "Paid", currency: "USD" }, _sum: { total: true } }),
    prisma.invoice.aggregate({ where: { status: "Paid", currency: "INR" }, _sum: { total: true } }),
    prisma.invoice.count({ where: { status: { in: ["Draft", "Pending"] } } }),
    prisma.invoice.count({ where: { status: "Overdue" } }),
    prisma.invoice.count(),
    loadApcRates()
  ]);
  res.json({
    status: "success",
    data: {
      stats: {
        totalRevenueUsd: paidUsd._sum.total ?? 0,
        totalRevenueInr: paidInr._sum.total ?? 0,
        pendingCount,
        overdueCount,
        totalInvoices
      },
      invoices,
      apc
    }
  });
};

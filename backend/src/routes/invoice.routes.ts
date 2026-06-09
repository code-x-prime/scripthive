import { Router } from "express";
import {
  createDraftFromSubmission,
  createInvoice,
  getInvoice,
  listInvoices,
  markInvoicePaidManual,
  sendInvoiceLink,
  updateInvoice
} from "../controllers/invoice.controller.js";
import { requireAuth, requirePermission } from "../middlewares/auth.middleware.js";

export const invoiceRouter = Router();

invoiceRouter.post("/", requireAuth, requirePermission("invoices", "write"), createInvoice);
invoiceRouter.post(
  "/from-submission/:submissionId",
  requireAuth,
  requirePermission("invoices", "write"),
  createDraftFromSubmission
);
invoiceRouter.get("/", requireAuth, requirePermission("invoices", "read"), listInvoices);
// Invoice IDs contain "/" (e.g. SH/26-27/001) — must use wildcard routes
invoiceRouter.get("/:id(*)", getInvoice);
invoiceRouter.post("/:id(*)/send-link", requireAuth, requirePermission("invoices", "write"), sendInvoiceLink);
invoiceRouter.post("/:id(*)/mark-paid", requireAuth, requirePermission("invoices", "write"), markInvoicePaidManual);
invoiceRouter.put("/:id(*)", requireAuth, requirePermission("invoices", "write"), updateInvoice);

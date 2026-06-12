import { Router } from "express";
import {
  capturePayPalOrderController,
  createAdvanceInvoiceController,
  createPayPalOrderController,
  createRazorpayOrderController,
  createSmepayOrderController,
  getPaymentConfigController,
  listPayments,
  testPaymentConnection,
  verifyRazorpayPaymentController,
  verifySmepayOrderController
} from "../controllers/payment.controller.js";
import { authenticate, requirePermission } from "../middlewares/auth.middleware.js";

export const paymentRouter = Router();

paymentRouter.get("/config", getPaymentConfigController);
paymentRouter.post("/advance/create-invoice", createAdvanceInvoiceController);
paymentRouter.get("/test/:gateway", authenticate, requirePermission("payments", "read"), testPaymentConnection);
paymentRouter.get("/", authenticate, requirePermission("payments", "read"), listPayments);
paymentRouter.post("/paypal/create-order", createPayPalOrderController);
paymentRouter.post("/paypal/capture", capturePayPalOrderController);
paymentRouter.post("/razorpay/create-order", createRazorpayOrderController);
paymentRouter.post("/razorpay/verify", verifyRazorpayPaymentController);
paymentRouter.post("/smepay/create-order", createSmepayOrderController);
paymentRouter.post("/smepay/verify", verifySmepayOrderController);

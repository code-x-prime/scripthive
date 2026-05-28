import { Router } from "express";
import { getReports, overview, getActivityReport } from "../controllers/report.controller.js";
import { requireAuth, requirePermission } from "../middlewares/auth.middleware.js";

export const reportRouter = Router();

reportRouter.get("/", requireAuth, requirePermission("reports", "read"), getReports);
reportRouter.get("/overview", requireAuth, requirePermission("reports", "read"), overview);
reportRouter.get("/activity", requireAuth, requirePermission("reports", "read"), getActivityReport);

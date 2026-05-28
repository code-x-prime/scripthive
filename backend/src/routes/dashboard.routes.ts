import { Router } from "express";
import { getDashboardStats } from "../controllers/dashboard.controller.js";
import { requireAuth, requirePermission } from "../middlewares/auth.middleware.js";

export const dashboardRouter = Router();

dashboardRouter.get("/stats", requireAuth, requirePermission("dashboard", "read"), getDashboardStats);

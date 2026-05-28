import type { Response } from "express";
import type { AuthRequest } from "../middlewares/auth.middleware.js";
import { computeDashboardStats } from "../services/dashboardStats.service.js";

export const getDashboardStats = async (_req: AuthRequest, res: Response): Promise<void> => {
  const payload = await computeDashboardStats();
  res.json(payload);
};

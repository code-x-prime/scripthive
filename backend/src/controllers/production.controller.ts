import type { Request, Response } from "express";
import { prisma } from "../config/prisma.js";
import type { ProductionStage } from "../utils/submissionStatus.js";

export const listProductionStage = (stage: ProductionStage) => {
  return async (_req: Request, res: Response): Promise<void> => {
    const rows = await prisma.submission.findMany({
      // Already-published papers have left the production pipeline, so keep them
      // out of every stage queue even if their productionStatus was never advanced.
      where: { productionStatus: stage, status: { not: "Published" } },
      include: { journal: true, invoices: true },
      orderBy: { updatedAt: "desc" }
    });
    res.json(rows);
  };
};

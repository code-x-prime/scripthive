import type { Request, Response } from "express";
import { prisma } from "../config/prisma.js";

const STAGES = ["ReadyForPreparation", "ReadyForUpload", "ReadyToPublished"] as const;

export const listProductionStage = (stage: (typeof STAGES)[number]) => {
  return async (_req: Request, res: Response): Promise<void> => {
    const rows = await prisma.submission.findMany({
      where: { productionStatus: stage },
      include: { journal: true, invoices: true },
      orderBy: { updatedAt: "desc" }
    });
    res.json(rows);
  };
};

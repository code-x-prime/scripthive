import { Router } from "express";
import { listProductionStage } from "../controllers/production.controller.js";
import { authenticate, requirePermission } from "../middlewares/auth.middleware.js";

export const productionRouter = Router();

productionRouter.get(
  "/preparation",
  authenticate,
  requirePermission("publish", "read"),
  listProductionStage("ReadyForPreparation")
);
productionRouter.get(
  "/upload",
  authenticate,
  requirePermission("publish", "read"),
  listProductionStage("ReadyForUpload")
);
productionRouter.get(
  "/ready-published",
  authenticate,
  requirePermission("publish", "read"),
  listProductionStage("ReadyToPublished")
);

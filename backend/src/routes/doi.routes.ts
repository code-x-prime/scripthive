import { Router } from "express";
import { assignDoi, listDoiMinted, listDoiNone, listDoiPending, listDois } from "../controllers/doi.controller.js";
import { authenticate, requirePermission } from "../middlewares/auth.middleware.js";

export const doiRouter = Router();

doiRouter.get("/no-doi", authenticate, requirePermission("doi", "read"), listDoiNone);
doiRouter.get("/pending", authenticate, requirePermission("doi", "read"), listDoiPending);
doiRouter.get("/minted", authenticate, requirePermission("doi", "read"), listDoiMinted);
doiRouter.post("/assign", authenticate, requirePermission("doi", "write"), assignDoi);
doiRouter.get("/", authenticate, requirePermission("doi", "read"), listDois);

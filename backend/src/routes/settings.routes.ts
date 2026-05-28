import { Router } from "express";
import { listSettings, updateSettings, listPublicAddons } from "../controllers/settings.controller.js";
import { authenticate, requireSuperAdmin } from "../middlewares/auth.middleware.js";

export const settingsRouter = Router();

settingsRouter.get("/public/addons", listPublicAddons);  // no auth — for client website
settingsRouter.get("/", authenticate, requireSuperAdmin, listSettings);
settingsRouter.put("/", authenticate, requireSuperAdmin, updateSettings);

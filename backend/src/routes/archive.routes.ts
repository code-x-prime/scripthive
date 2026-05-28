import { Router } from "express";
import { getArchiveAdmin, getArchiveByJournal, getArticleBySlug, incrementDownload, incrementView } from "../controllers/archive.controller.js";
import { authenticate, requirePermission } from "../middlewares/auth.middleware.js";

export const archiveRouter = Router();

archiveRouter.get("/admin", authenticate, requirePermission("archive", "read"), getArchiveAdmin);
archiveRouter.get("/article/:slug", getArticleBySlug);
archiveRouter.post("/view/:id", incrementView);
archiveRouter.post("/download/:id", incrementDownload);
archiveRouter.get("/:journalId", getArchiveByJournal);

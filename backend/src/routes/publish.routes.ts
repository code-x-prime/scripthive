import { Router } from "express";
import {
  listApprovedUnpublished, getNextArticleNo, publishArticle,
  listVolumesForJournal, createVolume, createIssue, createPart,
  updateVolume, deleteVolume, updateIssue, deleteIssue, updatePart, deletePart
} from "../controllers/publish.controller.js";
import { authenticate, requirePermission } from "../middlewares/auth.middleware.js";
import { uploadArticle } from "../middlewares/upload.middleware.js";

export const publishRouter = Router();

const auth    = [authenticate, requirePermission("publish", "read")] as const;
const authW   = [authenticate, requirePermission("publish", "write")] as const;

publishRouter.get("/approved-submissions", ...auth, listApprovedUnpublished);
publishRouter.get("/next-article-no",      ...auth, getNextArticleNo);
publishRouter.post("/", ...authW, uploadArticle.single("finalPdf"), publishArticle);

publishRouter.get("/volumes",    ...auth,  listVolumesForJournal);
publishRouter.post("/volumes",   ...authW, createVolume);
publishRouter.put("/volumes/:id",   ...authW, updateVolume);
publishRouter.delete("/volumes/:id",...authW, deleteVolume);

publishRouter.post("/issues",    ...authW, createIssue);
publishRouter.put("/issues/:id",    ...authW, updateIssue);
publishRouter.delete("/issues/:id", ...authW, deleteIssue);

publishRouter.post("/parts",     ...authW, createPart);
publishRouter.put("/parts/:id",     ...authW, updatePart);
publishRouter.delete("/parts/:id",  ...authW, deletePart);

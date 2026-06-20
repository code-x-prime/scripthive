import { Router } from "express";
import {
  bulkUpdateStatus,
  createSubmission,
  deleteSubmission,
  downloadManuscript,
  downloadManuscriptAndAdvance,
  downloadProductionFile,
  downloadSample,
  getSubmission,
  listPublishedArticles,
  listSubmissions,
  replacePdf,
  trackSubmission,
  updatePriority,
  updateProductionStatus,
  updatePublishedArticle,
  updateRemark,
  updateReviewNotes,
  updateSubmissionStatus,
  uploadManuscript,
  uploadProductionFile
} from "../controllers/submission.controller.js";
import { requireAuth, requirePermission } from "../middlewares/auth.middleware.js";
import { upload, uploadProduction } from "../middlewares/upload.middleware.js";

export const submissionRouter = Router();

submissionRouter.get("/published", requireAuth, requirePermission("submissions", "read"), listPublishedArticles);
submissionRouter.patch("/:id/published", requireAuth, requirePermission("submissions", "write"), updatePublishedArticle);
submissionRouter.post("/", upload.single("manuscript"), createSubmission);
submissionRouter.get("/track/:id", trackSubmission);
submissionRouter.get("/", requireAuth, requirePermission("submissions", "read"), listSubmissions);
submissionRouter.put("/bulk-status", requireAuth, requirePermission("submissions", "approve"), bulkUpdateStatus);
submissionRouter.get(
  "/:id/manuscript",
  requireAuth,
  requirePermission("submissions", "read"),
  downloadManuscript
);
submissionRouter.get(
  "/:id/manuscript-advance",
  requireAuth,
  requirePermission("submissions", "read"),
  downloadManuscriptAndAdvance
);
submissionRouter.get(
  "/:id/sample",
  requireAuth,
  requirePermission("submissions", "read"),
  downloadSample
);
submissionRouter.get(
  "/:id/production-file",
  requireAuth,
  requirePermission("submissions", "read"),
  downloadProductionFile
);
submissionRouter.post(
  "/:id/upload-manuscript",
  requireAuth,
  requirePermission("submissions", "write"),
  upload.single("manuscript"),
  uploadManuscript
);
submissionRouter.post(
  "/:id/upload-production",
  requireAuth,
  requirePermission("submissions", "approve"),
  uploadProduction.single("file"),
  uploadProductionFile
);
submissionRouter.put("/:id/remark", requireAuth, requirePermission("submissions", "write"), updateRemark);
submissionRouter.put(
  "/:id/production-status",
  requireAuth,
  requirePermission("submissions", "approve"),
  updateProductionStatus
);
submissionRouter.get("/:id", requireAuth, requirePermission("submissions", "read"), getSubmission);
submissionRouter.put("/:id/status", requireAuth, requirePermission("submissions", "approve"), updateSubmissionStatus);
submissionRouter.put("/:id/review-notes", requireAuth, requirePermission("submissions", "write"), updateReviewNotes);
submissionRouter.delete("/:id", requireAuth, requirePermission("submissions", "delete"), deleteSubmission);
submissionRouter.put("/:id/priority", requireAuth, requirePermission("submissions", "write"), updatePriority);
submissionRouter.post("/:id/replace-pdf", requireAuth, requirePermission("submissions", "write"), upload.single("pdf"), replacePdf);

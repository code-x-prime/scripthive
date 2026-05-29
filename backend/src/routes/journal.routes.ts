import { Router } from "express";
import {
  addEditorialMember,
  createJournal,
  getJournal,
  getJournalArchive,
  listEditorialBoard,
  listJournals,
  listJournalsAdmin,
  removeEditorialMember,
  toggleJournalStatus,
  updateEditorialMember,
  updateJournalDoi,
  updateJournalIssn
} from "../controllers/journal.controller.js";
import {
  getArchiveArticle,
  getArchiveIssue,
  getJournalArchiveIndex
} from "../controllers/publicArchive.controller.js";
import { requireAuth, requirePermission } from "../middlewares/auth.middleware.js";

export const journalRouter = Router();

journalRouter.get("/", listJournals);
journalRouter.get("/admin", requireAuth, requirePermission("journals", "read"), listJournalsAdmin);
journalRouter.put(
  "/admin/:journalId/issn",
  requireAuth,
  requirePermission("journals", "write"),
  updateJournalIssn
);
journalRouter.patch(
  "/admin/:journalId/toggle-status",
  requireAuth,
  requirePermission("journals", "write"),
  toggleJournalStatus
);
journalRouter.put(
  "/admin/:journalId/doi",
  requireAuth,
  requirePermission("journals", "write"),
  updateJournalDoi
);

journalRouter.get("/:journalId/editorial-board", requireAuth, requirePermission("journals", "read"), listEditorialBoard);
journalRouter.post("/:journalId/editorial-board", requireAuth, requirePermission("journals", "write"), addEditorialMember);
journalRouter.put("/:journalId/editorial-board/:memberId", requireAuth, requirePermission("journals", "write"), updateEditorialMember);
journalRouter.delete("/:journalId/editorial-board/:memberId", requireAuth, requirePermission("journals", "write"), removeEditorialMember);

journalRouter.get("/:journalSlug/archive/:volumeIssueSlug/:articleSlug", getArchiveArticle);
journalRouter.get("/:journalSlug/archive/:volumeIssueSlug", getArchiveIssue);
journalRouter.get("/:journalSlug/archive", getJournalArchiveIndex);
journalRouter.get("/:abbr/archive", getJournalArchive);
journalRouter.get("/:abbr", getJournal);
journalRouter.post("/", requireAuth, createJournal);

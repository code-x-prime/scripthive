import { Router } from "express";
import { meAuthor } from "../controllers/authorAuth.controller.js";
import {
  createAuthorSubmission,
  deleteAuthorSubmission,
  getAuthorStats,
  getAuthorSubmission,
  listAuthorSubmissions,
  updateAuthorProfile,
  updateAuthorSubmission
} from "../controllers/authorSubmission.controller.js";
import { authenticateAuthor } from "../middlewares/author.middleware.js";
import { upload } from "../middlewares/upload.middleware.js";

export const authorRouter = Router();

authorRouter.use(authenticateAuthor);

authorRouter.get("/stats", getAuthorStats);
authorRouter.get("/profile", meAuthor);
authorRouter.put("/profile", updateAuthorProfile);
authorRouter.get("/submissions", listAuthorSubmissions);
authorRouter.get("/submissions/:id", getAuthorSubmission);
authorRouter.post("/submissions", upload.single("manuscript"), createAuthorSubmission);
authorRouter.put("/submissions/:id", upload.single("manuscript"), updateAuthorSubmission);
authorRouter.delete("/submissions/:id", deleteAuthorSubmission);

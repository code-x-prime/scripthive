import { Router } from "express";
import type { NextFunction, Request, Response } from "express";
import multer from "multer";
import { deleteMedia, listMedia, uploadMedia } from "../controllers/media.controller.js";
import { authenticate, requireSuperAdmin } from "../middlewares/auth.middleware.js";
import { mediaUpload } from "../middlewares/mediaUpload.middleware.js";

export const mediaRouter = Router();

const handleMulter =
  (uploadMiddleware: ReturnType<typeof mediaUpload.array>) =>
  (req: Request, res: Response, next: NextFunction): void => {
    uploadMiddleware(req, res, (err: unknown) => {
      if (err instanceof multer.MulterError) {
        const msg =
          err.code === "LIMIT_FILE_SIZE"
            ? "Each file must be 25 MB or smaller"
            : err.code === "LIMIT_FILE_COUNT"
              ? "You can upload up to 20 files at once"
              : err.message;
        res.status(400).json({ message: msg });
        return;
      }
      if (err instanceof Error) {
        res.status(400).json({ message: err.message });
        return;
      }
      next();
    });
  };

mediaRouter.get("/", authenticate, requireSuperAdmin, listMedia);
mediaRouter.post(
  "/upload",
  authenticate,
  requireSuperAdmin,
  handleMulter(mediaUpload.array("files", 20)),
  uploadMedia
);
mediaRouter.delete("/:id", authenticate, requireSuperAdmin, deleteMedia);

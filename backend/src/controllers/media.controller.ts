import fs from "fs";
import path from "path";
import type { Response } from "express";
import { prisma } from "../config/prisma.js";
import type { AuthRequest } from "../middlewares/auth.middleware.js";
import { mediaDirPath } from "../middlewares/mediaUpload.middleware.js";

export const listMedia = async (_req: AuthRequest, res: Response): Promise<void> => {
  const rows = await prisma.mediaFile.findMany({
    orderBy: { createdAt: "desc" },
    include: { uploadedBy: { select: { id: true, name: true } } }
  });
  res.json(rows);
};

export const uploadMedia = async (req: AuthRequest, res: Response): Promise<void> => {
  const files = req.files as Express.Multer.File[] | undefined;
  if (!files?.length) {
    res.status(400).json({ message: "No files selected" });
    return;
  }

  const adminId = req.admin?.adminId ?? null;
  const created = await Promise.all(
    files.map((file) =>
      prisma.mediaFile.create({
        data: {
          originalName: file.originalname,
          storedName: file.filename,
          mimeType: file.mimetype || "application/octet-stream",
          size: file.size,
          url: `/uploads/media/${file.filename}`,
          uploadedById: adminId
        },
        include: { uploadedBy: { select: { id: true, name: true } } }
      })
    )
  );

  res.status(201).json({
    message: `${created.length} file(s) uploaded`,
    files: created
  });
};

export const deleteMedia = async (req: AuthRequest, res: Response): Promise<void> => {
  const id = String(req.params.id);
  const row = await prisma.mediaFile.findUnique({ where: { id } });
  if (!row) {
    res.status(404).json({ message: "File not found" });
    return;
  }

  const abs = path.normalize(path.join(mediaDirPath, row.storedName));
  if (!abs.startsWith(mediaDirPath)) {
    res.status(403).json({ message: "Forbidden" });
    return;
  }

  if (fs.existsSync(abs)) {
    fs.unlinkSync(abs);
  }

  await prisma.mediaFile.delete({ where: { id } });
  res.json({ message: "File deleted" });
};

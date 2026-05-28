import fs from "fs";
import path from "path";
import type { Response } from "express";
import { prisma } from "../config/prisma.js";
import type { AuthRequest } from "../middlewares/auth.middleware.js";
import { uploadToR2, deleteFromR2 } from "../utils/r2Upload.js";

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
    files.map(async (file) => {
      const r2Key = `media/${Date.now()}_${file.filename}`;
      let url: string;
      try {
        url = await uploadToR2(file.path, r2Key, file.mimetype);
      } catch {
        url = `/uploads/media/${file.filename}`;
      }

      return prisma.mediaFile.create({
        data: {
          originalName: file.originalname,
          storedName: r2Key,
          mimeType: file.mimetype || "application/octet-stream",
          size: file.size,
          url,
          uploadedById: adminId
        },
        include: { uploadedBy: { select: { id: true, name: true } } }
      });
    })
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

  try {
    await deleteFromR2(row.storedName);
  } catch {
    // file may not exist in R2, continue
    const localPath = path.join(process.cwd(), "uploads", "media", path.basename(row.storedName));
    if (fs.existsSync(localPath)) fs.unlinkSync(localPath);
  }

  await prisma.mediaFile.delete({ where: { id } });
  res.json({ message: "File deleted" });
};

import type { Request, Response } from "express";
import { prisma } from "../config/prisma.js";

export async function listCarouselSlides(req: Request, res: Response): Promise<void> {
  const activeOnly = req.query.activeOnly === "true";
  const slides = await prisma.carouselSlide.findMany({
    where: activeOnly ? { isActive: true } : {},
    orderBy: { position: "asc" }
  });
  res.json(slides);
}

export async function createCarouselSlide(req: Request, res: Response): Promise<void> {
  const { imageUrl, title, subtitle, linkUrl, position, isActive } = req.body as {
    imageUrl: string;
    title?: string;
    subtitle?: string;
    linkUrl?: string;
    position?: number;
    isActive?: boolean;
  };

  if (!imageUrl?.trim()) {
    res.status(400).json({ message: "imageUrl is required" });
    return;
  }

  const maxPos = await prisma.carouselSlide.aggregate({ _max: { position: true } });
  const nextPos = (maxPos._max.position ?? -1) + 1;

  const slide = await prisma.carouselSlide.create({
    data: {
      imageUrl: imageUrl.trim(),
      title: title?.trim() || null,
      subtitle: subtitle?.trim() || null,
      linkUrl: linkUrl?.trim() || null,
      position: position ?? nextPos,
      isActive: isActive ?? true
    }
  });
  res.status(201).json(slide);
}

export async function updateCarouselSlide(req: Request, res: Response): Promise<void> {
  const id = String(req.params.id);
  const { imageUrl, title, subtitle, linkUrl, position, isActive } = req.body as {
    imageUrl?: string;
    title?: string;
    subtitle?: string;
    linkUrl?: string;
    position?: number;
    isActive?: boolean;
  };

  const existing = await prisma.carouselSlide.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ message: "Slide not found" });
    return;
  }

  const slide = await prisma.carouselSlide.update({
    where: { id },
    data: {
      ...(imageUrl !== undefined && { imageUrl: imageUrl.trim() }),
      ...(title !== undefined && { title: title.trim() || null }),
      ...(subtitle !== undefined && { subtitle: subtitle.trim() || null }),
      ...(linkUrl !== undefined && { linkUrl: linkUrl.trim() || null }),
      ...(position !== undefined && { position }),
      ...(isActive !== undefined && { isActive })
    }
  });
  res.json(slide);
}

export async function reorderCarouselSlides(req: Request, res: Response): Promise<void> {
  const { order } = req.body as { order: string[] };
  if (!Array.isArray(order)) {
    res.status(400).json({ message: "order must be an array of slide ids" });
    return;
  }

  await prisma.$transaction(
    order.map((id, idx) =>
      prisma.carouselSlide.update({ where: { id }, data: { position: idx } })
    )
  );
  res.json({ ok: true });
}

export async function deleteCarouselSlide(req: Request, res: Response): Promise<void> {
  const id = String(req.params.id);
  const existing = await prisma.carouselSlide.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ message: "Slide not found" });
    return;
  }
  await prisma.carouselSlide.delete({ where: { id } });
  res.json({ ok: true });
}

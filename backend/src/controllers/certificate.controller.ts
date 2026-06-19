import type { Request, Response } from "express";
import { prisma } from "../config/prisma.js";
import { generateCertificatePdf } from "../services/certificate.service.js";

export const generateCertificateForSubmission = async (req: Request, res: Response): Promise<void> => {
  const id = String(req.params.id);
  const sub = await prisma.submission.findUnique({
    where: { id },
    include: { journal: true, doiRecord: true }
  });
  if (!sub) { res.status(404).json({ message: "Submission not found" }); return; }

  const vol = sub.volumeId ? await prisma.volume.findUnique({ where: { id: sub.volumeId } }) : null;
  const iss = sub.issueId ? await prisma.issue.findUnique({ where: { id: sub.issueId } }) : null;

  const pubDate = sub.pubDate
    ? new Date(sub.pubDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
    : new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

  const coAuthorList = sub.coAuthors
    ? sub.coAuthors.split(/[,;]/).map((s: string) => s.trim()).filter(Boolean)
    : [];
  const authors = [sub.authorName, ...coAuthorList];

  const baseCertId = `SH-${new Date(sub.createdAt).getFullYear()}-${sub.id.slice(-4).toUpperCase()}`;
  const commonFields = {
    paperTitle: sub.title,
    journalName: sub.journal?.name ?? sub.journalId,
    volume: vol && iss ? `Vol. ${vol.number}, Issue ${iss.number}` : "—",
    issue: iss ? String(iss.number) : "—",
    pubDate,
    issn: (sub.journal as unknown as { issn?: string | null })?.issn ?? "",
  };

  const certDataList = authors.map((name, i) => ({
    ...commonFields,
    authorName: name,
    certId: i === 0 ? baseCertId : `${baseCertId}-${i + 1}`,
  }));

  const pdf = await generateCertificatePdf(certDataList);

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="certificate-${id}.pdf"`);
  res.send(pdf);
};

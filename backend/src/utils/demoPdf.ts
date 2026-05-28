import fs from "fs";
import path from "path";

/** Writes a valid minimal PDF on disk; size is padded with PDF comments (ignored by readers). */
export function writeDemoArticlePdf(relativePath: string, title: string, targetSizeKb: number): string {
  const normalized = relativePath.replace(/\\/g, "/");
  const abs = path.resolve(process.cwd(), normalized);
  fs.mkdirSync(path.dirname(abs), { recursive: true });

  const safeTitle = title.replace(/[()\\]/g, " ").slice(0, 120);
  const core = [
    "%PDF-1.4",
    "1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj",
    "2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj",
    "3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Contents 4 0 R>>endobj",
    `4 0 obj<</Length ${44 + safeTitle.length}>>stream`,
    `BT /F1 12 Tf 72 720 Td (${safeTitle}) Tj ET`,
    "endstream",
    "endobj",
    "xref",
    "0 5",
    "0000000000 65535 f ",
    "trailer<</Size 5/Root 1 0 R>>",
    "startxref",
    "0",
    "%%EOF"
  ].join("\n");

  const targetBytes = Math.max(8, targetSizeKb) * 1024;
  let pdf = core;
  const padLine = `% ScriptHive archive padding\n`;
  while (Buffer.byteLength(pdf, "utf8") < targetBytes) {
    pdf += padLine;
  }

  fs.writeFileSync(abs, pdf, "utf8");
  return normalized;
}

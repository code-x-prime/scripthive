import { PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { r2Client, R2_BUCKET, R2_PUBLIC_URL } from "../config/r2.js";
import fs from "node:fs";
import path from "node:path";

export async function uploadToR2(
  localFilePath: string,
  r2Key: string,
  contentType?: string
): Promise<string> {
  const fileBuffer = fs.readFileSync(localFilePath);
  const ext = path.extname(localFilePath).toLowerCase();

  const mimeType = contentType ?? (
    ext === ".pdf" ? "application/pdf" :
    ext === ".doc" ? "application/msword" :
    ext === ".docx" ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" :
    "application/octet-stream"
  );

  await r2Client.send(new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: r2Key,
    Body: fileBuffer,
    ContentType: mimeType
  }));

  // delete local temp file
  fs.unlinkSync(localFilePath);

  return `${R2_PUBLIC_URL}/${r2Key}`;
}

export async function deleteFromR2(r2Key: string): Promise<void> {
  await r2Client.send(new DeleteObjectCommand({
    Bucket: R2_BUCKET,
    Key: r2Key
  }));
}

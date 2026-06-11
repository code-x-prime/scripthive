import bcrypt from "bcryptjs";
import type { Request, Response } from "express";
import fs from "node:fs";
import jwt, { type Secret, type SignOptions } from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import { prisma } from "../config/prisma.js";
import { env } from "../config/env.js";
import type { AuthorRequest } from "../middlewares/author.middleware.js";
import { validateAuthorPassword } from "../utils/passwordPolicy.js";
const accessTokenFor = (authorId: string, email: string): string =>
  jwt.sign(
    { authorId, email, accountType: "author" as const },
    env.JWT_SECRET as Secret,
    { expiresIn: env.JWT_EXPIRES_IN } as SignOptions
  );

const authorCookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/api/author/auth",
  maxAge: 7 * 24 * 60 * 60 * 1000
};

export const registerAuthor = async (req: Request, res: Response): Promise<void> => {
  const { name, email, password, phone, country, state, address, affiliations } = req.body as {
    name: string;
    email: string;
    password: string;
    phone?: string;
    country?: string;
    state?: string;
    address?: string;
    affiliations?: string;
  };

  const trimmedEmail = email?.trim().toLowerCase() ?? "";
  const trimmedName = name?.trim() ?? "";

  if (!trimmedName || !trimmedEmail || !password) {
    res.status(400).json({ message: "Name, email, and password are required" });
    return;
  }
  const passwordCheck = validateAuthorPassword(password);
  if (!passwordCheck.valid) {
    res.status(400).json({ message: passwordCheck.message });
    return;
  }

  const existing = await prisma.author.findUnique({ where: { email: trimmedEmail } });
  if (existing) {
    res.status(409).json({ message: "An account with this email already exists" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const author = await prisma.author.create({
    data: {
      name: trimmedName,
      email: trimmedEmail,
      passwordHash,
      phone: phone?.trim() || null,
      country: country?.trim() || null,
      state: state?.trim() || null,
      address: address?.trim() || null,
      affiliations: affiliations?.trim() || null
    }
  });

  await prisma.submission.updateMany({
    where: { authorEmail: trimmedEmail, authorUserId: null },
    data: { authorUserId: author.id }
  });

  const refreshToken = uuidv4();
  await prisma.authorRefreshToken.create({
    data: { authorId: author.id, token: refreshToken, expiresAt: new Date(Date.now() + 7 * 86400000) }
  });
  res.cookie("authorRefreshToken", refreshToken, authorCookieOptions);

  res.status(201).json({
    accessToken: accessTokenFor(author.id, author.email),
    author: {
      id: author.id,
      name: author.name,
      email: author.email,
      phone: author.phone,
      country: author.country,
      state: (author as unknown as Record<string,unknown>).state ?? null,
      address: (author as unknown as Record<string,unknown>).address ?? null,
      affiliations: author.affiliations
    }
  });
};

export const loginAuthor = async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body as { email: string; password: string };
  const normalized = email?.trim().toLowerCase() ?? "";
  if (!normalized || !password) {
    res.status(400).json({ message: "Email and password are required" });
    return;
  }

  const author = await prisma.author.findUnique({ where: { email: normalized } });
  if (!author || !author.isActive || !(await bcrypt.compare(password, author.passwordHash))) {
    res.status(401).json({ message: "Invalid email or password" });
    return;
  }

  const refreshToken = uuidv4();
  await prisma.authorRefreshToken.create({
    data: { authorId: author.id, token: refreshToken, expiresAt: new Date(Date.now() + 7 * 86400000) }
  });
  await prisma.author.update({ where: { id: author.id }, data: { lastLoginAt: new Date() } });
  res.cookie("authorRefreshToken", refreshToken, authorCookieOptions);

  res.json({
    accessToken: accessTokenFor(author.id, author.email),
    author: {
      id: author.id,
      name: author.name,
      email: author.email,
      phone: author.phone,
      country: author.country,
      state: (author as unknown as Record<string,unknown>).state ?? null,
      address: (author as unknown as Record<string,unknown>).address ?? null,
      affiliations: author.affiliations
    }
  });
};

export const refreshAuthor = async (req: Request, res: Response): Promise<void> => {
  const token = req.cookies?.authorRefreshToken as string | undefined;
  if (!token) {
    res.status(401).json({ message: "Missing refresh token" });
    return;
  }
  const exists = await prisma.authorRefreshToken.findUnique({
    where: { token },
    include: { author: true }
  });
  if (!exists || exists.expiresAt < new Date() || !exists.author.isActive) {
    res.status(401).json({ message: "Session expired" });
    return;
  }
  res.json({
    accessToken: accessTokenFor(exists.author.id, exists.author.email),
    author: {
      id: exists.author.id,
      name: exists.author.name,
      email: exists.author.email,
      phone: exists.author.phone,
      country: exists.author.country,
      affiliations: exists.author.affiliations
    }
  });
};

export const logoutAuthor = async (req: Request, res: Response): Promise<void> => {
  const token = req.cookies?.authorRefreshToken as string | undefined;
  if (token) {
    await prisma.authorRefreshToken.deleteMany({ where: { token } });
  }
  res.clearCookie("authorRefreshToken", { path: "/api/author/auth" });
  res.json({ message: "Logged out" });
};

export const meAuthor = async (req: AuthorRequest, res: Response): Promise<void> => {
  const authorId = req.author?.authorId;
  if (!authorId) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
  const author = await prisma.author.findUnique({ where: { id: authorId } });
  if (!author || !author.isActive) {
    res.status(401).json({ message: "Account not found" });
    return;
  }
  res.json({
    id: author.id,
    name: author.name,
    email: author.email,
    phone: author.phone,
    country: author.country,
    affiliations: author.affiliations
  });
};

export const changeAuthorPassword = async (req: AuthorRequest, res: Response): Promise<void> => {
  const authorId = req.author!.authorId;
  const { currentPassword, newPassword } = req.body as { currentPassword: string; newPassword: string };
  if (!currentPassword || !newPassword) {
    res.status(400).json({ message: "Current password and new password are required" });
    return;
  }
  const check = validateAuthorPassword(newPassword);
  if (!check.valid) {
    res.status(400).json({ message: check.message });
    return;
  }
  const author = await prisma.author.findUnique({ where: { id: authorId } });
  if (!author || !(await bcrypt.compare(currentPassword, author.passwordHash))) {
    res.status(401).json({ message: "Current password is incorrect" });
    return;
  }
  const passwordHash = await bcrypt.hash(newPassword, 12);
  await prisma.author.update({ where: { id: authorId }, data: { passwordHash } });
  await prisma.authorRefreshToken.deleteMany({ where: { authorId } });
  res.clearCookie("authorRefreshToken", { path: "/api/author/auth" });
  res.json({ message: "Password updated. Please sign in again." });
};

export const forgotAuthorPassword = async (req: Request, res: Response): Promise<void> => {
  const { email } = req.body as { email: string };
  const normalized = email?.trim().toLowerCase() ?? "";
  if (!normalized) { res.status(400).json({ message: "Email is required" }); return; }

  const author = await prisma.author.findUnique({ where: { email: normalized } });
  // Always respond OK — don't leak whether email exists
  if (!author || !author.isActive) {
    res.json({ message: "If this email is registered, you will receive a reset link." });
    return;
  }

  const token = uuidv4();
  await prisma.authorPasswordResetToken.deleteMany({ where: { authorId: author.id } });
  await prisma.authorPasswordResetToken.create({
    data: { authorId: author.id, token, expiresAt: new Date(Date.now() + 60 * 60 * 1000) }
  });

  const { sendMail } = await import("../services/email.service.js");
  const resetUrl = `${env.FRONTEND_URL}/author/reset-password?token=${token}`;
  await sendMail({
    to: author.email,
    subject: "Reset your ScriptHive author password",
    html: `<p>Dear ${author.name},</p><p>Click the link below to reset your password. This link expires in 1 hour.</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>If you did not request this, ignore this email.</p>`
  }).catch(() => {});

  res.json({ message: "If this email is registered, you will receive a reset link." });
};

export const resetAuthorPassword = async (req: Request, res: Response): Promise<void> => {
  const { token, password } = req.body as { token: string; password: string };
  if (!token || !password) { res.status(400).json({ message: "Token and password are required" }); return; }

  const check = validateAuthorPassword(password);
  if (!check.valid) { res.status(400).json({ message: check.message }); return; }

  const record = await prisma.authorPasswordResetToken.findUnique({ where: { token }, include: { author: true } });
  if (!record || record.expiresAt < new Date()) {
    res.status(400).json({ message: "Reset link is invalid or has expired. Please request a new one." });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.author.update({ where: { id: record.authorId }, data: { passwordHash } });
  await prisma.authorPasswordResetToken.delete({ where: { token } });
  await prisma.authorRefreshToken.deleteMany({ where: { authorId: record.authorId } });

  res.json({ message: "Password reset successful. Please sign in with your new password." });
};

export const deleteAuthorAccount = async (req: AuthorRequest, res: Response): Promise<void> => {
  const authorId = req.author!.authorId;
  const { password } = req.body as { password: string };
  if (!password) {
    res.status(400).json({ message: "Password is required to delete your account" });
    return;
  }
  const author = await prisma.author.findUnique({ where: { id: authorId } });
  if (!author || !(await bcrypt.compare(password, author.passwordHash))) {
    res.status(401).json({ message: "Incorrect password" });
    return;
  }

  const activeCount = await prisma.submission.count({
    where: {
      authorUserId: authorId,
      status: { in: ["UnderReview", "Revision", "Accepted", "Published"] }
    }
  });
  if (activeCount > 0) {
    res.status(403).json({
      message:
        "Cannot delete account while you have submissions under review or published. Contact the editorial office."
    });
    return;
  }

  const pending = await prisma.submission.findMany({
    where: { authorUserId: authorId, status: "Pending" },
    select: { id: true, manuscriptPath: true }
  });
  for (const row of pending) {
    if (row.manuscriptPath && fs.existsSync(row.manuscriptPath)) {
      try {
        fs.unlinkSync(row.manuscriptPath);
      } catch {
        // ignore
      }
    }
    await prisma.invoice.deleteMany({ where: { submissionId: row.id } });
  }
  await prisma.submission.deleteMany({ where: { authorUserId: authorId, status: "Pending" } });
  await prisma.submission.updateMany({
    where: { authorUserId: authorId },
    data: { authorUserId: null }
  });
  await prisma.authorRefreshToken.deleteMany({ where: { authorId } });
  await prisma.author.delete({ where: { id: authorId } });
  res.clearCookie("authorRefreshToken", { path: "/api/author/auth" });
  res.json({ message: "Account deleted" });
};
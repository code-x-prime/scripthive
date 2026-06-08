import bcrypt from "bcryptjs";
import type { Request, Response } from "express";
import jwt, { type Secret, type SignOptions } from "jsonwebtoken";
import { prisma } from "../config/prisma.js";
import { env } from "../config/env.js";
import type { AuthRequest } from "../middlewares/auth.middleware.js";
import { v4 as uuidv4 } from "uuid";
import { writeAuditLog } from "../utils/auditLog.js";
import { sendMail } from "../services/email.service.js";

const accessTokenFor = (adminId: string, loginId: string, role: string, permissions: string[]): string =>
  jwt.sign(
    { adminId, email: loginId, role, permissions },
    env.JWT_SECRET as Secret,
    { expiresIn: env.JWT_EXPIRES_IN } as SignOptions
  );

const loginIdFor = (admin: { email: string | null; username: string | null }): string =>
  admin.email ?? admin.username ?? "";

export const login = async (req: Request, res: Response): Promise<void> => {
  const { login, password } = req.body as { login: string; password: string };
  const raw = login?.trim() ?? "";
  if (!raw || !password) {
    res.status(400).json({ message: "Login and password are required" });
    return;
  }

  const normalized = raw.toLowerCase();
  const admin = await prisma.adminUser.findFirst({
    where: {
      OR: [{ email: normalized }, { username: normalized }]
    },
    include: {
      role: { include: { permissions: { include: { permission: true } } } }
    }
  });

  if (!admin || !admin.isActive || !(await bcrypt.compare(password, admin.passwordHash))) {
    res.status(401).json({ message: "Invalid credentials" });
    return;
  }

  const permissions = admin.role.permissions.map(
    (rolePermission) => `${rolePermission.permission.resource}:${rolePermission.permission.action}`
  );
  // Single session: kill all existing sessions before creating new one
  await prisma.refreshToken.deleteMany({ where: { adminId: admin.id } });
  const refreshToken = uuidv4();
  await prisma.refreshToken.create({
    data: { adminId: admin.id, token: refreshToken, expiresAt: new Date(Date.now() + 7 * 86400000) }
  });
  await prisma.adminUser.update({ where: { id: admin.id }, data: { lastLoginAt: new Date() } });
  void writeAuditLog({ adminId: admin.id, action: "login", resource: "auth", ipAddress: req.ip });
  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/api/auth",
    maxAge: 7 * 24 * 60 * 60 * 1000
  });
  const id = loginIdFor(admin);
  res.json({
    accessToken: accessTokenFor(admin.id, id, admin.role.name, permissions),
    admin: {
      id: admin.id,
      email: admin.email,
      username: admin.username,
      name: admin.name,
      role: { name: admin.role.name, permissions }
    }
  });
};

export const refresh = async (req: Request, res: Response): Promise<void> => {
  const token = req.cookies?.refreshToken as string | undefined;
  if (!token) {
    res.status(401).json({ message: "Missing refresh token" });
    return;
  }
  const exists = await prisma.refreshToken.findUnique({
    where: { token },
    include: {
      admin: { include: { role: { include: { permissions: { include: { permission: true } } } } } }
    }
  });
  if (!exists || exists.expiresAt < new Date() || !exists.admin.isActive) {
    res.status(401).json({ message: "Invalid refresh token" });
    return;
  }
  const permissions = exists.admin.role.permissions.map(
    (rolePermission) => `${rolePermission.permission.resource}:${rolePermission.permission.action}`
  );
  const id = loginIdFor(exists.admin);
  res.json({
    accessToken: accessTokenFor(exists.admin.id, id, exists.admin.role.name, permissions),
    admin: {
      id: exists.admin.id,
      email: exists.admin.email,
      username: exists.admin.username,
      name: exists.admin.name,
      role: { name: exists.admin.role.name, permissions }
    }
  });
};

export const logout = async (req: Request, res: Response): Promise<void> => {
  const token = req.cookies?.refreshToken as string | undefined;
  if (token) await prisma.refreshToken.deleteMany({ where: { token } });
  res.clearCookie("refreshToken", { path: "/api/auth" });
  res.json({ message: "Logged out" });
};

export const me = async (req: AuthRequest, res: Response): Promise<void> => {
  const adminId = req.admin?.adminId;
  if (!adminId) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
  const admin = await prisma.adminUser.findUnique({
    where: { id: adminId },
    include: {
      role: { include: { permissions: { include: { permission: true } } } }
    }
  });
  if (!admin) {
    res.status(404).json({ message: "Admin not found" });
    return;
  }
  res.json({
    id: admin.id,
    email: admin.email,
    username: admin.username,
    name: admin.name,
    role: {
      name: admin.role.name,
      permissions: admin.role.permissions.map(
        (rolePermission) => `${rolePermission.permission.resource}:${rolePermission.permission.action}`
      )
    }
  });
};

/* ── Forgot password — send OTP ─────────────────────────────────────────── */
export const forgotPassword = async (req: Request, res: Response): Promise<void> => {
  const { email } = req.body as { email: string };
  if (!email) { res.status(400).json({ message: "Email is required" }); return; }
  const admin = await prisma.adminUser.findFirst({ where: { email: email.toLowerCase().trim() } });
  if (!admin) { res.status(404).json({ message: "No admin account found with this email address." }); return; }
  if (!admin.isActive) { res.status(403).json({ message: "This account is inactive. Contact your system administrator." }); return; }
  const otp = String(Math.floor(100000 + Math.random() * 900000));
  const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min
  await prisma.$executeRaw`UPDATE "AdminUser" SET "otpCode" = ${otp}, "otpExpiresAt" = ${otpExpiresAt} WHERE id = ${admin.id}`;
  await sendMail({
    to: admin.email!,
    subject: "🔐 Password Reset OTP — Admin",
    html: `<!DOCTYPE html><html><head><meta charset="UTF-8"/></head><body style="margin:0;padding:0;background:#f4f6fb;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6fb;padding:32px 0;">
<tr><td align="center">
<table width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;">
<tr><td style="background:linear-gradient(135deg,#0f172a 0%,#1e3a8a 100%);border-radius:14px 14px 0 0;padding:28px 40px;text-align:center;">
  <div style="font-size:20px;font-weight:800;color:#fff;">📚 ScriptHive Admin</div>
  <div style="font-size:11px;color:rgba(255,255,255,0.6);margin-top:4px;letter-spacing:1px;text-transform:uppercase;">Password Reset</div>
</td></tr>
<tr><td style="background:#fff;padding:40px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">
  <p style="margin:0 0 16px;font-size:15px;color:#374151;">Dear <strong>${admin.name}</strong>,</p>
  <p style="margin:0 0 24px;font-size:14px;color:#374151;line-height:1.6;">We received a request to reset your admin panel password. Use the OTP below to proceed. This code expires in <strong>10 minutes</strong>.</p>
  <div style="text-align:center;background:#f8fafc;border:2px dashed #2563eb;border-radius:12px;padding:24px;margin:0 0 24px;">
    <div style="font-size:11px;color:#64748b;letter-spacing:2px;text-transform:uppercase;margin-bottom:8px;">Your One-Time Password</div>
    <div style="font-size:42px;font-weight:800;letter-spacing:12px;color:#0f172a;font-family:monospace;">${otp}</div>
    <div style="font-size:12px;color:#94a3b8;margin-top:8px;">Valid for 10 minutes only</div>
  </div>
  <p style="margin:0;font-size:13px;color:#64748b;line-height:1.6;">If you did not request a password reset, please ignore this email. Your account remains secure.</p>
</td></tr>
<tr><td style="background:#f8fafc;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 14px 14px;padding:20px 40px;text-align:center;">
  <p style="margin:0;font-size:11px;color:#94a3b8;">ScriptHive Publication &nbsp;|&nbsp; <a href="https://scripthive.org" style="color:#2563eb;text-decoration:none;">scripthive.org</a></p>
</td></tr>
</table></td></tr></table></body></html>`
  });
  void writeAuditLog({ adminId: admin.id, action: "forgot_password_otp_sent", resource: "auth", ipAddress: req.ip });
  res.json({ message: "If that email exists, an OTP has been sent." });
};

/* ── Verify OTP + reset password ────────────────────────────────────────── */
export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  const { email, otp, newPassword } = req.body as { email: string; otp: string; newPassword: string };
  if (!email || !otp || !newPassword) { res.status(400).json({ message: "Email, OTP, and new password are required" }); return; }
  if (newPassword.length < 8) { res.status(400).json({ message: "Password must be at least 8 characters" }); return; }
  // Use raw query to read OTP fields (not yet in Prisma schema on local)
  const rows = await prisma.$queryRaw<{ id: string; otpCode: string | null; otpExpiresAt: Date | null }[]>`
    SELECT id, "otpCode", "otpExpiresAt" FROM "AdminUser" WHERE email = ${email.toLowerCase().trim()} LIMIT 1
  `;
  const admin = await prisma.adminUser.findFirst({ where: { email: email.toLowerCase().trim() } });
  const otpRow = rows[0];
  if (!admin || !otpRow?.otpCode || !otpRow?.otpExpiresAt) { res.status(400).json({ message: "Invalid or expired OTP" }); return; }
  if (otpRow.otpCode !== otp.trim()) { res.status(400).json({ message: "Incorrect OTP" }); return; }
  if (otpRow.otpExpiresAt < new Date()) { res.status(400).json({ message: "OTP has expired. Please request a new one." }); return; }
  const passwordHash = await bcrypt.hash(newPassword, 12);
  await prisma.$executeRaw`UPDATE "AdminUser" SET "passwordHash" = ${passwordHash}, "otpCode" = NULL, "otpExpiresAt" = NULL WHERE id = ${admin.id}`;
  // Invalidate all sessions
  await prisma.refreshToken.deleteMany({ where: { adminId: admin.id } });
  void writeAuditLog({ adminId: admin.id, action: "password_reset", resource: "auth", ipAddress: req.ip });
  res.json({ message: "Password reset successfully. Please log in with your new password." });
};

export const changePassword = async (req: AuthRequest, res: Response): Promise<void> => {
  const { oldPassword, newPassword } = req.body as { oldPassword: string; newPassword: string };
  const adminId = req.admin?.adminId;
  if (!adminId) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
  const admin = await prisma.adminUser.findUnique({ where: { id: adminId } });
  if (!admin || !(await bcrypt.compare(oldPassword, admin.passwordHash))) {
    res.status(400).json({ message: "Invalid old password" });
    return;
  }
  const passwordHash = await bcrypt.hash(newPassword, 12);
  await prisma.adminUser.update({ where: { id: admin.id }, data: { passwordHash } });
  res.json({ message: "Password updated" });
};

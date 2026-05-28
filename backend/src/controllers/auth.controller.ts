import bcrypt from "bcryptjs";
import type { Request, Response } from "express";
import jwt, { type Secret, type SignOptions } from "jsonwebtoken";
import { prisma } from "../config/prisma.js";
import { env } from "../config/env.js";
import type { AuthRequest } from "../middlewares/auth.middleware.js";
import { v4 as uuidv4 } from "uuid";
import { writeAuditLog } from "../utils/auditLog.js";

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

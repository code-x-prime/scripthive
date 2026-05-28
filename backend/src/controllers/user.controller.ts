import bcrypt from "bcryptjs";
import type { Request, Response } from "express";
import { prisma } from "../config/prisma.js";
import type { AuthRequest } from "../middlewares/auth.middleware.js";

const USER_SELECT = {
  id: true,
  name: true,
  email: true,
  username: true,
  roleId: true,
  isActive: true,
  lastLoginAt: true,
  createdBy: true,
  createdAt: true,
  updatedAt: true,
  role: true
} as const;

const normalizeUsername = (value: string): string => value.trim().toLowerCase();

const isValidUsername = (value: string): boolean => /^[a-z0-9][a-z0-9._-]{2,31}$/.test(value);

export const listUsers = async (_req: Request, res: Response): Promise<void> => {
  const users = await prisma.adminUser.findMany({
    select: USER_SELECT,
    orderBy: { createdAt: "desc" }
  });
  res.json(users);
};

export const createUser = async (req: AuthRequest, res: Response): Promise<void> => {
  const { name, username, password, roleId } = req.body as {
    name: string;
    username: string;
    password: string;
    roleId: string;
  };

  const role = await prisma.role.findUnique({ where: { id: roleId } });
  if (!role || role.name === "super_admin") {
    res.status(400).json({ message: "Invalid role" });
    return;
  }

  const uname = normalizeUsername(username ?? "");
  if (!isValidUsername(uname)) {
    res.status(400).json({
      message: "Username must be 3–32 characters: lowercase letters, numbers, dots, underscores, or hyphens"
    });
    return;
  }

  const taken = await prisma.adminUser.findFirst({
    where: { OR: [{ username: uname }, { email: uname }] }
  });
  if (taken) {
    res.status(400).json({ message: "Username already taken" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.adminUser.create({
    data: {
      name: name.trim(),
      username: uname,
      passwordHash,
      roleId,
      createdBy: req.admin?.adminId ?? null
    },
    select: USER_SELECT
  });

  res.status(201).json(user);
};

export const updateUser = async (req: Request, res: Response): Promise<void> => {
  const userId = String(req.params.id);
  const { name, username, roleId, isActive } = req.body as {
    name: string;
    username: string;
    roleId: string;
    isActive: boolean;
  };

  const existing = await prisma.adminUser.findUnique({
    where: { id: userId },
    include: { role: true }
  });
  if (!existing) {
    res.status(404).json({ message: "User not found" });
    return;
  }
  if (existing.role.name === "super_admin") {
    res.status(400).json({ message: "Super admin account cannot be edited here" });
    return;
  }

  const uname = normalizeUsername(username ?? "");
  if (!isValidUsername(uname)) {
    res.status(400).json({
      message: "Username must be 3–32 characters: lowercase letters, numbers, dots, underscores, or hyphens"
    });
    return;
  }

  const taken = await prisma.adminUser.findFirst({
    where: {
      id: { not: userId },
      OR: [{ username: uname }, { email: uname }]
    }
  });
  if (taken) {
    res.status(400).json({ message: "Username already taken" });
    return;
  }

  const user = await prisma.adminUser.update({
    where: { id: userId },
    data: { name: name.trim(), username: uname, roleId, isActive },
    select: USER_SELECT
  });
  res.json(user);
};

export const deleteUser = async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = String(req.params.id);
  if (req.admin?.adminId === userId) {
    res.status(400).json({ message: "You cannot delete your own account" });
    return;
  }
  const target = await prisma.adminUser.findUnique({
    where: { id: userId },
    include: { role: true }
  });
  if (target?.role.name === "super_admin") {
    res.status(400).json({ message: "Cannot delete super admin" });
    return;
  }
  await prisma.adminUser.delete({ where: { id: userId } });
  res.json({ message: "User deleted" });
};

export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  const userId = String(req.params.id);
  const { newPassword } = req.body as { newPassword: string };
  if (newPassword.length < 8) {
    res.status(400).json({ message: "Password must be at least 8 characters" });
    return;
  }
  const passwordHash = await bcrypt.hash(newPassword, 12);
  await prisma.adminUser.update({ where: { id: userId }, data: { passwordHash } });
  await prisma.refreshToken.deleteMany({ where: { adminId: userId } });
  res.json({ message: "Password reset successful" });
};

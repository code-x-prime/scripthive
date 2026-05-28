import type { Request, Response } from "express";
import { prisma } from "../config/prisma.js";

export const listRoles = async (_req: Request, res: Response): Promise<void> => {
  const roles = await prisma.role.findMany({
    include: { permissions: { include: { permission: true } }, users: true },
    orderBy: { createdAt: "asc" }
  });
  res.json(roles);
};

export const listPermissions = async (_req: Request, res: Response): Promise<void> => {
  const permissions = await prisma.permission.findMany({ orderBy: [{ resource: "asc" }, { action: "asc" }] });
  res.json(permissions);
};

export const createRole = async (req: Request, res: Response): Promise<void> => {
  const { name, displayName, description, permissionIds } = req.body as {
    name: string;
    displayName: string;
    description?: string;
    permissionIds: string[];
  };
  const role = await prisma.role.create({
    data: {
      name,
      displayName,
      description: description ?? null,
      permissions: { create: permissionIds.map((permissionId) => ({ permissionId })) }
    }
  });
  res.status(201).json(role);
};

export const updateRole = async (req: Request, res: Response): Promise<void> => {
  const roleId = String(req.params.id);
  const { displayName, description, permissionIds } = req.body as {
    displayName: string;
    description?: string;
    permissionIds: string[];
  };
  const current = await prisma.role.findUnique({ where: { id: roleId } });
  if (!current) {
    res.status(404).json({ message: "Role not found" });
    return;
  }
  if (current.name === "super_admin") {
    res.status(403).json({ message: "super_admin role cannot be modified" });
    return;
  }
  const role = await prisma.role.update({
    where: { id: roleId },
    data: {
      displayName,
      description: description ?? null,
      permissions: {
        deleteMany: {},
        create: permissionIds.map((permissionId) => ({ permissionId }))
      }
    }
  });
  res.json(role);
};

export const deleteRole = async (req: Request, res: Response): Promise<void> => {
  const roleId = String(req.params.id);
  const role = await prisma.role.findUnique({ where: { id: roleId }, include: { users: true } });
  if (!role) {
    res.status(404).json({ message: "Role not found" });
    return;
  }
  if (role.name === "super_admin") {
    res.status(403).json({ message: "Built-in role cannot be deleted" });
    return;
  }
  if (["editor", "accountant", "reviewer"].includes(role.name)) {
    res.status(403).json({ message: "Built-in role cannot be deleted" });
    return;
  }
  if (role.users.length > 0) {
    res.status(400).json({ message: "Cannot delete role with assigned users" });
    return;
  }
  await prisma.role.delete({ where: { id: roleId } });
  res.json({ message: "Role deleted" });
};

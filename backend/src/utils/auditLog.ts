import { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma.js";

export async function writeAuditLog(params: {
  adminId?: string | undefined;
  action: string;
  resource: string;
  resourceId?: string | undefined;
  details?: Record<string, unknown> | undefined;
  ipAddress?: string | undefined;
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        adminId: params.adminId ?? null,
        action: params.action,
        resource: params.resource,
        resourceId: params.resourceId ?? null,
        details: params.details !== undefined ? (params.details as Prisma.InputJsonValue) : Prisma.JsonNull,
        ipAddress: params.ipAddress ?? null
      }
    });
  } catch {
    // non-blocking — never crash main request
  }
}

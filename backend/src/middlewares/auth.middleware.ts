import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export type JwtPayload = {
  adminId: string;
  email: string;
  role: string;
  permissions?: string[];
};

export interface AuthRequest extends Request {
  admin?: JwtPayload;
}

export const authenticate = (req: AuthRequest, res: Response, next: NextFunction): void => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
  const token = auth.replace("Bearer ", "");
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload & { accountType?: string };
    if (decoded.accountType === "author") {
      res.status(403).json({ message: "Use the author portal to sign in" });
      return;
    }
    if (!decoded.adminId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    req.admin = decoded;
    next();
  } catch {
    res.status(401).json({ message: "Invalid token" });
  }
};

export const requirePermission =
  (resource: string, action: string) =>
  (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (req.admin?.role === "super_admin") {
      next();
      return;
    }
    const key = `${resource}:${action}`;
    if (!req.admin?.permissions?.includes(key)) {
      res.status(403).json({ status: 403, message: "Forbidden" });
      return;
    }
    next();
  };

export const requireSuperAdmin = (req: AuthRequest, res: Response, next: NextFunction): void => {
  if (req.admin?.role !== "super_admin") {
    res.status(403).json({ status: 403, message: "Forbidden" });
    return;
  }
  next();
};

export const requireAuth = authenticate;

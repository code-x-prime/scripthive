import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export type AuthorJwtPayload = {
  authorId: string;
  email: string;
  accountType: "author";
};

export interface AuthorRequest extends Request {
  author?: AuthorJwtPayload;
}

export const authenticateAuthor = (req: AuthorRequest, res: Response, next: NextFunction): void => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
  const token = auth.replace("Bearer ", "");
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as AuthorJwtPayload & { accountType?: string };
    if (decoded.accountType !== "author" || !decoded.authorId) {
      res.status(403).json({ message: "Author access required" });
      return;
    }
    req.author = decoded;
    next();
  } catch {
    res.status(401).json({ message: "Invalid or expired token" });
  }
};

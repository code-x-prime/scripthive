import type { NextFunction, Request, Response } from "express";
import { validationResult } from "express-validator";

export const handleValidation = (req: Request, res: Response, next: NextFunction): void => {
  const result = validationResult(req);
  if (!result.isEmpty()) {
    res.status(400).json({ message: "Validation failed", errors: result.array() });
    return;
  }
  next();
};

import type { NextFunction, Request, Response } from "express";
import { logger } from "../utils/logger.js";

interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

export const errorHandler = (err: AppError, req: Request, res: Response, _next: NextFunction): void => {
  const syntaxBody = err instanceof SyntaxError && "body" in err;
  const statusCode = syntaxBody ? 400 : (err.statusCode ?? (err as { status?: number }).status ?? 500);
  const message = syntaxBody
    ? "Invalid request body. Send valid JSON."
    : err.isOperational
      ? err.message
      : statusCode < 500
        ? err.message
        : "Internal server error";

  const logFn = statusCode >= 500 ? logger.error.bind(logger) : logger.warn.bind(logger);
  logFn({
    at: new Date().toISOString(),
    statusCode,
    method: req.method,
    path: req.path,
    message: err.message,
    stack: err.stack
  });
  res.status(statusCode).json({
    status: "error",
    message,
    ...(process.env.NODE_ENV === "development" ? { stack: err.stack } : {})
  });
};

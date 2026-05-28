import type { NextFunction, Request, Response } from "express";

/** body-parser JSON SyntaxError — avoid 500 + stack noise for bad client payloads */
export const jsonBodyErrorHandler = (
  err: Error & { status?: number; body?: unknown },
  _req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
    res.status(400).json({
      message: "Invalid request body. Use JSON with double-quoted keys, e.g. {\"email\":\"...\",\"password\":\"...\"}"
    });
    return;
  }
  next(err);
};

import type { Request, Response } from "express";
import rateLimit from "express-rate-limit";

const jsonRateLimitHandler =
  (message: string) =>
  (_req: Request, res: Response): void => {
    res.status(429).json({ message });
  };

/** Only failed/successful login POSTs — refresh must not count toward this limit. */
export const authLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: jsonRateLimitHandler(
    "Too many login attempts. Please wait 15 minutes and try again."
  )
});

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  handler: jsonRateLimitHandler("Too many requests. Please wait a moment and try again.")
});

export const submissionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: jsonRateLimitHandler("Too many submissions from this IP. Please try again after 15 minutes.")
});

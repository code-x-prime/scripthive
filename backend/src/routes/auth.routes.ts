import { Router } from "express";
import { body } from "express-validator";
import { changePassword, login, logout, me, refresh } from "../controllers/auth.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { handleValidation } from "../middlewares/validate.middleware.js";
import { authLoginLimiter } from "../middlewares/rateLimiter.js";

export const authRouter = Router();

authRouter.post(
  "/login",
  authLoginLimiter,
  body("login").trim().notEmpty().withMessage("Email or username is required"),
  body("password").isLength({ min: 8 }).withMessage("Password must be at least 8 characters"),
  handleValidation,
  login
);
authRouter.post("/logout", logout);
authRouter.get("/refresh", refresh);
authRouter.get("/me", requireAuth, me);
authRouter.put(
  "/change-password",
  requireAuth,
  body("oldPassword").isLength({ min: 8 }),
  body("newPassword").isLength({ min: 8 }),
  handleValidation,
  changePassword
);

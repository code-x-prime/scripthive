import { Router } from "express";
import { body } from "express-validator";
import { changePassword, forgotPassword, login, logout, me, refresh, resetPassword } from "../controllers/auth.controller.js";
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
authRouter.post("/forgot-password", body("email").isEmail().withMessage("Valid email required"), handleValidation, forgotPassword);
authRouter.post(
  "/reset-password",
  body("email").isEmail(),
  body("otp").isLength({ min: 6, max: 6 }).withMessage("OTP must be 6 digits"),
  body("newPassword").isLength({ min: 8 }).withMessage("Password must be at least 8 characters"),
  handleValidation,
  resetPassword
);
authRouter.put(
  "/change-password",
  requireAuth,
  body("oldPassword").isLength({ min: 8 }),
  body("newPassword").isLength({ min: 8 }),
  handleValidation,
  changePassword
);

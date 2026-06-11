import { Router } from "express";
import { body } from "express-validator";
import {
  changeAuthorPassword,
  deleteAuthorAccount,
  forgotAuthorPassword,
  loginAuthor,
  logoutAuthor,
  meAuthor,
  refreshAuthor,
  registerAuthor,
  resetAuthorPassword
} from "../controllers/authorAuth.controller.js";
import { authenticateAuthor } from "../middlewares/author.middleware.js";
import { handleValidation } from "../middlewares/validate.middleware.js";
import { authLoginLimiter } from "../middlewares/rateLimiter.js";
import { validateAuthorPassword } from "../utils/passwordPolicy.js";

const authorPasswordRule = body("password").custom((value: string) => {
  const result = validateAuthorPassword(String(value ?? ""));
  if (!result.valid) throw new Error(result.message);
  return true;
});

const newPasswordRule = body("newPassword").custom((value: string) => {
  const result = validateAuthorPassword(String(value ?? ""));
  if (!result.valid) throw new Error(result.message);
  return true;
});

export const authorAuthRouter = Router();

authorAuthRouter.post(
  "/register",
  authLoginLimiter,
  body("name").trim().notEmpty().withMessage("Full name is required"),
  body("email").trim().isEmail().withMessage("Enter a valid email address (e.g. you@university.edu)"),
  authorPasswordRule,
  handleValidation,
  registerAuthor
);

authorAuthRouter.post(
  "/login",
  authLoginLimiter,
  body("email").trim().isEmail().withMessage("Enter a valid email address"),
  body("password").notEmpty().withMessage("Password is required"),
  handleValidation,
  loginAuthor
);

authorAuthRouter.post("/forgot-password", body("email").isEmail().withMessage("Valid email required"), handleValidation, forgotAuthorPassword);
authorAuthRouter.post("/reset-password", body("token").notEmpty(), body("password").notEmpty(), handleValidation, resetAuthorPassword);
authorAuthRouter.get("/refresh", refreshAuthor);
authorAuthRouter.post("/logout", logoutAuthor);
authorAuthRouter.get("/me", authenticateAuthor, meAuthor);
authorAuthRouter.put(
  "/password",
  authenticateAuthor,
  body("currentPassword").notEmpty().withMessage("Current password is required"),
  newPasswordRule,
  handleValidation,
  changeAuthorPassword
);
authorAuthRouter.delete(
  "/account",
  authenticateAuthor,
  body("password").notEmpty().withMessage("Password is required"),
  handleValidation,
  deleteAuthorAccount
);

import { Router } from "express";
import { body } from "express-validator";
import { createUser, deleteUser, listUsers, resetPassword, updateUser } from "../controllers/user.controller.js";
import { authenticate, requireSuperAdmin } from "../middlewares/auth.middleware.js";
import { handleValidation } from "../middlewares/validate.middleware.js";

export const userRouter = Router();

userRouter.get("/", authenticate, requireSuperAdmin, listUsers);
userRouter.post(
  "/",
  authenticate,
  requireSuperAdmin,
  body("name").trim().isLength({ min: 2 }),
  body("email").trim().isEmail(),
  body("password").isLength({ min: 8 }),
  body("roleId").trim().notEmpty(),
  handleValidation,
  createUser
);
userRouter.put(
  "/:id",
  authenticate,
  requireSuperAdmin,
  body("name").trim().isLength({ min: 2 }),
  body("email").trim().isEmail(),
  body("roleId").trim().notEmpty(),
  body("isActive").isBoolean(),
  handleValidation,
  updateUser
);
userRouter.delete("/:id", authenticate, requireSuperAdmin, deleteUser);
userRouter.post(
  "/:id/reset-password",
  authenticate,
  requireSuperAdmin,
  body("newPassword").isLength({ min: 8 }),
  handleValidation,
  resetPassword
);

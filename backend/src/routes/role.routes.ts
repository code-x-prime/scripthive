import { Router } from "express";
import { body } from "express-validator";
import { createRole, deleteRole, listPermissions, listRoles, updateRole } from "../controllers/role.controller.js";
import { authenticate, requireSuperAdmin } from "../middlewares/auth.middleware.js";
import { handleValidation } from "../middlewares/validate.middleware.js";

export const roleRouter = Router();

roleRouter.get("/", authenticate, requireSuperAdmin, listRoles);
roleRouter.get("/permissions", authenticate, requireSuperAdmin, listPermissions);
roleRouter.post(
  "/",
  authenticate,
  requireSuperAdmin,
  body("name").trim().isLength({ min: 2 }),
  body("displayName").trim().isLength({ min: 2 }),
  body("permissionIds").isArray(),
  handleValidation,
  createRole
);
roleRouter.put(
  "/:id",
  authenticate,
  requireSuperAdmin,
  body("displayName").trim().isLength({ min: 2 }),
  body("permissionIds").isArray(),
  handleValidation,
  updateRole
);
roleRouter.delete("/:id", authenticate, requireSuperAdmin, deleteRole);

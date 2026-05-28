import { Router } from "express";
import {
  createContactQuery, listContactQueries, getContactQuery,
  updateContactQueryStatus, deleteContactQuery
} from "../controllers/contact.controller.js";
import { authenticate, requirePermission } from "../middlewares/auth.middleware.js";

export const contactRouter = Router();

// Public — from client website
contactRouter.post("/", createContactQuery);

// Admin — authenticated
contactRouter.get("/", authenticate, requirePermission("submissions", "read"), listContactQueries);
contactRouter.get("/:id", authenticate, requirePermission("submissions", "read"), getContactQuery);
contactRouter.put("/:id/status", authenticate, requirePermission("submissions", "write"), updateContactQueryStatus);
contactRouter.delete("/:id", authenticate, requirePermission("submissions", "delete"), deleteContactQuery);

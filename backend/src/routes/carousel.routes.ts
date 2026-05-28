import { Router } from "express";
import {
  createCarouselSlide,
  deleteCarouselSlide,
  listCarouselSlides,
  reorderCarouselSlides,
  updateCarouselSlide
} from "../controllers/carousel.controller.js";
import { authenticate, requireSuperAdmin } from "../middlewares/auth.middleware.js";

export const carouselRouter = Router();

// Public: fetch active slides for homepage
carouselRouter.get("/public", (req, res, next) => {
  req.query.activeOnly = "true";
  void listCarouselSlides(req, res).catch(next);
});

// Admin only
carouselRouter.get("/", authenticate, requireSuperAdmin, (req, res, next) => {
  // admin sees all slides
  void listCarouselSlides(req, res).catch(next);
});
carouselRouter.post("/", authenticate, requireSuperAdmin, (req, res, next) => {
  void createCarouselSlide(req, res).catch(next);
});
carouselRouter.put("/reorder", authenticate, requireSuperAdmin, (req, res, next) => {
  void reorderCarouselSlides(req, res).catch(next);
});
carouselRouter.put("/:id", authenticate, requireSuperAdmin, (req, res, next) => {
  void updateCarouselSlide(req, res).catch(next);
});
carouselRouter.delete("/:id", authenticate, requireSuperAdmin, (req, res, next) => {
  void deleteCarouselSlide(req, res).catch(next);
});

import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import path from "path";
import { env } from "./config/env.js";
import { apiLimiter } from "./middlewares/rateLimiter.js";
import { errorHandler } from "./middlewares/errorHandler.js";
import { jsonBodyErrorHandler } from "./middlewares/jsonBody.middleware.js";
import { authRouter } from "./routes/auth.routes.js";
import { authorAuthRouter } from "./routes/authorAuth.routes.js";
import { apiRouter } from "./routes/index.js";


export const app = express();

app.set("trust proxy", 1);
app.use(helmet());
app.use(
  cors({
    origin: env.FRONTEND_URL,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"]
  })
);
app.use(express.json({ limit: "10mb" }));
app.use(jsonBodyErrorHandler);
app.use(cookieParser());

app.use("/uploads/articles", express.static(path.resolve(__dirname, "../uploads/articles")));
app.use("/uploads/manuscripts", express.static(path.resolve(__dirname, "../uploads/manuscripts")));
app.use("/uploads/media", express.static(path.resolve(__dirname, "../uploads/media")));

app.use("/api/auth", authRouter);
app.use("/api/author/auth", authorAuthRouter);
app.use("/api", apiLimiter, apiRouter);

app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
app.use((_req, res) => {
  res.status(404).json({ status: "error", message: "Route not found" });
});
app.use(errorHandler);

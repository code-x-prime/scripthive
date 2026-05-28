import { app } from "./app.js";
import { env } from "./config/env.js";
import { logger } from "./utils/logger.js";

const port = Number(env.PORT);
const server = app.listen(port, () => {
  logger.info(`ScriptHive API listening on ${port}`);
});

const shutdown = (signal: string): void => {
  logger.info(`Received ${signal}. Graceful shutdown started.`);
  server.close(() => {
    logger.info("HTTP server closed.");
    process.exit(0);
  });
  setTimeout(() => {
    logger.error("Forced shutdown after timeout.");
    process.exit(1);
  }, 10000).unref();
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

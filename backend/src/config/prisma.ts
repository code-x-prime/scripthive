import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var prismaClient: PrismaClient | undefined;
}

function createPrismaClient(): PrismaClient {
  return new PrismaClient();
}

/** In dev, nodemon can keep an old PrismaClient in memory after schema changes — recreate if models are missing. */
function getPrismaClient(): PrismaClient {
  const cached = global.prismaClient;
  if (cached && "mediaFile" in cached && "author" in cached) {
    return cached;
  }
  const client = createPrismaClient();
  if (process.env.NODE_ENV !== "production") {
    global.prismaClient = client;
  }
  return client;
}

export const prisma = getPrismaClient();

import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function getDatasourceUrl(): string | undefined {
  let url = process.env.DATABASE_URL;
  const dbName = process.env.DATABASE_NAME;
  if (!url) return undefined;
  if (!dbName) return url;

  // Ensure database name is in MongoDB connection string
  try {
    const isSrv = url.startsWith("mongodb+srv://");
    const isStandard = url.startsWith("mongodb://");
    if (isSrv || isStandard) {
      const prefix = isSrv ? "mongodb+srv://" : "mongodb://";
      const withoutPrefix = url.slice(prefix.length);
      const [hostAndPath, query] = withoutPrefix.split("?");
      const slashIndex = hostAndPath.indexOf("/");
      if (slashIndex === -1 || slashIndex === hostAndPath.length - 1) {
        const host = hostAndPath.replace(/\/$/, "");
        url = `${prefix}${host}/${dbName}${query ? `?${query}` : ""}`;
      }
    }
  } catch {
    // fallback to url as is
  }
  return url;
}

function createPrismaClient() {
  const url = getDatasourceUrl();
  return new PrismaClient(url ? { datasources: { db: { url } } } : undefined);
}

export const prisma = (() => {
  if (globalForPrisma.prisma) {
    return globalForPrisma.prisma;
  }
  const newClient = createPrismaClient();
  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = newClient;
  }
  return newClient;
})();

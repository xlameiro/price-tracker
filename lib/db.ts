import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is not set");
  }
  // pg v8 now treats sslmode=require as verify-full. AWS RDS uses its own CA, so we
  // use libpq-compatible mode which encrypts without requiring full cert chain validation.
  const sslCompatUrl = connectionString.includes("uselibpqcompat")
    ? connectionString
    : connectionString.replace(
        "sslmode=require",
        "sslmode=require&uselibpqcompat=true",
      );
  const adapter = new PrismaPg({ connectionString: sslCompatUrl });
  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });
}

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;

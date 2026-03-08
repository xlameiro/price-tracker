import { defineConfig } from "prisma/config";

// prisma.config.ts is used by the Prisma CLI (migrate, generate, introspect).
// Runtime DB connection (PrismaPg adapter) is configured in lib/db.ts.
export default defineConfig({
  datasource: {
    // DIRECT_URL bypasses connection pooling for migrations (e.g. PgBouncer).
    // Falls back to DATABASE_URL when DIRECT_URL is not set.
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
  },
});

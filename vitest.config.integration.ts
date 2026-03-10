import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vitest/config";

/**
 * Vitest config for INTEGRATION tests.
 * These tests make real HTTP requests to store APIs and are excluded from the
 * regular `pnpm test` run.
 *
 * Run with: pnpm test:integration
 */
export default defineConfig({
  plugins: [react()],
  test: {
    // No jsdom needed for scraper tests — they run in plain Node.js
    environment: "node",
    include: ["**/*.integration.test.ts"],
    exclude: ["node_modules", ".next"],
    // Real network calls can take 10-30 s each; give each test 60 s
    testTimeout: 60_000,
    hookTimeout: 10_000,
    // Run scraper tests concurrently to keep total wall-clock time under ~60 s
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
  },
});

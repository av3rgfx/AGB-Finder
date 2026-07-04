import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}", "prisma/**/*.test.ts"],
    // Valid defaults so modules that import `@/env` load during tests.
    env: {
      DATABASE_URL: "postgresql://u:p@localhost:5432/ufptrade_test",
      DIRECT_URL: "postgresql://u:p@localhost:5432/ufptrade_test",
      NEXTAUTH_URL: "http://localhost:3000",
      NEXTAUTH_SECRET: "test-secret-at-least-32-characters-long",
      REDIS_URL: "redis://localhost:6379",
      IP_HASH_SECRET: "test-ip-hash-secret",
      NODE_ENV: "test",
      // Ermeticità: Vitest carica anche il .env di sviluppo — se contiene key AI
      // reali il gateway risulterebbe configurato e i test farebbero chiamate
      // di rete vere. Le key DEVONO essere vuote nei test.
      GEMINI_API_KEY: "",
      KIMI_API_KEY: "",
    },
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // `server-only` throws when imported outside an RSC bundle; stub it in tests
      // so we can unit-test modules under src/server/*.
      "server-only": fileURLToPath(new URL("./src/test/empty.ts", import.meta.url)),
    },
  },
});

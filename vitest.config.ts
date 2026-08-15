import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  oxc: {
    jsx: { runtime: "automatic" },
  },
  test: {
    environment: "jsdom",
    globals: true,
    include: ["__tests__/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      // `server-only` throws when imported outside an RSC bundler; stub it
      // so server modules (queries, actions) are testable under Vitest.
      "server-only": path.resolve(__dirname, "__tests__/mocks/server-only.ts"),
    },
  },
});

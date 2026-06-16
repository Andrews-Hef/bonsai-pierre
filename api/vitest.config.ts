import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Les tests d'intégration (Testcontainers) démarrent des conteneurs : laisse-leur du temps.
    testTimeout: 60_000,
    hookTimeout: 120_000,
  },
});

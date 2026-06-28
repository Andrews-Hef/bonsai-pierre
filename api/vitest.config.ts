import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Conteneurs PG+Redis démarrés UNE fois par run, URLs fournies aux tests.
    globalSetup: ["tests/globalSetup.ts"],
    // Base Postgres partagée entre fichiers -> pas de parallélisme inter-fichiers
    // (chaque test fait un truncate en beforeEach). Les fonctions pures restent rapides.
    fileParallelism: false,
    // Les tests d'intégration (Testcontainers) démarrent des conteneurs : laisse-leur du temps.
    testTimeout: 60_000,
    hookTimeout: 180_000,
  },
});

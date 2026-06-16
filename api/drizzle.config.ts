// Config drizzle-kit — sert UNIQUEMENT au contrôle de parité du schéma.
// La migration appliquée au runtime reste migrations/0001_init_stone_daily.sql
// (fournie, à utiliser telle quelle) ; voir src/db/migrate.ts.
// `npm run db:parity` génère le DDL depuis schema.ts dans .drizzle/ pour le
// comparer sémantiquement au SQL fourni.
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./.drizzle",
});

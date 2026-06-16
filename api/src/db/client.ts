// Pool Postgres + instance Drizzle. Le schéma est branché à l'étape 2.
// Les fonctions sont des factories (pas de singleton global) pour que les
// tests d'intégration injectent l'URL de leur conteneur Testcontainers.
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";

export type Pool = pg.Pool;

export function createPool(connectionString: string): pg.Pool {
  return new pg.Pool({ connectionString, max: 10 });
}

export function createDb(pool: pg.Pool) {
  return drizzle(pool);
}

export type Db = ReturnType<typeof createDb>;

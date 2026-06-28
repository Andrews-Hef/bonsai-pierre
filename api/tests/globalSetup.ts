// Setup global Vitest : démarre UNE fois par run un Postgres + un Redis réels
// (Testcontainers), applique les migrations, et expose les URLs aux tests via
// `provide`. Base fraîche par run -> pas d'état résiduel, pas de flaky sur
// one-shot/streak. Mocks refusés sur les chemins transactionnels.
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { RedisContainer } from "@testcontainers/redis";
import type { GlobalSetupContext } from "vitest/node";
import { createPool } from "../src/db/client.js";
import { runMigrations } from "../src/db/migrate.js";

export default async function setup({ provide }: GlobalSetupContext) {
  const pg = await new PostgreSqlContainer("postgres:16-alpine").start();
  const redis = await new RedisContainer("redis:7-alpine").start();

  const pgUrl = pg.getConnectionUri();
  const redisUrl = redis.getConnectionUrl();

  // Migrations appliquées une seule fois sur la base partagée du run.
  const pool = createPool(pgUrl);
  try {
    await runMigrations(pool);
  } finally {
    await pool.end();
  }

  provide("pgUrl", pgUrl);
  provide("redisUrl", redisUrl);

  return async () => {
    await redis.stop();
    await pg.stop();
  };
}

declare module "vitest" {
  interface ProvidedContext {
    pgUrl: string;
    redisUrl: string;
  }
}

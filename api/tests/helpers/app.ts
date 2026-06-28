// Fabrique une instance d'app branchée sur les conteneurs partagés (URLs
// fournies par globalSetup). Chaque fichier de test crée la sienne ; le storage
// est un répertoire temporaire isolé. truncateAll() remet la base à blanc entre
// les tests pour une isolation déterministe.
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { inject } from "vitest";
import { buildApp } from "../../src/app.js";
import { createDb, createPool, type Pool } from "../../src/db/client.js";
import { createRedis, type RedisClient } from "../../src/redis/client.js";
import { createFsStorage } from "../../src/storage/fsStorage.js";
import type { StorageClient } from "../../src/storage/types.js";

// >= 16 chars (cf. validation env), mais ici injecté directement.
export const TEST_JWT_SECRET = "test-secret-please-change-0123456789";

export interface TestCtx {
  app: Awaited<ReturnType<typeof buildApp>>;
  pool: Pool;
  redis: RedisClient;
  storage: StorageClient;
  dataDir: string;
  close: () => Promise<void>;
}

export async function makeTestApp(): Promise<TestCtx> {
  const pool = createPool(inject("pgUrl"));
  const redis = createRedis(inject("redisUrl"));
  const dataDir = await mkdtemp(join(tmpdir(), "stone-grids-"));
  const storage = createFsStorage(dataDir);
  const app = buildApp({ db: createDb(pool), redis, storage, jwtSecret: TEST_JWT_SECRET });
  await app.ready();

  return {
    app,
    pool,
    redis,
    storage,
    dataDir,
    async close() {
      await app.close();
      await redis.quit();
      await pool.end();
      await rm(dataDir, { recursive: true, force: true });
    },
  };
}

// Remet la base et Redis à blanc (appeler en beforeEach).
export async function resetState(ctx: TestCtx): Promise<void> {
  await ctx.pool.query("truncate submissions, daily_puzzles, users restart identity cascade");
  await ctx.redis.flushall();
}

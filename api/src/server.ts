// Point d'entrée du runtime : assemble les vraies dépendances depuis l'env,
// démarre Fastify, et ferme proprement (pool pg, redis) à l'arrêt.
import { buildApp } from "./app.js";
import { env } from "./config/env.js";
import { createDb, createPool } from "./db/client.js";
import { createRedis } from "./redis/client.js";
import { createStorage } from "./storage/index.js";

async function main() {
  const pool = createPool(env.DATABASE_URL);
  const redis = createRedis(env.REDIS_URL);
  const storage = createStorage();
  const app = buildApp({ db: createDb(pool), redis, storage, jwtSecret: env.JWT_SECRET });

  const close = async () => {
    await app.close();
    await redis.quit();
    await pool.end();
  };
  for (const sig of ["SIGINT", "SIGTERM"] as const) {
    process.once(sig, () => {
      close().then(() => process.exit(0)).catch((e) => {
        app.log.error(e);
        process.exit(1);
      });
    });
  }

  await app.listen({ port: env.PORT, host: env.HOST });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

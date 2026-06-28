// Fabrique de l'instance Fastify. Les dépendances (db/redis/storage) sont
// INJECTÉES : en prod elles viennent de l'env, en test des conteneurs
// Testcontainers. Les routes /v1 sont ajoutées à l'étape 4.
import Fastify, { type FastifyInstance, type preHandlerHookHandler } from "fastify";
import { requireUser } from "./auth.js";
import type { Db } from "./db/client.js";
import type { RedisClient } from "./redis/client.js";
import { dailyRoutes } from "./routes/daily.js";
import { gridsRoutes } from "./routes/grids.js";
import { leaderboardRoutes } from "./routes/leaderboard.js";
import { submitRoutes } from "./routes/submit.js";
import type { StorageClient } from "./storage/types.js";

export interface AppDeps {
  db: Db;
  redis: RedisClient;
  storage: StorageClient;
  // Secret HS256 du token de session. Injecté (pas importé d'env) pour que les
  // tests Testcontainers n'aient pas à charger le singleton env au boot.
  jwtSecret: string;
}

declare module "fastify" {
  interface FastifyInstance {
    db: Db;
    redis: RedisClient;
    storage: StorageClient;
    jwtSecret: string;
    // preHandler d'auth (x-user-id UUID -> req.userId, sinon 401).
    requireUser: preHandlerHookHandler;
  }
  interface FastifyRequest {
    // Rempli par requireUser ; présent sur les routes protégées.
    userId?: string;
  }
}

export function buildApp(deps: AppDeps): FastifyInstance {
  const app = Fastify({
    logger: true,
    // Borne le body : on rejette tôt les payloads trop gros (anti zip-bomb amont).
    bodyLimit: 256 * 1024,
  });

  app.decorate("db", deps.db);
  app.decorate("redis", deps.redis);
  app.decorate("storage", deps.storage);
  app.decorate("jwtSecret", deps.jwtSecret);
  app.decorate("requireUser", requireUser);
  app.decorateRequest("userId", undefined);

  // Public (pas d'auth).
  app.get("/health", async () => ({ ok: true }));

  // Routes /v1.
  app.register(dailyRoutes);
  app.register(submitRoutes);
  app.register(leaderboardRoutes);
  app.register(gridsRoutes);

  return app;
}

// Fabrique de l'instance Fastify. Les dépendances (db/redis/storage) sont
// INJECTÉES : en prod elles viennent de l'env, en test des conteneurs
// Testcontainers. Les routes /v1 sont ajoutées à l'étape 4.
import Fastify, { type FastifyInstance, type preHandlerHookHandler } from "fastify";
import { requireUser } from "./auth.js";
import type { Db } from "./db/client.js";
import type { RedisClient } from "./redis/client.js";
import type { StorageClient } from "./storage/types.js";

export interface AppDeps {
  db: Db;
  redis: RedisClient;
  storage: StorageClient;
}

declare module "fastify" {
  interface FastifyInstance {
    db: Db;
    redis: RedisClient;
    storage: StorageClient;
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
  app.decorate("requireUser", requireUser);
  app.decorateRequest("userId", undefined);

  // Public (pas d'auth).
  app.get("/health", async () => ({ ok: true }));

  return app;
}

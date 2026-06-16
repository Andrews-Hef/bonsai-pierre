// Client Redis (ioredis). Factory pour injection en test (Testcontainers).
// Rappel : Redis est reconstructible depuis Postgres, jamais la source de vérité.
import { Redis } from "ioredis";

export type RedisClient = Redis;

export function createRedis(url: string): Redis {
  return new Redis(url, { maxRetriesPerRequest: 3 });
}

// Classement Redis (sorted set lb:{date}). Postgres reste la vérité ; Redis est
// reconstructible et ne doit jamais bloquer une soumission ni produire un rang faux.
// zscore = score * 1e7 + (1e7 - min(durationMs, 9_999_999))
//   -> le score domine ; à égalité, le temps le plus court gagne.
import type { RedisClient } from "./redis/client.js";

const SCALE = 10_000_000;
const DURATION_CAP = 9_999_999;
const LB_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 jours

export function lbKey(date: string): string {
  return `lb:${date}`;
}

export function zscoreFor(score: number, durationMs: number): number {
  return score * SCALE + (SCALE - Math.min(durationMs, DURATION_CAP));
}

// Reconstitue (score, durationMs) depuis un zscore (durée exacte si < cap).
export function decodeZscore(z: number): { score: number; durationMs: number } {
  const score = Math.floor(z / SCALE);
  const durationMs = SCALE - (z - score * SCALE);
  return { score, durationMs };
}

// Ajoute/maj le score d'un user et (re)pose l'expiration 7 j.
export async function addToLeaderboard(
  redis: RedisClient,
  date: string,
  userId: string,
  score: number,
  durationMs: number,
): Promise<void> {
  const key = lbKey(date);
  await redis.zadd(key, zscoreFor(score, durationMs), userId);
  await redis.expire(key, LB_TTL_SECONDS);
}

export interface RankInfo {
  rank: number; // 1-based (1 = meilleur)
  percentile: number; // % de joueurs battus
}

// Rang + percentile d'un user ; null s'il est absent du classement.
export async function rankOf(redis: RedisClient, date: string, userId: string): Promise<RankInfo | null> {
  const key = lbKey(date);
  const rank0 = await redis.zrevrank(key, userId);
  if (rank0 === null) return null;
  const total = await redis.zcard(key);
  const percentile = total > 0 ? ((total - rank0 - 1) / total) * 100 : 0;
  return { rank: rank0 + 1, percentile };
}

export interface TopRaw {
  userId: string;
  score: number;
  durationMs: number;
  rank: number; // 1-based
}

// Top N (ZREVRANGE WITHSCORES) décodé ; les display_name sont résolus par l'appelant.
export async function topRaw(redis: RedisClient, date: string, limit: number): Promise<TopRaw[]> {
  const flat = await redis.zrevrange(lbKey(date), 0, limit - 1, "WITHSCORES");
  const out: TopRaw[] = [];
  for (let i = 0; i < flat.length; i += 2) {
    const { score, durationMs } = decodeZscore(Number(flat[i + 1]!));
    out.push({ userId: flat[i]!, score, durationMs, rank: i / 2 + 1 });
  }
  return out;
}

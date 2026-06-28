// GET /v1/daily/leaderboard?date=YYYY-MM-DD&limit=10
// Source : Redis si le set du jour est peuplé ; sinon fallback Postgres (set
// expiré à 7 j, ou Redis indisponible). Le fallback trie EXACTEMENT comme le
// zscore (score DESC, duration_ms ASC, via idx_submissions_leaderboard) -> rang
// identique quel que soit le chemin. display_name résolus en une requête
// id = ANY(...) remappée en mémoire (jamais N requêtes, jamais l'ordre SQL).
import { and, asc, desc, eq, gt, inArray, lt, or, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import type { Db } from "../db/client.js";
import { submissions, users } from "../db/schema.js";
import { decodeZscore, lbKey, topRaw } from "../leaderboard.js";
import type { RedisClient } from "../redis/client.js";
import { isValidDateStr, todayUtc } from "../util/date.js";

interface TopEntry {
  rank: number;
  display_name: string;
  score: number;
  duration_ms: number;
}
interface MeEntry {
  rank: number;
  percentile: number;
  score: number;
}
interface LeaderboardResponse {
  date: string;
  total: number;
  top: TopEntry[];
  me: MeEntry | null;
}

// Remappe des ids -> display_name en UNE requête, dans l'ordre fourni.
async function resolveNames(db: Db, ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const rows = await db
    .select({ id: users.id, displayName: users.displayName })
    .from(users)
    .where(inArray(users.id, ids));
  return new Map(rows.map((r) => [r.id, r.displayName]));
}

async function fromRedis(
  redis: RedisClient,
  db: Db,
  date: string,
  userId: string,
  limit: number,
): Promise<LeaderboardResponse | null> {
  const key = lbKey(date);
  const total = await redis.zcard(key);
  if (total === 0) return null; // set absent/expiré -> bascule Postgres

  const raw = await topRaw(redis, date, limit);
  const nameById = await resolveNames(db, raw.map((r) => r.userId));
  const top: TopEntry[] = raw.map((r) => ({
    rank: r.rank,
    display_name: nameById.get(r.userId) ?? "?",
    score: r.score,
    duration_ms: r.durationMs,
  }));

  // me : valable même hors du top (ZREVRANK sur tout le set).
  let me: MeEntry | null = null;
  const meScore = await redis.zscore(key, userId);
  if (meScore !== null) {
    const rank0 = await redis.zrevrank(key, userId);
    if (rank0 !== null) {
      me = {
        rank: rank0 + 1,
        percentile: ((total - rank0 - 1) / total) * 100,
        score: decodeZscore(Number(meScore)).score,
      };
    }
  }

  return { date, total, top, me };
}

async function fromPostgres(
  db: Db,
  date: string,
  userId: string,
  limit: number,
): Promise<LeaderboardResponse> {
  const totalRow = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(submissions)
    .where(eq(submissions.puzzleOn, date));
  const total = totalRow[0]?.n ?? 0;

  // Même tri que le zscore Redis (utilise idx_submissions_leaderboard).
  const rows = await db
    .select({
      userId: submissions.userId,
      score: submissions.score,
      durationMs: submissions.durationMs,
      displayName: users.displayName,
    })
    .from(submissions)
    .innerJoin(users, eq(users.id, submissions.userId))
    .where(eq(submissions.puzzleOn, date))
    .orderBy(desc(submissions.score), asc(submissions.durationMs))
    .limit(limit);
  const top: TopEntry[] = rows.map((r, i) => ({
    rank: i + 1,
    display_name: r.displayName,
    score: r.score,
    duration_ms: r.durationMs,
  }));

  let me: MeEntry | null = null;
  const meRows = await db
    .select({ score: submissions.score, durationMs: submissions.durationMs })
    .from(submissions)
    .where(and(eq(submissions.puzzleOn, date), eq(submissions.userId, userId)))
    .limit(1);
  const mine = meRows[0];
  if (mine) {
    // Nombre de soumissions strictement devant -> rang (même critère que le zscore).
    const betterRow = await db
      .select({ better: sql<number>`count(*)::int` })
      .from(submissions)
      .where(
        and(
          eq(submissions.puzzleOn, date),
          or(
            gt(submissions.score, mine.score),
            and(eq(submissions.score, mine.score), lt(submissions.durationMs, mine.durationMs)),
          ),
        ),
      );
    const rank0 = betterRow[0]?.better ?? 0;
    me = {
      rank: rank0 + 1,
      percentile: total > 0 ? ((total - rank0 - 1) / total) * 100 : 0,
      score: mine.score,
    };
  }

  return { date, total, top, me };
}

export async function leaderboardRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Querystring: { date?: string; limit?: string } }>(
    "/v1/daily/leaderboard",
    { preHandler: app.requireUser },
    async (req, reply) => {
      const userId = req.userId!;

      const date = req.query.date ?? todayUtc();
      if (!isValidDateStr(date)) {
        return reply.code(400).send({ error: "invalid_date", message: "date attendue au format YYYY-MM-DD" });
      }

      const rawLimit = req.query.limit ? Number.parseInt(req.query.limit, 10) : 10;
      const limit = Number.isFinite(rawLimit) ? Math.min(100, Math.max(1, rawLimit)) : 10;

      // Redis prioritaire ; toute panne Redis -> fallback Postgres (jamais bloquant).
      let resp: LeaderboardResponse | null = null;
      try {
        resp = await fromRedis(app.redis, app.db, date, userId, limit);
      } catch (err) {
        req.log.error({ err }, "classement Redis indisponible, fallback Postgres");
      }
      if (!resp) resp = await fromPostgres(app.db, date, userId, limit);

      return resp;
    },
  );
}

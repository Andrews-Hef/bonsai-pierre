// GET /v1/me/stats?days=30 — statistiques du joueur (lecture pure Postgres).
//
// Choix de fenêtrage (documenté) :
//   - games_played / avg_resemblance / best_score : ALL-TIME (toute l'histoire).
//   - days ne borne QUE history (puzzle_on >= aujourd'hui - days), ordre ASC.
// Joueur sans soumission : agrégats à 0 (coalesce) — jamais NULL, jamais 500.
//
// Streak affiché = streak ACTIF calculé à la lecture : la valeur brute de users
// peut être périmée (joueur qui n'a pas joué hier/aujourd'hui). On renvoie donc
// current si last_played_on ∈ {aujourd'hui, hier}, sinon 0. longest reste brut
// (c'est un maximum historique, jamais périmé).
import { and, asc, eq, gte, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { submissions, users } from "../db/schema.js";
import { subDaysUtc, todayUtc, yesterdayOf } from "../util/date.js";

export async function statsRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Querystring: { days?: string } }>(
    "/v1/me/stats",
    { preHandler: app.requireUser },
    async (req, reply) => {
      const userId = req.userId!;

      const days = req.query.days ? Number.parseInt(req.query.days, 10) : 30;
      if (!Number.isInteger(days) || days < 1 || days > 365) {
        return reply.code(400).send({ error: "invalid_days", message: "days attendu entre 1 et 365" });
      }

      const today = todayUtc();

      // Streaks (bruts) ; le current sera corrigé en "actif" ci-dessous.
      const userRows = await app.db
        .select({
          current: users.currentStreak,
          longest: users.longestStreak,
          lastPlayedOn: users.lastPlayedOn,
        })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      const u = userRows[0];
      const lastPlayed = u?.lastPlayedOn ?? null;
      const activeCurrent =
        lastPlayed === today || lastPlayed === yesterdayOf(today) ? (u?.current ?? 0) : 0;

      // Agrégats ALL-TIME ; coalesce -> 0 si aucune soumission.
      const aggRows = await app.db
        .select({
          games: sql<number>`count(*)::int`,
          avg: sql<number>`coalesce(avg(${submissions.resemblance}), 0)::float`,
          best: sql<number>`coalesce(max(${submissions.score}), 0)::int`,
        })
        .from(submissions)
        .where(eq(submissions.userId, userId));
      const agg = aggRows[0] ?? { games: 0, avg: 0, best: 0 };

      // history : fenêtre des `days` derniers jours, ordre chronologique.
      const cutoff = subDaysUtc(today, days);
      const history = await app.db
        .select({
          date: submissions.puzzleOn,
          score: submissions.score,
          resemblance: submissions.resemblance,
        })
        .from(submissions)
        .where(and(eq(submissions.userId, userId), gte(submissions.puzzleOn, cutoff)))
        .orderBy(asc(submissions.puzzleOn));

      return {
        current_streak: activeCurrent,
        longest_streak: u?.longest ?? 0,
        games_played: agg.games,
        avg_resemblance: agg.avg,
        best_score: agg.best,
        history,
      };
    },
  );
}

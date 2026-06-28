// GET /v1/daily — renvoie le puzzle du jour (UTC) et émet le token de session.
// Cache-Control: no-store (réponse personnalisée + token). Si la row du jour
// est absente -> 503 + log (jamais de génération à la volée).
import { and, eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { dailyPuzzles, submissions } from "../db/schema.js";
import { issueSessionToken } from "../session.js";
import { todayUtc } from "../util/date.js";

export async function dailyRoutes(app: FastifyInstance): Promise<void> {
  app.get("/v1/daily", { preHandler: app.requireUser }, async (req, reply) => {
    const userId = req.userId!;
    const today = todayUtc();

    const puzzleRows = await app.db
      .select()
      .from(dailyPuzzles)
      .where(eq(dailyPuzzles.puzzleOn, today))
      .limit(1);
    const puzzle = puzzleRows[0];
    if (!puzzle) {
      req.log.error({ puzzleOn: today }, "aucun puzzle quotidien pour aujourd'hui");
      return reply
        .code(503)
        .send({ error: "no_daily_puzzle", message: "Le puzzle du jour n'est pas encore disponible." });
    }

    const played = await app.db
      .select({ userId: submissions.userId })
      .from(submissions)
      .where(and(eq(submissions.userId, userId), eq(submissions.puzzleOn, today)))
      .limit(1);

    const { token, startedAt } = issueSessionToken(app.jwtSecret, { userId, puzzleOn: today });

    reply.header("Cache-Control", "no-store");
    return {
      puzzle_on: puzzle.puzzleOn,
      grid_size: puzzle.gridSize,
      shape_name: puzzle.shapeName,
      start_grid_url: app.storage.publicUrl(puzzle.startKey),
      target_grid_url: app.storage.publicUrl(puzzle.targetKey),
      already_played: played.length > 0,
      session: { token, started_at: new Date(startedAt).toISOString() },
    };
  });
}

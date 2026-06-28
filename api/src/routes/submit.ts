// POST /v1/daily/submit — soumission notée par le serveur.
// Ordre de validation (strict) :
//   auth -> token (sig+exp, 401) -> userId match (403) -> puzzleOn == aujourd'hui (409)
//   -> grille (assertSafeEncoded + decodeGrid + longueur N³, 422)
//   -> IoU recalculé serveur -> durée clamp -> score
//   -> insert ON CONFLICT DO NOTHING (+ streak, MÊME transaction) -> 0 ligne = 409
//   -> ZADD Redis APRÈS commit ; si Redis échoue : rank/percentile = null, top = []
//      (la soumission compte quand même, jamais de rang faux).
import { eq, inArray } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { dailyPuzzles, submissions, users } from "../db/schema.js";
import { addToLeaderboard, rankOf, topRaw } from "../leaderboard.js";
import { verifySessionToken } from "../session.js";
import { todayUtc, yesterdayOf } from "../util/date.js";
import { decodeGrid, GRID_SIZE, assertSafeEncoded, iou, gameScore } from "../../../shared/voxel.js";

const N3 = GRID_SIZE * GRID_SIZE * GRID_SIZE;
const DURATION_MIN = 1_000;
const DURATION_MAX = 3_600_000;

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export async function submitRoutes(app: FastifyInstance): Promise<void> {
  app.post("/v1/daily/submit", { preHandler: app.requireUser }, async (req, reply) => {
    const userId = req.userId!;
    const body = req.body as { session_token?: unknown; final_grid?: unknown } | undefined;

    // --- token (avant la grille) ---
    if (typeof body?.session_token !== "string") {
      return reply.code(401).send({ error: "unauthorized", message: "session_token manquant" });
    }
    let claims;
    try {
      claims = verifySessionToken(app.jwtSecret, body.session_token);
    } catch {
      return reply.code(401).send({ error: "invalid_session", message: "token invalide ou expiré" });
    }
    if (claims.userId !== userId) {
      return reply.code(403).send({ error: "user_mismatch", message: "le token appartient à un autre joueur" });
    }
    const today = todayUtc();
    if (claims.puzzleOn !== today) {
      return reply.code(409).send({ error: "stale_puzzle", message: "ce token ne concerne pas le puzzle du jour" });
    }

    // --- grille joueur (422 sur tout défaut de forme) ---
    if (typeof body.final_grid !== "string") {
      return reply.code(422).send({ error: "invalid_grid", message: "final_grid manquant" });
    }
    let playerGrid: Uint8Array;
    try {
      assertSafeEncoded(body.final_grid);
      playerGrid = decodeGrid(body.final_grid);
      if (playerGrid.length !== N3) throw new Error("longueur incorrecte");
    } catch {
      return reply.code(422).send({ error: "invalid_grid", message: "grille malformée ou mauvaise taille" });
    }

    // --- cible du jour (depuis le storage) ---
    const puzzleRows = await app.db
      .select({ targetKey: dailyPuzzles.targetKey })
      .from(dailyPuzzles)
      .where(eq(dailyPuzzles.puzzleOn, today))
      .limit(1);
    const puzzle = puzzleRows[0];
    if (!puzzle) {
      return reply.code(409).send({ error: "no_active_puzzle", message: "aucun puzzle actif aujourd'hui" });
    }
    const targetGrid = decodeGrid((await app.storage.get(puzzle.targetKey)).toString());

    // --- score recalculé serveur (le client n'est jamais cru) ---
    const resemblance = iou(playerGrid, targetGrid);
    const durationMs = clamp(Date.now() - claims.startedAt, DURATION_MIN, DURATION_MAX);
    const score = gameScore(resemblance, durationMs);

    // --- insert + streak dans UNE transaction ; 0 ligne = déjà joué = 409 ---
    const conflict = await app.db.transaction(async (tx) => {
      const inserted = await tx
        .insert(submissions)
        .values({ userId, puzzleOn: today, resemblance, durationMs, score })
        .onConflictDoNothing({ target: [submissions.userId, submissions.puzzleOn] })
        .returning({ id: submissions.id });
      if (inserted.length === 0) return true;

      // L'insert a réussi -> la row user existe (FK) ; on la verrouille pour le streak.
      const urows = await tx
        .select({
          lastPlayedOn: users.lastPlayedOn,
          current: users.currentStreak,
          longest: users.longestStreak,
        })
        .from(users)
        .where(eq(users.id, userId))
        .for("update");
      const u = urows[0]!;
      const current = u.lastPlayedOn === yesterdayOf(today) ? u.current + 1 : 1;
      const longest = Math.max(u.longest, current);
      await tx
        .update(users)
        .set({ currentStreak: current, longestStreak: longest, lastPlayedOn: today })
        .where(eq(users.id, userId));
      return false;
    });

    if (conflict) {
      return reply.code(409).send({ error: "already_played", message: "déjà joué aujourd'hui" });
    }

    // --- Redis APRÈS commit : best-effort, jamais bloquant, jamais de rang faux ---
    let rank: number | null = null;
    let percentile: number | null = null;
    let top: { rank: number; display_name: string; score: number; duration_ms: number }[] = [];
    try {
      await addToLeaderboard(app.redis, today, userId, score, durationMs);
      const info = await rankOf(app.redis, today, userId);
      if (info) {
        rank = info.rank;
        percentile = info.percentile;
      }
      const raw = await topRaw(app.redis, today, 3);
      if (raw.length > 0) {
        const names = await app.db
          .select({ id: users.id, displayName: users.displayName })
          .from(users)
          .where(inArray(users.id, raw.map((r) => r.userId)));
        const nameById = new Map(names.map((n) => [n.id, n.displayName]));
        top = raw.map((r) => ({
          rank: r.rank,
          display_name: nameById.get(r.userId) ?? "?",
          score: r.score,
          duration_ms: r.durationMs,
        }));
      }
    } catch (err) {
      req.log.error({ err }, "classement Redis indisponible après soumission");
    }

    return reply.code(200).send({ resemblance, duration_ms: durationMs, score, rank, percentile, top });
  });
}

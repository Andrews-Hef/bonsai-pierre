// Tests d'intégration POST /v1/daily/submit (Postgres + Redis réels).
// Couvre : recompute serveur (client menteur ignoré), one-shot 409 + 1 seule
// ligne, streak J/J+1 puis reset, 403 (autre user), 401 (token expiré),
// 422 (mauvaise taille de grille).
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { encodeGrid, gameScore, iou } from "../../shared/voxel.js";
import { todayUtc, yesterdayOf } from "../src/util/date.js";
import { makeTestApp, resetState, type TestCtx } from "./helpers/app.js";
import { seedPuzzle, seedUser, type PuzzleFixture } from "./helpers/fixtures.js";
import { signSession } from "./helpers/token.js";

let ctx: TestCtx;
const today = todayUtc();

beforeAll(async () => {
  ctx = await makeTestApp();
});
afterAll(async () => {
  await ctx.close();
});
beforeEach(async () => {
  await resetState(ctx);
});

function submit(userId: string, body: unknown) {
  return ctx.app.inject({
    method: "POST",
    url: "/v1/daily/submit",
    headers: { "x-user-id": userId },
    payload: body as object,
  });
}

async function countSubmissions(userId: string): Promise<number> {
  const { rows } = await ctx.pool.query<{ n: string }>(
    "select count(*)::int as n from submissions where user_id=$1 and puzzle_on=$2",
    [userId, today],
  );
  return Number(rows[0]!.n);
}

async function getUser(userId: string) {
  const { rows } = await ctx.pool.query<{ current_streak: number; longest_streak: number; last_played_on: string }>(
    "select current_streak, longest_streak, last_played_on::text as last_played_on from users where id=$1",
    [userId],
  );
  return rows[0]!;
}

describe("POST /v1/daily/submit — scoring serveur", () => {
  let userId: string;
  let fx: PuzzleFixture;
  beforeEach(async () => {
    userId = await seedUser(ctx);
    fx = await seedPuzzle(ctx, today);
  });

  it("client menteur : IoU recalculé serveur, score client ignoré", async () => {
    // Le joueur soumet une grille partielle MAIS prétend un score énorme.
    const player = new Uint8Array(fx.targetGrid); // copie de la cible...
    player[0] = 1; // ...avec un voxel en trop -> IoU < 1, connu
    const expectedResemblance = iou(player, fx.targetGrid);

    const token = signSession({ userId, puzzleOn: today });
    const res = await submit(userId, { session_token: token, final_grid: encodeGrid(player), score: 999999 });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.resemblance).toBeCloseTo(expectedResemblance, 6);
    expect(body.resemblance).toBeLessThan(1);
    // Score = fonction serveur de la durée renvoyée, jamais le 999999 du client.
    expect(body.score).toBe(gameScore(body.resemblance, body.duration_ms));
    expect(body.score).not.toBe(999999);
  });

  it("grille = cible -> resemblance 1, rang 1, top peuplé", async () => {
    const token = signSession({ userId, puzzleOn: today });
    const res = await submit(userId, { session_token: token, final_grid: encodeGrid(fx.targetGrid) });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.resemblance).toBe(1);
    expect(body.score).toBe(gameScore(1, body.duration_ms));
    expect(body.rank).toBe(1);
    expect(body.percentile).toBe(0); // seul joueur -> 0 % battus
    expect(body.top).toHaveLength(1);
    expect(body.top[0]).toMatchObject({ rank: 1, score: body.score });
  });
});

describe("POST /v1/daily/submit — one-shot", () => {
  it("2e envoi -> 409 et UNE seule ligne en base", async () => {
    const userId = await seedUser(ctx);
    const fx = await seedPuzzle(ctx, today);
    const grid = encodeGrid(fx.targetGrid);

    const t1 = signSession({ userId, puzzleOn: today });
    const r1 = await submit(userId, { session_token: t1, final_grid: grid });
    expect(r1.statusCode).toBe(200);

    const t2 = signSession({ userId, puzzleOn: today });
    const r2 = await submit(userId, { session_token: t2, final_grid: grid });
    expect(r2.statusCode).toBe(409);

    expect(await countSubmissions(userId)).toBe(1);
  });
});

describe("POST /v1/daily/submit — streak", () => {
  it("J : premier jour -> streak 1", async () => {
    const userId = await seedUser(ctx);
    const fx = await seedPuzzle(ctx, today);
    const token = signSession({ userId, puzzleOn: today });
    await submit(userId, { session_token: token, final_grid: encodeGrid(fx.targetGrid) });

    const u = await getUser(userId);
    expect(u.current_streak).toBe(1);
    expect(u.longest_streak).toBe(1);
    expect(u.last_played_on).toBe(today);
  });

  it("J+1 (a joué hier) -> streak 2", async () => {
    const userId = await seedUser(ctx);
    const fx = await seedPuzzle(ctx, today);
    // Simule un état "a joué hier, streak 1".
    await ctx.pool.query(
      "update users set current_streak=1, longest_streak=1, last_played_on=$2 where id=$1",
      [userId, yesterdayOf(today)],
    );
    const token = signSession({ userId, puzzleOn: today });
    await submit(userId, { session_token: token, final_grid: encodeGrid(fx.targetGrid) });

    const u = await getUser(userId);
    expect(u.current_streak).toBe(2);
    expect(u.longest_streak).toBe(2);
  });

  it("trou de plusieurs jours -> reset à 1, longest conservé", async () => {
    const userId = await seedUser(ctx);
    const fx = await seedPuzzle(ctx, today);
    // A joué il y a longtemps avec un long streak passé.
    await ctx.pool.query(
      "update users set current_streak=5, longest_streak=7, last_played_on='2026-01-01' where id=$1",
      [userId],
    );
    const token = signSession({ userId, puzzleOn: today });
    await submit(userId, { session_token: token, final_grid: encodeGrid(fx.targetGrid) });

    const u = await getUser(userId);
    expect(u.current_streak).toBe(1); // reset
    expect(u.longest_streak).toBe(7); // conservé
  });
});

describe("POST /v1/daily/submit — validation", () => {
  let userId: string;
  let fx: PuzzleFixture;
  beforeEach(async () => {
    userId = await seedUser(ctx);
    fx = await seedPuzzle(ctx, today);
  });

  it("401 si token manquant", async () => {
    const res = await submit(userId, { final_grid: encodeGrid(fx.targetGrid) });
    expect(res.statusCode).toBe(401);
  });

  it("401 si token expiré", async () => {
    const token = signSession({ userId, puzzleOn: today, expiresIn: "-1s" });
    const res = await submit(userId, { session_token: token, final_grid: encodeGrid(fx.targetGrid) });
    expect(res.statusCode).toBe(401);
  });

  it("403 si le token appartient à un autre joueur", async () => {
    const other = await seedUser(ctx, "Autre");
    const token = signSession({ userId: other, puzzleOn: today });
    const res = await submit(userId, { session_token: token, final_grid: encodeGrid(fx.targetGrid) });
    expect(res.statusCode).toBe(403);
  });

  it("409 si le token vise un autre jour", async () => {
    const token = signSession({ userId, puzzleOn: yesterdayOf(today) });
    const res = await submit(userId, { session_token: token, final_grid: encodeGrid(fx.targetGrid) });
    expect(res.statusCode).toBe(409);
  });

  it("422 si la grille a une mauvaise taille", async () => {
    // Grille encodée pour n=8 -> trop courte pour un décodage en 24³.
    const small = encodeGrid(new Uint8Array(8 * 8 * 8), 8);
    const token = signSession({ userId, puzzleOn: today });
    const res = await submit(userId, { session_token: token, final_grid: small });
    expect(res.statusCode).toBe(422);
  });

  it("422 si final_grid est absent", async () => {
    const token = signSession({ userId, puzzleOn: today });
    const res = await submit(userId, { session_token: token });
    expect(res.statusCode).toBe(422);
  });
});

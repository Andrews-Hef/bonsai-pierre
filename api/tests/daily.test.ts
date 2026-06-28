// Tests d'intégration GET /v1/daily (Postgres + Redis réels via Testcontainers).
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { encodeGrid } from "../../shared/voxel.js";
import { verifySessionToken } from "../src/session.js";
import { todayUtc } from "../src/util/date.js";
import { makeTestApp, resetState, TEST_JWT_SECRET, type TestCtx } from "./helpers/app.js";
import { seedPuzzle, seedUser } from "./helpers/fixtures.js";

let ctx: TestCtx;

beforeAll(async () => {
  ctx = await makeTestApp();
});
afterAll(async () => {
  await ctx.close();
});
beforeEach(async () => {
  await resetState(ctx);
});

describe("GET /v1/daily", () => {
  it("401 sans en-tête x-user-id", async () => {
    const res = await ctx.app.inject({ method: "GET", url: "/v1/daily" });
    expect(res.statusCode).toBe(401);
  });

  it("401 si x-user-id n'est pas un UUID", async () => {
    const res = await ctx.app.inject({
      method: "GET",
      url: "/v1/daily",
      headers: { "x-user-id": "pas-un-uuid" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("503 si aucun puzzle pour aujourd'hui", async () => {
    const userId = await seedUser(ctx);
    const res = await ctx.app.inject({
      method: "GET",
      url: "/v1/daily",
      headers: { "x-user-id": userId },
    });
    expect(res.statusCode).toBe(503);
    expect(res.json()).toMatchObject({ error: "no_daily_puzzle" });
  });

  it("200 : renvoie le puzzle, no-store, et un token de session valide", async () => {
    const userId = await seedUser(ctx);
    const today = todayUtc();
    const fixture = await seedPuzzle(ctx, today);

    const before = Date.now();
    const res = await ctx.app.inject({
      method: "GET",
      url: "/v1/daily",
      headers: { "x-user-id": userId },
    });
    const after = Date.now();

    expect(res.statusCode).toBe(200);
    expect(res.headers["cache-control"]).toBe("no-store");

    const body = res.json();
    expect(body).toMatchObject({
      puzzle_on: today,
      grid_size: 24,
      shape_name: "cube",
      start_grid_url: `/v1/grids/${fixture.startKey}`,
      target_grid_url: `/v1/grids/${fixture.targetKey}`,
      already_played: false,
    });
    expect(typeof body.session.token).toBe("string");
    expect(typeof body.session.started_at).toBe("string");

    // Le token est un vrai JWT vérifiable, avec les bons claims figés serveur.
    const claims = verifySessionToken(TEST_JWT_SECRET, body.session.token);
    expect(claims.userId).toBe(userId);
    expect(claims.puzzleOn).toBe(today);
    expect(claims.startedAt).toBeGreaterThanOrEqual(before);
    expect(claims.startedAt).toBeLessThanOrEqual(after);
  });

  it("already_played=true après une soumission existante", async () => {
    const userId = await seedUser(ctx);
    const today = todayUtc();
    await seedPuzzle(ctx, today);
    await ctx.pool.query(
      `insert into submissions (user_id, puzzle_on, resemblance, duration_ms, score)
       values ($1, $2, 0.5, 5000, 500)`,
      [userId, today],
    );

    const res = await ctx.app.inject({
      method: "GET",
      url: "/v1/daily",
      headers: { "x-user-id": userId },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().already_played).toBe(true);
  });

  it("la grille pointée par start_grid_url est servie et décodable", async () => {
    const userId = await seedUser(ctx);
    const today = todayUtc();
    const fixture = await seedPuzzle(ctx, today);

    const daily = await ctx.app.inject({
      method: "GET",
      url: "/v1/daily",
      headers: { "x-user-id": userId },
    });
    const url = daily.json().start_grid_url as string;

    const grid = await ctx.app.inject({ method: "GET", url });
    expect(grid.statusCode).toBe(200);
    expect(grid.headers["cache-control"]).toContain("immutable");
    // Le contenu servi == le base64 stocké pour la grille de départ.
    expect(grid.body).toBe(encodeGrid(fixture.startGrid));
  });
});

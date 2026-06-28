// Tests d'intégration GET /v1/daily/leaderboard.
// Couvre : ordre (score DESC, durée ASC) via Redis ET via fallback Postgres
// (rang identique), me hors du top, me:null si pas joué, validation date -> 400.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { addToLeaderboard } from "../src/leaderboard.js";
import { todayUtc } from "../src/util/date.js";
import { makeTestApp, resetState, type TestCtx } from "./helpers/app.js";
import { seedPuzzle, seedUser } from "./helpers/fixtures.js";

let ctx: TestCtx;
const today = todayUtc();
const past = "2026-06-01";

beforeAll(async () => {
  ctx = await makeTestApp();
});
afterAll(async () => {
  await ctx.close();
});
beforeEach(async () => {
  await resetState(ctx);
});

function get(userId: string, query: string) {
  return ctx.app.inject({
    method: "GET",
    url: `/v1/daily/leaderboard${query}`,
    headers: { "x-user-id": userId },
  });
}

async function insertSubmission(userId: string, date: string, score: number, durationMs: number) {
  await ctx.pool.query(
    `insert into submissions (user_id, puzzle_on, resemblance, duration_ms, score)
     values ($1, $2, 0.5, $3, $4)`,
    [userId, date, durationMs, score],
  );
}

describe("GET /v1/daily/leaderboard — chemin Redis", () => {
  let a: string;
  let b: string;
  let c: string;
  beforeEach(async () => {
    await seedPuzzle(ctx, today);
    a = await seedUser(ctx, "Alice");
    b = await seedUser(ctx, "Bob");
    c = await seedUser(ctx, "Carol");
    // Bob et Alice à égalité de score -> le plus rapide (Bob) devant.
    await addToLeaderboard(ctx.redis, today, a, 1000, 5000);
    await addToLeaderboard(ctx.redis, today, b, 1000, 3000);
    await addToLeaderboard(ctx.redis, today, c, 500, 1000);
  });

  it("ordonne par score DESC puis durée ASC, avec display_name", async () => {
    const res = await get(a, `?date=${today}&limit=10`);
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.date).toBe(today);
    expect(body.total).toBe(3);
    expect(body.top.map((t: { display_name: string }) => t.display_name)).toEqual(["Bob", "Alice", "Carol"]);
    expect(body.top.map((t: { rank: number }) => t.rank)).toEqual([1, 2, 3]);
    expect(body.top[0]).toMatchObject({ display_name: "Bob", score: 1000, duration_ms: 3000 });
  });

  it("me reflète le rang du demandeur (Alice 2e)", async () => {
    const res = await get(a, `?date=${today}`);
    const body = res.json();
    expect(body.me).toMatchObject({ rank: 2, score: 1000 });
    expect(body.me.percentile).toBeCloseTo(((3 - 1 - 1) / 3) * 100, 6);
  });

  it("me valable hors du top (limit=1 mais Carol 3e)", async () => {
    const res = await get(c, `?date=${today}&limit=1`);
    const body = res.json();
    expect(body.top).toHaveLength(1);
    expect(body.top[0].display_name).toBe("Bob");
    expect(body.me).toMatchObject({ rank: 3, score: 500 });
  });

  it("me:null si le demandeur n'a pas joué", async () => {
    const d = await seedUser(ctx, "Dan");
    const res = await get(d, `?date=${today}`);
    expect(res.json().me).toBeNull();
  });

  it("date par défaut = aujourd'hui si absente", async () => {
    const res = await get(a, "");
    expect(res.statusCode).toBe(200);
    expect(res.json().date).toBe(today);
  });

  it("limit hors borne est plafonné (pas d'erreur)", async () => {
    const res = await get(a, `?date=${today}&limit=99999`);
    expect(res.statusCode).toBe(200);
    expect(res.json().top).toHaveLength(3);
  });
});

describe("GET /v1/daily/leaderboard — fallback Postgres (Redis vide)", () => {
  it("même ordre et même rang que Redis, sans set Redis", async () => {
    await seedPuzzle(ctx, past);
    const a = await seedUser(ctx, "Alice");
    const b = await seedUser(ctx, "Bob");
    const c = await seedUser(ctx, "Carol");
    // Soumissions UNIQUEMENT en Postgres (Redis vide -> fallback).
    await insertSubmission(a, past, 1000, 5000);
    await insertSubmission(b, past, 1000, 3000);
    await insertSubmission(c, past, 500, 1000);

    const res = await get(a, `?date=${past}`);
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.total).toBe(3);
    expect(body.top.map((t: { display_name: string }) => t.display_name)).toEqual(["Bob", "Alice", "Carol"]);
    expect(body.top.map((t: { rank: number }) => t.rank)).toEqual([1, 2, 3]);
    // Alice : même rang (2) que par le chemin Redis.
    expect(body.me).toMatchObject({ rank: 2, score: 1000 });
    expect(body.me.percentile).toBeCloseTo(((3 - 1 - 1) / 3) * 100, 6);
  });

  it("jour sans aucune soumission -> total 0, top vide, me null", async () => {
    await seedPuzzle(ctx, past);
    const a = await seedUser(ctx, "Alice");
    const res = await get(a, `?date=${past}`);
    const body = res.json();
    expect(body).toMatchObject({ total: 0, top: [], me: null });
  });
});

describe("GET /v1/daily/leaderboard — validation", () => {
  it("400 si la date est malformée", async () => {
    const a = await seedUser(ctx, "Alice");
    const res = await get(a, "?date=2026-13-40");
    expect(res.statusCode).toBe(400);
  });

  it("401 sans x-user-id", async () => {
    const res = await ctx.app.inject({ method: "GET", url: `/v1/daily/leaderboard?date=${today}` });
    expect(res.statusCode).toBe(401);
  });
});

// Tests d'intégration GET /v1/me/stats.
// Couvre : joueur vide (agrégats 0, pas de 500), agrégats ALL-TIME vs history
// borné par days, ordre ASC, streak actif (today/yesterday/périmé), validation days.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { subDaysUtc, todayUtc } from "../src/util/date.js";
import { makeTestApp, resetState, type TestCtx } from "./helpers/app.js";
import { seedPuzzle, seedUser } from "./helpers/fixtures.js";

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

function get(userId: string, query = "") {
  return ctx.app.inject({ method: "GET", url: `/v1/me/stats${query}`, headers: { "x-user-id": userId } });
}

async function insertSub(userId: string, date: string, score: number, resemblance: number) {
  await ctx.pool.query(
    `insert into submissions (user_id, puzzle_on, resemblance, duration_ms, score)
     values ($1, $2, $3, 5000, $4)`,
    [userId, date, resemblance, score],
  );
}

async function setStreak(userId: string, current: number, longest: number, lastPlayedOn: string | null) {
  await ctx.pool.query(
    "update users set current_streak=$2, longest_streak=$3, last_played_on=$4 where id=$1",
    [userId, current, longest, lastPlayedOn],
  );
}

describe("GET /v1/me/stats — joueur sans soumission", () => {
  it("agrégats à 0, streaks à 0, history vide (jamais NULL/500)", async () => {
    const userId = await seedUser(ctx);
    const res = await get(userId);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      current_streak: 0,
      longest_streak: 0,
      games_played: 0,
      avg_resemblance: 0,
      best_score: 0,
      history: [],
    });
  });
});

describe("GET /v1/me/stats — agrégats all-time vs fenêtre history", () => {
  it("games_played/avg/best = all-time ; history borné par days", async () => {
    const userId = await seedUser(ctx);
    const old = subDaysUtc(today, 40);
    await seedPuzzle(ctx, today);
    await seedPuzzle(ctx, old);
    await insertSub(userId, today, 800, 0.8);
    await insertSub(userId, old, 1000, 1.0); // hors fenêtre 30j

    const res = await get(userId, "?days=30");
    const body = res.json();
    // all-time : compte les deux soumissions.
    expect(body.games_played).toBe(2);
    expect(body.best_score).toBe(1000);
    expect(body.avg_resemblance).toBeCloseTo((0.8 + 1.0) / 2, 6);
    // history : seule la soumission dans les 30 jours.
    expect(body.history).toHaveLength(1);
    expect(body.history[0]).toMatchObject({ date: today, score: 800 });
  });

  it("history trié par date ASC", async () => {
    const userId = await seedUser(ctx);
    const d5 = subDaysUtc(today, 5);
    const d2 = subDaysUtc(today, 2);
    for (const d of [d5, d2, today]) await seedPuzzle(ctx, d);
    // Insertion dans le désordre.
    await insertSub(userId, d2, 600, 0.6);
    await insertSub(userId, today, 700, 0.7);
    await insertSub(userId, d5, 500, 0.5);

    const res = await get(userId, "?days=30");
    expect(res.json().history.map((h: { date: string }) => h.date)).toEqual([d5, d2, today]);
  });
});

describe("GET /v1/me/stats — streak actif", () => {
  it("a joué aujourd'hui -> current brut", async () => {
    const userId = await seedUser(ctx);
    await setStreak(userId, 4, 9, today);
    const body = (await get(userId)).json();
    expect(body.current_streak).toBe(4);
    expect(body.longest_streak).toBe(9);
  });

  it("a joué hier -> current brut (streak encore vivant)", async () => {
    const userId = await seedUser(ctx);
    await setStreak(userId, 4, 9, subDaysUtc(today, 1));
    expect((await get(userId)).json().current_streak).toBe(4);
  });

  it("dernier jeu trop ancien -> current actif 0, longest conservé", async () => {
    const userId = await seedUser(ctx);
    await setStreak(userId, 4, 9, subDaysUtc(today, 3));
    const body = (await get(userId)).json();
    expect(body.current_streak).toBe(0);
    expect(body.longest_streak).toBe(9);
  });
});

describe("GET /v1/me/stats — validation", () => {
  it("400 si days hors borne (0, 366, non entier)", async () => {
    const userId = await seedUser(ctx);
    for (const d of ["0", "366", "abc"]) {
      expect((await get(userId, `?days=${d}`)).statusCode).toBe(400);
    }
  });

  it("365 accepté", async () => {
    const userId = await seedUser(ctx);
    expect((await get(userId, "?days=365")).statusCode).toBe(200);
  });

  it("401 sans x-user-id", async () => {
    const res = await ctx.app.inject({ method: "GET", url: "/v1/me/stats" });
    expect(res.statusCode).toBe(401);
  });
});

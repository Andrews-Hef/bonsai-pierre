// Tests d'intégration de l'outil seed:user (Postgres réel).
// Spec : crée une row users de façon reproductible et idempotente, afin que
// /v1/daily/submit (FK user_id) accepte un userId de dev sans SQL ad hoc.
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { users } from "../src/db/schema.js";
import { runSeedUser, type SeedUserDeps } from "../src/tools/seedUser.js";
import { makeTestApp, resetState, type TestCtx } from "./helpers/app.js";

let ctx: TestCtx;
let deps: SeedUserDeps;

const ID = "00000000-0000-4000-8000-000000000001";

beforeAll(async () => {
  ctx = await makeTestApp();
  deps = { db: ctx.app.db };
});
afterAll(async () => {
  await ctx.close();
});
beforeEach(async () => {
  await resetState(ctx);
});

async function getUser(id: string) {
  const rows = await ctx.app.db.select().from(users).where(eq(users.id, id));
  return rows[0];
}

describe("seed:user", () => {
  it("insère une row absente -> created=true", async () => {
    const r = await runSeedUser(deps, { id: ID, displayName: "Joueur dev" });
    expect(r).toEqual({ id: ID, displayName: "Joueur dev", created: true });

    const row = await getUser(ID);
    expect(row.displayName).toBe("Joueur dev");
  });

  it("idempotent : re-seed met à jour le display_name -> created=false", async () => {
    await runSeedUser(deps, { id: ID, displayName: "Joueur dev" });
    const r = await runSeedUser(deps, { id: ID, displayName: "Renommé" });
    expect(r.created).toBe(false);

    const row = await getUser(ID);
    expect(row.displayName).toBe("Renommé");
  });

  it("ne touche pas streak/last_played_on sur ré-exécution", async () => {
    await runSeedUser(deps, { id: ID, displayName: "Joueur dev" });
    // Simule un user déjà actif.
    await ctx.app.db
      .update(users)
      .set({ currentStreak: 3, longestStreak: 5 })
      .where(eq(users.id, ID));

    await runSeedUser(deps, { id: ID, displayName: "Renommé" });

    const row = await getUser(ID);
    expect(row.currentStreak).toBe(3);
    expect(row.longestStreak).toBe(5);
  });

  it("id non-UUID -> erreur", async () => {
    await expect(runSeedUser(deps, { id: "pas-un-uuid", displayName: "X" })).rejects.toThrow(/UUID/);
  });

  it("nom vide -> erreur", async () => {
    await expect(runSeedUser(deps, { id: ID, displayName: "   " })).rejects.toThrow(/nom/i);
  });
});

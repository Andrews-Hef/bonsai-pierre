// Outil seed:user — crée (ou met à jour) une row users de façon reproductible.
// Utile en dev : /v1/daily/submit insère une submission avec FK vers users ; sans
// row correspondante, la soumission échoue. On évite tout SQL ad hoc.
//
// runSeedUser prend ses dépendances (db) en argument -> testable avec
// Testcontainers ; le bloc CLI en bas les assemble depuis l'env.
import { eq } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "../db/client.js";
import { users } from "../db/schema.js";

const uuid = z.string().uuid();

export interface SeedUserDeps {
  db: Db;
}

export interface SeedUserInput {
  id: string; // UUID
  displayName: string;
}

export interface SeedUserResult {
  id: string;
  displayName: string;
  created: boolean; // true = inséré, false = déjà présent (display_name mis à jour)
}

export async function runSeedUser(deps: SeedUserDeps, input: SeedUserInput): Promise<SeedUserResult> {
  const parsed = uuid.safeParse(input.id);
  if (!parsed.success) throw new Error(`id invalide: ${input.id} (UUID attendu)`);
  const id = parsed.data;
  const displayName = input.displayName?.trim();
  if (!displayName) throw new Error("nom d'affichage requis (--name)");

  // Insert idempotent ; si la row existe déjà, on aligne juste le display_name.
  const inserted = await deps.db
    .insert(users)
    .values({ id, displayName })
    .onConflictDoNothing({ target: users.id })
    .returning({ id: users.id });

  if (inserted.length > 0) return { id, displayName, created: true };

  await deps.db.update(users).set({ displayName }).where(eq(users.id, id));
  return { id, displayName, created: false };
}

// ---------- CLI ----------
// Comparaison via pathToFileURL -> correcte aussi sur Windows.
if (process.argv[1] && import.meta.url === (await import("node:url")).pathToFileURL(process.argv[1]).href) {
  const { parseArgs } = await import("node:util");
  const { values } = parseArgs({
    options: {
      id: { type: "string" },
      name: { type: "string" },
    },
  });

  if (!values.id) {
    console.error('usage: seed:user -- --id <uuid> [--name "<Nom>"]');
    process.exit(2);
  }

  const { env } = await import("../config/env.js");
  const { createDb, createPool } = await import("../db/client.js");

  const pool = createPool(env.DATABASE_URL);
  try {
    const r = await runSeedUser(
      { db: createDb(pool) },
      { id: values.id, displayName: values.name ?? "Joueur dev" },
    );
    console.log(`${r.created ? "créé" : "mis à jour"} : user ${r.id} « ${r.displayName} »`);
  } finally {
    await pool.end();
  }
}

// Système de migration UNIQUE : applique les fichiers .sql de migrations/ dans
// l'ordre lexical, chacun dans sa transaction, en suivant ce qui a déjà tourné
// dans une table _migrations. Utilisé au runtime (npm run db:migrate) ET par les
// tests d'intégration (setup du conteneur Postgres éphémère).
import { readFile, readdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const MIGRATIONS_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../../../migrations");

export async function runMigrations(pool: pg.Pool, dir = MIGRATIONS_DIR): Promise<string[]> {
  await pool.query(
    `create table if not exists _migrations (
       name text primary key,
       applied_at timestamptz not null default now()
     )`,
  );

  const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
  const { rows } = await pool.query<{ name: string }>("select name from _migrations");
  const done = new Set(rows.map((r) => r.name));

  const applied: string[] = [];
  for (const file of files) {
    if (done.has(file)) continue;
    const sql = await readFile(join(dir, file), "utf8");
    const client = await pool.connect();
    try {
      await client.query("begin");
      await client.query(sql);
      await client.query("insert into _migrations(name) values ($1)", [file]);
      await client.query("commit");
      applied.push(file);
    } catch (err) {
      await client.query("rollback");
      throw new Error(`migration ${file} échouée: ${(err as Error).message}`, { cause: err });
    } finally {
      client.release();
    }
  }
  return applied;
}

// Exécution directe en CLI : utilise DATABASE_URL.
if (import.meta.url === `file://${process.argv[1]}`) {
  const { env } = await import("../config/env.js");
  const pool = new pg.Pool({ connectionString: env.DATABASE_URL });
  try {
    const applied = await runMigrations(pool);
    console.log(applied.length ? `migrations appliquées: ${applied.join(", ")}` : "aucune migration en attente");
  } finally {
    await pool.end();
  }
}

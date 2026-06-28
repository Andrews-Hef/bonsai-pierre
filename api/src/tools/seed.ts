// Outil d'ingestion seed:puzzle — prépare un puzzle À L'AVANCE (l'API ne génère
// jamais, elle lit). Pipeline : charger source (.vox OU forme générée) ->
// canonicalize (importé de shared) -> makeStartStone -> encodeGrid (importé) ->
// upload storage -> INSERT daily_puzzles (idempotent, --force pour écraser) ->
// PNG d'aperçu (QA lisibilité).
//
// runSeed prend ses dépendances (db, storage) en argument -> testable avec
// Testcontainers ; le bloc CLI en bas les assemble depuis l'env.
import { eq } from "drizzle-orm";
import { canonicalize, encodeGrid, GRID_SIZE, voxelCount } from "../../../shared/voxel.js";
import type { Db } from "../db/client.js";
import { dailyPuzzles } from "../db/schema.js";
import type { StorageClient } from "../storage/types.js";
import { isValidDateStr } from "../util/date.js";
import { renderPreview } from "./preview.js";
import { makeShape } from "./shapes.js";
import { makeStartStone } from "./startStone.js";
import { parseVox } from "./voxParser.js";

const N = GRID_SIZE;

export interface SeedDeps {
  db: Db;
  storage: StorageClient;
}

export interface SeedInput {
  date: string; // YYYY-MM-DD
  name: string; // shape_name affiché (ex. "Coeur")
  shape?: string; // slug forme générée (ex. "heart")
  voxBuffer?: Buffer; // contenu d'un .vox (exclusif avec shape)
  perm?: [number, number, number]; // correction d'axes (.vox Z-up -> [0,2,1])
  seed?: number; // graine des entailles de la pierre brute
  force?: boolean; // écrase la row existante
}

export interface SeedResult {
  puzzleOn: string;
  shapeName: string;
  targetVoxels: number;
  startVoxels: number;
  targetKey: string;
  startKey: string;
  targetB64Len: number;
  startB64Len: number;
  overwritten: boolean;
  preview: Buffer; // PNG des 3 vues de la cible canonique
}

export async function runSeed(deps: SeedDeps, input: SeedInput): Promise<SeedResult> {
  if (!isValidDateStr(input.date)) throw new Error(`date invalide: ${input.date} (attendu YYYY-MM-DD)`);
  if (!input.name) throw new Error("nom de forme requis (--name)");

  // 1) grille source -> cible N³.
  // .vox : source arbitraire (dims/axes quelconques) -> canonicalize (réduction
  //   fidèle, mêmes fonctions que l'API, jamais recodées). Z-up -> perm [0,2,1].
  // forme générée : déjà authorée en 24³ centrée -> utilisée TELLE QUELLE.
  //   (canonicalize la sur-échantillonnerait -> trous ; cf. voxelgen.py qui ne
  //   canonicalise pas les formes générées.)
  let target: Uint8Array;
  if (input.voxBuffer) {
    const { grid, dims } = parseVox(input.voxBuffer);
    target = canonicalize(grid, dims, N, 2, input.perm ?? [0, 2, 1]);
  } else if (input.shape) {
    target = makeShape(input.shape);
  } else {
    throw new Error("fournir soit --input <.vox>, soit --shape <slug>");
  }

  const targetVoxels = voxelCount(target);
  if (targetVoxels === 0) throw new Error("cible vide après canonicalisation (source illisible ?)");

  // 3) pierre brute qui enveloppe la cible (OR target -> atteignable).
  const start = makeStartStone(target, 2, input.seed ?? 0);

  // 4) encodage + upload.
  const targetB64 = encodeGrid(target);
  const startB64 = encodeGrid(start);
  const targetKey = `${input.date}/target.b64`;
  const startKey = `${input.date}/start.b64`;

  // 5) idempotence : refuse une row existante sauf --force.
  const existing = await deps.db
    .select({ on: dailyPuzzles.puzzleOn })
    .from(dailyPuzzles)
    .where(eq(dailyPuzzles.puzzleOn, input.date))
    .limit(1);
  if (existing.length > 0 && !input.force) {
    throw new Error(`un puzzle existe déjà pour ${input.date} — relance avec --force pour écraser`);
  }

  await deps.storage.put(targetKey, Buffer.from(targetB64));
  await deps.storage.put(startKey, Buffer.from(startB64));

  const values = {
    puzzleOn: input.date,
    gridSize: N,
    shapeName: input.name,
    startKey,
    targetKey,
    targetVoxels,
    seed: BigInt(input.seed ?? 0),
  };
  if (existing.length > 0) {
    await deps.db.update(dailyPuzzles).set(values).where(eq(dailyPuzzles.puzzleOn, input.date));
  } else {
    await deps.db.insert(dailyPuzzles).values(values);
  }

  return {
    puzzleOn: input.date,
    shapeName: input.name,
    targetVoxels,
    startVoxels: voxelCount(start),
    targetKey,
    startKey,
    targetB64Len: targetB64.length,
    startB64Len: startB64.length,
    overwritten: existing.length > 0,
    preview: renderPreview(target),
  };
}

// ---------- CLI ----------
if (import.meta.url === `file://${process.argv[1]}`) {
  const { parseArgs } = await import("node:util");
  const { mkdir, readFile, writeFile } = await import("node:fs/promises");
  const { dirname, resolve } = await import("node:path");

  const { values } = parseArgs({
    options: {
      date: { type: "string" },
      name: { type: "string" },
      shape: { type: "string" },
      input: { type: "string" },
      perm: { type: "string" }, // ex. "0,2,1"
      seed: { type: "string" },
      force: { type: "boolean", default: false },
      out: { type: "string" },
    },
  });

  if (!values.date || !values.name) {
    console.error("usage: seed:puzzle -- --date YYYY-MM-DD --name <Nom> (--input <.vox> | --shape <slug>) [--perm 0,2,1] [--seed N] [--force] [--out preview.png]");
    process.exit(2);
  }

  const perm = values.perm
    ? (values.perm.split(",").map((s) => Number.parseInt(s, 10)) as [number, number, number])
    : undefined;
  const voxBuffer = values.input ? await readFile(values.input) : undefined;

  const { env } = await import("../config/env.js");
  const { createDb, createPool } = await import("../db/client.js");
  const { createStorage } = await import("../storage/index.js");

  const pool = createPool(env.DATABASE_URL);
  const storage = createStorage();
  try {
    const result = await runSeed(
      { db: createDb(pool), storage },
      {
        date: values.date,
        name: values.name,
        shape: values.shape,
        voxBuffer,
        perm,
        seed: values.seed ? Number.parseInt(values.seed, 10) : 0,
        force: values.force,
      },
    );

    const outPath = resolve(values.out ?? `./.preview/${result.puzzleOn}-${result.shapeName}.png`);
    await mkdir(dirname(outPath), { recursive: true });
    await writeFile(outPath, result.preview);

    console.log(
      [
        `${result.overwritten ? "écrasé" : "créé"} : puzzle ${result.puzzleOn} « ${result.shapeName} »`,
        `  target_voxels = ${result.targetVoxels}   start_voxels = ${result.startVoxels}`,
        `  encodé : target ${result.targetB64Len} o b64 · start ${result.startB64Len} o b64`,
        `  storage : ${result.targetKey} · ${result.startKey}`,
        `  aperçu  : ${outPath}`,
        result.targetVoxels < 150 || result.targetVoxels > 6000
          ? `  ⚠ target_voxels=${result.targetVoxels} hors plage habituelle (150..6000) — vérifie l'aperçu`
          : "",
      ]
        .filter(Boolean)
        .join("\n"),
    );
  } finally {
    await pool.end();
  }
}

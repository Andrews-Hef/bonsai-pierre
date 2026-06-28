// Tests d'intégration de l'outil seed:puzzle (Postgres + storage fs réels).
// Spec : un .vox (ou forme générée) ingéré devient un puzzle jouable de bout en
// bout -> row insérée + grilles relisibles. Couvre aussi idempotence/--force.
import { PNG } from "pngjs";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { decodeGrid, GRID_SIZE, voxelCount } from "../../shared/voxel.js";
import { runSeed, type SeedDeps } from "../src/tools/seed.js";
import { makeTestApp, resetState, type TestCtx } from "./helpers/app.js";

let ctx: TestCtx;
let deps: SeedDeps;
const LEN = GRID_SIZE ** 3;

beforeAll(async () => {
  ctx = await makeTestApp();
  deps = { db: ctx.app.db, storage: ctx.storage };
});
afterAll(async () => {
  await ctx.close();
});
beforeEach(async () => {
  await resetState(ctx);
});

// Construit un .vox MagicaVoxel minimal (header + MAIN > SIZE + XYZI).
function buildVox(
  dims: { dx: number; dy: number; dz: number },
  voxels: { x: number; y: number; z: number }[],
): Buffer {
  const size = Buffer.alloc(24);
  size.write("SIZE", 0, "ascii");
  size.writeUInt32LE(12, 4);
  size.writeUInt32LE(0, 8);
  size.writeUInt32LE(dims.dx, 12);
  size.writeUInt32LE(dims.dy, 16);
  size.writeUInt32LE(dims.dz, 20);

  const xyziContent = 4 + 4 * voxels.length;
  const xyzi = Buffer.alloc(12 + xyziContent);
  xyzi.write("XYZI", 0, "ascii");
  xyzi.writeUInt32LE(xyziContent, 4);
  xyzi.writeUInt32LE(0, 8);
  xyzi.writeUInt32LE(voxels.length, 12);
  voxels.forEach((v, i) => {
    const p = 16 + i * 4;
    xyzi.writeUInt8(v.x, p);
    xyzi.writeUInt8(v.y, p + 1);
    xyzi.writeUInt8(v.z, p + 2);
    xyzi.writeUInt8(1, p + 3);
  });

  const children = Buffer.concat([size, xyzi]);
  const main = Buffer.alloc(12);
  main.write("MAIN", 0, "ascii");
  main.writeUInt32LE(0, 4);
  main.writeUInt32LE(children.length, 8);

  const header = Buffer.alloc(8);
  header.write("VOX ", 0, "ascii");
  header.writeUInt32LE(150, 4);
  return Buffer.concat([header, main, children]);
}

// Bloc plein 6³ dans une grille 8³ (Z-up).
function blockVox(): Buffer {
  const voxels = [];
  for (let x = 1; x < 7; x++) for (let y = 1; y < 7; y++) for (let z = 1; z < 7; z++) voxels.push({ x, y, z });
  return buildVox({ dx: 8, dy: 8, dz: 8 }, voxels);
}

async function getPuzzle(date: string) {
  const { rows } = await ctx.pool.query(
    "select grid_size, shape_name, start_key, target_key, target_voxels, seed::text as seed from daily_puzzles where puzzle_on=$1",
    [date],
  );
  return rows[0];
}

describe("seed:puzzle — ingestion .vox", () => {
  it("ingère un .vox -> row insérée + grilles relisibles", async () => {
    const res = await runSeed(deps, { date: "2026-07-01", name: "Cube", voxBuffer: blockVox() });

    const row = await getPuzzle("2026-07-01");
    expect(row).toBeTruthy();
    expect(row.grid_size).toBe(24);
    expect(row.shape_name).toBe("Cube");
    expect(row.target_voxels).toBe(res.targetVoxels);

    // Cible relisible depuis le storage, dans le bon espace.
    const target = decodeGrid((await ctx.storage.get(row.target_key)).toString());
    expect(target.length).toBe(LEN);
    expect(voxelCount(target)).toBe(res.targetVoxels);

    // Pierre brute : enveloppe la cible (OR target -> atteignable).
    const start = decodeGrid((await ctx.storage.get(row.start_key)).toString());
    for (let i = 0; i < LEN; i++) if (target[i]) expect(start[i]).toBe(1);
    expect(voxelCount(start)).toBeGreaterThan(voxelCount(target));
  });

  it("perm par défaut applique le Z-up -> Y-up sans planter", async () => {
    const res = await runSeed(deps, { date: "2026-07-03", name: "Cube", voxBuffer: blockVox() });
    expect(res.targetVoxels).toBeGreaterThan(0);
  });
});

describe("seed:puzzle — forme générée", () => {
  it("ingère --shape heart -> cible non vide et relisible", async () => {
    const res = await runSeed(deps, { date: "2026-07-02", name: "Coeur", shape: "heart" });
    const row = await getPuzzle("2026-07-02");
    expect(row.shape_name).toBe("Coeur");
    expect(res.targetVoxels).toBeGreaterThan(0);

    const target = decodeGrid((await ctx.storage.get(row.target_key)).toString());
    expect(voxelCount(target)).toBe(res.targetVoxels);
  });

  it("forme inconnue -> erreur", async () => {
    await expect(runSeed(deps, { date: "2026-07-04", name: "X", shape: "licorne" })).rejects.toThrow(/inconnue/);
  });

  it("ni --input ni --shape -> erreur", async () => {
    await expect(runSeed(deps, { date: "2026-07-05", name: "X" })).rejects.toThrow(/input.*shape/i);
  });
});

describe("seed:puzzle — idempotence", () => {
  it("re-seed même date -> refus sauf --force", async () => {
    await runSeed(deps, { date: "2026-07-06", name: "Cube", voxBuffer: blockVox() });

    await expect(runSeed(deps, { date: "2026-07-06", name: "Cube", voxBuffer: blockVox() })).rejects.toThrow(/force/);

    const res = await runSeed(deps, { date: "2026-07-06", name: "Cube v2", shape: "gem", force: true });
    expect(res.overwritten).toBe(true);

    const row = await getPuzzle("2026-07-06");
    expect(row.shape_name).toBe("Cube v2"); // row écrasée
  });
});

describe("seed:puzzle — aperçu PNG", () => {
  it("produit un PNG valide aux dimensions des 3 vues", async () => {
    const res = await runSeed(deps, { date: "2026-07-07", name: "Coeur", shape: "heart" });
    expect(res.preview.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    const png = PNG.sync.read(res.preview);
    expect(png.width).toBe(24 * 10 * 3 + 12 * 2); // 3 vues + 2 gaps
    expect(png.height).toBe(24 * 10);
  });
});

describe("seed:puzzle — validation", () => {
  it("date invalide -> erreur", async () => {
    await expect(runSeed(deps, { date: "2026-13-40", name: "X", shape: "gem" })).rejects.toThrow(/date/);
  });
});

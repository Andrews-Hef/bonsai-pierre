// Fixtures partagées : insère un puzzle du jour (avec ses grilles encodées dans
// le storage) et des users. Les grilles utilisent le vrai codec shared/voxel.
import { randomUUID } from "node:crypto";
import { encodeGrid, GRID_SIZE, voxelCount } from "../../../shared/voxel.js";
import { dailyPuzzles, users } from "../../src/db/schema.js";
import type { TestCtx } from "./app.js";

const LEN = GRID_SIZE * GRID_SIZE * GRID_SIZE;

// Petit cube plein au centre, sert de cible déterministe.
export function cubeGrid(size = 8): Uint8Array {
  const g = new Uint8Array(LEN);
  const off = (GRID_SIZE - size) >> 1;
  for (let x = 0; x < size; x++)
    for (let y = 0; y < size; y++)
      for (let z = 0; z < size; z++)
        g[(off + x) * GRID_SIZE * GRID_SIZE + (off + y) * GRID_SIZE + (off + z)] = 1;
  return g;
}

export interface PuzzleFixture {
  puzzleOn: string;
  startKey: string;
  targetKey: string;
  startGrid: Uint8Array;
  targetGrid: Uint8Array;
}

// Insère un puzzle pour `puzzleOn` : bloc plein en départ, cube en cible.
export async function seedPuzzle(ctx: TestCtx, puzzleOn: string): Promise<PuzzleFixture> {
  const startGrid = new Uint8Array(LEN).fill(1); // bloc brut à tailler
  const targetGrid = cubeGrid(8);

  const startKey = `${puzzleOn}/start.b64`;
  const targetKey = `${puzzleOn}/target.b64`;
  await ctx.storage.put(startKey, Buffer.from(encodeGrid(startGrid)));
  await ctx.storage.put(targetKey, Buffer.from(encodeGrid(targetGrid)));

  await ctx.app.db.insert(dailyPuzzles).values({
    puzzleOn,
    gridSize: GRID_SIZE,
    shapeName: "cube",
    startKey,
    targetKey,
    targetVoxels: voxelCount(targetGrid),
    seed: null,
  });

  return { puzzleOn, startKey, targetKey, startGrid, targetGrid };
}

// Crée un user et renvoie son id.
export async function seedUser(ctx: TestCtx, displayName = "Tailleur"): Promise<string> {
  const id = randomUUID();
  await ctx.app.db.insert(users).values({ id, displayName });
  return id;
}

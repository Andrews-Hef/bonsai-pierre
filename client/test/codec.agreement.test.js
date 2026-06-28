// Test d'ACCORD du codec — invariant de régression (doit vivre en CI).
//
// Prouve que le codec navigateur (src/voxel/codec.js, Web Streams) et la source
// de vérité serveur (shared/voxel.ts, node:zlib) sont d'accord dans les DEUX
// sens, sur une grille CONNUE issue du vrai pipeline (fixture vérifiée par son
// voxelCount). Tourne en environnement node : les deux côtés y sont disponibles.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

// Source de vérité serveur (gzip via node:zlib).
import {
  encodeGrid,
  decodeGrid,
  voxelCount,
  GRID_SIZE as SHARED_GRID_SIZE,
} from "../../shared/voxel.ts";

// Codec navigateur (gzip via Web Streams, dispo aussi sous Node 22).
import {
  encodeGridBrowser,
  decodeGridBrowser,
  GRID_SIZE,
} from "../src/voxel/codec.js";

const fixture = JSON.parse(
  readFileSync(new URL("./fixtures/codecShapes.json", import.meta.url), "utf8"),
);

const eq = (a, b) => expect(Array.from(a)).toEqual(Array.from(b));

describe("codec voxel navigateur ↔ shared/voxel.ts", () => {
  it("GRID_SIZE concorde avec la source de vérité", () => {
    expect(GRID_SIZE).toBe(SHARED_GRID_SIZE);
    expect(GRID_SIZE).toBe(fixture.gridSize);
  });

  for (const [slug, data] of Object.entries(fixture.shapes)) {
    describe(`forme connue: ${slug} (${data.voxelCount} voxels)`, () => {
      it("decodeGridBrowser décode la grille canonique au voxelCount attendu", async () => {
        const grid = await decodeGridBrowser(data.base64);
        expect(grid.length).toBe(GRID_SIZE ** 3);
        expect(voxelCount(grid)).toBe(data.voxelCount);
      });

      it("sens 1 — encodeGridBrowser → decodeGrid (serveur) : round-trip identique", async () => {
        const grid = await decodeGridBrowser(data.base64);
        const back = decodeGrid(await encodeGridBrowser(grid));
        eq(back, grid);
        expect(voxelCount(back)).toBe(data.voxelCount);
      });

      it("sens 2 — encodeGrid (serveur) → decodeGridBrowser : round-trip identique", async () => {
        const grid = decodeGrid(data.base64);
        const back = await decodeGridBrowser(encodeGrid(grid));
        eq(back, grid);
        expect(voxelCount(back)).toBe(data.voxelCount);
      });
    });
  }

  it("rejette une grille de mauvaise taille à l'encodage", async () => {
    await expect(encodeGridBrowser(new Uint8Array(10))).rejects.toThrow();
  });
});

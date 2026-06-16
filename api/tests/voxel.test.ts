// Tests des fonctions PURES (source de vérité shared/voxel.ts) — pas d'infra.
// Priorités spec : round-trip codec, iou, gameScore.
import { describe, expect, it } from "vitest";
import {
  GRID_SIZE,
  assertSafeEncoded,
  decodeGrid,
  encodeGrid,
  gameScore,
  iou,
  voxelCount,
} from "../../shared/voxel.js";

const N = GRID_SIZE; // 24
const LEN = N * N * N; // 13824

function emptyGrid(): Uint8Array {
  return new Uint8Array(LEN);
}

function randomGrid(seed: number, density = 0.3): Uint8Array {
  // PRNG déterministe (mulberry32) pour des grilles reproductibles.
  let a = seed >>> 0;
  const rng = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const g = emptyGrid();
  for (let i = 0; i < LEN; i++) g[i] = rng() < density ? 1 : 0;
  return g;
}

describe("codec encode/decode", () => {
  it("round-trip exact sur une grille aléatoire", () => {
    const g = randomGrid(42);
    const back = decodeGrid(encodeGrid(g));
    expect(back.length).toBe(LEN);
    expect(Array.from(back)).toEqual(Array.from(g));
  });

  it("round-trip exact sur grille vide et grille pleine", () => {
    const empty = emptyGrid();
    const full = emptyGrid().fill(1);
    expect(Array.from(decodeGrid(encodeGrid(empty)))).toEqual(Array.from(empty));
    expect(Array.from(decodeGrid(encodeGrid(full)))).toEqual(Array.from(full));
  });

  it("encodeGrid rejette une longueur incorrecte", () => {
    expect(() => encodeGrid(new Uint8Array(LEN - 1))).toThrow();
  });

  it("assertSafeEncoded rejette un payload trop volumineux", () => {
    expect(() => assertSafeEncoded("a".repeat(8193))).toThrow();
    expect(() => assertSafeEncoded("a".repeat(10))).not.toThrow();
  });
});

describe("iou", () => {
  it("grilles identiques -> 1", () => {
    const g = randomGrid(7);
    expect(iou(g, g)).toBe(1);
  });

  it("grilles disjointes -> 0", () => {
    const a = emptyGrid();
    const b = emptyGrid();
    a[0] = 1;
    a[1] = 1;
    b[2] = 1;
    b[3] = 1;
    expect(iou(a, b)).toBe(0);
  });

  it("recouvrement partiel connu = inter/union", () => {
    const a = emptyGrid();
    const b = emptyGrid();
    // a = {0,1,2}, b = {1,2,3} -> inter=2, union=4 -> 0.5
    a[0] = a[1] = a[2] = 1;
    b[1] = b[2] = b[3] = 1;
    expect(iou(a, b)).toBe(0.5);
  });

  it("deux grilles vides -> 1 (union nulle)", () => {
    expect(iou(emptyGrid(), emptyGrid())).toBe(1);
  });
});

describe("gameScore", () => {
  it("sous le seuil 0.8 : base seule, pas de bonus", () => {
    expect(gameScore(0.5, 0)).toBe(500);
    expect(gameScore(0.5, 999_999)).toBe(500);
    expect(gameScore(0.799, 0)).toBe(Math.round(0.799 * 1000));
  });

  it("seuil atteint, vitesse maximale : base + 200", () => {
    expect(gameScore(0.8, 0)).toBe(800 + 200);
    expect(gameScore(1, 0)).toBe(1000 + 200);
  });

  it("bonus décroît linéairement jusqu'à parMs (180000)", () => {
    expect(gameScore(0.9, 90_000)).toBe(900 + 100); // 200*(1-0.5)=100
    expect(gameScore(1, 180_000)).toBe(1000); // bonus 0 au par
  });

  it("au-delà de parMs : bonus borné à 0", () => {
    expect(gameScore(0.8, 360_000)).toBe(800);
  });
});

describe("voxelCount", () => {
  it("compte les voxels actifs", () => {
    const g = emptyGrid();
    g[0] = g[5] = g[100] = 1;
    expect(voxelCount(g)).toBe(3);
  });
});

// shared/voxel.ts
// Source de vérité du format voxel + du scoring.
// L'API ET l'outil de seed DOIVENT importer ces fonctions — ne pas réimplémenter.
//
// Convention : grille = Uint8Array de n^3 booléens (0/1),
//              index = x*n*n + y*n + z   (Y = vertical / "haut").
// Sérialisation : bits big-endian (compatible numpy.packbits) -> gzip -> base64.
// => Les grilles produites côté Python (numpy) sont décodables ici, et inversement.

import { gzipSync, gunzipSync } from "node:zlib";

export const GRID_SIZE = 24;

export function gridIndex(x: number, y: number, z: number, n = GRID_SIZE): number {
  return x * n * n + y * n + z;
}

// ---------- codec ----------
export function encodeGrid(grid: Uint8Array, n = GRID_SIZE): string {
  const len = n * n * n;
  if (grid.length !== len) throw new Error(`grid length ${grid.length} != ${len}`);
  const packed = new Uint8Array((len + 7) >> 3);
  for (let i = 0; i < len; i++) {
    if (grid[i]!) packed[i >> 3]! |= 1 << (7 - (i & 7)); // bit 7 = premier voxel
  }
  return gzipSync(Buffer.from(packed)).toString("base64");
}

export function decodeGrid(b64: string, n = GRID_SIZE): Uint8Array {
  const len = n * n * n;
  const packed = gunzipSync(Buffer.from(b64, "base64"));
  if (packed.length < (len + 7) >> 3) throw new Error("grille tronquée");
  const grid = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    grid[i] = (packed[i >> 3]! >> (7 - (i & 7))) & 1;
  }
  return grid;
}

// Garde-fou : à utiliser AVANT decodeGrid sur une entrée joueur (anti zip-bomb).
export function assertSafeEncoded(b64: string, maxBase64 = 8192): void {
  if (b64.length > maxBase64) throw new Error("payload trop volumineux");
}

// ---------- métriques (les deux grilles doivent être dans le MÊME espace) ----------
export function iou(a: Uint8Array, b: Uint8Array): number {
  let inter = 0, union = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i]! & b[i]!) inter++;
    if (a[i]! | b[i]!) union++;
  }
  return union ? inter / union : 1;
}

export function dice(a: Uint8Array, b: Uint8Array): number {
  let inter = 0, sa = 0, sb = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] && b[i]) inter++;
    if (a[i]) sa++;
    if (b[i]) sb++;
  }
  return sa + sb ? (2 * inter) / (sa + sb) : 1;
}

export function precisionRecall(sub: Uint8Array, target: Uint8Array): { precision: number; recall: number } {
  let tp = 0, ssub = 0, star = 0;
  for (let i = 0; i < sub.length; i++) {
    if (sub[i] && target[i]) tp++;
    if (sub[i]) ssub++;
    if (target[i]) star++;
  }
  return { precision: ssub ? tp / ssub : 1, recall: star ? tp / star : 1 };
}

export function voxelCount(grid: Uint8Array): number {
  let n = 0;
  for (let i = 0; i < grid.length; i++) if (grid[i]) n++;
  return n;
}

// ---------- score du jeu : qualité d'abord, bonus vitesse au-dessus de 80 % ----------
export function gameScore(resemblance: number, durationMs: number, parMs = 180_000): number {
  const base = Math.round(resemblance * 1000);
  const bonus = resemblance >= 0.8 ? Math.round(200 * Math.max(0, 1 - durationMs / parMs)) : 0;
  return base + bonus;
}

// ---------- ingestion : normaliser une grille de source quelconque ----------
export interface Dims { dx: number; dy: number; dz: number; }

// `perm` permute les axes (corrige une convention, ex. Blender Z-up -> Y-up : [0, 2, 1]).
export function canonicalize(
  grid: Uint8Array, dims: Dims, n = GRID_SIZE, margin = 2, perm?: [number, number, number],
): Uint8Array {
  let { dx, dy, dz } = dims;
  let src = grid;
  if (perm) {
    const nd: [number, number, number] = [[dx, dy, dz][perm[0]]!, [dx, dy, dz][perm[1]]!, [dx, dy, dz][perm[2]]!];
    const out = new Uint8Array(grid.length);
    for (let x = 0; x < dx; x++) for (let y = 0; y < dy; y++) for (let z = 0; z < dz; z++) {
      if (!grid[x * dy * dz + y * dz + z]) continue;
      const c = [x, y, z];
      const o = [c[perm[0]], c[perm[1]], c[perm[2]]];
      out[o[0]! * nd[1] * nd[2] + o[1]! * nd[2] + o[2]!] = 1;
    }
    src = out; [dx, dy, dz] = nd;
  }

  const at = (x: number, y: number, z: number) => src[x * dy * dz + y * dz + z];

  // bbox de la matière
  let minX = dx, minY = dy, minZ = dz, maxX = -1, maxY = -1, maxZ = -1;
  for (let x = 0; x < dx; x++) for (let y = 0; y < dy; y++) for (let z = 0; z < dz; z++) {
    if (!at(x, y, z)) continue;
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
    if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
  }
  const out = new Uint8Array(n * n * n);
  if (maxX < 0) return out; // vide

  const sx = maxX - minX + 1, sy = maxY - minY + 1, sz = maxZ - minZ + 1;
  const extent = n - 2 * margin;
  const scale = extent / Math.max(sx, sy, sz);          // tient dans la boîte, ratio préservé
  const ox = Math.max(1, Math.round(sx * scale));
  const oy = Math.max(1, Math.round(sy * scale));
  const oz = Math.max(1, Math.round(sz * scale));

  // redimensionnement par dispersion (fidèle en réduction = sens normal de l'ingestion)
  const resized = new Uint8Array(ox * oy * oz);
  for (let x = minX; x <= maxX; x++) for (let y = minY; y <= maxY; y++) for (let z = minZ; z <= maxZ; z++) {
    if (!at(x, y, z)) continue;
    const rx = Math.min(ox - 1, Math.floor(((x - minX) * ox) / sx));
    const ry = Math.min(oy - 1, Math.floor(((y - minY) * oy) / sy));
    const rz = Math.min(oz - 1, Math.floor(((z - minZ) * oz) / sz));
    resized[rx * oy * oz + ry * oz + rz] = 1;
  }

  // recentrage dans n^3
  const offX = (n - ox) >> 1, offY = (n - oy) >> 1, offZ = (n - oz) >> 1;
  for (let x = 0; x < ox; x++) for (let y = 0; y < oy; y++) for (let z = 0; z < oz; z++) {
    if (resized[x * oy * oz + y * oz + z]) out[(offX + x) * n * n + (offY + y) * n + (offZ + z)] = 1;
  }
  return out;
}
// Pierre brute de départ — port de make_start_stone (voxelgen.py).
// Ellipsoïde du bbox de la cible + marge, quelques entailles aléatoires seedées,
// puis OR target pour GARANTIR que la cible reste atteignable.
//
// Note : numpy default_rng (PCG64) n'est pas reproductible à l'identique en JS ;
// on utilise un PRNG déterministe (mulberry32). Le motif d'entailles diffère donc
// de Python, mais c'est cosmétique — la réachabilité tient grâce au OR target.
import { GRID_SIZE } from "../../../shared/voxel.js";

const N = GRID_SIZE;

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeStartStone(target: Uint8Array, margin = 2, seed = 0): Uint8Array {
  const rng = mulberry32(seed >>> 0);

  // Moyenne + bbox de la matière cible.
  let sx = 0, sy = 0, sz = 0, cnt = 0;
  let minX = N, minY = N, minZ = N, maxX = -1, maxY = -1, maxZ = -1;
  for (let x = 0; x < N; x++)
    for (let y = 0; y < N; y++)
      for (let z = 0; z < N; z++) {
        if (!target[x * N * N + y * N + z]) continue;
        sx += x; sy += y; sz += z; cnt++;
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
        if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
      }
  if (cnt === 0) return new Uint8Array(N * N * N); // cible vide -> pierre vide

  const cx = sx / cnt, cy = sy / cnt, cz = sz / cnt;
  const rx = (maxX - minX) / 2 + margin;
  const ry = (maxY - minY) / 2 + margin;
  const rz = (maxZ - minZ) / 2 + margin;

  // base = ellipsoïde englobant ; on collecte ses voxels (surf) pour les entailles.
  const base = new Uint8Array(N * N * N);
  const surf: number[] = [];
  for (let x = 0; x < N; x++)
    for (let y = 0; y < N; y++)
      for (let z = 0; z < N; z++) {
        if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 + ((z - cz) / rz) ** 2 <= 1.0) {
          const i = x * N * N + y * N + z;
          base[i] = 1;
          surf.push(i);
        }
      }

  // 10 entailles sphériques aléatoires centrées sur des voxels de la base.
  const dents = new Uint8Array(N * N * N);
  for (let k = 0; k < 10; k++) {
    const idx = surf[Math.floor(rng() * surf.length)]!;
    const px = Math.floor(idx / (N * N));
    const py = Math.floor((idx % (N * N)) / N);
    const pz = idx % N;
    const r = 1.5 + rng() * 1.0; // uniform(1.5, 2.5)
    const r2 = r * r;
    const lo = (v: number) => Math.max(0, Math.ceil(v - r));
    const hi = (v: number) => Math.min(N - 1, Math.floor(v + r));
    for (let x = lo(px); x <= hi(px); x++)
      for (let y = lo(py); y <= hi(py); y++)
        for (let z = lo(pz); z <= hi(pz); z++) {
          if ((x - px) ** 2 + (y - py) ** 2 + (z - pz) ** 2 <= r2) dents[x * N * N + y * N + z] = 1;
        }
  }

  // (base & ~dents) | target  -> la cible reste atteignable.
  const out = new Uint8Array(N * N * N);
  for (let i = 0; i < out.length; i++) {
    out[i] = (base[i]! && !dents[i]!) || target[i]! ? 1 : 0;
  }
  return out;
}

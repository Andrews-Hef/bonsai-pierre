// Opérations sur la grille de voxels (source de vérité du jeu).
//
// La grille est l'unique Uint8Array de n³ booléens manipulé pendant la partie.
// gridIndex doit rester identique à celui du codec et de shared/voxel.ts.
import { GRID_SIZE, gridIndex } from './codec.js';

export { GRID_SIZE, gridIndex };

// Liste les voxels pleins sous forme {x, y, z, i}. Sert à régénérer la
// projection InstancedMesh à chaque coup (jamais stockée comme état).
export function filledVoxels(grid, n = GRID_SIZE) {
  const out = [];
  for (let x = 0; x < n; x++) {
    for (let y = 0; y < n; y++) {
      for (let z = 0; z < n; z++) {
        const i = gridIndex(x, y, z, n);
        if (grid[i]) out.push({ x, y, z, i });
      }
    }
  }
  return out;
}

// Taille subtractive : retire (met à 0) les voxels pleins dont le centre est à
// distance <= radius du centre (cx,cy,cz). radius 0 -> un seul voxel. MUTE grid.
// Retourne le nombre de voxels effectivement retirés.
export function carveSphere(grid, cx, cy, cz, radius, n = GRID_SIZE) {
  const r = Math.max(0, radius);
  const lo = Math.max(0, Math.floor(cx - r));
  let removed = 0;
  for (let x = lo; x <= Math.min(n - 1, Math.ceil(cx + r)); x++) {
    for (let y = Math.max(0, Math.floor(cy - r)); y <= Math.min(n - 1, Math.ceil(cy + r)); y++) {
      for (let z = Math.max(0, Math.floor(cz - r)); z <= Math.min(n - 1, Math.ceil(cz + r)); z++) {
        const dx = x - cx;
        const dy = y - cy;
        const dz = z - cz;
        if (dx * dx + dy * dy + dz * dz <= r * r + 1e-6) {
          const i = gridIndex(x, y, z, n);
          if (grid[i]) {
            grid[i] = 0;
            removed++;
          }
        }
      }
    }
  }
  return removed;
}

// Estimation LOCALE de la ressemblance (IoU) pour guider le joueur. N'est JAMAIS
// envoyée au serveur : le score officiel est recalculé serveur sur la cible.
export function estimateIoU(grid, target) {
  let inter = 0;
  let union = 0;
  for (let i = 0; i < grid.length; i++) {
    const a = grid[i] ? 1 : 0;
    const b = target[i] ? 1 : 0;
    if (a & b) inter++;
    if (a | b) union++;
  }
  return union === 0 ? 1 : inter / union;
}

export function cloneGrid(grid) {
  return grid.slice();
}

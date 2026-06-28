import { describe, expect, it } from 'vitest';
import { carveSphere, estimateIoU, filledVoxels, gridIndex } from '../src/voxel/grid.js';

const N = 24;
const full = () => new Uint8Array(N * N * N).fill(1);
const empty = () => new Uint8Array(N * N * N);

describe('carveSphere', () => {
  it('retire un seul voxel au rayon 0', () => {
    const g = full();
    const removed = carveSphere(g, 5, 5, 5, 0);
    expect(removed).toBe(1);
    expect(g[gridIndex(5, 5, 5, N)]).toBe(0);
    expect(g[gridIndex(6, 5, 5, N)]).toBe(1); // voisin intact
  });

  it('retire une boule de voxels au rayon 1 (centre + 6 faces)', () => {
    const g = full();
    const removed = carveSphere(g, 5, 5, 5, 1);
    expect(removed).toBe(7); // centre + 6 voisins à distance 1
  });

  it('ne compte pas les voxels déjà vides', () => {
    const g = empty();
    expect(carveSphere(g, 5, 5, 5, 2)).toBe(0);
  });

  it('borne sur les arêtes de la grille sans déborder', () => {
    const g = full();
    expect(() => carveSphere(g, 0, 0, 0, 3)).not.toThrow();
    expect(g[gridIndex(0, 0, 0, N)]).toBe(0);
  });
});

describe('estimateIoU', () => {
  it('vaut 1 pour deux grilles identiques', () => {
    expect(estimateIoU(full(), full())).toBe(1);
  });

  it('vaut 0 pour des grilles disjointes', () => {
    const a = empty();
    const b = empty();
    a[gridIndex(1, 1, 1, N)] = 1;
    b[gridIndex(2, 2, 2, N)] = 1;
    expect(estimateIoU(a, b)).toBe(0);
  });

  it('mesure un recouvrement partiel (intersection/union)', () => {
    const a = empty();
    const b = empty();
    a[gridIndex(0, 0, 0, N)] = 1;
    a[gridIndex(0, 0, 1, N)] = 1;
    b[gridIndex(0, 0, 1, N)] = 1; // 1 commun, union 2
    expect(estimateIoU(a, b)).toBeCloseTo(0.5, 6);
  });
});

describe('filledVoxels', () => {
  it('liste exactement les voxels pleins', () => {
    const g = empty();
    g[gridIndex(3, 4, 5, N)] = 1;
    const vs = filledVoxels(g);
    expect(vs).toEqual([{ x: 3, y: 4, z: 5, i: gridIndex(3, 4, 5, N) }]);
  });
});

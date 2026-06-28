// Générateurs de formes-cibles — port fidèle des primitives de voxelgen.py.
// Convention : index = x*N*N + y*N + z (Y vertical). Une primitive est un
// prédicat (x,y,z)->bool ; les objets composent ces prédicats (OR/AND/NOT).
// La sélection se fait par slug anglais (--shape bird|fish|mug|heart|...).
import { GRID_SIZE } from "../../../shared/voxel.js";

const N = GRID_SIZE;
const c = (N - 1) / 2; // centre (11.5 pour N=24)

type Pred = (x: number, y: number, z: number) => boolean;

// ---------- primitives ----------
const ellipsoid =
  (cx: number, cy: number, cz: number, rx: number, ry: number, rz: number): Pred =>
  (x, y, z) =>
    ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 + ((z - cz) / rz) ** 2 <= 1.0;

const sphere = (cx: number, cy: number, cz: number, r: number): Pred => ellipsoid(cx, cy, cz, r, r, r);

const box =
  (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number): Pred =>
  (x, y, z) =>
    x >= x0 && x <= x1 && y >= y0 && y <= y1 && z >= z0 && z <= z1;

const cylY =
  (cx: number, cz: number, y0: number, y1: number, r: number): Pred =>
  (x, y, z) =>
    (x - cx) ** 2 + (z - cz) ** 2 <= r * r && y >= y0 && y <= y1;

const coneY =
  (cx: number, cz: number, yApex: number, yBase: number, rBase: number): Pred =>
  (x, y, z) => {
    const t = (y - yApex) / (yBase - yApex);
    return t >= 0 && t <= 1 && (x - cx) ** 2 + (z - cz) ** 2 <= (rBase * t) ** 2;
  };

const octa =
  (cx: number, cy: number, cz: number, ax: number, ay: number, az: number): Pred =>
  (x, y, z) =>
    Math.abs(x - cx) / ax + Math.abs(y - cy) / ay + Math.abs(z - cz) / az <= 1.0;

const torusZ =
  (cx: number, cy: number, cz: number, R: number, r: number): Pred =>
  (x, y, z) => {
    const q = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2) - R;
    return q * q + (z - cz) ** 2 <= r * r;
  };

// ---------- combinateurs ----------
const or =
  (...ps: Pred[]): Pred =>
  (x, y, z) =>
    ps.some((p) => p(x, y, z));
const and =
  (...ps: Pred[]): Pred =>
  (x, y, z) =>
    ps.every((p) => p(x, y, z));
const not =
  (p: Pred): Pred =>
  (x, y, z) =>
    !p(x, y, z);

// ---------- objets (mêmes paramètres que voxelgen.py) ----------
const bird: Pred = or(
  ellipsoid(c, c - 1, c, 5, 5.5, 6),
  sphere(c, c + 5.5, c + 3, 3.6),
  box(c - 1, c + 1, c + 4.5, c + 6.5, c + 6, c + 9),
  ellipsoid(c, c + 3, c - 7, 2.2, 1.5, 3.4),
);

const fish: Pred = (() => {
  const body = ellipsoid(c, c, c, 8, 4.8, 3);
  const tx0 = c - 12;
  const tx1 = c - 6;
  const tail: Pred = (x, y, z) => {
    const t = (x - tx1) / (tx0 - tx1);
    return x >= tx0 && x <= tx1 && t >= 0 && t <= 1 && Math.abs(y - c) <= 1 + 5.5 * t && Math.abs(z - c) <= 1;
  };
  const finT = box(c - 2, c + 2, c + 4, c + 7, c - 1, c + 1);
  return or(body, tail, finT);
})();

const mug: Pred = or(and(cylY(c, c, c - 7, c + 7, 6), not(cylY(c, c, c - 3, c + 9, 4))), torusZ(c + 6, c, c, 3, 1.5));

const heart: Pred = or(sphere(c - 3, c + 3, c, 4.2), sphere(c + 3, c + 3, c, 4.2), coneY(c, c, c - 9, c + 4, 7.5));

const mushroom: Pred = or(cylY(c, c, c - 8, c + 1, 2.6), and(sphere(c, c + 1, c, 6.2), (_x, y) => y >= c + 0.5));

const tree: Pred = or(
  cylY(c, c, c - 9, c - 1, 1.9),
  sphere(c, c + 2.5, c, 6.2),
  sphere(c - 3, c, c - 1, 4),
  sphere(c + 3, c + 0.5, c + 1, 4.2),
);

const gem: Pred = octa(c, c, c, 6, 8.5, 6);

const SHAPES: Record<string, Pred> = { bird, fish, mug, heart, mushroom, tree, gem };

export const SHAPE_SLUGS = Object.keys(SHAPES);

// Matérialise un prédicat en grille N³ (Uint8Array).
function materialize(pred: Pred): Uint8Array {
  const g = new Uint8Array(N * N * N);
  for (let x = 0; x < N; x++)
    for (let y = 0; y < N; y++)
      for (let z = 0; z < N; z++) if (pred(x, y, z)) g[x * N * N + y * N + z] = 1;
  return g;
}

// Renvoie la grille d'une forme générée, ou throw si le slug est inconnu.
export function makeShape(slug: string): Uint8Array {
  const pred = SHAPES[slug];
  if (!pred) throw new Error(`forme inconnue: ${slug} (connues: ${SHAPE_SLUGS.join(", ")})`);
  return materialize(pred);
}

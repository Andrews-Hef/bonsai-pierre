// Aperçu PNG d'une cible canonique (QA lisibilité). L'aperçu EST le contrôle
// qualité : une forme valide peut être injouable (illisible). On rend les 3 vues
// orthographiques face/côté/dessus en max-projection — les angles que le joueur
// verra (caméras axiales fixes), plus utiles qu'un seul iso.
//
// Échelle réelle : 1 voxel = CELL px, blocs pleins (pas de lissage).
import { PNG } from "pngjs";
import { GRID_SIZE } from "../../../shared/voxel.js";

const N = GRID_SIZE;
const CELL = 10; // px par voxel
const GAP = 12; // px entre les vues
const BG: [number, number, number] = [0xf1, 0xe7, 0xd9];
const FG: [number, number, number] = [0x7d, 0x70, 0x64];

type Occ = boolean[][]; // [col][row], row 0 = haut de l'image

// Projections max le long de chaque axe. Y vertical -> row = N-1-y (Y vers le haut).
function project(grid: Uint8Array): { front: Occ; side: Occ; top: Occ } {
  const mk = (): Occ => Array.from({ length: N }, () => new Array<boolean>(N).fill(false));
  const front = mk(); // colonne x, ligne y  (vue de face, le long de -Z)
  const side = mk(); // colonne z, ligne y  (vue de côté, le long de -X)
  const top = mk(); // colonne x, ligne z  (vue de dessus, le long de -Y)
  for (let x = 0; x < N; x++)
    for (let y = 0; y < N; y++)
      for (let z = 0; z < N; z++) {
        if (!grid[x * N * N + y * N + z]) continue;
        front[x]![N - 1 - y] = true;
        side[z]![N - 1 - y] = true;
        top[x]![N - 1 - z] = true;
      }
  return { front, side, top };
}

function paintView(png: PNG, occ: Occ, offsetX: number): void {
  for (let col = 0; col < N; col++)
    for (let row = 0; row < N; row++) {
      if (!occ[col]![row]) continue;
      for (let dx = 0; dx < CELL; dx++)
        for (let dy = 0; dy < CELL; dy++) {
          const px = offsetX + col * CELL + dx;
          const py = row * CELL + dy;
          const i = (py * png.width + px) * 4;
          png.data[i] = FG[0];
          png.data[i + 1] = FG[1];
          png.data[i + 2] = FG[2];
          png.data[i + 3] = 255;
        }
    }
}

// Rend les 3 vues côte à côte en un seul PNG (Buffer).
export function renderPreview(grid: Uint8Array): Buffer {
  const viewW = N * CELL;
  const width = viewW * 3 + GAP * 2;
  const height = viewW;
  const png = new PNG({ width, height });
  for (let i = 0; i < width * height; i++) {
    png.data[i * 4] = BG[0];
    png.data[i * 4 + 1] = BG[1];
    png.data[i * 4 + 2] = BG[2];
    png.data[i * 4 + 3] = 255;
  }
  const { front, side, top } = project(grid);
  paintView(png, front, 0);
  paintView(png, side, viewW + GAP);
  paintView(png, top, (viewW + GAP) * 2);
  return PNG.sync.write(png);
}

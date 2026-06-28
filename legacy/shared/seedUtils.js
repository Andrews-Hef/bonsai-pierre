// Pure functions: seed -> initial stone mask + rock texture. No DOM, no React.

export const MASK_SIZE = 400;

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function dateStringToSeed(dateString) {
  return parseInt(dateString.replace(/-/g, ''), 10);
}

// Hash-based value noise. Stable for a given (x,y,scale) — used so we don't
// need to allocate a noise grid for every octave.
function hashCell(gx, gy, salt) {
  let h = (gx * 374761393) ^ (gy * 668265263) ^ (salt * 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function octaveNoise(x, y, scale, salt) {
  const fx = x / scale;
  const fy = y / scale;
  const gx = Math.floor(fx);
  const gy = Math.floor(fy);
  const tx = fx - gx;
  const ty = fy - gy;
  // Bilinear blend of four cell hashes → smooth noise.
  const a = hashCell(gx, gy, salt);
  const b = hashCell(gx + 1, gy, salt);
  const c = hashCell(gx, gy + 1, salt);
  const d = hashCell(gx + 1, gy + 1, salt);
  const sx = tx * tx * (3 - 2 * tx);
  const sy = ty * ty * (3 - 2 * ty);
  const ab = a + (b - a) * sx;
  const cd = c + (d - c) * sx;
  return ab + (cd - ab) * sy;
}

// Generates three textures per pixel:
//   lum    : luminance delta (signed) — multi-octave noise + cracks + specks
//   tint   : warm/cool color tilt (signed, -100..+100)
//   height : smooth heightfield used for bump shading at render time
// Macro octaves are domain-warped so patches feel irregular rather than
// like overlapping diagonal sine waves.
export function generateStoneTexture(seed, size = MASK_SIZE) {
  const rand = mulberry32((seed ^ 0xA5A5A5A5) >>> 0);
  const s = [];
  for (let i = 0; i < 10; i++) s.push(Math.floor(rand() * 0xffff));

  const lum = new Int16Array(size * size);
  const tint = new Int8Array(size * size);
  const height = new Int16Array(size * size);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = y * size + x;
      // Domain warp: low-freq displacement applied to macro features only.
      const wx = (octaveNoise(x, y, 60, s[8]) - 0.5) * 32;
      const wy = (octaveNoise(x, y, 60, s[9]) - 0.5) * 32;

      // Luminance: warped macro/patch + raw grain/fine.
      const macro = octaveNoise(x + wx, y + wy, 130, s[0]) - 0.5;
      const patch = octaveNoise(x + wx, y + wy, 42,  s[1]) - 0.5;
      const grain = octaveNoise(x, y, 12, s[2]) - 0.5;
      const fine  = octaveNoise(x, y, 4,  s[3]) - 0.5;
      lum[idx] = macro * 56 + patch * 32 + grain * 20 + fine * 12;

      // Hue tilt: independent low-frequency channel.
      const tA = octaveNoise(x + wx * 0.6, y + wy * 0.6, 90, s[4]) - 0.5;
      const tB = octaveNoise(x, y, 28, s[5]) - 0.5;
      tint[idx] = Math.max(-100, Math.min(100, tA * 140 + tB * 50));

      // Height: smooth enough that bump shading gives clean ridges/valleys.
      const h1 = octaveNoise(x + wx, y + wy, 62, s[6]) - 0.5;
      const h2 = octaveNoise(x, y, 22, s[7]) - 0.5;
      const h3 = octaveNoise(x, y, 11, (s[2] ^ s[7]) >>> 0) - 0.5;
      height[idx] = h1 * 60 + h2 * 32 + h3 * 14;
    }
  }

  // Cracks: wiggly dark lines drifting across the stone (luminance only).
  const numCracks = 4 + Math.floor(rand() * 4);
  for (let i = 0; i < numCracks; i++) {
    const cx = size * (0.2 + rand() * 0.6);
    const cy = size * (0.2 + rand() * 0.6);
    const baseAngle = rand() * Math.PI * 2;
    const len = 80 + rand() * 160;
    let x = cx;
    let y = cy;
    let angle = baseAngle;
    const steps = Math.ceil(len);
    for (let s = 0; s < steps; s++) {
      angle += (rand() - 0.5) * 0.18;
      x += Math.cos(angle);
      y += Math.sin(angle);
      const xi = Math.round(x);
      const yi = Math.round(y);
      if (xi < 1 || xi >= size - 1 || yi < 1 || yi >= size - 1) break;
      addClampedLum(lum, yi * size + xi, -55);
      addClampedLum(lum, yi * size + xi - 1, -18);
      addClampedLum(lum, yi * size + xi + 1, -18);
      addClampedLum(lum, (yi - 1) * size + xi, -18);
      addClampedLum(lum, (yi + 1) * size + xi, -18);
    }
  }

  // Mineral specks.
  const numSpecks = 300 + Math.floor(rand() * 250);
  for (let i = 0; i < numSpecks; i++) {
    const sx = Math.floor(rand() * size);
    const sy = Math.floor(rand() * size);
    const dark = -30 - Math.floor(rand() * 30);
    addClampedLum(lum, sy * size + sx, dark);
    if (rand() < 0.4 && sx + 1 < size) addClampedLum(lum, sy * size + sx + 1, dark / 2);
    if (rand() < 0.4 && sy + 1 < size) addClampedLum(lum, (sy + 1) * size + sx, dark / 2);
  }

  return { lum, tint, height };
}

function addClampedLum(arr, i, v) {
  const n = arr[i] + v;
  arr[i] = n < -120 ? -120 : n > 80 ? 80 : n;
}

// Bumpy boulder mask + rock texture for the day.
export function generateStone(seed, size = MASK_SIZE) {
  const rand = mulberry32(seed);
  const phases = [];
  for (let i = 0; i < 6; i++) phases.push(rand() * Math.PI * 2);

  const cx = size / 2 + (rand() - 0.5) * 12;
  const cy = size / 2 + (rand() - 0.5) * 12;
  const baseR = size * 0.36;

  function radiusAt(theta) {
    let r = baseR;
    r += baseR * 0.12 * Math.sin(theta * 2 + phases[0]);
    r += baseR * 0.07 * Math.sin(theta * 3 + phases[1]);
    r += baseR * 0.05 * Math.sin(theta * 5 + phases[2]);
    r += baseR * 0.03 * Math.sin(theta * 8 + phases[3]);
    return r;
  }

  const mask = new Uint8Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const theta = Math.atan2(dy, dx);
      if (dist <= radiusAt(theta)) {
        mask[y * size + x] = 1;
      }
    }
  }

  const { lum, tint, height } = generateStoneTexture(seed, size);
  return { mask, texture: lum, colorTilt: tint, height };
}

// Carves a disc out of the mask. Returns true if anything changed.
export function carveDisc(mask, cx, cy, radius, size = MASK_SIZE) {
  const r2 = radius * radius;
  const minX = Math.max(0, Math.floor(cx - radius));
  const maxX = Math.min(size - 1, Math.ceil(cx + radius));
  const minY = Math.max(0, Math.floor(cy - radius));
  const maxY = Math.min(size - 1, Math.ceil(cy + radius));
  let changed = false;
  for (let y = minY; y <= maxY; y++) {
    const row = y * size;
    for (let x = minX; x <= maxX; x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= r2) {
        const i = row + x;
        if (mask[i]) {
          mask[i] = 0;
          changed = true;
        }
      }
    }
  }
  return changed;
}

export const TOOLS = [
  { id: 'small',  label: 'Petit ciseau', radius: 5 },
  { id: 'medium', label: 'Burin',        radius: 13 },
  { id: 'large',  label: 'Massette',     radius: 28 },
];

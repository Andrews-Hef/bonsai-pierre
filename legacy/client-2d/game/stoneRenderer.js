// Imperative canvas drawing for the stone gameplay view.
// One ImageData pass:
//   base lighting (top-down)
//   + multi-octave luminance noise
//   + bump shading from a smooth heightfield (3D feel)
//   + ambient occlusion using the same heightfield
//   + edge darkening
//   + warm/cool tint per pixel

const STONE_BASE = 138;
const STONE_LIGHT = 50;
const STONE_WARM_BASE = 6;
const TILT_AMP = 11;
const BUMP_AMP = 1.1;      // strength of directional bump shading
const AO_AMP = 0.36;       // depressions darkened slightly

export function renderStone(ctx, mask, texture, colorTilt, height, size) {
  const img = ctx.createImageData(size, size);
  const px = img.data;

  for (let y = 0; y < size; y++) {
    const lighting = STONE_LIGHT * (1 - y / size);
    const rowBase = STONE_BASE + lighting;
    const row = y * size;
    const yInside = y > 0 && y < size - 1;

    for (let x = 0; x < size; x++) {
      const idx = row + x;
      if (!mask[idx]) continue;

      const edge =
        (x === 0 || !mask[idx - 1]) ||
        (x === size - 1 || !mask[idx + 1]) ||
        (y === 0 || !mask[idx - size]) ||
        (y === size - 1 || !mask[idx + size]);

      let v = rowBase + (texture ? texture[idx] : 0);

      // Bump shading: light from upper-left, derive normal from height gradient.
      if (height && yInside && x > 0 && x < size - 1) {
        const dhx = height[idx + 1]    - height[idx - 1];
        const dhy = height[idx + size] - height[idx - size];
        v += (dhx + dhy) * BUMP_AMP;
        v += height[idx] * AO_AMP;       // ambient occlusion
      }

      if (edge) v -= 45;
      if (v < 25) v = 25;
      else if (v > 235) v = 235;

      const tilt = colorTilt ? colorTilt[idx] / 100 : 0;
      const warm = STONE_WARM_BASE + tilt * TILT_AMP;
      const green = v - warm * 0.4;
      const r = v + warm;
      const b = v - warm;

      const p4 = idx * 4;
      px[p4]     = r < 0 ? 0 : r > 255 ? 255 : r;
      px[p4 + 1] = green < 0 ? 0 : green > 255 ? 255 : green;
      px[p4 + 2] = b < 0 ? 0 : b > 255 ? 255 : b;
      px[p4 + 3] = 255;
    }
  }

  ctx.putImageData(img, 0, 0);
}

export function renderCursor(ctx, size, { x, y, radius, active, dark }) {
  ctx.clearRect(0, 0, size, size);
  if (x == null || y == null || radius == null) return;
  ctx.save();
  ctx.lineWidth = 2;
  ctx.strokeStyle = active ? '#e74c3c' : dark ? 'rgba(245, 239, 225, 0.85)' : 'rgba(60, 40, 30, 0.85)';
  ctx.fillStyle = active ? 'rgba(231,76,60,0.28)' : dark ? 'rgba(245,239,225,0.12)' : 'rgba(60, 40, 30, 0.12)';
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  if (radius >= 12) {
    ctx.beginPath();
    ctx.moveTo(x - 4, y);
    ctx.lineTo(x + 4, y);
    ctx.moveTo(x, y - 4);
    ctx.lineTo(x, y + 4);
    ctx.stroke();
  }
  ctx.restore();
}

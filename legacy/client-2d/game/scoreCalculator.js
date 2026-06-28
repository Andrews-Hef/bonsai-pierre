// Pixel-matching between the carved stone mask and the target silhouette.

import { renderTargetSolid } from './solidRenderer.js';

const BLACK_THRESHOLD = 80;

export function computeScore(mask, targetImage, size = 400) {
  // Rasterise the target onto an off-DOM canvas, then read pixels.
  const targetCanvas = document.createElement('canvas');
  targetCanvas.width = size;
  targetCanvas.height = size;
  renderTargetSolid(targetCanvas.getContext('2d'), targetImage, size);
  const targetData = targetCanvas
    .getContext('2d')
    .getImageData(0, 0, size, size).data;

  let intersection = 0;
  let targetBlack = 0;
  let stoneCount = 0;

  for (let i = 0; i < mask.length; i++) {
    const px4 = i * 4;
    const tIsBlack =
      (targetData[px4] + targetData[px4 + 1] + targetData[px4 + 2]) / 3 <
      BLACK_THRESHOLD;
    const sIsStone = mask[i] === 1;
    if (tIsBlack) targetBlack++;
    if (sIsStone) stoneCount++;
    if (sIsStone && tIsBlack) intersection++;
  }

  const coverage = targetBlack > 0 ? intersection / targetBlack : 0;
  const overflow = stoneCount > 0 ? (stoneCount - intersection) / stoneCount : 0;
  const raw = coverage * (1 - overflow * 0.5);
  const score = Math.max(0, Math.min(100, Math.round(raw * 100)));

  return { score, coverage: Math.round(coverage * 100), intersection, targetBlack, stoneCount };
}

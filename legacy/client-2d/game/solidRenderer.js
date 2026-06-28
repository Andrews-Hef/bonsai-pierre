// Renders the player's stone mask as solid black on white, and the target
// silhouette likewise — used by the scorer for pixel matching.

export function renderSolidStone(ctx, mask, size) {
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, size, size);

  const img = ctx.getImageData(0, 0, size, size);
  const px = img.data;
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i]) continue;
    const p4 = i * 4;
    px[p4] = 0;
    px[p4 + 1] = 0;
    px[p4 + 2] = 0;
    px[p4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}

// Draw an Image onto the canvas as a solid black silhouette on white.
// Anything non-transparent in the source becomes black.
export function renderTargetSolid(ctx, image, size) {
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, size, size);

  const tmp = document.createElement('canvas');
  tmp.width = size;
  tmp.height = size;
  const tctx = tmp.getContext('2d');
  tctx.drawImage(image, 0, 0, size, size);

  const data = tctx.getImageData(0, 0, size, size);
  const px = data.data;
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] > 16) {
      px[i] = 0; px[i + 1] = 0; px[i + 2] = 0; px[i + 3] = 255;
    } else {
      px[i] = 255; px[i + 1] = 255; px[i + 2] = 255; px[i + 3] = 255;
    }
  }
  tctx.putImageData(data, 0, 0);
  ctx.drawImage(tmp, 0, 0);
}

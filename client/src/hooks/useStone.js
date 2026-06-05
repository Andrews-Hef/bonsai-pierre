import { useCallback, useMemo, useState } from 'react';
import { generateStone, carveDisc, MASK_SIZE } from '../../../shared/seedUtils.js';

// Holds the mask + intrinsic rock texture. version bumps on each carve so
// consumers re-render even though we mutate the mask in place.
export function useStone(seed) {
  const stone = useMemo(
    () =>
      seed != null
        ? generateStone(seed, MASK_SIZE)
        : { mask: null, texture: null, colorTilt: null, height: null },
    [seed]
  );
  const [version, setVersion] = useState(0);

  const carve = useCallback(
    (x, y, radius) => {
      if (!stone.mask) return;
      if (carveDisc(stone.mask, x, y, radius, MASK_SIZE)) {
        setVersion((v) => v + 1);
      }
    },
    [stone.mask]
  );

  return {
    mask: stone.mask,
    texture: stone.texture,
    colorTilt: stone.colorTilt,
    height: stone.height,
    version,
    carve,
    size: MASK_SIZE,
  };
}

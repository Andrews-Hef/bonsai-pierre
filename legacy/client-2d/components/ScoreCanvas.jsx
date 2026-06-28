// Hidden helper canvas for debugging the matcher pipeline.
// The real scoring uses off-DOM canvases inside scoreCalculator.js.
import { useEffect, useRef } from 'react';
import { renderSolidStone } from '../game/solidRenderer.js';

export default function ScoreCanvas({ mask, size = 400, visible = false }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current || !mask) return;
    renderSolidStone(ref.current.getContext('2d'), mask, size);
  }, [mask, size]);

  return (
    <canvas
      ref={ref}
      width={size}
      height={size}
      style={{
        position: 'absolute',
        left: -9999,
        top: -9999,
        visibility: visible ? 'visible' : 'hidden',
      }}
    />
  );
}

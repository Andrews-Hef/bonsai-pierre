import { useEffect, useRef, useState } from 'react';
import { renderStone, renderCursor } from '../game/stoneRenderer.js';

export default function GameCanvas({
  mask,
  texture,
  colorTilt,
  height,
  version,
  size = 400,
  onCarve,
  toolRadius,
  locked,
  targetImage,
  dark = false,
}) {
  const stoneRef = useRef(null);
  const overlayRef = useRef(null);
  const cursorRef = useRef(null);
  const draggingRef = useRef(false);
  const lastCarveRef = useRef(null);
  const [cursor, setCursor] = useState({ x: null, y: null });

  // Repaint the stone whenever the mask changes.
  useEffect(() => {
    const canvas = stoneRef.current;
    if (!canvas || !mask) return;
    renderStone(canvas.getContext('2d'), mask, texture, colorTilt, height, size);
  }, [mask, texture, colorTilt, height, version, size]);

  // Target overlay (rouge transparent, opacity 0.3 per spec) above the stone.
  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    const ctx = overlay.getContext('2d');
    ctx.clearRect(0, 0, size, size);
    if (!targetImage) return;
    ctx.save();
    ctx.globalAlpha = 0.3;
    ctx.drawImage(targetImage, 0, 0, size, size);
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = '#c0392b';
    ctx.fillRect(0, 0, size, size);
    ctx.restore();
  }, [targetImage, size]);

  // Cursor preview (re-renders on every mouse move, cheap).
  useEffect(() => {
    const canvas = cursorRef.current;
    if (!canvas) return;
    renderCursor(canvas.getContext('2d'), size, {
      x: cursor.x,
      y: cursor.y,
      radius: toolRadius,
      active: draggingRef.current,
      dark,
    });
  }, [cursor, toolRadius, size, dark]);

  function eventCoords(e) {
    const rect = stoneRef.current.getBoundingClientRect();
    const sx = size / rect.width;
    const sy = size / rect.height;
    return {
      x: (e.clientX - rect.left) * sx,
      y: (e.clientY - rect.top) * sy,
    };
  }

  // Carve along the line from last point to current point, so a fast drag
  // doesn't leave gaps between mouse-move samples.
  function carveLine(from, to) {
    if (!from) {
      onCarve(to.x, to.y);
      return;
    }
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dist = Math.hypot(dx, dy);
    const step = Math.max(2, toolRadius * 0.5);
    const n = Math.max(1, Math.ceil(dist / step));
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      onCarve(from.x + dx * t, from.y + dy * t);
    }
  }

  function handleDown(e) {
    if (locked) return;
    const p = eventCoords(e);
    draggingRef.current = true;
    lastCarveRef.current = p;
    onCarve(p.x, p.y);
    setCursor(p);
  }
  function handleMove(e) {
    if (locked) return;
    const p = eventCoords(e);
    setCursor(p);
    if (draggingRef.current) {
      carveLine(lastCarveRef.current, p);
      lastCarveRef.current = p;
    }
  }
  function handleUp() {
    draggingRef.current = false;
    lastCarveRef.current = null;
  }
  function handleLeave() {
    draggingRef.current = false;
    lastCarveRef.current = null;
    setCursor({ x: null, y: null });
  }

  return (
    <div className="relative w-[400px] h-[400px] rounded-2xl shadow-inner bg-beige-50 dark:bg-bark-800 border border-beige-200 dark:border-bark-700 overflow-hidden select-none">
      <canvas
        ref={stoneRef}
        width={size}
        height={size}
        className="absolute inset-0"
      />
      <canvas
        ref={overlayRef}
        width={size}
        height={size}
        className="absolute inset-0 pointer-events-none"
      />
      <canvas
        ref={cursorRef}
        width={size}
        height={size}
        className={`absolute inset-0 ${locked ? 'cursor-default' : 'cursor-none'}`}
        onMouseDown={handleDown}
        onMouseMove={handleMove}
        onMouseUp={handleUp}
        onMouseLeave={handleLeave}
      />
    </div>
  );
}

import { useCallback, useMemo, useRef, useState } from 'react';
import { carveSphere, cloneGrid, estimateIoU } from '../voxel/grid.js';

// État de sculptage. La VÉRITÉ est un unique Uint8Array (gridRef) initialisé
// depuis startGrid. Le raycast de taille mute CETTE grille ; c'est elle qu'on
// encodera pour /submit. `version` ne sert qu'à déclencher la régénération de la
// projection InstancedMesh (qui n'est jamais une source d'état).
//
// targetGrid sert UNIQUEMENT à l'estimation locale (jamais envoyée au serveur).
export function useSculpt(startGrid, targetGrid) {
  const gridRef = useRef(null);
  if (gridRef.current === null) gridRef.current = cloneGrid(startGrid);

  const [version, setVersion] = useState(0);

  const carveAt = useCallback((voxel, radius) => {
    const removed = carveSphere(gridRef.current, voxel.x, voxel.y, voxel.z, radius);
    if (removed > 0) setVersion((v) => v + 1);
    return removed;
  }, []);

  const reset = useCallback(() => {
    gridRef.current = cloneGrid(startGrid);
    setVersion((v) => v + 1);
  }, [startGrid]);

  // Estimation locale recalculée à chaque coup (cheap, n³ une fois par taille).
  const estimate = useMemo(
    () => estimateIoU(gridRef.current, targetGrid),
    // version pilote la péremption ; gridRef.current est muté en place.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [version, targetGrid],
  );

  const remaining = useMemo(() => {
    let n = 0;
    const g = gridRef.current;
    for (let i = 0; i < g.length; i++) n += g[i];
    return n;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);

  return { gridRef, version, carveAt, reset, estimate, remaining };
}

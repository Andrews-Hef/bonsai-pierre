import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { GRID_SIZE, filledVoxels } from '../voxel/grid.js';

// Fantôme (onion-skin) de la cible : voxels de la forme à atteindre rendus en
// translucide. La cible étant incluse dans la pierre de départ, le fantôme reste
// caché tant qu'on n'a pas trop taillé — il réapparaît là où on a retiré de la
// matière à garder, signalant doucement l'erreur. Raycast désactivé : seules les
// faces de la pierre sont cliquables.
const OFF = (GRID_SIZE - 1) / 2;
const dummy = new THREE.Object3D();
const noRaycast = () => null;

export default function GhostTarget({ target }) {
  const meshRef = useRef(null);
  const voxels = useMemo(() => filledVoxels(target), [target]);

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    for (let k = 0; k < voxels.length; k++) {
      const v = voxels[k];
      dummy.position.set(v.x - OFF, v.y - OFF, v.z - OFF);
      dummy.updateMatrix();
      mesh.setMatrixAt(k, dummy.matrix);
    }
    mesh.count = voxels.length;
    mesh.instanceMatrix.needsUpdate = true;
  }, [voxels]);

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, GRID_SIZE * GRID_SIZE * GRID_SIZE]}
      raycast={noRaycast}
    >
      <boxGeometry args={[0.6, 0.6, 0.6]} />
      <meshStandardMaterial
        color="#9ab98a"
        transparent
        opacity={0.28}
        depthWrite={false}
      />
    </instancedMesh>
  );
}

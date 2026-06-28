import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { GRID_SIZE, filledVoxels } from '../voxel/grid.js';

// Projection InstancedMesh de la grille courante. Régénérée à chaque `version` ;
// ne stocke JAMAIS l'état de taille (la vérité reste gridRef dans useSculpt).
//
// Bi-ton local (jamais envoyé) : un voxel présent dans la cible = "à garder"
// (sage), sinon = "excédent à retirer" (bark). Guide le joueur sans rien décider
// du score, qui est recalculé serveur.
const OFF = (GRID_SIZE - 1) / 2;
const dummy = new THREE.Object3D();
const C_KEEP = new THREE.Color('#7d9a6d'); // sage : matière de la forme
const C_EXCESS = new THREE.Color('#8a6a47'); // bark : matière à tailler

export default function VoxelStone({ gridRef, version, target, onCarve }) {
  const meshRef = useRef(null);

  // Liste des voxels pleins, recalculée quand la grille change (version).
  const voxels = useMemo(
    () => filledVoxels(gridRef.current),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [version],
  );

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    for (let k = 0; k < voxels.length; k++) {
      const v = voxels[k];
      dummy.position.set(v.x - OFF, v.y - OFF, v.z - OFF);
      dummy.updateMatrix();
      mesh.setMatrixAt(k, dummy.matrix);
      mesh.setColorAt(k, target[v.i] ? C_KEEP : C_EXCESS);
    }
    mesh.count = voxels.length;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [voxels, target]);

  const handlePointerDown = (e) => {
    if (e.button !== 0 || e.instanceId == null) return;
    e.stopPropagation();
    const v = voxels[e.instanceId];
    if (v) onCarve(v);
  };

  return (
    <instancedMesh
      ref={meshRef}
      // Alloue la capacité max (n³) une fois ; mesh.count borne le rendu.
      args={[undefined, undefined, GRID_SIZE * GRID_SIZE * GRID_SIZE]}
      onPointerDown={handlePointerDown}
      castShadow
      receiveShadow
    >
      <boxGeometry args={[0.96, 0.96, 0.96]} />
      <meshStandardMaterial roughness={0.85} metalness={0.05} />
    </instancedMesh>
  );
}

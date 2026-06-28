import { Canvas } from '@react-three/fiber';
import CameraRig from './CameraRig.jsx';
import GhostTarget from './GhostTarget.jsx';
import VoxelStone from './VoxelStone.jsx';

// Scène 3D de l'atelier. Lumière douce, fond beige, pas de contrôles d'orbite :
// l'angle est piloté par `view` (CameraRig). Le clic sur la pierre appelle
// onCarve(voxel) ; tout l'état de taille vit dans useSculpt, hors de la scène.
export default function SculptScene({ gridRef, version, target, view, onCarve }) {
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ fov: 35, near: 0.1, far: 200, position: [0, 0, 52] }}
      // Rempli en absolu le parent `relative` : la hauteur % d'un flex item ne se
      // résout pas de façon fiable, inset-0 garantit l'occupation totale.
      style={{ position: 'absolute', inset: 0 }}
    >
      <color attach="background" args={['#f1ead9']} />
      <hemisphereLight intensity={0.6} groundColor="#cdbfa3" color="#fff7e6" />
      <directionalLight position={[20, 30, 25]} intensity={1.1} castShadow />
      <directionalLight position={[-15, 10, -20]} intensity={0.4} />

      <CameraRig view={view} />
      <VoxelStone gridRef={gridRef} version={version} target={target} onCarve={onCarve} />
      <GhostTarget target={target} />
    </Canvas>
  );
}

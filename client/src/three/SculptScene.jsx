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
      className="fade-in"
      // Rempli en absolu le parent `relative` : la hauteur % d'un flex item ne se
      // résout pas de façon fiable, inset-0 garantit l'occupation totale.
      style={{ position: 'absolute', inset: 0 }}
    >
      <color attach="background" args={['#f1ead9']} />
      {/* Ambiance atelier : ciel chaud + léger remplissage pour décoller les
          faces dans l'ombre sans écraser le bi-ton sage/bark de la pierre. */}
      <hemisphereLight intensity={0.55} groundColor="#cdbfa3" color="#fff7e6" />
      <ambientLight intensity={0.18} />
      <directionalLight
        position={[22, 32, 26]}
        intensity={1.15}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0005}
      />
      <directionalLight position={[-18, 12, -22]} intensity={0.35} color="#e9dcbf" />

      <CameraRig view={view} />
      <VoxelStone gridRef={gridRef} version={version} target={target} onCarve={onCarve} />
      <GhostTarget target={target} />
    </Canvas>
  );
}

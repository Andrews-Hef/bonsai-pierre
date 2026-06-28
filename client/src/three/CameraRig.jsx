import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';

// Caméras FIXES (pas d'orbite libre). Trois points de vue orthogonaux ; on tourne
// la pierre en changeant de vue, jamais à la souris. Tailler sous un angle puis
// changer de vue permet d'attaquer les autres faces.
const DIST = 52;
export const VIEWS = {
  face: { pos: [0, 0, DIST], up: [0, 1, 0] },
  profil: { pos: [DIST, 0, 0], up: [0, 1, 0] },
  dessus: { pos: [0, DIST, 0], up: [0, 0, -1] },
};

export default function CameraRig({ view }) {
  const camera = useThree((s) => s.camera);

  useEffect(() => {
    const v = VIEWS[view] ?? VIEWS.face;
    camera.up.set(...v.up);
    camera.position.set(...v.pos);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  }, [camera, view]);

  return null;
}

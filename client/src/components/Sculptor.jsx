import { useState } from 'react';
import SculptScene from '../three/SculptScene.jsx';
import ToolPalette from './ToolPalette.jsx';
import { useSculpt } from '../hooks/useSculpt.js';

// Ciseaux : `radius` = taille d'aperçu (px) pour ToolPalette ; `carve` = rayon de
// taille en voxels passé à carveSphere.
const BRUSHES = [
  { id: 'fin', label: 'Fin', radius: 6, carve: 0 },
  { id: 'moyen', label: 'Moyen', radius: 12, carve: 1.5 },
  { id: 'gros', label: 'Gros', radius: 20, carve: 2.5 },
];

const VIEWS = [
  { id: 'face', label: 'Face' },
  { id: 'profil', label: 'Profil' },
  { id: 'dessus', label: 'Dessus' },
];

// Écran de jeu : la pierre du jour à tailler vers la forme cible.
// day = { puzzle, startGrid, targetGrid, sessionToken, startedAt }.
export default function Sculptor({ day }) {
  const { gridRef, version, carveAt, reset, estimate, remaining } = useSculpt(
    day.startGrid,
    day.targetGrid,
  );
  const [brushId, setBrushId] = useState('moyen');
  const [view, setView] = useState('face');

  const brush = BRUSHES.find((b) => b.id === brushId) ?? BRUSHES[0];
  const onCarve = (voxel) => carveAt(voxel, brush.carve);
  const pct = Math.round(estimate * 100);

  return (
    <div className="min-h-screen flex flex-col bg-beige-50 dark:bg-bark-900 text-bark-700 dark:text-beige-100">
      <header className="flex items-baseline justify-between px-5 py-3 border-b border-bark-500/15 dark:border-beige-200/10">
        <h1 className="text-xl font-zen">🪨 Stone Daily</h1>
        <p className="text-sm text-bark-500 dark:text-beige-200/70">
          <span className="font-zen text-base text-bark-700 dark:text-beige-100">
            {day.puzzle.shapeName}
          </span>{' '}
          · {day.puzzle.puzzleOn}
        </p>
      </header>

      <div className="relative flex-1 min-h-0">
        <SculptScene
          gridRef={gridRef}
          version={version}
          target={day.targetGrid}
          view={view}
          onCarve={onCarve}
        />

        {/* Estimation LOCALE — le score officiel est calculé par le serveur. */}
        <div className="absolute top-4 left-4 rounded-xl bg-beige-100/85 dark:bg-bark-800/85 backdrop-blur px-4 py-3 shadow-sm">
          <p className="text-3xl font-zen text-sage-600 dark:text-sage-400 leading-none">
            {pct}%
          </p>
          <p className="text-[11px] text-bark-400 dark:text-beige-200/50 mt-1">
            ressemblance estimée (locale)
          </p>
          <p className="text-[11px] text-bark-400 dark:text-beige-200/50">
            {remaining} voxels restants
          </p>
        </div>

        {/* Vues fixes (pas d'orbite). */}
        <div className="absolute top-4 right-4 flex flex-col gap-2">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              onClick={() => setView(v.id)}
              className={`px-3 py-1.5 rounded-lg text-sm font-zen border transition ${
                view === v.id
                  ? 'bg-bark-600 dark:bg-sage-600 text-beige-50 border-bark-600 dark:border-sage-600'
                  : 'bg-beige-100/85 dark:bg-bark-700/85 text-bark-700 dark:text-beige-100 border-bark-500/20 dark:border-beige-200/15 hover:bg-beige-200 dark:hover:bg-bark-600'
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      <footer className="flex items-center justify-between gap-4 px-5 py-4 border-t border-bark-500/15 dark:border-beige-200/10">
        <ToolPalette tools={BRUSHES} currentId={brushId} onSelect={setBrushId} />
        <div className="flex items-center gap-3">
          <button
            onClick={reset}
            className="px-4 py-2 rounded-xl font-zen text-sm border border-bark-500/30 dark:border-beige-200/20 text-bark-600 dark:text-beige-200 hover:bg-beige-100 dark:hover:bg-bark-700 transition"
          >
            Recommencer
          </button>
          <button
            disabled
            title="Soumission disponible à l'étape 5"
            className="px-5 py-2 rounded-xl font-zen text-sm bg-sage-600 text-beige-50 opacity-40 cursor-not-allowed"
          >
            Valider (étape 5)
          </button>
        </div>
      </footer>
    </div>
  );
}

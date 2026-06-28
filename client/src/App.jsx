// Coquille de l'atelier Stone Daily, branchée sur l'API /v1.
// Étape 3 : chargement de la journée + états (loading / ready / already_played /
// error). La scène de sculptage 3D (R3F) arrive à l'étape 4 ; le résultat serveur
// et le classement à l'étape 5.
import { useDaily } from './hooks/useDaily.js';
import Sculptor from './components/Sculptor.jsx';

function countVoxels(grid) {
  let n = 0;
  for (let i = 0; i < grid.length; i++) n += grid[i];
  return n;
}

function Shell({ children }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 bg-beige-50 dark:bg-bark-900 text-bark-700 dark:text-beige-100 px-6 text-center">
      <h1 className="text-3xl font-zen">🪨 Stone Daily</h1>
      {children}
    </div>
  );
}

function Loading() {
  return (
    <Shell>
      <p className="text-bark-500 dark:text-beige-200/80 animate-pulse">
        Chargement de la pierre du jour…
      </p>
    </Shell>
  );
}

function ErrorView({ error }) {
  const status = error?.status;
  const hint =
    status === 0
      ? "L'API ne répond pas. Le backend Fastify tourne-t-il sur :8080 ?"
      : status === 401
        ? 'Authentification refusée (x-user-id).'
        : status === 503
          ? "Le puzzle du jour n'est pas encore généré (seed:puzzle)."
          : 'Une erreur est survenue.';
  return (
    <Shell>
      <p className="text-bark-600 dark:text-beige-200">{hint}</p>
      <p className="text-xs text-bark-400 dark:text-beige-200/50 font-mono">
        {status ? `HTTP ${status}` : 'réseau'} · {error?.code ?? '—'} · {error?.message}
      </p>
    </Shell>
  );
}

function PuzzleMeta({ puzzle, startGrid, targetGrid }) {
  return (
    <div className="text-sm text-bark-500 dark:text-beige-200/80 space-y-1">
      <p>
        <span className="font-zen text-lg text-bark-700 dark:text-beige-100">
          {puzzle.shapeName}
        </span>{' '}
        · {puzzle.puzzleOn} · grille {puzzle.gridSize}³
      </p>
      <p className="font-mono text-xs text-bark-400 dark:text-beige-200/50">
        pierre {countVoxels(startGrid)} voxels · cible {countVoxels(targetGrid)} voxels
      </p>
    </div>
  );
}

function AlreadyPlayed({ day }) {
  return (
    <Shell>
      <PuzzleMeta puzzle={day.puzzle} startGrid={day.startGrid} targetGrid={day.targetGrid} />
      <p className="text-bark-600 dark:text-beige-200">
        Tu as déjà joué aujourd'hui. Reviens demain pour une nouvelle pierre.
      </p>
      <p className="text-xs text-bark-400 dark:text-beige-200/50">
        (Ton résultat et le classement s'afficheront ici à l'étape 5.)
      </p>
    </Shell>
  );
}

export default function App() {
  const day = useDaily();

  switch (day.status) {
    case 'loading':
      return <Loading />;
    case 'error':
      return <ErrorView error={day.error} />;
    case 'already_played':
      return <AlreadyPlayed day={day} />;
    case 'ready':
      return <Sculptor day={day} />;
    default:
      return <Loading />;
  }
}

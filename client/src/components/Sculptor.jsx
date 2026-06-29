import { lazy, Suspense, useState } from 'react';
import ToolPalette from './ToolPalette.jsx';
import HelpModal from './HelpModal.jsx';
import ResultScreen from './ResultScreen.jsx';
import { useSculpt } from '../hooks/useSculpt.js';
import { encodeGridBrowser } from '../voxel/codec.js';
import { postSubmit, getLeaderboard } from '../api/daily.js';
import { ApiError } from '../api/client.js';

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

// La scène three (fiber + drei + three, ~970 kB) est le gros du poids. On la
// charge en différé (chunk séparé) pour que le bundle initial reste léger —
// déterminant sur mobile. Le reste de l'écran (HUD, ciseaux) s'affiche tout de
// suite ; la scène se substitue au fallback dès que son chunk est prêt.
const SculptScene = lazy(() => import('../three/SculptScene.jsx'));

function SceneFallback() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-beige-50 dark:bg-bark-900">
      <p className="text-bark-400 dark:text-beige-200/60 animate-pulse">
        Préparation de l'atelier…
      </p>
    </div>
  );
}

// Écran de jeu : la pierre du jour à tailler vers la forme cible.
// day = { puzzle, startGrid, targetGrid, sessionToken, startedAt }.
export default function Sculptor({ day }) {
  const { gridRef, version, carveAt, reset, estimate, remaining } = useSculpt(
    day.startGrid,
    day.targetGrid,
  );
  const [brushId, setBrushId] = useState('moyen');
  const [view, setView] = useState('face');
  const [helpOpen, setHelpOpen] = useState(false);

  // Soumission. result vient EXCLUSIVEMENT de la réponse serveur.
  const [result, setResult] = useState(null); // null tant qu'on sculpte
  const [alreadyPlayed, setAlreadyPlayed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  const brush = BRUSHES.find((b) => b.id === brushId) ?? BRUSHES[0];
  const onCarve = (voxel) => carveAt(voxel, brush.carve);
  const pct = Math.round(estimate * 100);

  async function submitNow() {
    setConfirming(false);
    setSubmitting(true);
    setSubmitError(null);
    try {
      // On encode la grille-vérité MUTÉE (gridRef), pas l'estimation locale.
      const finalGrid = await encodeGridBrowser(gridRef.current);
      const resp = await postSubmit({ session_token: day.sessionToken, final_grid: finalGrid });
      setResult(resp); // { resemblance, duration_ms, score, rank, percentile, top[] }
    } catch (err) {
      if (err instanceof ApiError && err.status === 409 && err.code === 'already_played') {
        // Déjà soumis aujourd'hui : on montre quand même le standing via le classement.
        try {
          const lb = await getLeaderboard(day.puzzle.puzzleOn);
          setAlreadyPlayed(true);
          setResult({
            score: lb.me?.score ?? 0,
            resemblance: null,
            duration_ms: null,
            rank: lb.me?.rank ?? null,
            percentile: lb.me?.percentile ?? null,
            top: lb.top ?? [],
          });
        } catch {
          setSubmitError('Déjà joué aujourd’hui, mais le classement est indisponible.');
        }
      } else if (err instanceof ApiError && err.status === 422) {
        setSubmitError('Grille invalide — réessaie après quelques tailles.');
      } else if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        setSubmitError('Session expirée ou invalide. Recharge la page pour rejouer.');
      } else {
        setSubmitError('Envoi impossible (réseau ou serveur). Réessaie.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    return (
      <ResultScreen
        puzzle={day.puzzle}
        result={result}
        localEstimate={estimate}
        alreadyPlayed={alreadyPlayed}
      />
    );
  }

  return (
    <div className="min-h-[100dvh] flex flex-col bg-beige-50 dark:bg-bark-900 text-bark-700 dark:text-beige-100">
      <header className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3 border-b border-bark-500/15 dark:border-beige-200/10">
        <h1 className="text-lg sm:text-xl font-zen shrink-0">🪨 Stone Daily</h1>
        <div className="flex items-center gap-3 min-w-0">
          <p className="text-sm text-bark-500 dark:text-beige-200/70 truncate">
            <span className="font-zen text-base text-bark-700 dark:text-beige-100">
              {day.puzzle.shapeName}
            </span>
            <span className="hidden sm:inline"> · {day.puzzle.puzzleOn}</span>
          </p>
          <button
            onClick={() => setHelpOpen(true)}
            aria-label="Comment jouer"
            title="Comment jouer"
            className="h-9 w-9 shrink-0 rounded-full font-zen text-base border border-bark-500/30 dark:border-beige-200/20 text-bark-600 dark:text-beige-100 hover:bg-beige-100 dark:hover:bg-bark-700 transition"
          >
            ?
          </button>
        </div>
      </header>

      <div className="relative flex-1 min-h-0 select-none touch-none">
        <Suspense fallback={<SceneFallback />}>
          <SculptScene
            gridRef={gridRef}
            version={version}
            target={day.targetGrid}
            view={view}
            onCarve={onCarve}
          />
        </Suspense>

        {/* Croix centrale : repère du centre de la pierre (aide au cadrage au
            doigt, vues fixes). Décorative, jamais cliquable. */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="relative h-6 w-6 opacity-30">
            <span className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-bark-600 dark:bg-beige-100" />
            <span className="absolute top-1/2 left-0 h-px w-full -translate-y-1/2 bg-bark-600 dark:bg-beige-100" />
          </div>
        </div>

        {/* Estimation LOCALE — le score officiel est calculé par le serveur. */}
        <div className="absolute top-3 left-3 sm:top-4 sm:left-4 rounded-xl bg-beige-100/85 dark:bg-bark-800/85 backdrop-blur px-3 py-2 sm:px-4 sm:py-3 shadow-sm">
          <p className="text-2xl sm:text-3xl font-zen text-sage-600 dark:text-sage-400 leading-none">
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
        <div className="absolute top-3 right-3 sm:top-4 sm:right-4 flex flex-col gap-1.5 sm:gap-2">
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

        {submitError && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-[90%] max-w-sm text-center rounded-lg bg-red-900/80 text-beige-50 text-sm px-4 py-2 shadow">
            {submitError}
          </div>
        )}
      </div>

      <footer className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 sm:px-5 py-3 sm:py-4 border-t border-bark-500/15 dark:border-beige-200/10">
        <div className="flex justify-center sm:justify-start">
          <ToolPalette tools={BRUSHES} currentId={brushId} onSelect={setBrushId} disabled={submitting} />
        </div>
        <div className="flex items-center justify-end gap-2 sm:gap-3">
          <button
            onClick={reset}
            disabled={submitting}
            className="px-4 py-2.5 rounded-xl font-zen text-sm border border-bark-500/30 dark:border-beige-200/20 text-bark-600 dark:text-beige-200 hover:bg-beige-100 dark:hover:bg-bark-700 transition disabled:opacity-40"
          >
            Recommencer
          </button>

          {confirming ? (
            <>
              <button
                onClick={() => setConfirming(false)}
                disabled={submitting}
                className="px-4 py-2.5 rounded-xl font-zen text-sm border border-bark-500/30 dark:border-beige-200/20 text-bark-600 dark:text-beige-200 hover:bg-beige-100 dark:hover:bg-bark-700 transition"
              >
                Annuler
              </button>
              <button
                onClick={submitNow}
                disabled={submitting}
                className="px-5 py-2.5 rounded-xl font-zen text-sm bg-sage-600 text-beige-50 hover:bg-sage-500 transition disabled:opacity-50"
              >
                {submitting ? 'Envoi…' : 'Confirmer (1 seul essai)'}
              </button>
            </>
          ) : (
            <button
              onClick={() => setConfirming(true)}
              disabled={submitting}
              className="px-5 py-2.5 rounded-xl font-zen text-sm bg-sage-600 text-beige-50 hover:bg-sage-500 transition disabled:opacity-50"
            >
              Valider
            </button>
          )}
        </div>
      </footer>

      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  );
}

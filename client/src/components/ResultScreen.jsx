// Écran de résultat. Le score affiché vient EXCLUSIVEMENT de la réponse serveur
// (/submit ou /leaderboard) — jamais de l'estimation locale vue pendant la taille.
// L'estimation locale n'est montrée que pour comparaison, clairement étiquetée.
import Leaderboard from './Leaderboard.jsx';

function formatDuration(ms) {
  if (ms == null) return '—';
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1).replace('.', ',')} s`;
  const m = Math.floor(s / 60);
  const r = Math.round(s - m * 60);
  return `${m} min ${String(r).padStart(2, '0')} s`;
}

const pct = (x) => (x == null ? '—' : `${Math.round(x * 100)} %`);

export default function ResultScreen({ puzzle, result, localEstimate, alreadyPlayed }) {
  // result : { score, resemblance?, duration_ms?, rank, percentile, top[] }
  return (
    <div className="fade-in min-h-[100dvh] flex flex-col items-center justify-center gap-6 bg-beige-50 dark:bg-bark-900 text-bark-700 dark:text-beige-100 px-6 py-10">
      <h1 className="text-2xl font-zen">🪨 Stone Daily</h1>

      {alreadyPlayed && (
        <p className="text-sm text-bark-500 dark:text-beige-200/70">
          Tu as déjà joué aujourd'hui — voici ton résultat.
        </p>
      )}

      <div className="text-center">
        <p className="text-sm uppercase tracking-widest text-bark-500/70 dark:text-beige-200/70">
          Score officiel <span className="normal-case">(serveur)</span>
        </p>
        <p className="font-zen text-6xl text-sage-600 dark:text-sage-400 mt-2 leading-none">
          {result.score}
          <span className="text-2xl text-bark-500/60 dark:text-beige-200/60"> pts</span>
        </p>
      </div>

      <div className="flex flex-wrap justify-center gap-6 sm:gap-8 text-center">
        <Metric label="Ressemblance" value={pct(result.resemblance)} />
        <Metric label="Temps" value={formatDuration(result.duration_ms)} />
        <Metric
          label="Rang"
          value={result.rank != null ? `#${result.rank}` : '—'}
          sub={result.percentile != null ? `top ${Math.round(100 - result.percentile)} %` : null}
        />
      </div>

      {/* Distinction explicite : prouve que l'officiel n'est pas l'estimation locale. */}
      {localEstimate != null && result.resemblance != null && (
        <p className="text-xs text-bark-400 dark:text-beige-200/50">
          Ton estimation locale pendant la taille : {pct(localEstimate)} · ressemblance
          officielle (serveur) : {pct(result.resemblance)}
        </p>
      )}

      <div className="w-full max-w-md">
        <Leaderboard top={result.top} date={puzzle.puzzleOn} />
      </div>

      <p className="text-xs text-bark-500/50 dark:text-beige-200/50">
        {puzzle.shapeName} · {puzzle.puzzleOn} · reviens demain pour une nouvelle pierre 🌱
      </p>
    </div>
  );
}

function Metric({ label, value, sub }) {
  return (
    <div>
      <p className="text-xs text-bark-500/70 dark:text-beige-200/70">{label}</p>
      <p className="font-zen text-2xl text-bark-700 dark:text-beige-50">{value}</p>
      {sub && <p className="text-[11px] text-bark-400 dark:text-beige-200/50">{sub}</p>}
    </div>
  );
}

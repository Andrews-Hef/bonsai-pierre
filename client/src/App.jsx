// Coquille de l'atelier Stone Daily, branchée sur l'API /v1.
// États : loading / ready (sculptage) / already_played (résultat+classement) /
// error. Le score affiché vient toujours du serveur, jamais de l'estimation locale.
import { useEffect, useState } from 'react';
import { useDaily } from './hooks/useDaily.js';
import { getLeaderboard } from './api/daily.js';
import Sculptor from './components/Sculptor.jsx';
import ResultScreen from './components/ResultScreen.jsx';

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

// Déjà joué au chargement : on récupère le classement pour montrer le standing du
// joueur (score serveur de sa soumission existante).
function AlreadyPlayed({ day }) {
  const [lb, setLb] = useState(undefined); // undefined = en cours, null = échec

  useEffect(() => {
    let on = true;
    getLeaderboard(day.puzzle.puzzleOn)
      .then((data) => on && setLb(data))
      .catch(() => on && setLb(null));
    return () => {
      on = false;
    };
  }, [day.puzzle.puzzleOn]);

  if (lb === undefined) return <Loading />;
  if (lb === null) {
    return (
      <Shell>
        <p className="text-bark-600 dark:text-beige-200">
          Tu as déjà joué aujourd'hui. Reviens demain pour une nouvelle pierre.
        </p>
      </Shell>
    );
  }

  return (
    <ResultScreen
      puzzle={day.puzzle}
      alreadyPlayed
      result={{
        score: lb.me?.score ?? 0,
        resemblance: null,
        duration_ms: null,
        rank: lb.me?.rank ?? null,
        percentile: lb.me?.percentile ?? null,
        top: lb.top ?? [],
      }}
    />
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

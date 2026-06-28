// Liste du classement du jour. `top` = [{ rank, display_name, score, duration_ms }]
// tel que renvoyé par /submit ou /v1/daily/leaderboard. `meRank` met en évidence
// la ligne du joueur si elle figure dans le top.
function formatDuration(ms) {
  if (ms == null) return '';
  const s = ms / 1000;
  return s < 60 ? `${s.toFixed(1).replace('.', ',')} s` : `${Math.floor(s / 60)} min`;
}

export default function Leaderboard({ top, meRank }) {
  return (
    <div>
      <p className="text-sm uppercase tracking-widest text-bark-500/70 dark:text-beige-200/70 mb-2 text-center">
        🏆 Classement du jour
      </p>
      {!top || top.length === 0 ? (
        <p className="text-sm text-bark-500/70 dark:text-beige-200/70 text-center">
          Classement indisponible pour le moment.
        </p>
      ) : (
        <ul className="divide-y divide-beige-200 dark:divide-bark-700 text-sm">
          {top.map((e) => (
            <li
              key={e.rank}
              className={`flex justify-between items-center py-2 px-2 rounded ${
                meRank === e.rank ? 'bg-sage-400/20 dark:bg-sage-600/20' : ''
              }`}
            >
              <span className="w-8 text-bark-500/70 dark:text-beige-200/60">#{e.rank}</span>
              <span className="flex-1 text-bark-700 dark:text-beige-100 truncate">
                {e.display_name}
              </span>
              <span className="text-bark-400 dark:text-beige-200/50 text-xs mr-3">
                {formatDuration(e.duration_ms)}
              </span>
              <span className="font-semibold text-sage-600 dark:text-sage-400">
                {e.score}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function StatsModal({ open, onClose, stats }) {
  if (!open) return null;
  const { streak, bestStreak, avgScore, totalGames, history } = stats;

  const last14 = history.slice(-14);
  const maxScore = 100;

  return (
    <div
      className="fixed inset-0 bg-bark-700/40 dark:bg-bark-900/70 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-beige-50 dark:bg-bark-800 rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center">
          <h2 className="font-zen text-2xl text-bark-700 dark:text-beige-50">Vos statistiques</h2>
          <button
            onClick={onClose}
            className="text-bark-500 dark:text-beige-200 hover:text-bark-700 dark:hover:text-beige-50 text-2xl leading-none"
            aria-label="Fermer"
          >
            ×
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 text-center">
          <Stat label="🔥 Streak" value={streak} />
          <Stat label="🏆 Meilleur streak" value={bestStreak} />
          <Stat label="📊 Score moyen 7j" value={avgScore} />
          <Stat label="🎮 Parties" value={totalGames} />
        </div>

        <div>
          <p className="text-sm uppercase tracking-widest text-bark-500/70 dark:text-beige-200/70 mb-2">
            📅 14 derniers jours
          </p>
          {last14.length === 0 ? (
            <p className="text-sm text-bark-500/70 dark:text-beige-200/70">Aucune partie pour le moment.</p>
          ) : (
            <div className="flex items-end gap-1 h-28">
              {last14.map((h) => (
                <div key={h.date} className="flex-1 flex flex-col items-center gap-1" title={`${h.date} — ${h.target} — ${h.score}/100`}>
                  <div className="w-full bg-sage-400 dark:bg-sage-500 rounded-t" style={{ height: `${(h.score / maxScore) * 100}%` }} />
                  <div className="text-[10px] text-bark-500/60 dark:text-beige-200/60">{h.date.slice(8)}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <p className="text-sm uppercase tracking-widest text-bark-500/70 dark:text-beige-200/70 mb-2">
            🎯 Historique
          </p>
          <ul className="max-h-40 overflow-y-auto divide-y divide-beige-200 dark:divide-bark-700 text-sm">
            {history.slice().reverse().map((h) => (
              <li key={h.date} className="flex justify-between py-1.5">
                <span className="text-bark-600 dark:text-beige-100">{h.date}</span>
                <span className="text-bark-500/80 dark:text-beige-200/80">{h.target}</span>
                <span className="font-semibold text-sage-600 dark:text-sage-400">{h.score}/100</span>
              </li>
            ))}
            {history.length === 0 && (
              <li className="text-bark-500/60 dark:text-beige-200/60 py-2">Pas encore d'historique.</li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="bg-beige-100 dark:bg-bark-700 rounded-xl p-3">
      <p className="text-xs text-bark-500/70 dark:text-beige-200/70">{label}</p>
      <p className="font-zen text-2xl text-bark-700 dark:text-beige-50">{value}</p>
    </div>
  );
}

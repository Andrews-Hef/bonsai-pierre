import { useEffect, useState } from 'react';

export default function ScoreResult({ score, targetName, date, streak, onShare, onOpenStats }) {
  const [displayed, setDisplayed] = useState(0);

  useEffect(() => {
    let raf;
    const duration = 900;
    const start = performance.now();
    function tick(now) {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplayed(Math.round(score * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [score]);

  return (
    <div className="text-center space-y-4 max-w-md mx-auto">
      <div>
        <p className="text-sm uppercase tracking-widest text-bark-500/70 dark:text-beige-200/70">
          Votre score
        </p>
        <p className="font-zen text-6xl text-sage-600 dark:text-sage-400 mt-2">
          {displayed}
          <span className="text-2xl text-bark-500/60 dark:text-beige-200/60">/100</span>
        </p>
      </div>

      <p className="text-bark-600 dark:text-beige-100">
        🔥 Streak : <span className="font-semibold">{streak} jour{streak > 1 ? 's' : ''}</span>
      </p>
      <p className="text-bark-500 dark:text-beige-200/80 text-sm">
        Revenez demain pour continuer votre série 🌱
      </p>

      <div className="flex gap-3 justify-center pt-2">
        <button
          onClick={onShare}
          className="px-4 py-2 rounded-full bg-sage-600 text-beige-50 hover:bg-sage-500 transition shadow"
        >
          Partager mon score
        </button>
        <button
          onClick={onOpenStats}
          className="px-4 py-2 rounded-full border border-bark-500/30 dark:border-beige-200/20 text-bark-700 dark:text-beige-100 hover:bg-beige-100 dark:hover:bg-bark-700 transition"
        >
          Voir mes stats
        </button>
      </div>

      <p className="text-xs text-bark-500/50 dark:text-beige-200/50 pt-2">
        Cible : {targetName} · {date}
      </p>
    </div>
  );
}

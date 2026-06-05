import { useEffect, useState } from 'react';
import GameCanvas from './components/GameCanvas.jsx';
import ScoreCanvas from './components/ScoreCanvas.jsx';
import TargetOverlay from './components/TargetOverlay.jsx';
import ScoreResult from './components/ScoreResult.jsx';
import StatsModal from './components/StatsModal.jsx';
import ToolPalette from './components/ToolPalette.jsx';
import { useDailyChallenge } from './hooks/useDailyChallenge.js';
import { useStone } from './hooks/useStone.js';
import { usePlayerStats } from './hooks/usePlayerStats.js';
import { computeScore } from './game/scoreCalculator.js';
import { TOOLS } from '../../shared/seedUtils.js';

function loadTargetImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function initialDark() {
  const stored = localStorage.getItem('bonsai_daily_theme');
  if (stored) return stored === 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export default function App() {
  const { data: challenge, error } = useDailyChallenge();
  const { mask, texture, colorTilt, height, version, carve, size } = useStone(challenge?.seed);
  const { saveResult, getStats } = usePlayerStats();

  const [targetImage, setTargetImage] = useState(null);
  const [result, setResult] = useState(null);
  const [statsOpen, setStatsOpen] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [toolId, setToolId] = useState('medium');
  const [dark, setDark] = useState(initialDark);

  const tool = TOOLS.find((t) => t.id === toolId);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('bonsai_daily_theme', dark ? 'dark' : 'light');
  }, [dark]);

  useEffect(() => {
    if (!challenge) return;
    loadTargetImage(challenge.targetImage)
      .then(setTargetImage)
      .catch(() => setTargetImage(null));
  }, [challenge]);

  useEffect(() => {
    if (!challenge) return;
    const today = getStats().history.find((h) => h.date === challenge.date);
    if (today) setResult({ score: today.score, locked: true });
  }, [challenge, getStats]);

  function handleValidate() {
    if (!mask || !targetImage || !challenge) return;
    const { score } = computeScore(mask, targetImage, size);
    saveResult(challenge.date, score, challenge.targetName);
    setResult({ score, locked: true });
  }

  function handleShare() {
    if (!result || !challenge) return;
    const stats = getStats();
    const niceDate = challenge.date.split('-').reverse().join('/');
    const text = `🪨 Stone Daily — ${niceDate}\nCible : ${challenge.targetName}\nScore : ${result.score}/100 ⛏️🔥 x${stats.streak}`;
    if (navigator.clipboard) navigator.clipboard.writeText(text).catch(() => {});
    if (navigator.share) navigator.share({ text }).catch(() => {});
  }

  if (error) {
    return (
      <div className="min-h-full flex items-center justify-center p-8 text-bark-700 dark:text-beige-100">
        <p>Impossible de charger le défi du jour : {error}</p>
      </div>
    );
  }
  if (!challenge) {
    return (
      <div className="min-h-full flex items-center justify-center p-8 text-bark-500 dark:text-beige-200">
        Chargement de la pierre du jour…
      </div>
    );
  }

  const locked = !!result;
  const stats = getStats();

  return (
    <div className="min-h-full flex flex-col items-center px-4 py-6 gap-6">
      <header className="w-full max-w-2xl flex justify-between items-center">
        <div className="text-bark-500/80 dark:text-beige-200/80 text-sm font-zen">
          🪨 Stone Daily
        </div>
        <div className="flex gap-4 items-center">
          <button
            onClick={() => setStatsOpen(true)}
            className="text-bark-500 dark:text-beige-200 hover:text-bark-700 dark:hover:text-beige-50 text-sm underline-offset-4 hover:underline"
          >
            Mes stats
          </button>
          <button
            onClick={() => setDark((d) => !d)}
            aria-label="Basculer le thème"
            title={dark ? 'Mode clair' : 'Mode sombre'}
            className="w-9 h-9 rounded-full flex items-center justify-center text-lg border border-bark-500/30 dark:border-beige-200/20 bg-beige-100 dark:bg-bark-700 hover:bg-beige-200 dark:hover:bg-bark-600 transition"
          >
            {dark ? '☀️' : '🌙'}
          </button>
        </div>
      </header>

      <TargetOverlay targetName={challenge.targetName} />

      <div className="flex items-start gap-5">
        <GameCanvas
          mask={mask}
          texture={texture}
          colorTilt={colorTilt}
          height={height}
          version={version}
          size={size}
          onCarve={(x, y) => carve(x, y, tool.radius)}
          toolRadius={tool.radius}
          locked={locked}
          targetImage={targetImage}
          dark={dark}
        />
        {previewing && (
          <div className="w-[220px] bg-beige-100 dark:bg-bark-700 rounded-2xl shadow-md border border-beige-200 dark:border-bark-600 p-4 flex flex-col items-center">
            <p className="text-xs uppercase tracking-widest text-bark-500/70 dark:text-beige-200/70">
              Cible à reproduire
            </p>
            <div className="w-[180px] h-[180px] mt-3 flex items-center justify-center bg-beige-50 dark:bg-bark-800 rounded-xl">
              <img
                src={challenge.targetImage}
                alt={challenge.targetName}
                className={`w-[160px] h-[160px] ${dark ? 'invert' : ''}`}
                draggable={false}
              />
            </div>
            <p className="text-sm text-bark-700 dark:text-beige-100 font-zen mt-3 text-center">
              {challenge.targetName}
            </p>
          </div>
        )}
      </div>

      <ScoreCanvas mask={mask} size={size} />

      {!locked && (
        <ToolPalette
          tools={TOOLS}
          currentId={toolId}
          onSelect={setToolId}
          disabled={locked}
        />
      )}

      {!locked ? (
        <div className="flex gap-3 items-center">
          <button
            onClick={() => setPreviewing((v) => !v)}
            className={`px-5 py-3 rounded-full border transition shadow-sm font-zen ${
              previewing
                ? 'bg-sage-600 text-beige-50 border-sage-600'
                : 'bg-beige-100 dark:bg-bark-700 text-bark-700 dark:text-beige-100 border-bark-500/30 dark:border-beige-200/20 hover:bg-beige-200 dark:hover:bg-bark-600'
            }`}
          >
            👁️ {previewing ? 'Cacher la cible' : 'Voir la cible'}
          </button>
          <button
            onClick={handleValidate}
            disabled={!targetImage}
            className="px-6 py-3 rounded-full bg-bark-600 dark:bg-sage-600 text-beige-50 hover:bg-bark-700 dark:hover:bg-sage-500 disabled:opacity-40 transition shadow-md font-zen text-lg"
          >
            Valider ma sculpture ⛏️
          </button>
        </div>
      ) : (
        <ScoreResult
          score={result.score}
          targetName={challenge.targetName}
          date={challenge.date}
          streak={stats.streak}
          onShare={handleShare}
          onOpenStats={() => setStatsOpen(true)}
        />
      )}

      <StatsModal open={statsOpen} onClose={() => setStatsOpen(false)} stats={stats} />
    </div>
  );
}

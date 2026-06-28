// In V1 we don't persist anything: the challenge of the day is computed
// on demand from today's date, fully deterministically.
import { getTargetForDate } from './targetSelector.js';

export function todayString(now = new Date()) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function buildDailyChallenge(dateString = todayString()) {
  const target = getTargetForDate(dateString);
  const seed = parseInt(dateString.replace(/-/g, ''), 10);
  return {
    seed,
    date: dateString,
    targetImage: `/targets/${target.file}`,
    targetName: target.name,
    targetId: target.id,
  };
}

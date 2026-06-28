// Date du jour en UTC au format YYYY-MM-DD (le "reset" quotidien = la date qui
// avance en UTC). Toute la logique daily/streak s'appuie là-dessus.
export function todayUtc(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

// La veille de `dateStr` (YYYY-MM-DD), en UTC. Sert au calcul de streak.
export function yesterdayOf(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Valide qu'une chaîne est bien une date calendaire YYYY-MM-DD (et pas 2026-13-40).
export function isValidDateStr(s: string): boolean {
  if (!DATE_RE.test(s)) return false;
  const d = new Date(`${s}T00:00:00.000Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'bonsai_daily_data';

function loadRaw() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function emptyData() {
  return {
    history: [],
    streak: 0,
    bestStreak: 0,
    lastPlayed: null,
  };
}

function ymdToDate(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function dayDiff(aYmd, bYmd) {
  const a = ymdToDate(aYmd);
  const b = ymdToDate(bYmd);
  return Math.round((a - b) / 86400000);
}

export function usePlayerStats() {
  const [data, setData] = useState(() => loadRaw() || emptyData());

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data]);

  const saveResult = useCallback((date, score, targetName) => {
    setData((prev) => {
      // Don't double-save the same day.
      if (prev.history.some((h) => h.date === date)) return prev;

      let streak = 1;
      if (prev.lastPlayed) {
        const diff = dayDiff(date, prev.lastPlayed);
        if (diff === 1) streak = prev.streak + 1;
        else if (diff === 0) streak = prev.streak;
      }
      const bestStreak = Math.max(prev.bestStreak, streak);
      const history = [
        ...prev.history,
        { date, score, target: targetName, validated: true },
      ];
      return { history, streak, bestStreak, lastPlayed: date };
    });
  }, []);

  const hasPlayedToday = useCallback((date) => {
    return data.history.some((h) => h.date === date);
  }, [data]);

  const getStats = useCallback(() => {
    const history = data.history.slice().sort((a, b) => a.date.localeCompare(b.date));
    const totalGames = history.length;
    const last7 = history.slice(-7);
    const avgScore = last7.length
      ? Math.round(last7.reduce((s, h) => s + h.score, 0) / last7.length)
      : 0;
    return {
      streak: data.streak,
      bestStreak: data.bestStreak,
      avgScore,
      totalGames,
      history,
    };
  }, [data]);

  return { data, saveResult, hasPlayedToday, getStats };
}

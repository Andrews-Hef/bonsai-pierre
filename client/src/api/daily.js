// Fonctions d'appel des endpoints /v1, une par contrat backend.
// Aucune logique métier ici : juste la forme des requêtes.
import { apiFetch } from './client.js';

// GET /v1/daily -> { puzzle_on, grid_size, shape_name, start_grid_url,
//   target_grid_url, already_played, session: { token, started_at } }
export function getDaily(signal) {
  return apiFetch('/v1/daily', { signal });
}

// POST /v1/daily/submit  body { session_token, final_grid }
// -> { resemblance, duration_ms, score, rank, percentile, top[] }
// Erreurs : 401 / 403 / 409 (already_played) / 422 (grille invalide).
export function postSubmit(payload, signal) {
  return apiFetch('/v1/daily/submit', { method: 'POST', body: payload, signal });
}

// GET /v1/daily/leaderboard?date=YYYY-MM-DD
export function getLeaderboard(date, signal) {
  const q = date ? `?date=${encodeURIComponent(date)}` : '';
  return apiFetch(`/v1/daily/leaderboard${q}`, { signal });
}

// GET /v1/me/stats?days=30
export function getStats(days, signal) {
  const q = days ? `?days=${encodeURIComponent(days)}` : '';
  return apiFetch(`/v1/me/stats${q}`, { signal });
}

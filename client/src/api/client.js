// Client HTTP bas niveau pour l'API /v1.
//
// Responsabilités : injecter l'authentification, sérialiser/désérialiser le
// JSON, et transformer toute réponse non-2xx en ApiError exploitable par l'UI
// (status + code + message renvoyés par le backend). C'est le SEUL endroit qui
// connaît le mécanisme d'auth -> point de bascule unique vers la vraie auth.
import { API_BASE, DEV_USER_ID } from './config.js';

export class ApiError extends Error {
  constructor(status, code, message, body) {
    super(message || code || `HTTP ${status}`);
    this.name = 'ApiError';
    this.status = status; // 0 = échec réseau (pas de réponse)
    this.code = code; // ex. "already_played", "invalid_grid", ...
    this.body = body; // payload JSON brut si disponible
  }
}

// Le seul point à réécrire pour passer à la vraie auth (cookie / Bearer).
function authHeaders() {
  return { 'x-user-id': DEV_USER_ID };
}

function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// Appel JSON générique. `body` (objet) -> POST JSON ; absent -> GET.
export async function apiFetch(path, { method = 'GET', body, headers, signal } = {}) {
  const init = { method, headers: { ...authHeaders(), ...headers }, signal };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
    init.headers['content-type'] = 'application/json';
  }

  let res;
  try {
    res = await fetch(API_BASE + path, init);
  } catch (err) {
    if (err?.name === 'AbortError') throw err;
    throw new ApiError(0, 'network_error', `réseau indisponible (${err?.message ?? err})`);
  }

  const text = await res.text();
  const data = text ? safeJson(text) : null;
  if (!res.ok) {
    throw new ApiError(res.status, data?.error, data?.message, data);
  }
  return data;
}

// Récupère le CONTENU TEXTE d'une grille (base64) depuis son URL relative.
// Les routes /v1/grids/* renvoient le base64 brut (octets), jamais du JSON.
export async function fetchGridText(url, signal) {
  let res;
  try {
    res = await fetch(API_BASE + url, { headers: authHeaders(), signal });
  } catch (err) {
    if (err?.name === 'AbortError') throw err;
    throw new ApiError(0, 'network_error', `grille indisponible (${err?.message ?? err})`);
  }
  if (!res.ok) {
    throw new ApiError(res.status, 'grid_fetch_failed', `grille ${url} indisponible`);
  }
  return (await res.text()).trim();
}

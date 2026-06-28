// Configuration d'accès à l'API /v1.
//
// En dev, le proxy Vite mappe /v1 -> http://localhost:8080 : on reste donc en
// même origine et API_BASE est vide. Pour pointer un backend distant (preview,
// prod), définir VITE_API_URL (ex. "https://api.exemple.com").
export const API_BASE = import.meta.env?.VITE_API_URL ?? '';

// Auth DEV-ONLY : tient lieu du vrai middleware d'authentification. Le backend
// attend l'en-tête `x-user-id` (UUID v4 validé). En production, ce header sera
// remplacé par le vrai mécanisme (cookie de session / Authorization) ; le SEUL
// point à changer est authHeaders() dans client.js.
export const DEV_USER_ID =
  import.meta.env?.VITE_DEV_USER_ID ?? '00000000-0000-4000-8000-000000000001';

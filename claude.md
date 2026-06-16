# Projet : API "Stone Daily"

## Contexte
Jeu web "daily" : chaque jour une pierre (grille de voxels 3D) à tailler en une
forme cible. Score = ressemblance (IoU) + bonus de temps. Classement quotidien
+ streak. Le "reset" quotidien = la date qui avance en UTC, aucune suppression.
Tu construis UNIQUEMENT l'API backend. Pas de front, pas d'auth.

## Stack (confirme ou adapte à la mienne avant de commencer)
- Node.js + TypeScript
- Fastify
- PostgreSQL via Drizzle ORM
- Redis (ioredis) pour le classement
- Stockage objet (S3/R2) pour les grilles : abstrais-le derrière une interface
  `StorageClient { get(key), put(key, bytes) }` avec une impl locale (fs) pour les tests
- Vitest pour les tests
Suppose une auth existante : un middleware fournit `req.userId` (UUID).
Ne l'implémente PAS, mocke-la dans les tests.

## Modèle de données (écris les migrations)
- users(id uuid pk, display_name, current_streak int, longest_streak int,
  last_played_on date, created_at)
- daily_puzzles(puzzle_on date pk, grid_size int, shape_name, start_key,
  target_key, target_voxels int, seed bigint null, created_at)
- submissions(id uuid pk, user_id fk, puzzle_on fk, resemblance real,
  duration_ms int, score int, grid_key null, submitted_at,
  unique(user_id, puzzle_on))
- index sur submissions(puzzle_on, score desc, duration_ms asc)

## Règles métier (à respecter EXACTEMENT)
- Grille de voxels = bitset de N³ bits, gzip puis base64.
- IoU = |intersection| / |union| entre grille joueur et grille cible.
  TOUJOURS recalculé serveur. Le client n'est jamais cru sur son score.
- Score :
    base       = round(iou * 1000)
    speedBonus = iou >= 0.8 ? round(200 * max(0, 1 - duration_ms/180000)) : 0
    score      = base + speedBonus
- duration_ms = clamp(now - token.startedAt, 1000, 3_600_000)
- Un seul essai par (user, jour). 2e envoi -> 409 (via ON CONFLICT DO NOTHING).
- Streak (même transaction que l'insert) : si last_played_on == hier -> +1,
  sinon -> 1 ; longest = max(longest, current) ; last_played_on = aujourd'hui.

## Token de session (anti-triche temps)
- GET /daily émet un JWT HS256 (secret en env) :
  { userId, puzzleOn, startedAt: now(), jti }, exp 6h.
- POST /submit vérifie : signature + exp, userId == req.userId (403),
  puzzleOn == aujourd'hui UTC (409), puis calcule la durée depuis startedAt.

## Endpoints
1. GET  /v1/daily
   -> { puzzle_on, grid_size, shape_name, start_grid_url, target_grid_url,
        already_played, session: { token, started_at } }   (Cache-Control: no-store)
2. POST /v1/daily/submit   body { session_token, final_grid }
   -> { resemblance, duration_ms, score, rank, percentile, top[] }
   -> codes : 200, 401, 403, 409, 422 (grille malformée)
3. GET  /v1/daily/leaderboard?date=YYYY-MM-DD
   -> { date, total, top:[{rank,display_name,score,duration_ms}],
        me:{rank,percentile,score} }
4. GET  /v1/me/stats
   -> { current_streak, longest_streak, games_played, avg_resemblance,
        best_score, history:[{date,score,resemblance}] }

## Classement Redis
- sorted set "lb:{date}".
- zscore = score * 10_000_000 + (10_000_000 - min(duration_ms, 9_999_999))
  (le score domine ; à égalité, le temps le plus court gagne).
- top : ZREVRANGE ; rang : ZREVRANK ; percentile = (ZCARD - rang - 1)/ZCARD*100.
- EXPIRE lb:{date} à 7 jours ; fallback Postgres pour les dates plus anciennes.
- Redis est reconstructible depuis Postgres : ne le traite jamais comme la vérité.

## Sécurité / robustesse
- Rejette un body trop gros ; borne la taille décompressée avant de parser.
- Vérifie que la grille décodée fait bien grid_size³ bits, sinon 422.
- Codes d'erreur propres (401/403/409/422), jamais de 500 sur une entrée invalide.

## Comment travailler (important)
- Avance par étapes, dans cet ordre, et arrête-toi pour me montrer après chacune :
  1) scaffold + config (env, db, redis, storage)  2) migrations
  3) utilitaires purs : voxel (encode/decode/iou), score, token
  4) endpoints un par un  5) classement Redis
- Écris des tests Vitest au fur et à mesure, en priorité sur les fonctions pures
  (iou, score, streak) et sur la validation de /submit
  (one-shot -> 409, token expiré, userId mismatch -> 403, grille invalide -> 422).
- Garde le code simple, typé, sans abstraction prématurée.
- Si un choix d'archi est ambigu, pose-moi la question AVANT de coder.

## Définition de "terminé"
- Les 4 endpoints fonctionnent et sont testés.
- Un test prouve que le score est recalculé serveur (un client qui ment est ignoré).
- One-shot et streak couverts par des tests.
- README court : variables d'env, lancement des migrations, dev server.
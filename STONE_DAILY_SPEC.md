# Stone Daily — Spec d'implémentation (backend + ingestion)

## Contexte
Jeu web "daily" : chaque jour une pierre (grille de voxels 3D) à tailler en une
forme cible. Score = ressemblance (IoU) + bonus de temps. Classement quotidien
+ streak. Le "reset" quotidien = la date qui avance en UTC (aucune suppression).

## Périmètre
Tu construis **l'API backend** + **l'outil d'ingestion des puzzles (seed)**.
PAS de front. PAS d'auth : suppose un middleware qui fournit `req.userId` (UUID) ;
mocke-le dans les tests.

## Stack (confirme/adapte si la mienne diffère)
Node 22 LTS · TypeScript ESM · npm · Fastify · PostgreSQL via Drizzle ORM ·
Redis (ioredis) · stockage objet derrière une interface `StorageClient` (impl S3/R2
en prod, impl filesystem en dev) · Vitest · `tsx` en dev, `tsc` au build.

## Layout monorepo (repo existant `bonsai_io`)
```
bonsai_io/
  client/         <- ancien front, NE PAS TOUCHER
  server/         <- ancien back, NE PAS TOUCHER (retiré après cutover)
  shared/         <- code partagé ; y déposer voxel.ts (fourni)
  api/            <- NOUVELLE API (tout le code serveur ici)
  tools/seed/     <- CLI d'ingestion des puzzles
  migrations/     <- 0001_init_stone_daily.sql (fourni)
```

## Fichiers fournis — à utiliser tels quels
- **`migrations/0001_init_stone_daily.sql`** : le schéma. Drizzle en **schema-first** :
  écris `schema.ts` qui REPRODUIT exactement ce SQL, génère la migration avec
  Drizzle Kit, et **diff la migration générée contre ce fichier** (parité). Un seul
  système de migration.
- **`shared/voxel.ts`** : codec voxel + `iou`/`dice`/`precisionRecall` + `gameScore`
  + `canonicalize`. **N'implémente PAS ces fonctions ailleurs — importe-les.** C'est la
  source de vérité du format.
- *(référence)* `voxelgen.py` et `compare.py` : implémentations Python de la même logique
  (génération de formes, score, canonicalize). À utiliser comme référence pour porter
  le générateur de primitives et `makeStartStone`. Le format y est identique (les
  `.json` de formes déjà produits sont décodables par `decodeGrid`).

## Format voxel (FIGÉ)
Grille = N³ booléens, **N = 24**, `index = x*N*N + y*N + z`, Y vertical.
Sérialisation = bits big-endian (packbits) → gzip → base64 (voir `encodeGrid`/`decodeGrid`).
Les grilles `target` et `start` sont stockées dans le stockage objet ; on ne garde en
base que leurs clés (`target_key`, `start_key`).

## Règles métier (respecter exactement)
- Ressemblance = `iou(playerGrid, targetGrid)`, **recalculée serveur**. Le client n'est
  jamais cru sur son score.
- Score = `gameScore(resemblance, durationMs)` (qualité d'abord, bonus vitesse si IoU ≥ 0.8).
- `durationMs = clamp(now - token.startedAt, 1000, 3_600_000)`.
- Un seul essai par (user, jour) : `INSERT ... ON CONFLICT (user_id, puzzle_on) DO NOTHING`
  → 0 ligne = déjà joué → **409**.
- Streak (même transaction que l'insert) : `last_played_on == hier` → +1, sinon → 1 ;
  `longest = max(longest, current)` ; `last_played_on = aujourd'hui (UTC)`.

## Token de session (anti-triche temps)
- `GET /v1/daily` émet un JWT HS256 (secret en env) : `{ userId, puzzleOn, startedAt: now, jti }`, exp 6 h.
- `POST /submit` vérifie : signature + exp, `userId == req.userId` (403),
  `puzzleOn == aujourd'hui UTC` (409), puis calcule `durationMs` depuis `startedAt`.

## API (4 endpoints, préfixe /v1)
1. **GET /daily** → `{ puzzle_on, grid_size, shape_name, start_grid_url, target_grid_url,
   already_played, session:{ token, started_at } }`  · `Cache-Control: no-store`.
   Si la row du jour est absente → **503** + log (jamais de génération à la volée).
2. **POST /daily/submit** · body `{ session_token, final_grid }` →
   `{ resemblance, duration_ms, score, rank, percentile, top:[…3] }`.
   Ordre de validation : auth → token (sig+exp) → user match (403) → date du jour (409) →
   `assertSafeEncoded` puis `decodeGrid` + vérif longueur N³ (422) → recompute IoU →
   durée → score → insert (ON CONFLICT, 409) → ZADD Redis + streak (même transaction).
3. **GET /daily/leaderboard?date=YYYY-MM-DD&limit=10** (limit max 100) →
   `{ date, total, top:[{rank,display_name,score,duration_ms}], me:{rank,percentile,score} }`.
4. **GET /me/stats?days=30** (days max 365) →
   `{ current_streak, longest_streak, games_played, avg_resemblance, best_score,
      history:[{date,score,resemblance}] }`.
Codes d'erreur propres (401/403/409/422) ; jamais de 500 sur entrée invalide.

## Classement Redis
- Sorted set `lb:{date}`.
- `zscore = score * 10_000_000 + (10_000_000 - min(duration_ms, 9_999_999))`
  (le score domine ; à égalité, le temps le plus court gagne).
- top : `ZREVRANGE` · rang : `ZREVRANK` · percentile = `(ZCARD - rang - 1) / ZCARD * 100`.
- `EXPIRE lb:{date}` à 7 j ; fallback Postgres pour les dates plus anciennes.
- Postgres = vérité ; Redis est reconstructible, jamais traité comme la source.

## Servir les grilles
`StorageClient.publicUrl(key)` : prod (S3/R2) → URL CDN/bucket public ;
dev (fs) → `/v1/grids/:key` (implémente cette route qui stream via `get()`).
Pas de presigning (assets publics immuables). En-tête : `Cache-Control: public, max-age=31536000, immutable`.

## Outil d'ingestion : tools/seed
But : préparer les puzzles **à l'avance**. L'API ne génère jamais de puzzle, elle lit.
Commande :
```
npm run seed:puzzle -- --date 2026-06-20 --name "Oiseau" --input bird.vox
npm run seed:puzzle -- --date 2026-06-21 --name "Coeur"  --shape heart   # forme générée
```
Pipeline :
1. Charger la grille source : un `.vox` (parser MagicaVoxel) **ou** une forme générée
   (porter les primitives de `voxelgen.py`).
2. `canonicalize(grid, dims, 24, 2, perm?)` → grille N³ centrée/à l'échelle. `perm` corrige
   une convention d'axes si besoin (ex. `.vox` est souvent Z-up → `[0,2,1]`).
3. `makeStartStone(target)` → pierre brute qui ENVELOPPE la cible (ellipsoïde du bbox +
   marge + quelques entailles aléatoires seedées, puis `OR target` pour garantir que la
   cible reste atteignable). Réf : `make_start_stone` dans `voxelgen.py`.
4. `encodeGrid(target)` et `encodeGrid(start)` → upload via `StorageClient` → `target_key`, `start_key`.
5. `INSERT daily_puzzles (puzzle_on, grid_size=24, shape_name, start_key, target_key,
   target_voxels = voxelCount(target))`.
Idempotent : si la row existe pour cette date, refuser sauf `--force`.
Émettre un PNG d'aperçu de la cible canonique (QA lisibilité) à côté.

## Comment travailler (important)
Avance par étapes, arrête-toi pour montrer après chacune :
1) scaffold + config (env, db, redis, storage)  2) `schema.ts` + migration (diff vs le SQL fourni)
3) brancher `shared/voxel.ts`  4) endpoints un par un  5) classement Redis  6) `tools/seed`.
Tests Vitest au fil de l'eau, en priorité : codec round-trip, `iou`/`gameScore`,
streak, validation `/submit` (one-shot→409, token expiré, user mismatch→403, grille invalide→422),
et ingestion d'un `.vox` → row insérée + grille relisible.
Garde le code simple et typé. **Si un choix d'archi est ambigu, pose la question AVANT de coder.**

## Définition de "terminé"
- Les 4 endpoints + `seed:puzzle` fonctionnent et sont testés.
- Un `.vox` (ou une forme générée) ingéré devient un puzzle jouable de bout en bout.
- Un test prouve que le score est recalculé serveur (un client qui ment est ignoré).
- One-shot et streak couverts par des tests.
- README court : variables d'env, migrations, lancement du dev server, exemple `seed:puzzle`.
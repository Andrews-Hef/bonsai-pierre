# Stone Daily — API

Backend du jeu "daily" de taille de pierre (voxels 3D). Node 22 / TypeScript ESM,
Fastify, PostgreSQL (Drizzle), Redis (classement), stockage objet (fs en dev).
L'API ne **lit** que des puzzles préparés à l'avance (cf. `seed:puzzle`).

## Prérequis
- Node ≥ 22
- Docker (pour `docker-compose` en dev, et les tests Testcontainers)

## Variables d'environnement
Copier `.env.example` → `.env` (validé au démarrage, fail-fast).

| Variable | Rôle | Défaut |
|---|---|---|
| `NODE_ENV` | `development` \| `test` \| `production` | `development` |
| `PORT` / `HOST` | écoute HTTP | `8080` / `0.0.0.0` |
| `DATABASE_URL` | Postgres | — (requis) |
| `REDIS_URL` | Redis (classement) | — (requis) |
| `JWT_SECRET` | secret HS256 du token de session (≥ 16 car.) | — (requis) |
| `STORAGE_DRIVER` | `fs` \| `s3` | `fs` |
| `STORAGE_FS_DIR` | répertoire des grilles en mode `fs` | `./.data/grids` |
| `STORAGE_S3_*` | bucket/region/endpoint (requis si `STORAGE_DRIVER=s3`) | — |

## Démarrer l'infra de dev
```bash
docker compose up -d        # Postgres + Redis (depuis la racine du repo)
```

## Migrations
Système maison : applique `migrations/*.sql` dans l'ordre, chacune en transaction,
suivi dans la table `_migrations`.
```bash
npm run db:migrate          # applique les migrations en attente (utilise DATABASE_URL)
npm run db:parity           # (dev) régénère le diff Drizzle pour vérifier la parité schéma
```

## Dev server
```bash
npm install
npm run dev                 # tsx watch, recharge à chaud
# GET http://localhost:8080/health -> { ok: true }
```

## Endpoints (préfixe `/v1`)
- `GET  /v1/daily` — puzzle du jour + token de session (`Cache-Control: no-store`).
- `POST /v1/daily/submit` — soumission notée serveur (IoU recalculé, anti-triche temps).
- `GET  /v1/daily/leaderboard?date=YYYY-MM-DD&limit=10` — classement (Redis, fallback Postgres).
- `GET  /v1/me/stats?days=30` — streak actif, agrégats all-time, historique.
- `GET  /v1/grids/*` — stream des grilles (mode `fs`).

L'auth est supposée fournie en amont : un middleware pose `x-user-id` (UUID).
En dev/test on passe simplement cet en-tête.

## Préparer un puzzle (ingestion)
`seed:puzzle` prépare un puzzle à l'avance : charge une source (`.vox` MagicaVoxel
ou forme générée), normalise en 24³, fabrique la pierre brute (qui enveloppe la
cible → atteignable), encode, upload, insère la row, et écrit un **PNG d'aperçu**
(3 vues orthographiques) pour le QA de lisibilité.

```bash
# Depuis un .vox (Z-up corrigé par défaut via perm 0,2,1)
npm run seed:puzzle -- --date 2026-06-20 --name "Oiseau" --input bird.vox

# Depuis une forme générée (slugs : bird, fish, mug, heart, mushroom, tree, gem)
npm run seed:puzzle -- --date 2026-06-21 --name "Coeur" --shape heart

# Écraser une date déjà semée
npm run seed:puzzle -- --date 2026-06-21 --name "Coeur" --shape heart --force
```
Options : `--perm a,b,c` (correction d'axes), `--seed N` (entailles de la pierre),
`--out chemin.png` (aperçu, défaut `./.preview/<date>-<nom>.png`).

## Tests
```bash
npm test                    # Vitest : fonctions pures + intégration (Testcontainers)
```
Les tests d'intégration démarrent un Postgres + un Redis éphémères (Docker requis).
Base fraîche par run → pas d'état résiduel sur les tests one-shot/streak.

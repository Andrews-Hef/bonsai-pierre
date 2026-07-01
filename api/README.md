# Stone Daily — API

Backend du jeu "daily" de taille de pierre (voxels 3D). Node 22 / TypeScript ESM,
Fastify, PostgreSQL (Drizzle), Redis (classement), stockage objet (fs en dev).
L'API ne **lit** que des puzzles préparés à l'avance (cf. `seed:puzzle`).

## Prérequis
- Node ≥ 22
- Docker + le plugin `docker compose` (infra de dev **et** tests Testcontainers)

## Quickstart (zéro → API qui répond)
Toutes les commandes se lancent **depuis `api/`** (le compose à la racine est
ciblé via `-f ../docker-compose.yml`, on ne change donc jamais de répertoire).

Étapes 1 à 3 (identiques quel que soit le shell) :
```bash
cd api
npm install

# 1. Config : les valeurs d'exemple matchent déjà le docker-compose (aucune édition requise en dev)
cp .env.example .env      # PowerShell : Copy-Item .env.example .env

# 2. Infra de dev : Postgres + Redis, en attendant qu'ils soient "healthy"
docker compose -f ../docker-compose.yml up -d --wait

# 3. Schéma
npm run db:migrate
```

Étape 4 — **semer le puzzle du jour + l'utilisateur de dev**. La date est en UTC ;
la substitution de commande diffère selon le shell, choisis ta colonne :

<table>
<tr><th>bash / macOS / Linux / Git Bash</th><th>PowerShell (Windows)</th></tr>
<tr><td>

```bash
DAY=$(date -u +%F)

npm run seed:puzzle -- \
  --date "$DAY" --name "Coeur" --shape heart

npm run seed:user -- \
  --id 00000000-0000-4000-8000-000000000001 \
  --name "Joueur dev"
```

</td><td>

```powershell
$DAY = (Get-Date).ToUniversalTime().ToString('yyyy-MM-dd')

# ⚠ PowerShell : `npm run <s> -- --flag` avale les
# --flags → appeler npx tsx directement.
npx tsx src/tools/seed.ts `
  --date $DAY --name "Coeur" --shape heart

npx tsx src/tools/seedUser.ts `
  --id 00000000-0000-4000-8000-000000000001 `
  --name "Joueur dev"
```

</td></tr>
</table>

Étape 5 — lancer l'API (`tsx watch`, laisse tourner) :
```bash
npm run dev
```

Vérifier dans un autre terminal :
```bash
curl http://localhost:8080/health
# -> {"ok":true}

# Le puzzle du jour (auth simulée : on passe un UUID en en-tête x-user-id)
curl http://localhost:8080/v1/daily -H "x-user-id: 00000000-0000-4000-8000-000000000001"
```

> `/health` ne dépend ni de la base ni de Redis (il répond dès l'étape 5).
> Les étapes 2–4 sont nécessaires aux endpoints `/v1/*` (puzzle, classement, stats).
> `seed:user` n'est pas requis pour `GET /v1/daily`, mais l'est pour `/v1/daily/submit`
> et `/v1/me/stats` (insert avec FK vers `users`) — d'où sa présence dès l'étape 4.

## Variables d'environnement
Validées au démarrage (fail-fast). Les valeurs de `.env.example` suffisent en dev.

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

## Migrations
Système maison : applique `migrations/*.sql` dans l'ordre, chacune en transaction,
suivi dans la table `_migrations`. Lance Postgres (`docker compose … up -d --wait`) avant.
```bash
npm run db:migrate          # applique les migrations en attente (utilise DATABASE_URL)
npm run db:parity           # (dev) régénère le diff Drizzle pour vérifier la parité schéma
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

> **PowerShell** : `npm run seed:puzzle -- --flag` avale les `--flags` ; remplace
> `npm run seed:puzzle --` par `npx tsx src/tools/seed.ts` (mêmes arguments).

```bash
# Forme générée (slugs : bird, fish, mug, heart, mushroom, tree, gem) — zéro fichier requis
npm run seed:puzzle -- --date 2026-06-21 --name "Coeur" --shape heart

# Depuis un .vox que tu fournis (Z-up corrigé par défaut via perm 0,2,1).
# bird.vox est illustratif : remplace-le par ton propre fichier.
npm run seed:puzzle -- --date 2026-06-20 --name "Oiseau" --input bird.vox

# Écraser une date déjà semée
npm run seed:puzzle -- --date 2026-06-21 --name "Coeur" --shape heart --force
```
Options : `--perm a,b,c` (correction d'axes), `--seed N` (entailles de la pierre),
`--out chemin.png` (aperçu, défaut `./.preview/<date>-<nom>.png`).

## Semer un utilisateur de dev
`/v1/daily/submit` insère une `submission` dont la FK `user_id` pointe vers `users`.
Sans row correspondante, la soumission échoue. `seed:user` crée (ou met à jour) cette
row de façon **reproductible et idempotente** — pas de SQL ad hoc. Ré-exécutable :
il ne réaligne que le `display_name`, sans toucher au streak ni à `last_played_on`.

```bash
# Le front (client/) envoie par défaut cet UUID de dev en en-tête x-user-id.
npm run seed:user -- --id 00000000-0000-4000-8000-000000000001 --name "Joueur dev"
```
Options : `--id <uuid>` (requis), `--name "<Nom>"` (défaut `Joueur dev`).

## Tests
```bash
npm test                    # Vitest : fonctions pures + intégration (Testcontainers)
```
Les tests d'intégration démarrent un Postgres + un Redis éphémères (Docker requis,
indépendant du `docker compose` de dev). Base fraîche par run → pas d'état résiduel
sur les tests one-shot/streak.

-- Migration: 0001_init_stone_daily
-- Schéma initial du jeu "Stone Daily" (sculpture quotidienne).
-- Cible: PostgreSQL 13+.
--
-- Exécution atomique recommandée :
--   psql --single-transaction -f 0001_init_stone_daily.sql
-- Avec un runner (golang-migrate, node-pg-migrate, Flyway, Drizzle...),
-- la transaction est déjà gérée : n'ajoute pas de BEGIN/COMMIT toi-même.

create extension if not exists pgcrypto;  -- gen_random_uuid() (intégré en PG13+, sûr pour les versions antérieures)

-- ──────────────────────────────────────────────────────────────
-- Joueurs
-- ──────────────────────────────────────────────────────────────
create table users (
  id              uuid        primary key default gen_random_uuid(),
  display_name    text        not null
                              check (char_length(display_name) between 1 and 50),
  current_streak  integer     not null default 0 check (current_streak >= 0),
  longest_streak  integer     not null default 0 check (longest_streak >= 0),
  last_played_on  date,
  created_at      timestamptz not null default now()
);

-- ──────────────────────────────────────────────────────────────
-- Énigme du jour : une par date, pré-générée à l'avance.
-- La DATE est l'identité — tout le monde joue la même pierre le même jour (UTC).
-- ──────────────────────────────────────────────────────────────
create table daily_puzzles (
  puzzle_on      date        primary key,
  grid_size      integer     not null check (grid_size between 8 and 128),
  shape_name     text        not null,
  start_key      text        not null,                          -- clé stockage objet : pierre brute
  target_key     text        not null,                          -- clé stockage objet : forme cible
  target_voxels  integer     not null check (target_voxels > 0),-- |cible|, pré-calculé pour l'IoU
  seed           bigint,                                        -- génération procédurale (nullable)
  created_at     timestamptz not null default now()
);

-- ──────────────────────────────────────────────────────────────
-- Soumissions : un seul essai par joueur et par jour.
-- ──────────────────────────────────────────────────────────────
create table submissions (
  id            uuid        primary key default gen_random_uuid(),
  user_id       uuid        not null,
  puzzle_on     date        not null,
  resemblance   real        not null check (resemblance >= 0 and resemblance <= 1), -- IoU 0..1
  duration_ms   integer     not null check (duration_ms >= 0),
  score         integer     not null check (score >= 0),
  grid_key      text,                                           -- grille finale (replay/audit, purgeable)
  submitted_at  timestamptz not null default now(),

  constraint fk_submissions_user
    foreign key (user_id)   references users(id)                on delete cascade,
  constraint fk_submissions_puzzle
    foreign key (puzzle_on) references daily_puzzles(puzzle_on) on delete restrict,

  constraint uq_submissions_one_per_day
    unique (user_id, puzzle_on)                                 -- garde-fou "one-shot"
);

-- Classement du jour : score décroissant, puis temps croissant.
create index idx_submissions_leaderboard
  on submissions (puzzle_on, score desc, duration_ms asc);

-- L'historique d'un joueur est déjà couvert par l'index unique (user_id, puzzle_on).

-- ──────────────────────────────────────────────────────────────
-- Documentation inline
-- ──────────────────────────────────────────────────────────────
comment on column daily_puzzles.target_voxels is 'Nombre de voxels de la cible, pré-calculé pour accélérer l''IoU';
comment on column submissions.resemblance      is 'IoU 0..1, TOUJOURS recalculé côté serveur (jamais le score envoyé par le client)';
comment on constraint uq_submissions_one_per_day on submissions is 'Empêche un 2e essai le même jour : INSERT ... ON CONFLICT DO NOTHING -> 0 ligne -> 409';

-- ──────────────────────────────────────────────────────────────
-- Rollback (à déplacer dans la migration "down" si ton outil sépare up/down).
-- L'ordre inverse respecte les dépendances de clés étrangères.
-- ──────────────────────────────────────────────────────────────
-- drop table if exists submissions;
-- drop table if exists daily_puzzles;
-- drop table if exists users;